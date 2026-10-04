import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import {
  Typography,
  Box,
  Button,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Chip,
  InputAdornment,
} from '@mui/material';
import { Add, Edit, Delete, Search, Storefront, Egg } from '@mui/icons-material';
import { FilterChips, PageHeader } from '../../components/ui';
import type { PriceSummary } from '../../types/admin';
import { formatDT } from '../../utils/format';

const categories = [
  { value: 'base', label: 'Base' },
  { value: 'sweetener', label: 'Sucrant' },
  { value: 'dairy', label: 'Produit laitier' },
  { value: 'flavoring', label: 'Arome' },
  { value: 'leavening', label: 'Levant' },
  { value: 'other', label: 'Autre' },
];

const units = ['kg', 'g', 'l', 'ml', 'piece', 'cuillere', 'tasse'] as const;

const emptyForm = { name: '', pricePerUnit: '', unit: 'kg', category: 'other', minStock: '' };

const IngredientsPage = () => {
  const navigate = useNavigate();
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [summaries, setSummaries] = useState<Record<string, PriceSummary>>({});

  const load = async () => {
    try {
      const [res, sumRes] = await Promise.all([
        api.get('/ingredients'),
        api.get('/ingredients/price-summary'),
      ]);
      setIngredients(res.data.data?.ingredients || res.data.data || []);
      setSummaries(sumRes.data.data?.summaries || {});
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (ing: any) => {
    setEditId(ing._id);
    setForm({
      name: ing.name,
      pricePerUnit: String(ing.pricePerUnit),
      unit: ing.unit,
      category: ing.category,
      minStock: ing.minStock ? String(ing.minStock) : '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const body = {
        ...form,
        pricePerUnit: parseFloat(form.pricePerUnit),
        minStock: form.minStock === '' ? null : parseFloat(form.minStock),
      };
      if (editId) {
        await api.put(`/ingredients/${editId}`, body);
        toast.success('Ingrédient modifié');
      } else {
        await api.post('/ingredients', body);
        toast.success('Ingrédient ajouté');
      }
      setDialogOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/ingredients/${deleteId}`);
      toast.success('Ingrédient supprimé');
      setDeleteId(null);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  return (
    <Box>
      <PageHeader
        title="Ingrédients"
        subtitle="Prix de référence, prix constatés chez vos sources, seuils d’alerte. Le stock se gère dans « Stock »."
        icon={<Egg />}
        tone="success"
        helpFlow="recipe"
        actions={
          <>
            <Button variant="outlined" startIcon={<Storefront />} onClick={() => navigate('/admin/sources')}>
              Sources d’achat
            </Button>
            <Button variant="contained" startIcon={<Add />} onClick={openAdd}>
              Ajouter
            </Button>
          </>
        }
      />
      <Box>
        <Card sx={{ p: { xs: 1.5, md: 2 }, mb: 2, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 1.5, alignItems: { md: 'center' } }}>
          <TextField
            size="small"
            placeholder="Rechercher un ingrédient…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            inputProps={{ 'aria-label': 'Rechercher un ingrédient' }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
            sx={{ width: { xs: '100%', md: 280 } }}
          />
          <FilterChips
            ariaLabel="Catégorie"
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={[
              { value: '', label: 'Tous', count: ingredients.length },
              ...categories.map((c) => ({ value: c.value, label: c.label, count: ingredients.filter((i) => i.category === c.value).length })),
            ]}
          />
        </Card>

        <TableContainer component={Card} sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nom</TableCell>
                <TableCell>Prix de référence</TableCell>
                <TableCell>Meilleur prix</TableCell>
                <TableCell>Prix moyen</TableCell>
                <TableCell>Unité</TableCell>
                <TableCell>Catégorie</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ingredients
                .filter(
                  (i) => !searchText || i.name.toLowerCase().includes(searchText.toLowerCase())
                )
                .filter((i) => !categoryFilter || i.category === categoryFilter)
                .map((ing) => {
                  const sum = summaries[ing._id];
                  return (
                    <TableRow
                      key={ing._id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/admin/ingredients/${ing._id}`)}
                    >
                      <TableCell sx={{ fontWeight: 700 }}>{ing.name}</TableCell>
                      <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{formatDT(ing.pricePerUnit, 3)}</TableCell>
                      <TableCell sx={{ color: 'success.main', whiteSpace: 'nowrap' }}>
                        {sum?.best ? (
                          <>
                            {formatDT(sum.best.price, 3)}
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: 'block' }}
                            >
                              {sum.best.sourceName}
                            </Typography>
                          </>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {sum && sum.average !== null && sum.average !== undefined ? formatDT(sum.average, 4) : '—'}
                        {sum && sum.comparableCount > 0 && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'block' }}
                          >
                            {sum.comparableCount} source(s)
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{ing.unit}</TableCell>
                      <TableCell>
                        <Chip
                          label={
                            categories.find((c) => c.value === ing.category)?.label || ing.category
                          }
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell
                        align="right"
                        onClick={(e) => e.stopPropagation()}
                        sx={{ whiteSpace: 'nowrap' }}
                      >
                        <IconButton
                          size="small"
                          title="Sources et prix"
                          color="primary"
                          onClick={() => navigate(`/admin/ingredients/${ing._id}`)}
                        >
                          <Storefront fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => openEdit(ing)}>
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => setDeleteId(ing._id)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              {ingredients.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}
                  >
                    Aucun ingrédient. Cliquez sur « Ajouter » pour commencer.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Dialog ajout/modif */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editId ? "Modifier l'ingrédient" : 'Ajouter un ingrédient'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Nom"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField
            fullWidth
            label="Prix de référence par unité (DT)"
            type="number"
            value={form.pricePerUnit}
            onChange={(e) => setForm({ ...form, pricePerUnit: e.target.value })}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Unité</InputLabel>
            <Select
              value={form.unit}
              label="Unité"
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            >
              {units.map((u) => (
                <MenuItem key={u} value={u}>
                  {u}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Seuil d'alerte stock (optionnel)"
            type="number"
            value={form.minStock}
            onChange={(e) => setForm({ ...form, minStock: e.target.value })}
            helperText={`Alerte quand le stock passe sous cette quantité (en ${form.unit})`}
            inputProps={{ min: 0, step: 0.01 }}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth>
            <InputLabel>Catégorie</InputLabel>
            <Select
              value={form.category}
              label="Catégorie"
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {categories.map((c) => (
                <MenuItem key={c.value} value={c.value}>
                  {c.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Annuler</Button>
          <Button onClick={handleSave} variant="contained">
            {editId ? 'Modifier' : 'Ajouter'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm suppression */}
      <ConfirmDialog
        open={!!deleteId}
        title="Supprimer cet ingrédient ?"
        message="L'ingrédient sera désactivé et ne sera plus disponible pour les nouvelles recettes."
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </Box>
  );
};

export default IngredientsPage;
