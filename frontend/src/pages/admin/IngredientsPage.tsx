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
  Alert,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { Add, Edit, Delete, Search, Storefront, Egg, CardGiftcard } from '@mui/icons-material';
import { FilterChips, PageHeader } from '../../components/ui';
import SourceFormDialog from '../../components/admin/SourceFormDialog';
import StockAdjustDialog from '../../components/admin/StockAdjustDialog';
import type { PriceSummary, PurchaseSource } from '../../types/admin';
import { formatDT } from '../../utils/format';
import { color } from '../../theme/tokens';
import {
  NEW_SOURCE,
  PriceBasisCaption,
  validateIngredientForm,
} from '../../components/admin/IngredientPricing';
import { formatQty } from '../../utils/format';
import {
  PACKAGING_TYPES,
  PACKAGING_USE_LABELS,
  PackagingUse,
  packagingTypeOf,
} from '../../utils/packaging';

const categories = [
  { value: 'base', label: 'Base' },
  { value: 'sweetener', label: 'Sucrant' },
  { value: 'dairy', label: 'Produit laitier' },
  { value: 'flavoring', label: 'Arome' },
  { value: 'leavening', label: 'Levant' },
  { value: 'other', label: 'Autre' },
];

const units = ['kg', 'g', 'l', 'ml', 'piece', 'cuillere', 'tasse'] as const;

const emptyForm = {
  name: '',
  pricePerUnit: '',
  unit: 'kg',
  category: 'other',
  minStock: '',
  sourceId: '',
  sourcePrice: '',
  packagingType: 'box',
  packagingUse: 'per_item' as PackagingUse,
};

type Kind = 'ingredient' | 'packaging';

/**
 * Ingrédients ET emballages : même gestion (sources d'achat, prix = moyenne
 * des sources, stock, achats). Les emballages se choisissent dans chaque
 * commande, jamais dans une recette.
 */
