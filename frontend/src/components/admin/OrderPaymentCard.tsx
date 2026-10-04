import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Box, Button, Card, FormControl, InputLabel, MenuItem, Select, TextField, Typography } from '@mui/material';
import { Payments } from '@mui/icons-material';
import api, { withIdempotency } from '../../services/api';
import type { CashMovementRow } from '../../types/admin';
import { CASH_TYPE_LABELS, PAYMENT_METHOD_LABELS, formatDT } from '../../utils/format';
import { formatDateTimeFr } from '../../utils/dateTime';
import { useIdempotentAction } from '../../hooks/useIdempotencyKey';
import { color, radius } from '../../theme/tokens';
import { PaymentStatusBadge, ResponsiveDialog, SoftIcon } from '../ui';

interface PaymentState {
  totalPrice: number;
  amountPaid: number;
  remaining: number;
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  movements: CashMovementRow[];
}

/**
 * Paiement d'une commande — suivi À PART de l'avancement : on peut encaisser
 * avant, pendant ou après la préparation. L'argent n'entre en caisse qu'à
 * l'encaissement (action explicite, enregistrée une seule fois).
 */
export default function OrderPaymentCard({
  orderId,
  orderStatus,
  refreshKey,
  onChanged,
}: {
  orderId: string;
  orderStatus: string;
  refreshKey: string;
  onChanged: () => void;
}) {
  const [state, setState] = useState<PaymentState | null>(null);
  const [dialog, setDialog] = useState<null | 'payment' | 'refund'>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [reason, setReason] = useState('');
  const op = useIdempotentAction();

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/cash/orders/${orderId}`);
      setState(res.data.data);
    } catch {
      setState(null);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (!state) return null;
  const overpaid = Math.round((state.amountPaid - state.totalPrice) * 1000) / 1000;
  const paidPct = state.totalPrice > 0 ? Math.min(100, (state.amountPaid / state.totalPrice) * 100) : 0;

  const openDialog = (kind: 'payment' | 'refund') => {
    op.reset(); // nouvelle opération : nouvelle clé
    setMethod('cash');
    if (kind === 'payment') setAmount(String(state.remaining));
    else {
      setAmount(String(overpaid > 0 ? overpaid : state.amountPaid));
      setReason(orderStatus === 'cancelled' ? 'Commande annulée' : '');
    }
    setDialog(kind);
  };

  const submit = () =>
    op
      .run(async (key) => {
        if (dialog === 'payment') {
          await api.post(`/cash/orders/${orderId}/payment`, { amount: parseFloat(amount), method }, withIdempotency(key));
          toast.success('Paiement enregistré en caisse');
        } else {
          await api.post(
            `/cash/orders/${orderId}/refund`,
            { amount: parseFloat(amount), method, reason: reason || undefined },
            withIdempotency(key)
          );
          toast.success('Remboursement enregistré');
        }
        setDialog(null);
        await load();
        onChanged();
      })
      .catch(() => undefined /* toast intercepteur */);

  const Line = ({ label, value, valueColor, strong }: { label: string; value: string; valueColor?: string; strong?: boolean }) => (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.4 }}>
      <Typography variant="body2" sx={{ color: strong ? color.ink : color.inkSoft, fontWeight: strong ? 700 : 400 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 700, color: valueColor, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </Box>
  );

  return (
    <Card data-tour="order-payment" sx={{ p: 2.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
        <SoftIcon tone="success" size={34}>
          <Payments />
        </SoftIcon>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontSize: '1rem' }}>
            Paiement
          </Typography>
          <Typography variant="caption" sx={{ color: color.inkSoft }}>
            Indépendant de l&apos;avancement
          </Typography>
        </Box>
        <PaymentStatusBadge status={state.paymentStatus} size="medium" />
      </Box>
      <Box sx={{ height: 8, borderRadius: 4, bgcolor: color.bgSubtle, overflow: 'hidden', mb: 1 }} aria-hidden>
        <Box sx={{ width: `${paidPct}%`, height: '100%', bgcolor: color.success, transition: 'width 600ms' }} />
      </Box>
      <Line label="Total" value={formatDT(state.totalPrice)} />
      <Line label="Encaissé" value={formatDT(state.amountPaid)} valueColor={color.successDark} />
      <Line label="Reste à encaisser" value={formatDT(state.remaining)} valueColor={state.remaining > 0 ? color.warningDark : undefined} strong />
      {overpaid > 0.0005 && (
        <Typography variant="caption" sx={{ color: color.dangerDark }}>
          Trop perçu : {formatDT(overpaid)} (le total a baissé après le paiement)
        </Typography>
      )}

      <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
        {state.remaining > 0 && orderStatus !== 'cancelled' && (
          <Button variant="contained" color="success" sx={{ flex: 1 }} onClick={() => openDialog('payment')} data-tour="order-collect">
            Encaisser
          </Button>
        )}
        {state.amountPaid > 0 && (
          <Button variant="outlined" color="warning" sx={{ flex: 1 }} onClick={() => openDialog('refund')}>
            Rembourser
          </Button>
        )}
      </Box>

      {state.movements.length > 0 && (
        <Box sx={{ mt: 1.5, pt: 1.25, borderTop: `1px dashed ${color.borderStrong}` }}>
          {state.movements.map((m) => (
            <Box key={m._id} sx={{ display: 'flex', gap: 1, py: 0.35 }}>
              <Box sx={{ width: 6, height: 6, mt: '7px', borderRadius: '50%', bgcolor: m.direction === 'in' ? color.success : color.danger, flexShrink: 0 }} />
              <Typography variant="caption" sx={{ color: color.inkSoft }}>
                {formatDateTimeFr(m.occurredAt)} · {CASH_TYPE_LABELS[m.type]}
                {m.reversalOf ? ' (correction)' : ''} ·{' '}
                <strong style={{ color: m.direction === 'in' ? color.successDark : color.dangerDark }}>
                  {m.direction === 'in' ? '+' : '−'}
                  {formatDT(m.amount)}
                </strong>{' '}
                · {PAYMENT_METHOD_LABELS[m.method]}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      <ResponsiveDialog
        open={!!dialog}
        onClose={() => setDialog(null)}
        maxWidth="xs"
        title={dialog === 'payment' ? 'Encaisser la commande' : 'Rembourser'}
        subtitle={dialog === 'payment' ? 'L’argent reçu entre dans la caisse.' : 'L’argent rendu sort de la caisse.'}
        actions={
          <>
            <Button onClick={() => setDialog(null)}>Annuler</Button>
            <Button
              variant="contained"
              color={dialog === 'payment' ? 'success' : 'warning'}
              disabled={op.busy || !(parseFloat(amount) > 0)}
              onClick={submit}
            >
              {op.busy ? 'Enregistrement…' : dialog === 'payment' ? 'Encaisser' : 'Rembourser'}
            </Button>
          </>
        }
      >
        <TextField
          fullWidth
          autoFocus
          type="number"
          label="Montant (DT)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputProps={{ min: 0, step: 0.001, inputMode: 'decimal' }}
          sx={{ mt: 1, mb: 2 }}
          helperText={dialog === 'payment' ? `Reste à encaisser : ${formatDT(state.remaining)}` : undefined}
        />
        <FormControl fullWidth sx={{ mb: dialog === 'refund' ? 2 : 0 }}>
          <InputLabel>Mode</InputLabel>
          <Select label="Mode" value={method} onChange={(e) => setMethod(e.target.value)}>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
              <MenuItem key={k} value={k}>
                {v}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {dialog === 'refund' && (
          <TextField fullWidth label="Raison" value={reason} onChange={(e) => setReason(e.target.value)} />
        )}
        <Box sx={{ mt: 2, p: 1.25, borderRadius: `${radius.sm}px`, bgcolor: color.bgSubtle }}>
          <Typography variant="caption" sx={{ color: color.inkSoft }}>
            Enregistré une seule fois, même en cas de double clic.
          </Typography>
        </Box>
      </ResponsiveDialog>
    </Card>
  );
}
