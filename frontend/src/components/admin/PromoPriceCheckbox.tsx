import { Box, Checkbox, FormControlLabel, Typography } from '@mui/material';
import { color } from '../../theme/tokens';

/**
 * Achat chez une source : par défaut le prix payé devient le prix de cette
 * source (et la moyenne utilisée dans les recettes est recalculée).
 * Un prix promotionnel est un gain : il ne change pas le prix de la source.
 */
export default function PromoPriceCheckbox({
  checked,
  onChange,
  sourceName,
  compact = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  sourceName: string;
  compact?: boolean;
}) {
  return (
    <Box>
      <FormControlLabel
        sx={{ mr: 0 }}
        control={
          <Checkbox
            size={compact ? 'small' : 'medium'}
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
          />
        }
        label={
          <Typography variant={compact ? 'body2' : 'body1'} sx={{ fontWeight: 600 }}>
            Prix promotionnel
          </Typography>
        }
      />
      {!compact && (
        <Typography variant="caption" sx={{ display: 'block', color: color.inkSoft, mt: -0.5 }}>
          {checked
            ? `Le prix de ${sourceName} ne change pas : la promo est votre gain.`
            : `Ce prix devient le prix de ${sourceName} et la moyenne est recalculée.`}
        </Typography>
      )}
    </Box>
  );
}
