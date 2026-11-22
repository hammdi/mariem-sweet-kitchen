import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api, { withIdempotency } from '../../services/api';
import {
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Chip,
  Checkbox,
  FormControlLabel,
  Paper,
  Alert,
  TextField,
  ButtonBase,
} from '@mui/material';
import {
  Call,
  CheckCircle,
  WhatsApp,
  Cancel as CancelIcon,
  Replay,
  Inventory2,
  Person,
  EventAvailable,
  WarningAmber,
  Edit,
  Add,
} from '@mui/icons-material';
import StockNeedsPanel from '../../components/admin/StockNeedsPanel';
import DateTimeField from '../../components/common/DateTimeField';
import OrderPaymentCard from '../../components/admin/OrderPaymentCard';
import FeesEditor, { FeeDraft, toDrafts, toFees } from '../../components/admin/FeesEditor';
import PackagingPicker, { usePackagingOptions } from '../../components/admin/PackagingPicker';
import type { PackagingChoice } from '../../utils/packaging';
import type { OrderStockState, StockNeed } from '../../types/admin';
import { formatDate, formatDT, formatQty } from '../../utils/format';
import { useIdempotentAction } from '../../hooks/useIdempotencyKey';
import { useAdminData } from '../../context/AdminDataContext';
import {
  OrderStatusBadge,
  PageHeader,
  PaymentStatusBadge,
  ResponsiveDialog,
  SoftIcon,
  StatusBadge,
} from '../../components/ui';
import { color, ORDER_STATUS, radius } from '../../theme/tokens';

const Line = ({ label, value }: { label: string; value: string }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.4 }}>
    <Typography variant="body2" sx={{ color: color.inkSoft }}>
      {label}
    </Typography>
    <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
      {value}
    </Typography>
  </Box>
);

/** Avancement réel (le paiement est suivi à part, carte « Paiement »). */
const STEPS = [
  { status: 'pending', label: 'En attente', emoji: '📝' },
  { status: 'confirmed', label: 'Confirmée', emoji: '✅' },
  { status: 'preparing', label: 'En préparation', emoji: '👩‍🍳' },
  { status: 'ready', label: 'Prête', emoji: '🎂' },
  { status: 'delivered', label: 'Remise', emoji: '🤝' },
] as const;
const stepIndex = (status: string) =>
  STEPS.findIndex((s) => s.status === (status === 'paid' ? 'confirmed' : status));
const STARTED = ['preparing', 'ready', 'delivered'];
const CANCEL_REASONS = [
  'Client a annulé',
  'Client injoignable',
  'Erreur de saisie',
  'Problème de préparation',
];

type Transition = {
  status: string;
  title: string;
  text: string;
  confirm: string;
  tone?: 'error' | 'primary' | 'success';
};

const OrderDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { refresh } = useAdminData();
  const [order, setOrder] = useState<any>(null);
  const [allIngredients, setAllIngredients] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [stockNeeds, setStockNeeds] = useState<
    ({ needs: StockNeed[]; deducted: boolean } & OrderStockState) | null
  >(null);
  const [transition, setTransition] = useState<Transition | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreReason, setRestoreReason] = useState('');
  const restoreOp = useIdempotentAction();
  const [feesOpen, setFeesOpen] = useState(false);
  const [feesDraft, setFeesDraft] = useState<FeeDraft[]>([]);
  const [feesSaving, setFeesSaving] = useState(false);
  const packagingOptions = usePackagingOptions();
  const [packTarget, setPackTarget] = useState<number | null>(null); // index de l'article
  const [packDraft, setPackDraft] = useState<PackagingChoice[]>([]);
  const [packSaving, setPackSaving] = useState(false);

  useEffect(() => {
    api
      .get('/ingredients')
      .then((res) => setAllIngredients(res.data.data?.ingredients || res.data.data || []))
      .catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/orders/${id}`);
      setOrder(res.data.data?.order);
    } catch {
      navigate('/admin/orders');
      return;
    }
    try {
      const needsRes = await api.get(`/orders/${id}/stock-needs`);
      const data: OrderStockState = needsRes.data.data;
      setStockNeeds({ ...data, needs: data.stockNeeds || [], deducted: !!data.stockDeducted });
    } catch {
      setStockNeeds(null);
    }
  }, [id, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const findIngredient = (ingId: any) => {
    const iid = typeof ingId === 'object' ? ingId._id?.toString() : ingId?.toString();
    return allIngredients.find((i) => i._id === iid) || (typeof ingId === 'object' ? ingId : null);
  };
  const getIngredientName = (ingId: any) => findIngredient(ingId)?.name || 'Ingrédient';

  // Cocher « le client apporte » : prix recalculé avec les prix figés
  const toggleIngredient = async (itemIndex: number, ingredientId: string) => {
    if (!order || saving) return;
    setSaving(true);
    const item = order.items[itemIndex];
    const provided = [...(item.clientProvidedIngredients || [])];
    const idx = provided.indexOf(ingredientId);
    if (idx >= 0) provided.splice(idx, 1);
    else provided.push(ingredientId);
    try {
      const updates = order.items.map((_: any, i: number) => ({
        index: i,
        clientProvidedIngredients:
          i === itemIndex ? provided : order.items[i].clientProvidedIngredients || [],
      }));
      await api.put(`/orders/${id}`, { items: updates });
      await load();
      toast.success('Prix recalculé');
    } catch {
      /* toast intercepteur */
    }
    setSaving(false);
  };

  const changeStatus = async (status: string, why?: string) => {
    setBusy(true);
    try {
      await api.put(`/orders/${id}/status`, { status, reason: why || undefined });
      await load();
      refresh();
      const messages: Record<string, string> = {
        confirmed: 'Commande confirmée',
        preparing: 'Préparation commencée — ingrédients utilisés',
        ready: `Commande prête ! Prévenez ${order.clientName}`,
        delivered: 'Commande remise au client',
        cancelled: 'Commande annulée',
        pending: 'Commande remise en attente',
      };
      toast.success(messages[status] || 'Avancement mis à jour');
      setTransition(null);
    } catch {
      /* toast intercepteur (message du serveur) */
    }
    setBusy(false);
  };

  const saveFees = async () => {
    setFeesSaving(true);
    try {
      await api.put(`/orders/${id}/fees`, { additionalFees: toFees(feesDraft) });
      toast.success('Frais enregistrés — total mis à jour');
      setFeesOpen(false);
      await load();
      refresh();
    } catch {
      /* toast intercepteur */
    }
    setFeesSaving(false);
  };

  const savePackaging = async () => {
    if (packTarget === null) return;
    setPackSaving(true);
    try {
      await api.put(`/orders/${id}/packaging`, {
        items: [{ index: packTarget, packaging: packDraft.filter((p) => p.quantity > 0) }],
      });
      toast.success('Emballage enregistré — total mis à jour');
      setPackTarget(null);
      await load();
      refresh();
    } catch {
      /* toast intercepteur */
    }
    setPackSaving(false);
  };

  if (!order) return null;

  const fees: { label: string; amount: number }[] = order.additionalFees || [];
  const packCost = (item: any) =>
    (item.packaging || []).reduce(
      (t: number, p: { quantity: number; unitPrice: number }) => t + p.quantity * p.unitPrice,
      0
    );
  const packagingTotal =
    Math.round(
      order.items.reduce((t: number, it: any) => t + packCost(it) * it.quantity, 0) * 1000
    ) / 1000;
  const itemsTotal =
    Math.round((order.totalPrice - fees.reduce((t, f) => t + (f.amount || 0), 0)) * 1000) / 1000;

  const status = order.status as string;
  const current = stepIndex(status);
  const consumed = STARTED.includes(status) || !!stockNeeds?.deducted;
  const isEditable = ['pending', 'confirmed', 'paid'].includes(status);
  // l'emballage est retiré du stock au début de la préparation, comme les ingrédients
  const canEditPackaging = isEditable && !order.stockDeducted && !stockNeeds?.deducted;
  const unpaid = order.paymentStatus !== 'paid';
  const ref = stockNeeds?.orderRef || '';
  const canPrepare = !stockNeeds || stockNeeds.canStartPreparation;

  // Action principale selon l'avancement
  const next: (Transition & { label: string; disabled?: boolean; hint?: string }) | null =
    status === 'pending'
      ? {
          status: 'confirmed',
          label: 'Confirmer la commande',
          title: 'Confirmer la commande ?',
          text: 'Elle devient une vente (comptée dans le chiffre d’affaires, payée ou non).',
          confirm: 'Confirmer',
        }
      : status === 'confirmed' || status === 'paid'
        ? {
            status: 'preparing',
            label: 'Commencer la préparation',
            title: 'Commencer la préparation ?',
            text: stockNeeds?.usesReservedStock
              ? 'Attention : ces ingrédients sont prévus pour des commandes plus proches. Les utiliser maintenant les mettra en manque. Les ingrédients seront retirés du stock (une seule fois).'
              : 'Les ingrédients de la commande vont être retirés du stock (une seule fois). Le paiement n’est pas obligatoire pour commencer.',
            confirm: 'Commencer',
            disabled: !canPrepare,
            hint: !canPrepare
              ? 'Stock insuffisant : achetez d’abord les ingrédients manquants.'
              : stockNeeds?.usesReservedStock
                ? 'Stock réservé à des commandes plus proches.'
                : undefined,
          }
        : status === 'preparing'
          ? {
              status: 'ready',
              label: 'Marquer prête',
              title: 'La commande est prête ?',
              text: 'Vous pourrez prévenir le client.',
              confirm: 'Oui, elle est prête',
              tone: 'success',
            }
          : status === 'ready'
            ? {
                status: 'delivered',
                label: 'Remettre au client',
                title: 'Remettre la commande au client ?',
                text: unpaid
                  ? `Elle n’est pas entièrement payée : elle restera dans « À encaisser » jusqu’au paiement.`
                  : 'La commande est payée et sera marquée comme remise.',
                confirm: 'Remise au client',
                tone: 'success',
              }
            : null;

  const back: Transition | null =
    status === 'confirmed' || status === 'paid'
      ? {
          status: 'pending',
          title: 'Remettre en attente ?',
          text: 'La commande ne sera plus comptée comme une vente.',
          confirm: 'Remettre en attente',
        }
      : status === 'ready'
        ? {
            status: 'preparing',
            title: 'Revenir à « En préparation » ?',
            text: 'Les ingrédients ne sont pas retirés une deuxième fois.',
            confirm: 'Revenir',
          }
        : status === 'delivered'
          ? {
              status: 'ready',
              title: 'Revenir à « Prête » ?',
              text: 'Si la remise a été notée par erreur.',
              confirm: 'Revenir',
            }
          : null;

  const canCancel = ['pending', 'confirmed', 'paid', 'preparing', 'ready'].includes(status);
  const canReactivate = status === 'cancelled' && !stockNeeds?.deducted;
  const reasonRequired = transition?.status === 'cancelled' && consumed;

  return (
    <Box>
      <PageHeader
        backTo="/admin/orders"
        helpFlow="payment"
        title={
          <>
            {ref ? `${ref} · ` : ''}
            {order.clientName}
          </>
        }
        subtitle={
          <>
            {order.confirmedDate || order.requestedDate
              ? `Prévue le ${formatDate(order.confirmedDate || order.requestedDate, true)}`
              : 'Sans date prévue'}{' '}
            · commandée le {formatDate(order.createdAt, true)}
          </>
        }
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={<WhatsApp />}
              href={`https://wa.me/${order.clientPhone?.replace('+', '')}`}
              target="_blank"
            >
              WhatsApp
            </Button>
            <Button variant="outlined" startIcon={<Call />} href={`tel:${order.clientPhone}`}>
              Appeler
            </Button>
          </>
        }
      />

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2, mt: -1.5 }}>
        <OrderStatusBadge status={status} size="medium" />
        <PaymentStatusBadge status={order.paymentStatus} size="medium" />
        {order.clientId?.type === 'cafe' && <StatusBadge tone="info" label="Café" size="medium" />}
        {saving && <StatusBadge tone="neutral" label="Recalcul…" size="medium" />}
      </Box>

      {status === 'cancelled' && (
        <Alert
          severity="error"
          icon={<CancelIcon />}
          sx={{ mb: 2 }}
          action={
            canReactivate ? (
              <Button
                color="inherit"
                size="small"
                startIcon={<Replay />}
                onClick={() =>
                  setTransition({
                    status: 'pending',
                    title: 'Réactiver la commande ?',
                    text: 'Elle repasse « En attente ».',
                    confirm: 'Réactiver',
                  })
                }
              >
                Réactiver
              </Button>
            ) : undefined
          }
        >
          <Typography sx={{ fontWeight: 700 }}>
            Commande annulée{order.cancelledAt ? ` le ${formatDate(order.cancelledAt, true)}` : ''}
          </Typography>
          {order.cancellationReason && (
            <Typography variant="body2">Raison : {order.cancellationReason}</Typography>
          )}
          {stockNeeds?.deducted && (
            <Typography variant="body2">
              Les ingrédients avaient déjà été utilisés : ils n’ont pas été remis en stock
              automatiquement.
            </Typography>
          )}
          {order.amountPaid > 0 && (
            <Typography variant="body2">
              {formatDT(order.amountPaid)} reçus : à rembourser depuis la carte Paiement si besoin.
            </Typography>
          )}
        </Alert>
      )}
      {status === 'ready' && (
        <Alert severity="success" icon={<CheckCircle />} sx={{ mb: 2 }}>
          Commande prête — {formatDT(order.totalPrice)}. Prévenez {order.clientName} !
          {unpaid ? ' Pensez à encaisser le paiement.' : ''}
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            md: 'minmax(0, 5fr) minmax(0, 7fr)',
            lg: 'minmax(0, 4fr) minmax(0, 8fr)',
          },
          alignItems: 'start',
        }}
      >
        {/* Colonne gauche : avancement, paiement, client */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <Card data-tour="order-progress" sx={{ p: 2.25 }}>
            <Typography variant="h6" sx={{ fontSize: '1rem', mb: 0.25 }}>
              Avancement
            </Typography>
            <Typography variant="caption" sx={{ color: color.inkSoft }}>
              Ce qui est fait — le paiement se suit à part
            </Typography>
            <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column' }}>
              {STEPS.map((s, i) => {
                const done = status !== 'cancelled' && i < current;
                const active = status !== 'cancelled' && i === current;
                const t = ORDER_STATUS[s.status];
                return (
                  <Box key={s.status} sx={{ display: 'flex', gap: 1.25, alignItems: 'stretch' }}>
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        width: 30,
                      }}
                    >
                      <Box
                        sx={{
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: 15,
                          bgcolor: active
                            ? color.primarySoft
                            : done
                              ? color.successSoft
                              : color.bgSubtle,
                          border: `2px solid ${active ? color.primary : done ? color.success : color.border}`,
                          filter: !done && !active ? 'grayscale(1)' : 'none',
                          opacity: !done && !active ? 0.6 : 1,
                        }}
                      >
                        {done ? (
                          <CheckCircle sx={{ fontSize: 18, color: color.success }} />
                        ) : (
                          s.emoji
                        )}
                      </Box>
                      {i < STEPS.length - 1 && (
                        <Box
                          sx={{
                            flex: 1,
                            width: 2,
                            minHeight: 12,
                            bgcolor: done ? color.success : color.border,
                          }}
                        />
                      )}
                    </Box>
                    <Box sx={{ pb: i < STEPS.length - 1 ? 1.25 : 0, pt: 0.5 }}>
                      <Typography
                        sx={{
                          fontWeight: active ? 800 : 600,
                          fontSize: '0.9rem',
                          color: active ? color.ink : done ? color.inkSoft : color.inkMuted,
                        }}
                      >
                        {s.label}{' '}
                        {active && t && (
                          <Box
                            component="span"
                            sx={{ color: color.primaryDark, fontSize: '0.75rem' }}
                          >
                            · maintenant
                          </Box>
                        )}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>

            {next && (
              <Box sx={{ mt: 2 }}>
                <Button
                  data-tour="order-prepare"
                  variant="contained"
                  fullWidth
                  size="large"
                  color={next.tone === 'success' ? 'success' : 'primary'}
                  disabled={next.disabled || busy}
                  onClick={() => setTransition(next)}
                >
                  {next.label}
                </Button>
                {next.hint && (
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      mt: 0.75,
                      color: next.disabled ? color.dangerDark : color.warningDark,
                    }}
                  >
                    {next.hint}
                  </Typography>
                )}
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 1, mt: 1.25, flexWrap: 'wrap' }}>
              {back && (
                <Button
                  size="small"
                  variant="outlined"
                  sx={{ flex: 1 }}
                  onClick={() => setTransition(back)}
                >
                  {back.status === 'pending' ? 'Remettre en attente' : 'Revenir en arrière'}
                </Button>
              )}
              {canCancel && (
                <Button
                  data-tour="order-cancel"
                  size="small"
                  color="error"
                  variant="outlined"
                  sx={{ flex: 1 }}
                  onClick={() => {
                    setReason('');
                    setTransition({
                      status: 'cancelled',
                      title: 'Annuler la commande ?',
                      text: consumed
                        ? 'La préparation a commencé : les ingrédients ont déjà été utilisés et ne seront PAS remis en stock automatiquement. Indiquez la raison.'
                        : 'Rien n’a encore été utilisé : les achats prévus pour cette commande seront libérés.',
                      confirm: 'Annuler la commande',
                      tone: 'error',
                    });
                  }}
                >
                  Annuler la commande
                </Button>
              )}
            </Box>
          </Card>

          <OrderPaymentCard
            orderId={order._id}
            orderStatus={status}
            refreshKey={`${status}-${order.totalPrice}-${order.amountPaid}`}
            onChanged={() => {
              load();
              refresh();
            }}
          />

          <Card sx={{ p: 2.25 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
              <SoftIcon tone="info" size={34}>
                <Person />
              </SoftIcon>
              <Typography variant="h6" sx={{ fontSize: '1rem', flex: 1 }}>
                Client
              </Typography>
              {order.clientId?._id && (
                <Button
                  size="small"
                  onClick={() => navigate(`/admin/clients/${order.clientId._id}`)}
                >
                  Fiche client
                </Button>
              )}
            </Box>
            <Typography sx={{ fontWeight: 700 }}>{order.clientName}</Typography>
            <Typography variant="body2" sx={{ color: color.inkSoft }}>
              {order.clientPhone}
            </Typography>
            {order.clientId?.conditions && (
              <Typography variant="body2" sx={{ color: color.inkSoft, mt: 0.5 }}>
                Conditions : {order.clientId.conditions}
              </Typography>
            )}
            {order.notes && (
              <Box sx={{ mt: 1, p: 1.25, borderRadius: `${radius.sm}px`, bgcolor: color.bgSubtle }}>
                <Typography variant="body2">📝 {order.notes}</Typography>
              </Box>
            )}
            {order.requestedDate && (
              <Box
                sx={{
                  mt: 1.5,
                  p: 1.25,
                  borderRadius: `${radius.sm}px`,
                  bgcolor: color.warningSoft,
                  border: `1px solid ${color.border}`,
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 700, color: color.warningDark }}>
                  Rendez-vous souhaité par le client
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {new Date(order.requestedDate).toLocaleString('fr-FR', {
                    dateStyle: 'full',
                    timeStyle: 'short',
                  })}
                </Typography>
              </Box>
            )}
            <Box sx={{ mt: 2 }}>
              <Typography
                variant="subtitle2"
                sx={{ mb: 0.75, display: 'flex', alignItems: 'center', gap: 0.5 }}
              >
                <EventAvailable sx={{ fontSize: 18, color: color.success }} /> Date confirmée
              </Typography>
              <DateTimeField
                label="Date confirmée"
                disabled={['delivered', 'cancelled'].includes(status)}
                value={order.confirmedDate || null}
                onChange={async (iso) => {
                  try {
                    await api.put(`/orders/${id}`, { confirmedDate: iso });
                    await load();
                    toast.success(iso ? 'Date confirmée' : 'Date retirée');
                  } catch {
                    /* toast intercepteur */
                  }
                }}
              />
            </Box>
          </Card>
        </Box>

        {/* Colonne droite : ingrédients, produits, total */}
        <Box sx={{ minWidth: 0 }}>
          {stockNeeds?.active &&
            (() => {
              const missing = stockNeeds.needs.filter((n) => n.status === 'missing');
              const dateText = stockNeeds.neededBy
                ? `Ingrédients nécessaires pour le ${formatDate(stockNeeds.neededBy, true)}`
                : 'Pas de date prévue pour cette commande';
              if (missing.length === 0) {
                return (
                  <Alert severity="success" sx={{ mb: 2 }}>
                    Tous les ingrédients sont disponibles. {dateText}.
                  </Alert>
                );
              }
              const purchaseLabel = (ingredientId: string) => {
                const pn = stockNeeds.purchaseNeeds.find(
                  (p) => String(p.ingredientId) === ingredientId && p.status === 'open'
                );
                if (!pn) return 'à acheter';
                return pn.missingQty < pn.maxMissingQty ? 'partiellement acheté' : 'à acheter';
              };
              return (
                <Alert
                  data-tour="order-missing"
                  severity={stockNeeds.canStartPreparation ? 'info' : 'warning'}
                  icon={<WarningAmber />}
                  sx={{ mb: 2, alignItems: 'flex-start' }}
                  action={
                    <Button
                      color="inherit"
                      size="small"
                      onClick={() => navigate('/admin/shopping-list')}
                    >
                      Liste de courses
                    </Button>
                  }
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Commande enregistrée —{' '}
                    {stockNeeds.canStartPreparation
                      ? 'stock réservé à des commandes prévues avant'
                      : 'la préparation ne peut pas encore commencer'}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    {dateText}.
                  </Typography>
                  {missing.map((n) => (
                    <Typography variant="body2" key={n.ingredientId}>
                      <strong>{n.name}</strong> : manque {formatQty(n.missing)} {n.unit} (disponible{' '}
                      {formatQty(n.stock)} / nécessaire {formatQty(n.needed)}) —{' '}
                      {purchaseLabel(n.ingredientId)}
                    </Typography>
                  ))}
                </Alert>
              );
            })()}

          {order.items.map((item: any, itemIndex: number) => {
            const recipe = item.recipeId;
            const recipeName = recipe && typeof recipe === 'object' ? recipe.name : 'Recette';
            const variant =
              recipe && typeof recipe === 'object' ? recipe.variants?.[item.variantIndex] : null;

            return (
              <Card key={itemIndex} sx={{ mb: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6" sx={{ fontSize: '1.05rem' }}>
                      {recipeName} ×{item.quantity}
                    </Typography>
                    <Typography variant="h6" color="primary.main" sx={{ fontWeight: 600 }}>
                      {((item.calculatedPrice?.total || 0) * item.quantity).toFixed(2)} DT
                    </Typography>
                  </Box>

                  {variant && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Taille : {variant.sizeName} ({variant.portions} portions)
                    </Typography>
                  )}

                  {/* Ce que le client a propose */}
                  {item.clientOfferedIngredients?.length > 0 && (
                    <Paper
                      variant="outlined"
                      sx={{ p: 1.5, mb: 2, bgcolor: color.infoSoft, borderColor: color.border }}
                    >
                      <Typography
                        variant="subtitle2"
                        sx={{ fontWeight: 600, color: color.infoDark }}
                      >
                        Le client propose d’apporter :
                      </Typography>
                      {item.clientOfferedIngredients.map((offId: string) => {
                        const name = getIngredientName(offId);
                        return (
                          <Typography variant="body2" key={offId}>
                            • {name}
                          </Typography>
                        );
                      })}
                    </Paper>
                  )}

                  {/* Ingredients avec checkbox — sauvegarde auto */}
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {isEditable
                      ? 'Cochez les ingrédients que le client apporte :'
                      : 'Ingrédients :'}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 2 }}>
                    {variant?.ingredients?.map((vi: any) => {
                      const ingRef = vi.ingredientId;
                      const ingId = typeof ingRef === 'object' ? ingRef._id : ingRef;
                      const ingName = getIngredientName(ingRef);
                      const isProvided = (item.clientProvidedIngredients || []).includes(ingId);
                      const isOfferedByClient = (item.clientOfferedIngredients || []).includes(
                        ingId
                      );
                      // Cout fige a la creation de la commande (unites deja converties)
                      const cost: number | null =
                        item.priceSnapshot?.ingredients?.find(
                          (si: any) => String(si.ingredientId) === String(ingId)
                        )?.fullCost ?? null;
                      // Stock : meme calcul que la deduction (besoin total de la commande)
                      const need = stockNeeds?.needs.find((n) => n.ingredientId === String(ingId));

                      return (
                        <Box
                          key={ingId}
                          sx={{
                            display: 'flex',
                            alignItems: { xs: 'flex-start', sm: 'center' },
                            gap: { xs: 0.5, sm: 1 },
                            flexWrap: 'wrap',
                          }}
                        >
                          <FormControlLabel
                            sx={{ flex: 1, minWidth: 0 }}
                            control={
                              <Checkbox
                                checked={isProvided}
                                onChange={() => toggleIngredient(itemIndex, ingId)}
                                disabled={saving || !isEditable}
                              />
                            }
                            label={
                              <Typography
                                variant="body2"
                                sx={{
                                  textDecoration: isProvided ? 'line-through' : 'none',
                                  color: isProvided ? 'text.disabled' : 'text.primary',
                                }}
                              >
                                {ingName} — {vi.quantity} {vi.unit}
                                {isProvided
                                  ? isOfferedByClient
                                    ? ' (client fournit)'
                                    : ' (ajouté)'
                                  : isOfferedByClient
                                    ? ' (proposé par le client — non confirmé)'
                                    : cost !== null && cost > 0
                                      ? ` → ${cost.toFixed(3)} DT`
                                      : ''}
                              </Typography>
                            }
                          />
                          {isOfferedByClient && (
                            <Chip
                              size="small"
                              label="Proposé"
                              color={isProvided ? 'info' : 'warning'}
                              variant={isProvided ? 'filled' : 'outlined'}
                              sx={{ fontSize: '0.7rem', height: 22 }}
                            />
                          )}
                          {isProvided && !isOfferedByClient && (
                            <Chip
                              size="small"
                              label="Ajouté"
                              color="secondary"
                              variant="outlined"
                              sx={{ fontSize: '0.7rem', height: 22 }}
                            />
                          )}
                          {!isProvided && !isOfferedByClient && need && !stockNeeds?.deducted && (
                            <Chip
                              size="small"
                              label={
                                need.unitMismatch
                                  ? 'Unité incompatible'
                                  : need.status === 'missing'
                                    ? `Manque ${formatQty(need.missing)} ${need.unit}`
                                    : `Stock: ${formatQty(need.stock)} ${need.unit}`
                              }
                              color={
                                need.unitMismatch || need.status === 'missing'
                                  ? 'error'
                                  : need.status === 'low'
                                    ? 'warning'
                                    : 'success'
                              }
                              variant="outlined"
                              sx={{ fontSize: '0.7rem', height: 22 }}
                            />
                          )}
                        </Box>
                      );
                    })}
                  </Box>

                  {/* Detail prix */}
                  {item.calculatedPrice && (
                    <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell>Ingrédients</TableCell>
                            <TableCell align="right">
                              {item.calculatedPrice.ingredientsCost?.toFixed(2)} DT
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Électricité</TableCell>
                            <TableCell align="right">
                              {item.calculatedPrice.electricityCost?.toFixed(2)} DT
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Eau</TableCell>
                            <TableCell align="right">
                              {item.calculatedPrice.waterCost?.toFixed(2)} DT
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Marge</TableCell>
                            <TableCell align="right">
                              {item.calculatedPrice.margin?.toFixed(2)} DT
                            </TableCell>
                          </TableRow>
                          <TableRow sx={{ bgcolor: color.primarySoft }}>
                            <TableCell sx={{ fontWeight: 700 }}>Total unitaire</TableCell>
                            <TableCell
                              align="right"
                              sx={{ fontWeight: 700, color: 'primary.main' }}
                            >
                              {item.calculatedPrice.total?.toFixed(2)} DT
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}

                  {/* Emballage de cet article (hors prix de la recette) */}
                  <Box
                    data-testid={`item-packaging-${itemIndex}`}
                    sx={{
                      mt: 2,
                      p: 1.5,
                      borderRadius: `${radius.md}px`,
                      border: `1px solid ${color.border}`,
                      bgcolor: color.surfaceMuted,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle2" sx={{ flex: 1 }}>
                        🎁 Emballage
                      </Typography>
                      {packCost(item) > 0 && (
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {formatDT(packCost(item), 3)} / article
                        </Typography>
                      )}
                    </Box>
                    {(item.packaging || []).length === 0 ? (
                      <Typography variant="body2" sx={{ color: color.inkSoft, mt: 0.5 }}>
                        Aucun emballage choisi.
                      </Typography>
                    ) : (
                      (item.packaging || []).map((p: any) => (
                        <Line
                          key={String(p.packagingId)}
                          label={`${p.name} × ${parseFloat(p.quantity.toFixed(3))}`}
                          value={formatDT(p.quantity * p.unitPrice, 3)}
                        />
                      ))
                    )}
                    {canEditPackaging && (
                      <Button
                        size="small"
                        startIcon={(item.packaging || []).length ? <Edit /> : <Add />}
                        sx={{ mt: 0.5, px: 1 }}
                        onClick={() => {
                          setPackDraft(
                            (item.packaging || []).map((p: any) => ({
                              packagingId: String(p.packagingId),
                              quantity: p.quantity,
                            }))
                          );
                          setPackTarget(itemIndex);
                        }}
                      >
                        {(item.packaging || []).length
                          ? 'Modifier l’emballage'
                          : 'Choisir l’emballage'}
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
            );
          })}

          {stockNeeds &&
            stockNeeds.needs.length > 0 &&
            (status !== 'cancelled' || stockNeeds.deducted) && (
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
                    <SoftIcon tone="success" size={34}>
                      <Inventory2 />
                    </SoftIcon>
                    <Typography variant="h6" sx={{ fontSize: '1rem' }}>
                      Stock pour cette commande
                    </Typography>
                  </Box>
                  <StockNeedsPanel
                    needs={stockNeeds.needs}
                    stockDeducted={stockNeeds.deducted}
                    note={
                      stockNeeds.active
                        ? 'Stock = quantité disponible pour cette commande après les commandes prévues avant.'
                        : undefined
                    }
                  />
                  {/* Remise en stock exceptionnelle : seulement une commande annulée qui a consommé du stock */}
                  {stockNeeds.deducted && status === 'cancelled' && (
                    <Button
                      variant="outlined"
                      color="warning"
                      fullWidth
                      sx={{ mt: 1.5 }}
                      onClick={() => {
                        restoreOp.reset();
                        setRestoreReason('');
                        setRestoreOpen(true);
                      }}
                    >
                      Remise en stock exceptionnelle…
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

          {/* Total = produits + frais (transport, emballage… modifiables après création) */}
          <Card sx={{ p: 2.25 }} data-testid="order-total-card">
            <Line label="Produits" value={formatDT(itemsTotal - packagingTotal)} />
            {packagingTotal > 0 && <Line label="Emballage" value={formatDT(packagingTotal)} />}
            {fees.map((f: { label: string; amount: number }, i: number) => (
              <Line key={i} label={f.label} value={formatDT(f.amount)} />
            ))}
            {status !== 'cancelled' && (
              <Button
                size="small"
                startIcon={fees.length ? <Edit fontSize="small" /> : <Add fontSize="small" />}
                onClick={() => {
                  setFeesDraft(toDrafts(fees));
                  setFeesOpen(true);
                }}
                sx={{ my: 0.5, px: 1 }}
              >
                {fees.length ? 'Modifier les frais' : 'Ajouter transport / emballage'}
              </Button>
            )}
            <Box
              sx={{
                mt: 1,
                pt: 1.25,
                borderTop: `1px solid ${color.border}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Typography variant="h6">Total</Typography>
              <Typography variant="h5" sx={{ color: color.primaryDark }}>
                {formatDT(order.totalPrice)}
              </Typography>
            </Box>
          </Card>
        </Box>
      </Box>

      {/* Emballage d'un article (avant la préparation) */}
      <ResponsiveDialog
        open={packTarget !== null}
        onClose={() => setPackTarget(null)}
        maxWidth="sm"
        title="Emballage de l’article"
        subtitle="Les emballages déjà choisis gardent leur prix. Le total et le reste à encaisser se mettent à jour."
        actions={
          <>
            <Button onClick={() => setPackTarget(null)}>Annuler</Button>
            <Button variant="contained" disabled={packSaving} onClick={savePackaging}>
              {packSaving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </>
        }
      >
        {packTarget !== null && order.items[packTarget] && (
          <PackagingPicker
            value={packDraft}
            onChange={setPackDraft}
            options={packagingOptions}
            portions={
              (order.items[packTarget].recipeId?.variants || [])[
                order.items[packTarget].variantIndex
              ]?.portions || 1
            }
            itemQuantity={order.items[packTarget].quantity}
          />
        )}
      </ResponsiveDialog>

      {/* Frais supplémentaires après création : total et reste à encaisser recalculés */}
      <ResponsiveDialog
        open={feesOpen}
        onClose={() => setFeesOpen(false)}
        maxWidth="xs"
        title="Frais de la commande"
        subtitle="Transport, emballage… selon votre estimation. Ils s’ajoutent au total, pas au prix des recettes."
        actions={
          <>
            <Button onClick={() => setFeesOpen(false)}>Annuler</Button>
            <Button variant="contained" disabled={feesSaving} onClick={saveFees}>
              {feesSaving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </>
        }
      >
        <FeesEditor value={feesDraft} onChange={setFeesDraft} />
        <Typography variant="body2" sx={{ mt: 1.5, color: color.inkSoft }}>
          Nouveau total :{' '}
          <strong>
            {formatDT(itemsTotal + toFees(feesDraft).reduce((t, f) => t + f.amount, 0))}
          </strong>
          {order.amountPaid > 0 && <> · déjà encaissé {formatDT(order.amountPaid)}</>}
        </Typography>
      </ResponsiveDialog>

      {/* Remise en stock exceptionnelle (tracée, raison obligatoire) */}
      <ResponsiveDialog
        open={restoreOpen}
        onClose={() => setRestoreOpen(false)}
        maxWidth="xs"
        title="Remise en stock exceptionnelle"
        subtitle="À utiliser seulement si les ingrédients n’ont pas vraiment été utilisés."
        actions={
          <>
            <Button onClick={() => setRestoreOpen(false)}>Annuler</Button>
            <Button
              variant="contained"
              color="warning"
              disabled={restoreOp.busy || restoreReason.trim().length < 3}
              onClick={() =>
                restoreOp
                  .run(async (key) => {
                    const res = await api.post(
                      `/orders/${id}/restore-stock`,
                      { reason: restoreReason.trim() },
                      withIdempotency(key)
                    );
                    toast.success(res.data.message);
                    setRestoreOpen(false);
                    await load();
                    refresh();
                  })
                  .catch(() => undefined)
              }
            >
              Remettre en stock
            </Button>
          </>
        }
      >
        <Typography variant="body2" sx={{ mb: 2 }}>
          Les quantités retirées pour cette commande seront rajoutées au stock. L’opération est
          notée dans l’historique du stock avec votre raison.
        </Typography>
        <TextField
          fullWidth
          required
          autoFocus
          label="Raison"
          placeholder="ex : la pâte n’avait pas été commencée"
          value={restoreReason}
          onChange={(e) => setRestoreReason(e.target.value)}
        />
      </ResponsiveDialog>

      {/* Confirmation d'un changement d'avancement */}
      <ResponsiveDialog
        open={!!transition}
        onClose={() => setTransition(null)}
        maxWidth="xs"
        title={transition?.title}
        actions={
          <>
            <Button onClick={() => setTransition(null)}>Retour</Button>
            <Button
              variant="contained"
              color={
                transition?.tone === 'error'
                  ? 'error'
                  : transition?.tone === 'success'
                    ? 'success'
                    : 'primary'
              }
              disabled={busy || (reasonRequired && reason.trim().length < 3)}
              onClick={() => transition && changeStatus(transition.status, reason.trim())}
            >
              {busy ? 'Enregistrement…' : transition?.confirm}
            </Button>
          </>
        }
      >
        <Typography variant="body2" sx={{ color: color.inkSoft }}>
          {transition?.text}
        </Typography>
        {transition?.status === 'cancelled' && (
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
              {CANCEL_REASONS.map((r) => (
                <ButtonBase
                  key={r}
                  onClick={() => setReason(r)}
                  sx={{
                    px: 1.25,
                    py: 0.5,
                    borderRadius: `${radius.pill}px`,
                    border: `1px solid ${reason === r ? color.danger : color.borderStrong}`,
                    bgcolor: reason === r ? color.dangerSoft : color.surface,
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                >
                  {r}
                </ButtonBase>
              ))}
            </Box>
            <TextField
              fullWidth
              label={reasonRequired ? 'Raison (obligatoire)' : 'Raison (facultative)'}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required={reasonRequired}
              error={reasonRequired && reason.length > 0 && reason.trim().length < 3}
            />
          </Box>
        )}
      </ResponsiveDialog>
    </Box>
  );
};

export default OrderDetailPage;
