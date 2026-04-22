import express, { Request, Response } from 'express';
import { Appliance } from '../models/Appliance';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = express.Router();

// @desc    Récupérer tous les appareils
// @route   GET /api/appliances
// @access  Public
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const {
    page = 1,
    limit = 50,
    search,
    category,
    sortBy = 'name',
    sortOrder = 'asc'
  } = req.query;

  // Construction de la requête
  const query: any = { isActive: true };

  // Recherche textuelle
  if (search) {
    query.name = { $regex: search as string, $options: 'i' };
  }

  // Filtre par catégorie
  if (category) {
    query.category = category;
  }

  // Options de tri
  const sortOptions: any = {};
  sortOptions[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

  // Pagination
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

  // Exécution de la requête
  const appliances = await Appliance.find(query)
    .sort(sortOptions)
    .skip(skip)
    .limit(parseInt(limit as string));

  const total = await Appliance.countDocuments(query);

  res.json({
    success: true,
    data: {
      appliances,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalPages: Math.ceil(total / parseInt(limit as string))
      }
    }
  });
}));

// @desc    Récupérer un appareil par ID
// @route   GET /api/appliances/:id
// @access  Public
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const appliance = await Appliance.findById(req.params.id);

  if (!appliance || !appliance.isActive) {
    throw createError('Appareil non trouvé', 404);
  }

  res.json({
    success: true,
    data: { appliance }
  });
}));

// @desc    Créer un nouvel appareil
// @route   POST /api/appliances
// @access  Private (Admin)
router.post('/', authenticate, authorize('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { name, powerConsumption, unit, category, description, brand, model } = req.body;

  // Vérifier si l'appareil existe déjà
  const existingAppliance = await Appliance.findOne({ name });
  if (existingAppliance) {
    throw createError('Un appareil avec ce nom existe déjà', 400);
  }

  const appliance = new Appliance({
    name,
    powerConsumption,
    unit,
    category,
    description,
    brand,
    model
  });

  await appliance.save();

  logger.info(`✅ Nouvel appareil créé: ${name} par ${req.user!.email}`);

  res.status(201).json({
    success: true,
    message: 'Appareil créé avec succès',
    data: { appliance }
  });
}));

// @desc    Mettre à jour un appareil
// @route   PUT /api/appliances/:id
// @access  Private (Admin)
router.put('/:id', authenticate, authorize('admin'), asyncHandler(async (req: Request, res: Response) => {
  const appliance = await Appliance.findById(req.params.id);

  if (!appliance) {
    throw createError('Appareil non trouvé', 404);
  }

  // Vérifier si le nom est changé et s'il n'existe pas déjà
  if (req.body.name && req.body.name !== appliance.name) {
    const existingAppliance = await Appliance.findOne({ name: req.body.name });
    if (existingAppliance) {
      throw createError('Un appareil avec ce nom existe déjà', 400);
    }
  }

  // Mettre à jour l'appareil
  Object.assign(appliance, req.body);
  await appliance.save();

  logger.info(`✅ Appareil mis à jour: ${appliance.name} par ${req.user!.email}`);

  res.json({
    success: true,
    message: 'Appareil mis à jour avec succès',
    data: { appliance }
  });
}));

// @desc    Supprimer un appareil
// @route   DELETE /api/appliances/:id
// @access  Private (Admin)
router.delete('/:id', authenticate, authorize('admin'), asyncHandler(async (req: Request, res: Response) => {
  const appliance = await Appliance.findById(req.params.id);

  if (!appliance) {
    throw createError('Appareil non trouvé', 404);
  }

  // Soft delete - désactiver au lieu de supprimer
  appliance.isActive = false;
  await appliance.save();

  logger.info(`✅ Appareil supprimé: ${appliance.name} par ${req.user!.email}`);

  res.json({
    success: true,
    message: 'Appareil supprimé avec succès'
  });
}));

// @desc    Calculer la consommation électrique
// @route   POST /api/appliances/:id/calculate-consumption
// @access  Public
router.post('/:id/calculate-consumption', asyncHandler(async (req: Request, res: Response) => {
  const { hours, pricePerKwh = 0.15 } = req.body;

  if (!hours || hours <= 0) {
    throw createError('Nombre d\'heures requis et doit être positif', 400);
  }

  const appliance = await Appliance.findById(req.params.id);

  if (!appliance || !appliance.isActive) {
    throw createError('Appareil non trouvé', 404);
  }

  const consumption = (appliance as any).calculateConsumption(hours);
  const cost = (appliance as any).calculateElectricityCost(hours, pricePerKwh);

  res.json({
    success: true,
    data: {
      appliance: {
        _id: appliance._id,
        name: appliance.name,
        powerConsumption: appliance.powerConsumption,
        unit: appliance.unit
      },
      calculation: {
        hours,
        consumption: consumption,
        cost: cost,
        pricePerKwh
      }
    }
  });
}));

export default router;
