// Types partagés entre frontend et backend — synchronisés avec les modèles Mongoose

// ============ Enums & constantes ============

export const INGREDIENT_UNITS = ['kg', 'g', 'l', 'ml', 'piece', 'cuillere', 'tasse'] as const;
export type IngredientUnit = typeof INGREDIENT_UNITS[number];

export const INGREDIENT_CATEGORIES = ['base', 'sweetener', 'dairy', 'flavoring', 'leavening', 'other'] as const;
export type IngredientCategory = typeof INGREDIENT_CATEGORIES[number];

export const APPLIANCE_UNITS = ['W', 'kW'] as const;
export type ApplianceUnit = typeof APPLIANCE_UNITS[number];

export const APPLIANCE_CATEGORIES = ['cooking', 'mixing', 'cooling', 'other'] as const;
export type ApplianceCategory = typeof APPLIANCE_CATEGORIES[number];

export const ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'paid', 'cancelled'] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];

export const SETTINGS_KEYS = ['stegTariff', 'waterForfaitSmall', 'waterForfaitLarge', 'marginPercent'] as const;
export type SettingKey = typeof SETTINGS_KEYS[number];

// ============ User ============

export interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: 'admin';
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

// ============ Ingredient ============

export interface Ingredient {
  _id: string;
  name: string;
  pricePerUnit: number;
  unit: IngredientUnit;
  category: IngredientCategory;
  stockQuantity: number;
  isActive: boolean;
  description?: string;
  supplier?: string;
  lastPriceUpdate?: string;
  createdAt: string;
  updatedAt: string;
}

// ============ Appliance ============

export interface Appliance {
  _id: string;
  name: string;
  powerConsumption: number; // en Watts ou kW selon unit
  unit: ApplianceUnit;
  category: ApplianceCategory;
  isActive: boolean;
  description?: string;
  brand?: string;
  applianceModel?: string;
  createdAt: string;
  updatedAt: string;
}

// ============ Recipe ============

export interface VariantIngredient {
  ingredientId: string | Ingredient;
  quantity: number;
  unit: IngredientUnit;
}

export interface VariantAppliance {
  applianceId: string | Appliance;
  duration: number; // en minutes
}

export interface RecipeVariant {
  sizeName: string;
  portions: number;
  ingredients: VariantIngredient[];
  appliances: VariantAppliance[];
}

export interface Recipe {
  _id: string;
  name: string;
  description: string;
  images: string[];
  categories: string[];
  isActive: boolean;
  variants: RecipeVariant[];
  createdAt: string;
  updatedAt: string;
}

// ============ Order ============

export interface PriceBreakdown {
  ingredientsCost: number;
  electricityCost: number;
  waterCost: number;
  margin: number;
  total: number;
}

export interface OrderItem {
  recipeId: string | Recipe;
  variantIndex: number;
  quantity: number;
  clientOfferedIngredients: string[];
  clientProvidedIngredients: string[];
  calculatedPrice: PriceBreakdown;
}

export interface Order {
  _id: string;
  clientName: string;
  clientPhone: string;
  items: OrderItem[];
  totalPrice: number;
  status: OrderStatus;
  ingredientsReady: boolean;
  requestedDate: string | null;   // date/heure souhaitée par le client
  confirmedDate: string | null;   // date/heure confirmée par Mariem
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// ============ Settings ============

export interface Setting {
  _id: string;
  key: SettingKey;
  value: number;
  label: string;
  updatedAt: string;
}

// ============ Stock History ============

export interface StockHistoryEntry {
  _id: string;
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  orderId: string;
  clientName: string;
  recipeName: string;
  type: 'deduction' | 'restock';
  createdAt: string;
}

// ============ Price Calculation ============

export interface PriceCalculationResult {
  ingredientsCost: number;
  electricityCost: number;
  waterCost: number;
  margin: number;
  total: number;
  ingredientsDetail: {
    name: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    cost: number;
    providedByClient: boolean;
  }[];
  appliancesDetail: {
    name: string;
    duration: number;
    powerW: number;
    cost: number;
  }[];
}

// ============ API ============

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    totalPages: number;
  };
}

// ============ Formulaires ============

export interface LoginForm {
  email: string;
  password: string;
}

export interface OrderForm {
  clientName: string;
  clientPhone: string;
  requestedDate?: string;  // ISO date string — quand le client veut son produit
  items: {
    recipeId: string;
    variantIndex: number;
    quantity: number;
    clientOfferedIngredients?: string[];
  }[];
  notes?: string;
}

// ============ Filtres ============

export interface RecipeFilters {
  category?: string;
  search?: string;
  isActive?: boolean;
}

export interface OrderFilters {
  status?: OrderStatus;
  page?: number;
  limit?: number;
}

// ============ Dashboard ============

export interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  popularRecipes: {
    recipe: Recipe;
    orderCount: number;
  }[];
  recentOrders: Order[];
}

// ============ Erreurs ============

export interface ValidationError {
  field: string;
  message: string;
}

export interface ApiError {
  success: false;
  message: string;
  errors?: ValidationError[];
}
