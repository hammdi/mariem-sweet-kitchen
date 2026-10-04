import { Box, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';

export type PurchasePaymentMethod = 'cash_register' | 'personal' | 'bank' | 'other';

const OPTIONS: { value: PurchasePaymentMethod; label: string }[] = [
  { value: 'cash_register', label: '💵 Caisse' },
  { value: 'personal', label: '👤 Argent personnel' },
  { value: 'bank', label: '🏦 Banque' },
  { value: 'other', label: 'Autre' },
];

// Choix du moyen de paiement d'un achat ou d'une dépense (seule la caisse fait une sortie de caisse)
export default function PurchasePaymentSelect({
  value,
  onChange,
  amount,
}: {
  value: PurchasePaymentMethod;
  onChange: (v: PurchasePaymentMethod) => void;
  amount?: number; // pour annoncer l'effet sur la caisse
}) {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
        Moyen de paiement
      </Typography>
      <ToggleButtonGroup
        exclusive
        color="primary"
        size="small"
        value={value}
        onChange={(_, v) => v && onChange(v)}
        sx={{
          flexWrap: 'wrap',
          gap: 0.5,
          '& .MuiToggleButton-root': {
            borderRadius: '10px !important',
            border: '1px solid #E2D4C2 !important',
            textTransform: 'none',
            px: 1.25,
          },
          '& .MuiToggleButton-root.Mui-selected': { borderColor: '#F1770A !important' },
        }}
      >
        {OPTIONS.map((o) => (
          <ToggleButton key={o.value} value={o.value}>
            {o.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        {value === 'cash_register'
          ? `La caisse baisse${amount && amount > 0 ? ` de ${amount.toFixed(2)} DT` : ''}.`
          : 'La caisse ne bouge pas : l’achat est seulement noté avec ce moyen de paiement.'}
      </Typography>
    </Box>
  );
}
