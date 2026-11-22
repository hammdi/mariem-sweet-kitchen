import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  TextField,
  Typography,
} from '@mui/material';
import { ResponsiveDialog } from '../ui';
import MapView, { MapMarker } from './MapView';
import { tripTo, useTravel } from './useTravel';
import { formatKm, roundTrip } from '../../utils/geo';
import { color, radius } from '../../theme/tokens';

/**
 * Estimer le transport d'une commande : on coche les sources où il faut
 * passer, la tournée part du domicile et y revient (au plus proche d'abord).
 * Coût = km × coût au km de la voiture (Paramètres). Toujours modifiable.
 */
export default function TransportCalculatorDialog({
  onClose,
  onApply,
}: {
  onClose: () => void;
  onApply: (amount: number) => void;
}) {
  const navigate = useNavigate();
  const { info } = useTravel();
  const [picked, setPicked] = useState<string[]>([]);
  const [extraKm, setExtraKm] = useState('');

  const placed = useMemo(
    () =>
      (info?.sources || [])
        .filter((s) => s.location)
        .sort((a, b) => (tripTo(info, a.location)?.km ?? 0) - (tripTo(info, b.location)?.km ?? 0)),
    [info]
  );
  const stops = placed
    .filter((s) => picked.includes(s._id))
    .map((s) => ({ ...s.location!, name: s.name }));
  const trip = info?.home ? roundTrip(info.home, stops) : { km: 0, order: [] };
  const extra = parseFloat(extraKm.replace(',', '.')) || 0;
  const km = Math.round((trip.km + Math.max(0, extra)) * 10) / 10;
  const amount = info ? Math.round(km * info.perKm * 100) / 100 : 0;

  const markers: MapMarker[] = [
    ...(info?.home
      ? [{ id: 'home', position: info.home, kind: 'home' as const, label: 'Domicile' }]
      : []),
    ...placed.map((s) => ({
      id: s._id,
      position: s.location!,
      kind: picked.includes(s._id) ? ('source' as const) : ('muted' as const),
      label: s.name,
      onClick: () =>
        setPicked((p) => (p.includes(s._id) ? p.filter((x) => x !== s._id) : [...p, s._id])),
    })),
  ];

  const missingHome = info && !info.home;
  const missingCar = info && !(info.perKm > 0);

  return (
    <ResponsiveDialog
      open
      onClose={onClose}
      maxWidth="sm"
      title="Calculer le transport"
      subtitle="Cochez les endroits où passer : départ et retour au domicile. Distances estimées par la route (≈)."
      actions={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button
            variant="contained"
            disabled={!(amount > 0)}
            onClick={() => {
              onApply(amount);
              onClose();
            }}
          >
            {amount > 0 ? `Utiliser ${amount.toFixed(2)} DT` : 'Utiliser'}
          </Button>
        </>
      }
    >
      {!info ? (
        <Typography sx={{ color: color.inkSoft }}>Chargement…</Typography>
      ) : missingHome || missingCar ? (
        <Alert
          severity="info"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => navigate('/admin/settings?tab=commerce')}
            >
              Paramètres
            </Button>
          }
        >
          {missingHome
            ? 'Placez d’abord votre domicile sur la carte (Paramètres → Commerce).'
            : 'Renseignez la consommation de la voiture et le prix du litre (Paramètres → Commerce).'}
        </Alert>
      ) : (
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          {placed.length === 0 ? (
            <Alert
              severity="info"
              action={
                <Button color="inherit" size="small" onClick={() => navigate('/admin/sources')}>
                  Sources
                </Button>
              }
            >
              Aucune source placée sur la carte. Vous pouvez quand même ajouter des km ci-dessous.
            </Alert>
          ) : (
            <>
              <MapView markers={markers} fit height={220} />
              <Box sx={{ display: 'grid' }}>
                {placed.map((s) => {
                  const t = tripTo(info, s.location);
                  return (
                    <FormControlLabel
                      key={s._id}
                      control={
                        <Checkbox
                          checked={picked.includes(s._id)}
                          onChange={(e) =>
                            setPicked((p) =>
                              e.target.checked ? [...p, s._id] : p.filter((x) => x !== s._id)
                            )
                          }
                        />
                      }
                      label={
                        <Typography variant="body2">
                          <strong>{s.name}</strong>
                          <Box component="span" sx={{ color: color.inkSoft }}>
                            {t ? ` · seule : ≈ ${formatKm(t.km)} A/R, ${t.cost.toFixed(2)} DT` : ''}
                          </Box>
                        </Typography>
                      }
                    />
                  );
                })}
              </Box>
            </>
          )}
          <TextField
            size="small"
            label="Km en plus (livraison, détour…)"
            value={extraKm}
            onChange={(e) => setExtraKm(e.target.value)}
            inputProps={{ inputMode: 'decimal' }}
            sx={{ maxWidth: 260 }}
          />
          <Box
            sx={{
              p: 1.5,
              borderRadius: `${radius.md}px`,
              bgcolor: color.primarySoft,
              border: `1px solid ${color.primaryBorder}`,
            }}
            data-testid="transport-result"
          >
            <Typography variant="body2" sx={{ color: color.inkSoft }}>
              {trip.order.length
                ? `Domicile → ${trip.order.map((s) => s.name).join(' → ')} → Domicile`
                : 'Aucun arrêt coché'}
            </Typography>
            <Typography sx={{ fontWeight: 800, color: color.primaryDark }}>
              ≈ {formatKm(km)} × {info.perKm.toFixed(3)} DT/km = {amount.toFixed(2)} DT
            </Typography>
          </Box>
        </Box>
      )}
    </ResponsiveDialog>
  );
}
