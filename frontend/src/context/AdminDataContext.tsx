import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../services/api';
import { periodRange } from '../utils/dateTime';

/**
 * Données partagées par l'ossature admin (barre du haut, menu, tableau de bord,
 * aide) : résumé du jour et utilisateur connecté. Rechargées en changeant de
 * page (au plus toutes les 15 s) ou à la demande après une action.
 */
export interface DashboardSummary {
  today: { revenue: number; collected: number; outflows: number };
  yesterday?: { revenue: number; orders: number };
  outstanding: number;
  cashBalance: number;
  recentMovements?: {
    _id: string;
    type: string;
    direction: 'in' | 'out';
    amount: number;
    description: string;
    occurredAt: string;
    orderNumber?: number;
    reversalOf?: string;
  }[];
  orders: {
    today: number;
    actionRequired: number;
    withMissingIngredients: number;
    pending?: number;
    confirmed?: number;
    preparing?: number;
    ready?: number;
    todayList?: {
      _id: string;
      orderRef: string;
      clientName: string;
      status: string;
      paymentStatus: string;
      totalPrice: number;
      amountPaid: number;
      date: string | null;
      items: string[];
      missingIngredients: boolean;
    }[];
  };
  stock: {
    lowStock: number;
    purchasesNeeded: number;
    purchasesEstimatedCost: number;
    lowStockItems?: { _id: string; name: string; unit: string; stockQuantity: number; minStock: number }[];
  };
}

interface AdminData {
  summary: DashboardSummary | null;
  user: { firstName?: string; lastName?: string; email?: string } | null;
  refresh: () => void;
}

const Ctx = createContext<AdminData>({ summary: null, user: null, refresh: () => undefined });

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [user, setUser] = useState<AdminData['user']>(null);
  const last = useRef(0);
  const location = useLocation();

  const refresh = useCallback(() => {
    last.current = Date.now();
    api
      .get('/dashboard/summary', { params: periodRange('today') })
      .then((res) => setSummary(res.data.data))
      .catch(() => {
        /* indicateurs indisponibles : l'interface reste utilisable */
      });
  }, []);

  useEffect(() => {
    api
      .get('/auth/me')
      .then((res) => setUser(res.data.data?.user || null))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (Date.now() - last.current > 15000) refresh();
  }, [location.pathname, refresh]);

  return <Ctx.Provider value={{ summary, user, refresh }}>{children}</Ctx.Provider>;
}

export const useAdminData = () => useContext(Ctx);
