import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import {
  Container,
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
import { Add, Edit, Delete, ArrowBack, Search } from '@mui/icons-material';

const categories = [
  { value: 'base', label: 'Base' },
  { value: 'sweetener', label: 'Sucrant' },
  { value: 'dairy', label: 'Produit laitier' },
  { value: 'flavoring', label: 'Arome' },
  { value: 'leavening', label: 'Levant' },
  { value: 'other', label: 'Autre' },
];

const units = ['kg', 'g', 'l', 'ml', 'piece', 'cuillere', 'tasse'] as const;

const emptyForm = { name: '', pricePerUnit: '', unit: 'kg', category: 'other' };

const IngredientsPage = () => {
  const navigate = useNavigate();
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const load = async () => {
    try {
      const res = await api.get('/ingredients');
      setIngredients(res.data.data?.ingredients || res.data.data || []);
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
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const body = { ...form, pricePerUnit: parseFloat(form.pricePerUnit) };
      if (editId) {
        await api.put(`/ingredients/${editId}`, body);
        toast.success('Ingredient modifie');
      } else {
        await api.post('/ingredients', body);
        toast.success('Ingredient ajoute');
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
      toast.success('Ingredient supprime');
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
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'stretch', sm: 'center' },
              gap: 1,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconButton onClick={() => navigate('/admin')}>
                <ArrowBack />
              </IconButton>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                Ingredients
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
                sx={{ width: { xs: '100%', sm: 200 } }}
              />
              <Button variant="contained" startIcon={<Add />} onClick={openAdd}>
                Ajouter
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 3 }}>
        {/* Filtres categorie */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Chip
            label="Tous"
            color={categoryFilter === '' ? 'primary' : 'default'}
            variant={categoryFilter === '' ? 'filled' : 'outlined'}
            onClick={() => setCategoryFilter('')}
            clickable
          />
          {categories.map((c) => (
            <Chip
              key={c.value}
              label={`${c.label} (${ingredients.filter((i) => i.category === c.value).length})`}
              color={categoryFilter === c.value ? 'primary' : 'default'}
              variant={categoryFilter === c.value ? 'filled' : 'outlined'}
              onClick={() => setCategoryFilter(c.value)}
              clickable
            />
          ))}
        </Box>

        <TableContainer component={Card} sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nom</TableCell>
                <TableCell>Prix / unite</TableCell>
                <TableCell>Unite</TableCell>
                <TableCell>Categorie</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ingredients
                .filter(
                  (i) => !searchText || i.name.toLowerCase().includes(searchText.toLowerCase())
                )
                .filter((i) => !categoryFilter || i.category === categoryFilter)
                .map((ing) => (
                  <TableRow key={ing._id}>
                    <TableCell>{ing.name}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{ing.pricePerUnit} DT</TableCell>
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
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => openEdit(ing)}>
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => setDeleteId(ing._id)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              {ingredients.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}
                  >
                    Aucun ingredient. Cliquez sur "Ajouter" pour commencer.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Container>

      {/* Dialog ajout/modif */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editId ? "Modifier l'ingredient" : 'Ajouter un ingredient'}</DialogTitle>
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
            label="Prix par unite (DT)"
            type="number"
            value={form.pricePerUnit}
            onChange={(e) => setForm({ ...form, pricePerUnit: e.target.value })}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Unite</InputLabel>
            <Select
              value={form.unit}
              label="Unite"
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            >
              {units.map((u) => (
                <MenuItem key={u} value={u}>
                  {u}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Categorie</InputLabel>
            <Select
              value={form.category}
              label="Categorie"
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
        title="Supprimer cet ingredient ?"
        message="L'ingredient sera desactive et ne sera plus disponible pour les nouvelles recettes."
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </Box>
  );
};

export default IngredientsPage;
