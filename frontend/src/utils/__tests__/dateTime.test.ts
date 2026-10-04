import { describe, expect, it } from 'vitest';
import {
  bucketEnd,
  bucketLabel,
  bucketStarts,
  customRange,
  formatDateTimeFr,
  fromLocalParts,
  periodRange,
  toLocalParts,
} from '../dateTime';

// Lance avec TZ=Africa/Tunis (UTC+1, comme Rahma) — voir le script "test" de package.json
describe('dates locales → backend sans decalage UTC', () => {
  it('le fuseau des tests est bien celui de Tunis', () => {
    expect(new Date(2026, 9, 2, 15, 0).getTimezoneOffset()).toBe(-60);
  });

  it('15:00 heure locale est envoye comme 14:00 UTC (meme instant)', () => {
    expect(fromLocalParts('2026-10-02', '15:00')).toBe('2026-10-02T14:00:00.000Z');
  });

  it('aller-retour sans perte : ce qui est affiche = ce qui a ete saisi', () => {
    const iso = fromLocalParts('2026-10-02', '15:00');
    expect(toLocalParts(iso)).toEqual({ date: '2026-10-02', time: '15:00' });
    expect(formatDateTimeFr(iso)).toBe('02 octobre 2026 · 15:00');
  });

  it("regression : l'ancien affichage via toISOString() decalait d'une heure", () => {
    const iso = fromLocalParts('2026-10-02', '08:00');
    expect(new Date(iso).toISOString().slice(11, 16)).toBe('07:00'); // ancien bug
    expect(toLocalParts(iso).time).toBe('08:00'); // corrige
  });

  it('minuit local reste le bon jour', () => {
    const iso = fromLocalParts('2026-10-03', '00:30');
    expect(iso).toBe('2026-10-02T23:30:00.000Z');
    expect(toLocalParts(iso).date).toBe('2026-10-03');
  });

  it('periodes : bornes en heure locale', () => {
    const now = new Date(2026, 9, 1, 10, 0); // jeudi 1er octobre 2026
    expect(periodRange('today', now)).toEqual({
      from: '2026-09-30T23:00:00.000Z',
      to: '2026-10-01T23:00:00.000Z',
    });
    expect(periodRange('week', now).from).toBe('2026-09-27T23:00:00.000Z'); // lundi 28/09
    expect(periodRange('month', now)).toEqual({
      from: '2026-09-30T23:00:00.000Z',
      to: '2026-10-31T23:00:00.000Z',
    });
    expect(customRange('2026-10-01', '2026-10-02')).toEqual({
      from: '2026-09-30T23:00:00.000Z',
      to: '2026-10-02T23:00:00.000Z',
    });
  });
});

describe('periodes glissantes et creneaux de graphique (heure locale)', () => {
  const now = new Date(2026, 9, 2, 10, 0); // 2 octobre 2026, Tunis

  it('7 jours / 30 jours : aujourd hui inclus, bornes a minuit local', () => {
    expect(periodRange('7d', now)).toEqual({
      from: '2026-09-25T23:00:00.000Z',
      to: '2026-10-02T23:00:00.000Z',
    });
    expect(periodRange('30d', now).from).toBe('2026-09-02T23:00:00.000Z');
  });

  it('creneaux journaliers = memes cles que le backend ($dateTrunc fuseau Tunis)', () => {
    const r = periodRange('7d', now);
    const days = bucketStarts(r.from, r.to, 'day');
    expect(days).toHaveLength(7);
    expect(days[6]).toBe('2026-10-01T23:00:00.000Z'); // 2 octobre 00:00 a Tunis
  });

  it('creneaux horaires d une journee : 24, libelles en heure locale', () => {
    const r = periodRange('today', now);
    const hours = bucketStarts(r.from, r.to, 'hour');
    expect(hours).toHaveLength(24);
    expect(hours[15]).toBe('2026-10-02T14:00:00.000Z');
    expect(bucketLabel(hours[15], 'hour')).toBe('15 h'); // pas "14 h" (UTC)
    expect(bucketLabel(hours[15], 'hour', true)).toBe('02 octobre · 15:00');
    expect(bucketEnd(hours[15], 'hour')).toBe('2026-10-02T15:00:00.000Z');
  });

  it('semaines commencant le lundi, mois au 1er', () => {
    expect(bucketStarts('2026-10-01T23:00:00.000Z', '2026-10-03T23:00:00.000Z', 'week')).toEqual([
      '2026-09-27T23:00:00.000Z',
    ]);
    expect(bucketStarts('2026-10-14T23:00:00.000Z', '2026-11-02T23:00:00.000Z', 'month')).toEqual([
      '2026-09-30T23:00:00.000Z',
      '2026-10-31T23:00:00.000Z',
    ]);
  });
});

describe('libelles des axes', () => {
  it('abreviations francaises des mois', () => {
    expect(bucketLabel('2026-09-30T23:00:00.000Z', 'day')).toBe('01 oct.');
    expect(bucketLabel('2026-09-25T23:00:00.000Z', 'day')).toBe('26 sept.');
  });
});
