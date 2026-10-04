import express, { Request, Response } from 'express';
import { Client } from '../models/Client';
import { Order } from '../models/Order';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { normalizePhone, phoneDigitsRegex } from '../utils/phone';
import { escapeRegex } from '../utils/regex';
import { SALE_STATUSES } from '../services/salesService';

const router = express.Router();

// Toutes les routes clients sont réservées à l'admin
router.use(authenticate, authorize('admin'));

const EDITABLE_FIELDS = [
  'type',
  'name',
  'address',
  'contactPerson',
  'conditions',
  'notes',
] as const;

function pickClientFields(body: any) {
  const data: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    if (body[key] !== undefined) {
      data[key] = typeof body[key] === 'string' ? body[key].trim() : body[key];
    }
  }
  return data;
}

// @desc    Rechercher des clients (nom ou téléphone)
// @route   GET /api/clients?search=&type=&limit=
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { search, type } = req.query;
    const limit = Math.min(parseInt((req.query.limit as string) || '50') || 50, 200);

    const query: any = { isActive: true };
    if (type === 'individual' || type === 'cafe') {
      query.type = type;
    }

    const term = typeof search === 'string' ? search.trim() : '';
    if (term) {
      const or: any[] = [{ name: { $regex: escapeRegex(term), $options: 'i' } }];
      const digits = term.replace(/\D/g, '');
      if (digits.length >= 2) {
        // "22 123" → cherche "22123" dans le numéro normalisé
        const local = digits.replace(/^00/, '');
        or.push({ phone: { $regex: escapeRegex(local) } });
        const full = normalizePhone(term);
        if (full) {
          or.push({ phone: full });
        }
      }
      query.$or = or;
    }

    const clients = await Client.find(query).sort({ updatedAt: -1 }).limit(limit);

    // Activité de chaque client : commandes (hors annulées), CA généré (ventes), dernière commande
    const activity = await Order.aggregate([
      { $match: { clientId: { $in: clients.map((c) => c._id) }, status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: '$clientId',
          orderCount: { $sum: 1 },
          revenue: {
            $sum: { $cond: [{ $in: ['$status', SALE_STATUSES] }, '$totalPrice', 0] },
          },
          lastOrderAt: { $max: '$createdAt' },
        },
      },
    ]);
    const byClient = new Map(activity.map((a) => [a._id.toString(), a]));
    res.json({
      success: true,
      data: {
        clients: clients.map((c) => {
          const a = byClient.get(c._id.toString());
          return {
            ...c.toObject(),
            stats: {
              orderCount: a?.orderCount || 0,
              revenue: Math.round((a?.revenue || 0) * 1000) / 1000,
              lastOrderAt: a?.lastOrderAt || null,
            },
          };
        }),
      },
    });
  })
);

// @desc    Créer un client
// @route   POST /api/clients
// Si le téléphone (normalisé) existe déjà → 409 avec le client existant
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const data = pickClientFields(req.body);
    const phone = normalizePhone(req.body.phone);

    if (!data.name) {
      throw createError(data.type === 'cafe' ? 'Nom du café requis' : 'Nom requis', 400);
    }
    if (!phone) {
      throw createError('Téléphone invalide (au moins 8 chiffres)', 400);
    }

    const existing = await Client.findOne({ phone, isActive: true });
    if (existing) {
      res.status(409).json({
        success: false,
        message: `Ce numéro appartient déjà à ${existing.name}`,
        data: { client: existing },
      });
      return;
    }

    const client = await Client.create({ ...data, phone });
    logger.info(`Client cree: ${client.name} (${client.type}) par ${req.user!.email}`);
    res.status(201).json({ success: true, data: { client } });
  })
);

// @desc    Fiche client + historique des commandes
// @route   GET /api/clients/:id
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const client = await Client.findById(req.params.id);
    if (!client) {
      throw createError('Client non trouvé', 404);
    }

    // Commandes liées à la fiche + anciennes commandes (sans fiche) au même numéro
    const candidates = await Order.find({
      $or: [
        { clientId: client._id },
        { clientId: null, clientPhone: { $regex: phoneDigitsRegex(client.phone) } },
      ],
    })
      .populate('items.recipeId', 'name variants.sizeName')
      .sort({ createdAt: -1 });

    const orders = candidates.filter(
      (o) =>
        (o.clientId && o.clientId.toString() === client._id.toString()) ||
        normalizePhone(o.clientPhone) === client.phone
    );

    const counted = orders.filter((o) => o.status !== 'cancelled');
    const stats = {
      orderCount: counted.length,
      cancelledCount: orders.length - counted.length,
      lastOrderAt: counted[0]?.createdAt || null,
      totalOrdered: Math.round(counted.reduce((s, o) => s + (o.totalPrice || 0), 0) * 1000) / 1000,
      // CA généré = ventes (commandes acceptées), payées ou non ; encaissé = argent reçu
      revenue:
        Math.round(
          orders
            .filter((o) => SALE_STATUSES.includes(o.status))
            .reduce((s, o) => s + (o.totalPrice || 0), 0) * 1000
        ) / 1000,
      collected:
        Math.round(
          orders
            .filter((o) => SALE_STATUSES.includes(o.status))
            .reduce((s, o) => s + (o.amountPaid || 0), 0) * 1000
        ) / 1000,
    };

    res.json({
      success: true,
      data: {
        client,
        stats,
        orders: orders.map((o) => ({
          _id: o._id,
          createdAt: o.createdAt,
          requestedDate: o.requestedDate,
          confirmedDate: o.confirmedDate,
          orderNumber: o.orderNumber,
          status: o.status,
          totalPrice: o.totalPrice,
          amountPaid: o.amountPaid || 0,
          paymentStatus: o.paymentStatus || 'unpaid',
          source: o.source,
          items: o.items.map((it: any) => ({
            recipeName: it.recipeId?.name || 'Recette',
            sizeName: it.recipeId?.variants?.[it.variantIndex]?.sizeName || '',
            quantity: it.quantity,
          })),
        })),
      },
    });
  })
);

// @desc    Modifier un client
// @route   PUT /api/clients/:id
router.put(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const client = await Client.findById(req.params.id);
    if (!client) {
      throw createError('Client non trouvé', 404);
    }

    const data = pickClientFields(req.body);
    if (req.body.phone !== undefined) {
      const phone = normalizePhone(req.body.phone);
      if (!phone) {
        throw createError('Téléphone invalide (au moins 8 chiffres)', 400);
      }
      const duplicate = await Client.findOne({ phone, isActive: true, _id: { $ne: client._id } });
      if (duplicate) {
        throw createError(`Ce numéro appartient déjà à ${duplicate.name}`, 409);
      }
      data.phone = phone;
    }
    if (data.name !== undefined && !data.name) {
      throw createError('Nom requis', 400);
    }

    Object.assign(client, data);
    await client.save();
    logger.info(`Client modifie: ${client.name} par ${req.user!.email}`);
    res.json({ success: true, data: { client } });
  })
);

// @desc    Archiver un client (soft delete — l'historique est conservé)
// @route   DELETE /api/clients/:id
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const client = await Client.findById(req.params.id);
    if (!client) {
      throw createError('Client non trouvé', 404);
    }
    client.isActive = false;
    await client.save();
    logger.info(`Client archive: ${client.name} par ${req.user!.email}`);
    res.json({ success: true, message: 'Client archivé' });
  })
);

export default router;
