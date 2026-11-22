import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import { MyLocation, Search } from '@mui/icons-material';
import { ResponsiveDialog } from '../ui';
import MapView, { DEFAULT_CENTER } from './MapView';
import { LatLng, parseLocationText } from '../../utils/geo';
import { color, radius } from '../../theme/tokens';

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
}

/**
 * Placer un lieu sur la carte : cliquer sur la carte, déplacer le repère,
 * chercher une adresse, « Ma position », ou coller un lien Google Maps.
 */
export default function LocationPickerDialog({
  open,
  title,
  initial,
  near,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  initial: LatLng | null | undefined;
  near?: LatLng | null; // centre si aucun lieu (ex : domicile)
  onClose: () => void;
  onSave: (p: LatLng | null) => void | Promise<void>;
}) {
  const [pos, setPos] = useState<LatLng | null>(null);
  const [focus, setFocus] = useState<LatLng | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPos(initial || null);
      setFocus(null);
      setQuery('');
      setResults(null);
      setLink('');
      setError('');
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const place = (p: LatLng) => {
    setPos({ lat: Math.round(p.lat * 1e6) / 1e6, lng: Math.round(p.lng * 1e6) / 1e6 });
    setFocus(p);
    setError('');
  };

  // Recherche d'adresse (OpenStreetMap Nominatim) : seul le texte tapé est envoyé
  const search = async () => {
    if (query.trim().length < 3) return;
    setSearching(true);
    setResults(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=tn&accept-language=fr&q=${encodeURIComponent(query.trim())}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      setResults(res.ok ? await res.json() : []);
    } catch {
      setResults([]);
    }
    setSearching(false);
  };

  const myPosition = () => {
    if (!navigator.geolocation) {
      setError('Ce navigateur ne donne pas la position.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => place({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setError('Position refusée ou indisponible. Cliquez plutôt sur la carte.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(pos);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      title={title}
      subtitle="Cliquez sur la carte, cherchez l’adresse, ou collez un lien Google Maps. Le repère se déplace au doigt."
      actions={
        <>
          {initial && (
            <Button color="error" sx={{ mr: 'auto' }} onClick={() => setPos(null)} disabled={!pos}>
              Retirer la position
            </Button>
          )}
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="contained" onClick={save} disabled={saving || (!pos && !initial)}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </>
      }
    >
      <Box sx={{ display: 'grid', gap: 1.5 }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            sx={{ flex: '1 1 240px' }}
            placeholder="Adresse, quartier, magasin… (ex : Carrefour La Marsa)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            inputProps={{ 'aria-label': 'Chercher une adresse' }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="outlined"
            onClick={search}
            disabled={searching || query.trim().length < 3}
          >
            {searching ? <CircularProgress size={18} /> : 'Chercher'}
          </Button>
          <Button startIcon={<MyLocation />} onClick={myPosition}>
            Ma position
          </Button>
        </Box>

        {results && (
          <Box
            sx={{
              border: `1px solid ${color.border}`,
              borderRadius: `${radius.md}px`,
              overflow: 'hidden',
            }}
          >
            {results.length === 0 ? (
              <Typography variant="body2" sx={{ p: 1.5, color: color.inkSoft }}>
                Adresse introuvable. Cliquez directement sur la carte ou collez un lien Google Maps.
              </Typography>
            ) : (
              results.map((r) => (
                <ButtonBase
                  key={`${r.lat},${r.lon}`}
                  onClick={() => {
                    place({ lat: parseFloat(r.lat), lng: parseFloat(r.lon) });
                    setResults(null);
                  }}
                  sx={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    px: 1.5,
                    py: 1,
                    fontSize: '0.875rem',
                    borderBottom: `1px solid ${color.border}`,
                    '&:hover': { bgcolor: color.primarySoft },
                  }}
                >
                  {r.display_name}
                </ButtonBase>
              ))
            )}
          </Box>
        )}

        <TextField
          size="small"
          label="…ou collez un lien Google Maps / des coordonnées"
          placeholder="https://maps.app.goo.gl/… ou 36.8065, 10.1815"
          value={link}
          onChange={(e) => {
            setLink(e.target.value);
            const p = parseLocationText(e.target.value);
            if (p) place(p);
            else if (e.target.value.trim())
              setError(
                /goo\.gl|maps\.app/.test(e.target.value)
                  ? 'Lien court : ouvrez-le dans le navigateur puis copiez l’adresse complète de la page.'
                  : 'Lien non reconnu.'
              );
            else setError('');
          }}
        />

        {error && <Alert severity="warning">{error}</Alert>}

        <MapView
          height={{ xs: 300, md: 380 }}
          center={pos || initial || near || DEFAULT_CENTER}
          focus={focus}
          onMapClick={place}
          draggableId="picked"
          onDragEnd={place}
          markers={
            pos
              ? [
                  {
                    id: 'picked',
                    position: pos,
                    kind: 'selected',
                    label: 'Position choisie',
                    tooltip: 'déplacez-moi si besoin',
                  },
                ]
              : []
          }
        />
        <Typography variant="caption" sx={{ color: color.inkSoft }}>
          {pos
            ? `Position : ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`
            : 'Aucune position : cliquez sur la carte pour placer le repère.'}
        </Typography>
      </Box>
    </ResponsiveDialog>
  );
}
