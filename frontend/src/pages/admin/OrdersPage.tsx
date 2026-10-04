import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
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
  Button,
  ButtonBase,
  Collapse,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Search, Add, ReceiptLong, EventNote, CheckCircle, WarningAmber } from '@mui/icons-material';
import PeriodFilter, { Range } from '../../components/admin/PeriodFilter';
import { orderRef, formatDT } from '../../utils/format';
import {
  EmptyState,
  FilterChips,
  OrderStatusBadge,
  PageHeader,
  PaymentStatusBadge,
  SkeletonRows,
  StatusBadge,
} from '../../components/ui';
import { color, radius } from '../../theme/tokens';

const PAGE_SIZE = 30;

const STATUS_FILTERS = [
  { value: '', label: 'Toutes' },
  { value: 'pending', label: 'En attente' },
  { value: 'confirmed', label: 'Confirmées' },
  { value: 'preparing', label: 'En préparation' },
  { value: 'ready', label: 'Prêtes' },
  { value: 'delivered', label: 'Remises' },
  { value: 'cancelled', label: 'Annulées' },
];
const PAYMENT_FILTERS = [
  { value: '', label: 'Tout paiement' },
  { value: 'unpaid', label: 'Non payé' },
  { value: 'partial', label: 'Partiel' },
  { value: 'paid', label: 'Payé' },
];
const CLIENT_FILTERS = [
  { value: '', label: 'Tous clients' },
  { value: 'individual', label: 'Particuliers' },
  { value: 'cafe', label: 'Cafés' },
];
const ACTIVE = ['pending', 'confirmed', 'paid'];

type StockAlert = { missingCount: number; ingredients: string[] };

const when = (d?: string | null) =>
  d
    ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—';

const itemsSummary = (o: any) =>
  (o.items || [])
    .map((it: any) => `${it.quantity}× ${it.recipeId?.name || 'Recette'}`)
    .join(', ');

/** État des ingrédients d'une commande pas encore préparée. */
function StockState({ order, alert, preparable }: { order: any; alert?: StockAlert; preparable?: boolean }) {
  if (!ACTIVE.includes(order.status)) return <Typography variant="body2" sx={{ color: color.inkMuted }}>—</Typography>;
  if (alert)
    return (
      <StatusBadge
        tone="danger"
        icon={<WarningAmber />}
        label={`Manque : ${alert.ingredients.slice(0, 2).join(', ')}${alert.ingredients.length > 2 ? '…' : ''}`}
      />
    );
  if (preparable === false) return <StatusBadge tone="warning" label="À vérifier" />;
  return <StatusBadge tone="success" icon={<CheckCircle />} label="Ingrédients OK" />;
}

