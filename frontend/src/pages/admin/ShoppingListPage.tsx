import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import api from '../../services/api'
import {
  Container, Typography, Box, Card, CardContent, Button,
  IconButton, Checkbox, TextField, Chip, Divider,
} from '@mui/material'
import { ArrowBack, ShoppingCart, Check } from '@mui/icons-material'

interface ShoppingItem {
  ingredientId: string
  name: string
  unit: string
  needed: number
  inStock: number
  toBuy: number
  estimatedCost: number
  pricePerUnit: number
  // Local state
  checked: boolean
  editedQty: number
}

const ShoppingListPage = () => {
  const navigate = useNavigate()
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [totalCost, setTotalCost] = useState(0)
  const [orderCount, setOrderCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/orders/shopping-list')
      const data = res.data.data
      setItems((data.shoppingList || []).map((i: any) => ({
        ...i,
        checked: false,
        editedQty: i.toBuy,
      })))
      setTotalCost(data.totalCost || 0)
      setOrderCount(data.orderCount || 0)
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const toggleItem = (index: number) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, checked: !item.checked } : item))
  }

  const updateQty = (index: number, qty: number) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, editedQty: Math.max(0, qty) } : item))
  }

  const checkedItems = items.filter(i => i.checked && i.editedQty > 0)
  const checkedTotal = checkedItems.reduce((sum, i) => sum + i.editedQty * i.pricePerUnit, 0)

  const handlePurchase = async () => {
    if (checkedItems.length === 0) {
      toast.warn('Cochez les ingredients achetes')
      return
    }
    setSaving(true)
    try {
      await api.post('/orders/shopping-list/purchase', {
        purchases: checkedItems.map(i => ({
          ingredientId: i.ingredientId,
          quantity: i.editedQty,
          name: i.name,
          unit: i.unit,
        }))
      })
      toast.success(`${checkedItems.length} ingredient(s) ajoute(s) au stock !`)
      await load()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur')
    }
    setSaving(false)
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#fafafa' }}>
      {/* Header */}
      <Box sx={{ bgcolor: 'white', borderBottom: '1px solid #eee', py: 2, px: 3 }}>
        <Container maxWidth="md">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={() => navigate('/admin')}><ArrowBack /></IconButton>
            <ShoppingCart color="primary" />
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600, fontSize: { xs: '1.1rem', md: '1.5rem' } }}>
                Liste de courses
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {orderCount} commande{orderCount > 1 ? 's' : ''} payee{orderCount > 1 ? 's' : ''} en attente
              </Typography>
            </Box>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ py: 3 }}>
        {loading ? (
          <Typography color="text.secondary">Chargement...</Typography>
        ) : items.length === 0 ? (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <ShoppingCart sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                Rien a acheter !
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Tous les ingredients sont en stock pour les commandes payees.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Résumé */}
            <Card sx={{ mb: 2, bgcolor: '#fff3e0', border: '1px solid #ffb74d' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {items.length} ingredient{items.length > 1 ? 's' : ''} a acheter
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Budget estime : {totalCost.toFixed(2)} DT
                    </Typography>
                  </Box>
                  <Chip label={`${orderCount} commande${orderCount > 1 ? 's' : ''}`} color="warning" />
                </Box>
              </CardContent>
            </Card>

            {/* Liste */}
            <Card>
              <CardContent sx={{ p: { xs: 1.5, sm: 3 } }}>
                {items.map((item, index) => (
                  <Box key={item.ingredientId}>
                    <Box sx={{
                      display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 }, py: 1.5,
                      flexWrap: 'wrap',
                      opacity: item.checked ? 0.6 : 1,
                    }}>
                      <Checkbox
                        checked={item.checked}
                        onChange={() => toggleItem(index)}
                        color="success"
                      />
                      <Box sx={{ flex: 1, minWidth: 120 }}>
                        <Typography variant="body1" sx={{
                          fontWeight: 600,
                          textDecoration: item.checked ? 'line-through' : 'none',
                        }}>
                          {item.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Besoin : {item.needed} {item.unit} · En stock : {item.inStock} {item.unit} · Prix : {item.pricePerUnit} DT/{item.unit}
                        </Typography>
                      </Box>
                      <TextField
                        size="small"
                        type="number"
                        label="Achete"
                        value={item.editedQty}
                        onChange={e => updateQty(index, parseFloat(e.target.value) || 0)}
                        sx={{ width: 90 }}
                        inputProps={{ step: 0.01, min: 0 }}
                      />
                      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 30 }}>
                        {item.unit}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500, minWidth: 65, textAlign: 'right' }}>
                        {(item.editedQty * item.pricePerUnit).toFixed(2)} DT
                      </Typography>
                    </Box>
                    {index < items.length - 1 && <Divider />}
                  </Box>
                ))}
              </CardContent>
            </Card>

            {/* Bouton valider */}
            {checkedItems.length > 0 && (
              <Card sx={{ mt: 2, border: '2px solid #4caf50', position: 'sticky', bottom: 16 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {checkedItems.length} ingredient{checkedItems.length > 1 ? 's' : ''} coche{checkedItems.length > 1 ? 's' : ''}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total : {checkedTotal.toFixed(2)} DT → sera ajoute au stock
                      </Typography>
                    </Box>
                    <Button
                      variant="contained" color="success" startIcon={<Check />}
                      onClick={handlePurchase} disabled={saving}
                      sx={{ whiteSpace: 'nowrap' }}
                    >
                      {saving ? 'Ajout...' : 'Ajouter au stock'}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </Container>
    </Box>
  )
}

export default ShoppingListPage
