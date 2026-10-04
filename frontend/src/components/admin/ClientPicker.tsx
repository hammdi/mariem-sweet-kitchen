import { useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Paper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { Add, SwapHoriz } from '@mui/icons-material';
import api from '../../services/api';
import type { Client, ClientType } from '../../types/admin';
import { CLIENT_TYPE_LABELS, formatPhone } from '../../utils/format';
import ClientFormDialog from './ClientFormDialog';

interface Props {
  value: Client | null;
  onChange: (client: Client | null) => void;
}

const ClientInfo = ({ client }: { client: Client }) => (
  <Box>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <Typography sx={{ fontWeight: 700, fontSize: '1.05rem' }}>{client.name}</Typography>
      <Chip
        size="small"
        label={CLIENT_TYPE_LABELS[client.type]}
        color={client.type === 'cafe' ? 'secondary' : 'default'}
      />
    </Box>
    <Typography variant="body2">{formatPhone(client.phone)}</Typography>
    {client.contactPerson && (
      <Typography variant="body2" color="text.secondary">
        Contact : {client.contactPerson}
      </Typography>
    )}
    {client.address && (
      <Typography variant="body2" color="text.secondary">
        {client.address}
      </Typography>
    )}
    {client.conditions && (
      <Typography variant="body2" color="text.secondary">
        Conditions : {client.conditions}
      </Typography>
    )}
    {client.notes && (
      <Typography variant="body2" color="text.secondary">
        Notes : {client.notes}
      </Typography>
    )}
  </Box>
);

// Recherche d'un client existant (nom ou téléphone) ou création d'un nouveau
export default function ClientPicker({ value, onChange }: Props) {
  const [type, setType] = useState<ClientType>('individual');
  const [input, setInput] = useState('');
  const [options, setOptions] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Client | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (value) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get('/clients', {
          params: { search: input.trim() || undefined, type, limit: 10 },
        });
        setOptions(res.data.data?.clients || []);
      } catch {
        /* ignore */
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [input, type, value]);

  // Pre-remplir le nouveau client avec ce qui a ete tape dans la recherche
  const prefill = useMemo(() => {
    const text = input.trim();
    if (!text) return undefined;
    return /^[\d\s+()-]+$/.test(text) ? { phone: text } : { name: text };
  }, [input]);

  const use = (client: Client) => {
    setPreview(null);
    setDialogOpen(false);
    onChange(client);
  };

  if (value) {
    return (
      <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#f1f8e9', borderColor: '#aed581' }}>
        <ClientInfo client={value} />
        <Button
          size="small"
          startIcon={<SwapHoriz />}
          onClick={() => onChange(null)}
          sx={{ mt: 1 }}
        >
          Changer de client
        </Button>
      </Paper>
    );
  }

  return (
    <Box>
      <ToggleButtonGroup
        exclusive
        fullWidth
        color="primary"
        size="small"
        value={type}
        onChange={(_, v) => {
          if (v) {
            setType(v);
            setPreview(null);
          }
        }}
        sx={{ mb: 1.5 }}
      >
        <ToggleButton value="individual" sx={{ py: 1 }}>
          Particulier
        </ToggleButton>
        <ToggleButton value="cafe" sx={{ py: 1 }}>
          Café
        </ToggleButton>
      </ToggleButtonGroup>

      <Autocomplete
        options={options}
        loading={loading}
        filterOptions={(x) => x}
        value={preview}
        inputValue={input}
        onInputChange={(_, v, reason) => reason !== 'reset' && setInput(v)}
        // Choisir un client dans la liste le retient directement (ses infos s'affichent,
        // "Changer de client" permet de revenir) : plus d'etape cachee avant de pouvoir creer
        onChange={(_, v) => v && use(v)}
        getOptionLabel={(c) => `${c.name} — ${formatPhone(c.phone)}`}
        isOptionEqualToValue={(a, b) => a._id === b._id}
        noOptionsText={input ? 'Aucun client trouve' : 'Aucun client enregistré'}
        renderOption={(props, c) => (
          <li {...props} key={c._id}>
            <Box>
              <Typography sx={{ fontWeight: 600 }}>{c.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {formatPhone(c.phone)}
                {c.contactPerson ? ` · ${c.contactPerson}` : ''}
              </Typography>
            </Box>
          </li>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            label={type === 'cafe' ? 'Rechercher un café (nom ou tél.)' : 'Rechercher (nom ou tél.)'}
          />
        )}
      />

      <Button
        variant="outlined"
        fullWidth
        startIcon={<Add />}
        onClick={() => setDialogOpen(true)}
        sx={{ mt: 1.5, py: 1 }}
      >
        Nouveau client
      </Button>

      <ClientFormDialog
        open={dialogOpen}
        defaultType={type}
        prefill={prefill}
        onClose={() => setDialogOpen(false)}
        onSaved={use}
        onUseExisting={use}
      />
    </Box>
  );
}
