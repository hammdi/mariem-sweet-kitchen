import type { ClientType, PurchaseSourceType } from '../types/admin';

export const formatDT = (n: number | null | undefined, digits = 2): string =>
  n === null || n === undefined || isNaN(n) ? '—' : `${n.toFixed(digits)} DT`;

// Quantite lisible : 0.8000001 → "0.8"
export const formatQty = (n: number): string => String(parseFloat(n.toFixed(3)));

// +21622123456 → +216 22 123 456
export const formatPhone = (phone?: string): string => {
  if (!phone) return '';
  const m = phone.match(/^\+216(\d{2})(\d{3})(\d{3})$/);
  return m ? `+216 ${m[1]} ${m[2]} ${m[3]}` : phone;
};

export const formatDate = (d?: string | Date | null, withTime = false): string => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
};

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  individual: 'Particulier',
  cafe: 'Café',
};

export const SOURCE_TYPE_LABELS: Record<PurchaseSourceType, string> = {
  supplier: 'Fournisseur',
  supermarket: 'Grande surface',
  store: 'Magasin',
  kiosk: 'Kiosque',
  other: 'Autre',
};

// Avancement de la commande (le paiement est suivi à part : PAYMENT_STATUS_LABELS)
export const ORDER_STATUS_LABELS: Record<string, { label: string; color: any }> = {
  pending: { label: 'En attente', color: 'warning' },
  confirmed: { label: 'Confirmée', color: 'info' },
  paid: { label: 'Confirmée', color: 'info' }, // ancien statut « Payée »
  preparing: { label: 'En préparation', color: 'primary' },
  ready: { label: 'Prête', color: 'success' },
  delivered: { label: 'Remise', color: 'secondary' },
  cancelled: { label: 'Annulée', color: 'error' },
};

// Unites dans lesquelles on peut exprimer un prix pour un ingredient donne
export const compatibleUnits = (unit: string): string[] => {
  if (unit === 'kg' || unit === 'g') return ['kg', 'g'];
  if (unit === 'l' || unit === 'ml') return ['l', 'ml'];
  return [unit];
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Espèces',
  card: 'Carte',
  transfer: 'Virement',
  check: 'Chèque',
  other: 'Autre',
};

export const PAYMENT_STATUS_LABELS: Record<string, { label: string; color: any }> = {
  unpaid: { label: 'Non payée', color: 'warning' },
  partial: { label: 'Paiement partiel', color: 'info' },
  paid: { label: 'Payée', color: 'success' },
};

export const CASH_TYPE_LABELS: Record<string, string> = {
  order_payment: 'Paiement commande',
  order_refund: 'Remboursement',
  other_income: 'Autre entrée',
  purchase: 'Achat de stock',
  expense: 'Dépense',
  opening_balance: 'Fonds de caisse',
};

export const orderRef = (o: { _id: string; orderNumber?: number }) =>
  o.orderNumber ? `CMD-${o.orderNumber}` : `CMD-${o._id.slice(-5).toUpperCase()}`;

// Moyen de paiement d'un achat de stock : seul "Caisse" sort de la caisse physique
export const PURCHASE_PAYMENT_LABELS: Record<string, string> = {
  cash_register: '💵 Caisse',
  personal: '👤 Argent personnel',
  bank: '🏦 Banque',
  other: 'Autre',
  unknown: 'Non précisé',
};

// Correction manuelle du stock : raison obligatoire
export const STOCK_REASON_LABELS: Record<string, string> = {
  inventory: 'Inventaire',
  entry_error: 'Erreur de saisie',
  loss: 'Perte',
  breakage: 'Casse',
  correction: 'Correction',
  other: 'Autre',
};
