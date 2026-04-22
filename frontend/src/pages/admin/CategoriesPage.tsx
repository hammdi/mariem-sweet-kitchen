import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import {
  Container, Typography, Box, Button, Card, CardContent,
  IconButton, Chip, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material'
import { ArrowBack, Add } from '@mui/icons-material'

// Categories par defaut — dans un vrai projet, elles seraient en base
const defaultRecipeCategories = ['gateau', 'tarte', 'biscuit', 'muffin', 'patisserie', 'cake', 'crepe', 'chocolat', 'fruits', 'traditionnel', 'anniversaire', 'autre']
const defaultIngredientCategories = ['base', 'sweetener', 'dairy', 'flavoring', 'leavening', 'other']
const defaultApplianceCategories = ['cooking', 'mixing', 'cooling', 'other']

interface CategorySectionProps {
  title: string
  storageKey: string
  defaults: string[]
  labels?: Record<string, string>
}

const CategorySection = ({ title, storageKey, defaults, labels }: CategorySectionProps) => {
  const getStored = (): string[] => {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try { return JSON.parse(saved) } catch { /* ignore */ }
    }
    return defaults
  }

  const [items, setItems] = useState<string[]>(getStored)
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const save = (updated: string[]) => {
    setItems(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
  }

  const handleAdd = () => {
    const name = newName.trim().toLowerCase()
    if (!name) return
    if (items.includes(name)) {
      toast.error('Cette categorie existe deja')
      return
    }
    save([...items, name])
    toast.success(`Categorie "${name}" ajoutee`)
    setNewName('')
    setAddOpen(false)
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    save(items.filter(i => i !== deleteTarget))
    toast.success(`Categorie "${deleteTarget}" supprimee`)
    setDeleteTarget(null)
  }

  const getLabel = (key: string) => labels?.[key] || key

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>{title}</Typography>
          <Button size="small" startIcon={<Add />} onClick={() => { setNewName(''); setAddOpen(true) }}>
            Ajouter
          </Button>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {items.map(item => (
            <Chip
              key={item}
              label={getLabel(item)}
              onDelete={() => setDeleteTarget(item)}
              variant="outlined"
              sx={{ fontSize: '0.9rem' }}
            />
          ))}
          {items.length === 0 && (
            <Typography variant="body2" color="text.secondary">Aucune categorie</Typography>
          )}
        </Box>
      </CardContent>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Nouvelle categorie — {title}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth autoFocus label="Nom" value={newName}
            onChange={e => setNewName(e.target.value)}
            sx={{ mt: 1 }}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleAdd} disabled={!newName.trim()}>Ajouter</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Supprimer cette categorie ?"
        message={`La categorie "${deleteTarget}" sera supprimee de la liste. Les recettes/ingredients existants ne seront pas affectes.`}
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </Card>
  )
}

const CategoriesPage = () => {
  const navigate = useNavigate()

  const ingredientLabels: Record<string, string> = {
    base: 'Base', sweetener: 'Sucrant', dairy: 'Produit laitier',
    flavoring: 'Arome', leavening: 'Levant', other: 'Autre',
  }

  const applianceLabels: Record<string, string> = {
    cooking: 'Cuisson', mixing: 'Mixage', cooling: 'Refroidissement', other: 'Autre',
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#fafafa' }}>
      <Box sx={{ bgcolor: 'white', borderBottom: '1px solid #eee', py: 2, px: 3 }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={() => navigate('/admin')}><ArrowBack /></IconButton>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>Categories</Typography>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ py: 3 }}>
        <CategorySection
          title="Categories de recettes"
          storageKey="recipeCategories"
          defaults={defaultRecipeCategories}
        />
        <CategorySection
          title="Categories d'ingredients"
          storageKey="ingredientCategories"
          defaults={defaultIngredientCategories}
          labels={ingredientLabels}
        />
        <CategorySection
          title="Categories de machines"
          storageKey="applianceCategories"
          defaults={defaultApplianceCategories}
          labels={applianceLabels}
        />
      </Container>
    </Box>
  )
}

export default CategoriesPage
