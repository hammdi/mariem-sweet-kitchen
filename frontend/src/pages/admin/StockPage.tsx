import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api, { withIdempotency } from '../../services/api';
import {
  Typography,
  Box,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Button,
  ButtonBase,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Search, Inventory2, Edit, ShoppingCart, CheckCircle, WarningAmber, ErrorOutline } from '@mui/icons-material';
import { PURCHASE_PAYMENT_LABELS, STOCK_REASON_LABELS, formatDT, formatQty } from '../../utils/format';
import { useIdempotentAction } from '../../hooks/useIdempotencyKey';
import { useAdminData } from '../../context/AdminDataContext';
import { EmptyState, FilterChips, KpiCard, PageHeader, ResponsiveDialog, SkeletonRows, StatusBadge } from '../../components/ui';
import { color, radius, Tone } from '../../theme/tokens';

type State = 'ok' | 'watch' | 'missing';
const STATE: Record<State, { label: string; tone: Tone; icon: JSX.Element }> = {
  ok: { label: 'OK', tone: 'success', icon: <CheckCircle /> },
  watch: { label: 'À surveiller', tone: 'warning', icon: <WarningAmber /> },
  missing: { label: 'Manquant', tone: 'danger', icon: <ErrorOutline /> },
};
const HISTORY_TYPE: Record<string, { label: string; tone: Tone }> = {
  restock: { label: 'Achat', tone: 'success' },
  deduction: { label: 'Utilisé', tone: 'primary' },
  restore: { label: 'Remis en stock', tone: 'info' },
  adjustment: { label: 'Correction', tone: 'violet' },
};

interface PriceInfo {
  lastPurchases: Record<string, { unitPrice: number; date: string; sourceName: string }>;
  summaries: Record<string, { best: { price: number; sourceName: string | null } | null }>;
}

