import { useState } from 'react';
import {
  Box,
  ButtonBase,
  Container,
  InputAdornment,
  Skeleton,
  TextField,
  Typography,
} from '@mui/material';
import { Search } from '@mui/icons-material';
import CatalogCard from '../components/catalog/CatalogCard';
import { useCatalog } from '../components/catalog/useCatalog';
import { color, font, radius } from '../theme/tokens';

/** Catalogue client : photos, descriptions et prix — sans composition. */
const RecipesPage = () => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const { items, categories } = useCatalog({ search, category });

  return (
    <Box sx={{ bgcolor: color.bg, minHeight: '70vh' }}>
      <Box
        sx={{
          background: `linear-gradient(135deg, ${color.cream} 0%, ${color.primaryTint} 100%)`,
          py: { xs: 5, md: 7 },
        }}
      >
        <Container maxWidth="lg">
          <Typography variant="overline" sx={{ color: color.primaryDark }}>
            Fait maison, sur commande
          </Typography>
          <Typography
            component="h1"
            sx={{ fontFamily: font.brand, fontWeight: 700, fontSize: { xs: '2.2rem', md: '3rem' } }}
          >
            Notre catalogue
          </Typography>
          <Typography sx={{ color: color.inkSoft, mt: 1, maxWidth: 560 }}>
            Choisissez votre création, sa taille et la date : Mariem vous rappelle pour confirmer.
          </Typography>
          <TextField
            placeholder="Rechercher une création…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            inputProps={{ 'aria-label': 'Rechercher une création' }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{
              mt: 3,
              width: { xs: '100%', sm: 420 },
              bgcolor: color.surface,
              borderRadius: `${radius.md}px`,
            }}
          />
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        {categories.length > 1 && (
          <Box
            role="group"
            aria-label="Catégories"
            sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}
          >
            {['', ...categories].map((c) => {
              const active = category === c;
              return (
                <ButtonBase
                  key={c || 'all'}
                  aria-pressed={active}
                  onClick={() => setCategory(c)}
                  sx={{
                    px: 2,
                    py: 0.9,
                    borderRadius: `${radius.pill}px`,
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    textTransform: 'capitalize',
                    border: `1px solid ${active ? color.primary : color.borderStrong}`,
                    bgcolor: active ? color.primary : color.surface,
                    color: active ? '#fff' : color.ink,
                    transition: 'background-color 200ms ease, border-color 200ms ease',
                  }}
                >
                  {c || 'Tout'}
                </ButtonBase>
              );
            })}
          </Box>
        )}

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
            ? [0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton
                  key={i}
                  variant="rounded"
                  sx={{ height: 360, borderRadius: `${radius.xl}px` }}
                />
              ))
            : items.map((item) => <CatalogCard key={item._id} item={item} />)}
        </Box>

        {items !== null && items.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Box sx={{ fontSize: 48 }} aria-hidden>
              🧁
            </Box>
            <Typography sx={{ fontWeight: 700, mt: 1 }}>
              {search || category ? 'Aucune création ne correspond' : 'Le catalogue arrive bientôt'}
            </Typography>
            <Typography variant="body2" sx={{ color: color.inkSoft }}>
              {search || category
                ? 'Essayez un autre mot ou une autre catégorie.'
                : 'Revenez très vite !'}
            </Typography>
          </Box>
        )}
      </Container>
    </Box>
  );
};

export default RecipesPage;
