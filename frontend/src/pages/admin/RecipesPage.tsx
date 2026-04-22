import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api';
import {
  Container,
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Grid,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
} from '@mui/material';
import { Add, Edit, ContentCopy, Delete, ArrowBack, Cake, Search } from '@mui/icons-material';

const RecipesPage = () => {
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState<any[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const load = async () => {
    try {
      const res = await api.get('/recipes?limit=200');
      setRecipes(res.data.data?.recipes || []);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDuplicate = async (id: string) => {
    try {
      await api.post(`/recipes/${id}/duplicate`);
      toast.success('Recette dupliquee');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la duplication');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/recipes/${deleteId}`);
      toast.success('Recette desactivee');
      setDeleteId(null);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#fafafa' }}>
      <Box sx={{ bgcolor: 'white', borderBottom: '1px solid #eee', py: 2, px: 3 }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconButton onClick={() => navigate('/admin')}>
                <ArrowBack />
              </IconButton>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                Recettes
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                placeholder="Rechercher..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
                sx={{ width: 200 }}
              />
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => navigate('/admin/recipes/new')}
              >
                Nouvelle recette
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 3 }}>
        {/* Filtres catégories */}
        {(() => {
          const allCats = [...new Set(recipes.flatMap((r: any) => r.categories || []))];
          return allCats.length > 0 ? (
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
              <Chip
                label="Toutes"
                color={categoryFilter === '' ? 'primary' : 'default'}
                variant={categoryFilter === '' ? 'filled' : 'outlined'}
                onClick={() => setCategoryFilter('')}
                clickable
              />
              {allCats.map((cat) => (
                <Chip
                  key={cat}
                  label={cat}
                  color={categoryFilter === cat ? 'primary' : 'default'}
                  variant={categoryFilter === cat ? 'filled' : 'outlined'}
                  onClick={() => setCategoryFilter(cat)}
                  clickable
                />
              ))}
            </Box>
          ) : null;
        })()}

        {(() => {
          const filtered = recipes
            .filter((r) => !searchText || r.name.toLowerCase().includes(searchText.toLowerCase()))
            .filter((r) => !categoryFilter || (r.categories || []).includes(categoryFilter));
          return filtered.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Cake sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                Aucune recette
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Commencez par ajouter vos ingredients et machines, puis creez votre premiere recette
              </Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => navigate('/admin/recipes/new')}
              >
                Creer une recette
              </Button>
            </Box>
          ) : (
            <Grid container spacing={3}>
              {filtered.map((recipe) => (
                <Grid item xs={12} sm={6} md={4} key={recipe._id}>
                  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {recipe.images?.[0] ? (
                      <CardMedia
                        component="img"
                        height="180"
                        image={recipe.images[0]}
                        alt={recipe.name}
                      />
                    ) : (
                      <Box
                        sx={{
                          height: 180,
                          bgcolor: '#f5f5f5',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Cake sx={{ fontSize: 64, color: 'text.disabled' }} />
                      </Box>
                    )}
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
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
                          <Chip key={ci} label={cat} size="small" variant="outlined" />
                        ))}
                        {recipe.variants?.map((v: any, i: number) => (
                          <Chip
                            key={i}
                            label={v.sizeName}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 1, pb: 1 }}>
                      <IconButton
                        size="small"
                        title="Modifier"
                        onClick={() => navigate(`/admin/recipes/${recipe._id}/edit`)}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        title="Dupliquer"
                        onClick={() => handleDuplicate(recipe._id)}
                      >
                        <ContentCopy fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        title="Supprimer"
                        onClick={() => setDeleteId(recipe._id)}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>
                  </Card>
                </Grid>
              ))}
            </Grid>
          );
        })()}
      </Container>

      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)}>
        <DialogTitle>Desactiver cette recette ?</DialogTitle>
        <DialogContent>
          <Typography>La recette ne sera plus visible par les clients.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Annuler</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Desactiver
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RecipesPage;
