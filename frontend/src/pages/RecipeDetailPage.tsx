import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import api from '../services/api'
import {
  Container, Typography, Box, Grid, Card, CardContent, CardMedia,
  Button, Chip, Table, TableBody, TableCell, TableContainer, TableRow,
  Paper, TextField, Checkbox, FormControlLabel,
  Dialog, DialogTitle, DialogContent, DialogActions, Skeleton, Divider,
} from '@mui/material'
import { ArrowBack, Cake, ShoppingBag, Phone } from '@mui/icons-material'
import OrderDatePicker from '../components/common/OrderDatePicker'

const RecipeDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()

  const [recipe, setRecipe] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [selectedVariant, setSelectedVariant] = useState(0)
  const [priceInfo, setPriceInfo] = useState<any>(null)
  const [priceLoading, setPriceLoading] = useState(false)

  // Commande
  const [orderOpen, setOrderOpen] = useState(false)
  const [orderForm, setOrderForm] = useState({ clientName: '', clientPhone: '', quantity: 1, requestedDate: '', notes: '' })
  const [clientOffered, setClientOffered] = useState<string[]>([])
  const [orderSending, setOrderSending] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await api.get(`/recipes/${id}`)
        const r = res.data.data?.recipe
        setRecipe(r)

        // Charger suggestions (meme categorie ou autres recettes)
        try {
          const cat = r?.categories?.[0]
          const sugRes = await api.get(`/recipes?limit=10${cat ? `&category=${cat}` : ''}`)
          const all = sugRes.data.data?.recipes || []
          setSuggestions(all.filter((s: any) => s._id !== id).slice(0, 4))
        } catch { /* ignore */ }
      } catch { navigate('/recipes') }
      setLoading(false)
    }
    load()
  }, [id])

  // Calculer le prix quand le variant ou les offres client changent
  useEffect(() => {
    if (!recipe) return
    const calc = async () => {
      setPriceLoading(true)
      try {
        const res = await api.post('/prices/calculate', {
          recipeId: recipe._id,
          variantIndex: selectedVariant,
          clientProvidedIngredients: clientOffered,
        })
        setPriceInfo(res.data.data)
      } catch { setPriceInfo(null) }
      setPriceLoading(false)
    }
    calc()
  }, [recipe, selectedVariant, clientOffered])

  const handleOrder = async () => {
    setOrderSending(true)
    try {
      await api.post('/orders', {
        clientName: orderForm.clientName,
        clientPhone: orderForm.clientPhone,
        requestedDate: orderForm.requestedDate || null,
        items: [{
          recipeId: recipe._id,
          variantIndex: selectedVariant,
          quantity: orderForm.quantity,
          clientOfferedIngredients: clientOffered,
        }],
        notes: orderForm.notes,
      })
      setOrderOpen(false)
      toast.success('Commande envoyee ! Mariem vous contactera.')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la commande')
    }
    setOrderSending(false)
  }

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Skeleton variant="text" width={100} height={40} />
        <Grid container spacing={4} sx={{ mt: 1 }}>
          <Grid item xs={12} md={6}><Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} /></Grid>
          <Grid item xs={12} md={6}><Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} /></Grid>
        </Grid>
      </Container>
    )
  }

  if (!recipe) return null

  const variant = recipe.variants?.[selectedVariant]

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/recipes')} sx={{ mb: 3 }}>
        Retour aux recettes
      </Button>

      <Grid container spacing={4}>
        {/* Image + description */}
        <Grid item xs={12} md={5}>
          <Card>
            {recipe.images?.[0] ? (
              <CardMedia component="img" height="250" image={recipe.images[0]} alt={recipe.name}
                sx={{ objectFit: 'cover', maxHeight: { xs: 220, md: 350 } }}
              />
            ) : (
              <Box sx={{ height: 350, background: 'linear-gradient(135deg, #fef7ee, #fad7a5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Cake sx={{ fontSize: 100, color: 'primary.main', opacity: 0.4 }} />
              </Box>
            )}
            <CardContent>
              <Typography variant="h4" sx={{ fontFamily: 'Playfair Display', fontWeight: 600, mb: 1, fontSize: { xs: '1.5rem', md: '2.125rem' } }}>
                {recipe.name}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>
                {recipe.description}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {recipe.categories?.map((cat: string, i: number) => (
                  <Chip key={i} label={cat} color="primary" variant="outlined" />
                ))}
              </Box>
            </CardContent>
          </Card>

          {/* Calendrier sous la carte recette */}
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, fontSize: { xs: '1rem', md: '1.25rem' } }}>
                Quand voulez-vous votre commande ?
              </Typography>
              <OrderDatePicker
                value={orderForm.requestedDate}
                onChange={(v: string) => setOrderForm({ ...orderForm, requestedDate: v })}
              />
              {orderForm.requestedDate && (
                <Typography variant="body2" color="success.main" sx={{ mt: 1, fontWeight: 500 }}>
                  Mariem confirmera la date apres votre commande
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Prix + commande */}
        <Grid item xs={12} md={7}>
          {/* Selection taille */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Choisir la taille</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {recipe.variants?.map((v: any, idx: number) => (
                  <Chip key={idx} label={`${v.sizeName} (${v.portions} portions)`}
                    color={selectedVariant === idx ? 'primary' : 'default'}
                    variant={selectedVariant === idx ? 'filled' : 'outlined'}
                    onClick={() => setSelectedVariant(idx)}
                    sx={{ cursor: 'pointer', fontSize: '0.9rem', py: 2 }}
                  />
                ))}
              </Box>
            </CardContent>
          </Card>

          {/* Liste ingredients */}
          {variant && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  Ingredients utilises
                </Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableBody>
                      {variant.ingredients?.map((ing: any, idx: number) => {
                        const ingredient = ing.ingredientId
                        const ingId = typeof ingredient === 'object' ? ingredient._id : ingredient
                        const name = typeof ingredient === 'object' ? ingredient.name : 'Ingredient'
                        const price = typeof ingredient === 'object' ? ingredient.pricePerUnit : 0
                        const isOffered = clientOffered.includes(ingId)
                        const cost = isOffered ? 0 : price * ing.quantity

                        return (
                          <TableRow key={idx} sx={{ bgcolor: isOffered ? '#e8f5e9' : 'inherit' }}>
                            <TableCell>
                              <FormControlLabel
                                control={
                                  <Checkbox size="small" checked={isOffered}
                                    onChange={() => {
                                      if (isOffered) setClientOffered(clientOffered.filter(id => id !== ingId))
                                      else setClientOffered([...clientOffered, ingId])
                                    }}
                                  />
                                }
                                label={
                                  <Typography variant="body2" sx={{ textDecoration: isOffered ? 'line-through' : 'none' }}>
                                    {name}
                                  </Typography>
                                }
                              />
                            </TableCell>
                            <TableCell align="right">{ing.quantity} {ing.unit}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 500 }}>
                              {isOffered ? <Chip label="Je ramene" size="small" color="success" variant="outlined" /> : cost > 0 ? `${cost.toFixed(3)} DT` : '-'}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                  Cochez les ingredients que vous ramenez — le prix se recalcule automatiquement
                </Typography>

                {/* Machines */}
                {variant.appliances?.length > 0 && (
                  <>
                    <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, fontWeight: 600 }}>
                      Machines utilisees
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {variant.appliances.map((app: any, idx: number) => {
                        const appliance = app.applianceId
                        const name = typeof appliance === 'object' ? appliance.name : 'Machine'
                        return (
                          <Chip key={idx} label={`${name} (${app.duration} min)`}
                            size="small" variant="outlined"
                          />
                        )
                      })}
                    </Box>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Detail prix */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Detail du prix</Typography>
              {priceLoading ? (
                <Box><Skeleton /><Skeleton /><Skeleton /><Skeleton /></Box>
              ) : priceInfo ? (
                <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell>Ingredients</TableCell>
                        <TableCell align="right">{priceInfo.ingredientsCost?.toFixed(3)} DT</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Electricite (STEG)</TableCell>
                        <TableCell align="right">{priceInfo.electricityCost?.toFixed(3)} DT</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Eau</TableCell>
                        <TableCell align="right">{priceInfo.waterCost?.toFixed(3)} DT</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Marge effort (15%)</TableCell>
                        <TableCell align="right">{priceInfo.margin?.toFixed(3)} DT</TableCell>
                      </TableRow>
                      <TableRow sx={{ bgcolor: '#fff3e0' }}>
                        <TableCell sx={{ fontWeight: 700, fontSize: '1.1rem' }}>TOTAL</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, fontSize: '1.1rem', color: 'primary.main' }}>
                          {priceInfo.total?.toFixed(2)} DT
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography color="text.secondary">Calcul du prix indisponible</Typography>
              )}

              <Typography variant="body2" color="text.secondary" sx={{ mt: 2, fontStyle: 'italic' }}>
                Si vous ramenez vos propres ingredients, le prix sera reduit. Contactez Mariem pour en discuter.
              </Typography>
            </CardContent>
          </Card>

          {/* Boutons action */}
          <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
            <Button variant="contained" size="large" fullWidth
              startIcon={<ShoppingBag />}
              onClick={() => setOrderOpen(true)}
              disabled={!orderForm.requestedDate}
              sx={{ py: 1.5, fontSize: '1.1rem' }}
            >
              {orderForm.requestedDate ? 'Commander' : 'Choisissez une date'}
            </Button>
            <Button variant="outlined" size="large" fullWidth
              startIcon={<Phone />}
              href={`https://wa.me/${import.meta.env.VITE_WHATSAPP_NUMBER || '21612345678'}`}
              target="_blank"
              sx={{ py: 1.5 }}
            >
              WhatsApp
            </Button>
          </Box>
        </Grid>
      </Grid>

      {/* Dialog de commande */}
      {/* Suggestions */}
      {suggestions.length > 0 && (
        <Box sx={{ mt: 6 }}>
          <Typography variant="h5" sx={{ fontFamily: 'Playfair Display', fontWeight: 600, mb: 3 }}>
            Vous aimerez aussi
          </Typography>
          <Grid container spacing={3}>
            {suggestions.map((s) => (
              <Grid item xs={12} sm={6} md={3} key={s._id}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 20px rgba(0,0,0,0.12)' },
                  }}
                  onClick={() => { navigate(`/recipes/${s._id}`); window.scrollTo(0, 0) }}
                >
                  {s.images?.[0] ? (
                    <CardMedia component="img" height="140" image={s.images[0]} alt={s.name}
                      sx={{ objectFit: 'cover' }}
                    />
                  ) : (
                    <Box sx={{ height: 140, background: 'linear-gradient(135deg, #fef7ee, #fad7a5)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Cake sx={{ fontSize: 48, color: 'primary.main', opacity: 0.4 }} />
                    </Box>
                  )}
                  <CardContent sx={{ pb: 1.5 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>{s.name}</Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                      {s.categories?.map((cat: string, ci: number) => (
                        <Chip key={ci} label={cat} size="small" variant="outlined" />
                      ))}
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                    }}>
                      {s.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Dialog de commande */}
      <Dialog open={orderOpen} onClose={() => setOrderOpen(false)} maxWidth="sm" fullWidth scroll="body">
        <DialogTitle>Commander — {recipe.name}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Taille : {variant?.sizeName} — Prix : {priceInfo?.total?.toFixed(2)} DT
          </Typography>

          <TextField fullWidth size="small" label="Votre nom" required sx={{ mb: 2, mt: 1 }}
            value={orderForm.clientName}
            onChange={e => setOrderForm({ ...orderForm, clientName: e.target.value })}
          />
          <TextField fullWidth size="small" label="Votre telephone" required sx={{ mb: 2 }}
            value={orderForm.clientPhone}
            onChange={e => setOrderForm({ ...orderForm, clientPhone: e.target.value })}
            placeholder="+216 XX XXX XXX"
          />
          <TextField fullWidth size="small" label="Quantite" type="number" sx={{ mb: 2 }}
            value={orderForm.quantity}
            onChange={e => setOrderForm({ ...orderForm, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
            inputProps={{ min: 1 }}
          />
          {/* Rappel de la date choisie (le calendrier est sur la page principale) */}
          {orderForm.requestedDate && (
            <Box sx={{ mb: 2, p: 1.5, bgcolor: '#fff3e0', borderRadius: 2, border: '1px solid #ffe0b2' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Date souhaitee : {new Date(orderForm.requestedDate).toLocaleString('fr-TN', {
                  weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit',
                })}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Mariem confirmera par telephone
              </Typography>
            </Box>
          )}
          <TextField fullWidth size="small" label="Notes (optionnel)" multiline rows={2} sx={{ mb: 1 }}
            value={orderForm.notes}
            onChange={e => setOrderForm({ ...orderForm, notes: e.target.value })}
            placeholder="Demande speciale, allergies..."
          />

          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="h6">Total</Typography>
            <Typography variant="h6" color="primary.main" sx={{ fontWeight: 700 }}>
              {((priceInfo?.total || 0) * orderForm.quantity).toFixed(2)} DT
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Paiement en cash a la recuperation
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOrderOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleOrder}
            disabled={orderSending || !orderForm.clientName || !orderForm.clientPhone}
          >
            {orderSending ? 'Envoi...' : 'Envoyer la commande'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

export default RecipeDetailPage
