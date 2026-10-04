import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui';
import { Storefront } from '@mui/icons-material';
import { toast } from 'react-toastify';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import { Add, Delete, Edit, Language, Phone, Search } from '@mui/icons-material';
import api from '../../services/api';
import SourceFormDialog from '../../components/admin/SourceFormDialog';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import type { PurchaseSource, PurchaseSourceType } from '../../types/admin';
import { SOURCE_TYPE_LABELS } from '../../utils/format';

const PurchaseSourcesPage = () => {
  const [sources, setSources] = useState<PurchaseSource[]>([]);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<PurchaseSourceType | ''>('');
  const [dialog, setDialog] = useState<{ open: boolean; source: PurchaseSource | null }>({
    open: false,
    source: null,
  });
  const [archiveTarget, setArchiveTarget] = useState<PurchaseSource | null>(null);

  const load = async () => {
    try {
      const res = await api.get('/purchase-sources');
      setSources(res.data.data?.sources || []);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    load();
  }, []);

  const archive = async () => {
    if (!archiveTarget) return;
    try {
      await api.delete(`/purchase-sources/${archiveTarget._id}`);
      toast.success('Source archivee (ses prix restent dans l historique)');
      setArchiveTarget(null);
      load();
    } catch {
      /* ignore */
    }
  };

  const filtered = sources
    .filter((s) => !type || s.type === type)
    .filter(
      (s) =>
        !search || `${s.name} ${s.city || ''}`.toLowerCase().includes(search.trim().toLowerCase())
    );

  return (
    <Box>
      <PageHeader
        title="Sources d'achat"
        subtitle="Fournisseurs, grandes surfaces, magasins… Les prix par ingrédient se saisissent sur la fiche de chaque ingrédient."
        icon={<Storefront />}
        tone="info"
        backTo="/admin/ingredients"
        actions={
          <Button variant="contained" startIcon={<Add />} onClick={() => setDialog({ open: true, source: null })}>
            Ajouter
          </Button>
        }
      />
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Fournisseurs, grandes surfaces, magasins, kiosques... Les prix par ingredient se
          saisissent depuis la page de chaque ingredient.
        </Typography>
        <TextField
          fullWidth
          placeholder="Rechercher une source..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2, bgcolor: 'white' }}
        />
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Chip
            label="Toutes"
            color={type === '' ? 'primary' : 'default'}
            variant={type === '' ? 'filled' : 'outlined'}
            onClick={() => setType('')}
            clickable
          />
          {Object.entries(SOURCE_TYPE_LABELS).map(([value, label]) => (
            <Chip
              key={value}
              label={`${label} (${sources.filter((s) => s.type === value).length})`}
              color={type === value ? 'primary' : 'default'}
              variant={type === value ? 'filled' : 'outlined'}
              onClick={() => setType(value as PurchaseSourceType)}
              clickable
            />
          ))}
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {filtered.map((s) => (
            <Card key={s._id} variant="outlined">
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 1,
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Typography sx={{ fontWeight: 700 }}>{s.name}</Typography>
                      <Chip size="small" label={SOURCE_TYPE_LABELS[s.type]} variant="outlined" />
                      {s.delivers && <Chip size="small" label="Livre" color="success" />}
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {[s.city, s.address, s.contact, s.openingHours].filter(Boolean).join(' · ')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {s.ingredientCount || 0} ingredient(s) avec un prix
                    </Typography>
                    {s.notes && (
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        {s.notes}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', flexShrink: 0 }}>
                    {s.phone && (
                      <IconButton href={`tel:${s.phone}`} title="Appeler">
                        <Phone />
                      </IconButton>
                    )}
                    {s.url && (
                      <IconButton href={s.url} target="_blank" rel="noopener" title="Site">
                        <Language />
                      </IconButton>
                    )}
                    <IconButton
                      onClick={() => setDialog({ open: true, source: s })}
                      title="Modifier"
                    >
                      <Edit />
                    </IconButton>
                    <IconButton onClick={() => setArchiveTarget(s)} title="Archiver">
                      <Delete />
                    </IconButton>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <Typography sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
              Aucune source. Cliquez sur "Ajouter" pour enregistrer un magasin ou un fournisseur.
            </Typography>
          )}
        </Box>
      </Box>

      <SourceFormDialog
        open={dialog.open}
        source={dialog.source}
        onClose={() => setDialog({ open: false, source: null })}
        onSaved={() => {
          setDialog({ open: false, source: null });
          load();
        }}
      />
      <ConfirmDialog
        open={!!archiveTarget}
        title="Archiver cette source ?"
        message="Elle ne sera plus proposee et ses prix ne compteront plus dans les moyennes. L'historique est conserve."
        confirmLabel="Archiver"
        onConfirm={archive}
        onCancel={() => setArchiveTarget(null)}
      />
    </Box>
  );
};

export default PurchaseSourcesPage;
