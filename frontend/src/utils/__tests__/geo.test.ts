import { describe, expect, it } from 'vitest';
import { costPerKm, formatKm, haversineKm, parseLocationText, roadKm, roundTrip } from '../geo';

const tunis = { lat: 36.8065, lng: 10.1815 };
const ariana = { lat: 36.8625, lng: 10.1956 };
const marsa = { lat: 36.8782, lng: 10.3247 };

describe('carte et trajets', () => {
  it('distance Tunis → Ariana ≈ 6,4 km à vol d’oiseau, ≈ 8,3 km par la route', () => {
    expect(haversineKm(tunis, ariana)).toBeCloseTo(6.4, 0);
    expect(roadKm(tunis, ariana)).toBeCloseTo(8.3, 0);
  });

  it('coût au km : 7 L/100 km × 2,5 DT/L = 0,175 DT/km', () => {
    expect(costPerKm(7, 2.5)).toBeCloseTo(0.175, 6);
    expect(costPerKm(0, 2.5)).toBe(0);
  });

  it('tournée : passe d’abord par le plus proche puis revient au domicile', () => {
    const trip = roundTrip(tunis, [
      { ...marsa, name: 'La Marsa' },
      { ...ariana, name: 'Ariana' },
    ]);
    expect(trip.order.map((s) => s.name)).toEqual(['Ariana', 'La Marsa']);
    const expected = roadKm(tunis, ariana) + roadKm(ariana, marsa) + roadKm(marsa, tunis);
    expect(trip.km).toBeCloseTo(expected, 1);
    expect(roundTrip(tunis, []).km).toBe(0);
  });

  it('lit les liens Google Maps / OpenStreetMap et les coordonnées collées', () => {
    expect(
      parseLocationText(
        'https://www.google.com/maps/place/Carrefour/@36.8401,10.2401,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d36.8412!4d10.2433'
      )
    ).toEqual({ lat: 36.8412, lng: 10.2433 });
    expect(parseLocationText('https://maps.google.com/?q=36.8,10.18')).toEqual({
      lat: 36.8,
      lng: 10.18,
    });
    expect(parseLocationText('https://www.openstreetmap.org/#map=17/36.80650/10.18150')).toEqual({
      lat: 36.8065,
      lng: 10.1815,
    });
    expect(parseLocationText('36.8065, 10.1815')).toEqual(tunis);
    expect(parseLocationText('chez moi')).toBeNull();
    expect(parseLocationText('99, 10')).toBeNull();
  });

  it('affichage des distances', () => {
    expect(formatKm(0.45)).toBe('450 m');
    expect(formatKm(8.34)).toBe('8,3 km');
  });
});
