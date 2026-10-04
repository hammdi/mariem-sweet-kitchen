import { Box, ButtonBase } from '@mui/material';
import { color, motion, radius } from '../../theme/tokens';

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

/** Filtres en pastilles (un seul choix). Retour à la ligne sur mobile, jamais de débordement. */
export default function FilterChips({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: FilterOption[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
}) {
  return (
    <Box role="radiogroup" aria-label={ariaLabel} sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <ButtonBase
            key={o.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            sx={{
              px: 1.5,
              py: 0.6,
              borderRadius: `${radius.pill}px`,
              border: `1px solid ${active ? color.primary : color.borderStrong}`,
              bgcolor: active ? color.primarySoft : color.surface,
              color: active ? color.primaryDark : color.inkSoft,
              fontWeight: 600,
              fontSize: '0.85rem',
              gap: 0.75,
              transition: `all ${motion.fast}ms ${motion.ease}`,
              '&:hover': { borderColor: color.primary },
            }}
          >
            {o.label}
            {typeof o.count === 'number' && (
              <Box
                component="span"
                sx={{
                  minWidth: 20,
                  px: 0.6,
                  borderRadius: `${radius.pill}px`,
                  bgcolor: active ? color.primary : color.bgSubtle,
                  color: active ? '#fff' : color.inkSoft,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  lineHeight: '20px',
                  textAlign: 'center',
                }}
              >
                {o.count}
              </Box>
            )}
          </ButtonBase>
        );
      })}
    </Box>
  );
}
