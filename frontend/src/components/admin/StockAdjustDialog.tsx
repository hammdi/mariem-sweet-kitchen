import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Box, Button, ButtonBase, TextField, Typography } from '@mui/material';
import api, { withIdempotency } from '../../services/api';
import { useIdempotentAction } from '../../hooks/useIdempotencyKey';
import { ResponsiveDialog } from '../ui';
import { color, radius } from '../../theme/tokens';
import { formatQty, STOCK_REASON_LABELS } from '../../utils/format';

export interface StockTarget {
  _id: string;
  name: string;
  unit: string;
  stockQuantity?: number;
}

const unitLabel = (unit: string, n = 2) => (unit === 'piece' ? (n > 1 ? 'pièces' : 'pièce') : unit);

/**
 * Corriger le stock à la main (inventaire, perte, casse…) : raison obligatoire,
 * notée dans l'historique, enregistrée une seule fois même en cas de double clic.
 * Pour un achat (stock + caisse + prix de la source), utiliser « Enregistrer un achat ».
 */
export default function StockAdjustDialog({
  target,
  onClose,
  onSaved,
}: {
  target: StockTarget | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [newQty, setNewQty] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const op = useIdempotentAction();

  useEffect(() => {
    if (target) {
      op.reset();
      setNewQty(String(target.stockQuantity || 0));
      setReason('');
      setNote('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?._id]);

  const qty = parseFloat(newQty.replace(',', '.'));
  const diff = target ? Math.round(((qty || 0) - (target.stockQuantity || 0)) * 1000) / 1000 : 0;
  const invalid =
    !target ||
    newQty === '' ||
    isNaN(qty) ||
    qty < 0 ||
    diff === 0 ||
    !reason ||
    (reason === 'other' && note.trim().length < 3);

  const save = () =>
    op
      .run(async (key) => {
        await api.post(
          `/ingredients/${target!._id}/stock-adjustment`,
          { newQuantity: qty, reason, note: note.trim() || undefined },
          withIdempotency(key)
        );
        toast.success(`Stock de ${target!.name} corrigé`);
        onSaved();
        onClose();
      })
      .catch(() => undefined /* toast intercepteur */);

  return (
    <ResponsiveDialog
      open={!!target}
      onClose={onClose}
      maxWidth="xs"
      title={target ? `Corriger le stock — ${target.name}` : ''}
      subtitle="La correction est notée dans l’historique (ancienne valeur, nouvelle valeur, raison, auteur)."
      actions={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="contained" disabled={invalid || op.busy} onClick={save}>
            {op.busy ? 'Enregistrement…' : 'Enregistrer la correction'}
          </Button>
        </>
      }
    >
      {target && (
        <>
          <Box sx={{ display: 'flex', gap: 1.5, mb: 2, mt: 0.5 }}>
            <Box sx={{ flex: 1, p: 1.25, borderRadius: `${radius.md}px`, bgcolor: color.bgSubtle }}>
              <Typography variant="caption" sx={{ color: color.inkSoft }}>
                Stock actuel
              </Typography>
              <Typography sx={{ fontWeight: 800 }}>
                {formatQty(target.stockQuantity || 0)}{' '}
                {unitLabel(target.unit, target.stockQuantity)}
              </Typography>
            </Box>
            <TextField
              sx={{ flex: 1 }}
              autoFocus
              label={`Nouveau stock (${unitLabel(target.unit)})`}
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              inputProps={{ inputMode: 'decimal' }}
            />
          </Box>
          {diff !== 0 && !isNaN(diff) && (
            <Typography
              variant="body2"
              sx={{
                mb: 1.5,
                fontWeight: 700,
                color: diff > 0 ? color.successDark : color.dangerDark,
              }}
            >
              Différence : {diff > 0 ? '+' : '−'}
              {formatQty(Math.abs(diff))} {unitLabel(target.unit, Math.abs(diff))}
            </Typography>
          )}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Raison (obligatoire)
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
            {Object.entries(STOCK_REASON_LABELS).map(([k, v]) => (
              <ButtonBase
                key={k}
                onClick={() => setReason(k)}
                aria-pressed={reason === k}
                sx={{
                  px: 1.25,
                  py: 0.6,
                  borderRadius: `${radius.pill}px`,
                  border: `1px solid ${reason === k ? color.primary : color.borderStrong}`,
                  bgcolor: reason === k ? color.primarySoft : color.surface,
                  color: reason === k ? color.primaryDark : color.inkSoft,
                  fontWeight: 600,
                  fontSize: '0.85rem',
                }}
              >
                {v}
              </ButtonBase>
            ))}
          </Box>
          <TextField
            fullWidth
            size="small"
            label={reason === 'other' ? 'Précisez (obligatoire)' : 'Précision (facultative)'}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ex : boîtes comptées dans le placard"
          />
        </>
      )}
    </ResponsiveDialog>
  );
}
