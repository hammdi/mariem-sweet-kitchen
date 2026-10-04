import { Box, Card, Skeleton } from '@mui/material';

/** Squelettes de chargement (cartes ou lignes) pendant que les données arrivent. */
export function SkeletonCards({ count = 3, height = 96 }: { count?: number; height?: number }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, 1fr)', lg: `repeat(${count}, 1fr)` },
      }}
      aria-busy
      aria-label="Chargement"
    >
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} sx={{ p: 2 }}>
          <Skeleton variant="rounded" height={height - 32} />
        </Card>
      ))}
    </Box>
  );
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }} aria-busy aria-label="Chargement">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} variant="rounded" height={44} />
      ))}
    </Box>
  );
}
