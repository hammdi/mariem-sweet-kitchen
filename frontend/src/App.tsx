import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Layout
import MainLayout from './components/layout/MainLayout';

// Pages
import HomePage from './pages/HomePage';
import RecipesPage from './pages/RecipesPage';
import RecipeDetailPage from './pages/RecipeDetailPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/admin/DashboardPage';
import AdminRecipesPage from './pages/admin/RecipesPage';
import RecipeFormPage from './pages/admin/RecipeFormPage';
import IngredientsPage from './pages/admin/IngredientsPage';
import AppliancesPage from './pages/admin/AppliancesPage';
import OrdersPage from './pages/admin/OrdersPage';
import OrderDetailPage from './pages/admin/OrderDetailPage';
import StockPage from './pages/admin/StockPage';
import SettingsPage from './pages/admin/SettingsPage';
import CalendarPage from './pages/admin/CalendarPage';
import ManualOrderPage from './pages/admin/ManualOrderPage';
import ShoppingListPage from './pages/admin/ShoppingListPage';
import ClientsPage from './pages/admin/ClientsPage';
import ClientDetailPage from './pages/admin/ClientDetailPage';
import PurchaseSourcesPage from './pages/admin/PurchaseSourcesPage';
import IngredientDetailPage from './pages/admin/IngredientDetailPage';
import CashPage from './pages/admin/CashPage';
import StatisticsPage from './pages/admin/StatisticsPage';
import NotFoundPage from './pages/NotFoundPage';
import ProtectedRoute from './components/common/ProtectedRoute';
import { theme } from './theme/theme';

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
          <Route path="ingredients/:id" element={<IngredientDetailPage />} />
          <Route path="appliances" element={<AppliancesPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/new" element={<ManualOrderPage />} />
          <Route path="orders/:id" element={<OrderDetailPage />} />
          <Route path="stock" element={<StockPage />} />
          {/* Catégories : gérées dans Paramètres */}
          <Route path="categories" element={<Navigate to="/admin/settings?tab=categories" replace />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="shopping-list" element={<ShoppingListPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="clients/:id" element={<ClientDetailPage />} />
          <Route path="sources" element={<PurchaseSourcesPage />} />
          {/* Ventes et caisse fusionnees : l'ancienne page Ventes ouvre la Caisse */}
          <Route path="sales" element={<Navigate to="/admin/cash?tab=receivables" replace />} />
          <Route path="cash" element={<CashPage />} />
          <Route path="statistics" element={<StatisticsPage />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ThemeProvider>
  );
}

export default App;
