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
  TextField,
  IconButton,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { ArrowBack, Save } from '@mui/icons-material';

const SettingsPage = () => {
  const navigate = useNavigate();

  // Prix
  const [pricing, setPricing] = useState({
    stegTariff: 0.235,
    waterForfaitSmall: 0.3,
    waterForfaitLarge: 0.5,
    marginPercent: 15,
  });

  // Preferences (stockees en localStorage pour l'instant)
  const [prefs, setPrefs] = useState({
    darkMode: false,
    language: 'fr',
    whatsappNumber: `+${import.meta.env.VITE_WHATSAPP_NUMBER || '21612345678'}`,
    businessName: "Mariem's Sweet Kitchen",
    businessPhone: `+${import.meta.env.VITE_WHATSAPP_NUMBER || '21612345678'}`,
    businessAddress: '',
    currency: 'DT',
    telegramEnabled: false,
    telegramChatId: '',
  });

  useEffect(() => {
    // Charger pricing depuis le backend
    const loadPricing = async () => {
      try {
        const res = await api.get('/settings');
        const data = res.data.data?.settings || [];
        const obj: Record<string, number> = {};
        data.forEach((s: any) => {
          obj[s.key] = s.value;
        });
        if (Object.keys(obj).length > 0) setPricing((prev) => ({ ...prev, ...obj }));
      } catch {
        /* ignore */
      }
    };
    loadPricing();

    // Charger prefs depuis localStorage
    const saved = localStorage.getItem('adminPrefs');
    if (saved) {
      try {
        setPrefs((prev) => ({ ...prev, ...JSON.parse(saved) }));
      } catch {
        /* ignore */
      }
    }
  }, []);

  const handleSave = async () => {
    try {
      // Sauvegarder pricing dans le backend
      await api.put('/settings', pricing);
      localStorage.setItem('adminPrefs', JSON.stringify(prefs));
      toast.success('Parametres enregistres');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#fafafa' }}>
      <Box sx={{ bgcolor: 'white', borderBottom: '1px solid #eee', py: 2, px: 3 }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconButton onClick={() => navigate('/admin')}>
                <ArrowBack />
              </IconButton>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                Parametres
              </Typography>
            </Box>
            <Button variant="contained" startIcon={<Save />} onClick={handleSave}>
              Enregistrer
            </Button>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ py: 3 }}>
        {/* Calcul des prix */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              Calcul des prix
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Tarif STEG (DT/kWh)"
                  type="number"
                  helperText="Prix moyen electricite Tunisie"
                  value={pricing.stegTariff}
                  onChange={(e) =>
                    setPricing({ ...pricing, stegTariff: parseFloat(e.target.value) || 0 })
                  }
                  inputProps={{ step: 0.001 }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Marge effort (%)"
                  type="number"
                  helperText="Pourcentage ajoute au total"
                  value={pricing.marginPercent}
                  onChange={(e) =>
                    setPricing({ ...pricing, marginPercent: parseFloat(e.target.value) || 0 })
                  }
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Forfait eau - Petit (DT)"
                  type="number"
                  helperText="Pour les recettes <= 8 portions"
                  value={pricing.waterForfaitSmall}
                  onChange={(e) =>
                    setPricing({ ...pricing, waterForfaitSmall: parseFloat(e.target.value) || 0 })
                  }
                  inputProps={{ step: 0.1 }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Forfait eau - Grand (DT)"
                  type="number"
                  helperText="Pour les recettes > 8 portions"
                  value={pricing.waterForfaitLarge}
                  onChange={(e) =>
                    setPricing({ ...pricing, waterForfaitLarge: parseFloat(e.target.value) || 0 })
                  }
                  inputProps={{ step: 0.1 }}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Informations business */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              Informations du commerce
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Nom du commerce"
                  value={prefs.businessName}
                  onChange={(e) => setPrefs({ ...prefs, businessName: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Telephone"
                  value={prefs.businessPhone}
                  onChange={(e) => setPrefs({ ...prefs, businessPhone: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Numero WhatsApp"
                  value={prefs.whatsappNumber}
                  helperText="Affiche sur le site pour les clients"
                  onChange={(e) => setPrefs({ ...prefs, whatsappNumber: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Devise"
                  value={prefs.currency}
                  onChange={(e) => setPrefs({ ...prefs, currency: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Adresse"
                  value={prefs.businessAddress}
                  onChange={(e) => setPrefs({ ...prefs, businessAddress: e.target.value })}
                  placeholder="Adresse pour la recuperation des commandes"
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              Notifications
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={prefs.telegramEnabled}
                      onChange={(e) => setPrefs({ ...prefs, telegramEnabled: e.target.checked })}
                    />
                  }
                  label="Activer les notifications Telegram"
                />
              </Grid>
              {prefs.telegramEnabled && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Telegram Chat ID"
                    value={prefs.telegramChatId}
                    onChange={(e) => setPrefs({ ...prefs, telegramChatId: e.target.value })}
                    helperText="ID du chat pour recevoir les commandes"
                  />
                </Grid>
              )}
            </Grid>
          </CardContent>
        </Card>

        {/* Preferences interface */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              Preferences d'interface
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Langue</InputLabel>
                  <Select
                    value={prefs.language}
                    label="Langue"
                    onChange={(e) => setPrefs({ ...prefs, language: e.target.value })}
                  >
                    <MenuItem value="fr">Francais</MenuItem>
                    <MenuItem value="ar">Arabe (bientot)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={prefs.darkMode}
                      onChange={(e) => setPrefs({ ...prefs, darkMode: e.target.checked })}
                    />
                  }
                  label="Mode sombre (bientot)"
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default SettingsPage;