const OrdersPage = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [orders, setOrders] = useState<any[] | null>(null);
  const [stockAlerts, setStockAlerts] = useState<Record<string, StockAlert>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [searchName, setSearchName] = useState(searchParams.get('search') || '');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [clientType, setClientType] = useState('');
  // Période reçue par lien (ex : Statistiques → commandes vendues d'un jour)
  const urlRange =
    searchParams.get('from') && searchParams.get('to')
      ? { from: searchParams.get('from')!, to: searchParams.get('to')! }
      : null;
  const [withDates, setWithDates] = useState(!!urlRange);
  const [range, setRange] = useState<Range | null>(urlRange);
  const [dateField, setDateField] = useState<'created' | 'scheduled'>(
    searchParams.get('dateField') === 'scheduled' ? 'scheduled' : 'created'
  );
  const [preparableMap, setPreparableMap] = useState<Record<string, boolean>>({});

  // Historique : filtres appliqués côté serveur (toutes les commandes)
  const load = async (nextPage = 1) => {
    try {
      const res = await api.get('/orders', {
        params: {
          page: nextPage,
          limit: PAGE_SIZE,
          status: statusFilter || undefined,
          search: searchName.trim() || undefined,
          paymentStatus: paymentFilter || undefined,
          clientType: clientType || undefined,
          ...(withDates && range ? { ...range, dateField } : {}),
        },
      });
      const data = res.data.data;
      setOrders((prev) => (nextPage === 1 || !prev ? data.orders : [...prev, ...data.orders]));
      setStockAlerts((prev) => (nextPage === 1 ? data.stockAlerts || {} : { ...prev, ...(data.stockAlerts || {}) }));
      setCounts(data.counts || {});
      setTotal(data.pagination?.total || 0);
      setPage(nextPage);
    } catch {
      setOrders((prev) => prev || []);
    }
  };

  useEffect(() => {
    api
      .get('/orders/check-preparable')
      .then((res) => {
        const map: Record<string, boolean> = {};
        (res.data.data || []).forEach((d: any) => (map[d.orderId] = d.preparable));
        setPreparableMap(map);
      })
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => load(1), 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, searchName, paymentFilter, clientType, withDates, range, dateField]);

  const allCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const countOf = (v: string) =>
    v === '' ? allCount : v === 'confirmed' ? (counts.confirmed || 0) + (counts.paid || 0) : counts[v] || 0;
  const blockedCount = Object.keys(stockAlerts).length;
  const open = (id: string) => navigate(`/admin/orders/${id}`);

  return (
    <Box>
      <PageHeader
        title="Commandes"
        subtitle="Avancement, paiement et ingrédients de chaque commande"
        icon={<ReceiptLong />}
        tone="rose"
        helpTour="understand-missing"
        helpFlow="order-check"
        actions={
          <Button data-tour="orders-new" variant="contained" startIcon={<Add />} onClick={() => navigate('/admin/orders/new')}>
            Nouvelle commande
          </Button>
        }
      />

      <Card data-tour="orders-filters" sx={{ p: { xs: 1.5, md: 2 }, mb: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 1.5, alignItems: { md: 'center' }, mb: 1.5 }}>
          <TextField
            size="small"
            placeholder="Client, téléphone ou CMD-12…"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            inputProps={{ 'aria-label': 'Rechercher une commande' }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{ width: { xs: '100%', md: 300 } }}
          />
          <Box sx={{ flex: 1 }} />
          {blockedCount > 0 && (
            <StatusBadge tone="danger" icon={<WarningAmber />} label={`${blockedCount} bloquée${blockedCount > 1 ? 's' : ''} (ingrédient manquant)`} size="medium" />
          )}
        </Box>
        <FilterChips
          ariaLabel="Avancement"
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_FILTERS.map((f) => ({ ...f, count: countOf(f.value) }))}
        />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1, md: 2.5 }, mt: 1.5, alignItems: 'center' }}>
          <FilterChips ariaLabel="Paiement" value={paymentFilter} onChange={setPaymentFilter} options={PAYMENT_FILTERS} />
          <FilterChips ariaLabel="Type de client" value={clientType} onChange={setClientType} options={CLIENT_FILTERS} />
          <Button size="small" startIcon={<EventNote />} variant={withDates ? 'contained' : 'outlined'} onClick={() => setWithDates(!withDates)}>
            {withDates ? 'Filtre date actif' : 'Filtrer par date'}
          </Button>
        </Box>
        <Collapse in={withDates} unmountOnExit>
          <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px dashed ${color.borderStrong}` }}>
            <FilterChips
              ariaLabel="Date utilisée"
              value={dateField}
              onChange={(v) => setDateField(v as 'created' | 'scheduled')}
              options={[
                { value: 'created', label: 'Date de commande' },
                { value: 'scheduled', label: 'Date prévue' },
              ]}
            />
            <Box sx={{ mt: 1.5 }}>
              <PeriodFilter onChange={setRange} initial="month" initialRange={urlRange} />
            </Box>
          </Box>
        </Collapse>
      </Card>

      <Box data-tour="orders-list">
        {orders === null ? (
          <SkeletonRows rows={6} />
        ) : orders.length === 0 ? (
          <Card>
            <EmptyState
              icon={<ReceiptLong />}
              tone="rose"
              title={searchName || statusFilter || paymentFilter || clientType ? 'Aucune commande trouvée' : 'Aucune commande pour le moment'}
              description="Les commandes reçues du site ou saisies à la main apparaissent ici."
              action={
                <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/admin/orders/new')}>
                  Nouvelle commande
                </Button>
              }
            />
          </Card>
        ) : isMobile ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {orders.map((order) => {
              const alert = stockAlerts[order._id];
              return (
                <ButtonBase
                  key={order._id}
                  onClick={() => open(order._id)}
                  sx={{
                    display: 'block',
                    textAlign: 'left',
                    p: 1.75,
                    borderRadius: `${radius.lg}px`,
                    bgcolor: color.surface,
                    border: `1px solid ${alert ? color.dangerBorder : color.border}`,
                    borderLeft: `4px solid ${alert ? color.danger : color.border}`,
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'flex-start' }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 800 }} noWrap>
                        {order.clientName}
                        {order.clientId?.type === 'cafe' && (
                          <Box component="span" sx={{ ml: 0.75 }}>
                            <StatusBadge tone="info" label="Café" />
                          </Box>
                        )}
                      </Typography>
                      <Typography variant="caption" sx={{ color: color.inkSoft }}>
                        {orderRef(order)} · prévue {when(order.confirmedDate || order.requestedDate)}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}>{formatDT(order.totalPrice)}</Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: color.inkSoft, mt: 0.5 }} noWrap>
                    {itemsSummary(order)}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1 }}>
                    <OrderStatusBadge status={order.status} />
                    <PaymentStatusBadge status={order.paymentStatus} />
                    {ACTIVE.includes(order.status) && <StockState order={order} alert={alert} preparable={preparableMap[order._id]} />}
                  </Box>
                </ButtonBase>
              );
            })}
          </Box>
        ) : (
          <TableContainer component={Card} sx={{ overflowX: 'auto' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Commande</TableCell>
                  <TableCell>Client</TableCell>
                  <TableCell>Produits</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell>Avancement</TableCell>
                  <TableCell>Paiement</TableCell>
                  <TableCell>Ingrédients</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.map((order) => {
                  const alert = stockAlerts[order._id];
                  return (
                    <TableRow
                      key={order._id}
                      hover
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && open(order._id)}
                      onClick={() => open(order._id)}
                      sx={{
                        cursor: 'pointer',
                        '& td:first-of-type': { boxShadow: alert ? `inset 4px 0 0 ${color.danger}` : 'none' },
                        bgcolor: alert ? color.dangerSoft : undefined,
                      }}
                    >
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography sx={{ fontWeight: 800, fontSize: '0.9rem' }}>{orderRef(order)}</Typography>
                        <Typography variant="caption" sx={{ color: color.inkSoft }}>
                          prévue {when(order.confirmedDate || order.requestedDate)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
                          {order.clientName}{' '}
                          {order.clientId?.type === 'cafe' && <StatusBadge tone="info" label="Café" />}
                        </Typography>
                        <Typography variant="caption" sx={{ color: color.inkSoft }}>
                          {order.clientPhone}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 240 }}>
                        <Typography variant="body2" noWrap title={itemsSummary(order)}>
                          {itemsSummary(order)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}>
                        {formatDT(order.totalPrice)}
                      </TableCell>
                      <TableCell>
                        <OrderStatusBadge status={order.status} />
                      </TableCell>
                      <TableCell>
                        <PaymentStatusBadge status={order.paymentStatus} />
                      </TableCell>
                      <TableCell>
                        <StockState order={order} alert={alert} preparable={preparableMap[order._id]} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {orders && orders.length > 0 && (
        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            {orders.length} commande{orders.length > 1 ? 's' : ''} affichée{orders.length > 1 ? 's' : ''} sur {total}
          </Typography>
          {orders.length < total && (
            <Button variant="outlined" onClick={() => load(page + 1)}>
              Charger plus
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
};

export default OrdersPage;
