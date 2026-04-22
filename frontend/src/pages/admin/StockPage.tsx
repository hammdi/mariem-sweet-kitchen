import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import api from '../../services/api'
import {
  Container, Typography, Box, Card,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Chip, TextField, InputAdornment, Tabs, Tab,
} from '@mui/material'
import { ArrowBack, Search, Check, Warning } from '@mui/icons-material'

const categoryLabels: Record<string, string> = {
  base: 'Base', sweetener: 'Sucrant', dairy: 'Produit laitier',
  flavoring: 'Arome', leavening: 'Levant', other: 'Autre',
}

const StockPage = () => {
  const navigate = useNavigate()
  const [ingredients, setIngredients] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [tab, setTab] = useState(0)
  const [history, setHistory] = useState<any[]>([])

  const load = async () => {
    try {
      const res = await api.get('/ingredients')
      setIngredients(res.data.data?.ingredients || res.data.data || [])
    } catch { /* ignore */ }
  }

  const loadHistory = async () => {
    try {
      const res = await api.get('/orders/stock-history')
      setHistory(res.data.data?.history || [])
    } catch { /* ignore */ }
  }

  useEffect(() => { load(); loadHistory() }, [])

  const handleSave = async (id: string) => {
    try {
      await api.put(`/ingredients/${id}`, { stockQuantity: parseFloat(editValue) || 0 })
      toast.success('Stock mis a jour')
      setEditingId(null)
      load()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur')
    }
  }

  const filtered = ingredients.filter(ing =>
    ing.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#fafafa' }}>
      <Box sx={{ bgcolor: 'white', borderBottom: '1px solid #eee', py: 2, px: 3 }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconButton onClick={() => navigate('/admin')}><ArrowBack /></IconButton>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>Mon Stock</Typography>
            </Box>
            <TextField
              size="small" placeholder="Rechercher..."
              value={search} onChange={e => setSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
              sx={{ width: { xs: '100%', sm: 250 } }}
            />
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="Mon stock" />
          <Tab label={`Historique (${history.length})`} />
        </Tabs>

        {tab === 0 && (<>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Notez ce que vous avez a la maison. Quand une commande arrive, vous verrez ce qui manque.
        </Typography>

        <TableContainer component={Card} sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Ingredient</TableCell>
                <TableCell>Categorie</TableCell>
                <TableCell>Unite</TableCell>
                <TableCell align="center">En stock</TableCell>
                <TableCell align="center">Statut</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((ing) => {
                const isEditing = editingId === ing._id
                const hasStock = ing.stockQuantity > 0

                return (
                  <TableRow key={ing._id} sx={{ bgcolor: hasStock ? 'inherit' : '#fff8e1' }}>
                    <TableCell sx={{ fontWeight: 500 }}>{ing.name}</TableCell>
                    <TableCell>
                      <Chip label={categoryLabels[ing.category] || ing.category} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>{ing.unit}</TableCell>
                    <TableCell align="center">
                      {isEditing ? (
                        <TextField
                          size="small" type="number" autoFocus
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={() => handleSave(ing._id)}
                          onKeyDown={e => { if (e.key === 'Enter') handleSave(ing._id); if (e.key === 'Escape') setEditingId(null) }}
                          sx={{ width: 100 }}
                          inputProps={{ min: 0, step: 0.01 }}
                        />
                      ) : (
                        <Chip
                          label={`${ing.stockQuantity || 0} ${ing.unit}`}
                          size="small"
                          color={hasStock ? 'success' : 'default'}
                          variant={hasStock ? 'filled' : 'outlined'}
                          onClick={() => { setEditingId(ing._id); setEditValue(String(ing.stockQuantity || 0)) }}
                          sx={{ cursor: 'pointer', fontWeight: 600, minWidth: 80 }}
                        />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {hasStock ? (
                        <Check sx={{ color: 'success.main' }} />
                      ) : (
                        <Warning sx={{ color: 'warning.main' }} />
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Resume */}
        <Box sx={{ mt: 3, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
          <Card sx={{ p: 2, flex: 1, textAlign: 'center' }}>
            <Typography variant="h4" color="success.main" sx={{ fontWeight: 700 }}>
              {ingredients.filter(i => i.stockQuantity > 0).length}
            </Typography>
            <Typography variant="body2" color="text.secondary">En stock</Typography>
          </Card>
          <Card sx={{ p: 2, flex: 1, textAlign: 'center' }}>
            <Typography variant="h4" color="warning.main" sx={{ fontWeight: 700 }}>
              {ingredients.filter(i => !i.stockQuantity || i.stockQuantity <= 0).length}
            </Typography>
            <Typography variant="body2" color="text.secondary">A acheter</Typography>
          </Card>
          <Card sx={{ p: 2, flex: 1, textAlign: 'center' }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {ingredients.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">Total ingredients</Typography>
          </Card>
        </Box>
        </>)}

        {tab === 1 && (
          <TableContainer component={Card} sx={{ overflowX: 'auto' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Ingredient</TableCell>
                  <TableCell>Quantite</TableCell>
                  <TableCell>Recette</TableCell>
                  <TableCell>Client</TableCell>
                  <TableCell>Type</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((h: any) => (
                  <TableRow key={h._id}>
                    <TableCell sx={{ fontSize: '0.85rem' }}>
                      {new Date(h.createdAt).toLocaleDateString('fr-TN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>{h.ingredientName}</TableCell>
                    <TableCell>{h.quantity} {h.unit}</TableCell>
                    <TableCell>{h.recipeName}</TableCell>
                    <TableCell>{h.clientName}</TableCell>
                    <TableCell>
                      <Chip
                        label={h.type === 'deduction' ? 'Utilise' : 'Restocke'}
                        color={h.type === 'deduction' ? 'warning' : 'success'}
                        size="small" variant="outlined"
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {history.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                      Aucun historique. L'historique se remplit quand une commande passe en preparation.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Container>
    </Box>
  )
}

export default StockPage
