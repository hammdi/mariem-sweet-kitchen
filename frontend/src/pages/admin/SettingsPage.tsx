import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api';
import {
  Box,
  Button,
  Card,
  TextField,
  Switch,
  FormControlLabel,
  MenuItem,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import {
  Save,
  Settings,
  Calculate,
  Category,
  Storefront,
  Palette,
  NotificationsActive,
  ChevronRight,
  Visibility,
  Home,
  Place,
} from '@mui/icons-material';
import MapView from '../../components/map/MapView';
import LocationPickerDialog from '../../components/map/LocationPickerDialog';
import { costPerKm, LatLng } from '../../utils/geo';
import { PageHeader, SoftIcon } from '../../components/ui';
import { CategoriesContent } from './CategoriesPage';
import { useThemeMode } from '../../theme/ThemeModeContext';
import { color } from '../../theme/tokens';

const TABS = ['calcul', 'categories', 'commerce', 'apparence'] as const;
type TabId = (typeof TABS)[number];

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card sx={{ p: { xs: 2, md: 2.5 }, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <SoftIcon tone="primary" size={38}>
          {icon}
        </SoftIcon>
        <Box>
          <Typography variant="h6" sx={{ fontSize: '1rem' }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" sx={{ color: color.inkSoft }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>
      {children}
    </Card>
  );
}

const grid = {
  display: 'grid',
  gap: 2.5,
  gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0,1fr))' },
} as const;

/**
 * Paramètres : calcul des prix et alertes (enregistrés sur le serveur),
 * catégories, informations du commerce, apparence. Organisé en sections.
 */
