import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Box,
  useTheme,
  useMediaQuery,
  Drawer,
  List,
  ListItem,
  ListItemText,
} from '@mui/material'
import {
  Menu as MenuIcon,
  Home,
  Cake,
} from '@mui/icons-material'

const Header = () => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navigationItems = [
    { label: 'Accueil', path: '/', icon: <Home /> },
    { label: 'Recettes', path: '/recipes', icon: <Cake /> },
  ]

  return (
    <>
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'white', color: 'text.primary' }}>
        <Toolbar>
          {/* Logo */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <Cake sx={{ color: 'primary.main', fontSize: 32 }} />
            <Typography
              variant="h6"
              component="div"
              sx={{
                fontFamily: 'Playfair Display',
                fontWeight: 600,
                color: 'primary.main',
                display: { xs: 'none', sm: 'block' }
              }}
            >
              Mariem's Sweet Kitchen
            </Typography>
          </Link>

          <Box sx={{ flexGrow: 1 }} />

          {/* Desktop Navigation */}
          {!isMobile && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {navigationItems.map((item) => (
                <Button
                  key={item.path}
                  component={Link}
                  to={item.path}
                  startIcon={item.icon}
                  sx={{ color: 'text.primary' }}
                >
                  {item.label}
                </Button>
              ))}
            </Box>
          )}

          <Box sx={{ flexGrow: 1 }} />

          {/* WhatsApp contact */}
          <Button
            variant="outlined"
            size="small"
            href="https://wa.me/21612345678"
            target="_blank"
            sx={{ mr: 1, fontSize: { xs: '0.7rem', sm: '0.875rem' } }}
          >
            Contacter Mariem
          </Button>

          {/* Mobile Menu */}
          {isMobile && (
            <IconButton
              color="inherit"
              onClick={() => setMobileMenuOpen(true)}
              sx={{ ml: 1 }}
            >
              <MenuIcon />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        anchor="right"
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      >
        <Box sx={{ width: 250, pt: 2 }}>
          <List>
            {navigationItems.map((item) => (
              <ListItem
                key={item.path}
                component={Link}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                sx={{ cursor: 'pointer' }}
              >
                <ListItemText primary={item.label} />
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
    </>
  )
}

export default Header
