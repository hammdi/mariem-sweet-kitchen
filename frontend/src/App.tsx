import { Routes, Route } from 'react-router-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'

// Layout
import MainLayout from './components/layout/MainLayout'

// Pages
import HomePage from './pages/HomePage'
import RecipesPage from './pages/RecipesPage'
import RecipeDetailPage from './pages/RecipeDetailPage'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/admin/DashboardPage'
import AdminRecipesPage from './pages/admin/RecipesPage'
import RecipeFormPage from './pages/admin/RecipeFormPage'
import IngredientsPage from './pages/admin/IngredientsPage'
import AppliancesPage from './pages/admin/AppliancesPage'
import OrdersPage from './pages/admin/OrdersPage'
import OrderDetailPage from './pages/admin/OrderDetailPage'
import StockPage from './pages/admin/StockPage'
import CategoriesPage from './pages/admin/CategoriesPage'
import SettingsPage from './pages/admin/SettingsPage'
import CalendarPage from './pages/admin/CalendarPage'
import ManualOrderPage from './pages/admin/ManualOrderPage'
import ShoppingListPage from './pages/admin/ShoppingListPage'
import NotFoundPage from './pages/NotFoundPage'
import ProtectedRoute from './components/common/ProtectedRoute'

// Theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#f1770a',
      light: '#f49332',
      dark: '#e25a05',
    },
    secondary: {
      main: '#0ea5e9',
      light: '#38bdf8',
      dark: '#0284c7',
    },
    background: {
      default: '#fafafa',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontFamily: '"Playfair Display", "Georgia", serif',
      fontWeight: 600,
    },
    h2: {
      fontFamily: '"Playfair Display", "Georgia", serif',
      fontWeight: 600,
    },
    h3: {
      fontFamily: '"Playfair Display", "Georgia", serif',
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          borderRadius: 8,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          borderRadius: 12,
        },
      },
    },
  },
})

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        {/* Pages publiques */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<HomePage />} />
          <Route path="recipes" element={<RecipesPage />} />
          <Route path="recipes/:id" element={<RecipeDetailPage />} />
        </Route>

        {/* Login admin */}
        <Route path="/auth/login" element={<LoginPage />} />

        {/* Admin — protégé par authentification */}
        <Route path="/admin" element={<ProtectedRoute />}>
          <Route index element={<DashboardPage />} />
          <Route path="recipes" element={<AdminRecipesPage />} />
          <Route path="recipes/new" element={<RecipeFormPage />} />
          <Route path="recipes/:id/edit" element={<RecipeFormPage />} />
          <Route path="ingredients" element={<IngredientsPage />} />
          <Route path="appliances" element={<AppliancesPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/new" element={<ManualOrderPage />} />
          <Route path="orders/:id" element={<OrderDetailPage />} />
          <Route path="stock" element={<StockPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="shopping-list" element={<ShoppingListPage />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ThemeProvider>
  )
}

export default App
