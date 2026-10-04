import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import api from '../../services/api';
import type { PurchaseSource, PurchaseSourceType } from '../../types/admin';
import { SOURCE_TYPE_LABELS } from '../../utils/format';

interface Props {
  open: boolean;
  source?: PurchaseSource | null;
  onClose: () => void;
  onSaved: (source: PurchaseSource) => void;
}

const emptyForm = {
  name: '',
  type: 'supermarket' as PurchaseSourceType,
  phone: '',
  address: '',
  city: '',
  contact: '',
  url: '',
  openingHours: '',
  delivers: false,
  notes: '',
};

export default function SourceFormDialog({ open, source, onClose, onSaved }: Props) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      source
        ? {
            name: source.name,
            type: source.type,
            phone: source.phone || '',
            address: source.address || '',
            city: source.city || '',
            contact: source.contact || '',
            url: source.url || '',
            openingHours: source.openingHours || '',
            delivers: source.delivers,
            notes: source.notes || '',
          }
        : emptyForm
    );
  }, [open, source]);

  const set = (field: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [field]: e.target.value });

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Le nom est obligatoire');
      return;
    }
    setSaving(true);
    try {
      const res = source
        ? await api.put(`/purchase-sources/${source._id}`, form)
        : await api.post('/purchase-sources', form);
      toast.success(source ? 'Source modifiée' : 'Source ajoutée');
      onSaved(res.data.data.source);
    } catch {
      /* toast deja affiche par l'intercepteur */
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <DialogTitle>{source ? 'Modifier la source' : "Nouvelle source d'achat"}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0 }}>
          <Grid item xs={12} sm={7}>
            <TextField
              fullWidth
              autoFocus
              label="Nom *"
              placeholder="Carrefour, MG, kiosque du coin..."
              value={form.name}
              onChange={set('name')}
            />
          </Grid>
          <Grid item xs={12} sm={5}>
            <FormControl fullWidth>
              <InputLabel>Type *</InputLabel>
              <Select
                label="Type *"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as PurchaseSourceType })}
              >
                {Object.entries(SOURCE_TYPE_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Téléphone"
              value={form.phone}
              onChange={set('phone')}
              inputProps={{ inputMode: 'tel' }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="Contact" value={form.contact} onChange={set('contact')} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="Ville / zone" value={form.city} onChange={set('city')} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Horaires"
              value={form.openingHours}
              onChange={set('openingHours')}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth label="Adresse" value={form.address} onChange={set('address')} />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth label="Site / lien (URL)" value={form.url} onChange={set('url')} />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.delivers}
                  onChange={(e) => setForm({ ...form, delivers: e.target.checked })}
                />
              }
              label="Livre a domicile"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              minRows={2}
              label="Notes"
              value={form.notes}
              onChange={set('notes')}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} size="large">
          Annuler
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving} size="large">
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
