import { Box, Card, CardActionArea, Typography } from '@mui/material';
import { PhotoLibraryOutlined } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { color, font, radius, shadow } from '../../theme/tokens';
import { CatalogItem, formatPrice, fromPrice, variantFacts } from './catalog';

/** Photo d'une création (ou un fond doux si aucune photo). */
export function CatalogPhoto({
  src,
  alt,
  zoom = false,
}: {
  src?: string;
  alt: string;
  zoom?: boolean;
}) {
  return src ? (
    <Box
      component="img"
      src={src}
      alt={alt}
      loading="lazy"
      sx={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block',
        transition: 'transform 600ms ease',
        ...(zoom && { '.MuiCardActionArea-root:hover &': { transform: 'scale(1.06)' } }),
      }}
    />
  ) : (
    <Box
      aria-hidden
      sx={{
        width: '100%',
        height: '100%',
        display: 'grid',
        placeItems: 'center',
        fontSize: 56,
        background: `linear-gradient(135deg, ${color.cream}, ${color.primaryTint})`,
      }}
    >
      🎂
    </Box>
  );
}

export default function CatalogCard({ item }: { item: CatalogItem }) {
  const navigate = useNavigate();
  const price = fromPrice(item);
  const facts = item.variants[0] ? variantFacts(item.variants[0]) : [];
  return (
    <Card
      sx={{
        height: '100%',
        overflow: 'hidden',
        borderRadius: `${radius.xl}px`,
        transition: 'box-shadow 250ms ease, transform 250ms ease',
        '&:hover': { boxShadow: shadow.raised, transform: 'translateY(-3px)' },
      }}
    >
      <CardActionArea
        onClick={() => navigate(`/recipes/${item._id}`)}
        sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
      >
        <Box sx={{ position: 'relative', aspectRatio: '4 / 3', overflow: 'hidden' }}>
          <CatalogPhoto src={item.images[0]} alt={item.name} zoom />
          {item.images.length > 1 && (
            <Box
              sx={{
                position: 'absolute',
                top: 10,
                right: 10,
                px: 1,
                py: 0.25,
                borderRadius: `${radius.pill}px`,
                bgcolor: 'rgba(0,0,0,0.55)',
                color: '#fff',
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
              }}
            >
              <PhotoLibraryOutlined sx={{ fontSize: 14 }} /> {item.images.length}
            </Box>
          )}
        </Box>
        <Box sx={{ p: 2.25, display: 'flex', flexDirection: 'column', flex: 1 }}>
          {item.categories[0] && (
            <Typography variant="overline" sx={{ color: color.primaryDark, lineHeight: 1.6 }}>
              {item.categories[0]}
            </Typography>
          )}
          <Typography
            sx={{ fontFamily: font.brand, fontWeight: 700, fontSize: '1.3rem', lineHeight: 1.2 }}
          >
            {item.name}
          </Typography>
          {item.description && (
            <Typography
              variant="body2"
              sx={{
                color: color.inkSoft,
                mt: 0.75,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {item.description}
            </Typography>
          )}
          {facts.length > 0 && (
            <Typography variant="caption" sx={{ color: color.inkMuted, mt: 1 }}>
              {facts.join(' · ')}
              {item.variants.length > 1 ? ` · ${item.variants.length} tailles` : ''}
            </Typography>
          )}
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ mt: 1.5, fontWeight: 800, color: color.primaryDark }}>
            {price !== null ? `à partir de ${formatPrice(price)}` : 'Prix sur demande'}
          </Typography>
        </Box>
      </CardActionArea>
    </Card>
  );
}