const SettingsPage = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab: TabId = (TABS as readonly string[]).includes(params.get('tab') || '')
    ? (params.get('tab') as TabId)
    : 'calcul';
  const { mode, toggle } = useThemeMode();

  const [pricing, setPricing] = useState({
    stegTariff: 0.235,
    waterForfaitSmall: 0.3,
    waterForfaitLarge: 0.5,
    marginPercent: 15,
    actionAlertHours: 24,
    orderMinLeadHours: 24,
    catalogShowPrices: 1, // 1 : prix visibles dans le catalogue client
    fuelConsumption: 0, // voiture : L/100 km
    fuelPrice: 0, // DT le litre
  });
  // Domicile (carte) : enregistré dès qu'il est placé
  const [home, setHome] = useState<LatLng | null>(null);
  const [homeOpen, setHomeOpen] = useState(false);
  // Informations du commerce : enregistrées sur cet appareil
  const [prefs, setPrefs] = useState({
    whatsappNumber: `+${import.meta.env.VITE_WHATSAPP_NUMBER || '21612345678'}`,
    businessName: "Mariem's Sweet Kitchen",
    businessPhone: `+${import.meta.env.VITE_WHATSAPP_NUMBER || '21612345678'}`,
    businessAddress: '',
    currency: 'DT',
  });

  useEffect(() => {
    api
      .get('/settings')
      .then((res) => {
        const obj: Record<string, number> = {};
        (res.data.data?.settings || []).forEach((s: any) => (obj[s.key] = s.value));
        if (typeof obj.homeLat === 'number' && typeof obj.homeLng === 'number') {
          setHome({ lat: obj.homeLat, lng: obj.homeLng });
        }
        // seulement les réglages connus de cette page (une ancienne clé ferait refuser l'enregistrement)
        setPricing((prev) => {
          const next = { ...prev };
          (Object.keys(prev) as (keyof typeof prev)[]).forEach((k) => {
            if (typeof obj[k] === 'number') next[k] = obj[k];
          });
          return next;
        });
      })
      .catch(() => undefined);
    try {
      const saved = localStorage.getItem('adminPrefs');
      if (saved) setPrefs((prev) => ({ ...prev, ...JSON.parse(saved) }));
    } catch {
      /* préférences locales illisibles : valeurs par défaut */
    }
  }, []);

  const handleSave = async () => {
    try {
      await api.put('/settings', pricing);
      localStorage.setItem('adminPrefs', JSON.stringify(prefs));
      toast.success('Paramètres enregistrés');
    } catch {
      /* toast intercepteur */
    }
  };

  const num = (key: keyof typeof pricing) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setPricing({ ...pricing, [key]: parseFloat(e.target.value) || 0 });

  return (
    <Box>
      <PageHeader
        title="Paramètres"
        subtitle="Calcul des prix, alertes, catégories et préférences."
        icon={<Settings />}
        tone="neutral"
        helpFlow="recipe"
        actions={
          tab === 'calcul' || tab === 'commerce' ? (
            <Button variant="contained" startIcon={<Save />} onClick={handleSave}>
              Enregistrer
            </Button>
          ) : undefined
        }
      />

      <Tabs
        value={tab}
        onChange={(_, v) => setParams({ tab: v }, { replace: true })}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{ mb: 2.5, borderBottom: `1px solid ${color.border}` }}
      >
        <Tab value="calcul" label="Calcul et alertes" />
        <Tab value="categories" label="Catégories" />
        <Tab value="commerce" label="Commerce" />
        <Tab value="apparence" label="Apparence" />
      </Tabs>

      {tab === 'calcul' && (
        <>
          <Section
            icon={<Calculate />}
            title="Calcul des prix"
            subtitle="Utilisé pour le prix de chaque recette (les commandes existantes gardent leur prix figé)."
          >
            <Box sx={grid}>
              <TextField
                fullWidth
                label="Tarif STEG (DT/kWh)"
                type="number"
                helperText="Prix moyen de l’électricité"
                value={pricing.stegTariff}
                onChange={num('stegTariff')}
                inputProps={{ step: 0.001 }}
              />
              <TextField
                fullWidth
                label="Marge (%)"
                type="number"
                helperText="Pourcentage ajouté au total"
                value={pricing.marginPercent}
                onChange={num('marginPercent')}
              />
              <TextField
                fullWidth
                label="Forfait eau — petit (DT)"
                type="number"
                helperText="Recettes de 8 portions ou moins"
                value={pricing.waterForfaitSmall}
                onChange={num('waterForfaitSmall')}
                inputProps={{ step: 0.1 }}
              />
              <TextField
                fullWidth
                label="Forfait eau — grand (DT)"
                type="number"
                helperText="Recettes de plus de 8 portions"
                value={pricing.waterForfaitLarge}
                onChange={num('waterForfaitLarge')}
                inputProps={{ step: 0.1 }}
              />
            </Box>
          </Section>
          <Section
            icon={<NotificationsActive />}
            title="Commandes et alertes"
            subtitle="Seuils utilisés par la liste de courses et les commandes urgentes."
          >
            <Box sx={grid}>
              <TextField
                fullWidth
                label="Alerte ingrédients manquants (heures)"
                type="number"
                helperText="Une commande prévue dans moins de X heures sans tous ses ingrédients est « urgente »"
                value={pricing.actionAlertHours}
                onChange={num('actionAlertHours')}
                inputProps={{ min: 0, step: 1 }}
              />
              <TextField
                fullWidth
                label="Délai minimum de commande (heures)"
                type="number"
                helperText="Pour les commandes passées depuis le site"
                value={pricing.orderMinLeadHours}
                onChange={num('orderMinLeadHours')}
                inputProps={{ min: 0, step: 1 }}
              />
            </Box>
          </Section>
        </>
      )}

      {tab === 'categories' && <CategoriesContent />}

      {tab === 'commerce' && (
        <>
          <Section
            icon={<Home />}
            title="Domicile et voiture"
            subtitle="Pour estimer la distance et le coût du trajet vers chaque source d’achat (carte des sources, calcul du transport d’une commande)."
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) minmax(0, 1fr)' },
                gap: 2,
                alignItems: 'start',
              }}
            >
              <Box>
                {home ? (
                  <MapView
                    height={200}
                    center={home}
                    markers={[{ id: 'home', position: home, kind: 'home', label: 'Domicile' }]}
                  />
                ) : (
                  <Box
                    sx={{
                      height: 200,
                      borderRadius: 3,
                      border: `1px dashed ${color.borderStrong}`,
                      display: 'grid',
                      placeItems: 'center',
                      textAlign: 'center',
                      color: color.inkSoft,
                      p: 2,
                    }}
                  >
                    🏠 Domicile pas encore placé sur la carte
                  </Box>
                )}
                <Button sx={{ mt: 1 }} startIcon={<Place />} onClick={() => setHomeOpen(true)}>
                  {home ? 'Modifier la position du domicile' : 'Placer mon domicile'}
                </Button>
              </Box>
              <Box sx={{ display: 'grid', gap: 2 }}>
                <TextField
                  fullWidth
                  label="Consommation de la voiture (L/100 km)"
                  type="number"
                  value={pricing.fuelConsumption || ''}
                  onChange={num('fuelConsumption')}
                  inputProps={{ min: 0, step: 0.1 }}
                  helperText="Souvent entre 5 et 9 pour une petite voiture"
                />
                <TextField
                  fullWidth
                  label="Prix du litre d’essence (DT)"
                  type="number"
                  value={pricing.fuelPrice || ''}
                  onChange={num('fuelPrice')}
                  inputProps={{ min: 0, step: 0.001 }}
                />
                <Typography variant="body2" sx={{ color: color.inkSoft }}>
                  {costPerKm(pricing.fuelConsumption, pricing.fuelPrice) > 0
                    ? `≈ ${costPerKm(pricing.fuelConsumption, pricing.fuelPrice).toFixed(3)} DT par km · 10 km aller-retour ≈ ${(costPerKm(pricing.fuelConsumption, pricing.fuelPrice) * 10).toFixed(2)} DT`
                    : 'Renseignez les deux valeurs pour calculer le coût au km.'}
                </Typography>
              </Box>
            </Box>
          </Section>
          <LocationPickerDialog
            open={homeOpen}
            title="Position du domicile"
            initial={home}
            onClose={() => setHomeOpen(false)}
            onSave={async (p) => {
              if (!p) {
                setHomeOpen(false);
                return;
              }
              try {
                await api.put('/settings', { homeLat: p.lat, homeLng: p.lng });
                setHome(p);
                setHomeOpen(false);
                toast.success('Domicile placé sur la carte');
              } catch {
                /* toast intercepteur */
              }
            }}
          />
          <Section
            icon={<Visibility />}
            title="Catalogue client"
            subtitle="Ce que voient vos clients : photos, description, conseils et tailles. Jamais les ingrédients ni le détail du calcul."
          >
            <FormControlLabel
              control={
                <Switch
                  checked={pricing.catalogShowPrices !== 0}
                  onChange={(e) =>
                    setPricing({ ...pricing, catalogShowPrices: e.target.checked ? 1 : 0 })
                  }
                />
              }
              label={
                pricing.catalogShowPrices !== 0
                  ? 'Prix affichés dans le catalogue'
                  : 'Prix masqués (« Prix sur demande »)'
              }
            />
            <Box sx={{ mt: 1 }}>
              <Button size="small" href="/recipes" target="_blank" rel="noopener">
                Voir le catalogue client
              </Button>
            </Box>
          </Section>
          <Section
            icon={<Storefront />}
            title="Informations du commerce"
            subtitle="Enregistrées sur cet appareil."
          >
            <Box sx={grid}>
              <TextField
                fullWidth
                label="Nom du commerce"
                value={prefs.businessName}
                onChange={(e) => setPrefs({ ...prefs, businessName: e.target.value })}
              />
              <TextField
                fullWidth
                label="Téléphone"
                value={prefs.businessPhone}
                onChange={(e) => setPrefs({ ...prefs, businessPhone: e.target.value })}
              />
              <TextField
                fullWidth
                label="Numéro WhatsApp"
                value={prefs.whatsappNumber}
                onChange={(e) => setPrefs({ ...prefs, whatsappNumber: e.target.value })}
              />
              <TextField
                fullWidth
                label="Devise"
                value={prefs.currency}
                onChange={(e) => setPrefs({ ...prefs, currency: e.target.value })}
              />
              <TextField
                fullWidth
                label="Adresse"
                value={prefs.businessAddress}
                onChange={(e) => setPrefs({ ...prefs, businessAddress: e.target.value })}
                placeholder="Adresse de retrait des commandes"
                sx={{ gridColumn: '1 / -1' }}
              />
            </Box>
          </Section>
          <Card
            sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }}
            onClick={() => navigate('/admin/sources')}
          >
            <SoftIcon tone="info" size={38}>
              <Storefront />
            </SoftIcon>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 700 }}>Sources d’achat</Typography>
              <Typography variant="caption" sx={{ color: color.inkSoft }}>
                Fournisseurs, magasins et prix par ingrédient
              </Typography>
            </Box>
            <ChevronRight />
          </Card>
        </>
      )}

      {tab === 'apparence' && (
        <Section icon={<Palette />} title="Apparence" subtitle="Préférences de cet appareil.">
          <Box sx={grid}>
            <FormControlLabel
              control={<Switch checked={mode === 'dark'} onChange={toggle} />}
              label="Thème sombre"
            />
            <TextField
              select
              fullWidth
              label="Langue"
              value="fr"
              helperText="Autres langues bientôt disponibles"
            >
              <MenuItem value="fr">Français</MenuItem>
              <MenuItem value="ar" disabled>
                العربية (bientôt)
              </MenuItem>
            </TextField>
          </Box>
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1, color: color.inkSoft }}>
            <Category fontSize="small" />
            <Typography variant="body2">
              « Moins d’animations » se règle dans l’aide ✨ (et suit le réglage de votre appareil).
            </Typography>
          </Box>
        </Section>
      )}
    </Box>
  );
};

export default SettingsPage;
