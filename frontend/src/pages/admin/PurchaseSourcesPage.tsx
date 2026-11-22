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
import { Add, Delete, Edit, Language, Phone, Place, Search } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import MapView, { MapMarker } from '../../components/map/MapView';
import LocationPickerDialog from '../../components/map/LocationPickerDialog';
import { tripTo, useTravel } from '../../components/map/useTravel';
import { formatKm } from '../../utils/geo';
import { color } from '../../theme/tokens';
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
  const [placeTarget, setPlaceTarget] = useState<PurchaseSource | null>(null);
  const [sortBy, setSortBy] = useState<'distance' | 'name'>('distance');
  const { info: travel, reload: reloadTravel } = useTravel();
  const navigate = useNavigate();

  const load = async () => {
    try {
      const res = await api.get('/purchase-sources');
      setSources(res.data.data?.sources || []);
    } catch {
      /* ignore */
    }
    reloadTravel();
  };

  const savePlace = async (p: { lat: number; lng: number } | null) => {
    if (!placeTarget) return;
    try {
      await api.put(`/purchase-sources/${placeTarget._id}`, { location: p });
      toast.success(p ? `${placeTarget.name} placée sur la carte` : 'Position retirée');
      setPlaceTarget(null);
      load();
    } catch {
      /* toast intercepteur */
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // une fois à l'ouverture

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
    )
    .sort((a, b) => {
      if (sortBy === 'distance' && travel?.home) {
        const da = tripTo(travel, a.location)?.km ?? Infinity;
        const db = tripTo(travel, b.location)?.km ?? Infinity;
        if (da !== db) return da - db;
      }
      return a.name.localeCompare(b.name);
    });
  const nearestId = travel?.home ? filtered.find((s) => s.location)?._id : undefined;

  const markers: MapMarker[] = [
    ...(travel?.home
      ? [{ id: 'home', position: travel.home, kind: 'home' as const, label: 'Domicile' }]
      : []),
    ...filtered
      .filter((s) => s.location)
      .map((s) => {
        const trip = tripTo(travel, s.location);
        return {
          id: s._id,
          position: s.location!,
          kind: 'source' as const,
          label: s.name,
          tooltip: trip
            ? `aller-retour ≈ ${formatKm(trip.km)}${trip.cost ? ` · ${trip.cost.toFixed(2)} DT` : ''}`
            : undefined,
        };
      }),
  ];

  return (
    <Box>
      <PageHeader
        title="Sources d'achat"
        subtitle="Fournisseurs, grandes surfaces, magasins… Les prix par ingrédient se saisissent sur la fiche de chaque ingrédient."
        icon={<Storefront />}
        tone="info"
        backTo="/admin/ingredients"
        actions={
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setDialog({ open: true, source: null })}
          >
            Ajouter
          </Button>
        }
      />
      <Box>
        {/* Carte : domicile + sources */}
        <Card sx={{ p: { xs: 1.5, md: 2 }, mb: 2 }} data-testid="sources-map">
          {markers.length > 0 ? (
            <MapView markers={markers} fit height={{ xs: 280, md: 380 }} />
          ) : (
            <Box sx={{ p: 3, textAlign: 'center', color: color.inkSoft }}>
              🗺️ Placez votre domicile et vos sources sur la carte pour voir lesquelles sont les
              plus proches.
            </Box>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1.25, flexWrap: 'wrap' }}>
            <Typography variant="caption" sx={{ color: color.inkSoft, flex: 1, minWidth: 200 }}>
              🏠 Domicile · 🏪 Source · distances estimées par la route (≈)
              {travel && travel.perKm > 0
                ? ` · ${travel.perKm.toFixed(3)} DT/km`
                : ' · coût : renseignez la voiture dans Paramètres'}
            </Typography>
            {(!travel?.home || !(travel.perKm > 0)) && (
              <Button size="small" onClick={() => navigate('/admin/settings?tab=commerce')}>
                {travel?.home ? 'Renseigner la voiture' : 'Placer mon domicile'}
              </Button>
            )}
          </Box>
        </Card>

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
          {travel?.home && (
            <Chip
              label={sortBy === 'distance' ? 'Tri : plus proches' : 'Tri : nom'}
              color="secondary"
              variant="outlined"
              onClick={() => setSortBy(sortBy === 'distance' ? 'name' : 'distance')}
              clickable
            />
          )}
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
                    {(() => {
                      const trip = tripTo(travel, s.location);
                      if (trip) {
                        return (
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 600, color: color.infoDark, mt: 0.25 }}
                          >
                            📍 aller-retour ≈ {formatKm(trip.km)}
                            {trip.cost > 0 ? ` · trajet ≈ ${trip.cost.toFixed(2)} DT` : ''}
                            {s._id === nearestId && (
                              <Chip
                                size="small"
                                color="success"
                                label="La plus proche"
                                sx={{ ml: 1, height: 20 }}
                              />
                            )}
                          </Typography>
                        );
                      }
                      return (
                        <Typography variant="body2" sx={{ color: color.inkMuted, mt: 0.25 }}>
                          {s.location ? '📍 placée sur la carte' : 'Pas encore placée sur la carte'}
                        </Typography>
                      );
                    })()}
                    <Typography variant="caption" color="text.secondary">
                      {s.ingredientCount || 0} ingrédient(s) avec un prix
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
                      onClick={() => setPlaceTarget(s)}
                      title={s.location ? 'Modifier la position' : 'Placer sur la carte'}
                      color={s.location ? 'default' : 'primary'}
                      aria-label={`Placer ${s.name} sur la carte`}
                    >
                      <Place />
                    </IconButton>
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
      <LocationPickerDialog
        open={!!placeTarget}
        title={placeTarget ? `Position de ${placeTarget.name}` : ''}
        initial={placeTarget?.location}
        near={travel?.home}
        onClose={() => setPlaceTarget(null)}
        onSave={savePlace}
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
