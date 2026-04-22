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
  Grid,
  TextField,
  IconButton,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { ArrowBack, Add, Delete, ShoppingBag } from '@mui/icons-material';

interface CustomIngredient {
  ingredientId: string;
  name: string;
  quantity: number;
  unit: string;
}

interface CustomAppliance {
  applianceId: string;
  name: string;
  duration: number;
}

interface OrderItemForm {
  mode: 'existing' | 'custom';
  // Existing recipe
  recipeId: string;
  recipeName: string;
  variantIndex: number;
  // Custom recipe
  customName: string;
  customDescription: string;
  customSizeName: string;
  customPortions: number;
  customIngredients: CustomIngredient[];
  customAppliances: CustomAppliance[];
  // Common
  quantity: number;
  clientProvidedIngredients: string[];
}

interface FeeItem {
  label: string;
  amount: number;
}

const emptyItem = (): OrderItemForm => ({
  mode: 'existing',
  recipeId: '',
  recipeName: '',
  variantIndex: 0,
  customName: '',
  customDescription: '',
  customSizeName: 'Standard',
  customPortions: 1,
  customIngredients: [],
  customAppliances: [],
  quantity: 1,
  clientProvidedIngredients: [],
});

const ManualOrderPage = () => {
  const navigate = useNavigate();
  const [sending, setSending] = useState(false);

  // Client info
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [requestedDate, setRequestedDate] = useState('');
  const [notes, setNotes] = useState('');

  // Items
  const [items, setItems] = useState<OrderItemForm[]>([emptyItem()]);

  // Fees
  const [fees, setFees] = useState<FeeItem[]>([]);

  // Save as recipe
  const [saveAsRecipe, setSaveAsRecipe] = useState(false);

  // Data from API
  const [recipes, setRecipes] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [appliances, setAppliances] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [recRes, ingRes, appRes] = await Promise.all([
          api.get('/recipes?limit=200'),
          api.get('/ingredients'),
          api.get('/appliances'),
        ]);
        setRecipes(recRes.data.data?.recipes || []);
        setIngredients(ingRes.data.data?.ingredients || ingRes.data.data || []);
        setAppliances(appRes.data.data?.appliances || appRes.data.data || []);
      } catch {
        /* ignore */
      }
    };
    load();
  }, []);

  const updateItem = (index: number, updates: Partial<OrderItemForm>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...updates } : item)));
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addCustomIngredient = (itemIndex: number) => {
    const item = items[itemIndex];
    updateItem(itemIndex, {
      customIngredients: [
        ...item.customIngredients,
        { ingredientId: '', name: '', quantity: 0, unit: 'kg' },
      ],
    });
  };

  const updateCustomIngredient = (
    itemIndex: number,
    ingIndex: number,
    updates: Partial<CustomIngredient>
  ) => {
    const item = items[itemIndex];
    const newIngs = item.customIngredients.map((ing, i) =>
      i === ingIndex ? { ...ing, ...updates } : ing
    );
    updateItem(itemIndex, { customIngredients: newIngs });
  };

  const removeCustomIngredient = (itemIndex: number, ingIndex: number) => {
    const item = items[itemIndex];
    updateItem(itemIndex, {
      customIngredients: item.customIngredients.filter((_, i) => i !== ingIndex),
    });
  };

  const addCustomAppliance = (itemIndex: number) => {
    const item = items[itemIndex];
    updateItem(itemIndex, {
      customAppliances: [...item.customAppliances, { applianceId: '', name: '', duration: 30 }],
    });
  };

  const updateCustomAppliance = (
    itemIndex: number,
    appIndex: number,
    updates: Partial<CustomAppliance>
  ) => {
    const item = items[itemIndex];
    const newApps = item.customAppliances.map((app, i) =>
      i === appIndex ? { ...app, ...updates } : app
    );
    updateItem(itemIndex, { customAppliances: newApps });
  };

  const removeCustomAppliance = (itemIndex: number, appIndex: number) => {
    const item = items[itemIndex];
    updateItem(itemIndex, {
      customAppliances: item.customAppliances.filter((_, i) => i !== appIndex),
    });
  };

  const handleSubmit = async () => {
    if (!clientName || !clientPhone) {
      toast.error('Nom et telephone requis');
      return;
    }
    if (items.every((i) => (i.mode === 'existing' ? !i.recipeId : !i.customName))) {
      toast.error('Ajoutez au moins un article');
      return;
    }

    setSending(true);
    try {
      const payload = {
        clientName,
        clientPhone,
        notes,
        requestedDate: requestedDate || null,
        saveAsRecipe,
        additionalFees: fees.filter((f) => f.label && f.amount > 0),
        items: items.map((item) => {
          if (item.mode === 'existing') {
            return {
              recipeId: item.recipeId,
              variantIndex: item.variantIndex,
              quantity: item.quantity,
              clientProvidedIngredients: item.clientProvidedIngredients,
            };
          }
          return {
            quantity: item.quantity,
            clientProvidedIngredients: item.clientProvidedIngredients,
            custom: {
              name: item.customName,
              description: item.customDescription,
              sizeName: item.customSizeName,
              portions: item.customPortions,
              ingredients: item.customIngredients
                .filter((i) => i.ingredientId)
                .map((i) => ({
                  ingredientId: i.ingredientId,
                  quantity: i.quantity,
                  unit: i.unit,
                })),
              appliances: item.customAppliances
                .filter((a) => a.applianceId)
                .map((a) => ({
                  applianceId: a.applianceId,
                  duration: a.duration,
                })),
            },
          };
        }),
      };

      await api.post('/orders/manual', payload);
      toast.success('Commande creee !');
      navigate('/admin/orders');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la creation');
    }
    setSending(false);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#fafafa' }}>
      {/* Header */}
      <Box sx={{ bgcolor: 'white', borderBottom: '1px solid #eee', py: 2, px: 3 }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={() => navigate('/admin/orders')}>
              <ArrowBack />
            </IconButton>
            <Typography
              variant="h5"
              sx={{ fontWeight: 600, fontSize: { xs: '1.1rem', md: '1.5rem' } }}
            >
              Nouvelle commande manuelle
            </Typography>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Grid container spacing={3}>
          {/* Colonne gauche — Client */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  Client
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  label="Nom du client *"
                  sx={{ mb: 2 }}
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Telephone *"
                  sx={{ mb: 2 }}
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="+216 XX XXX XXX"
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Date souhaitee"
                  type="datetime-local"
                  sx={{ mb: 2 }}
                  value={requestedDate}
                  onChange={(e) => setRequestedDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Notes"
                  multiline
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Details, demandes speciales..."
                />
              </CardContent>
            </Card>

            {/* Frais supplementaires */}
            <Card sx={{ mt: 2 }}>
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 1,
                  }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Frais supplementaires
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => setFees([...fees, { label: '', amount: 0 }])}
                  >
                    <Add fontSize="small" />
                  </IconButton>
                </Box>
                {fees.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Livraison, emballage special...
                  </Typography>
                )}
                {fees.map((fee, i) => (
                  <Box key={i} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                    <TextField
                      size="small"
                      label="Libelle"
                      value={fee.label}
                      sx={{ flex: 2 }}
                      onChange={(e) =>
                        setFees(
                          fees.map((f, fi) => (fi === i ? { ...f, label: e.target.value } : f))
                        )
                      }
                    />
                    <TextField
                      size="small"
                      label="DT"
                      type="number"
                      value={fee.amount}
                      sx={{ flex: 1 }}
                      onChange={(e) =>
                        setFees(
                          fees.map((f, fi) =>
                            fi === i ? { ...f, amount: parseFloat(e.target.value) || 0 } : f
                          )
                        )
                      }
                    />
                    <IconButton
                      size="small"
                      onClick={() => setFees(fees.filter((_, fi) => fi !== i))}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>

          {/* Colonne droite — Articles */}
          <Grid item xs={12} md={8}>
            {items.map((item, itemIndex) => (
              <Card key={itemIndex} sx={{ mb: 2 }}>
                <CardContent>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: 2,
                    }}
                  >
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Article {itemIndex + 1}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Chip
                        label="Recette existante"
                        color={item.mode === 'existing' ? 'primary' : 'default'}
                        variant={item.mode === 'existing' ? 'filled' : 'outlined'}
                        onClick={() => updateItem(itemIndex, { mode: 'existing' })}
                        sx={{ cursor: 'pointer' }}
                      />
                      <Chip
                        label="Recette speciale"
                        color={item.mode === 'custom' ? 'primary' : 'default'}
                        variant={item.mode === 'custom' ? 'filled' : 'outlined'}
                        onClick={() => updateItem(itemIndex, { mode: 'custom' })}
                        sx={{ cursor: 'pointer' }}
                      />
                      {items.length > 1 && (
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => removeItem(itemIndex)}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  </Box>

                  {/* Mode : recette existante */}
                  {item.mode === 'existing' && (
                    <>
                      <Autocomplete
                        size="small"
                        options={recipes}
                        getOptionLabel={(r: any) => r.name}
                        value={recipes.find((r) => r._id === item.recipeId) || null}
                        onChange={(_, val) =>
                          updateItem(itemIndex, {
                            recipeId: val?._id || '',
                            recipeName: val?.name || '',
                            variantIndex: 0,
                          })
                        }
                        renderInput={(params) => (
                          <TextField {...params} label="Chercher une recette" />
                        )}
                        sx={{ mb: 2 }}
                      />
                      {item.recipeId &&
                        (() => {
                          const recipe = recipes.find((r) => r._id === item.recipeId);
                          if (!recipe?.variants?.length) return null;
                          return (
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                              {recipe.variants.map((v: any, vi: number) => (
                                <Chip
                                  key={vi}
                                  label={`${v.sizeName} (${v.portions} portions)`}
                                  color={item.variantIndex === vi ? 'primary' : 'default'}
                                  variant={item.variantIndex === vi ? 'filled' : 'outlined'}
                                  onClick={() => updateItem(itemIndex, { variantIndex: vi })}
                                  sx={{ cursor: 'pointer' }}
                                />
                              ))}
                            </Box>
                          );
                        })()}
                    </>
                  )}

                  {/* Mode : recette custom */}
                  {item.mode === 'custom' && (
                    <>
                      <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Nom de la recette *"
                            value={item.customName}
                            onChange={(e) => updateItem(itemIndex, { customName: e.target.value })}
                          />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Taille"
                            value={item.customSizeName}
                            onChange={(e) =>
                              updateItem(itemIndex, { customSizeName: e.target.value })
                            }
                          />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Portions"
                            type="number"
                            value={item.customPortions}
                            onChange={(e) =>
                              updateItem(itemIndex, {
                                customPortions: parseInt(e.target.value) || 1,
                              })
                            }
                          />
                        </Grid>
                      </Grid>
                      <TextField
                        fullWidth
                        size="small"
                        label="Description (optionnel)"
                        sx={{ mb: 2 }}
                        value={item.customDescription}
                        onChange={(e) =>
                          updateItem(itemIndex, { customDescription: e.target.value })
                        }
                      />

                      {/* Ingredients custom */}
                      <Box sx={{ mb: 2 }}>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            mb: 1,
                          }}
                        >
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            Ingredients
                          </Typography>
                          <Button
                            size="small"
                            startIcon={<Add />}
                            onClick={() => addCustomIngredient(itemIndex)}
                          >
                            Ajouter
                          </Button>
                        </Box>
                        {item.customIngredients.map((ing, ingIndex) => (
                          <Box
                            key={ingIndex}
                            sx={{
                              display: 'flex',
                              gap: 1,
                              mb: 1,
                              alignItems: 'center',
                              flexWrap: 'wrap',
                            }}
                          >
                            <FormControl size="small" sx={{ minWidth: 150, flex: 2 }}>
                              <InputLabel>Ingredient</InputLabel>
                              <Select
                                label="Ingredient"
                                value={ing.ingredientId}
                                onChange={(e) => {
                                  const sel = ingredients.find(
                                    (i: any) => i._id === e.target.value
                                  );
                                  updateCustomIngredient(itemIndex, ingIndex, {
                                    ingredientId: e.target.value as string,
                                    name: sel?.name || '',
                                    unit: sel?.unit || 'kg',
                                  });
                                }}
                              >
                                {ingredients
                                  .filter((i: any) => i.isActive)
                                  .map((i: any) => (
                                    <MenuItem key={i._id} value={i._id}>
                                      {i.name} ({i.pricePerUnit} DT/{i.unit})
                                    </MenuItem>
                                  ))}
                              </Select>
                            </FormControl>
                            <TextField
                              size="small"
                              label="Qte"
                              type="number"
                              sx={{ width: 80 }}
                              value={ing.quantity}
                              onChange={(e) =>
                                updateCustomIngredient(itemIndex, ingIndex, {
                                  quantity: parseFloat(e.target.value) || 0,
                                })
                              }
                            />
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ minWidth: 30 }}
                            >
                              {ing.unit}
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={() => removeCustomIngredient(itemIndex, ingIndex)}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Box>
                        ))}
                      </Box>

                      {/* Machines custom */}
                      <Box sx={{ mb: 1 }}>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            mb: 1,
                          }}
                        >
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            Machines
                          </Typography>
                          <Button
                            size="small"
                            startIcon={<Add />}
                            onClick={() => addCustomAppliance(itemIndex)}
                          >
                            Ajouter
                          </Button>
                        </Box>
                        {item.customAppliances.map((app, appIndex) => (
                          <Box
                            key={appIndex}
                            sx={{
                              display: 'flex',
                              gap: 1,
                              mb: 1,
                              alignItems: 'center',
                              flexWrap: 'wrap',
                            }}
                          >
                            <FormControl size="small" sx={{ minWidth: 150, flex: 2 }}>
                              <InputLabel>Machine</InputLabel>
                              <Select
                                label="Machine"
                                value={app.applianceId}
                                onChange={(e) => {
                                  const sel = appliances.find((a: any) => a._id === e.target.value);
                                  updateCustomAppliance(itemIndex, appIndex, {
                                    applianceId: e.target.value as string,
                                    name: sel?.name || '',
                                  });
                                }}
                              >
                                {appliances
                                  .filter((a: any) => a.isActive)
                                  .map((a: any) => (
                                    <MenuItem key={a._id} value={a._id}>
                                      {a.name} ({a.powerConsumption}
                                      {a.unit})
                                    </MenuItem>
                                  ))}
                              </Select>
                            </FormControl>
                            <TextField
                              size="small"
                              label="Duree (min)"
                              type="number"
                              sx={{ width: 100 }}
                              value={app.duration}
                              onChange={(e) =>
                                updateCustomAppliance(itemIndex, appIndex, {
                                  duration: parseInt(e.target.value) || 0,
                                })
                              }
                            />
                            <IconButton
                              size="small"
                              onClick={() => removeCustomAppliance(itemIndex, appIndex)}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Box>
                        ))}
                      </Box>
                    </>
                  )}

                  <Divider sx={{ my: 1.5 }} />
                  <TextField
                    size="small"
                    label="Quantite"
                    type="number"
                    sx={{ width: 100 }}
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(itemIndex, {
                        quantity: Math.max(1, parseInt(e.target.value) || 1),
                      })
                    }
                  />
                </CardContent>
              </Card>
            ))}

            {/* Ajouter un article */}
            <Button
              variant="outlined"
              fullWidth
              startIcon={<Add />}
              sx={{ mb: 2 }}
              onClick={() => setItems([...items, emptyItem()])}
            >
              Ajouter un article
            </Button>

            {/* Options + Soumettre */}
            <Card>
              <CardContent>
                {items.some((i) => i.mode === 'custom') && (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={saveAsRecipe}
                        onChange={(e) => setSaveAsRecipe(e.target.checked)}
                      />
                    }
                    label="Sauvegarder la recette speciale dans le catalogue (visible aux clients)"
                    sx={{ mb: 2, display: 'block' }}
                  />
                )}

                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  startIcon={<ShoppingBag />}
                  onClick={handleSubmit}
                  disabled={sending || !clientName || !clientPhone}
                  sx={{ py: 1.5 }}
                >
                  {sending ? 'Creation...' : 'Creer la commande'}
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default ManualOrderPage;
