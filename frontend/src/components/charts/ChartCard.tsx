import { ReactNode, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';

export interface LegendItem {
  label: string;
  color: string;
  shape?: 'rect' | 'line';
}

interface Props {
  title: string;
  subtitle?: string;
  legend?: LegendItem[];
  table: { columns: string[]; rows: (string | number)[][] };
  loading?: boolean;
  empty?: boolean;
  icon?: ReactNode;
  tourId?: string;
  children: ReactNode;
}

// Cadre commun : titre, legende (≥ 2 series), bascule graphique / tableau
export default function ChartCard({
  title,
  subtitle,
  legend,
  table,
  loading,
  empty,
  icon,
  tourId,
  children,
}: Props) {
  const [showTable, setShowTable] = useState(false);
  return (
    <Card sx={{ height: '100%' }} data-tour={tourId}>
      <CardContent sx={{ p: 2.5 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 1,
            alignItems: 'flex-start',
          }}
        >
          <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start', minWidth: 0 }}>
            {icon && (
              <Box
                sx={{ display: 'flex', color: 'primary.main', mt: 0.25, '& svg': { fontSize: 24 } }}
              >
                {icon}
              </Box>
            )}
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                {title}
              </Typography>
              {subtitle && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {subtitle}
                </Typography>
              )}
            </Box>
          </Box>
          {!empty && (
            <Button size="small" onClick={() => setShowTable(!showTable)} sx={{ flexShrink: 0 }}>
              {showTable ? 'Graphique' : 'Tableau'}
            </Button>
          )}
        </Box>
        {legend && legend.length > 1 && !showTable && !empty && (
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
            {legend.map((l) => (
              <Box key={l.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box
                  sx={{
                    width: l.shape === 'line' ? 14 : 10,
                    height: l.shape === 'line' ? 2 : 10,
                    borderRadius: l.shape === 'line' ? 1 : '2px',
                    bgcolor: l.color,
                  }}
                />
                <Typography variant="caption" color="text.secondary">
                  {l.label}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
        <Box sx={{ mt: 1.5, opacity: loading ? 0.45 : 1, transition: 'opacity 200ms' }}>
          {empty ? (
            <Typography color="text.secondary" sx={{ py: 5, textAlign: 'center' }}>
              Aucune donnée sur cette période.
            </Typography>
          ) : showTable ? (
            <TableContainer sx={{ maxHeight: 280 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {table.columns.map((c, i) => (
                      <TableCell key={c} align={i === 0 ? 'left' : 'right'}>
                        {c}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {table.rows.map((r, ri) => (
                    <TableRow key={ri}>
                      {r.map((v, i) => (
                        <TableCell
                          key={i}
                          align={i === 0 ? 'left' : 'right'}
                          sx={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {v}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            children
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
