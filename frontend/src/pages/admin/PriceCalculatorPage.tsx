import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  Autocomplete,
  Avatar,
  Box,
  Button,
  ButtonBase,
  Card,
  Divider,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add,
  Calculate,
  ContentCopy,
  DeleteOutline,
  Remove,
  ShoppingBag,
} from '@mui/icons-material';
import api from '../../services/api';
import { PageHeader } from '../../components/ui';
import PackagingPicker, { usePackagingOptions } from '../../components/admin/PackagingPicker';
import { color, radius, shadow, transition } from '../../theme/tokens';
import { formatDT } from '../../utils/format';
import type { Quote } from '../../types/admin';
import type { PackagingChoice } from '../../utils/packaging';
import type { PrefilledItem } from './ManualOrderPage';

interface Line {
  key: number;
  recipeId: string;
  variantIndex: number;
  quantity: number;
  packaging: PackagingChoice[];
}

let nextKey = 1;
const newLine = (): Line => ({
  key: nextKey++,
  recipeId: '',
  variantIndex: 0,
  quantity: 1,
  packaging: [],
});

const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.4 }}>
    <Typography
      variant="body2"
      sx={{ color: strong ? color.ink : color.inkSoft, fontWeight: strong ? 700 : 400 }}
    >
      {label}
    </Typography>
    <Typography variant="body2" sx={{ fontWeight: strong ? 700 : 600, whiteSpace: 'nowrap' }}>
      {value}
    </Typography>
  </Box>
);

/**
 * CALCULER UN PRIX — recette + taille + quantité + emballage → prix,
 * sans créer de commande. « Créer la commande » reprend le calcul tel quel.
 */
