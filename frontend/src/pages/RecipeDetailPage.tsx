import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  Box,
  Button,
  ButtonBase,
  Card,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Skeleton,
  TextField,
  Typography,
} from '@mui/material';
import { Add, ArrowBack, CheckCircle, Remove, ShoppingBag, WhatsApp } from '@mui/icons-material';
import api from '../services/api';
import OrderDatePicker from '../components/common/OrderDatePicker';
import Slideshow from '../components/catalog/Slideshow';
import CatalogCard, { CatalogPhoto } from '../components/catalog/CatalogCard';
import { useCatalog } from '../components/catalog/useCatalog';
import {
  CatalogItem,
  formatPrice,
  fromPrice,
  variantFacts,
  WHATSAPP_URL,
} from '../components/catalog/catalog';
import { color, font, radius } from '../theme/tokens';

/** Fiche d'une création : photos, description, conseils, tailles, prix et commande. */
const RecipeDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<CatalogItem | null>(null);
  const [selected, setSelected] = useState(0);
  const [orderOpen, setOrderOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ orderNumber?: number } | null>(null);
  const [form, setForm] = useState({
    clientName: '',
    clientPhone: '',
    quantity: 1,
    requestedDate: '',
    notes: '',
  });
  const { items: related } = useCatalog({ category: item?.categories[0] || '' });

  useEffect(() => {
    let alive = true;
    setItem(null);
    setSelected(0);
    api
      .get(`/catalog/${id}`)
      .then((res) => alive && setItem(res.data.data.item))
      .catch(() => alive && navigate('/recipes'));
    window.scrollTo({ top: 0 });
    return () => {
      alive = false;
    };
  }, [id, navigate]);

  if (!item) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Skeleton variant="text" width={180} />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0,1fr)', md: '7fr 5fr' },
            gap: 4,
            mt: 2,
          }}
        >
          <Skeleton variant="rounded" sx={{ height: { xs: 320, md: 520 }, borderRadius: 4 }} />
          <Box>
            <Skeleton variant="text" height={60} />
            <Skeleton variant="text" />
            <Skeleton variant="text" />
            <Skeleton variant="rounded" height={140} sx={{ mt: 2 }} />
          </Box>
        </Box>
      </Container>
    );
  }

  const variant = item.variants[selected] || item.variants[0];
  const price = variant?.price ?? null;
  const showPrice = fromPrice(item) !== null;
  const total = price !== null ? price * form.quantity : null;
  const others = (related || []).filter((r) => r._id !== item._id).slice(0, 3);

  const sendOrder = async () => {
    setSending(true);
    try {
      const res = await api.post('/orders', {
        clientName: form.clientName.trim(),
        clientPhone: form.clientPhone.trim(),
        requestedDate: form.requestedDate ? new Date(form.requestedDate).toISOString() : null,
        items: [{ recipeId: item._id, variantIndex: selected, quantity: form.quantity }],
        notes: form.notes,
      });
      setDone({ orderNumber: res.data.data?.order?.orderNumber });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'La commande n’a pas pu être envoyée');
    }
    setSending(false);
  };

  return (
    <Box sx={{ bgcolor: color.bg }}>
      <Container maxWidth="lg" sx={{ py: { xs: 2.5, md: 4 } }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/recipes')} sx={{ mb: 2 }}>
          Retour au catalogue
        </Button>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 7fr) minmax(0, 5fr)' },
            gap: { xs: 3, md: 5 },
            alignItems: 'start',
          }}
        >
          {/* Photos qui défilent */}
          <Box
            sx={{
              borderRadius: `${radius.xl}px`,
              overflow: 'hidden',
              position: { md: 'sticky' },
              top: { md: 88 },
            }}
          >
            {item.images.length > 0 ? (
              <Slideshow
                label={`Photos de ${item.name}`}
                height={{ xs: 340, sm: 440, md: 540 }}
                interval={3800}
                slides={item.images.map((src, i) => (
                  <CatalogPhoto key={src} src={src} alt={`${item.name} — photo ${i + 1}`} />
                ))}
              />
            ) : (
              <Box sx={{ height: { xs: 300, md: 480 } }}>
                <CatalogPhoto alt={item.name} />
              </Box>
            )}
          </Box>

          {/* Présentation */}
          <Box>
            {item.categories.length > 0 && (
              <Typography variant="overline" sx={{ color: color.primaryDark }}>
                {item.categories.join(' · ')}
              </Typography>
            )}
            <Typography
              component="h1"
              sx={{
                fontFamily: font.brand,
                fontWeight: 700,
                fontSize: { xs: '2.2rem', md: '2.8rem' },
                lineHeight: 1.1,
              }}
            >
              {item.name}
            </Typography>
            {price !== null && (
              <Typography
                sx={{ mt: 1, fontSize: '1.6rem', fontWeight: 800, color: color.primaryDark }}
              >
                {formatPrice(price)}
                <Typography
                  component="span"
                  sx={{ ml: 1, fontSize: '1rem', color: color.inkSoft, fontWeight: 500 }}
                >
                  {variant.sizeName}
                </Typography>
              </Typography>
            )}
            {item.description && (
              <Typography
                sx={{ mt: 2, color: color.inkSoft, fontSize: '1.05rem', lineHeight: 1.7 }}
              >
                {item.description}
              </Typography>
            )}

            {item.recommendations.length > 0 && (
              <Box
                component="ul"
                sx={{ listStyle: 'none', p: 0, m: 0, mt: 2.5, display: 'grid', gap: 1 }}
              >
                {item.recommendations.map((r) => (
                  <Box
                    component="li"
                    key={r}
                    sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}
                  >
                    <CheckCircle sx={{ fontSize: 20, color: color.success, mt: '2px' }} />
                    <Typography>{r}</Typography>
                  </Box>
                ))}
              </Box>
            )}

            {/* Tailles */}
            <Typography sx={{ fontWeight: 700, mt: 3, mb: 1.25 }}>
              {item.variants.length > 1 ? 'Choisissez la taille' : 'Taille'}
            </Typography>
            <Box sx={{ display: 'grid', gap: 1.25 }}>
              {item.variants.map((v, i) => {
                const active = i === selected;
                return (
                  <ButtonBase
                    key={v.sizeName + i}
                    aria-pressed={active}
                    onClick={() => setSelected(i)}
                    sx={{
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 2,
                      p: 1.75,
                      textAlign: 'left',
                      borderRadius: `${radius.lg}px`,
                      border: `2px solid ${active ? color.primary : color.border}`,
                      bgcolor: active ? color.primarySoft : color.surface,
                      transition: 'border-color 200ms ease, background-color 200ms ease',
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontWeight: 700 }}>{v.sizeName}</Typography>
                      <Typography variant="body2" sx={{ color: color.inkSoft }}>
                        {variantFacts(v).join(' · ')}
                      </Typography>
                    </Box>
                    <Typography
                      sx={{ fontWeight: 800, whiteSpace: 'nowrap', color: color.primaryDark }}
                    >
                      {v.price !== null ? formatPrice(v.price) : showPrice ? '—' : 'Sur demande'}
                    </Typography>
                  </ButtonBase>
                );
              })}
            </Box>

            {/* Date et commande */}
            <Card sx={{ p: { xs: 2, md: 2.5 }, mt: 3 }} data-testid="order-card">
              <OrderDatePicker
                value={form.requestedDate}
                onChange={(v: string) => setForm({ ...form, requestedDate: v })}
              />
              <Box sx={{ display: 'grid', gap: 1.25, mt: 2 }}>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<ShoppingBag />}
                  disabled={!form.requestedDate}
                  onClick={() => {
                    setDone(null);
                    setOrderOpen(true);
                  }}
                  sx={{ py: 1.4 }}
                >
                  {form.requestedDate ? 'Commander' : 'Choisissez une date pour commander'}
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<WhatsApp />}
                  href={WHATSAPP_URL(
                    `Bonjour Mariem, je suis intéressé(e) par « ${item.name} » (${variant.sizeName}).`
                  )}
                  target="_blank"
                  rel="noopener"
                >
                  Poser une question sur WhatsApp
                </Button>
              </Box>
              <Typography
                variant="caption"
                sx={{ display: 'block', mt: 1.25, color: color.inkSoft, textAlign: 'center' }}
              >
                Mariem vous rappelle pour confirmer · paiement en espèces à la récupération
              </Typography>
            </Card>
          </Box>
        </Box>

        {others.length > 0 && (
          <Box sx={{ mt: { xs: 6, md: 9 } }}>
            <Typography
              component="h2"
              sx={{ fontFamily: font.brand, fontWeight: 700, fontSize: '1.8rem', mb: 2.5 }}
            >
              Vous aimerez aussi
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'minmax(0, 1fr)',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  md: 'repeat(3, minmax(0, 1fr))',
                },
                gap: 3,
              }}
            >
              {others.map((o) => (
                <CatalogCard key={o._id} item={o} />
              ))}
            </Box>
          </Box>
        )}
      </Container>

      {/* Commande */}
      <Dialog
        open={orderOpen}
        onClose={() => setOrderOpen(false)}
        maxWidth="xs"
        fullWidth
        scroll="body"
      >
        {done ? (
          <DialogContent sx={{ textAlign: 'center', py: 5 }}>
            <Box sx={{ fontSize: 56 }} aria-hidden>
              🎉
            </Box>
            <Typography sx={{ fontFamily: font.brand, fontWeight: 700, fontSize: '1.6rem', mt: 1 }}>
              Merci {form.clientName.split(' ')[0]} !
            </Typography>
            <Typography sx={{ color: color.inkSoft, mt: 1 }}>
              Votre commande{done.orderNumber ? ` n° ${done.orderNumber}` : ''} est envoyée. Mariem
              vous rappelle au {form.clientPhone} pour la confirmer.
            </Typography>
            <Button variant="contained" sx={{ mt: 3 }} onClick={() => setOrderOpen(false)}>
              Fermer
            </Button>
          </DialogContent>
        ) : (
          <>
            <DialogTitle>Commander {item.name}</DialogTitle>
            <DialogContent>
              <Typography variant="body2" sx={{ color: color.inkSoft, mb: 2 }}>
                {variant.sizeName} · {variantFacts(variant).join(' · ')}
              </Typography>
              <TextField
                fullWidth
                label="Votre nom"
                required
                autoComplete="name"
                sx={{ mb: 2 }}
                value={form.clientName}
                onChange={(e) => setForm({ ...form, clientName: e.target.value })}
              />
              <TextField
                fullWidth
                label="Votre téléphone"
                required
                autoComplete="tel"
                inputProps={{ inputMode: 'tel' }}
                placeholder="+216 XX XXX XXX"
                sx={{ mb: 2 }}
                value={form.clientPhone}
                onChange={(e) => setForm({ ...form, clientPhone: e.target.value })}
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Typography sx={{ flex: 1, fontWeight: 600 }}>Quantité</Typography>
                <IconButton
                  aria-label="Diminuer la quantité"
                  disabled={form.quantity <= 1}
                  onClick={() => setForm({ ...form, quantity: form.quantity - 1 })}
                  sx={{ border: `1px solid ${color.borderStrong}` }}
                >
                  <Remove />
                </IconButton>
                <Typography
                  sx={{ minWidth: 28, textAlign: 'center', fontWeight: 700, fontSize: '1.1rem' }}
                >
                  {form.quantity}
                </Typography>
                <IconButton
                  aria-label="Augmenter la quantité"
                  onClick={() => setForm({ ...form, quantity: form.quantity + 1 })}
                  sx={{ border: `1px solid ${color.borderStrong}` }}
                >
                  <Add />
                </IconButton>
              </Box>
              {form.requestedDate && (
                <Box
                  sx={{ p: 1.5, mb: 2, borderRadius: `${radius.md}px`, bgcolor: color.primarySoft }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    📅{' '}
                    {new Date(form.requestedDate).toLocaleString('fr-TN', {
                      weekday: 'long',
                      day: '2-digit',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Typography>
                </Box>
              )}
              <TextField
                fullWidth
                label="Message (optionnel)"
                multiline
                rows={2}
                placeholder="Inscription sur le gâteau, allergies…"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
              {total !== null && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                    }}
                  >
                    <Typography sx={{ fontWeight: 700 }}>Total</Typography>
                    <Typography
                      sx={{ fontWeight: 800, fontSize: '1.4rem', color: color.primaryDark }}
                    >
                      {formatPrice(Math.round(total * 100) / 100)}
                    </Typography>
                  </Box>
                </>
              )}
              <Typography variant="caption" sx={{ color: color.inkSoft }}>
                Paiement en espèces à la récupération.
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOrderOpen(false)}>Annuler</Button>
              <Button
                variant="contained"
                onClick={sendOrder}
                disabled={sending || !form.clientName.trim() || !form.clientPhone.trim()}
              >
                {sending ? 'Envoi…' : 'Envoyer la commande'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default RecipeDetailPage;
