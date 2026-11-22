import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Add,
  Delete,
  History,
  Inventory2,
  LocalOffer,
  Place,
  ShoppingBasket,
  Star,
  TrendingFlat,
} from '@mui/icons-material';
import api, { withIdempotency } from '../../services/api';
import { PageHeader } from '../../components/ui';
import { color } from '../../theme/tokens';
import {
  averageComposition,
  isStale,
  PriceBasisCaption,
} from '../../components/admin/IngredientPricing';
import { useIdempotentAction } from '../../hooks/useIdempotencyKey';
import SourceFormDialog from '../../components/admin/SourceFormDialog';
import PromoPriceCheckbox from '../../components/admin/PromoPriceCheckbox';
import StockAdjustDialog from '../../components/admin/StockAdjustDialog';
import { tripTo, useTravel } from '../../components/map/useTravel';
import { formatKm } from '../../utils/geo';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import PurchasePaymentSelect, {
  PurchasePaymentMethod,
} from '../../components/admin/PurchasePaymentSelect';
import type { IngredientOffer, PriceSummary, PurchaseSource } from '../../types/admin';
import {
  SOURCE_TYPE_LABELS,
  compatibleUnits,
  formatDT,
  formatDate,
  formatQty,
  PURCHASE_PAYMENT_LABELS,
} from '../../utils/format';

const today = () => new Date().toISOString().slice(0, 10);

const IngredientDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const [ingredient, setIngredient] = useState<any>(null);
  const [offers, setOffers] = useState<IngredientOffer[]>([]);
  const [summary, setSummary] = useState<PriceSummary | null>(null);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [sources, setSources] = useState<PurchaseSource[]>([]);
  const [openHistory, setOpenHistory] = useState<string | null>(null);

  // Dialogs
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    source: null as PurchaseSource | null,
    price: '',
    unit: '',
    checkedAt: today(),
    notes: '',
  });
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [priceTarget, setPriceTarget] = useState<IngredientOffer | null>(null);
  const [priceForm, setPriceForm] = useState({ price: '', checkedAt: today(), note: '' });
  const [removeTarget, setRemoveTarget] = useState<IngredientOffer | null>(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  // ?action=achat|stock : ouvre directement l'achat ou la correction (depuis une liste)
  const [searchParams, setSearchParams] = useSearchParams();
  const purchaseOp = useIdempotentAction(); // un achat = une clé : jamais enregistré deux fois
  const { info: travel } = useTravel(); // distance et coût du trajet vers chaque source
  const [purchaseForm, setPurchaseForm] = useState({
    quantity: '',
    unitPrice: '',
    source: null as PurchaseSource | null,
    purchasedAt: today(),
    promotion: false,
    paymentMethod: 'cash_register' as PurchasePaymentMethod,
  });

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/ingredients/${id}/prices`);
      setIngredient(res.data.data.ingredient);
      setOffers(res.data.data.offers);
      setSummary(res.data.data.summary);
      setPurchases(res.data.data.purchases);
    } catch {
      navigate('/admin/ingredients');
    }
  }, [id, navigate]);

  const loadSources = async () => {
    try {
      const res = await api.get('/purchase-sources');
      setSources(res.data.data?.sources || []);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    load();
    loadSources();
  }, [load]);

  useEffect(() => {
    const action = searchParams.get('action');
    if (!ingredient || !action) return;
    if (action === 'stock') setAdjustOpen(true);
    if (action === 'achat') openPurchase();
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingredient, searchParams]);

  const openPurchase = () => {
    setPurchaseForm({
      quantity: '',
      unitPrice: '',
      source: null,
      purchasedAt: today(),
      promotion: false,
      paymentMethod: 'cash_register',
    });
    purchaseOp.reset();
    setPurchaseOpen(true);
  };

  if (!ingredient || !summary) return null;

  const unit: string = ingredient.unit;
  const isPack = ingredient.kind === 'packaging'; // emballage : même fiche, autre vocabulaire
  const unitText = unit === 'piece' ? 'pièce(s)' : unit;
  const activeOffers = offers.filter((o) => o.isActive && o.sourceId?.isActive !== false);
  const inactiveOffers = offers.filter((o) => !activeOffers.includes(o));
  const usedSourceIds = new Set(activeOffers.map((o) => o.sourceId?._id));
  const composition = averageComposition(offers, unit);
  // Source active la plus proche du domicile (si les positions sont connues)
  const nearestOfferId = activeOffers
    .map((o) => ({ id: o._id, trip: tripTo(travel, o.sourceId?.location) }))
    .filter((x) => x.trip)
    .sort((a, b) => a.trip!.km - b.trip!.km)[0]?.id;
  const staleCount = activeOffers.filter((o) => isStale(o.lastCheckedAt)).length;

  const addOffer = async () => {
    if (!addForm.source || addForm.price === '') {
      toast.error('Choisissez une source et un prix');
      return;
    }
    try {
      await api.post(`/ingredients/${id}/prices`, {
        sourceId: addForm.source._id,
        price: parseFloat(addForm.price),
        unit: addForm.unit || unit,
        checkedAt: addForm.checkedAt,
        notes: addForm.notes,
      });
      toast.success('Prix ajouté');
      setAddOpen(false);
      load();
    } catch {
      /* toast intercepteur */
    }
  };

  const saveNewPrice = async () => {
    if (!priceTarget || priceForm.price === '') return;
    try {
      await api.put(`/ingredients/${id}/prices/${priceTarget._id}`, {
        price: parseFloat(priceForm.price),
        checkedAt: priceForm.checkedAt,
        note: priceForm.note,
      });
      toast.success('Nouveau prix enregistré (ancien prix conservé)');
      setPriceTarget(null);
      load();
    } catch {
      /* ignore */
    }
  };

  const removeOffer = async () => {
    if (!removeTarget) return;
    try {
      await api.delete(`/ingredients/${id}/prices/${removeTarget._id}`);
      toast.success('Source retiree (historique conserve)');
      setRemoveTarget(null);
      load();
    } catch {
      /* ignore */
    }
  };

  const savePurchase = async () => {
    const quantity = parseFloat(purchaseForm.quantity);
    if (!quantity || quantity <= 0) {
      toast.error('Indiquez la quantité achetée');
      return;
    }
    const unitPrice = parseFloat(purchaseForm.unitPrice);
    if (!(unitPrice > 0)) {
      toast.error('Indiquez le prix réellement payé');
      return;
    }
    await purchaseOp
      .run(async (key) => {
        const res = await api.post(
          `/ingredients/${id}/purchases`,
          {
            quantity,
            unitPrice,
            sourceId: purchaseForm.source?._id,
            purchasedAt: purchaseForm.purchasedAt,
            // par défaut le prix payé devient le prix de la source (sauf promotion)
            promotion: purchaseForm.promotion,
            paymentMethod: purchaseForm.paymentMethod,
          },
          withIdempotency(key)
        );
        const unblocked = res.data.data.unblockedOrders || [];
        toast.success(
          `+${quantity} ${unit} en stock · ` +
            (res.data.data.cashMovement
              ? `caisse −${formatDT(res.data.data.cashMovement.amount)}`
              : `${PURCHASE_PAYMENT_LABELS[purchaseForm.paymentMethod]} : caisse inchangée`) +
            (unblocked.length
              ? ` · ${unblocked.map((u: any) => `CMD-${u.orderNumber}`).join(', ')} mise(s) à jour`
              : '')
        );
        setPurchaseOpen(false);
        load();
      })
      .catch(() => undefined /* toast intercepteur */);
  };

  return (
    <Box>
      <PageHeader
        title={ingredient.name}
        subtitle={`Stock actuel : ${ingredient.stockQuantity ?? 0} ${unit}${ingredient.minStock ? ` · seuil ${ingredient.minStock} ${unit}` : ''}`}
        backTo={isPack ? '/admin/packaging' : '/admin/ingredients'}
        helpFlow="purchase"
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={<Inventory2 />}
              onClick={() => setAdjustOpen(true)}
            >
              Corriger le stock
            </Button>
            <Button
              variant="contained"
              color="success"
              startIcon={<ShoppingBasket />}
              onClick={openPurchase}
            >
              Enregistrer un achat
            </Button>
          </>
        }
      />

      <Box>
        {/* Resume des prix */}
        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          <Grid item xs={6} md={3}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ py: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {isPack ? 'Prix utilisé (commandes)' : 'Prix utilisé (recettes)'}
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {formatDT(ingredient.pricePerUnit, 3)}/{unit}
                </Typography>
                <PriceBasisCaption ingredient={ingredient} summary={summary} />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ py: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Sources d’achat
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {summary.comparableCount}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: staleCount ? color.warningDark : color.inkSoft }}
                >
                  {staleCount
                    ? `${staleCount} prix à vérifier (+ de 3 mois)`
                    : summary.comparableCount
                      ? 'Prix à jour'
                      : 'Aucune source'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ py: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Meilleur prix
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.main' }}>
                  {summary.best ? `${formatDT(summary.best.price, 3)}/${unit}` : '—'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {summary.best?.sourceName || ''}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ py: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {isPack ? 'Stock' : 'Stock maison'}
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    color: (ingredient.stockQuantity || 0) <= 0 ? color.dangerDark : undefined,
                  }}
                >
                  {formatQty(ingredient.stockQuantity || 0)} {unitText}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {ingredient.minStock
                    ? `Seuil : ${ingredient.minStock} ${unitText}`
                    : 'Pas de seuil'}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.75, flexWrap: 'wrap' }}>
                  <Button size="small" sx={{ px: 1 }} onClick={() => setAdjustOpen(true)}>
                    Corriger
                  </Button>
                  <Button size="small" color="success" sx={{ px: 1 }} onClick={openPurchase}>
                    + Achat
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Comment le prix utilisé est calculé */}
        {composition.parts.length > 0 ? (
          <Card
            sx={{ mb: 2, p: 2, bgcolor: color.primarySoft, borderColor: color.primaryBorder }}
            data-testid="price-composition"
          >
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Comment ce prix est calculé
            </Typography>
            <Typography variant="body2" sx={{ color: color.inkSoft, mb: 1 }}>
              Prix utilisé dans {isPack ? 'les commandes' : 'les recettes et les factures'} =
              moyenne des prix de vos sources (prix normaux, hors promotions). Il se met à jour tout
              seul quand un prix de source change.
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
              {composition.parts.map((p, i) => (
                <Chip
                  key={i}
                  size="small"
                  variant="outlined"
                  label={`${p.source} : ${formatDT(p.price, 3)}/${unit}`}
                />
              ))}
            </Box>
            <Typography sx={{ fontWeight: 700, color: color.primaryDark }}>
              {composition.formula}
            </Typography>
          </Card>
        ) : (
          <Alert
            severity="warning"
            sx={{ mb: 2 }}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  setAddForm({ source: null, price: '', unit, checkedAt: today(), notes: '' });
                  setAddOpen(true);
                }}
              >
                Ajouter une source
              </Button>
            }
          >
            Ajoutez une source : sans source, le prix ({formatDT(ingredient.pricePerUnit, 3)}/{unit}
            ) reste fixe.
          </Alert>
        )}
        {summary.incomparableCount > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {summary.incomparableCount} prix dans une unite non comparable a "{unit}" ne sont pas
            pris en compte dans la moyenne.
          </Alert>
        )}

        {/* Sources */}
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 1,
                gap: 1,
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Prix par source
              </Typography>
              <Button
                startIcon={<Add />}
                variant="outlined"
                onClick={() => {
                  setAddForm({ source: null, price: '', unit, checkedAt: today(), notes: '' });
                  setAddOpen(true);
                }}
              >
                Ajouter
              </Button>
            </Box>

            {activeOffers.length === 0 && (
              <Typography color="text.secondary" sx={{ py: 2 }}>
                Aucune source enregistrée. Ajoutez où vous achetez cet ingrédient et à quel prix.
              </Typography>
            )}

            {activeOffers.map((o, idx) => {
              const isBest = summary.best?.offerId === o._id;
              return (
                <Box key={o._id}>
                  {idx > 0 && <Divider />}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      py: 1.5,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 160 }}>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Typography sx={{ fontWeight: 600 }}>{o.sourceId?.name}</Typography>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={SOURCE_TYPE_LABELS[o.sourceId?.type] || ''}
                        />
                        {isStale(o.lastCheckedAt) && (
                          <Chip
                            size="small"
                            color="warning"
                            variant="outlined"
                            label="À vérifier"
                          />
                        )}
                        {isBest && (
                          <Chip
                            size="small"
                            color="success"
                            icon={<Star />}
                            label="Meilleur prix"
                          />
                        )}
                        {nearestOfferId === o._id && activeOffers.length > 1 && (
                          <Chip size="small" color="info" icon={<Place />} label="La plus proche" />
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        Vérifié le {formatDate(o.lastCheckedAt)}
                        {o.notes ? ` · ${o.notes}` : ''}
                      </Typography>
                      {(() => {
                        const trip = tripTo(travel, o.sourceId?.location);
                        return trip ? (
                          <Typography
                            variant="caption"
                            sx={{ display: 'block', color: color.infoDark, fontWeight: 600 }}
                          >
                            📍 aller-retour ≈ {formatKm(trip.km)}
                            {trip.cost > 0 ? ` · trajet ≈ ${trip.cost.toFixed(2)} DT` : ''}
                          </Typography>
                        ) : null;
                      })()}
                    </Box>
                    <Typography
                      sx={{
                        fontWeight: 700,
                        fontSize: '1.1rem',
                        minWidth: 110,
                        textAlign: 'right',
                      }}
                    >
                      {formatDT(o.price, 3)}/{o.unit}
                    </Typography>
                    <Box sx={{ display: 'flex' }}>
                      <IconButton
                        title="Nouveau prix"
                        color="primary"
                        onClick={() => {
                          setPriceForm({ price: String(o.price), checkedAt: today(), note: '' });
                          setPriceTarget(o);
                        }}
                      >
                        <LocalOffer />
                      </IconButton>
                      <IconButton
                        title="Historique"
                        onClick={() => setOpenHistory(openHistory === o._id ? null : o._id)}
                      >
                        <History />
                      </IconButton>
                      <IconButton title="Retirer" onClick={() => setRemoveTarget(o)}>
                        <Delete />
                      </IconButton>
                    </Box>
                  </Box>
                  <Collapse in={openHistory === o._id}>
                    <Box sx={{ pl: 2, pb: 1.5 }}>
                      {[...o.history].reverse().map((h, i) => (
                        <Typography variant="body2" key={i} color="text.secondary">
                          {formatDate(h.checkedAt)}{' '}
                          <TrendingFlat sx={{ fontSize: 14, verticalAlign: 'middle' }} />{' '}
                          <strong>
                            {formatDT(h.price, 3)}/{h.unit}
                          </strong>
                          {h.note ? ` (${h.note})` : ''}
                        </Typography>
                      ))}
                    </Box>
                  </Collapse>
                </Box>
              );
            })}

            {inactiveOffers.length > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Sources retirees (historique conserve) :{' '}
                {inactiveOffers
                  .map((o) => `${o.sourceId?.name} (${formatDT(o.price, 3)})`)
                  .join(', ')}
              </Typography>
            )}
          </CardContent>
        </Card>

        <Grid container spacing={2}>
          {/* Achats reels */}
          <Grid item xs={12} md={7}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Achats réels
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mb: 1 }}
                >
                  Prix réellement payé. Un prix promotionnel n’entre pas dans la moyenne.
                </Typography>
                {purchases.length === 0 && (
                  <Typography color="text.secondary">Aucun achat enregistré.</Typography>
                )}
                {purchases.map((p) => (
                  <Box
                    key={p._id}
                    sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 0.75 }}
                  >
                    <Typography variant="body2">
                      {formatDate(p.purchasedAt || p.createdAt)} · +{formatQty(p.quantity)} {p.unit}
                      {p.sourceName ? ` · ${p.sourceName}` : ''}
                      {p.paymentMethod ? ` · ${PURCHASE_PAYMENT_LABELS[p.paymentMethod]}` : ''}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {typeof p.unitPrice === 'number'
                        ? `${formatDT(p.unitPrice, 3)}/${p.unit} = ${formatDT(p.totalPrice)}`
                        : 'prix non saisi'}
                    </Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>

          {/* Historique du prix utilisé */}
          <Grid item xs={12} md={5}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  Historique du prix utilisé
                </Typography>
                {(ingredient.referencePriceHistory || []).length === 0 && (
                  <Typography color="text.secondary">
                    Pas encore de changement enregistré.
                  </Typography>
                )}
                {[...(ingredient.referencePriceHistory || [])]
                  .reverse()
                  .map((h: any, i: number) => (
                    <Typography variant="body2" key={i} sx={{ py: 0.5 }}>
                      {formatDate(h.changedAt, true)} → <strong>{formatDT(h.price, 4)}</strong>
                      {h.reason ? ` (${h.reason})` : ''}
                    </Typography>
                  ))}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Ajouter une source */}
      <Dialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        fullWidth
        maxWidth="sm"
        fullScreen={fullScreen}
      >
        <DialogTitle>Ajouter un prix pour {ingredient.name}</DialogTitle>
        <DialogContent>
          <Autocomplete
            options={sources.filter((s) => !usedSourceIds.has(s._id))}
            value={addForm.source}
            onChange={(_, v) => setAddForm({ ...addForm, source: v })}
            getOptionLabel={(s) => `${s.name} (${SOURCE_TYPE_LABELS[s.type]})`}
            isOptionEqualToValue={(a, b) => a._id === b._id}
            noOptionsText="Aucune source — créez-en une"
            renderInput={(params) => <TextField {...params} label="Source d'achat *" />}
            sx={{ mt: 1, mb: 1 }}
          />
          <Button
            size="small"
            startIcon={<Add />}
            onClick={() => setSourceDialogOpen(true)}
            sx={{ mb: 2 }}
          >
            Nouvelle source
          </Button>
          <Grid container spacing={2}>
            <Grid item xs={7}>
              <TextField
                fullWidth
                type="number"
                label="Prix (DT) *"
                value={addForm.price}
                onChange={(e) => setAddForm({ ...addForm, price: e.target.value })}
                inputProps={{ min: 0, step: 0.001, inputMode: 'decimal' }}
              />
            </Grid>
            <Grid item xs={5}>
              <FormControl fullWidth>
                <InputLabel>Par</InputLabel>
                <Select
                  label="Par"
                  value={addForm.unit || unit}
                  onChange={(e) => setAddForm({ ...addForm, unit: e.target.value })}
                >
                  {compatibleUnits(unit).map((u) => (
                    <MenuItem key={u} value={u}>
                      {u}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="date"
                label="Date du prix"
                value={addForm.checkedAt}
                onChange={(e) => setAddForm({ ...addForm, checkedAt: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                placeholder="Paquet de 1 kg, promo..."
                value={addForm.notes}
                onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddOpen(false)} size="large">
            Annuler
          </Button>
          <Button variant="contained" onClick={addOffer} size="large">
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>

      <SourceFormDialog
        open={sourceDialogOpen}
        onClose={() => setSourceDialogOpen(false)}
        onSaved={(s) => {
          setSourceDialogOpen(false);
          setSources((prev) => [...prev, s]);
          setAddForm((f) => ({ ...f, source: s }));
        }}
      />

      {/* Nouveau prix */}
      <Dialog open={!!priceTarget} onClose={() => setPriceTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Nouveau prix — {priceTarget?.sourceId?.name}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Prix actuel : {formatDT(priceTarget?.price, 3)}/{priceTarget?.unit}. L'ancien prix reste
            dans l'historique.
          </Typography>
          <TextField
            fullWidth
            autoFocus
            type="number"
            label={`Prix (DT/${priceTarget?.unit})`}
            value={priceForm.price}
            onChange={(e) => setPriceForm({ ...priceForm, price: e.target.value })}
            inputProps={{ min: 0, step: 0.001, inputMode: 'decimal' }}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            type="date"
            label="Date du prix"
            value={priceForm.checkedAt}
            onChange={(e) => setPriceForm({ ...priceForm, checkedAt: e.target.value })}
            InputLabelProps={{ shrink: true }}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Note (optionnel)"
            value={priceForm.note}
            onChange={(e) => setPriceForm({ ...priceForm, note: e.target.value })}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPriceTarget(null)}>Annuler</Button>
          <Button variant="contained" onClick={saveNewPrice}>
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Achat reel */}
      <Dialog
        open={purchaseOpen}
        onClose={() => setPurchaseOpen(false)}
        fullWidth
        maxWidth="sm"
        fullScreen={fullScreen}
      >
        <DialogTitle>Achat de {ingredient.name}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                autoFocus
                type="number"
                label={`Quantité (${unit}) *`}
                value={purchaseForm.quantity}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, quantity: e.target.value })}
                inputProps={{ min: 0, step: 0.01, inputMode: 'decimal' }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label={`Prix payé (DT/${unit}) *`}
                value={purchaseForm.unitPrice}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, unitPrice: e.target.value })}
                inputProps={{ min: 0, step: 0.001, inputMode: 'decimal' }}
              />
            </Grid>
            <Grid item xs={12}>
              <Autocomplete
                options={sources}
                value={purchaseForm.source}
                onChange={(_, v) =>
                  setPurchaseForm({
                    ...purchaseForm,
                    source: v,
                  })
                }
                getOptionLabel={(s) => s.name}
                isOptionEqualToValue={(a, b) => a._id === b._id}
                renderInput={(params) => <TextField {...params} label="Achete chez (optionnel)" />}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="date"
                label="Date d'achat"
                value={purchaseForm.purchasedAt}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, purchasedAt: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            {purchaseForm.source && (
              <Grid item xs={12}>
                <PromoPriceCheckbox
                  checked={purchaseForm.promotion}
                  onChange={(promotion) => setPurchaseForm({ ...purchaseForm, promotion })}
                  sourceName={purchaseForm.source.name}
                />
              </Grid>
            )}
          </Grid>
          <Box sx={{ mt: 2 }}>
            <PurchasePaymentSelect
              value={purchaseForm.paymentMethod}
              onChange={(v) => setPurchaseForm({ ...purchaseForm, paymentMethod: v })}
              amount={
                (parseFloat(purchaseForm.quantity) || 0) * (parseFloat(purchaseForm.unitPrice) || 0)
              }
            />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            La quantité est ajoutée au stock et les commandes en attente de cet ingrédient sont
            recalculées. Les commandes déjà enregistrées gardent leur prix.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPurchaseOpen(false)} size="large">
            Annuler
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={savePurchase}
            size="large"
            disabled={purchaseOp.busy}
          >
            Enregistrer l'achat
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!removeTarget}
        title="Retirer cette source ?"
        message="Son prix ne comptera plus dans la moyenne. L'historique des prix est conserve."
        confirmLabel="Retirer"
        onConfirm={removeOffer}
        onCancel={() => setRemoveTarget(null)}
      />
      <StockAdjustDialog
        target={adjustOpen ? ingredient : null}
        onClose={() => setAdjustOpen(false)}
        onSaved={() => load()}
      />
    </Box>
  );
};

export default IngredientDetailPage;