const IngredientsPage = ({ kind = 'ingredient' }: { kind?: Kind }) => {
  const isPack = kind === 'packaging';
  const base = isPack ? '/admin/packaging' : '/admin/ingredients';
  const filters = isPack
    ? PACKAGING_TYPES.map((t) => ({ value: t.value, label: `${t.emoji} ${t.label}` }))
    : categories;
  const filterKey = isPack ? 'packagingType' : 'category';
  const navigate = useNavigate();
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [summaries, setSummaries] = useState<Record<string, PriceSummary>>({});
  const [sources, setSources] = useState<PurchaseSource[]>([]);
  const [newSourceOpen, setNewSourceOpen] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<any | null>(null);
  const editing = editId ? ingredients.find((i) => i._id === editId) : null;
  // Prix calculé depuis les sources : il ne se saisit pas ici
  const fromSources = editing?.priceBasis === 'sources';

  const load = async () => {
    try {
      const [res, sumRes] = await Promise.all([
        api.get(`/ingredients?kind=${kind}&limit=500`),
        api.get('/ingredients/price-summary'),
      ]);
      setIngredients(res.data.data?.ingredients || res.data.data || []);
      setSummaries(sumRes.data.data?.summaries || {});
      const srcRes = await api.get('/purchase-sources');
      setSources(srcRes.data.data?.sources || []);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    setCategoryFilter('');
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const openAdd = () => {
    setEditId(null);
    setForm(isPack ? { ...emptyForm, unit: 'piece' } : emptyForm);
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
      sourceId: '',
      sourcePrice: '',
      packagingType: ing.packagingType || 'other',
      packagingUse: ing.packagingUse || 'per_item',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const issue = validateIngredientForm(form, { editing: !!editId, fromSources });
    if (issue) {
      toast.error(issue);
      return;
    }
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        unit: form.unit,
        category: form.category,
        minStock: form.minStock === '' ? null : parseFloat(form.minStock),
      };
      if (isPack) {
        if (!editId) body.kind = 'packaging';
        body.packagingType = form.packagingType;
        body.packagingUse = form.packagingUse;
        delete body.unit;
      }
      if (!editId && form.sourceId) {
        // première source : son prix devient le prix utilisé
        body.sourceId = form.sourceId;
        body.sourcePrice = parseFloat(form.sourcePrice.replace(',', '.'));
      } else if (!fromSources) {
        body.pricePerUnit = parseFloat(form.pricePerUnit.replace(',', '.'));
      }
      if (editId) {
        await api.put(`/ingredients/${editId}`, body);
        toast.success(isPack ? 'Emballage modifié' : 'Ingrédient modifié');
      } else {
        await api.post('/ingredients', body);
        toast.success(isPack ? 'Emballage ajouté' : 'Ingrédient ajouté');
      }
      setDialogOpen(false);
      load();
    } catch {
      /* toast intercepteur (message du serveur) */
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/ingredients/${deleteId}`);
      toast.success(isPack ? 'Emballage supprimé' : 'Ingrédient supprimé');
      setDeleteId(null);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  return (
    <Box>
      <PageHeader
        title={isPack ? 'Emballages' : 'Ingrédients'}
        subtitle={
          isPack
            ? 'Boîtes, sachets, caissettes… avec leurs sources et leur prix (moyenne des sources). Vous les choisissez dans chaque commande : ils ne changent pas le prix des recettes.'
            : 'Prix utilisé = moyenne des prix de vos sources d’achat. Seuils d’alerte. Le stock se gère dans « Stock ».'
        }
        icon={isPack ? <CardGiftcard /> : <Egg />}
        tone={isPack ? 'rose' : 'success'}
        helpFlow={isPack ? 'packaging' : 'recipe'}
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={<Storefront />}
              onClick={() => navigate('/admin/sources')}
            >
              Sources d’achat
            </Button>
            <Button variant="contained" startIcon={<Add />} onClick={openAdd}>
              Ajouter
            </Button>
          </>
        }
      />
      <Box>
        <Card
          sx={{
            p: { xs: 1.5, md: 2 },
            mb: 2,
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 1.5,
            alignItems: { md: 'center' },
          }}
        >
          <TextField
            size="small"
            placeholder={isPack ? 'Rechercher un emballage…' : 'Rechercher un ingrédient…'}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            inputProps={{
              'aria-label': isPack ? 'Rechercher un emballage' : 'Rechercher un ingrédient',
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{ width: { xs: '100%', md: 280 } }}
          />
          <FilterChips
            ariaLabel={isPack ? 'Type' : 'Catégorie'}
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={[
              { value: '', label: 'Tous', count: ingredients.length },
              ...filters
                .map((c) => ({
                  value: c.value,
                  label: c.label,
                  count: ingredients.filter((i) => i[filterKey] === c.value).length,
                }))
                // emballages : seulement les types utilisés (liste courte)
                .filter((o) => !isPack || o.count > 0),
            ]}
          />
        </Card>

        <TableContainer component={Card} sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nom</TableCell>
                <TableCell>{isPack ? 'Prix / pièce' : 'Prix utilisé'}</TableCell>
                <TableCell>Meilleur prix</TableCell>
                <TableCell>{isPack ? 'Quantité proposée' : 'Unité'}</TableCell>
                <TableCell>{isPack ? 'Stock' : 'Catégorie'}</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ingredients
                .filter(
                  (i) => !searchText || i.name.toLowerCase().includes(searchText.toLowerCase())
                )
                .filter((i) => !categoryFilter || i[filterKey] === categoryFilter)
                .map((ing) => {
                  const sum = summaries[ing._id];
                  return (
                    <TableRow
                      key={ing._id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`${base}/${ing._id}`)}
                    >
                      <TableCell sx={{ fontWeight: 700 }}>
                        {isPack && (
                          <Box component="span" sx={{ mr: 1 }} aria-hidden>
                            {packagingTypeOf(ing.packagingType).emoji}
                          </Box>
                        )}
                        {ing.name}
                        {isPack && (
                          <Typography
                            variant="caption"
                            sx={{ display: 'block', color: color.inkSoft }}
                          >
                            {packagingTypeOf(ing.packagingType).label}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {formatDT(ing.pricePerUnit, 3)}
                        </Typography>
                        <PriceBasisCaption ingredient={ing} summary={sum} />
                      </TableCell>
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
                      {isPack ? (
                        <>
                          <TableCell>
                            <Chip
                              size="small"
                              variant="outlined"
                              label={
                                PACKAGING_USE_LABELS[
                                  (ing.packagingUse as PackagingUse) || 'per_item'
                                ].short
                              }
                            />
                          </TableCell>
                          <TableCell
                            sx={{ whiteSpace: 'nowrap' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 700,
                                color:
                                  (ing.stockQuantity || 0) <= 0
                                    ? color.dangerDark
                                    : ing.minStock && ing.stockQuantity < ing.minStock
                                      ? color.warningDark
                                      : color.ink,
                              }}
                            >
                              {formatQty(ing.stockQuantity || 0)} pièce
                              {(ing.stockQuantity || 0) > 1 ? 's' : ''}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.25, ml: -0.75 }}>
                              <Button
                                size="small"
                                sx={{ minHeight: 26, px: 0.75, fontSize: '0.75rem' }}
                                onClick={() => setAdjustTarget(ing)}
                              >
                                Corriger
                              </Button>
                              <Button
                                size="small"
                                color="success"
                                sx={{ minHeight: 26, px: 0.75, fontSize: '0.75rem' }}
                                onClick={() => navigate(`${base}/${ing._id}?action=achat`)}
                              >
                                + Achat
                              </Button>
                            </Box>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell>{ing.unit}</TableCell>
                          <TableCell>
                            <Chip
                              label={
                                categories.find((c) => c.value === ing.category)?.label ||
                                ing.category
                              }
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                        </>
                      )}
                      <TableCell
                        align="right"
                        onClick={(e) => e.stopPropagation()}
                        sx={{ whiteSpace: 'nowrap' }}
                      >
                        <IconButton
                          size="small"
                          title="Sources et prix"
                          color="primary"
                          onClick={() => navigate(`${base}/${ing._id}`)}
                        >
                          <Storefront fontSize="small" />
                        </IconButton>
                        <IconButton size="small" title="Modifier" onClick={() => openEdit(ing)}>
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          title="Supprimer"
                          onClick={() => setDeleteId(ing._id)}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              {ingredients.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}
                  >
                    {isPack
                      ? 'Aucun emballage. Ajoutez vos boîtes, sachets, caissettes… avec leur prix.'
                      : 'Aucun ingrédient. Cliquez sur « Ajouter » pour commencer.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Dialog ajout/modif */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {isPack
            ? editId
              ? 'Modifier l’emballage'
              : 'Ajouter un emballage'
            : editId
              ? "Modifier l'ingrédient"
              : 'Ajouter un ingrédient'}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Nom"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            sx={{ mt: 1, mb: 2 }}
          />
          {isPack ? (
            <>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Type</InputLabel>
                <Select
                  value={form.packagingType}
                  label="Type"
                  onChange={(e) => setForm({ ...form, packagingType: e.target.value })}
                >
                  {PACKAGING_TYPES.map((t) => (
                    <MenuItem key={t.value} value={t.value}>
                      {t.emoji} {t.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
                Dans une commande, en proposer…
              </Typography>
              <ToggleButtonGroup
                exclusive
                fullWidth
                size="small"
                value={form.packagingUse}
                onChange={(_, v) => v && setForm({ ...form, packagingUse: v })}
                sx={{ mb: 0.75 }}
              >
                <ToggleButton value="per_item">1 par article</ToggleButton>
                <ToggleButton value="per_portion">1 par portion</ToggleButton>
              </ToggleButtonGroup>
              <Typography variant="caption" sx={{ display: 'block', color: color.inkSoft, mb: 2 }}>
                {PACKAGING_USE_LABELS[form.packagingUse].long}. Toujours modifiable dans la
                commande.
              </Typography>
            </>
          ) : (
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
          )}
          <TextField
            fullWidth
            label="Seuil d'alerte stock (optionnel)"
            type="number"
            value={form.minStock}
            onChange={(e) => setForm({ ...form, minStock: e.target.value })}
            helperText={`Alerte quand le stock passe sous cette quantité (en ${isPack ? 'pièces' : form.unit})`}
            inputProps={{ min: 0, step: 0.01 }}
            sx={{ mb: 2 }}
          />
          {!isPack && (
            <FormControl fullWidth sx={{ mb: 2 }}>
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
          )}

          {/* PRIX : moyenne des sources d'achat (au moins une source par ingrédient) */}
          {fromSources ? (
            <Alert severity="info" sx={{ alignItems: 'flex-start' }}>
              Prix utilisé :{' '}
              <strong>
                {formatDT(editing.pricePerUnit, 3)} / {editing.unit}
              </strong>
              , moyenne de vos sources. Pour le changer, modifiez le prix d’une source dans la fiche
              de l’ingrédient.
            </Alert>
          ) : !editId ? (
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                border: `1px solid ${color.border}`,
                bgcolor: color.surfaceMuted,
              }}
            >
              <Typography variant="subtitle2" sx={{ mb: 0.25 }}>
                Où l’achetez-vous ?
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: color.inkSoft, display: 'block', mb: 1.5 }}
              >
                {isPack
                  ? 'Le prix utilisé dans les commandes est la moyenne des prix de vos sources.'
                  : 'Le prix utilisé dans les recettes est la moyenne des prix de vos sources.'}{' '}
                Vous pourrez en ajouter d’autres ensuite.
              </Typography>
              <FormControl fullWidth sx={{ mb: 1.5 }}>
                <InputLabel>Source d’achat</InputLabel>
                <Select
                  value={form.sourceId}
                  label="Source d’achat"
                  onChange={(e) => {
                    if (e.target.value === NEW_SOURCE) {
                      setNewSourceOpen(true);
                      return;
                    }
                    setForm({ ...form, sourceId: e.target.value });
                  }}
                >
                  {sources.map((src) => (
                    <MenuItem key={src._id} value={src._id}>
                      {src.name}
                    </MenuItem>
                  ))}
                  <MenuItem value={NEW_SOURCE} sx={{ color: color.primaryDark, fontWeight: 600 }}>
                    + Nouvelle source…
                  </MenuItem>
                  <MenuItem value="">Pas encore de source</MenuItem>
                </Select>
              </FormControl>
              {form.sourceId ? (
                <TextField
                  fullWidth
                  label={`Prix chez cette source (DT / ${isPack ? 'pièce' : form.unit})`}
                  value={form.sourcePrice}
                  onChange={(e) => setForm({ ...form, sourcePrice: e.target.value })}
                  inputProps={{ inputMode: 'decimal' }}
                  helperText="Prix normal, pas une promotion"
                />
              ) : (
                <>
                  <TextField
                    fullWidth
                    label={`Prix estimé (DT / ${isPack ? 'pièce' : form.unit})`}
                    value={form.pricePerUnit}
                    onChange={(e) => setForm({ ...form, pricePerUnit: e.target.value })}
                    inputProps={{ inputMode: 'decimal' }}
                    sx={{ mb: 1 }}
                  />
                  <Alert severity="warning">
                    Sans source, ce prix reste fixe. Ajoutez une source dès que possible.
                  </Alert>
                </>
              )}
            </Box>
          ) : (
            <>
              <TextField
                fullWidth
                label={`Prix estimé (DT / ${isPack ? 'pièce' : form.unit})`}
                value={form.pricePerUnit}
                onChange={(e) => setForm({ ...form, pricePerUnit: e.target.value })}
                inputProps={{ inputMode: 'decimal' }}
                sx={{ mb: 1 }}
              />
              <Alert
                severity="warning"
                action={
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => navigate(`${base}/${editId}`)}
                  >
                    Ajouter
                  </Button>
                }
              >
                Aucune source : ajoutez-en une pour que le prix suive vos achats.
              </Alert>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Annuler</Button>
          <Button onClick={handleSave} variant="contained">
            {editId ? 'Modifier' : 'Ajouter'}
          </Button>
        </DialogActions>
      </Dialog>

      <SourceFormDialog
        open={newSourceOpen}
        onClose={() => setNewSourceOpen(false)}
        onSaved={(src) => {
          setSources((prev) => [...prev, src].sort((x, y) => x.name.localeCompare(y.name)));
          setForm((f) => ({ ...f, sourceId: src._id }));
          setNewSourceOpen(false);
        }}
      />

      <StockAdjustDialog
        target={adjustTarget}
        onClose={() => setAdjustTarget(null)}
        onSaved={() => load()}
      />

      {/* Confirm suppression */}
      <ConfirmDialog
        open={!!deleteId}
        title={isPack ? 'Supprimer cet emballage ?' : 'Supprimer cet ingrédient ?'}
        message={
          isPack
            ? 'L’emballage ne sera plus proposé dans les nouvelles commandes. Les commandes existantes le gardent.'
            : "L'ingrédient sera désactivé et ne sera plus disponible pour les nouvelles recettes."
        }
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </Box>
  );
};

export default IngredientsPage;
