import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api';
import {
  Container,
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  IconButton,
  Chip,
  Checkbox,
  FormControlLabel,
  Paper,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';

// Ordre logique des étapes
const STATUS_STEPS = ['pending', 'confirmed', 'paid', 'preparing', 'ready'] as const;

const statusLabels: Record<string, { label: string; color: any }> = {
  pending: { label: 'En attente', color: 'warning' },
  confirmed: { label: 'Confirmee', color: 'info' },
  preparing: { label: 'En preparation', color: 'primary' },
  ready: { label: 'Prete', color: 'success' },
  paid: { label: 'Payee', color: 'default' },
  cancelled: { label: 'Annulee', color: 'error' },
};

const OrderDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [allIngredients, setAllIngredients] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    status: string;
    label: string;
  }>({ open: false, status: '', label: '' });

  // Charger ingredients pour avoir les noms
  useEffect(() => {
    const loadIngredients = async () => {
      try {
        const res = await api.get('/ingredients');
        setAllIngredients(res.data.data?.ingredients || res.data.data || []);
      } catch {
        /* ignore */
      }
    };
    loadIngredients();
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/orders/${id}`);
      setOrder(res.data.data?.order);
    } catch {
      navigate('/admin/orders');
    }
  }, [id, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  // Trouver l'ingredient complet depuis allIngredients (source de verite pour le stock)
  const findIngredient = (ingId: any) => {
    const id = typeof ingId === 'object' ? ingId._id?.toString() : ingId?.toString();
    return allIngredients.find((i) => i._id === id) || (typeof ingId === 'object' ? ingId : null);
  };

  const getIngredientName = (ingId: any) => findIngredient(ingId)?.name || 'Ingredient';
  const getIngredientPrice = (ingId: any) => findIngredient(ingId)?.pricePerUnit || 0;
  const getIngredientStock = (ingId: any) => findIngredient(ingId)?.stockQuantity || 0;
  const getIngredientUnit = (ingId: any) => findIngredient(ingId)?.unit || '';

  // Toggle ingredient et sauvegarde auto
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
      toast.success('Prix recalcule');
    } catch {
      toast.error('Erreur lors du recalcul');
    }
    setSaving(false);
  };

  const changeStatus = async (status: string) => {
    try {
      await api.put(`/orders/${id}/status`, { status });
      await load();
      const label = statusLabels[status]?.label || status;
      if (status === 'paid') {
        toast.success(`Commande payee ! Merci ${order.clientName}`);
      } else if (status === 'ready') {
        toast.success(`Commande prete ! Appelez ${order.clientName}`);
      } else if (status === 'cancelled') {
        toast.warn('Commande annulee');
      } else {
        toast.success(`Statut : ${label}`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors du changement de statut');
    }
  };

  if (!order) return null;

  const isEditable = ['pending', 'confirmed', 'paid'].includes(order.status);
  const isTerminal = ['ready', 'cancelled'].includes(order.status);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#fafafa' }}>
      <Box sx={{ bgcolor: 'white', borderBottom: '1px solid #eee', py: 2, px: 3 }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={() => navigate('/admin/orders')}>
              <ArrowBack />
            </IconButton>
            <Typography
              variant="h5"
              sx={{ fontWeight: 600, fontSize: { xs: '1rem', sm: '1.25rem', md: '1.5rem' } }}
            >
              Commande de {order.clientName}
            </Typography>
            <Chip
              label={statusLabels[order.status]?.label || order.status}
              color={statusLabels[order.status]?.color || 'default'}
            />
            {saving && <Chip label="Recalcul..." size="small" color="info" />}
          </Box>
        </Container>
      </Box>

      {/* Bandeau statut terminal */}
      {order.status === 'ready' && (
        <Box
          sx={{
            bgcolor: '#e8f5e9',
            borderBottom: '2px solid #4caf50',
            py: 1.5,
            px: 3,
            textAlign: 'center',
          }}
        >
          <Typography variant="body1" sx={{ fontWeight: 600, color: '#2e7d32' }}>
            Commande prete — {order.totalPrice?.toFixed(2)} DT — Appelez {order.clientName} !
          </Typography>
        </Box>
      )}
      {order.status === 'cancelled' && (
        <Box
          sx={{
            bgcolor: '#ffebee',
            borderBottom: '2px solid #ef5350',
            py: 1.5,
            px: 3,
            textAlign: 'center',
          }}
        >
          <Typography variant="body1" sx={{ fontWeight: 600, color: '#c62828' }}>
            Commande annulee
          </Typography>
        </Box>
      )}

      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Grid container spacing={3}>
          {/* Info client */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Client
                </Typography>
                <Typography>
                  <strong>Nom :</strong> {order.clientName}
                </Typography>
                <Typography>
                  <strong>Tel :</strong> {order.clientPhone}
                </Typography>
                {order.notes && (
                  <Typography sx={{ mt: 1 }}>
                    <strong>Notes :</strong> {order.notes}
                  </Typography>
                )}
                <Typography sx={{ mt: 1 }}>
                  <strong>Commande le :</strong> {new Date(order.createdAt).toLocaleString('fr-TN')}
                </Typography>

                {/* Rendez-vous */}
                {order.requestedDate && (
                  <Paper
                    variant="outlined"
                    sx={{ p: 1.5, mt: 2, bgcolor: '#fff3e0', borderColor: '#ffb74d' }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#e65100' }}>
                      RDV souhaite par le client :
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {new Date(order.requestedDate).toLocaleString('fr-TN', {
                        dateStyle: 'full',
                        timeStyle: 'short',
                      })}
                    </Typography>
                  </Paper>
                )}

                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 600 }}>
                    Date confirmee :
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    type="datetime-local"
                    disabled={isTerminal}
                    value={
                      order.confirmedDate
                        ? new Date(order.confirmedDate).toISOString().slice(0, 16)
                        : ''
                    }
                    InputLabelProps={{ shrink: true }}
                    onChange={async (e) => {
                      try {
                        await api.put(`/orders/${id}`, { confirmedDate: e.target.value || null });
                        await load();
                        toast.success(e.target.value ? 'Date confirmee' : 'Date retiree');
                      } catch {
                        toast.error('Erreur');
                      }
                    }}
                  />
                  {order.confirmedDate && (
                    <Chip label="Confirme" color="success" size="small" sx={{ mt: 0.5 }} />
                  )}
                </Box>

                {/* Etapes de la commande */}
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                    Progression :
                  </Typography>
                  <Stepper
                    activeStep={STATUS_STEPS.indexOf(order.status as any)}
                    orientation="vertical"
                    sx={{ '& .MuiStepLabel-label': { fontSize: '0.8rem' } }}
                  >
                    {STATUS_STEPS.map((s) => (
                      <Step
                        key={s}
                        completed={STATUS_STEPS.indexOf(order.status) > STATUS_STEPS.indexOf(s)}
                      >
                        <StepLabel
                          sx={{
                            cursor: s !== order.status ? 'pointer' : 'default',
                            '&:hover': s !== order.status ? { bgcolor: '#f5f5f5' } : {},
                          }}
                          onClick={() => {
                            if (s !== order.status) {
                              setConfirmDialog({
                                open: true,
                                status: s,
                                label: statusLabels[s]?.label || s,
                              });
                            }
                          }}
                        >
                          {statusLabels[s]?.label || s}
                        </StepLabel>
                      </Step>
                    ))}
                  </Stepper>
                  {order.status !== 'cancelled' && (
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      fullWidth
                      sx={{ mt: 2 }}
                      onClick={() =>
                        setConfirmDialog({ open: true, status: 'cancelled', label: 'Annulee' })
                      }
                    >
                      Annuler la commande
                    </Button>
                  )}
                  {order.status === 'cancelled' && (
                    <Button
                      size="small"
                      color="primary"
                      variant="outlined"
                      fullWidth
                      sx={{ mt: 2 }}
                      onClick={() =>
                        setConfirmDialog({ open: true, status: 'pending', label: 'En attente' })
                      }
                    >
                      Reactiver la commande
                    </Button>
                  )}
                </Box>

                {/* Contact rapide */}
                <Box sx={{ mt: 3 }}>
                  <Button
                    variant="outlined"
                    fullWidth
                    size="small"
                    href={`https://wa.me/${order.clientPhone?.replace('+', '')}`}
                    target="_blank"
                    sx={{ mb: 1 }}
                  >
                    Contacter sur WhatsApp
                  </Button>
                  <Button
                    variant="outlined"
                    fullWidth
                    size="small"
                    href={`tel:${order.clientPhone}`}
                  >
                    Appeler
                  </Button>
                </Box>
              </CardContent>
            </Card>

            {/* Bouton Ingrédients prêts — visible quand payée, avant preparation */}
            {order.status === 'paid' && (
              <Card sx={{ mt: 2, border: '2px solid #ff9800' }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                    Lancer la preparation ?
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Verifiez les ingredients a droite, puis confirmez. Le stock sera deduit
                    automatiquement.
                  </Typography>
                  <Button
                    variant="contained"
                    color="success"
                    fullWidth
                    onClick={async () => {
                      try {
                        await api.put(`/orders/${id}`, { ingredientsReady: true });
                        await load();
                        toast.success('Preparation lancee ! Stock deduit.');
                      } catch (err: any) {
                        toast.error(err.response?.data?.message || 'Erreur');
                      }
                    }}
                  >
                    Ingredients prets — Lancer la preparation
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Indicateur si en preparation */}
            {order.status === 'preparing' && (
              <Card sx={{ mt: 2, border: '2px solid #4caf50', bgcolor: '#e8f5e9' }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#2e7d32' }}>
                    En cours de preparation
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Stock deduit. Marquez "Prete" quand c'est fini.
                  </Typography>
                </CardContent>
              </Card>
            )}
          </Grid>

          {/* Articles */}
          <Grid item xs={12} md={8}>
            {order.items.map((item: any, itemIndex: number) => {
              const recipe = item.recipeId;
              const recipeName = recipe && typeof recipe === 'object' ? recipe.name : 'Recette';
              const variant =
                recipe && typeof recipe === 'object' ? recipe.variants?.[item.variantIndex] : null;

              return (
                <Card key={itemIndex} sx={{ mb: 2 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {recipeName} x{item.quantity}
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
                        sx={{ p: 1.5, mb: 2, bgcolor: '#e3f2fd', borderColor: '#90caf9' }}
                      >
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1565c0' }}>
                          Le client propose de ramener :
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
                        ? 'Confirmer les ingredients que le client ramene :'
                        : 'Ingredients :'}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 2 }}>
                      {variant?.ingredients?.map((vi: any) => {
                        const ingRef = vi.ingredientId;
                        const ingId = typeof ingRef === 'object' ? ingRef._id : ingRef;
                        const ingName = getIngredientName(ingRef);
                        const ingPrice = getIngredientPrice(ingRef);
                        const stock = getIngredientStock(ingRef);
                        const stockUnit = getIngredientUnit(ingRef);
                        const isProvided = (item.clientProvidedIngredients || []).includes(ingId);
                        const isOfferedByClient = (item.clientOfferedIngredients || []).includes(
                          ingId
                        );
                        const cost = vi.quantity * ingPrice;
                        const hasEnough = stock >= vi.quantity;

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
                                      : ' (ajoute par Mariem)'
                                    : isOfferedByClient
                                      ? ' (propose par client — non confirme)'
                                      : cost > 0
                                        ? ` → ${cost.toFixed(3)} DT`
                                        : ''}
                                </Typography>
                              }
                            />
                            {isOfferedByClient && (
                              <Chip
                                size="small"
                                label="Propose"
                                color={isProvided ? 'info' : 'warning'}
                                variant={isProvided ? 'filled' : 'outlined'}
                                sx={{ fontSize: '0.7rem', height: 22 }}
                              />
                            )}
                            {isProvided && !isOfferedByClient && (
                              <Chip
                                size="small"
                                label="Mariem"
                                color="secondary"
                                variant="outlined"
                                sx={{ fontSize: '0.7rem', height: 22 }}
                              />
                            )}
                            {!isProvided && !isOfferedByClient && (
                              <Chip
                                size="small"
                                label={
                                  hasEnough
                                    ? `Stock: ${stock} ${stockUnit}`
                                    : stock > 0
                                      ? `Stock: ${stock}/${vi.quantity} ${stockUnit}`
                                      : 'Pas en stock'
                                }
                                color={hasEnough ? 'success' : stock > 0 ? 'warning' : 'error'}
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
                      <TableContainer
                        component={Paper}
                        variant="outlined"
                        sx={{ overflowX: 'auto' }}
                      >
                        <Table size="small">
                          <TableBody>
                            <TableRow>
                              <TableCell>Ingredients</TableCell>
                              <TableCell align="right">
                                {item.calculatedPrice.ingredientsCost?.toFixed(2)} DT
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>Electricite</TableCell>
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
                            <TableRow sx={{ bgcolor: '#fff3e0' }}>
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
                  </CardContent>
                </Card>
              );
            })}

            {/* Total global */}
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    Total
                  </Typography>
                  <Typography variant="h5" color="primary.main" sx={{ fontWeight: 700 }}>
                    {order.totalPrice?.toFixed(2)} DT
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>

      {/* Dialog de confirmation changement de statut */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}
      >
        <DialogTitle>Confirmer le changement</DialogTitle>
        <DialogContent>
          <Typography>
            Changer le statut de <strong>{statusLabels[order?.status]?.label}</strong> vers{' '}
            <strong>{confirmDialog.label}</strong> ?
          </Typography>
          {confirmDialog.status === 'cancelled' && (
            <Typography color="error" sx={{ mt: 1 }}>
              La commande sera annulee. Vous pourrez la reactiver plus tard.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}>
            Non, annuler
          </Button>
          <Button
            variant="contained"
            color={confirmDialog.status === 'cancelled' ? 'error' : 'primary'}
            onClick={async () => {
              setConfirmDialog({ ...confirmDialog, open: false });
              await changeStatus(confirmDialog.status);
            }}
          >
            Oui, confirmer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OrderDetailPage;
