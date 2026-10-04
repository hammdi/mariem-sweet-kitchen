import { useState } from 'react';
import { toast } from 'react-toastify';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { PageHeader } from '../../components/ui';
import {
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { Add } from '@mui/icons-material';

// Categories par defaut — dans un vrai projet, elles seraient en base
const defaultRecipeCategories = [
  'gateau',
  'tarte',
  'biscuit',
  'muffin',
  'patisserie',
  'cake',
  'crepe',
  'chocolat',
  'fruits',
  'traditionnel',
  'anniversaire',
  'autre',
];
const defaultIngredientCategories = [
  'base',
  'sweetener',
  'dairy',
  'flavoring',
  'leavening',
  'other',
];
const defaultApplianceCategories = ['cooking', 'mixing', 'cooling', 'other'];

interface CategorySectionProps {
  title: string;
  storageKey: string;
  defaults: string[];
  labels?: Record<string, string>;
}

const CategorySection = ({ title, storageKey, defaults, labels }: CategorySectionProps) => {
  const getStored = (): string[] => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        /* ignore */
      }
    }
    return defaults;
  };

  const [items, setItems] = useState<string[]>(getStored);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const save = (updated: string[]) => {
    setItems(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  const handleAdd = () => {
    const name = newName.trim().toLowerCase();
    if (!name) return;
    if (items.includes(name)) {
      toast.error('Cette catégorie existe déjà');
      return;
    }
    save([...items, name]);
    toast.success(`Catégorie "${name}" ajoutée`);
    setNewName('');
    setAddOpen(false);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    save(items.filter((i) => i !== deleteTarget));
    toast.success(`Catégorie "${deleteTarget}" supprimée`);
    setDeleteTarget(null);
  };

  const getLabel = (key: string) => labels?.[key] || key;

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          <Button
            size="small"
            startIcon={<Add />}
            onClick={() => {
              setNewName('');
              setAddOpen(true);
            }}
          >
            Ajouter
          </Button>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {items.map((item) => (
            <Chip
              key={item}
              label={getLabel(item)}
              onDelete={() => setDeleteTarget(item)}
              variant="outlined"
              sx={{ fontSize: '0.9rem' }}
            />
          ))}
          {items.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              Aucune catégorie
            </Typography>
          )}
        </Box>
      </CardContent>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Nouvelle catégorie — {title}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            autoFocus
            label="Nom"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            sx={{ mt: 1 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleAdd} disabled={!newName.trim()}>
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Supprimer cette catégorie ?"
        message={`La catégorie "${deleteTarget}" sera supprimée de la liste. Les recettes et ingrédients existants ne sont pas modifiés.`}
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </Card>
  );
};

/** Gestion des catégories (affichée dans Paramètres → Catégories). */
export const CategoriesContent = () => {

  const ingredientLabels: Record<string, string> = {
    base: 'Base',
    sweetener: 'Sucrant',
    dairy: 'Produit laitier',
    flavoring: 'Arome',
    leavening: 'Levant',
    other: 'Autre',
  };

  const applianceLabels: Record<string, string> = {
    cooking: 'Cuisson',
    mixing: 'Mixage',
    cooling: 'Refroidissement',
    other: 'Autre',
  };

  return (
    <Box>
      <CategorySection title="Catégories de recettes" storageKey="recipeCategories" defaults={defaultRecipeCategories} />
      <CategorySection title="Catégories d'ingrédients" storageKey="ingredientCategories" defaults={defaultIngredientCategories} labels={ingredientLabels} />
      <CategorySection title="Catégories de machines" storageKey="applianceCategories" defaults={defaultApplianceCategories} labels={applianceLabels} />
    </Box>
  );
};

const CategoriesPage = () => (
  <Box>
    <PageHeader title="Catégories" subtitle="Classement des recettes, ingrédients et machines." backTo="/admin/settings" />
    <CategoriesContent />
  </Box>
);

export default CategoriesPage;