export default function PriceCalculatorPage() {
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState<any[]>([]);
  const [catalogPrices, setCatalogPrices] = useState<Record<string, { total: number }[]>>({});
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const packagingOptions = usePackagingOptions();

  useEffect(() => {
    api
      .get('/recipes?limit=200')
      .then((res) => setRecipes(res.data.data?.recipes || []))
      .catch(() => undefined);
    api
      .get('/prices/catalog')
      .then((res) => setCatalogPrices(res.data.data?.prices || {}))
      .catch(() => undefined);
  }, []);

  const recipeOf = (l: Line) => recipes.find((r) => r._id === l.recipeId);
  const portionsOf = (l: Line) => recipeOf(l)?.variants?.[l.variantIndex]?.portions || 1;

  const update = (key: number, patch: Partial<Line>) =>
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };
        // nouvelle taille : les emballages « par portion » suivent le nombre de portions
        const before = portionsOf(l);
        const after = portionsOf(next);
        if (before !== after && !patch.packaging) {
          next.packaging = next.packaging.map((c) => {
            const o = packagingOptions?.find((x) => x._id === c.packagingId);
            return o?.packagingUse === 'per_portion' && c.quantity === before
              ? { ...c, quantity: after }
              : c;
          });
        }
        return next;
      })
    );

  // Prix recalculé par le serveur (mêmes règles que les commandes)
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!lines.some((l) => l.recipeId)) {
        setQuote(null);
        return;
      }
      try {
        const res = await api.post('/prices/quote', {
          items: lines.map((l) =>
            l.recipeId
              ? {
                  recipeId: l.recipeId,
                  variantIndex: l.variantIndex,
                  quantity: l.quantity,
                  packaging: l.packaging.filter((p) => p.quantity > 0),
                }
              : {}
          ),
        });
        setQuote(res.data.data);
      } catch {
        setQuote(null);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [lines]);

  // Détail agrégé : ingrédients, électricité, eau, marge (× quantités)
  const breakdown = useMemo(() => {
    const t = { ingredientsCost: 0, electricityCost: 0, waterCost: 0, margin: 0 };
    (quote?.lines || []).forEach((l) => {
      if (!l?.breakdown) return;
      t.ingredientsCost += l.breakdown.ingredientsCost * l.quantity;
      t.electricityCost += l.breakdown.electricityCost * l.quantity;
      t.waterCost += l.breakdown.waterCost * l.quantity;
      t.margin += l.breakdown.margin * l.quantity;
    });
    return t;
  }, [quote]);

  const filled = lines.filter((l) => l.recipeId);
  const quoted = (quote?.lines || []).filter(Boolean);
  const single = quoted.length === 1 ? quoted[0]! : null;

  const createOrder = () => {
    const items: PrefilledItem[] = filled.map((l) => ({
      recipeId: l.recipeId,
      recipeName: recipeOf(l)?.name || '',
      variantIndex: l.variantIndex,
      quantity: l.quantity,
      packaging: l.packaging.filter((p) => p.quantity > 0),
    }));
    navigate('/admin/orders/new', { state: { items } });
  };

  const copyQuote = async () => {
    if (!quote) return;
    const text = [
      'Devis',
      ...quote.lines.flatMap((l) =>
        l
          ? [
              `• ${l.label} (${l.sizeName}) × ${l.quantity} : ${formatDT(l.lineTotal)}` +
                ((l.packagingUnitCost || 0) > 0
                  ? `\n   dont emballage ${formatDT((l.packagingUnitCost || 0) * l.quantity)}`
                  : ''),
            ]
          : []
      ),
      `Total : ${formatDT(quote.total)}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Devis copié — collez-le dans WhatsApp');
    } catch {
      toast.error('Copie impossible sur cet appareil');
    }
  };

  return (
    <Box>
      <PageHeader
        title="Calculer un prix"
        subtitle="Recette + taille + quantité + emballage → le prix, sans créer de commande."
        icon={<Calculate />}
        tone="primary"
        helpFlow="packaging"
      />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) 360px' },
          gap: 2.5,
          alignItems: 'start',
        }}
      >
        {/* Articles */}
        <Box sx={{ minWidth: 0 }}>
          {lines.map((l, i) => {
            const recipe = recipeOf(l);
            const q = quote?.lines[i] || null;
            return (
              <Card
                key={l.key}
                sx={{ p: { xs: 2, md: 2.5 }, mb: 2 }}
                data-testid={`calc-line-${i}`}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Typography variant="overline" sx={{ color: color.inkSoft, flex: 1 }}>
                    Article {i + 1}
                  </Typography>
                  {lines.length > 1 && (
                    <IconButton
                      size="small"
                      aria-label={`Retirer l’article ${i + 1}`}
                      onClick={() => setLines(lines.filter((x) => x.key !== l.key))}
                    >
                      <DeleteOutline fontSize="small" />
                    </IconButton>
                  )}
                </Box>

                <Autocomplete
                  options={recipes}
                  value={recipe || null}
                  getOptionLabel={(r: any) => r.name}
                  isOptionEqualToValue={(a: any, b: any) => a._id === b._id}
                  onChange={(_, v: any) =>
                    update(l.key, { recipeId: v?._id || '', variantIndex: 0 })
                  }
                  renderOption={(props, r: any) => (
                    <li {...props} key={r._id}>
                      <Avatar
                        variant="rounded"
                        src={r.images?.[0]}
                        sx={{ width: 36, height: 36, mr: 1.5, bgcolor: color.primarySoft }}
                      >
                        🎂
                      </Avatar>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {r.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: color.inkSoft }}>
                          {r.variants?.length || 0} taille(s)
                        </Typography>
                      </Box>
                    </li>
                  )}
                  renderInput={(params) => <TextField {...params} label="Recette" />}
                />

                {recipe?.variants?.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Taille
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {recipe.variants.map((v: any, vi: number) => {
                        const selected = l.variantIndex === vi;
                        return (
                          <ButtonBase
                            key={vi}
                            onClick={() => update(l.key, { variantIndex: vi })}
                            aria-pressed={selected}
                            sx={{
                              flexDirection: 'column',
                              alignItems: 'flex-start',
                              px: 1.5,
                              py: 1,
                              minWidth: 120,
                              borderRadius: `${radius.md}px`,
                              border: `1.5px solid ${selected ? color.primary : color.borderStrong}`,
                              bgcolor: selected ? color.primarySoft : color.surface,
                              transition: transition(['background-color', 'border-color']),
                              '&:hover': { borderColor: color.primary },
                            }}
                          >
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {v.sizeName}
                            </Typography>
                            <Typography variant="caption" sx={{ color: color.inkSoft }}>
                              {v.portions} portion{v.portions > 1 ? 's' : ''} ·{' '}
                              {formatDT(catalogPrices[recipe._id]?.[vi]?.total)}
                            </Typography>
                          </ButtonBase>
                        );
                      })}
                    </Box>
                  </Box>
                )}

                {recipe && (
                  <>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 2 }}>
                      <Typography variant="subtitle2" sx={{ flex: 1 }}>
                        Quantité
                      </Typography>
                      <IconButton
                        aria-label="Diminuer la quantité"
                        disabled={l.quantity <= 1}
                        onClick={() => update(l.key, { quantity: l.quantity - 1 })}
                        sx={{ border: `1px solid ${color.borderStrong}` }}
                        size="small"
                      >
                        <Remove fontSize="small" />
                      </IconButton>
                      <TextField
                        size="small"
                        value={l.quantity}
                        onChange={(e) =>
                          update(l.key, { quantity: Math.max(1, parseInt(e.target.value) || 1) })
                        }
                        inputProps={{
                          inputMode: 'numeric',
                          'aria-label': 'Quantité',
                          style: { textAlign: 'center', width: 36 },
                        }}
                      />
                      <IconButton
                        aria-label="Augmenter la quantité"
                        onClick={() => update(l.key, { quantity: l.quantity + 1 })}
                        sx={{ border: `1px solid ${color.borderStrong}` }}
                        size="small"
                      >
                        <Add fontSize="small" />
                      </IconButton>
                    </Box>
                    <Divider sx={{ my: 2 }} />
                    <PackagingPicker
                      value={l.packaging}
                      onChange={(packaging) => update(l.key, { packaging })}
                      options={packagingOptions}
                      portions={portionsOf(l)}
                      itemQuantity={l.quantity}
                    />
                    {q && (
                      <Box
                        sx={{
                          mt: 2,
                          pt: 1.5,
                          borderTop: `1px dashed ${color.border}`,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'baseline',
                          gap: 1,
                          flexWrap: 'wrap',
                        }}
                      >
                        <Typography variant="body2" sx={{ color: color.inkSoft }}>
                          {q.quantity} × ({formatDT(q.unitPrice)}
                          {(q.packagingUnitCost || 0) > 0 &&
                            ` + ${formatDT(q.packagingUnitCost)} emballage`}
                          )
                        </Typography>
                        <Typography sx={{ fontWeight: 800, color: color.primaryDark }}>
                          {formatDT(q.lineTotal)}
                        </Typography>
                      </Box>
                    )}
                  </>
                )}
              </Card>
            );
          })}

          <Button
            fullWidth
            variant="outlined"
            startIcon={<Add />}
            onClick={() => setLines([...lines, newLine()])}
            sx={{ borderStyle: 'dashed', py: 1.25 }}
          >
            Ajouter un article
          </Button>
        </Box>

        {/* Résultat */}
        <Card
          data-testid="calc-summary"
          sx={{
            p: 2.5,
            position: { md: 'sticky' },
            top: { md: 96 },
            boxShadow: shadow.raised,
          }}
        >
          {!quote || quoted.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Box sx={{ fontSize: 44, lineHeight: 1, mb: 1 }} aria-hidden>
                🧮
              </Box>
              <Typography sx={{ fontWeight: 700 }}>Choisissez une recette</Typography>
              <Typography variant="body2" sx={{ color: color.inkSoft }}>
                Le prix s’affiche ici, avec l’emballage.
              </Typography>
            </Box>
          ) : (
            <>
              <Typography variant="overline" sx={{ color: color.inkSoft }}>
                Prix total
              </Typography>
              <Typography
                data-testid="calc-total"
                sx={{
                  fontSize: '2.4rem',
                  fontWeight: 800,
                  lineHeight: 1.1,
                  color: color.primaryDark,
                  mb: 0.5,
                }}
              >
                {formatDT(quote.total)}
              </Typography>
              {single && (
                <Typography variant="body2" sx={{ color: color.inkSoft, mb: 1.5 }}>
                  soit {formatDT(single.lineTotal / single.quantity / (single.portions || 1))} par
                  portion ({single.portions} portions)
                </Typography>
              )}

              <Divider sx={{ my: 1.5 }} />
              <Row label="Ingrédients" value={formatDT(breakdown.ingredientsCost)} />
              <Row label="Électricité" value={formatDT(breakdown.electricityCost)} />
              <Row label="Eau" value={formatDT(breakdown.waterCost)} />
              <Row label="Marge" value={formatDT(breakdown.margin)} />
              <Row label="Produits" value={formatDT(quote.productsTotal)} strong />
              <Row
                label="Emballage"
                value={(quote.packagingTotal || 0) > 0 ? formatDT(quote.packagingTotal) : '—'}
                strong
              />
              <Divider sx={{ my: 1.5 }} />
              <Row label="Total" value={formatDT(quote.total)} strong />
              {(quote.stockNeeds || []).some((n) => n.status === 'missing') && (
                <Typography
                  variant="caption"
                  sx={{ display: 'block', mt: 1, color: color.warningDark }}
                >
                  ⚠ Il manque du stock :{' '}
                  {quote.stockNeeds
                    .filter((n) => n.status === 'missing')
                    .map((n) => n.name)
                    .join(', ')}
                </Typography>
              )}

              <Box sx={{ display: 'grid', gap: 1, mt: 2 }}>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<ShoppingBag />}
                  onClick={createOrder}
                >
                  Créer la commande
                </Button>
                <Button variant="outlined" startIcon={<ContentCopy />} onClick={copyQuote}>
                  Copier le devis
                </Button>
              </Box>
            </>
          )}
        </Card>
      </Box>
    </Box>
  );
}
