import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import api from '../../services/api'
import {
  Container, Typography, Box, IconButton, Card, CardContent,
  Chip, Grid, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, List, ListItem, ListItemText, ListItemSecondaryAction,
} from '@mui/material'
import {
  ArrowBack, ChevronLeft, ChevronRight,
  CalendarToday, Block, Delete as DeleteIcon,
} from '@mui/icons-material'

interface AvailabilityBlock {
  _id: string
  startDate: string
  endDate: string
  reason?: string
}

const statusColors: Record<string, 'warning' | 'info' | 'primary' | 'success' | 'default' | 'error'> = {
  pending: 'warning',
  confirmed: 'info',
  preparing: 'primary',
  ready: 'success',
  paid: 'default',
  cancelled: 'error',
}

const statusLabels: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmee',
  preparing: 'En preparation',
  ready: 'Prete',
  paid: 'Payee',
  cancelled: 'Annulee',
}

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTHS = [
  'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'
]

interface OrderEvent {
  _id: string
  clientName: string
  clientPhone: string
  status: string
  totalPrice: number
  requestedDate: string | null
  confirmedDate: string | null
  items: { recipeId: { name?: string } | string; quantity: number }[]
}

const CalendarPage = () => {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<OrderEvent[]>([])
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  // Dialog de blocage
  const [blockDialogOpen, setBlockDialogOpen] = useState(false)
  const [blockDay, setBlockDay] = useState<number | null>(null)
  const [blockReason, setBlockReason] = useState('')

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const loadBlocks = async () => {
    try {
      const res = await api.get('/availability/blocks/admin')
      setBlocks(res.data.data?.blocks || [])
    } catch { /* ignore */ }
  }

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/orders?limit=200')
        setOrders(res.data.data?.orders || [])
      } catch { /* ignore */ }
    }
    load()
    loadBlocks()
  }, [])

  // Verifie si un jour du mois courant est dans un creneau bloque
  const isDayBlocked = (day: number): AvailabilityBlock | null => {
    const dayStart = new Date(year, month, day, 0, 0, 0, 0)
    const dayEnd = new Date(year, month, day, 23, 59, 59, 999)
    for (const b of blocks) {
      const bStart = new Date(b.startDate)
      const bEnd = new Date(b.endDate)
      if (bEnd >= dayStart && bStart <= dayEnd) {
        return b
      }
    }
    return null
  }

  const openBlockDialog = (day: number) => {
    setBlockDay(day)
    setBlockReason('')
    setBlockDialogOpen(true)
  }

  const confirmBlock = async () => {
    if (blockDay === null) return
    const start = new Date(year, month, blockDay, 0, 0, 0, 0)
    const end = new Date(year, month, blockDay, 23, 59, 59, 999)
    try {
      await api.post('/availability/blocks', {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        reason: blockReason.trim() || undefined,
      })
      toast.success('Jour bloque')
      setBlockDialogOpen(false)
      await loadBlocks()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      toast.error(e.response?.data?.message || 'Erreur')
    }
  }

  const unblockDay = async (blockId: string) => {
    try {
      await api.delete(`/availability/blocks/${blockId}`)
      toast.success('Jour debloque')
      await loadBlocks()
    } catch {
      toast.error('Erreur')
    }
  }

  // Blocages a venir, tries par date
  const upcomingBlocks = blocks
    .filter(b => new Date(b.endDate) >= new Date())
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())

  // Navigation mois
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))
  const goToday = () => { setCurrentDate(new Date()); setSelectedDay(null) }

  // Construire la grille du mois
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDow = (firstDay.getDay() + 6) % 7 // Lundi = 0
  const daysInMonth = lastDay.getDate()

  // Obtenir la date d'un événement (confirmedDate prioritaire, sinon requestedDate)
  const getEventDate = (order: OrderEvent): Date | null => {
    const dateStr = order.confirmedDate || order.requestedDate
    return dateStr ? new Date(dateStr) : null
  }

  // Commandes par jour du mois
  const ordersByDay: Record<number, OrderEvent[]> = {}
  for (const order of orders) {
    const d = getEventDate(order)
    if (!d) continue
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate()
      if (!ordersByDay[day]) ordersByDay[day] = []
      ordersByDay[day].push(order)
    }
  }

  // Commandes sans date
  const ordersWithoutDate = orders.filter(o => !o.confirmedDate && !o.requestedDate && o.status !== 'paid' && o.status !== 'cancelled')

  // Jour selectionne
  const selectedOrders = selectedDay ? (ordersByDay[parseInt(selectedDay)] || []) : []

  const today = new Date()
  const isToday = (day: number) => day === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  // Nom de la recette depuis l'item
  const getRecipeName = (item: OrderEvent['items'][0]) => {
    const r = item.recipeId
    return r && typeof r === 'object' && r.name ? r.name : 'Recette'
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#fafafa' }}>
      {/* Header */}
      <Box sx={{ bgcolor: 'white', borderBottom: '1px solid #eee', py: 2, px: 3 }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={() => navigate('/admin')}><ArrowBack /></IconButton>
            <CalendarToday color="primary" />
            <Typography variant="h5" sx={{ fontWeight: 600, fontSize: { xs: '1.1rem', md: '1.5rem' } }}>
              Calendrier des commandes
            </Typography>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Grid container spacing={3}>
          {/* Calendrier */}
          <Grid item xs={12} md={selectedDay ? 7 : 12}>
            <Card>
              <CardContent>
                {/* Navigation mois */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <IconButton onClick={prevMonth}><ChevronLeft /></IconButton>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, fontSize: { xs: '1rem', md: '1.25rem' } }}>
                      {MONTHS[month]} {year}
                    </Typography>
                    <Button size="small" onClick={goToday} variant="outlined" sx={{ ml: 1, minWidth: 'auto', px: 1 }}>
                      Aujourd'hui
                    </Button>
                  </Box>
                  <IconButton onClick={nextMonth}><ChevronRight /></IconButton>
                </Box>

                {/* Jours de la semaine */}
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
                  {DAYS.map(d => (
                    <Box key={d} sx={{ textAlign: 'center', py: 0.5 }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
                        {d}
                      </Typography>
                    </Box>
                  ))}

                  {/* Cases vides avant le 1er */}
                  {Array.from({ length: startDow }).map((_, i) => (
                    <Box key={`empty-${i}`} />
                  ))}

                  {/* Jours du mois */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1
                    const dayOrders = ordersByDay[day] || []
                    const hasOrders = dayOrders.length > 0
                    const isSelected = selectedDay === String(day)
                    const confirmedCount = dayOrders.filter(o => o.confirmedDate).length
                    const pendingCount = dayOrders.filter(o => !o.confirmedDate).length
                    const block = isDayBlocked(day)

                    const handleClick = () => {
                      if (block) {
                        // Deja bloque : proposer de debloquer
                        if (window.confirm(`Debloquer le ${day} ${MONTHS[month]} ?`)) {
                          unblockDay(block._id)
                        }
                      } else if (hasOrders) {
                        setSelectedDay(isSelected ? null : String(day))
                      } else {
                        // Jour libre sans commande : proposer de bloquer
                        openBlockDialog(day)
                      }
                    }

                    return (
                      <Box
                        key={day}
                        onClick={handleClick}
                        title={block ? `Bloque${block.reason ? ` : ${block.reason}` : ''}` : ''}
                        sx={{
                          textAlign: 'center',
                          py: { xs: 0.5, sm: 1 },
                          px: 0.25,
                          borderRadius: 1,
                          cursor: 'pointer',
                          border: isSelected ? '2px solid' : '1px solid',
                          borderColor: isSelected ? 'primary.main' : isToday(day) ? 'primary.light' : 'transparent',
                          bgcolor: block
                            ? '#ffebee'
                            : isSelected
                              ? 'primary.50'
                              : hasOrders
                                ? '#fff8f0'
                                : 'transparent',
                          transition: 'all 0.15s',
                          '&:hover': block
                            ? { bgcolor: '#ffcdd2' }
                            : hasOrders
                              ? { bgcolor: '#fff3e0', borderColor: 'primary.light' }
                              : { bgcolor: '#f5f5f5' },
                          minHeight: { xs: 44, sm: 64 },
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: isToday(day) ? 700 : hasOrders || block ? 600 : 400,
                            color: block ? 'error.main' : isToday(day) ? 'primary.main' : 'text.primary',
                            textDecoration: block ? 'line-through' : 'none',
                            fontSize: { xs: '0.75rem', sm: '0.875rem' },
                          }}
                        >
                          {day}
                        </Typography>
                        {block && (
                          <Block sx={{ fontSize: { xs: 10, sm: 12 }, color: 'error.main', mt: 0.25 }} />
                        )}
                        {hasOrders && !block && (
                          <Box sx={{ display: 'flex', gap: 0.25, mt: 0.25, flexWrap: 'wrap', justifyContent: 'center' }}>
                            {confirmedCount > 0 && (
                              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'success.main' }} />
                            )}
                            {pendingCount > 0 && (
                              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'warning.main' }} />
                            )}
                            <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary', display: { xs: 'none', sm: 'block' } }}>
                              {dayOrders.length}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    )
                  })}
                </Box>

                {/* Legende */}
                <Box sx={{ display: 'flex', gap: 2, mt: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main' }} />
                    <Typography variant="caption">Confirme</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main' }} />
                    <Typography variant="caption">En attente</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Block sx={{ fontSize: 12, color: 'error.main' }} />
                    <Typography variant="caption">Indispo</Typography>
                  </Box>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
                  Clic sur un jour libre = bloquer · clic sur un jour bloque = debloquer
                </Typography>
              </CardContent>
            </Card>

            {/* Liste des indisponibilites a venir */}
            {upcomingBlocks.length > 0 && (
              <Card sx={{ mt: 2 }}>
                <CardContent>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Block fontSize="small" color="error" />
                    Indisponibilites ({upcomingBlocks.length})
                  </Typography>
                  <List dense>
                    {upcomingBlocks.slice(0, 10).map(b => {
                      const start = new Date(b.startDate)
                      const label = start.toLocaleDateString('fr-TN', { weekday: 'short', day: '2-digit', month: 'short' })
                      return (
                        <ListItem key={b._id} disableGutters>
                          <ListItemText
                            primary={label}
                            secondary={b.reason || 'Sans raison'}
                            primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                            secondaryTypographyProps={{ variant: 'caption' }}
                          />
                          <ListItemSecondaryAction>
                            <IconButton size="small" onClick={() => unblockDay(b._id)} title="Debloquer">
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </ListItemSecondaryAction>
                        </ListItem>
                      )
                    })}
                  </List>
                </CardContent>
              </Card>
            )}

            {/* Commandes sans date */}
            {ordersWithoutDate.length > 0 && (
              <Card sx={{ mt: 2, border: '1px solid #ff9800' }}>
                <CardContent>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#e65100', mb: 1 }}>
                    {ordersWithoutDate.length} commande{ordersWithoutDate.length > 1 ? 's' : ''} sans date de RDV
                  </Typography>
                  {ordersWithoutDate.map(order => (
                    <Box key={order._id}
                      onClick={() => navigate(`/admin/orders/${order._id}`)}
                      sx={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        py: 0.75, cursor: 'pointer', '&:hover': { bgcolor: '#fff3e0' }, borderRadius: 1, px: 1,
                      }}
                    >
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{order.clientName}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {order.items.map(i => `${i.quantity}x ${getRecipeName(i)}`).join(', ')}
                        </Typography>
                      </Box>
                      <Chip size="small" label={statusLabels[order.status] || order.status} color={statusColors[order.status] || 'default'} />
                    </Box>
                  ))}
                </CardContent>
              </Card>
            )}
          </Grid>

          {/* Detail du jour selectionne */}
          {selectedDay && (
            <Grid item xs={12} md={5}>
              <Card sx={{ position: { md: 'sticky' }, top: { md: 80 } }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, fontSize: { xs: '1rem', md: '1.25rem' } }}>
                    {parseInt(selectedDay)} {MONTHS[month]} — {selectedOrders.length} commande{selectedOrders.length > 1 ? 's' : ''}
                  </Typography>

                  {selectedOrders.length === 0 ? (
                    <Typography color="text.secondary">Aucune commande ce jour</Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {selectedOrders.map(order => {
                        const d = getEventDate(order)
                        const time = d ? d.toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit' }) : ''

                        return (
                          <Card
                            key={order._id}
                            variant="outlined"
                            sx={{
                              cursor: 'pointer',
                              transition: 'box-shadow 0.15s',
                              '&:hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
                            }}
                            onClick={() => navigate(`/admin/orders/${order._id}`)}
                          >
                            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                  {time && `${time} — `}{order.clientName}
                                </Typography>
                                <Chip
                                  size="small"
                                  label={statusLabels[order.status] || order.status}
                                  color={statusColors[order.status] || 'default'}
                                />
                              </Box>
                              <Typography variant="body2" color="text.secondary">
                                {order.clientPhone}
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 0.5 }}>
                                {order.items.map(i => `${i.quantity}x ${getRecipeName(i)}`).join(', ')}
                              </Typography>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                                  {order.totalPrice?.toFixed(2)} DT
                                </Typography>
                                {order.confirmedDate ? (
                                  <Chip size="small" label="Date confirmee" color="success" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                                ) : (
                                  <Chip size="small" label="A confirmer" color="warning" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                                )}
                              </Box>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      </Container>

      {/* Dialog : bloquer un jour */}
      <Dialog open={blockDialogOpen} onClose={() => setBlockDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          Bloquer le {blockDay} {MONTHS[month]} {year}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Les clients ne pourront pas choisir cette date pour leur commande.
          </Typography>
          <TextField
            fullWidth
            autoFocus
            label="Raison (optionnel)"
            placeholder="ex: conges, journee pleine, indisponible..."
            value={blockReason}
            onChange={e => setBlockReason(e.target.value)}
            inputProps={{ maxLength: 200 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBlockDialogOpen(false)}>Annuler</Button>
          <Button variant="contained" color="error" onClick={confirmBlock}>
            Bloquer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default CalendarPage
