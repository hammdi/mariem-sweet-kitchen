import { ReactNode, useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  Autocomplete,
  Box,
  Button,
  ButtonBase,
  Card,
  IconButton,
  InputAdornment,
  MenuItem,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add,
  EditNote,
  Remove,
  Inventory2,
  AccountBalanceWallet,
  ArrowDownward,
  ArrowUpward,
  HourglassTop,
  Savings,
  ReceiptLong,
  Block,
} from '@mui/icons-material';
import type { PurchaseRecord, Sale, CashMovementRow, CashSummary } from '../../types/admin';
import PurchasePaymentSelect, { PurchasePaymentMethod } from '../../components/admin/PurchasePaymentSelect';
import { CASH_TYPE_LABELS, PAYMENT_METHOD_LABELS, PURCHASE_PAYMENT_LABELS, formatDT } from '../../utils/format';
import api, { withIdempotency } from '../../services/api';
import PeriodFilter, { Range } from '../../components/admin/PeriodFilter';
import DateTimeField from '../../components/common/DateTimeField';
import { formatDateTimeFr } from '../../utils/dateTime';
import { useIdempotentAction } from '../../hooks/useIdempotencyKey';
import { useAdminData } from '../../context/AdminDataContext';
import { EmptyState, KpiCard, OrderStatusBadge, PageHeader, PaymentStatusBadge, ResponsiveDialog, StatusBadge } from '../../components/ui';
import { color } from '../../theme/tokens';

type IncomeType = 'other_income' | 'opening_balance';

interface ExpenseRow {
  _id: string;
  amount: number;
  description: string;
  occurredAt: string;
  paymentMethod: PurchasePaymentMethod;
  cashMovementId: string | null;
  status: 'active' | 'cancelled';
  cancelReason?: string;
  createdBy?: { email: string };
}

/** Ligne lisible : icône de sens (vert = entrée, rouge = sortie), libellé, détails, montant. */
function MoneyRow({
  direction,
  title,
  lines,
  amount,
  muted,
  chips,
  action,
}: {
  direction: 'in' | 'out' | 'neutral';
  title: ReactNode;
  lines?: ReactNode[];
  amount: ReactNode;
  muted?: boolean;
  chips?: ReactNode;
  action?: ReactNode;
}) {
  const c = direction === 'in' ? color.success : direction === 'out' ? color.danger : color.inkMuted;
  const bg = direction === 'in' ? color.successSoft : direction === 'out' ? color.dangerSoft : color.bgSubtle;
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        alignItems: 'flex-start',
        px: { xs: 1.5, md: 2 },
        py: 1.5,
        borderBottom: `1px solid ${color.border}`,
        opacity: muted ? 0.55 : 1,
        '&:last-of-type': { borderBottom: 0 },
      }}
    >
      <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: bg, color: c, display: 'grid', placeItems: 'center', flexShrink: 0, mt: 0.25 }}>
        {direction === 'in' ? <ArrowDownward fontSize="small" /> : direction === 'out' ? <ArrowUpward fontSize="small" /> : <Inventory2 fontSize="small" />}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', textDecoration: muted ? 'line-through' : 'none', overflowWrap: 'anywhere' }}>{title}</Typography>
        {lines?.filter(Boolean).map((l, i) => (
          <Typography key={i} variant="caption" sx={{ color: color.inkSoft, display: 'block', overflowWrap: 'anywhere' }}>
            {l}
          </Typography>
        ))}
        {chips && <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>{chips}</Box>}
      </Box>
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography sx={{ fontWeight: 800, color: c, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{amount}</Typography>
        {action}
      </Box>
    </Box>
  );
}

/**
 * Caisse = argent réellement reçu ou dépensé. Une commande non payée n'y figure
 * pas (elle est « à encaisser »). Achats et dépenses payés hors caisse sont
 * tracés sans changer la liquidité.
 */
