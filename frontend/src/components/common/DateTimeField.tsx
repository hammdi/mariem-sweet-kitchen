import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Popover,
  Select,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { CalendarMonth, ChevronLeft, ChevronRight, Close } from '@mui/icons-material';
import {
  MONTH_NAMES_FR,
  formatDateTimeFr,
  fromLocalParts,
  toLocalParts,
} from '../../utils/dateTime';

interface Props {
  label: string;
  value: string | null; // ISO UTC ou vide
  onChange: (iso: string | null) => void;
  helperText?: string;
  disabled?: boolean;
  size?: 'small' | 'medium';
  dateOnly?: boolean; // jour seulement (filtres de periode) : renvoie minuit heure locale
}

const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Selecteur date + heure aux couleurs de l'application (remplace le calendrier
 * natif). Affiche "02 octobre 2026 · 15:00" ; renvoie un ISO UTC calcule depuis
 * l'heure LOCALE (pas de decalage cote serveur).
 */
export default function DateTimeField({
  label,
  value,
  onChange,
  helperText,
  disabled,
  size = 'small',
  dateOnly = false,
}: Props) {
  const display = (v: string) =>
    dateOnly ? formatDateTimeFr(v).split(' · ')[0] : formatDateTimeFr(v);
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [draft, setDraft] = useState<{ date: string; time: string }>({ date: '', time: '15:00' });
  const [month, setMonth] = useState(() => {
    const d = value ? new Date(value) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const open = (el: HTMLElement) => {
    if (disabled) return;
    const parts = value ? toLocalParts(value) : { date: '', time: '15:00' };
    setDraft(parts);
    const base = value ? new Date(value) : new Date();
    setMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    setAnchor(el);
  };
  const close = () => setAnchor(null);

  const todayKey = toLocalParts(new Date()).date;
  const cells = useMemo(() => {
    const first = (month.getDay() + 6) % 7; // lundi = 0
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [
      ...Array.from({ length: first }, () => null),
      ...Array.from(
        { length: days },
        (_, i) => `${month.getFullYear()}-${pad(month.getMonth() + 1)}-${pad(i + 1)}`
      ),
    ];
  }, [month]);

  const [hh, mm] = draft.time.split(':');
  const minuteOptions = MINUTES.includes(mm) ? MINUTES : [...MINUTES, mm].sort();
  const preview = draft.date
    ? display(fromLocalParts(draft.date, dateOnly ? '00:00' : draft.time))
    : '';

  const panel = (
    <Box sx={{ p: 2, width: mobile ? '100%' : 320 }}>
      <Typography variant="subtitle2" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 700, minHeight: 24, mb: 1, color: 'primary.main' }}>
        {preview || 'Choisissez un jour'}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton
          size="small"
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          aria-label="Mois precedent"
        >
          <ChevronLeft />
        </IconButton>
        <Typography sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
          {MONTH_NAMES_FR[month.getMonth()]} {month.getFullYear()}
        </Typography>
        <IconButton
          size="small"
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          aria-label="Mois suivant"
        >
          <ChevronRight />
        </IconButton>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5, mt: 1 }}>
        {DAYS.map((d, i) => (
          <Typography
            key={`h-${i}`}
            variant="caption"
            sx={{ textAlign: 'center', color: 'text.secondary', fontWeight: 600 }}
          >
            {d}
          </Typography>
        ))}
        {cells.map((key, i) =>
          key ? (
            <Button
              key={key}
              onClick={() => setDraft({ ...draft, date: key })}
              variant={draft.date === key ? 'contained' : key === todayKey ? 'outlined' : 'text'}
              sx={{
                minWidth: 0,
                p: 0,
                height: 38,
                borderRadius: 2,
                fontWeight: draft.date === key ? 700 : 500,
                color: draft.date === key ? 'white' : 'text.primary',
              }}
            >
              {Number(key.slice(-2))}
            </Button>
          ) : (
            <Box key={`e-${i}`} />
          )
        )}
      </Box>

      <Box sx={{ display: dateOnly ? 'none' : 'flex', gap: 1, mt: 2 }}>
        <FormControl size="small" fullWidth>
          <InputLabel>Heure</InputLabel>
          <Select
            label="Heure"
            value={hh}
            onChange={(e) => setDraft({ ...draft, time: `${e.target.value}:${mm}` })}
            MenuProps={{ PaperProps: { sx: { maxHeight: 260 } } }}
          >
            {HOURS.map((h) => (
              <MenuItem key={h} value={h}>
                {h} h
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" fullWidth>
          <InputLabel>Minutes</InputLabel>
          <Select
            label="Minutes"
            value={mm}
            onChange={(e) => setDraft({ ...draft, time: `${hh}:${e.target.value}` })}
          >
            {minuteOptions.map((m) => (
              <MenuItem key={m} value={m}>
                {m}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
        <Button
          color="inherit"
          onClick={() => {
            onChange(null);
            close();
          }}
        >
          Effacer
        </Button>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={close}>Annuler</Button>
          <Button
            variant="contained"
            disabled={!draft.date}
            onClick={() => {
              onChange(fromLocalParts(draft.date, dateOnly ? '00:00' : draft.time));
              close();
            }}
          >
            Valider
          </Button>
        </Box>
      </Box>
    </Box>
  );

  return (
    <>
      <TextField
        fullWidth
        size={size}
        label={label}
        value={value ? display(value) : ''}
        placeholder="Choisir une date"
        onClick={(e) => open(e.currentTarget)}
        disabled={disabled}
        helperText={helperText}
        InputLabelProps={{ shrink: true }}
        inputProps={{ readOnly: true, style: { cursor: disabled ? 'default' : 'pointer' } }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <CalendarMonth fontSize="small" color={value ? 'primary' : 'action'} />
            </InputAdornment>
          ),
          endAdornment:
            value && !disabled ? (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  aria-label="Effacer la date"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(null);
                  }}
                >
                  <Close fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : undefined,
        }}
      />
      {mobile ? (
        <Dialog open={!!anchor} onClose={close} fullWidth>
          {panel}
        </Dialog>
      ) : (
        <Popover
          open={!!anchor}
          anchorEl={anchor}
          onClose={close}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          PaperProps={{ sx: { borderRadius: 3, mt: 0.5 } }}
        >
          {panel}
        </Popover>
      )}
    </>
  );
}
