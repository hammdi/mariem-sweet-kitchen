import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import api, { withIdempotency } from '../../services/api';
import { useIdempotentAction } from '../../hooks/useIdempotencyKey';
import { PageHeader } from '../../components/ui';
import { color } from '../../theme/tokens';
import {
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
import { Add, Delete, ShoppingBag, Inventory2 } from '@mui/icons-material';
import ClientPicker from '../../components/admin/ClientPicker';
import StockNeedsPanel from '../../components/admin/StockNeedsPanel';
import type { Client, Quote } from '../../types/admin';
import { formatDT } from '../../utils/format';
import { getOrderFormIssues } from '../../utils/orderForm';
import DateTimeField from '../../components/common/DateTimeField';

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
  const [searchParams] = useSearchParams();
  const op = useIdempotentAction(); // une commande = une clé : un double clic ne crée qu'une commande
  const sending = op.busy;

  // Client (fiche existante ou nouvelle)
  const [client, setClient] = useState<Client | null>(null);
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
  // Prix de chaque taille : { recipeId: [{ sizeName, total }] }
  const [catalogPrices, setCatalogPrices] = useState<Record<string, { total: number }[]>>({});
  const [quote, setQuote] = useState<Quote | null>(null);

  // Commande lancee depuis une fiche client : ?clientId=...
  useEffect(() => {
    const clientId = searchParams.get('clientId');
    if (!clientId) return;
    api
      .get(`/clients/${clientId}`)
      .then((res) => setClient(res.data.data?.client || null))
      .catch(() => {
        /* ignore */
      });
  }, [searchParams]);

  useEffect(() => {
    api
      .get('/prices/catalog')
      .then((res) => setCatalogPrices(res.data.data?.prices || {}))
      .catch(() => {
        /* ignore */
      });
  }, []);

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

  const buildItemsPayload = (list: OrderItemForm[]) =>
    list.map((item) => {
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
    });

  const validFees = useMemo(() => fees.filter((f) => f.label && f.amount > 0), [fees]);

  // Apercu du prix et du stock AVANT creation (recalcule a chaque modification)
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const res = await api.post('/prices/quote', {
          // lignes incompletes envoyees vides → prix null pour cette ligne
          items: items.map((item) =>
            (item.mode === 'existing' && !item.recipeId) ||
            (item.mode === 'custom' && !item.customName)
              ? {}
              : buildItemsPayload([item])[0]
          ),
          additionalFees: validFees,
          requestedDate: requestedDate || null, // ordre d'attribution du stock entre commandes
        });
        setQuote(res.data.data);
      } catch {
        setQuote(null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [items, validFees, requestedDate]);

  // Conditions du bouton (le stock n'en fait pas partie, voir utils/orderForm)
  const formIssues = getOrderFormIssues({ hasClient: !!client, items });

  const handleSubmit = async () => {
    if (!client || formIssues.length > 0) {
      toast.error(formIssues[0]);
      return;
    }

    await op.run(async (key) => {
      const payload = {
        clientId: client._id,
        notes,
        requestedDate: requestedDate || null,
        saveAsRecipe,
        additionalFees: validFees,
        items: buildItemsPayload(items),
      };

      const res = await api.post('/orders/manual', payload, withIdempotency(key));
      const order = res.data.data.order;
      toast.success(`Commande CMD-${order.orderNumber} enregistrée`);
      // Fiche de la commande : ingrédients disponibles / manquants, date du besoin
      navigate(`/admin/orders/${order._id}`);
    }).catch(() => undefined /* message du serveur affiché par l'intercepteur */);
  };

  return (
    <Box>
      <PageHeader
        backTo="/admin/orders"
        title="Nouvelle commande"
        helpTour="create-order"
        helpFlow="missing"
        subtitle="Vous pouvez enregistrer la commande même s’il manque un ingrédient : le stock n’est utilisé qu’au début de la préparation."
      />
      <Box>
        <Grid container spacing={3}>
          {/* Colonne gauche — Client */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  Client
                </Typography>
                <Box data-tour="order-client">
                  <ClientPicker value={client} onChange={setClient} />
                </Box>
                <Divider sx={{ my: 2 }} />
                <Box sx={{ mb: 2 }} data-tour="order-date">
                  <DateTimeField
                    label="Date souhaitée"
                    value={requestedDate || null}
                    onChange={(iso) => setRequestedDate(iso || '')}
                  />
                </Box>
                <TextField
                  fullWidth
                  size="small"
                  label="Notes"
                  multiline
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Détails, demandes spéciales…"
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
                    Livraison, emballage spécial…
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
                        label="Recette spéciale"
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
                        data-tour={itemIndex === 0 ? 'order-product' : undefined}
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
                                  label={`${v.sizeName} — ${formatDT(catalogPrices[recipe._id]?.[vi]?.total)}`}
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
                              <InputLabel>Ingrédient</InputLabel>
                              <Select
                                label="Ingrédient"
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
                              label="Durée (min)"
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
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 2,
                      flexWrap: 'wrap',
                    }}
                  >
                    <TextField
                      data-tour={itemIndex === 0 ? 'order-quantity' : undefined}
                      size="small"
                      label="Quantité"
                      type="number"
                      sx={{ width: 100 }}
                      value={item.quantity}
                      inputProps={{ min: 1, inputMode: 'numeric' }}
                      onChange={(e) =>
                        updateItem(itemIndex, {
                          quantity: Math.max(1, parseInt(e.target.value) || 1),
                        })
                      }
                    />
                    {quote?.lines[itemIndex] && (
                      <Typography sx={{ fontWeight: 600 }}>
                        {quote.lines[itemIndex]!.quantity} ×{' '}
                        {formatDT(quote.lines[itemIndex]!.unitPrice)} ={' '}
                        <Box component="span" sx={{ color: 'primary.main' }}>
                          {formatDT(quote.lines[itemIndex]!.lineTotal)}
                        </Box>
                      </Typography>
                    )}
                  </Box>
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

            {/* Récapitulatif : prix et ingrédients visibles AVANT la création */}
            {!(quote && quote.lines.some(Boolean)) && (
              <Card sx={{ mb: 2, borderStyle: 'dashed' }} data-tour="order-stock">
                <CardContent sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                  <Inventory2 sx={{ color: color.inkMuted }} />
                  <Typography variant="body2" sx={{ color: color.inkSoft }}>
                    Choisissez un produit : le prix et les ingrédients nécessaires (disponibles ou manquants) s’affichent ici.
                  </Typography>
                </CardContent>
              </Card>
            )}
            {quote && quote.lines.some(Boolean) && (
              <Card sx={{ mb: 2 }} data-tour="order-stock">
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                    Récapitulatif
                  </Typography>
                  {quote.lines.map(
                    (l, i) =>
                      l && (
                        <Box
                          key={i}
                          sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 0.5 }}
                        >
                          <Typography variant="body2">
                            {l.label} {l.sizeName} — {l.quantity} × {formatDT(l.unitPrice)}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}
                          >
                            {formatDT(l.lineTotal)}
                          </Typography>
                        </Box>
                      )
                  )}
                  {validFees.map((f, i) => (
                    <Box
                      key={`fee-${i}`}
                      sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        {f.label}
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                        {formatDT(f.amount)}
                      </Typography>
                    </Box>
                  ))}
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      Total
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                      {formatDT(quote.total)}
                    </Typography>
                  </Box>
                  {quote.stockNeeds.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                        Ingrédients nécessaires
                      </Typography>
                      <StockNeedsPanel needs={quote.stockNeeds} />
                    </Box>
                  )}
                </CardContent>
              </Card>
            )}

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
                    label="Enregistrer la recette spéciale dans le catalogue (visible par les clients)"
                    sx={{ mb: 2, display: 'block' }}
                  />
                )}

                <Button
                  data-tour="order-submit"
                  variant="contained"
                  fullWidth
                  size="large"
                  startIcon={<ShoppingBag />}
                  onClick={handleSubmit}
                  disabled={sending || formIssues.length > 0}
                  sx={{ py: 1.5 }}
                >
                  {sending
                    ? 'Création…'
                    : quote && quote.total > 0
                      ? `Créer la commande — ${formatDT(quote.total)}`
                      : 'Créer la commande'}
                </Button>
                {formIssues.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    {formIssues.map((issue) => (
                      <Typography key={issue} variant="body2" color="warning.dark">
                        • {issue}
                      </Typography>
                    ))}
                  </Box>
                )}
                {formIssues.length === 0 &&
                  quote?.stockNeeds.some((n) => n.status === 'missing') && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Il manque des ingrédients : la commande sera enregistrée, seule la préparation
                      attendra l&apos;achat (l&apos;ingrédient part dans la liste de courses).
                    </Typography>
                  )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default ManualOrderPage;
