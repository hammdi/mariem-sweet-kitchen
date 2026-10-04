// Types des donnees admin (clients, sources d'achat, prix, stock prevu)

export type ClientType = 'individual' | 'cafe';

export interface Client {
  _id: string;
  type: ClientType;
  name: string;
  phone: string;
  address?: string;
  contactPerson?: string;
  conditions?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PurchaseSourceType = 'supplier' | 'supermarket' | 'store' | 'kiosk' | 'other';

export interface PurchaseSource {
  _id: string;
  name: string;
  type: PurchaseSourceType;
  phone?: string;
  address?: string;
  city?: string;
  contact?: string;
  url?: string;
  openingHours?: string;
  delivers: boolean;
  notes?: string;
  isActive: boolean;
  ingredientCount?: number;
}

export interface PriceHistoryEntry {
  price: number;
  unit: string;
  checkedAt: string;
  note?: string;
  recordedAt: string;
}

export interface IngredientOffer {
  _id: string;
  ingredientId: string;
  sourceId: PurchaseSource;
  price: number;
  unit: string;
  lastCheckedAt: string;
  notes?: string;
  isActive: boolean;
  history: PriceHistoryEntry[];
}

export interface PriceSummary {
  unit: string;
  activeCount: number;
  comparableCount: number;
  average: number | null;
  best: { price: number; offerId: string | null; sourceName: string | null } | null;
  incomparableCount: number;
}

export interface StockNeed {
  ingredientId: string;
  name: string;
  unit: string;
  stock: number;
  needed: number;
  remaining: number;
  missing: number;
  minStock: number | null;
  status: 'ok' | 'low' | 'missing';
  unitMismatch: boolean;
  pricePerUnit: number;
}

export interface QuoteLine {
  label: string;
  sizeName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Quote {
  lines: (QuoteLine | null)[];
  itemsTotal: number;
  feesTotal: number;
  total: number;
  stockNeeds: StockNeed[];
}

// Besoins d'achat lies aux commandes
export interface OrderNeedDetail {
  needId: string;
  orderId: string;
  orderRef: string;
  clientName: string;
  neededBy: string | null;
  neededQty: number;
  availableQty: number;
  missingQty: number;
  status: string;
}

export interface OrderStockState {
  orderRef: string;
  neededBy: string | null;
  active: boolean;
  stockDeducted: boolean;
  stockNeeds: StockNeed[];
  canStartPreparation: boolean;
  /** stock réel suffisant mais attribué à des commandes plus proches */
  usesReservedStock?: boolean;
  preparationBlockedReason: string | null;
  purchaseNeeds: {
    ingredientId: string;
    ingredientName: string;
    missingQty: number;
    maxMissingQty: number;
    status: 'open' | 'covered' | 'fulfilled' | 'cancelled';
    unit: string;
  }[];
}

export interface ActionRequiredOrder {
  orderId: string;
  orderRef: string;
  clientName: string;
  status: string;
  date: string | null;
  hoursLeft: number | null;
  urgency: 'overdue' | 'urgent' | 'upcoming' | 'no_date';
  items: { recipeName: string; sizeName: string; quantity: number }[];
  missing: {
    ingredientId: string;
    name: string;
    unit: string;
    needed: number;
    available: number;
    missing: number;
    purchaseStatus: string;
  }[];
  unitProblems: string[];
}

// Ventes / caisse
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'check' | 'other';

export interface Sale {
  _id: string;
  orderNumber?: number;
  orderRef: string;
  date: string;
  createdAt: string;
  clientName: string;
  clientType: 'individual' | 'cafe';
  status: string;
  totalPrice: number;
  amountPaid: number;
  remaining: number;
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  paymentMethod: PaymentMethod | null;
  items: { recipeName: string; sizeName: string; quantity: number }[];
}

export interface CashMovementRow {
  _id: string;
  type:
    | 'order_payment'
    | 'order_refund'
    | 'other_income'
    | 'purchase'
    | 'expense'
    | 'opening_balance';
  direction: 'in' | 'out';
  amount: number;
  method: PaymentMethod;
  description: string;
  occurredAt: string;
  orderId?: string;
  orderNumber?: number;
  sourceName?: string;
  createdBy: { email: string };
  reversalOf?: string;
  reversedBy?: string;
  replacementOf?: string;
  correctionReason?: string;
  stockItems?: { ingredientId: string; name: string; quantity: number; unit: string }[];
  unblockedOrders?: { orderId: string; orderNumber?: number; clientName: string; fully: boolean }[];
}

export interface CashSummary {
  openingBalance: number;
  totalIn: number;
  totalOut: number;
  theoreticalBalance: number;
  outstanding?: number; // commandes vendues pas encore payees (hors caisse)
}

// Achat de stock (StockHistory "restock" regroupes par achat)
export interface PurchaseRecord {
  purchaseId: string;
  date: string;
  sourceName: string;
  paymentMethod: 'cash_register' | 'personal' | 'bank' | 'other' | 'unknown';
  cashOut: number;
  total: number;
  createdBy: string;
  note: string;
  unblockedOrders: { orderId: string; orderNumber?: number; clientName: string; fully: boolean }[];
  items: {
    ingredientId: string;
    name: string;
    quantity: number;
    unit: string;
    unitPrice: number | null;
    total: number | null;
  }[];
}
