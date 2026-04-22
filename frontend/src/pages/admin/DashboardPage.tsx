import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Button,
  IconButton,
  Badge,
} from '@mui/material';
import {
  Cake,
  ShoppingBag,
  Kitchen,
  Logout,
  Category,
  Language,
  Settings as SettingsIcon,
  Inventory,
  CalendarMonth,
  ShoppingCart,
} from '@mui/icons-material';

const DashboardPage = () => {
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const fetchPendingOrders = async () => {
      try {
        const res = await api.get('/orders?status=pending');
        const orders = res.data.data?.orders || [];
        setPendingCount(orders.length);
      } catch {
        /* ignore */
      }
    };
    fetchPendingOrders();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  const menuItems = [
    {
      title: 'Recettes',
      description: 'Ajouter, modifier, dupliquer vos recettes',
      icon: <Cake sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/admin/recipes',
    },
    {
      title: 'Commandes',
      description: 'Voir et gerer les commandes clients',
      icon: (
        <Badge badgeContent={pendingCount} color="error" max={99}>
          <ShoppingBag sx={{ fontSize: 48, color: 'primary.main' }} />
        </Badge>
      ),
      path: '/admin/orders',
    },
    {
      title: 'Ingredients',
      description: 'Gerer les ingredients et leurs prix',
      icon: <Kitchen sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/admin/ingredients',
    },
    {
      title: 'Machines',
      description: 'Gerer vos appareils de cuisine',
      icon: <Kitchen sx={{ fontSize: 48, color: 'secondary.main' }} />,
      path: '/admin/appliances',
    },
    {
      title: 'Stock',
      description: 'Ce que vous avez a la maison',
      icon: <Inventory sx={{ fontSize: 48, color: '#2E7D32' }} />,
      path: '/admin/stock',
    },
    {
      title: 'Categories',
      description: 'Gerer les categories de recettes',
      icon: <Category sx={{ fontSize: 48, color: '#9C27B0' }} />,
      path: '/admin/categories',
    },
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#fafafa' }}>
      {/* Header */}
      <Box sx={{ bgcolor: 'white', borderBottom: '1px solid #eee', py: 2, px: 3 }}>
        <Container maxWidth="lg">
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', sm: 'center' },
              gap: 1,
            }}
          >
            <Typography
              variant="h5"
              sx={{
                fontFamily: 'Playfair Display',
                fontWeight: 600,
                color: 'primary.main',
                fontSize: { xs: '1.1rem', md: '1.5rem' },
              }}
            >
              Mariem's Sweet Kitchen — Admin
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <IconButton
                onClick={() => navigate('/')}
                title="Voir le site"
                sx={{ color: 'primary.main' }}
              >
                <Language />
              </IconButton>
              <IconButton
                onClick={() => navigate('/admin/settings')}
                title="Parametres"
                sx={{ color: 'text.secondary' }}
              >
                <SettingsIcon />
              </IconButton>
              <IconButton
                onClick={() => navigate('/admin/shopping-list')}
                title="Liste de courses"
                sx={{ color: 'text.secondary' }}
              >
                <ShoppingCart />
              </IconButton>
              <IconButton
                onClick={() => navigate('/admin/calendar')}
                title="Calendrier"
                sx={{ color: 'text.secondary' }}
              >
                <CalendarMonth />
              </IconButton>
              <Button startIcon={<Logout />} onClick={handleLogout} color="inherit">
                Deconnexion
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Content */}
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ mb: 1, fontWeight: 600 }}>
          Bonjour Mariem
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Que voulez-vous faire aujourd'hui ?
        </Typography>

        <Grid container spacing={3}>
          {menuItems.map((item) => (
            <Grid item xs={12} sm={6} md={4} key={item.title}>
              <Card
                sx={{
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  },
                }}
                onClick={() => navigate(item.path)}
              >
                <CardContent sx={{ textAlign: 'center', py: 4 }}>
                  <Box sx={{ mb: 2 }}>{item.icon}</Box>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                    {item.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {item.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};

export default DashboardPage;
