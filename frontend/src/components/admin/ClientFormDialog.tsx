import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import api from '../../services/api';
import type { Client, ClientType } from '../../types/admin';
import { formatPhone } from '../../utils/format';

interface Props {
  open: boolean;
  client?: Client | null; // modification si fourni
  defaultType?: ClientType;
  prefill?: { name?: string; phone?: string };
  onClose: () => void;
  onSaved: (client: Client) => void;
  // Numero deja enregistre : proposer d'utiliser le client existant
  onUseExisting?: (client: Client) => void;
}

const emptyForm = {
  type: 'individual' as ClientType,
  name: '',
  phone: '',
  address: '',
  contactPerson: '',
  conditions: '',
  notes: '',
};

export default function ClientFormDialog({
  open,
  client,
  defaultType = 'individual',
  prefill,
  onClose,
  onSaved,
  onUseExisting,
}: Props) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<Client | null>(null);

  useEffect(() => {
    if (!open) return;
    setExisting(null);
    if (client) {
      setForm({
        type: client.type,
        name: client.name,
        phone: formatPhone(client.phone),
        address: client.address || '',
        contactPerson: client.contactPerson || '',
        conditions: client.conditions || '',
        notes: client.notes || '',
      });
    } else {
      setForm({ ...emptyForm, type: defaultType, ...prefill });
    }
  }, [open, client, defaultType, prefill]);

  const isCafe = form.type === 'cafe';
  const set = (field: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [field]: e.target.value });

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error(
        isCafe ? 'Nom du café et téléphone obligatoires' : 'Nom et téléphone obligatoires'
      );
      return;
    }
    setSaving(true);
    try {
      const body = {
        ...form,
        // champs propres aux cafes : vides pour un particulier
        contactPerson: isCafe ? form.contactPerson : '',
        conditions: isCafe ? form.conditions : '',
      };
      const res = client
        ? await api.put(`/clients/${client._id}`, body)
        : await api.post('/clients', body);
      toast.success(client ? 'Client modifié' : 'Client enregistré');
      onSaved(res.data.data.client);
    } catch (err: any) {
      if (err.response?.status === 409 && err.response.data?.data?.client) {
        setExisting(err.response.data.data.client);
      }
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <DialogTitle>{client ? 'Modifier le client' : 'Nouveau client'}</DialogTitle>
      <DialogContent>
        <ToggleButtonGroup
          exclusive
          fullWidth
          color="primary"
          value={form.type}
          onChange={(_, v) => v && setForm({ ...form, type: v })}
          sx={{ mt: 1, mb: 2 }}
        >
          <ToggleButton value="individual" sx={{ py: 1.2 }}>
            Particulier
          </ToggleButton>
          <ToggleButton value="cafe" sx={{ py: 1.2 }}>
            Café / professionnel
          </ToggleButton>
        </ToggleButtonGroup>

        <TextField
          fullWidth
          autoFocus
          label={isCafe ? 'Nom du café *' : 'Nom *'}
          value={form.name}
          onChange={set('name')}
          sx={{ mb: 2 }}
        />
        <TextField
          fullWidth
          label={isCafe ? 'Téléphone / contact *' : 'Téléphone *'}
          value={form.phone}
          onChange={set('phone')}
          placeholder="22 123 456"
          inputProps={{ inputMode: 'tel' }}
          sx={{ mb: 2 }}
        />

        {existing && (
          <Alert
            severity="warning"
            sx={{ mb: 2 }}
            action={
              onUseExisting ? (
                <Button color="inherit" size="small" onClick={() => onUseExisting(existing)}>
                  Utiliser ce client
                </Button>
              ) : undefined
            }
          >
            Ce numero est deja enregistre : <strong>{existing.name}</strong> (
            {formatPhone(existing.phone)})
          </Alert>
        )}

        {isCafe && (
          <TextField
            fullWidth
            label="Personne de contact"
            value={form.contactPerson}
            onChange={set('contactPerson')}
            sx={{ mb: 2 }}
          />
        )}
        <TextField
          fullWidth
          label="Adresse"
          value={form.address}
          onChange={set('address')}
          sx={{ mb: 2 }}
        />
        {isCafe && (
          <TextField
            fullWidth
            multiline
            minRows={2}
            label="Conditions particulieres"
            placeholder="Livraison, jour habituel, paiement..."
            value={form.conditions}
            onChange={set('conditions')}
            sx={{ mb: 2 }}
          />
        )}
        <TextField
          fullWidth
          multiline
          minRows={2}
          label="Notes"
          value={form.notes}
          onChange={set('notes')}
        />
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Le numero est enregistre au format +216 : "22 123 456" et "+216 22 123 456" sont le meme
            client.
          </Typography>
        </Box>
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
