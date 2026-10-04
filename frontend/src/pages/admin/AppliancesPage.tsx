import { useState, useEffect } from 'react';
import { PageHeader } from '../../components/ui';
import { Blender } from '@mui/icons-material';
import { toast } from 'react-toastify';
import api from '../../services/api';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import {
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
import { Add, Edit, Delete, Search } from '@mui/icons-material';

const categories = [
  { value: 'cooking', label: 'Cuisson' },
  { value: 'mixing', label: 'Mixage' },
  { value: 'cooling', label: 'Refroidissement' },
  { value: 'other', label: 'Autre' },
];

const emptyForm = { name: '', powerConsumption: '', category: 'cooking' };

const AppliancesPage = () => {
  const [appliances, setAppliances] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const load = async () => {
    try {
      const res = await api.get('/appliances');
      setAppliances(res.data.data?.appliances || res.data.data || []);
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

  const openEdit = (app: any) => {
    setEditId(app._id);
    setForm({
      name: app.name,
      powerConsumption: String(app.powerConsumption),
      category: app.category,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const body = { ...form, powerConsumption: parseFloat(form.powerConsumption), unit: 'W' };
      if (editId) {
        await api.put(`/appliances/${editId}`, body);
        toast.success('Machine modifiée');
      } else {
        await api.post('/appliances', body);
        toast.success('Machine ajoutée');
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
      await api.delete(`/appliances/${deleteId}`);
      toast.success('Machine supprimée');
      setDeleteId(null);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  return (
    <Box>
      <PageHeader
        title="Machines"
        subtitle="Four, batteur, réfrigérateur… La puissance et la durée servent au coût d’électricité des recettes."
        icon={<Blender />}
        tone="warning"
        helpFlow="recipe"
        actions={
          <>
            <TextField
              size="small"
              placeholder="Rechercher…"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              inputProps={{ 'aria-label': 'Rechercher une machine' }}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
              sx={{ width: { xs: '100%', sm: 220 } }}
            />
            <Button variant="contained" startIcon={<Add />} onClick={openAdd}>
              Ajouter
            </Button>
          </>
        }
      />
      <Box>
        {/* Filtres categorie */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Chip
            label="Toutes"
            color={categoryFilter === '' ? 'primary' : 'default'}
            variant={categoryFilter === '' ? 'filled' : 'outlined'}
            onClick={() => setCategoryFilter('')}
            clickable
          />
          {categories.map((c) => (
            <Chip
              key={c.value}
              label={`${c.label} (${appliances.filter((a) => a.category === c.value).length})`}
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
                <TableCell>Puissance</TableCell>
                <TableCell>Catégorie</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {appliances
                .filter(
                  (a) => !searchText || a.name.toLowerCase().includes(searchText.toLowerCase())
                )
                .filter((a) => !categoryFilter || a.category === categoryFilter)
                .map((app) => (
                  <TableRow key={app._id}>
                    <TableCell>{app.name}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{app.powerConsumption} W</TableCell>
                    <TableCell>
                      <Chip
                        label={
                          categories.find((c) => c.value === app.category)?.label || app.category
                        }
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => openEdit(app)}>
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => setDeleteId(app._id)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              {appliances.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}
                  >
                    Aucune machine. Cliquez sur "Ajouter" pour commencer.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editId ? 'Modifier la machine' : 'Ajouter une machine'}</DialogTitle>
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
            label="Puissance (Watts)"
            type="number"
            value={form.powerConsumption}
            onChange={(e) => setForm({ ...form, powerConsumption: e.target.value })}
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

      <ConfirmDialog
        open={!!deleteId}
        title="Supprimer cette machine ?"
        message="La machine sera desactivee et ne sera plus disponible pour les nouvelles recettes."
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </Box>
  );
};

export default AppliancesPage;
