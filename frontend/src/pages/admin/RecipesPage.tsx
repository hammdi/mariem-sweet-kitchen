import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api';
import { Typography, Box, Button, Card, IconButton, TextField, InputAdornment, Tooltip } from '@mui/material';
import { Add, Edit, ContentCopy, Delete, Cake, Search, Timer, Blender, Egg } from '@mui/icons-material';
import Illustration from '../../components/illustrations/Pastry';
import { EmptyState, FilterChips, PageHeader, ResponsiveDialog, SkeletonCards, StatusBadge } from '../../components/ui';
import { formatDT } from '../../utils/format';
import { color, radius } from '../../theme/tokens';

/**
 * Recettes (admin) : tailles, portions, ingrédients, machines, temps et prix
 * de vente calculé. La préparation n'est jamais enregistrée (secret de Rahma).
 */
const RecipesPage = () => {
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState<any[] | null>(null);
  const [prices, setPrices] = useState<Record<string, { sizeName: string; portions: number; total: number | null }[]>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const load = async () => {
    try {
      const [res, cat] = await Promise.all([api.get('/recipes?limit=200'), api.get('/prices/catalog')]);
      setRecipes(res.data.data?.recipes || []);
      setPrices(cat.data.data?.prices || {});
    } catch {
      setRecipes((prev) => prev || []);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDuplicate = async (id: string) => {
    try {
      await api.post(`/recipes/${id}/duplicate`);
      toast.success('Recette dupliquée');
      load();
    } catch {
      /* toast intercepteur */
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/recipes/${deleteId}`);
      toast.success('Recette désactivée');
      setDeleteId(null);
      load();
    } catch {
      /* toast intercepteur */
    }
  };

  const list = recipes || [];
  const allCats = [...new Set(list.flatMap((r: any) => r.categories || []))] as string[];
  const filtered = list
    .filter((r) => !searchText || r.name.toLowerCase().includes(searchText.toLowerCase()))
    .filter((r) => !categoryFilter || (r.categories || []).includes(categoryFilter));

  return (
    <Box>
      <PageHeader
        title="Recettes"
        subtitle="Tailles, portions, ingrédients, machines et prix. Les clients voient les ingrédients et le prix, jamais la préparation."
        icon={<Cake />}
        tone="rose"
        helpFlow="recipe"
        actions={
          <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/admin/recipes/new')}>
            Nouvelle recette
          </Button>
        }
      />

      <Card sx={{ p: { xs: 1.5, md: 2 }, mb: 2.5, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 1.5, alignItems: { md: 'center' } }}>
        <TextField
          size="small"
          placeholder="Rechercher une recette…"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          inputProps={{ 'aria-label': 'Rechercher une recette' }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
          sx={{ width: { xs: '100%', md: 300 } }}
        />
        {allCats.length > 0 && (
          <FilterChips ariaLabel="Catégorie" value={categoryFilter} onChange={setCategoryFilter} options={[{ value: '', label: 'Toutes' }, ...allCats.map((c) => ({ value: c, label: c }))]} />
        )}
      </Card>

      {recipes === null ? (
        <SkeletonCards count={3} height={300} />
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Cake />}
            tone="rose"
            title={list.length ? 'Aucune recette ne correspond' : 'Aucune recette'}
            description="Ajoutez d’abord vos ingrédients et machines, puis créez votre première recette."
            action={
              <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/admin/recipes/new')}>
                Créer une recette
              </Button>
            }
          />
        </Card>
      ) : (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0,1fr))', xl: 'repeat(3, minmax(0,1fr))' } }}>
          {filtered.map((recipe) => {
            const variants = recipe.variants || [];
            const ingredientCount = new Set(variants.flatMap((v: any) => (v.ingredients || []).map((i: any) => String(i.ingredientId?._id || i.ingredientId)))).size;
            const machines = new Set(variants.flatMap((v: any) => (v.appliances || []).map((a: any) => String(a.applianceId?._id || a.applianceId)))).size;
            const minutes = Math.max(0, ...variants.map((v: any) => (v.appliances || []).reduce((s: number, a: any) => s + (a.duration || 0), 0)));
            const vp = prices[recipe._id] || [];
            return (
              <Card key={recipe._id} sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'transform 200ms, box-shadow 200ms', '&:hover': { transform: 'translateY(-2px)' } }}>
                <Box sx={{ height: 160, position: 'relative', bgcolor: color.primarySoft, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
                  {recipe.images?.[0] ? (
                    <Box component="img" src={recipe.images[0]} alt={recipe.name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Illustration name={recipe.name.toLowerCase().includes('chocolat') ? 'chocolateCake' : 'layerCake'} sx={{ width: 170 }} />
                  )}
                  {recipe.isActive === false && (
                    <Box sx={{ position: 'absolute', top: 10, left: 10 }}>
                      <StatusBadge tone="neutral" label="Désactivée" />
                    </Box>
                  )}
                </Box>
                <Box sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontSize: '1.05rem' }}>
                      {recipe.name}
                    </Typography>
                    {recipe.description && (
                      <Typography variant="body2" sx={{ color: color.inkSoft, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {recipe.description}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', color: color.inkSoft }}>
                    <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Egg sx={{ fontSize: 15 }} /> {ingredientCount} ingrédient{ingredientCount > 1 ? 's' : ''}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Blender sx={{ fontSize: 15 }} /> {machines} machine{machines > 1 ? 's' : ''}
                    </Typography>
                    {minutes > 0 && (
                      <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Timer sx={{ fontSize: 15 }} /> jusqu’à {minutes} min
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ borderRadius: `${radius.md}px`, border: `1px solid ${color.border}`, overflow: 'hidden' }}>
                    {variants.map((v: any, i: number) => (
                      <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, px: 1.25, py: 0.75, bgcolor: i % 2 ? color.surface : color.surfaceMuted }}>
                        <Typography variant="body2">
                          <strong>{v.sizeName}</strong>
                          <Box component="span" sx={{ color: color.inkSoft }}>
                            {' '}
                            · {v.portions} portions
                          </Box>
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 800, color: color.primaryDark, whiteSpace: 'nowrap' }}>
                          {vp[i]?.total !== null && vp[i]?.total !== undefined ? formatDT(vp[i].total!) : '—'}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                  {(recipe.categories || []).length > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {recipe.categories.map((c: string) => (
                        <StatusBadge key={c} tone="info" label={c} />
                      ))}
                    </Box>
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5, px: 1.5, pb: 1.5, alignItems: 'center' }}>
                  <Button size="small" variant="outlined" startIcon={<Edit />} onClick={() => navigate(`/admin/recipes/${recipe._id}/edit`)} sx={{ flex: 1 }}>
                    Modifier
                  </Button>
                  <Tooltip title="Dupliquer (pour une variante)">
                    <IconButton size="small" aria-label="Dupliquer" onClick={() => handleDuplicate(recipe._id)}>
                      <ContentCopy fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Désactiver">
                    <IconButton size="small" aria-label="Désactiver" onClick={() => setDeleteId(recipe._id)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Card>
            );
          })}
        </Box>
      )}

      <ResponsiveDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        maxWidth="xs"
        title="Désactiver cette recette ?"
        subtitle="Elle ne sera plus visible par les clients. Les commandes existantes ne changent pas."
        actions={
          <>
            <Button onClick={() => setDeleteId(null)}>Annuler</Button>
            <Button onClick={handleDelete} color="error" variant="contained">
              Désactiver
            </Button>
          </>
        }
      >
        <Typography variant="body2">Ses commandes déjà enregistrées gardent leur prix figé.</Typography>
      </ResponsiveDialog>
    </Box>
  );
};

export default RecipesPage;
