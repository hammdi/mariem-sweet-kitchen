import { useState, useEffect, useMemo } from 'react'
import {
  Box, Typography, IconButton, FormControl, InputLabel, Select, MenuItem,
  Chip, CircularProgress,
} from '@mui/material'
import { ChevronLeft, ChevronRight } from '@mui/icons-material'
import api from '../../services/api'

interface AvailabilityBlock {
  _id?: string
  startDate: string
  endDate: string
  reason?: string
}

interface OrderDatePickerProps {
  value: string  // ISO string "YYYY-MM-DDTHH:mm" ou ""
  onChange: (value: string) => void
  minLeadHours?: number  // defaut 24h
}

const MONTHS = ['Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre']
const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

/**
 * Mini-calendrier de selection de date + heure pour le client.
 * Grise :
 *  - Les jours passes ou < minLeadHours (defaut 24h).
 *  - Les jours bloques par Mariem (recuperes depuis /api/availability/blocks).
 */
const OrderDatePicker = ({ value, onChange, minLeadHours = 24 }: OrderDatePickerProps) => {
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const earliestAllowed = useMemo(
    () => new Date(Date.now() + minLeadHours * 60 * 60 * 1000),
    [minLeadHours]
  )

  const selectedDate = value ? new Date(value) : null

  const [calView, setCalView] = useState<Date>(() => {
    const base = selectedDate || today
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })

  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([])
  const [loadingBlocks, setLoadingBlocks] = useState(false)

  // Charger les blocages depuis l'API (fenetre : aujourd'hui -> 90 jours)
  useEffect(() => {
    const load = async () => {
      setLoadingBlocks(true)
      try {
        const from = new Date()
        const to = new Date()
        to.setDate(to.getDate() + 90)
        const res = await api.get('/availability/blocks', {
          params: { from: from.toISOString(), to: to.toISOString() },
        })
        setBlocks(res.data.data?.blocks || [])
      } catch {
        /* silencieux : si l'API echoue, on affiche quand meme le calendrier */
      }
      setLoadingBlocks(false)
    }
    load()
  }, [])

  const daysInMonth = new Date(calView.getFullYear(), calView.getMonth() + 1, 0).getDate()
  const startDow = (new Date(calView.getFullYear(), calView.getMonth(), 1).getDay() + 6) % 7

  const getDateForDay = (day: number) =>
    new Date(calView.getFullYear(), calView.getMonth(), day)

  const isPast = (day: number) => getDateForDay(day) < today

  const isTooSoon = (day: number) => {
    const d = getDateForDay(day)
    d.setHours(23, 59, 59, 999) // si fin de journee < earliestAllowed → trop tot
    return d < earliestAllowed
  }

  const isToday = (day: number) =>
    day === new Date().getDate() &&
    calView.getMonth() === new Date().getMonth() &&
    calView.getFullYear() === new Date().getFullYear()

  const isSelected = (day: number) => {
    if (!selectedDate) return false
    return (
      selectedDate.getDate() === day &&
      selectedDate.getMonth() === calView.getMonth() &&
      selectedDate.getFullYear() === calView.getFullYear()
    )
  }

  // Un jour est bloque si un AvailabilityBlock chevauche [00:00, 23:59]
  const isBlocked = (day: number): { blocked: boolean; reason?: string } => {
    const dayStart = getDateForDay(day)
    const dayEnd = new Date(dayStart)
    dayEnd.setHours(23, 59, 59, 999)

    for (const b of blocks) {
      const bStart = new Date(b.startDate)
      const bEnd = new Date(b.endDate)
      if (bEnd >= dayStart && bStart <= dayEnd) {
        return { blocked: true, reason: b.reason }
      }
    }
    return { blocked: false }
  }

  const selectDay = (day: number) => {
    if (isPast(day) || isTooSoon(day) || isBlocked(day).blocked) return
    const d = getDateForDay(day)
    const hour = selectedDate ? selectedDate.getHours() : 10
    const min = selectedDate ? selectedDate.getMinutes() : 0
    d.setHours(hour, min, 0, 0)
    // Format local "YYYY-MM-DDTHH:mm" (pas toISOString qui convertit en UTC)
    const pad = (n: number) => String(n).padStart(2, '0')
    const localStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    onChange(localStr)
  }

  const updateTime = (hours: number, minutes: number) => {
    if (!selectedDate) return
    const d = new Date(selectedDate)
    d.setHours(hours, minutes, 0, 0)
    const pad = (n: number) => String(n).padStart(2, '0')
    const localStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    onChange(localStr)
  }

  return (
    <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 2, p: 1.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Quand souhaitez-vous votre commande ?
        </Typography>
        {loadingBlocks && <CircularProgress size={14} />}
      </Box>

      {/* Navigation mois */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <IconButton
          size="small"
          onClick={() => setCalView(new Date(calView.getFullYear(), calView.getMonth() - 1, 1))}
        >
          <ChevronLeft />
        </IconButton>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {MONTHS[calView.getMonth()]} {calView.getFullYear()}
        </Typography>
        <IconButton
          size="small"
          onClick={() => setCalView(new Date(calView.getFullYear(), calView.getMonth() + 1, 1))}
        >
          <ChevronRight />
        </IconButton>
      </Box>

      {/* Jours de la semaine */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.25, mb: 0.5 }}>
        {DAYS.map((d, i) => (
          <Typography
            key={i}
            variant="caption"
            sx={{ textAlign: 'center', fontWeight: 600, color: 'text.secondary', fontSize: '0.65rem' }}
          >
            {d}
          </Typography>
        ))}
      </Box>

      {/* Grille des jours */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.25 }}>
        {Array.from({ length: startDow }).map((_, i) => (
          <Box key={`empty-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const past = isPast(day)
          const tooSoon = !past && isTooSoon(day)
          const { blocked, reason } = isBlocked(day)
          const sel = isSelected(day)
          const tod = isToday(day)
          const disabled = past || tooSoon || blocked

          return (
            <Box
              key={day}
              onClick={() => selectDay(day)}
              title={
                blocked
                  ? `Indisponible${reason ? ` : ${reason}` : ''}`
                  : tooSoon
                    ? `Minimum ${minLeadHours}h a l'avance`
                    : ''
              }
              sx={{
                position: 'relative',
                textAlign: 'center',
                py: 0.5,
                borderRadius: 1,
                cursor: disabled ? 'not-allowed' : 'pointer',
                bgcolor: sel
                  ? 'primary.main'
                  : blocked
                    ? '#ffebee'
                    : tod
                      ? '#fff3e0'
                      : 'transparent',
                color: sel
                  ? 'white'
                  : disabled
                    ? '#bbb'
                    : 'text.primary',
                textDecoration: blocked ? 'line-through' : 'none',
                fontWeight: sel || tod ? 700 : 400,
                fontSize: '0.8rem',
                '&:hover': !disabled && !sel ? { bgcolor: '#fff3e0' } : {},
                transition: 'all 0.1s',
              }}
            >
              {day}
            </Box>
          )
        })}
      </Box>

      {/* Legende */}
      <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap', fontSize: '0.7rem' }}>
        <Chip label="Dispo" size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
        <Chip label="Indispo" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#ffebee' }} />
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          Min {minLeadHours}h a l'avance
        </Typography>
      </Box>

      {/* Selecteur d'heure */}
      {selectedDate && (
        <Box sx={{ display: 'flex', gap: 1, mt: 1.5, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 80 }}>
            <InputLabel>Heure</InputLabel>
            <Select
              label="Heure"
              value={selectedDate.getHours()}
              onChange={e => updateTime(Number(e.target.value), selectedDate.getMinutes())}
            >
              {Array.from({ length: 12 }, (_, i) => i + 9).map(h => (
                <MenuItem key={h} value={h}>{String(h).padStart(2, '0')}h</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 80 }}>
            <InputLabel>Min</InputLabel>
            <Select
              label="Min"
              value={selectedDate.getMinutes()}
              onChange={e => updateTime(selectedDate.getHours(), Number(e.target.value))}
            >
              {[0, 15, 30, 45].map(m => (
                <MenuItem key={m} value={m}>{String(m).padStart(2, '0')}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
            Mariem confirmera le RDV
          </Typography>
        </Box>
      )}
    </Box>
  )
}

export default OrderDatePicker
