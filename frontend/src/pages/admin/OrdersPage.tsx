import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
  Container,
  Typography,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  TextField,
  InputAdornment,
  Tooltip,
  Button,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { ArrowBack, Visibility, Search, CheckCircle, Cancel, Add } from '@mui/icons-material';

const statusLabels: Record<string, { label: string; color: any }> = {
  pending: { label: 'En attente', color: 'warning' },
  confirmed: { label: 'Confirmee', color: 'info' },
  preparing: { label: 'En preparation', color: 'primary' },
  ready: { label: 'Prete', color: 'success' },
  paid: { label: 'Payee', color: 'default' },
  cancelled: { label: 'Annulee', color: 'error' },
};

const OrdersPage = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [orders, setOrders] = useState<any[]>([]);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchName, setSearchName] = useState('');
  const [preparableMap, setPreparableMap] = useState<
    Record<string, { preparable: boolean; missingItems: string[] }>
  >({});

  const loadAll = async () => {
    try {
      const res = await api.get('/orders');
      setAllOrders(res.data.data?.orders || []);
    } catch {
      /* ignore */
    }
  };

  const load = async () => {
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const res = await api.get(`/orders${params}`);
      setOrders(res.data.data?.orders || []);
    } catch {
      /* ignore */
    }
  };

  const loadPreparable = async () => {
    try {
      const res = await api.get('/orders/check-preparable');
      const data = res.data.data || [];
      const map: Record<string, any> = {};
      data.forEach((d: any) => {
        map[d.orderId] = { preparable: d.preparable, missingItems: d.missingItems };
      });
      setPreparableMap(map);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    loadAll();
    loadPreparable();
  }, []);
  useEffect(() => {
    load();
  }, [statusFilter]);

  const statusCounts: Record<string, number> = {};
  for (const key of Object.keys(statusLabels)) {
    statusCounts[key] = allOrders.filter((o) => o.status === key).length;
  }

  const filteredOrders = orders.filter((o) =>
    o.clientName?.toLowerCase().includes(searchName.toLowerCase())
  );

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString('fr-TN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#fafafa' }}>
      <Box sx={{ bgcolor: 'white', borderBottom: '1px solid #eee', py: 2, px: 3 }}>
        <Container maxWidth="lg">
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'stretch', sm: 'center' },
              gap: 1,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconButton onClick={() => navigate('/admin')}>
                <ArrowBack />
              </IconButton>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                Commandes
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <TextField
                size="small"
                placeholder="Rechercher par nom..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
                sx={{ width: { xs: '100%', sm: 200 } }}
              />
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => navigate('/admin/orders/new')}
                sx={{ whiteSpace: 'nowrap' }}
              >
                Commande manuelle
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 3 }}>
        {/* Filtres par statut */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Chip
            label={`Toutes (${allOrders.length})`}
            color={statusFilter === '' ? 'primary' : 'default'}
            variant={statusFilter === '' ? 'filled' : 'outlined'}
            onClick={() => setStatusFilter('')}
            clickable
          />
          {Object.entries(statusLabels).map(([key, { label, color }]) => (
            <Chip
              key={key}
              label={`${label} (${statusCounts[key] || 0})`}
              color={statusFilter === key ? color : 'default'}
              variant={statusFilter === key ? 'filled' : 'outlined'}
              onClick={() => setStatusFilter(key)}
              clickable
            />
          ))}
        </Box>

        {isMobile ? (
          /* ── Mobile: stacked cards ── */
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {filteredOrders.map((order) => {
              const prep = preparableMap[order._id];
              const showPrep = ['pending', 'confirmed'].includes(order.status);

              return (
                <Card key={order._id} variant="outlined">
                  <CardActionArea onClick={() => navigate(`/admin/orders/${order._id}`)}>
                    <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                      {/* Row 1: name + status */}
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          mb: 0.5,
                        }}
                      >
                        <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>
                          {order.clientName}
                        </Typography>
                        <Chip
                          label={statusLabels[order.status]?.label || order.status}
                          color={statusLabels[order.status]?.color || 'default'}
                          size="small"
                        />
                      </Box>

                      {/* Row 2: phone + preparable icon */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="body2" color="text.secondary">
                          {order.clientPhone}
                        </Typography>
                        {showPrep &&
                          prep &&
                          (prep.preparable ? (
                            <Tooltip title="Stock suffisant — prete a preparer">
                              <CheckCircle sx={{ color: 'success.main', fontSize: 18 }} />
                            </Tooltip>
                          ) : (
                            <Tooltip title={`Manque: ${prep.missingItems.join(', ')}`}>
                              <Cancel sx={{ color: 'error.main', fontSize: 18 }} />
                            </Tooltip>
                          ))}
                      </Box>

                      {/* Row 3: total, items count, date */}
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <Typography sx={{ fontWeight: 600, color: 'primary.main' }}>
                          {order.totalPrice?.toFixed(2)} DT
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {order.items?.length || 0} article
                          {(order.items?.length || 0) !== 1 ? 's' : ''}
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          {formatDate(order.createdAt)}
                        </Typography>
                      </Box>
                    </CardContent>
                  </CardActionArea>
                </Card>
              );
            })}
            {filteredOrders.length === 0 && (
              <Typography sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                {searchName ? 'Aucune commande trouvee pour ce nom' : 'Aucune commande'}
              </Typography>
            )}
          </Box>
        ) : (
          /* ── Desktop: table ── */
          <TableContainer component={Card} sx={{ overflowX: 'auto' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Client</TableCell>
                  <TableCell>Telephone</TableCell>
                  <TableCell>Articles</TableCell>
                  <TableCell>Total</TableCell>
                  <TableCell>Statut</TableCell>
                  <TableCell align="center">Pret ?</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredOrders.map((order) => {
                  const prep = preparableMap[order._id];
                  const showPrep = ['pending', 'confirmed'].includes(order.status);

                  return (
                    <TableRow key={order._id}>
                      <TableCell sx={{ fontSize: '0.85rem' }}>
                        {formatDate(order.createdAt)}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{order.clientName}</TableCell>
                      <TableCell>{order.clientPhone}</TableCell>
                      <TableCell>{order.items?.length || 0}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {order.totalPrice?.toFixed(2)} DT
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={statusLabels[order.status]?.label || order.status}
                          color={statusLabels[order.status]?.color || 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        {showPrep && prep ? (
                          prep.preparable ? (
                            <Tooltip title="Stock suffisant — prete a preparer">
                              <CheckCircle sx={{ color: 'success.main' }} />
                            </Tooltip>
                          ) : (
                            <Tooltip title={`Manque: ${prep.missingItems.join(', ')}`}>
                              <Cancel sx={{ color: 'error.main' }} />
                            </Tooltip>
                          )
                        ) : (
                          <Typography variant="body2" color="text.disabled">
                            —
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/admin/orders/${order._id}`)}
                        >
                          <Visibility fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredOrders.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}
                    >
                      {searchName ? 'Aucune commande trouvee pour ce nom' : 'Aucune commande'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Container>
    </Box>
  );
};

export default OrdersPage;