const CashPage = () => {
  const navigate = useNavigate();
  const { refresh } = useAdminData();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlRange = searchParams.get('from') && searchParams.get('to') ? { from: searchParams.get('from')!, to: searchParams.get('to')! } : null;
  const [range, setRange] = useState<Range | null>(null);
  const [tab, setTab] = useState(searchParams.get('tab') === 'receivables' ? 1 : 0);
  const [receivables, setReceivables] = useState<{ orders: Sale[]; total: number }>({ orders: [], total: 0 });
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [expenses, setExpenses] = useState<{ expenses: ExpenseRow[]; total: number; byMethod: Record<string, { total: number }> }>({
    expenses: [],
    total: 0,
    byMethod: {},
  });
  const [movements, setMovements] = useState<CashMovementRow[]>([]);
  const [summary, setSummary] = useState<CashSummary | null>(null);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [sources, setSources] = useState<{ _id: string; name: string }[]>([]);

  // Formulaires : chaque opération a sa propre clé d'idempotence
  const [income, setIncome] = useState<{ open: boolean; type: IncomeType; amount: string; description: string; method: string; occurredAt: string | null }>({
    open: false,
    type: 'other_income',
    amount: '',
    description: '',
    method: 'cash',
    occurredAt: null,
  });
  const [expense, setExpense] = useState<{ open: boolean; amount: string; description: string; paymentMethod: PurchasePaymentMethod; occurredAt: string | null }>({
    open: false,
    amount: '',
    description: '',
    paymentMethod: 'cash_register',
    occurredAt: null,
  });
  const [purchase, setPurchase] = useState<{ open: boolean; ingredient: any | null; quantity: string; unitPrice: string; sourceId: string; paymentMethod: PurchasePaymentMethod }>({
    open: false,
    ingredient: null,
    quantity: '',
    unitPrice: '',
    sourceId: '',
    paymentMethod: 'cash_register',
  });
  const [methodTarget, setMethodTarget] = useState<PurchaseRecord | null>(null);
  const [newMethod, setNewMethod] = useState<PurchasePaymentMethod>('cash_register');
  const [correcting, setCorrecting] = useState<CashMovementRow | null>(null);
  const [correction, setCorrection] = useState({ amount: '', reason: '' });
  const [cancelTarget, setCancelTarget] = useState<ExpenseRow | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const incomeOp = useIdempotentAction();
  const expenseOp = useIdempotentAction();
  const purchaseOp = useIdempotentAction();
  const methodOp = useIdempotentAction();
  const correctOp = useIdempotentAction();
  const cancelOp = useIdempotentAction();
  const collectOp = useIdempotentAction();

  const load = useCallback(async () => {
    if (!range) return;
    try {
      const [res, rec, pur, exp] = await Promise.all([
        api.get('/cash', { params: range }),
        api.get('/cash/receivables'),
        api.get('/purchases', { params: range }),
        api.get('/expenses', { params: range }),
      ]);
      setMovements(res.data.data.movements);
      setSummary(res.data.data.summary);
      setReceivables(rec.data.data);
      setPurchases(pur.data.data.purchases);
      setExpenses(exp.data.data);
    } catch {
      /* toast intercepteur */
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const after = async () => {
    await load();
    refresh();
  };

  const openIncome = (type: IncomeType = 'other_income') => {
    incomeOp.reset();
    setIncome({ open: true, type, amount: '', description: '', method: 'cash', occurredAt: null });
  };
  const openExpense = () => {
    expenseOp.reset();
    setExpense({ open: true, amount: '', description: '', paymentMethod: 'cash_register', occurredAt: null });
  };
  const openPurchase = async () => {
    purchaseOp.reset();
    setPurchase({ open: true, ingredient: null, quantity: '', unitPrice: '', sourceId: '', paymentMethod: 'cash_register' });
    if (ingredients.length === 0) {
      try {
        const [ing, src] = await Promise.all([api.get('/ingredients?limit=500'), api.get('/purchase-sources')]);
        setIngredients(ing.data.data?.ingredients || []);
        setSources(src.data.data?.sources || []);
      } catch {
        /* toast intercepteur */
      }
    }
  };

  // Formulaire vide ouvert depuis l'aide (?open=income|expense|purchase) : rien n'est enregistré
  useEffect(() => {
    const open = searchParams.get('open');
    if (!open) return;
    if (open === 'income') openIncome();
    if (open === 'expense') openExpense();
    if (open === 'purchase') openPurchase();
    const next = new URLSearchParams(searchParams);
    next.delete('open');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const saveIncome = () =>
    incomeOp
      .run(async (key) => {
        await api.post(
          '/cash',
          { type: income.type, amount: parseFloat(income.amount), description: income.description, method: income.method, occurredAt: income.occurredAt || undefined },
          withIdempotency(key)
        );
        toast.success(income.type === 'opening_balance' ? 'Fonds de caisse enregistré' : 'Entrée enregistrée');
        setIncome({ ...income, open: false });
        await after();
      })
      .catch(() => undefined);

  const saveExpense = () =>
    expenseOp
      .run(async (key) => {
        await api.post(
          '/expenses',
          { amount: parseFloat(expense.amount), description: expense.description, paymentMethod: expense.paymentMethod, occurredAt: expense.occurredAt || undefined },
          withIdempotency(key)
        );
        toast.success(expense.paymentMethod === 'cash_register' ? 'Dépense enregistrée · caisse mise à jour' : 'Dépense enregistrée · caisse inchangée');
        setExpense({ ...expense, open: false });
        await after();
      })
      .catch(() => undefined);

  const savePurchase = () =>
    purchaseOp
      .run(async (key) => {
        const res = await api.post(
          `/ingredients/${purchase.ingredient._id}/purchases`,
          {
            quantity: parseFloat(purchase.quantity),
            unitPrice: parseFloat(purchase.unitPrice),
            sourceId: purchase.sourceId || undefined,
            paymentMethod: purchase.paymentMethod,
          },
          withIdempotency(key)
        );
        const unblocked = res.data.data.unblockedOrders || [];
        toast.success(
          `Stock +${purchase.quantity} ${purchase.ingredient.unit} ${purchase.ingredient.name} · ` +
            (res.data.data.cashMovement ? `caisse −${formatDT(res.data.data.cashMovement.amount)}` : `${PURCHASE_PAYMENT_LABELS[purchase.paymentMethod]} : caisse inchangée`) +
            (unblocked.length
              ? ` · ${unblocked.map((u: any) => `CMD-${u.orderNumber}`).join(', ')} ${unblocked.every((u: any) => u.fully) ? 'débloquée(s)' : 'mise(s) à jour'}`
              : '')
        );
        setPurchase({ ...purchase, open: false });
        await after();
      })
      .catch(() => undefined);

  const changeMethod = () =>
    methodOp
      .run(async (key) => {
        await api.put(`/purchases/${methodTarget!.purchaseId}/payment-method`, { paymentMethod: newMethod }, withIdempotency(key));
        toast.success(`Moyen de paiement : ${PURCHASE_PAYMENT_LABELS[newMethod]} (caisse mise à jour)`);
        setMethodTarget(null);
        await after();
      })
      .catch(() => undefined);

  const collectRemaining = (sale: Sale) => {
    collectOp.reset(); // une clé par encaissement
    return collectOp
      .run(async (key) => {
        await api.post(`/cash/orders/${sale._id}/payment`, { method: 'cash' }, withIdempotency(key));
        toast.success(`${sale.orderRef} : ${formatDT(sale.remaining)} encaissés`);
        await after();
      })
      .catch(() => undefined);
  };

  const saveCorrection = () =>
    correctOp
      .run(async (key) => {
        await api.post(
          `/cash/${correcting!._id}/correct`,
          { amount: correction.amount === '' ? undefined : parseFloat(correction.amount), reason: correction.reason },
          withIdempotency(key)
        );
        toast.success('Correction enregistrée (le mouvement d’origine reste visible)');
        setCorrecting(null);
        await after();
      })
      .catch(() => undefined);

  const cancelExpense = () =>
    cancelOp
      .run(async (key) => {
        await api.post(`/expenses/${cancelTarget!._id}/cancel`, { reason: cancelReason }, withIdempotency(key));
        toast.success('Dépense annulée');
        setCancelTarget(null);
        await after();
      })
      .catch(() => undefined);

  const outside = Object.entries(expenses.byMethod || {})
    .filter(([m]) => m !== 'cash_register')
    .reduce((s, [, v]) => s + v.total, 0);

  return (
    <Box>
      <PageHeader
        title="Caisse"
        subtitle="L’argent qui entre et qui sort de la caisse."
        icon={<AccountBalanceWallet />}
        tone="violet"
        helpTour="cash-income"
        helpFlow="cash"
        actions={
          <>
            <Button data-tour="cash-add-income" variant="outlined" color="success" startIcon={<Add />} onClick={() => openIncome()}>
              Entrée
            </Button>
            <Button data-tour="cash-add-expense" variant="outlined" color="error" startIcon={<Remove />} onClick={openExpense}>
              Dépense
            </Button>
            <Button data-tour="cash-add-purchase" variant="contained" startIcon={<Inventory2 />} onClick={openPurchase}>
              Achat de stock
            </Button>
          </>
        }
      />

      <Card sx={{ p: { xs: 1.5, md: 2 }, mb: 2 }}>
        <PeriodFilter onChange={setRange} initialRange={urlRange} />
      </Card>

      <Box data-tour="cash-tiles" sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', lg: 'repeat(4, minmax(0,1fr))' }, mb: 1 }}>
        <KpiCard label="Liquidité" value={summary?.theoreticalBalance ?? 0} format={(n) => formatDT(n)} icon={<Savings />} tone="violet" hint="Solde de caisse en fin de période" />
        <KpiCard label="Entrées" value={summary?.totalIn ?? 0} format={(n) => (n > 0 ? `+${formatDT(n)}` : formatDT(n))} icon={<ArrowDownward />} tone="success" valueColor={color.successDark} hint="Paiements, autres entrées" />
        <KpiCard label="Sorties" value={summary?.totalOut ?? 0} format={(n) => (n > 0 ? `−${formatDT(n)}` : formatDT(n))} icon={<ArrowUpward />} tone="danger" valueColor={color.dangerDark} hint="Achats, dépenses, remboursements" />
        <KpiCard
          label="À encaisser"
          value={summary?.outstanding ?? 0}
          format={(n) => formatDT(n)}
          icon={<HourglassTop />}
          tone="warning"
          valueColor={color.warningDark}
          hint="Ventes pas encore payées"
          onClick={() => setTab(1)}
        />
      </Box>
      <Typography variant="caption" sx={{ display: 'block', color: color.inkSoft, mb: 2 }}>
        {summary ? `Solde au début de la période : ${formatDT(summary.openingBalance)}. ` : ''}
        <ButtonBase onClick={() => openIncome('opening_balance')} sx={{ color: color.primaryDark, fontWeight: 700, fontSize: 'inherit', verticalAlign: 'baseline' }}>
          Saisir le fonds de caisse
        </ButtonBase>
      </Typography>

      <Tabs
        data-tour="cash-tabs"
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{ mb: 2, borderBottom: `1px solid ${color.border}` }}
      >
        <Tab label="Mouvements d’argent" />
        <Tab data-tour="cash-receivables-tab" label={`Commandes à encaisser (${receivables.orders.length})`} />
        <Tab label={`Achats de stock (${purchases.length})`} />
        <Tab label={`Dépenses (${expenses.expenses.length})`} />
      </Tabs>

      {tab === 0 && (
        <Card sx={{ overflow: 'hidden' }}>
          {movements.length === 0 ? (
            <EmptyState icon={<AccountBalanceWallet />} title="Aucun mouvement sur cette période" description="Les paiements, entrées, dépenses et achats payés avec la caisse apparaîtront ici." />
          ) : (
            movements.map((m) => {
              const corrected = !!m.reversedBy;
              return (
                <MoneyRow
                  key={m._id}
                  direction={m.direction}
                  muted={corrected}
                  title={
                    <>
                      {m.reversalOf ? 'Correction · ' : ''}
                      {CASH_TYPE_LABELS[m.type]}
                      {m.description && m.description !== CASH_TYPE_LABELS[m.type] ? ` — ${m.description}` : ''}
                    </>
                  }
                  lines={[
                    `${formatDateTimeFr(m.occurredAt)} · ${PAYMENT_METHOD_LABELS[m.method]}${m.sourceName ? ` · ${m.sourceName}` : ''} · ${m.createdBy?.email || ''}`,
                    m.stockItems?.length ? `Stock ${m.stockItems.map((it) => `+${it.quantity} ${it.unit} ${it.name}`).join(', ')}` : '',
                    m.correctionReason ? `Raison : ${m.correctionReason}` : '',
                  ]}
                  chips={
                    <>
                      {m.replacementOf && <StatusBadge tone="info" label="Valeur corrigée" />}
                      {corrected && <StatusBadge tone="neutral" label="Corrigé" />}
                      {m.orderId && (
                        <ButtonBase onClick={() => navigate(`/admin/orders/${m.orderId}`)}>
                          <StatusBadge tone="primary" label={m.orderNumber ? `CMD-${m.orderNumber}` : 'Commande'} />
                        </ButtonBase>
                      )}
                      {m.unblockedOrders?.map((u) => (
                        <ButtonBase key={u.orderId} onClick={() => navigate(`/admin/orders/${u.orderId}`)}>
                          <StatusBadge tone={u.fully ? 'success' : 'neutral'} label={`${u.fully ? 'Débloque' : 'Aide'} CMD-${u.orderNumber}`} />
                        </ButtonBase>
                      ))}
                    </>
                  }
                  amount={`${m.direction === 'in' ? '+' : '−'}${formatDT(m.amount)}`}
                  action={
                    !m.reversalOf && !corrected && m.type !== 'expense' ? (
                      <Tooltip title="Corriger (la trace est conservée)">
                        <IconButton
                          size="small"
                          aria-label="Corriger ce mouvement"
                          onClick={() => {
                            correctOp.reset();
                            setCorrection({ amount: String(m.amount), reason: '' });
                            setCorrecting(m);
                          }}
                        >
                          <EditNote fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : null
                  }
                />
              );
            })
          )}
        </Card>
      )}

      {tab === 1 && (
        <Card sx={{ overflow: 'hidden' }}>
          {receivables.orders.length === 0 ? (
            <EmptyState tone="success" icon={<ReceiptLong />} title="Tout est encaissé" description="Les ventes pas encore payées apparaîtront ici." />
          ) : (
            receivables.orders.map((s) => (
              <MoneyRow
                key={s._id}
                direction="neutral"
                title={
                  <ButtonBase onClick={() => navigate(`/admin/orders/${s._id}`)} sx={{ fontWeight: 700, fontSize: 'inherit', textAlign: 'left' }}>
                    {s.orderRef} · {s.clientName}
                  </ButtonBase>
                }
                lines={[`${formatDateTimeFr(s.date)} · ${s.items.map((i) => `${i.recipeName}${i.sizeName ? ` ${i.sizeName}` : ''} ×${i.quantity}`).join(', ')}`]}
                chips={
                  <>
                    <OrderStatusBadge status={s.status} />
                    <PaymentStatusBadge status={s.paymentStatus} />
                    {s.clientType === 'cafe' && <StatusBadge tone="info" label="Café" />}
                  </>
                }
                amount={<span style={{ color: color.warningDark }}>reste {formatDT(s.remaining)}</span>}
                action={
                  <Box>
                    <Typography variant="caption" sx={{ color: color.inkMuted, display: 'block' }}>
                      sur {formatDT(s.totalPrice)}
                    </Typography>
                    <Button size="small" variant="contained" color="success" sx={{ mt: 0.5 }} disabled={collectOp.busy} onClick={() => collectRemaining(s)}>
                      Encaisser
                    </Button>
                  </Box>
                }
              />
            ))
          )}
        </Card>
      )}

      {tab === 2 && (
        <>
          <Typography variant="caption" sx={{ display: 'block', color: color.inkSoft, mb: 1 }}>
            Tous les achats de la période, quel que soit le moyen de paiement. Seuls ceux payés avec la caisse sont des sorties de caisse.
          </Typography>
          <Card sx={{ overflow: 'hidden' }}>
            {purchases.length === 0 ? (
              <EmptyState icon={<Inventory2 />} title="Aucun achat sur cette période" description="Les achats d’ingrédients (caisse, argent personnel, banque…) apparaîtront ici." />
            ) : (
              purchases.map((pu) => (
                <MoneyRow
                  key={pu.purchaseId}
                  direction={pu.cashOut ? 'out' : 'neutral'}
                  title={`Stock ${pu.items.map((it) => `+${it.quantity} ${it.unit} ${it.name}`).join(', ')}`}
                  lines={[`${formatDateTimeFr(pu.date)}${pu.sourceName ? ` · ${pu.sourceName}` : ''}${pu.createdBy ? ` · ${pu.createdBy}` : ''}${pu.note ? ` · ${pu.note}` : ''}`]}
                  chips={
                    <>
                      <StatusBadge tone={pu.cashOut ? 'primary' : 'neutral'} label={PURCHASE_PAYMENT_LABELS[pu.paymentMethod]} />
                      {pu.unblockedOrders.map((u) => (
                        <ButtonBase key={u.orderId} onClick={() => navigate(`/admin/orders/${u.orderId}`)}>
                          <StatusBadge tone={u.fully ? 'success' : 'neutral'} label={`${u.fully ? 'Débloque' : 'Aide'} CMD-${u.orderNumber}`} />
                        </ButtonBase>
                      ))}
                    </>
                  }
                  amount={formatDT(pu.total)}
                  action={
                    <Box>
                      <Typography variant="caption" sx={{ display: 'block', color: pu.cashOut ? color.dangerDark : color.inkMuted }}>
                        {pu.cashOut ? `Caisse −${formatDT(pu.cashOut)}` : 'Caisse inchangée'}
                      </Typography>
                      <Button
                        size="small"
                        onClick={() => {
                          methodOp.reset();
                          setNewMethod(pu.paymentMethod === 'unknown' ? 'cash_register' : pu.paymentMethod);
                          setMethodTarget(pu);
                        }}
                      >
                        Changer le paiement
                      </Button>
                    </Box>
                  }
                />
              ))
            )}
          </Card>
        </>
      )}

      {tab === 3 && (
        <>
          <Typography variant="caption" sx={{ display: 'block', color: color.inkSoft, mb: 1 }}>
            Dépenses de l’activité (hors ingrédients). Total {formatDT(expenses.total)}
            {outside > 0 ? ` · dont ${formatDT(outside)} payés hors caisse (caisse inchangée)` : ''}.
          </Typography>
          <Card sx={{ overflow: 'hidden' }}>
            {expenses.expenses.length === 0 ? (
              <EmptyState
                icon={<Remove />}
                title="Aucune dépense sur cette période"
                description="Emballages, gaz, transport… payés avec la caisse ou votre argent personnel."
                action={
                  <Button variant="outlined" color="error" startIcon={<Remove />} onClick={openExpense}>
                    Ajouter une dépense
                  </Button>
                }
              />
            ) : (
              expenses.expenses.map((e) => (
                <MoneyRow
                  key={e._id}
                  direction={e.paymentMethod === 'cash_register' ? 'out' : 'neutral'}
                  muted={e.status === 'cancelled'}
                  title={e.description}
                  lines={[`${formatDateTimeFr(e.occurredAt)}${e.createdBy?.email ? ` · ${e.createdBy.email}` : ''}`, e.status === 'cancelled' ? `Annulée : ${e.cancelReason}` : '']}
                  chips={
                    <>
                      <StatusBadge tone={e.paymentMethod === 'cash_register' ? 'danger' : 'neutral'} label={PURCHASE_PAYMENT_LABELS[e.paymentMethod]} />
                      {e.status === 'cancelled' && <StatusBadge tone="neutral" label="Annulée" />}
                    </>
                  }
                  amount={`−${formatDT(e.amount)}`}
                  action={
                    e.status === 'active' ? (
                      <Button
                        size="small"
                        color="error"
                        startIcon={<Block />}
                        onClick={() => {
                          cancelOp.reset();
                          setCancelReason('');
                          setCancelTarget(e);
                        }}
                      >
                        Annuler
                      </Button>
                    ) : null
                  }
                />
              ))
            )}
          </Card>
        </>
      )}

      {/* + Entrée / fonds de caisse */}
      <ResponsiveDialog
        open={income.open}
        onClose={() => setIncome({ ...income, open: false })}
        maxWidth="xs"
        title={income.type === 'opening_balance' ? 'Fonds de caisse' : 'Ajouter une entrée'}
        subtitle="Argent qui entre dans la caisse hors commande. Pour une commande, utilisez « Encaisser »."
        actions={
          <>
            <Button onClick={() => setIncome({ ...income, open: false })}>Annuler</Button>
            <Button variant="contained" color="success" onClick={saveIncome} disabled={!(parseFloat(income.amount) > 0) || incomeOp.busy}>
              {incomeOp.busy ? 'Enregistrement…' : 'Enregistrer l’entrée'}
            </Button>
          </>
        }
      >
        <TextField select fullWidth size="small" label="Type" value={income.type} onChange={(e) => setIncome({ ...income, type: e.target.value as IncomeType })} sx={{ mt: 1, mb: 2 }}>
          <MenuItem value="other_income">Autre entrée</MenuItem>
          <MenuItem value="opening_balance">Fonds de caisse (départ)</MenuItem>
        </TextField>
        <TextField
          fullWidth
          autoFocus
          type="number"
          label="Montant"
          value={income.amount}
          onChange={(e) => setIncome({ ...income, amount: e.target.value })}
          InputProps={{ endAdornment: <InputAdornment position="end">DT</InputAdornment> }}
          inputProps={{ min: 0, step: 0.001, inputMode: 'decimal' }}
          sx={{ mb: 2 }}
        />
        <TextField fullWidth size="small" label="Description" value={income.description} onChange={(e) => setIncome({ ...income, description: e.target.value })} sx={{ mb: 2 }} />
        <TextField select fullWidth size="small" label="Mode" value={income.method} onChange={(e) => setIncome({ ...income, method: e.target.value })} sx={{ mb: 2 }}>
          {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
            <MenuItem key={k} value={k}>
              {v}
            </MenuItem>
          ))}
        </TextField>
        <DateTimeField label="Date (vide = maintenant)" value={income.occurredAt} onChange={(v) => setIncome({ ...income, occurredAt: v })} />
      </ResponsiveDialog>

      {/* − Dépense (caisse ou hors caisse) */}
      <ResponsiveDialog
        open={expense.open}
        onClose={() => setExpense({ ...expense, open: false })}
        maxWidth="xs"
        title="Ajouter une dépense"
        subtitle="Emballages, gaz, transport… (les ingrédients sont des achats de stock)."
        actions={
          <>
            <Button onClick={() => setExpense({ ...expense, open: false })}>Annuler</Button>
            <Button variant="contained" color="error" onClick={saveExpense} disabled={!(parseFloat(expense.amount) > 0) || !expense.description.trim() || expenseOp.busy}>
              {expenseOp.busy ? 'Enregistrement…' : 'Enregistrer la dépense'}
            </Button>
          </>
        }
      >
        <TextField
          fullWidth
          autoFocus
          type="number"
          label="Montant"
          value={expense.amount}
          onChange={(e) => setExpense({ ...expense, amount: e.target.value })}
          InputProps={{ endAdornment: <InputAdornment position="end">DT</InputAdornment> }}
          inputProps={{ min: 0, step: 0.001, inputMode: 'decimal' }}
          sx={{ mt: 1, mb: 2 }}
        />
        <TextField
          fullWidth
          required
          size="small"
          label="Description"
          placeholder="ex : boîtes à gâteaux"
          value={expense.description}
          onChange={(e) => setExpense({ ...expense, description: e.target.value })}
          sx={{ mb: 2 }}
        />
        <PurchasePaymentSelect value={expense.paymentMethod} onChange={(v) => setExpense({ ...expense, paymentMethod: v })} amount={parseFloat(expense.amount) || 0} />
        <Box sx={{ mt: 2 }}>
          <DateTimeField label="Date (vide = maintenant)" value={expense.occurredAt} onChange={(v) => setExpense({ ...expense, occurredAt: v })} />
        </Box>
      </ResponsiveDialog>

      {/* Achat de stock */}
      <ResponsiveDialog
        open={purchase.open}
        onClose={() => setPurchase({ ...purchase, open: false })}
        maxWidth="xs"
        title="Achat de stock"
        subtitle="Le stock augmente et les commandes en attente de cet ingrédient sont recalculées."
        actions={
          <>
            <Button onClick={() => setPurchase({ ...purchase, open: false })}>Annuler</Button>
            <Button
              variant="contained"
              onClick={savePurchase}
              disabled={!purchase.ingredient || !(parseFloat(purchase.quantity) > 0) || !(parseFloat(purchase.unitPrice) > 0) || purchaseOp.busy}
            >
              {purchaseOp.busy ? 'Enregistrement…' : 'Enregistrer l’achat'}
            </Button>
          </>
        }
      >
        <Autocomplete
          options={ingredients}
          value={purchase.ingredient}
          onChange={(_, v) => setPurchase({ ...purchase, ingredient: v })}
          getOptionLabel={(i: any) => `${i.name} (stock ${i.stockQuantity} ${i.unit})`}
          isOptionEqualToValue={(a: any, b: any) => a._id === b._id}
          renderInput={(params) => <TextField {...params} size="small" label="Ingrédient *" />}
          sx={{ mt: 1, mb: 2 }}
        />
        <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
          <TextField
            size="small"
            type="number"
            label={`Quantité${purchase.ingredient ? ` (${purchase.ingredient.unit})` : ''} *`}
            value={purchase.quantity}
            onChange={(e) => setPurchase({ ...purchase, quantity: e.target.value })}
            inputProps={{ min: 0, step: 0.01, inputMode: 'decimal' }}
            fullWidth
          />
          <TextField
            size="small"
            type="number"
            label={`Prix payé${purchase.ingredient ? ` (DT/${purchase.ingredient.unit})` : ''} *`}
            value={purchase.unitPrice}
            onChange={(e) => setPurchase({ ...purchase, unitPrice: e.target.value })}
            inputProps={{ min: 0, step: 0.001, inputMode: 'decimal' }}
            fullWidth
          />
        </Box>
        <TextField select size="small" fullWidth label="Acheté chez" value={purchase.sourceId} onChange={(e) => setPurchase({ ...purchase, sourceId: e.target.value })}>
          <MenuItem value="">Non précisé</MenuItem>
          {sources.map((src) => (
            <MenuItem key={src._id} value={src._id}>
              {src.name}
            </MenuItem>
          ))}
        </TextField>
        <Box sx={{ mt: 2 }}>
          <PurchasePaymentSelect
            value={purchase.paymentMethod}
            onChange={(v) => setPurchase({ ...purchase, paymentMethod: v })}
            amount={(parseFloat(purchase.quantity) || 0) * (parseFloat(purchase.unitPrice) || 0)}
          />
        </Box>
      </ResponsiveDialog>

      {/* Changer le moyen de paiement d'un achat */}
      <ResponsiveDialog
        open={!!methodTarget}
        onClose={() => setMethodTarget(null)}
        maxWidth="xs"
        title="Moyen de paiement de l’achat"
        subtitle={`${methodTarget?.items.map((it) => `${it.name} ${it.quantity} ${it.unit}`).join(', ') || ''} — ${formatDT(methodTarget?.total)}. Le stock ne change pas ; la caisse est corrigée avec une trace si besoin.`}
        actions={
          <>
            <Button onClick={() => setMethodTarget(null)}>Annuler</Button>
            <Button variant="contained" onClick={changeMethod} disabled={methodOp.busy}>
              Enregistrer
            </Button>
          </>
        }
      >
        <PurchasePaymentSelect value={newMethod} onChange={setNewMethod} amount={methodTarget?.total} />
      </ResponsiveDialog>

      {/* Correction tracée */}
      <ResponsiveDialog
        open={!!correcting}
        onClose={() => setCorrecting(null)}
        maxWidth="xs"
        title="Corriger le mouvement"
        subtitle={`Le mouvement d’origine (${formatDT(correcting?.amount)}) reste visible et sera annulé par une ligne de correction. Laissez le montant vide pour simplement l’annuler.`}
        actions={
          <>
            <Button onClick={() => setCorrecting(null)}>Annuler</Button>
            <Button variant="contained" onClick={saveCorrection} disabled={!correction.reason.trim() || correctOp.busy}>
              Enregistrer la correction
            </Button>
          </>
        }
      >
        <TextField fullWidth size="small" type="number" label="Montant correct (DT)" value={correction.amount} onChange={(e) => setCorrection({ ...correction, amount: e.target.value })} sx={{ mt: 1, mb: 2 }} />
        <TextField fullWidth size="small" required label="Raison" value={correction.reason} onChange={(e) => setCorrection({ ...correction, reason: e.target.value })} />
      </ResponsiveDialog>

      {/* Annuler une dépense */}
      <ResponsiveDialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        maxWidth="xs"
        title="Annuler la dépense ?"
        subtitle={
          cancelTarget
            ? `${cancelTarget.description} — ${formatDT(cancelTarget.amount)}. ${cancelTarget.paymentMethod === 'cash_register' ? 'L’argent revient dans la caisse (correction tracée).' : 'La caisse ne change pas.'} La dépense reste visible comme annulée.`
            : ''
        }
        actions={
          <>
            <Button onClick={() => setCancelTarget(null)}>Retour</Button>
            <Button variant="contained" color="error" onClick={cancelExpense} disabled={cancelReason.trim().length < 3 || cancelOp.busy}>
              Annuler la dépense
            </Button>
          </>
        }
      >
        <TextField fullWidth required autoFocus size="small" label="Raison" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} sx={{ mt: 1 }} />
      </ResponsiveDialog>
    </Box>
  );
};

export default CashPage;
