import { useState } from 'react';
import { Box, Button, IconButton, InputAdornment, TextField, Typography } from '@mui/material';
import { Add, Calculate, Delete, LocalShipping } from '@mui/icons-material';
import { color } from '../../theme/tokens';
import TransportCalculatorDialog from '../map/TransportCalculatorDialog';

/**
 * Frais supplémentaires d'une commande (transport, livraison, autre).
 * Estimés commande par commande, jamais un montant fixe : ils s'ajoutent au
 * total de la commande, pas au prix des recettes. L'emballage se choisit
 * article par article (« Emballage » dans chaque article).
 */
export interface FeeDraft {
  label: string;
  amount: string; // texte saisi (permet « 1, » ou « 2.5 » pendant la frappe)
}

export interface Fee {
  label: string;
  amount: number;
}

export const TRANSPORT_LABEL = 'Transport';

const parseAmount = (s: string) => parseFloat(String(s).replace(',', '.'));

/** Frais valides à envoyer : libellé non vide et montant > 0. */
export const toFees = (drafts: FeeDraft[]): Fee[] =>
  drafts
    .map((d) => ({ label: d.label.trim(), amount: parseAmount(d.amount) }))
    .filter((f) => f.label && Number.isFinite(f.amount) && f.amount > 0);

export const toDrafts = (fees: Fee[] = []): FeeDraft[] =>
  fees.map((f) => ({ label: f.label, amount: String(f.amount) }));

export default function FeesEditor({
  value,
  onChange,
}: {
  value: FeeDraft[];
  onChange: (next: FeeDraft[]) => void;
}) {
  const add = (label: string) => onChange([...value, { label, amount: '' }]);
  const has = (label: string) => value.some((f) => f.label.trim() === label);
  const update = (i: number, patch: Partial<FeeDraft>) =>
    onChange(value.map((f, fi) => (fi === i ? { ...f, ...patch } : f)));
  // Calculette transport (carte) : remplit le montant de la ligne choisie
  const [calcFor, setCalcFor] = useState<number | null>(null);

  return (
    <Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: value.length ? 1.5 : 0.5 }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<LocalShipping fontSize="small" />}
          disabled={has(TRANSPORT_LABEL)}
          onClick={() => add(TRANSPORT_LABEL)}
        >
          Transport
        </Button>
        <Button size="small" startIcon={<Add fontSize="small" />} onClick={() => add('')}>
          Autre frais
        </Button>
      </Box>
      {value.length === 0 && (
        <Typography variant="body2" sx={{ color: color.inkMuted }}>
          Transport, livraison… selon votre estimation pour cette commande.
        </Typography>
      )}
      {value.map((fee, i) => {
        const amount = parseAmount(fee.amount);
        const amountError = fee.amount !== '' && (!Number.isFinite(amount) || amount < 0);
        return (
          <Box
            key={i}
            sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1, alignItems: 'flex-start' }}
          >
            <TextField
              size="small"
              label="Libellé"
              value={fee.label}
              sx={{ flex: '2 1 130px', minWidth: 0 }}
              inputProps={{ maxLength: 60 }}
              onChange={(e) => update(i, { label: e.target.value })}
            />
            <TextField
              size="small"
              label="Montant"
              value={fee.amount}
              error={amountError}
              sx={{ flex: '1 1 110px', minWidth: 0 }}
              InputLabelProps={{ shrink: true }}
              inputProps={{ inputMode: 'decimal', 'aria-label': `Montant ${fee.label || 'frais'}` }}
              InputProps={{ endAdornment: <InputAdornment position="end">DT</InputAdornment> }}
              autoFocus={i === value.length - 1 && fee.amount === '' && !!fee.label}
              onChange={(e) => update(i, { amount: e.target.value })}
            />
            {fee.label.trim().toLowerCase().startsWith('transport') && (
              <IconButton
                size="small"
                color="primary"
                title="Calculer avec la carte"
                aria-label="Calculer le transport avec la carte"
                sx={{ mt: 0.5 }}
                onClick={() => setCalcFor(i)}
              >
                <Calculate fontSize="small" />
              </IconButton>
            )}
            <IconButton
              size="small"
              aria-label={`Retirer ${fee.label || 'ce frais'}`}
              sx={{ mt: 0.5 }}
              onClick={() => onChange(value.filter((_, fi) => fi !== i))}
            >
              <Delete fontSize="small" />
            </IconButton>
          </Box>
        );
      })}
      {calcFor !== null && (
        <TransportCalculatorDialog
          onClose={() => setCalcFor(null)}
          onApply={(amount) => update(calcFor, { amount: String(amount) })}
        />
      )}
    </Box>
  );
}
