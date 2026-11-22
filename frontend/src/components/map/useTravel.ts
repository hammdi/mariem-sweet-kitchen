import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import type { PurchaseSource } from '../../types/admin';
import { costPerKm, LatLng, roadKm } from '../../utils/geo';

export interface TravelInfo {
  home: LatLng | null;
  consumption: number; // L/100 km
  fuelPrice: number; // DT/L
  perKm: number; // DT/km
  sources: PurchaseSource[];
}

/**
 * Domicile, voiture et sources d'achat placées sur la carte : de quoi estimer
 * la distance et le coût d'un trajet (aller-retour) vers chaque source.
 */
export function useTravel() {
  const [info, setInfo] = useState<TravelInfo | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, src] = await Promise.all([api.get('/settings'), api.get('/purchase-sources')]);
      const list: { key: string; value: number }[] = s.data.data?.settings || [];
      const get = (k: string) => list.find((x) => x.key === k)?.value;
      const lat = get('homeLat');
      const lng = get('homeLng');
      const consumption = get('fuelConsumption') || 0;
      const fuelPrice = get('fuelPrice') || 0;
      setInfo({
        home: typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null,
        consumption,
        fuelPrice,
        perKm: costPerKm(consumption, fuelPrice),
        sources: src.data.data?.sources || [],
      });
    } catch {
      setInfo(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { info, reload: load };
}

/** Aller-retour domicile ↔ source : km et coût (null si une position manque). */
export function tripTo(info: TravelInfo | null, location?: LatLng | null) {
  if (!info?.home || !location) return null;
  const km = roadKm(info.home, location) * 2;
  return { km: Math.round(km * 10) / 10, cost: Math.round(km * info.perKm * 100) / 100 };
}
