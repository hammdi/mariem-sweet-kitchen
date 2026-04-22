import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import api from '../../services/api'
import {
  Container, Typography, Box, Button, Card, CardContent,
  TextField, Grid, IconButton, Divider, Chip,
  FormControl, InputLabel, Select, MenuItem, OutlinedInput, Checkbox, ListItemText,
  Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
} from '@mui/material'
import { ArrowBack, Add, Delete, ContentCopy, Close, CloudUpload } from '@mui/icons-material'

const emptyVariant = () => ({
  sizeName: '',
  portions: 1,
  ingredients: [] as any[],
  appliances: [] as any[],
})

const RecipeFormPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = !!id

  const defaultCategories = ['gateau', 'tarte', 'biscuit', 'muffin', 'patisserie', 'cake', 'crepe', 'chocolat', 'fruits', 'traditionnel', 'anniversaire', 'autre']
  const [allCategories, setAllCategories] = useState(defaultCategories)
  const [newCatDialogOpen, setNewCatDialogOpen] = useState(false)
  const [newCatName, setNewCatName] = useState('')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [variants, setVariants] = useState([emptyVariant()])
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  const [allIngredients, setAllIngredients] = useState<any[]>([])
  const [allAppliances, setAllAppliances] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  // Charger ingredients et machines
  useEffect(() => {
    const load = async () => {
      try {
        const [ingRes, appRes] = await Promise.all([
          api.get('/ingredients'),
          api.get('/appliances'),
        ])
        setAllIngredients(ingRes.data.data?.ingredients || ingRes.data.data || [])
        setAllAppliances(appRes.data.data?.appliances || appRes.data.data || [])
      } catch { /* ignore */ }
    }
    load()
  }, [])

  // Charger recette si edit
  useEffect(() => {
    if (!id) return
    const load = async () => {
      try {
        const res = await api.get(`/recipes/${id}`)
        const r = res.data.data?.recipe
        setName(r.name)
        setDescription(r.description)
        setCategories(r.categories || [])
        setImages(r.images || [])
        setVariants(r.variants.map((v: any) => ({
          sizeName: v.sizeName,
          portions: v.portions,
          ingredients: v.ingredients.map((i: any) => ({
            ingredientId: typeof i.ingredientId === 'object' ? i.ingredientId._id : i.ingredientId,
            quantity: i.quantity,
            unit: i.unit,
          })),
          appliances: v.appliances.map((a: any) => ({
            applianceId: typeof a.applianceId === 'object' ? a.applianceId._id : a.applianceId,
            duration: a.duration,
          })),
        })))
      } catch { navigate('/admin/recipes') }
    }
    load()
  }, [id])

  const updateVariant = (idx: number, field: string, value: any) => {
    const newVars = [...variants]
    newVars[idx] = { ...newVars[idx], [field]: value }
    setVariants(newVars)
  }

  const addVariant = () => {
    const last = variants[variants.length - 1]
    // Copie auto depuis la derniere taille
    setVariants([...variants, {
      sizeName: '',
      portions: last.portions,
      ingredients: last.ingredients.map(i => ({ ...i })),
      appliances: last.appliances.map(a => ({ ...a })),
    }])
  }

  const removeVariant = (idx: number) => {
    if (variants.length <= 1) return
    setVariants(variants.filter((_, i) => i !== idx))
  }

  // Ingredients d'un variant
  const addIngredient = (vIdx: number) => {
    const newVars = [...variants]
    newVars[vIdx].ingredients.push({ ingredientId: '', quantity: 0, unit: 'g' })
    setVariants(newVars)
  }

  const updateIngredient = (vIdx: number, iIdx: number, field: string, value: any) => {
    const newVars = [...variants]
    newVars[vIdx].ingredients[iIdx] = { ...newVars[vIdx].ingredients[iIdx], [field]: value }
    setVariants(newVars)
  }

  const removeIngredient = (vIdx: number, iIdx: number) => {
    const newVars = [...variants]
    newVars[vIdx].ingredients.splice(iIdx, 1)
    setVariants(newVars)
  }

  // Machines d'un variant
  const addAppliance = (vIdx: number) => {
    const newVars = [...variants]
    newVars[vIdx].appliances.push({ applianceId: '', duration: 0 })
    setVariants(newVars)
  }

  const updateAppliance = (vIdx: number, aIdx: number, field: string, value: any) => {
    const newVars = [...variants]
    newVars[vIdx].appliances[aIdx] = { ...newVars[vIdx].appliances[aIdx], [field]: value }
    setVariants(newVars)
  }

  const removeAppliance = (vIdx: number, aIdx: number) => {
    const newVars = [...variants]
    newVars[vIdx].appliances.splice(aIdx, 1)
    setVariants(newVars)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const body = { name, description, categories, variants, images }
      if (isEdit) {
        await api.put(`/recipes/${id}`, body)
        toast.success('Recette modifiee')
      } else {
        await api.post('/recipes', body)
        toast.success('Recette creee')
      }
      navigate('/admin/recipes')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la sauvegarde')
    }
    setSaving(false)
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#fafafa' }}>
      <Box sx={{ bgcolor: 'white', borderBottom: '1px solid #eee', py: 2, px: 3 }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconButton onClick={() => navigate('/admin/recipes')}><ArrowBack /></IconButton>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                {isEdit ? 'Modifier la recette' : 'Nouvelle recette'}
              </Typography>
            </Box>
            <Button variant="contained" onClick={handleSave} disabled={saving}>
              {saving ? 'Sauvegarde...' : 'Enregistrer'}
            </Button>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 3 }}>
        {/* Info generales */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Informations generales</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Nom de la recette" value={name} onChange={e => setName(e.target.value)} />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Categories</InputLabel>
                  <Select
                    multiple
                    value={categories}
                    onChange={e => setCategories(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value as string[])}
                    input={<OutlinedInput label="Categories" />}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map(v => (
                          <Chip key={v} label={v} size="small"
                            onDelete={() => setCategories(categories.filter(c => c !== v))}
                            onMouseDown={e => e.stopPropagation()}
                          />
                        ))}
                      </Box>
                    )}
                  >
                    {allCategories.map(c => (
                      <MenuItem key={c} value={c} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Checkbox checked={categories.includes(c)} />
                          <ListItemText primary={c} />
                        </Box>
                        <IconButton
                          size="small"
                          onMouseDown={e => {
                            e.preventDefault()
                            e.stopPropagation()
                            setAllCategories(allCategories.filter(x => x !== c))
                            setCategories(categories.filter(x => x !== c))
                          }}
                          sx={{ ml: 1, color: 'error.main', opacity: 0.5, '&:hover': { opacity: 1 } }}
                        >
                          <Delete sx={{ fontSize: 16 }} />
                        </IconButton>
                      </MenuItem>
                    ))}
                    <Divider />
                    <MenuItem
                      onMouseDown={e => {
                        e.preventDefault()
                        e.stopPropagation()
                        setNewCatName('')
                        setNewCatDialogOpen(true)
                      }}
                      sx={{ color: 'primary.main', fontWeight: 600 }}
                    >
                      <Add sx={{ mr: 1, fontSize: 20 }} /> Ajouter une categorie
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth multiline rows={3} label="Description" value={description} onChange={e => setDescription(e.target.value)} />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Images</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 1.5 }}>
                  {images.map((url, idx) => (
                    <Box key={idx} sx={{ position: 'relative', width: 100, height: 100 }}>
                      <Box
                        component="img"
                        src={url}
                        alt={`Image ${idx + 1}`}
                        sx={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 1, border: '1px solid #ddd' }}
                      />
                      <IconButton
                        size="small"
                        onClick={() => setImages(images.filter((_, i) => i !== idx))}
                        sx={{
                          position: 'absolute', top: -8, right: -8,
                          bgcolor: 'error.main', color: 'white',
                          width: 22, height: 22,
                          '&:hover': { bgcolor: 'error.dark' },
                        }}
                      >
                        <Close sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
                <input
                  type="file"
                  accept="image/*"
                  id="recipe-image-upload"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setUploading(true)
                    try {
                      const formData = new FormData()
                      formData.append('images', file)
                      const res = await api.post('/upload', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                      })
                      const urls: string[] = res.data.data?.urls || res.data.urls || []
                      if (urls.length > 0) {
                        setImages(prev => [...prev, ...urls])
                        toast.success('Image ajoutee')
                      }
                    } catch (err: any) {
                      toast.error(err.response?.data?.message || "Erreur lors de l'upload")
                    }
                    setUploading(false)
                    e.target.value = ''
                  }}
                />
                <label htmlFor="recipe-image-upload">
                  <Button
                    variant="outlined"
                    component="span"
                    startIcon={uploading ? <CircularProgress size={18} /> : <CloudUpload />}
                    disabled={uploading}
                  >
                    {uploading ? 'Upload en cours...' : 'Ajouter une image'}
                  </Button>
                </label>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Variants (tailles) */}
        {variants.map((variant, vIdx) => (
          <Card key={vIdx} sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Taille {vIdx + 1}
                </Typography>
                {variants.length > 1 && (
                  <IconButton size="small" onClick={() => removeVariant(vIdx)} color="error">
                    <Delete fontSize="small" />
                  </IconButton>
                )}
              </Box>

              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="Nom de la taille" value={variant.sizeName}
                    onChange={e => updateVariant(vIdx, 'sizeName', e.target.value)}
                    placeholder="Petit, Moyen, Grand, 12 pieces..."
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth type="number" label="Nombre de portions" value={variant.portions}
                    onChange={e => updateVariant(vIdx, 'portions', parseInt(e.target.value) || 1)}
                  />
                </Grid>
              </Grid>

              {/* Ingredients */}
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Ingredients</Typography>
              {variant.ingredients.map((ing: any, iIdx: number) => (
                <Grid container spacing={1} key={iIdx} sx={{ mb: 1 }} alignItems="center">
                  <Grid item xs={12} md={5}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Ingredient</InputLabel>
                      <Select value={ing.ingredientId} label="Ingredient"
                        onChange={e => updateIngredient(vIdx, iIdx, 'ingredientId', e.target.value)}
                      >
                        {allIngredients.map(i => (
                          <MenuItem key={i._id} value={i._id}>{i.name} ({i.pricePerUnit} DT/{i.unit})</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <TextField fullWidth size="small" type="number" label="Quantite" value={ing.quantity}
                      onChange={e => updateIngredient(vIdx, iIdx, 'quantity', parseFloat(e.target.value) || 0)}
                    />
                  </Grid>
                  <Grid item xs={4} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Unite</InputLabel>
                      <Select value={ing.unit} label="Unite"
                        onChange={e => updateIngredient(vIdx, iIdx, 'unit', e.target.value)}
                      >
                        {['kg', 'g', 'l', 'ml', 'piece', 'cuillere', 'tasse'].map(u => (
                          <MenuItem key={u} value={u}>{u}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={2} md={1}>
                    <IconButton size="small" onClick={() => removeIngredient(vIdx, iIdx)} color="error">
                      <Delete fontSize="small" />
                    </IconButton>
                  </Grid>
                </Grid>
              ))}
              <Button size="small" startIcon={<Add />} onClick={() => addIngredient(vIdx)} sx={{ mb: 2 }}>
                Ajouter ingredient
              </Button>

              <Divider sx={{ my: 2 }} />

              {/* Machines */}
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Machines</Typography>
              {variant.appliances.map((app: any, aIdx: number) => (
                <Grid container spacing={1} key={aIdx} sx={{ mb: 1 }} alignItems="center">
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Machine</InputLabel>
                      <Select value={app.applianceId} label="Machine"
                        onChange={e => updateAppliance(vIdx, aIdx, 'applianceId', e.target.value)}
                      >
                        {allAppliances.map(a => (
                          <MenuItem key={a._id} value={a._id}>{a.name} ({a.powerConsumption}W)</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={8} md={5}>
                    <TextField fullWidth size="small" type="number" label="Duree (minutes)" value={app.duration}
                      onChange={e => updateAppliance(vIdx, aIdx, 'duration', parseInt(e.target.value) || 0)}
                    />
                  </Grid>
                  <Grid item xs={4} md={1}>
                    <IconButton size="small" onClick={() => removeAppliance(vIdx, aIdx)} color="error">
                      <Delete fontSize="small" />
                    </IconButton>
                  </Grid>
                </Grid>
              ))}
              <Button size="small" startIcon={<Add />} onClick={() => addAppliance(vIdx)}>
                Ajouter machine
              </Button>
            </CardContent>
          </Card>
        ))}

        <Button variant="outlined" startIcon={<ContentCopy />} onClick={addVariant} fullWidth sx={{ mb: 3 }}>
          Ajouter une taille (copie de la precedente)
        </Button>
      </Container>

      {/* Dialog ajouter categorie */}
      <Dialog open={newCatDialogOpen} onClose={() => setNewCatDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Nouvelle categorie</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth autoFocus label="Nom de la categorie" value={newCatName}
            onChange={e => setNewCatName(e.target.value.toLowerCase())}
            sx={{ mt: 1 }}
            placeholder="ex: sans gluten, vegan, fete..."
            onKeyDown={e => {
              if (e.key === 'Enter' && newCatName.trim()) {
                const cat = newCatName.trim()
                if (!allCategories.includes(cat)) setAllCategories([...allCategories, cat])
                if (!categories.includes(cat)) setCategories([...categories, cat])
                setNewCatDialogOpen(false)
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewCatDialogOpen(false)}>Annuler</Button>
          <Button variant="contained" disabled={!newCatName.trim()}
            onClick={() => {
              const cat = newCatName.trim()
              if (!allCategories.includes(cat)) setAllCategories([...allCategories, cat])
              if (!categories.includes(cat)) setCategories([...categories, cat])
              setNewCatDialogOpen(false)
            }}
          >
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default RecipeFormPage
