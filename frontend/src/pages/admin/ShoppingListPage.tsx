import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api, { withIdempotency } from '../../services/api';
import {
  Typography,
  Box,
  Card,
  Button,
  ButtonBase,
  Checkbox,
  TextField,
  MenuItem,
  InputAdornment,
} from '@mui/material';
import { ShoppingCart, Storefront, ReceiptLong, LocalOffer, CheckCircle, Bolt } from '@mui/icons-material';
import type { OrderNeedDetail } from '../../types/admin';
import { PURCHASE_PAYMENT_LABELS, formatDate, formatDT, formatQty } from '../../utils/format';
import PurchasePaymentSelect, { PurchasePaymentMethod } from '../../components/admin/PurchasePaymentSelect';
import { useIdempotentAction } from '../../hooks/useIdempotencyKey';
import { useAdminData } from '../../context/AdminDataContext';
import { EmptyState, KpiCard, PageHeader, ResponsiveDialog, SkeletonCards, StatusBadge } from '../../components/ui';
import { color, radius, Tone } from '../../theme/tokens';

interface ShoppingItem {
  ingredientId: string;
  name: string;
  unit: string;
  needed: number;
  inStock: number;
  toBuy: number;
  missing: number;
  estimatedCost: number;
  pricePerUnit: number;
  priceBasis: 'last_purchase' | 'source' | 'reference' | 'none';
  priority: 'urgent' | 'soon' | 'later';
  hoursLeft: number | null;
  neededBy: string | null;
  sources: { sourceId: string; name: string; price: number | null; checkedAt: string }[];
  lastPurchase: { unitPrice: number; date: string; sourceName: string } | null;
  orders: OrderNeedDetail[];
}

interface Line {
  ingredientId: string;
  name: string;
  unit: string;
  qty: string;
  price: string;
  hint: number | null;
}

const PRIORITY: Record<ShoppingItem['priority'], { label: string; tone: Tone }> = {
  urgent: { label: 'Urgent', tone: 'danger' },
  soon: { label: 'Bientôt', tone: 'warning' },
  later: { label: 'Plus tard', tone: 'neutral' },
};
const BASIS: Record<ShoppingItem['priceBasis'], string> = {
  last_purchase: 'd’après le dernier prix payé',
  source: 'd’après le prix constaté chez la source',
  reference: 'd’après le prix de référence',
  none: 'pas de prix connu',
};
const statusLabel = (s: string) => s.replace('a acheter', 'à acheter').replace('partiellement achete', 'partiellement acheté');

const Stat = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
  <Box sx={{ flex: 1, minWidth: 0, p: 1, borderRadius: `${radius.sm}px`, bgcolor: color.surfaceMuted, border: `1px solid ${color.border}` }}>
    <Typography sx={{ fontSize: '0.7rem', color: color.inkSoft, fontWeight: 600 }} noWrap>
      {label}
    </Typography>
    <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: tone, fontVariantNumeric: 'tabular-nums' }} noWrap>
      {value}
    </Typography>
  </Box>
);

