import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  Container,
  Typography,
  Box,
  Grid,
  TextField,
  Card,
  CardContent,
  CardMedia,
  Button,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Skeleton,
  Pagination,
} from '@mui/material';
import { Search, AccessTime, Cake } from '@mui/icons-material';

const RecipesPage = () => {
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const PAGE_SIZE = 12;

  const load = async (targetPage = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(targetPage));
      params.set('limit', String(PAGE_SIZE));
      if (search) params.set('search', search);
      if (category) params.set('category', category);
      const res = await api.get(`/recipes?${params}`);
      const data = res.data.data?.recipes || [];
      setRecipes(data);
      setTotalPages(res.data.data?.pagination?.totalPages || 1);
      // Extraire les categories uniques
      const cats = [
        ...new Set(data.flatMap((r: any) => r.categories || []).filter(Boolean)),
      ] as string[];
      if (cats.length > 0 && categories.length === 0) setCategories(cats);
    } catch {
      /* ignore */
    }
    setLoading(false);
  };

  useEffect(() => {
    setPage(1);
    load(1);
  }, [category]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    load(1);
  };

  const handlePageChange = (_: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
    load(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getMinPrice = (recipe: any) => {
    // Calculer le prix minimum approximatif a partir des ingredients
    if (!recipe.variants || recipe.variants.length === 0) return null;
    const variant = recipe.variants[0];
    let total = 0;
    for (const ing of variant.ingredients || []) {
      const ingredient = ing.ingredientId;
      if (ingredient && typeof ingredient === 'object') {
        total += (ingredient.pricePerUnit || 0) * (ing.quantity || 0);
      }
    }
    return total > 0 ? total : null;
  };

  return (
    <Box sx={{ py: 4, minHeight: '80vh' }}>
      <Container maxWidth="lg">
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h2"
            component="h1"
            sx={{ fontFamily: 'Playfair Display', fontWeight: 600, color: 'text.primary', mb: 1 }}
          >
            Nos Recettes
          </Typography>
          <Typography variant="h6" sx={{ color: 'text.secondary' }}>
            Chaque recette affiche ses ingredients et le detail des couts — 100% transparent
          </Typography>
        </Box>

        {/* Filtres */}
        <Card sx={{ p: 3, mb: 4 }}>
          <Box component="form" onSubmit={handleSearch}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Rechercher une recette"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Categorie</InputLabel>
                  <Select
                    label="Categorie"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <MenuItem value="">Toutes</MenuItem>
                    {categories.map((c) => (
                      <MenuItem key={c} value={c}>
                        {c}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Button type="submit" variant="contained" fullWidth sx={{ height: 40 }}>
                  Rechercher
                </Button>
              </Grid>
            </Grid>
          </Box>
        </Card>

        {/* Resultats */}
        {loading ? (
          <Grid container spacing={3}>
            {[1, 2, 3].map((i) => (
              <Grid item xs={12} sm={6} md={4} key={i}>
                <Card>
                  <Skeleton variant="rectangular" height={200} />
                  <CardContent>
                    <Skeleton variant="text" width="60%" height={32} />
                    <Skeleton variant="text" width="100%" />
                    <Skeleton variant="text" width="40%" />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : recipes.length > 0 ? (
          <>
            <Grid container spacing={3}>
              {recipes.map((recipe) => {
                const minPrice = getMinPrice(recipe);
                const sizes = recipe.variants?.map((v: any) => v.sizeName) || [];

                return (
                  <Grid item xs={12} sm={6} md={4} key={recipe._id}>
                    <Card
                      sx={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        cursor: 'pointer',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        '&:hover': {
                          transform: 'translateY(-6px)',
                          boxShadow: '0 12px 24px rgba(0,0,0,0.12)',
                        },
                      }}
                      onClick={() => navigate(`/recipes/${recipe._id}`)}
                    >
                      {recipe.images?.[0] ? (
                        <CardMedia
                          component="img"
                          height="200"
                          image={recipe.images[0]}
                          alt={recipe.name}
                          sx={{ objectFit: 'cover' }}
                        />
                      ) : (
                        <Box
                          sx={{
                            height: 200,
                            bgcolor: 'linear-gradient(135deg, #fef7ee, #fad7a5)',
                            background: 'linear-gradient(135deg, #fef7ee, #fad7a5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Cake sx={{ fontSize: 72, color: 'primary.main', opacity: 0.5 }} />
                        </Box>
                      )}

                      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                          {recipe.name}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            mb: 2,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {recipe.description}
                        </Typography>

                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
                          {recipe.categories?.map((cat: string, ci: number) => (
                            <Chip
                              key={ci}
                              label={cat}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                          ))}
                          {sizes.map((s: string, i: number) => (
                            <Chip key={i} label={s} size="small" variant="outlined" />
                          ))}
                          {recipe.variants?.[0]?.ingredients?.length > 0 && (
                            <Chip
                              icon={<AccessTime />}
                              label={`${recipe.variants[0].ingredients.length} ingredients`}
                              size="small"
                              variant="outlined"
                            />
                          )}
                        </Box>

                        <Box sx={{ mt: 'auto' }}>
                          {minPrice && (
                            <Typography
                              variant="h6"
                              color="primary.main"
                              sx={{ fontWeight: 600, mb: 1 }}
                            >
                              A partir de {minPrice.toFixed(2)} DT
                            </Typography>
                          )}
                          <Button variant="contained" fullWidth>
                            Voir les details et prix
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
            {totalPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={handlePageChange}
                  color="primary"
                  size="large"
                />
              </Box>
            )}
          </>
        ) : (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Cake sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              {search || category
                ? 'Aucune recette trouvee pour cette recherche'
                : 'Les recettes arrivent bientot'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {search || category
                ? "Essayez avec d'autres criteres"
                : 'Mariem prepare ses meilleures creations'}
            </Typography>
          </Box>
        )}
      </Container>
    </Box>
  );
};

export default RecipesPage;
