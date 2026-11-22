/**
 * Distances et coût des trajets (domicile → sources d'achat).
 *
 * Distance = ligne droite × 1,3 (les routes ne vont pas tout droit) : une
 * estimation, affichée avec « ≈ ». Aucun service extérieur n'est appelé.
 * Coût = km × consommation (L/100 km) ÷ 100 × prix du litre.
 */
export interface LatLng {
  lat: number;
  lng: number;
}

export const ROAD_FACTOR = 1.3;

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Distance estimée par la route, en km (1 décimale). */
export const roadKm = (a: LatLng, b: LatLng) =>
  Math.round(haversineKm(a, b) * ROAD_FACTOR * 10) / 10;

/** Coût d'un kilomètre en voiture (DT). */
export const costPerKm = (consumptionL100: number, fuelPrice: number) =>
  consumptionL100 > 0 && fuelPrice > 0 ? (consumptionL100 / 100) * fuelPrice : 0;

/**
 * Tournée domicile → arrêts → domicile, en allant à chaque fois au plus proche.
 * Renvoie la distance totale estimée et l'ordre de passage.
 */
export function roundTrip<T extends LatLng>(home: LatLng, stops: T[]): { km: number; order: T[] } {
  const left = [...stops];
  const order: T[] = [];
  let here: LatLng = home;
  let km = 0;
  while (left.length) {
    let best = 0;
    for (let i = 1; i < left.length; i++) {
      if (haversineKm(here, left[i]) < haversineKm(here, left[best])) best = i;
    }
    const next = left.splice(best, 1)[0];
    km += roadKm(here, next);
    order.push(next);
    here = next;
  }
  if (order.length) km += roadKm(here, home);
  return { km: Math.round(km * 10) / 10, order };
}

export const formatKm = (km: number) =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${String(km.toFixed(1)).replace('.', ',')} km`;

const valid = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/**
 * Position depuis un lien Google Maps / OpenStreetMap ou des coordonnées
 * collées (« 36.8065, 10.1815 »). Null si rien de reconnaissable.
 */
export function parseLocationText(text: string): LatLng | null {
  const t = decodeURIComponent(text.trim());
  const patterns = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, // position exacte d'un lieu Google Maps
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/, // centre de la carte Google Maps
    /[?&](?:q|ll|query|destination)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /[?&]mlat=(-?\d+(?:\.\d+)?)&mlon=(-?\d+(?:\.\d+)?)/, // OpenStreetMap
    /#map=\d+\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/, // OpenStreetMap
    /^(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)$/, // coordonnées seules
  ];
  for (const p of patterns) {
    const m = t.match(p);
    if (m) {
      const lat = parseFloat(m[1]);
      const lng = parseFloat(m[2]);
      if (valid(lat, lng)) return { lat, lng };
    }
  }
  return null;
}
