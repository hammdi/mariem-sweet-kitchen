import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../services/api'
import {
  Container, Typography, Box, Button, Card, CardContent, Grid,
  Table, TableBody, TableCell, TableContainer, TableRow,
  IconButton, Chip, Checkbox, FormControlLabel, Paper,
  FormControl, Select, MenuItem,
} from '@mui/material'
import { ArrowBack } from '@mui/icons-material'

const statusLabels: Record<string, { label: string; color: any }> = {
  pending: { label: 'En attente', color: 'warning' },
  confirmed: { label: 'Confirmee', color: 'info' },
  preparing: { label: 'En preparation', color: 'primary' },
  ready: { label: 'Prete', color: 'success' },
  paid: { label: 'Payee', color: 'default' },
  cancelled: { label: 'Annulee', color: 'error' },
}

const OrderDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState<any>(null)
  const [allIngredients, setAllIngredients] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  // Charger ingredients pour avoir les noms
  useEffect(() => {
    const loadIngredients = async () => {
      try {
        const res = await api.get('/ingredients')
        setAllIngredients(res.data.data?.ingredients || res.data.data || [])
      } catch { /* ignore */ }
    }
    loadIngredients()
  }, [])

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/orders/${id}`)
      setOrder(res.data.data?.order)
    } catch { navigate('/admin/orders') }
  }, [id, navigate])

  useEffect(() => { load() }, [load])

  // Trouver l'ingredient complet depuis allIngredients (source de verite pour le stock)
  const findIngredient = (ingId: any) => {
    const id = typeof ingId === 'object' ? ingId._id?.toString() : ingId?.toString()
    return allIngredients.find(i => i._id === id) || (typeof ingId === 'object' ? ingId : null)
  }

  const getIngredientName = (ingId: any) => findIngredient(ingId)?.name || 'Ingredient'
  const getIngredientPrice = (ingId: any) => findIngredient(ingId)?.pricePerUnit || 0
  const getIngredientStock = (ingId: any) => findIngredient(ingId)?.stockQuantity || 0
  const getIngredientUnit = (ingId: any) => findIngredient(ingId)?.unit || ''

  // Toggle ingredient et sauvegarde auto
  const toggleIngredient = async (itemIndex: number, ingredientId: string) => {
    if (!order || saving) return
    setSaving(true)

    const item = order.items[itemIndex]
    const provided = [...(item.clientProvidedIngredients || [])]
    const idx = provided.indexOf(ingredientId)
    if (idx >= 0) provided.splice(idx, 1)
    else provided.push(ingredientId)

    try {
      const updates = order.items.map((_: any, i: number) => ({
        index: i,
        clientProvidedIngredients: i === itemIndex ? provided : (order.items[i].clientProvidedIngredients || []),
      }))
      await api.put(`/orders/${id}`, { items: updates })
      await load()
      toast.success('Prix recalcule')
    } catch {
      toast.error('Erreur lors du recalcul')
    }
    setSaving(false)
  }

  const changeStatus = async (status: string) => {
    try {
      await api.put(`/orders/${id}/status`, { status })
      await load()
      toast.success(`Statut change : ${statusLabels[status]?.label || status}`)
    } catch {
      toast.error('Erreur lors du changement de statut')
    }
  }

  if (!order) return null

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#fafafa' }}>
      <Box sx={{ bgcolor: 'white', borderBottom: '1px solid #eee', py: 2, px: 3 }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={() => navigate('/admin/orders')}><ArrowBack /></IconButton>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
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

      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Grid container spacing={3}>
          {/* Info client */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Client</Typography>
                <Typography><strong>Nom :</strong> {order.clientName}</Typography>
                <Typography><strong>Tel :</strong> {order.clientPhone}</Typography>
                {order.notes && <Typography sx={{ mt: 1 }}><strong>Notes :</strong> {order.notes}</Typography>}
                <Typography sx={{ mt: 1 }}><strong>Date :</strong> {new Date(order.createdAt).toLocaleString('fr-TN')}</Typography>

                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Changer le statut :</Typography>
                  <FormControl fullWidth size="small">
                    <Select value={order.status} onChange={e => changeStatus(e.target.value)}>
                      {Object.entries(statusLabels).map(([k, v]) => (
                        <MenuItem key={k} value={k}>{v.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>

                {/* Contact rapide */}
                <Box sx={{ mt: 3 }}>
                  <Button
                    variant="outlined" fullWidth size="small"
                    href={`https://wa.me/${order.clientPhone?.replace('+', '')}`}
                    target="_blank"
                    sx={{ mb: 1 }}
                  >
                    Contacter sur WhatsApp
                  </Button>
                  <Button
                    variant="outlined" fullWidth size="small"
                    href={`tel:${order.clientPhone}`}
                  >
                    Appeler
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Articles */}
          <Grid item xs={12} md={8}>
            {order.items.map((item: any, itemIndex: number) => {
              const recipe = item.recipeId
              const recipeName = recipe && typeof recipe === 'object' ? recipe.name : 'Recette'
              const variant = recipe && typeof recipe === 'object' ? recipe.variants?.[item.variantIndex] : null

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
                      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: '#e3f2fd', borderColor: '#90caf9' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1565c0' }}>Le client propose de ramener :</Typography>
                        {item.clientOfferedIngredients.map((offId: string) => {
                          const name = getIngredientName(offId)
                          return <Typography variant="body2" key={offId}>• {name}</Typography>
                        })}
                      </Paper>
                    )}

                    {/* Ingredients avec checkbox — sauvegarde auto */}
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Confirmer les ingredients que le client ramene :
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 2 }}>
                      {variant?.ingredients?.map((vi: any) => {
                        const ingRef = vi.ingredientId
                        const ingId = typeof ingRef === 'object' ? ingRef._id : ingRef
                        const ingName = getIngredientName(ingRef)
                        const ingPrice = getIngredientPrice(ingRef)
                        const stock = getIngredientStock(ingRef)
                        const stockUnit = getIngredientUnit(ingRef)
                        const isProvided = (item.clientProvidedIngredients || []).includes(ingId)
                        const isOfferedByClient = (item.clientOfferedIngredients || []).includes(ingId)
                        const cost = vi.quantity * ingPrice
                        const hasEnough = stock >= vi.quantity

                        return (
                          <Box key={ingId} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <FormControlLabel
                              sx={{ flex: 1 }}
                              control={
                                <Checkbox
                                  checked={isProvided}
                                  onChange={() => toggleIngredient(itemIndex, ingId)}
                                  disabled={saving}
                                />
                              }
                              label={
                                <Typography variant="body2"
                                  sx={{
                                    textDecoration: isProvided ? 'line-through' : 'none',
                                    color: isProvided ? 'text.disabled' : 'text.primary',
                                  }}
                                >
                                  {ingName} — {vi.quantity} {vi.unit}
                                  {isProvided
                                    ? isOfferedByClient ? ' (client fournit)' : ' (ajoute par Mariem)'
                                    : isOfferedByClient ? ' (propose par client — non confirme)'
                                    : cost > 0 ? ` → ${cost.toFixed(3)} DT` : ''
                                  }
                                </Typography>
                              }
                            />
                            {isOfferedByClient && (
                              <Chip size="small" label="Propose" color={isProvided ? 'info' : 'warning'}
                                variant={isProvided ? 'filled' : 'outlined'}
                                sx={{ fontSize: '0.7rem', height: 22 }}
                              />
                            )}
                            {isProvided && !isOfferedByClient && (
                              <Chip size="small" label="Mariem" color="secondary" variant="outlined"
                                sx={{ fontSize: '0.7rem', height: 22 }}
                              />
                            )}
                            {!isProvided && !isOfferedByClient && (
                              <Chip
                                size="small"
                                label={hasEnough ? `Stock: ${stock} ${stockUnit}` : stock > 0 ? `Stock: ${stock}/${vi.quantity} ${stockUnit}` : 'Pas en stock'}
                                color={hasEnough ? 'success' : stock > 0 ? 'warning' : 'error'}
                                variant="outlined"
                                sx={{ fontSize: '0.7rem', height: 22 }}
                              />
                            )}
                          </Box>
                        )
                      })}
                    </Box>

                    {/* Detail prix */}
                    {item.calculatedPrice && (
                      <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
                        <Table size="small">
                          <TableBody>
                            <TableRow>
                              <TableCell>Ingredients</TableCell>
                              <TableCell align="right">{item.calculatedPrice.ingredientsCost?.toFixed(2)} DT</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>Electricite</TableCell>
                              <TableCell align="right">{item.calculatedPrice.electricityCost?.toFixed(2)} DT</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>Eau</TableCell>
                              <TableCell align="right">{item.calculatedPrice.waterCost?.toFixed(2)} DT</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>Marge</TableCell>
                              <TableCell align="right">{item.calculatedPrice.margin?.toFixed(2)} DT</TableCell>
                            </TableRow>
                            <TableRow sx={{ bgcolor: '#fff3e0' }}>
                              <TableCell sx={{ fontWeight: 700 }}>Total unitaire</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700, color: 'primary.main' }}>
                                {item.calculatedPrice.total?.toFixed(2)} DT
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </CardContent>
                </Card>
              )
            })}

            {/* Confirmation ingredients prets */}
            {['pending', 'confirmed'].includes(order.status) && (
              <Card sx={{ mb: 2, border: order.ingredientsReady ? '2px solid #4caf50' : '2px solid #ff9800' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, gap: 2 }}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {order.ingredientsReady ? 'Ingredients prets !' : 'Ingredients pas encore confirmes'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {order.ingredientsReady
                          ? 'Vous pouvez lancer la preparation'
                          : 'Confirmez que tous les ingredients sont disponibles avant de lancer la preparation'}
                      </Typography>
                    </Box>
                    <Button
                      variant="contained"
                      color={order.ingredientsReady ? 'error' : 'success'}
                      onClick={async () => {
                        try {
                          await api.put(`/orders/${id}`, { ingredientsReady: !order.ingredientsReady })
                          await load()
                          toast.success(order.ingredientsReady ? 'Confirmation retiree' : 'Ingredients confirmes prets')
                        } catch { toast.error('Erreur') }
                      }}
                    >
                      {order.ingredientsReady ? 'Annuler' : 'Confirmer prets'}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            )}

            {/* Total global */}
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>Total</Typography>
                  <Typography variant="h5" color="primary.main" sx={{ fontWeight: 700 }}>
                    {order.totalPrice?.toFixed(2)} DT
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  )
}

export default OrderDetailPage
