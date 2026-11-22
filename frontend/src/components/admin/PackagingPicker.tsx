import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, ButtonBase, IconButton, TextField, Typography } from '@mui/material';
import { Add, Close, Remove } from '@mui/icons-material';
import api from '../../services/api';
import { color, radius, transition } from '../../theme/tokens';
import { formatDT } from '../../utils/format';
import {
  defaultPackagingQuantity,
  PackagingChoice,
  PackagingOption,
  packagingTypeOf,
  packagingUnitCost,
  PACKAGING_USE_LABELS,
} from '../../utils/packaging';

/** Emballages disponibles (boîtes, sachets, caissettes…), chargés une fois. */
export function usePackagingOptions() {
  const [options, setOptions] = useState<PackagingOption[] | null>(null);
  useEffect(() => {
    let alive = true;
    api
      .get('/ingredients?kind=packaging&limit=200')
      .then((res) => alive && setOptions(res.data.data?.ingredients || []))
      .catch(() => alive && setOptions([]));
    return () => {
      alive = false;
    };
  }, []);
  return options;
}

const short = (n: number) => String(parseFloat(n.toFixed(3)));

/**
 * Choix de l'emballage d'UN article : un clic sur une suggestion l'ajoute avec
 * la bonne quantité (1 par article, ou 1 par portion), modifiable ensuite.
 */
export default function PackagingPicker({
  value,
  onChange,
  options,
  portions,
  itemQuantity = 1,
  disabled = false,
}: {
  value: PackagingChoice[];
  onChange: (next: PackagingChoice[]) => void;
  options: PackagingOption[] | null;
  portions: number;
  itemQuantity?: number;
  disabled?: boolean;
}) {
  const navigate = useNavigate();
  const list = options || [];
  const chosen = value
    .map((c) => ({ choice: c, option: list.find((o) => o._id === c.packagingId) }))
    .filter((x): x is { choice: PackagingChoice; option: PackagingOption } => !!x.option);
  const available = list.filter((o) => !value.some((c) => c.packagingId === o._id));
  const unitCost = packagingUnitCost(value, list);

  const setQty = (id: string, quantity: number) =>
    onChange(
      value.map((c) =>
        c.packagingId === id
          ? { ...c, quantity: Math.max(0, Math.round(quantity * 1000) / 1000) }
          : c
      )
    );

  if (options && options.length === 0) {
    return (
      <Box
        sx={{
          p: 1.5,
          borderRadius: `${radius.md}px`,
          border: `1px dashed ${color.borderStrong}`,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="body2" sx={{ color: color.inkSoft, flex: 1, minWidth: 180 }}>
          Aucun emballage enregistré. Ajoutez vos boîtes, sachets, caissettes… avec leur prix.
        </Typography>
        <Button size="small" variant="outlined" onClick={() => navigate('/admin/packaging')}>
          Mes emballages
        </Button>
      </Box>
    );
  }

  return (
    <Box data-testid="packaging-picker">
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          Emballage
        </Typography>
        <Typography
          variant="body2"
          sx={{ fontWeight: 700, color: unitCost > 0 ? color.primaryDark : color.inkMuted }}
        >
          {unitCost > 0
            ? `${formatDT(unitCost, 3)} / article${itemQuantity > 1 ? ` · ${formatDT(unitCost * itemQuantity)} au total` : ''}`
            : 'aucun'}
        </Typography>
      </Box>

      {chosen.map(({ choice, option }) => {
        const type = packagingTypeOf(option.packagingType);
        return (
          <Box
            key={option._id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap', // téléphone : quantité et prix passent à la ligne
              columnGap: 1,
              rowGap: 0.5,
              p: 1,
              mb: 0.75,
              borderRadius: `${radius.md}px`,
              bgcolor: color.primarySoft,
              border: `1px solid ${color.primaryBorder}`,
            }}
          >
            <Box sx={{ fontSize: 20, lineHeight: 1 }} aria-hidden>
              {type.emoji}
            </Box>
            <Box sx={{ flex: '1 1 130px', minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                {option.name}
              </Typography>
              <Typography variant="caption" sx={{ color: color.inkSoft }}>
                {formatDT(option.pricePerUnit, 3)} pièce
                {option.packagingUse === 'per_portion' ? ` · ${portions} portions` : ''}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', ml: 'auto', gap: 0.5 }}>
              <IconButton
                size="small"
                aria-label={`Moins de ${option.name}`}
                disabled={disabled || choice.quantity <= 1}
                onClick={() => setQty(option._id, choice.quantity - 1)}
              >
                <Remove fontSize="small" />
              </IconButton>
              <TextField
                size="small"
                value={short(choice.quantity)}
                disabled={disabled}
                onChange={(e) => {
                  const n = parseFloat(e.target.value.replace(',', '.'));
                  setQty(option._id, Number.isFinite(n) ? n : 0);
                }}
                inputProps={{
                  inputMode: 'decimal',
                  'aria-label': `Quantité de ${option.name} par article`,
                  style: { textAlign: 'center', padding: '6px 4px' },
                }}
                sx={{ width: 56 }}
              />
              <IconButton
                size="small"
                aria-label={`Plus de ${option.name}`}
                disabled={disabled}
                onClick={() => setQty(option._id, choice.quantity + 1)}
              >
                <Add fontSize="small" />
              </IconButton>
              <Typography
                variant="body2"
                sx={{ fontWeight: 700, minWidth: 64, textAlign: 'right', whiteSpace: 'nowrap' }}
              >
                {formatDT(option.pricePerUnit * choice.quantity, 3)}
              </Typography>
              <IconButton
                size="small"
                aria-label={`Retirer ${option.name}`}
                disabled={disabled}
                onClick={() => onChange(value.filter((c) => c.packagingId !== option._id))}
              >
                <Close fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        );
      })}

      {!disabled && available.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: chosen.length ? 1 : 0 }}>
          {available.map((o) => {
            const type = packagingTypeOf(o.packagingType);
            const qty = defaultPackagingQuantity(o, portions);
            return (
              <ButtonBase
                key={o._id}
                onClick={() => onChange([...value, { packagingId: o._id, quantity: qty }])}
                title={PACKAGING_USE_LABELS[o.packagingUse || 'per_item'].long}
                sx={{
                  px: 1.25,
                  py: 0.6,
                  gap: 0.75,
                  borderRadius: `${radius.pill}px`,
                  border: `1px solid ${color.borderStrong}`,
                  bgcolor: color.surface,
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: color.ink,
                  transition: transition(['background-color', 'border-color']),
                  '&:hover': { bgcolor: color.primarySoft, borderColor: color.primary },
                }}
              >
                <Add sx={{ fontSize: 16, color: color.primary }} />
                <span aria-hidden>{type.emoji}</span>
                {o.name}
                <Box component="span" sx={{ color: color.inkSoft, fontWeight: 500 }}>
                  {qty > 1 ? `× ${qty} · ` : ''}
                  {formatDT(o.pricePerUnit * qty, 2)}
                </Box>
              </ButtonBase>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