const ShoppingListPage = () => {
  const navigate = useNavigate();
  const { refresh } = useAdminData();
  const [items, setItems] = useState<ShoppingItem[] | null>(null);
  const [totalCost, setTotalCost] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sources, setSources] = useState<{ _id: string; name: string }[]>([]);
  // achat (un ingrédient ou une sélection)
  const [lines, setLines] = useState<Line[] | null>(null);
  const [sourceId, setSourceId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PurchasePaymentMethod>('cash_register');
  const op = useIdempotentAction();

  useEffect(() => {
    api
      .get('/purchase-sources')
      .then((res) => setSources(res.data.data?.sources || []))
      .catch(() => undefined);
  }, []);

  const load = async () => {
    try {
      const res = await api.get('/orders/shopping-list');
      const data = res.data.data;
      setItems(data.shoppingList || []);
      setTotalCost(data.totalCost || 0);
      setOrderCount(data.orderCount || 0);
      setSelected(new Set());
    } catch {
      setItems((prev) => prev || []);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const urgent = (items || []).filter((i) => i.priority === 'urgent').length;

  const startPurchase = (list: ShoppingItem[]) => {
    op.reset(); // nouvelle opération d'achat
    setLines(
      list.map((i) => ({
        ingredientId: i.ingredientId,
        name: i.name,
        unit: i.unit,
        qty: String(i.toBuy),
        price: '',
        hint: i.lastPurchase?.unitPrice ?? i.sources.find((s) => s.price !== null)?.price ?? null,
      }))
    );
    const knownSource = list.length === 1 ? sources.find((s) => s.name === (list[0].lastPurchase?.sourceName || list[0].sources[0]?.name)) : undefined;
    setSourceId(knownSource?._id || '');
    setPaymentMethod('cash_register');
  };

  const valid = (lines || []).every((l) => parseFloat(l.qty) > 0 && parseFloat(l.price) > 0);
  const total = (lines || []).reduce((s, l) => s + (parseFloat(l.qty) || 0) * (parseFloat(l.price) || 0), 0);

  const purchase = () =>
    op
      .run(async (key) => {
        const res = await api.post(
          '/orders/shopping-list/purchase',
          {
            purchases: lines!.map((l) => ({ ingredientId: l.ingredientId, quantity: parseFloat(l.qty), unitPrice: parseFloat(l.price) })),
            sourceId: sourceId || undefined,
            paymentMethod,
          },
          withIdempotency(key)
        );
        const freed = (res.data.data?.unblockedOrders || []).filter((u: any) => u.fully);
        toast.success(
          `${lines!.length} ingrédient${lines!.length > 1 ? 's' : ''} en stock · ` +
            (res.data.data?.cashMovement ? `caisse −${res.data.data.cashMovement.amount.toFixed(2)} DT` : `${PURCHASE_PAYMENT_LABELS[paymentMethod]} : caisse inchangée`) +
            (freed.length ? ` · ${freed.map((u: any) => `CMD-${u.orderNumber}`).join(', ')} prête${freed.length > 1 ? 's' : ''} à préparer` : '')
        );
        setLines(null);
        await load();
        refresh();
      })
      .catch(() => undefined);

  return (
    <Box>
      <PageHeader
        title="Liste de courses"
        subtitle={`Ce qu’il manque pour vos commandes en cours${orderCount ? ` (${orderCount} commande${orderCount > 1 ? 's' : ''})` : ''}. Les plus urgents en premier.`}
        icon={<ShoppingCart />}
        tone="warning"
        helpTour="shopping-needs"
        helpFlow="shopping"
        actions={
          selected.size > 0 ? (
            <Button data-tour="shop-group-buy" variant="contained" startIcon={<ShoppingCart />} onClick={() => startPurchase((items || []).filter((i) => selected.has(i.ingredientId)))}>
              Acheter la sélection ({selected.size})
            </Button>
          ) : undefined
        }
      />

      {items === null ? (
        <SkeletonCards count={3} height={260} />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            tone="success"
            icon={<CheckCircle />}
            title="Rien à acheter !"
            description="Tous les ingrédients sont en stock pour les commandes en cours."
            action={
              <Button variant="outlined" onClick={() => navigate('/admin/stock')}>
                Voir le stock
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <Box data-tour="shop-summary" sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', md: 'repeat(4, minmax(0,1fr))' }, mb: 2.5 }}>
            <KpiCard label="Ingrédients à acheter" value={items.length} icon={<ShoppingCart />} tone="warning" />
            <KpiCard label="Urgents" value={urgent} icon={<Bolt />} tone={urgent ? 'danger' : 'neutral'} />
            <KpiCard label="Commandes concernées" value={orderCount} icon={<ReceiptLong />} tone="rose" onClick={() => navigate('/admin/orders')} />
            <KpiCard label="Coût estimé" value={totalCost} format={(n) => formatDT(n)} icon={<LocalOffer />} tone="primary" />
          </Box>

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0,1fr))', xl: 'repeat(3, minmax(0,1fr))' } }}>
            {items.map((item, idx) => {
              const p = PRIORITY[item.priority];
              const isSel = selected.has(item.ingredientId);
              return (
                <Card
                  key={item.ingredientId}
                  data-tour={idx === 0 ? 'shop-card' : undefined}
                  sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, borderColor: isSel ? color.primary : undefined, borderTop: `4px solid ${color[p.tone === 'danger' ? 'danger' : p.tone === 'warning' ? 'warning' : 'borderStrong']}` }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="h6" sx={{ fontSize: '1.05rem', textTransform: 'uppercase', letterSpacing: '0.02em' }} noWrap>
                        {item.name}
                      </Typography>
                      <Typography sx={{ fontWeight: 800, fontSize: '1.35rem', color: color.primaryDark, lineHeight: 1.2 }}>
                        {formatQty(item.toBuy)} {item.unit} <Box component="span" sx={{ fontSize: '0.85rem', fontWeight: 600, color: color.inkSoft }}>à acheter</Box>
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                      <StatusBadge tone={p.tone} label={p.label} size="medium" />
                      <Checkbox
                        size="small"
                        checked={isSel}
                        onChange={() => {
                          const next = new Set(selected);
                          if (isSel) next.delete(item.ingredientId);
                          else next.add(item.ingredientId);
                          setSelected(next);
                        }}
                        inputProps={{ 'aria-label': `Sélectionner ${item.name} pour un achat groupé` }}
                        sx={{ p: 0.25 }}
                      />
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 0.75 }}>
                    <Stat label="Stock actuel" value={`${formatQty(item.inStock)} ${item.unit}`} />
                    <Stat label="Nécessaire" value={`${formatQty(item.needed)} ${item.unit}`} />
                    <Stat label="Manquant" value={`${formatQty(item.missing ?? item.toBuy)} ${item.unit}`} tone={color.dangerDark} />
                  </Box>

                  <Box data-tour={idx === 0 ? 'shop-orders' : undefined}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: color.inkSoft }}>
                      Commandes concernées
                    </Typography>
                    {item.orders.map((o) => (
                      <ButtonBase
                        key={o.needId}
                        onClick={() => navigate(`/admin/orders/${o.orderId}`)}
                        sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', gap: 1, py: 0.5, px: 0.75, borderRadius: `${radius.xs}px`, textAlign: 'left', '&:hover': { bgcolor: color.surfaceMuted } }}
                      >
                        <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>
                          <strong>{o.orderRef}</strong> · {o.clientName}
                          <Box component="span" sx={{ color: color.inkMuted }}>
                            {' '}
                            · {o.neededBy ? formatDate(o.neededBy, true) : 'sans date'}
                            {o.status !== 'a acheter' ? ` · ${statusLabel(o.status)}` : ''}
                          </Box>
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}>
                          → {formatQty(o.missingQty)} {item.unit}
                        </Typography>
                      </ButtonBase>
                    ))}
                  </Box>

                  <Box sx={{ p: 1.25, borderRadius: `${radius.md}px`, bgcolor: color.surfaceMuted, border: `1px solid ${color.border}`, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                      <Storefront sx={{ fontSize: 16, color: color.inkMuted }} />
                      {item.sources.length ? (
                        item.sources.map((s) => (
                          <StatusBadge key={s.sourceId} tone="info" label={`${s.name}${s.price !== null ? ` · ${formatDT(s.price)}/${item.unit}` : ''}`} />
                        ))
                      ) : item.lastPurchase?.sourceName ? (
                        <StatusBadge tone="info" label={item.lastPurchase.sourceName} />
                      ) : (
                        <Typography variant="caption" sx={{ color: color.inkMuted }}>
                          Aucune source connue
                        </Typography>
                      )}
                    </Box>
                    <Typography variant="body2" sx={{ color: color.inkSoft }}>
                      Dernier prix payé :{' '}
                      {item.lastPurchase ? (
                        <strong style={{ color: color.ink }}>
                          {formatDT(item.lastPurchase.unitPrice)}/{item.unit}
                          <span style={{ fontWeight: 400, color: color.inkMuted }}> · le {formatDate(item.lastPurchase.date)}</span>
                        </strong>
                      ) : (
                        'aucun achat enregistré'
                      )}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
                      <Typography variant="body2" sx={{ color: color.inkSoft }}>
                        Coût estimé
                      </Typography>
                      <Typography sx={{ fontWeight: 800 }}>{item.priceBasis === 'none' ? '—' : formatDT(item.estimatedCost)}</Typography>
                    </Box>
                    <Typography variant="caption" sx={{ color: color.inkMuted }}>
                      {BASIS[item.priceBasis]}
                    </Typography>
                  </Box>

                  <Button data-tour={idx === 0 ? 'shop-buy' : undefined} variant="contained" startIcon={<ShoppingCart />} onClick={() => startPurchase([item])} sx={{ mt: 'auto' }}>
                    Acheter
                  </Button>
                </Card>
              );
            })}
          </Box>
          <Typography variant="caption" sx={{ display: 'block', mt: 2, color: color.inkSoft }}>
            Achat partiel : le stock acheté sert d’abord les commandes les plus proches ; les autres restent dans la liste.
          </Typography>
        </>
      )}

      <ResponsiveDialog
        open={!!lines}
        onClose={() => setLines(null)}
        title={lines && lines.length === 1 ? `Acheter : ${lines[0].name}` : `Achat groupé (${lines?.length || 0} ingrédients)`}
        subtitle="Indiquez ce que vous avez réellement acheté et payé."
        actions={
          <>
            <Button onClick={() => setLines(null)}>Annuler</Button>
            <Button variant="contained" disabled={!valid || op.busy} onClick={purchase}>
              {op.busy ? 'Enregistrement…' : `Enregistrer l’achat${total > 0 ? ` — ${formatDT(total)}` : ''}`}
            </Button>
          </>
        }
      >
        {lines && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 0.5 }}>
            {lines.map((l, i) => (
              <Box key={l.ingredientId} sx={{ p: lines.length > 1 ? 1.5 : 0, borderRadius: `${radius.md}px`, border: lines.length > 1 ? `1px solid ${color.border}` : 'none' }}>
                {lines.length > 1 && <Typography sx={{ fontWeight: 700, mb: 1 }}>{l.name}</Typography>}
                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                  <TextField
                    label="Quantité achetée"
                    type="number"
                    value={l.qty}
                    onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))}
                    InputProps={{ endAdornment: <InputAdornment position="end">{l.unit}</InputAdornment> }}
                    inputProps={{ min: 0, step: 0.001, inputMode: 'decimal' }}
                    sx={{ flex: '1 1 140px' }}
                  />
                  <TextField
                    label="Prix payé"
                    required
                    type="number"
                    value={l.price}
                    onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))}
                    InputProps={{ endAdornment: <InputAdornment position="end">DT/{l.unit}</InputAdornment> }}
                    inputProps={{ min: 0, step: 0.001, inputMode: 'decimal' }}
                    sx={{ flex: '1 1 140px' }}
                    helperText={
                      l.hint !== null ? (
                        <ButtonBase onClick={() => setLines(lines.map((x, j) => (j === i ? { ...x, price: String(l.hint) } : x)))} sx={{ color: color.primaryDark, fontWeight: 600, fontSize: '0.75rem' }}>
                          Dernier prix connu : {formatDT(l.hint)} — utiliser
                        </ButtonBase>
                      ) : (
                        'Prix réellement payé'
                      )
                    }
                  />
                </Box>
              </Box>
            ))}
            <TextField select label="Source (facultatif)" value={sourceId} onChange={(e) => setSourceId(e.target.value)} size="small">
              <MenuItem value="">Non précisée</MenuItem>
              {sources.map((s) => (
                <MenuItem key={s._id} value={s._id}>
                  {s.name}
                </MenuItem>
              ))}
            </TextField>
            <PurchasePaymentSelect value={paymentMethod} onChange={setPaymentMethod} amount={total} />
            <Typography variant="caption" sx={{ color: color.inkSoft }}>
              Le stock augmente, les commandes en attente sont recalculées. Enregistré une seule fois, même en cas de double clic.
            </Typography>
          </Box>
        )}
      </ResponsiveDialog>
    </Box>
  );
};

export default ShoppingListPage;
