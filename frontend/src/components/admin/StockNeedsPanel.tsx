import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Collapse,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { StockNeed } from '../../types/admin';
import { formatQty } from '../../utils/format';

interface Props {
  needs: StockNeed[];
  stockDeducted?: boolean;
  // Stock attribue par date : explique la colonne "Stock"
  note?: string;
}

const qty = (n: number, unit: string) => `${formatQty(n)} ${unit}`;

// Stock actuel - besoin = reste prevu. Information seulement : n'empeche rien.
export default function StockNeedsPanel({ needs, stockDeducted, note }: Props) {
  const [showAll, setShowAll] = useState(false);
  if (needs.length === 0) return null;

  const missing = needs.filter((n) => n.status === 'missing');
  const low = needs.filter((n) => n.status === 'low');
  const mismatch = needs.filter((n) => n.unitMismatch);

  return (
    <Box>
      {stockDeducted && (
        <Alert severity="info" sx={{ mb: 1 }}>
          Les ingrédients de cette commande ont déjà été utilisés (retirés du stock une seule fois).
        </Alert>
      )}

      {!stockDeducted && missing.length > 0 && (
        <Alert severity="warning" sx={{ mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Ingrédients insuffisants
          </Typography>
          {missing.map((n) => (
            <Typography variant="body2" key={n.ingredientId}>
              <strong>{n.name}</strong> — Disponible : {qty(n.stock, n.unit)} · Nécessaire :{' '}
              {qty(n.needed, n.unit)} · <strong>Manque : {qty(n.missing, n.unit)}</strong>
            </Typography>
          ))}
        </Alert>
      )}

      {!stockDeducted && low.length > 0 && (
        <Alert severity="info" sx={{ mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Sous le seuil d'alerte après cette commande
          </Typography>
          {low.map((n) => (
            <Typography variant="body2" key={n.ingredientId}>
              <strong>{n.name}</strong> — reste prévu {qty(n.remaining, n.unit)} (seuil{' '}
              {qty(n.minStock || 0, n.unit)})
            </Typography>
          ))}
        </Alert>
      )}

      {!stockDeducted && missing.length === 0 && low.length === 0 && (
        <Alert severity="success" sx={{ mb: 1 }}>
          Stock suffisant pour cette commande.
        </Alert>
      )}

      {mismatch.length > 0 && (
        <Typography variant="caption" color="warning.main" sx={{ display: 'block', mb: 1 }}>
          Unité de recette différente de l'unité du stock pour :{' '}
          {mismatch.map((n) => n.name).join(', ')} — a verifier.
        </Typography>
      )}

      <Button size="small" onClick={() => setShowAll(!showAll)}>
        {showAll ? 'Masquer le détail' : 'Voir le détail du stock prévu'}
      </Button>
      <Collapse in={showAll}>
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Ingrédient</TableCell>
                <TableCell align="right">Stock</TableCell>
                <TableCell align="right">Besoin</TableCell>
                <TableCell align="right">Reste prévu</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {needs.map((n) => (
                <TableRow key={n.ingredientId}>
                  <TableCell>{n.name}</TableCell>
                  <TableCell align="right">{qty(n.stock, n.unit)}</TableCell>
                  <TableCell align="right">{qty(n.needed, n.unit)}</TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontWeight: 600,
                      color:
                        n.status === 'missing'
                          ? 'error.main'
                          : n.status === 'low'
                            ? 'warning.main'
                            : 'success.main',
                    }}
                  >
                    {qty(n.remaining, n.unit)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Collapse>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        {note ? `${note} ` : ''}Information seulement : n'empêche pas de prendre la commande.
      </Typography>
    </Box>
  );
}
