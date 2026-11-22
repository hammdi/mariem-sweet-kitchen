import { useNavigate } from 'react-router-dom';
import { Box, Button, Container, Skeleton, Typography } from '@mui/material';
import { ArrowForward, WhatsApp } from '@mui/icons-material';
import Slideshow from '../components/catalog/Slideshow';
import CatalogCard, { CatalogPhoto } from '../components/catalog/CatalogCard';
import { useCatalog } from '../components/catalog/useCatalog';
import { CatalogItem, formatPrice, fromPrice, WHATSAPP_URL } from '../components/catalog/catalog';
import { color, font, radius } from '../theme/tokens';

const STEPS = [
  { emoji: '🎂', title: 'Choisissez', text: 'Une création, sa taille et la quantité.' },
  { emoji: '📅', title: 'Indiquez la date', text: 'Le jour où vous voulez la récupérer.' },
  { emoji: '📞', title: 'Mariem vous rappelle', text: 'Elle confirme la commande avec vous.' },
  { emoji: '💵', title: 'Payez sur place', text: 'En espèces, à la récupération.' },
];

/** Une diapositive « publicité » : photo plein cadre, nom, description, prix. */
function ShowcaseSlide({ item }: { item: CatalogItem }) {
  const navigate = useNavigate();
  const price = fromPrice(item);
  return (
    <Box sx={{ position: 'relative', height: '100%' }}>
      <CatalogPhoto src={item.images[0]} alt={item.name} />
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(90deg, rgba(28,18,10,0.78) 0%, rgba(28,18,10,0.45) 45%, rgba(28,18,10,0) 75%), linear-gradient(0deg, rgba(28,18,10,0.55) 0%, rgba(28,18,10,0) 45%)',
        }}
      />
      <Container
        maxWidth="lg"
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: { xs: 'flex-end', md: 'center' },
          pb: { xs: 6, md: 0 },
          color: '#fff',
        }}
      >
        <Box sx={{ maxWidth: 560 }}>
          {item.categories[0] && (
            <Typography variant="overline" sx={{ color: '#FFD9B0', letterSpacing: '0.14em' }}>
              {item.categories[0]}
            </Typography>
          )}
          <Typography
            component="h2"
            sx={{
              fontFamily: font.brand,
              fontWeight: 700,
              fontSize: { xs: '2.2rem', md: '3.6rem' },
              lineHeight: 1.05,
              textShadow: '0 2px 18px rgba(0,0,0,0.35)',
            }}
          >
            {item.name}
          </Typography>
          {item.description && (
            <Typography
              sx={{
                mt: 1.5,
                fontSize: { xs: '1rem', md: '1.15rem' },
                opacity: 0.92,
                display: '-webkit-box',
                WebkitLineClamp: { xs: 2, md: 3 },
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {item.description}
            </Typography>
          )}
          {price !== null && (
            <Typography sx={{ mt: 1.5, fontWeight: 800, fontSize: '1.2rem', color: '#FFD9B0' }}>
              à partir de {formatPrice(price)}
            </Typography>
          )}
          <Box sx={{ display: 'flex', gap: 1.25, mt: 2.5, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              size="large"
              endIcon={<ArrowForward />}
              onClick={() => navigate(`/recipes/${item._id}`)}
            >
              Découvrir
            </Button>
            <Button
              size="large"
              startIcon={<WhatsApp />}
              href={WHATSAPP_URL(`Bonjour Mariem, je suis intéressé(e) par « ${item.name} ».`)}
              target="_blank"
              rel="noopener"
              sx={{
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.7)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
              }}
            >
              WhatsApp
            </Button>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

const HomePage = () => {
  const navigate = useNavigate();
  const { items } = useCatalog();
  const featured = (items || []).filter((i) => i.images.length > 0).slice(0, 6);
  const heroHeight = { xs: 520, md: 600 };

  return (
    <Box sx={{ bgcolor: color.bg }}>
      {/* Vitrine qui défile comme une publicité */}
      {items === null ? (
        <Skeleton variant="rectangular" sx={{ height: heroHeight }} />
      ) : featured.length > 0 ? (
        <Slideshow
          label="Nos créations"
          height={heroHeight}
          slides={featured.map((item) => (
            <ShowcaseSlide key={item._id} item={item} />
          ))}
        />
      ) : (
        <Box
          sx={{
            height: heroHeight,
            display: 'flex',
            alignItems: 'center',
            background: `linear-gradient(135deg, ${color.cream}, ${color.primaryTint})`,
          }}
        >
          <Container maxWidth="md" sx={{ textAlign: 'center' }}>
            <Typography
              component="h1"
              sx={{
                fontFamily: font.brand,
                fontWeight: 700,
                fontSize: { xs: '2.4rem', md: '3.4rem' },
              }}
            >
              Mariem&apos;s Sweet Kitchen
            </Typography>
            <Typography sx={{ mt: 1.5, color: color.inkSoft, fontSize: '1.15rem' }}>
              Pâtisserie artisanale faite maison, sur commande.
            </Typography>
            <Button
              variant="contained"
              size="large"
              sx={{ mt: 3 }}
              onClick={() => navigate('/recipes')}
            >
              Voir le catalogue
            </Button>
          </Container>
        </Box>
      )}

      {/* Nos créations */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 9 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <Box sx={{ flex: 1, minWidth: 220 }}>
            <Typography variant="overline" sx={{ color: color.primaryDark }}>
              Fait maison
            </Typography>
            <Typography
              component="h2"
              sx={{
                fontFamily: font.brand,
                fontWeight: 700,
                fontSize: { xs: '2rem', md: '2.6rem' },
              }}
            >
              Nos créations
            </Typography>
          </Box>
          <Button endIcon={<ArrowForward />} onClick={() => navigate('/recipes')}>
            Tout le catalogue
          </Button>
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              sm: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(3, minmax(0, 1fr))',
            },
            gap: 3,
          }}
        >
          {items === null
            ? [0, 1, 2].map((i) => (
                <Skeleton
                  key={i}
                  variant="rounded"
                  sx={{ height: 360, borderRadius: `${radius.xl}px` }}
                />
              ))
            : items.slice(0, 6).map((item) => <CatalogCard key={item._id} item={item} />)}
        </Box>
      </Container>

      {/* Comment commander */}
      <Box
        sx={{
          bgcolor: color.surface,
          borderTop: `1px solid ${color.border}`,
          py: { xs: 6, md: 8 },
        }}
      >
        <Container maxWidth="lg">
          <Typography
            component="h2"
            sx={{
              fontFamily: font.brand,
              fontWeight: 700,
              fontSize: { xs: '1.8rem', md: '2.2rem' },
              textAlign: 'center',
              mb: 4,
            }}
          >
            Commander, c&apos;est simple
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                sm: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(4, minmax(0, 1fr))',
              },
              gap: 3,
            }}
          >
            {STEPS.map((s, i) => (
              <Box key={s.title} sx={{ textAlign: 'center', px: 1 }}>
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    mx: 'auto',
                    mb: 1.5,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 30,
                    bgcolor: color.primarySoft,
                  }}
                  aria-hidden
                >
                  {s.emoji}
                </Box>
                <Typography sx={{ fontWeight: 700 }}>
                  {i + 1}. {s.title}
                </Typography>
                <Typography variant="body2" sx={{ color: color.inkSoft, mt: 0.5 }}>
                  {s.text}
                </Typography>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default HomePage;