const StockPage = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { refresh } = useAdminData();
  const [ingredients, setIngredients] = useState<any[] | null>(null);
  const [prices, setPrices] = useState<PriceInfo>({ lastPurchases: {}, summaries: {} });
  const [neededIds, setNeededIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'' | State>('');
  const [tab, setTab] = useState(0);
  const [history, setHistory] = useState<any[]>([]);
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const previous = useRef<Record<string, number>>({});
  // correction
  const [target, setTarget] = useState<any | null>(null);
  const [newQty, setNewQty] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const op = useIdempotentAction();

  const load = async () => {
    try {
      const [ing, sum, shop] = await Promise.all([
        api.get('/ingredients', { params: { limit: 500 } }),
        api.get('/ingredients/price-summary'),
        api.get('/orders/shopping-list'),
      ]);
      const list = ing.data.data?.ingredients || [];
      // petite animation seulement sur les valeurs qui ont changé
      const moved = new Set<string>();
      for (const i of list) {
        const before = previous.current[i._id];
        if (before !== undefined && before !== i.stockQuantity) moved.add(i._id);
        previous.current[i._id] = i.stockQuantity;
      }
      setChanged(moved);
      setIngredients(list);
      setPrices({ lastPurchases: sum.data.data?.lastPurchases || {}, summaries: sum.data.data?.summaries || {} });
      setNeededIds(new Set((shop.data.data?.shoppingList || []).map((x: any) => x.ingredientId)));
    } catch {
      setIngredients((prev) => prev || []);
    }
  };
  const loadHistory = async () => {
    try {
      const res = await api.get('/orders/stock-history', { params: { limit: 100 } });
      setHistory(res.data.data?.history || []);
    } catch {
      /* historique indisponible */
    }
  };

  useEffect(() => {
    load();
    loadHistory();
  }, []);

  const stateOf = (ing: any): State => {
    const qty = ing.stockQuantity || 0;
    if (qty <= 0 || neededIds.has(ing._id)) return 'missing';
    if (ing.minStock > 0 && qty < ing.minStock) return 'watch';
    return 'ok';
  };

  const rows = useMemo(() => {
    const list = (ingredients || []).map((i) => ({ ...i, state: stateOf(i) }));
    const rank: Record<State, number> = { missing: 0, watch: 1, ok: 2 };
    return list.sort((a, b) => rank[a.state as State] - rank[b.state as State] || a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingredients, neededIds]);
  const counts = { ok: 0, watch: 0, missing: 0 } as Record<State, number>;
  rows.forEach((r) => (counts[r.state as State] += 1));
  const filtered = rows.filter((r) => (!filter || r.state === filter) && r.name.toLowerCase().includes(search.toLowerCase()));

  const lastPrice = (id: string, ing: any) => {
    const lp = prices.lastPurchases[id];
    if (lp) return { price: lp.unitPrice, date: lp.date, source: lp.sourceName, real: true };
    const best = prices.summaries[id]?.best;
    if (best) return { price: best.price, date: null, source: best.sourceName || '', real: false };
    return ing.pricePerUnit ? { price: ing.pricePerUnit, date: null, source: '', real: false } : null;
  };

  const openCorrection = (ing: any) => {
    op.reset();
    setTarget(ing);
    setNewQty(String(ing.stockQuantity || 0));
    setReason('');
    setNote('');
  };
  const diff = target ? Math.round(((parseFloat(newQty) || 0) - (target.stockQuantity || 0)) * 1000) / 1000 : 0;
  const correctionInvalid =
    !target || newQty === '' || isNaN(parseFloat(newQty)) || parseFloat(newQty) < 0 || diff === 0 || !reason || (reason === 'other' && note.trim().length < 3);

  const saveCorrection = () =>
    op
      .run(async (key) => {
        await api.post(
          `/ingredients/${target._id}/stock-adjustment`,
          { newQuantity: parseFloat(newQty), reason, note: note.trim() || undefined },
          withIdempotency(key)
        );
        toast.success(`Stock de ${target.name} corrigé`);
        setTarget(null);
        await Promise.all([load(), loadHistory()]);
        refresh();
      })
      .catch(() => undefined);

  const qtyCell = (ing: any) => (
    <Box
      component="span"
      sx={{
        fontWeight: 800,
        fontVariantNumeric: 'tabular-nums',
        px: 0.75,
        py: 0.25,
        borderRadius: `${radius.xs}px`,
        ...(changed.has(ing._id)
          ? {
              animation: 'stock-flash 1.4s ease-out 1',
              '@keyframes stock-flash': { '0%': { backgroundColor: color.primaryTint }, '100%': { backgroundColor: 'transparent' } },
            }
          : {}),
      }}
    >
      {formatQty(ing.stockQuantity || 0)}
    </Box>
  );

  return (
    <Box>
      <PageHeader
        title="Stock"
        subtitle="Ce que vous avez à la maison : + à chaque achat, − au début de chaque préparation."
        icon={<Inventory2 />}
        tone="success"
        helpTour="understand-stock"
        helpFlow="stock"
        actions={
          <Button variant="outlined" startIcon={<ShoppingCart />} onClick={() => navigate('/admin/shopping-list')}>
            Liste de courses
          </Button>
        }
      />

      <Box data-tour="stock-summary" sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(3, minmax(0,1fr))' }, mb: 2.5 }}>
        <KpiCard label="OK" value={counts.ok} icon={<CheckCircle />} tone="success" onClick={() => setFilter(filter === 'ok' ? '' : 'ok')} />
        <KpiCard label="À surveiller" value={counts.watch} icon={<WarningAmber />} tone="warning" onClick={() => setFilter(filter === 'watch' ? '' : 'watch')} />
        <KpiCard label="Manquants" value={counts.missing} icon={<ErrorOutline />} tone="danger" onClick={() => setFilter(filter === 'missing' ? '' : 'missing')} />
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: `1px solid ${color.border}` }}>
        <Tab label="Mon stock" />
        <Tab data-tour="stock-history-tab" label={`Historique (${history.length})`} />
      </Tabs>

      {tab === 0 && (
        <>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 1.5, mb: 2, alignItems: { md: 'center' } }}>
            <TextField
              size="small"
              placeholder="Rechercher un ingrédient…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              inputProps={{ 'aria-label': 'Rechercher un ingrédient' }}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
              sx={{ width: { xs: '100%', md: 280 } }}
            />
            <FilterChips
              ariaLabel="État du stock"
              value={filter}
              onChange={(v) => setFilter(v as '' | State)}
              options={[
                { value: '', label: 'Tous', count: rows.length },
                { value: 'missing', label: 'Manquants', count: counts.missing },
                { value: 'watch', label: 'À surveiller', count: counts.watch },
                { value: 'ok', label: 'OK', count: counts.ok },
              ]}
            />
          </Box>

          <Box data-tour="stock-table">
            {ingredients === null ? (
              <SkeletonRows rows={6} />
            ) : filtered.length === 0 ? (
              <Card>
                <EmptyState icon={<Inventory2 />} title="Aucun ingrédient" description={search || filter ? 'Aucun ingrédient ne correspond à ce filtre.' : 'Ajoutez vos ingrédients depuis la page Ingrédients.'} />
              </Card>
            ) : isMobile ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {filtered.map((ing, i) => {
                  const st = STATE[ing.state as State];
                  const lp = lastPrice(ing._id, ing);
                  return (
                    <Card key={ing._id} sx={{ p: 1.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'center' }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 800 }} noWrap>
                            {ing.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: color.inkSoft }}>
                            {qtyCell(ing)} {ing.unit}
                            {ing.minStock > 0 ? ` · seuil ${formatQty(ing.minStock)} ${ing.unit}` : ''}
                          </Typography>
                        </Box>
                        <StatusBadge tone={st.tone} label={st.label} icon={st.icon} />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1, gap: 1 }}>
                        <Typography variant="caption" sx={{ color: color.inkSoft }} noWrap>
                          {lp ? `${formatDT(lp.price)}/${ing.unit}${lp.source ? ` · ${lp.source}` : ''}` : 'Pas de prix'}
                        </Typography>
                        <Button size="small" variant="outlined" startIcon={<Edit />} onClick={() => openCorrection(ing)} data-tour={i === 0 ? 'stock-correct' : undefined}>
                          Corriger
                        </Button>
                      </Box>
                    </Card>
                  );
                })}
              </Box>
            ) : (
              <TableContainer component={Card} sx={{ overflowX: 'auto' }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Ingrédient</TableCell>
                      <TableCell align="right">Stock actuel</TableCell>
                      <TableCell>Unité</TableCell>
                      <TableCell align="right">Seuil</TableCell>
                      <TableCell>État</TableCell>
                      <TableCell align="right">Dernier prix</TableCell>
                      <TableCell>Source</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filtered.map((ing, i) => {
                      const st = STATE[ing.state as State];
                      const lp = lastPrice(ing._id, ing);
                      return (
                        <TableRow key={ing._id} hover>
                          <TableCell>
                            <ButtonBase onClick={() => navigate(`/admin/ingredients/${ing._id}`)} sx={{ fontWeight: 700, textAlign: 'left', justifyContent: 'flex-start', whiteSpace: 'nowrap', '&:hover': { color: color.primaryDark } }}>
                              {ing.name}
                            </ButtonBase>
                          </TableCell>
                          <TableCell align="right">{qtyCell(ing)}</TableCell>
                          <TableCell sx={{ color: color.inkSoft }}>{ing.unit}</TableCell>
                          <TableCell align="right" sx={{ color: color.inkSoft }}>
                            {ing.minStock > 0 ? formatQty(ing.minStock) : '—'}
                          </TableCell>
                          <TableCell>
                            <StatusBadge tone={st.tone} label={neededIds.has(ing._id) && (ing.stockQuantity || 0) > 0 ? 'Manque (commandes)' : st.label} icon={st.icon} />
                          </TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                            {lp ? (
                              <>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                  {formatDT(lp.price)}/{ing.unit}
                                </Typography>
                                <Typography variant="caption" sx={{ color: color.inkMuted }}>
                                  {lp.real ? `payé le ${new Date(lp.date!).toLocaleDateString('fr-FR')}` : 'prix constaté'}
                                </Typography>
                              </>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell sx={{ color: color.inkSoft }}>{lp?.source || '—'}</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                            <Button size="small" variant="outlined" startIcon={<Edit />} onClick={() => openCorrection(ing)} data-tour={i === 0 ? 'stock-correct' : undefined}>
                              Corriger
                            </Button>{' '}
                            <Button size="small" startIcon={<ShoppingCart />} onClick={() => navigate(`/admin/ingredients/${ing._id}`)}>
                              Acheter
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </>
      )}

      {tab === 1 && (
        <Card sx={{ overflow: 'hidden' }}>
          {history.length === 0 ? (
            <EmptyState icon={<Inventory2 />} title="Aucun mouvement" description="Chaque achat, utilisation et correction de stock apparaîtra ici." />
          ) : (
            <Box>
              {history.map((h: any) => {
                const t = HISTORY_TYPE[h.type] || HISTORY_TYPE.restock;
                const sign = h.type === 'deduction' ? '−' : h.type === 'adjustment' ? (h.quantity > 0 ? '+' : '−') : '+';
                const detail =
                  h.type === 'adjustment'
                    ? `${STOCK_REASON_LABELS[h.reason] || 'Correction'} · ${formatQty(h.stockBefore)} → ${formatQty(h.stockAfter)} ${h.unit}${h.note && h.note !== STOCK_REASON_LABELS[h.reason] ? ` · « ${h.note} »` : ''}`
                    : h.type === 'restock'
                      ? [h.sourceName, typeof h.unitPrice === 'number' ? `${formatDT(h.unitPrice)}/${h.unit}` : '', h.paymentMethod ? PURCHASE_PAYMENT_LABELS[h.paymentMethod] : ''].filter(Boolean).join(' · ')
                      : h.type === 'restore'
                        ? `Remise exceptionnelle${h.note ? ` · « ${h.note} »` : ''}${h.clientName ? ` · ${h.clientName}` : ''}`
                        : [h.recipeName, h.clientName].filter(Boolean).join(' · ');
                return (
                  <Box key={h._id} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', px: 2, py: 1.25, borderBottom: `1px solid ${color.border}`, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
                    <Box sx={{ width: 110, flexShrink: 0 }}>
                      <StatusBadge tone={t.tone} label={t.label} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {h.ingredientName}
                      </Typography>
                      <Typography variant="caption" sx={{ color: color.inkSoft, display: 'block' }}>
                        {new Date(h.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        {detail ? ` · ${detail}` : ''}
                        {h.createdBy ? ` · ${h.createdBy}` : ''}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontWeight: 800, whiteSpace: 'nowrap', color: sign === '+' ? color.successDark : color.dangerDark, fontVariantNumeric: 'tabular-nums' }}>
                      {sign}
                      {formatQty(Math.abs(h.quantity))} {h.unit}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          )}
        </Card>
      )}

      {/* Correction manuelle : raison obligatoire, jamais silencieuse */}
      <ResponsiveDialog
        open={!!target}
        onClose={() => setTarget(null)}
        maxWidth="xs"
        title={target ? `Corriger le stock — ${target.name}` : ''}
        subtitle="La correction est notée dans l’historique (ancienne valeur, nouvelle valeur, raison, auteur)."
        actions={
          <>
            <Button onClick={() => setTarget(null)}>Annuler</Button>
            <Button variant="contained" disabled={correctionInvalid || op.busy} onClick={saveCorrection}>
              {op.busy ? 'Enregistrement…' : 'Enregistrer la correction'}
            </Button>
          </>
        }
      >
        {target && (
          <>
            <Box sx={{ display: 'flex', gap: 1.5, mb: 2, mt: 0.5 }}>
              <Box sx={{ flex: 1, p: 1.25, borderRadius: `${radius.md}px`, bgcolor: color.bgSubtle }}>
                <Typography variant="caption" sx={{ color: color.inkSoft }}>
                  Stock actuel
                </Typography>
                <Typography sx={{ fontWeight: 800 }}>
                  {formatQty(target.stockQuantity || 0)} {target.unit}
                </Typography>
              </Box>
              <TextField
                sx={{ flex: 1 }}
                autoFocus
                label={`Nouveau stock (${target.unit})`}
                type="number"
                value={newQty}
                onChange={(e) => setNewQty(e.target.value)}
                inputProps={{ min: 0, step: 0.001, inputMode: 'decimal' }}
              />
            </Box>
            {diff !== 0 && !isNaN(diff) && (
              <Typography variant="body2" sx={{ mb: 1.5, fontWeight: 700, color: diff > 0 ? color.successDark : color.dangerDark }}>
                Différence : {diff > 0 ? '+' : '−'}
                {formatQty(Math.abs(diff))} {target.unit}
              </Typography>
            )}
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Raison (obligatoire)
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
              {Object.entries(STOCK_REASON_LABELS).map(([k, v]) => (
                <ButtonBase
                  key={k}
                  onClick={() => setReason(k)}
                  aria-pressed={reason === k}
                  sx={{
                    px: 1.25,
                    py: 0.6,
                    borderRadius: `${radius.pill}px`,
                    border: `1px solid ${reason === k ? color.primary : color.borderStrong}`,
                    bgcolor: reason === k ? color.primarySoft : color.surface,
                    color: reason === k ? color.primaryDark : color.inkSoft,
                    fontWeight: 600,
                    fontSize: '0.85rem',
                  }}
                >
                  {v}
                </ButtonBase>
              ))}
            </Box>
            <TextField
              fullWidth
              size="small"
              label={reason === 'other' ? 'Précisez (obligatoire)' : 'Précision (facultative)'}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ex : sac de farine renversé"
            />
          </>
        )}
      </ResponsiveDialog>
    </Box>
  );
};

export default StockPage;
