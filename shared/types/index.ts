// Types partagés entre frontend, backend et admin

export interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: 'user' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}

export interface Ingredient {
  _id: string;
  name: string;
  pricePerUnit: number;
  unit: string;
  category: 'base' | 'sweetener' | 'dairy' | 'flavoring' | 'leavening' | 'other';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecipeIngredient {
  ingredientId: string | Ingredient;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export interface Recipe {
  _id: string;
  name: string;
  description: string;
  image?: string;
  images: string[];
  ingredients: RecipeIngredient[];
  appliances: string[];
  prepTime: number; // en minutes
  servings: number;
  category: string;
  basePrice: number;
  sizes: ('petit' | 'grand')[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  recipeId: string | Recipe;
  size: 'petit' | 'grand';
  quantity: number;
  mode: 'full' | 'preparation' | 'ingredients';
  unitPrice: number;
  totalPrice: number;
}

export interface Order {
  _id: string;
  userId: string | User;
  items: OrderItem[];
  totalPrice: number;
  status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  deliveryMode: 'pickup' | 'delivery';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Appliance {
  _id: string;
  name: string;
  powerConsumption: number; // en Watts
  unit: string;
  category: 'cooking' | 'mixing' | 'cooling' | 'other';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PriceCalculation {
  ingredientsCost: number;
  waterCost: number;
  electricityCost: number;
  margin: number;
  totalCost: number;
  breakdown: {
    ingredient: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
}

export interface CartItem {
  recipeId: string;
  recipe: Recipe;
  size: 'petit' | 'grand';
  quantity: number;
  mode: 'full' | 'preparation' | 'ingredients';
  unitPrice: number;
  totalPrice: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Types pour les formulaires
export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  phone: string;
}

export interface RecipeForm {
  name: string;
  description: string;
  images: File[];
  ingredients: RecipeIngredient[];
  appliances: string[];
  prepTime: number;
  sizes: ('petit' | 'grand')[];
}

export interface OrderForm {
  items: CartItem[];
  deliveryMode: 'pickup' | 'delivery';
  notes?: string;
}

// Types pour les filtres et recherche
export interface RecipeFilters {
  category?: string;
  maxPrice?: number;
  minPrepTime?: number;
  maxPrepTime?: number;
  sizes?: ('petit' | 'grand')[];
  search?: string;
}

export interface OrderFilters {
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  userId?: string;
}

// Types pour les statistiques
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

// Types pour les notifications
export interface Notification {
  _id: string;
  userId: string;
  type: 'order_created' | 'order_ready' | 'order_cancelled' | 'price_updated';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

// Types pour les erreurs
export interface ValidationError {
  field: string;
  message: string;
}

export interface ApiError {
  success: false;
  message: string;
  errors?: ValidationError[];
  code?: string;
}
