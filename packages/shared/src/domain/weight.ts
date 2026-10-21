import { WEIGHT_MAX_KG, WEIGHT_MIN_KG } from '../constants';

/**
 * Weights are handled as integer hundredths of a kilogram ("centi-kg") during
 * arithmetic so that sums like 22.5 * 10 + 22.5 * 8 never drift.
 * Rounding rule: round half away from zero to 0.01 kg.
 */
export function toCentiKg(weightKg: number): number {
  // Shift the decimal point via the string form to avoid 1.005 * 100 = 100.4999…
  const centi = Math.round(Number(`${Math.abs(weightKg)}e2`));
  return weightKg < 0 ? -centi : centi;
}

export function fromCentiKg(centi: number): number {
  return centi / 100;
}

export function roundWeightKg(weightKg: number): number {
  return fromCentiKg(toCentiKg(weightKg));
}

export function isValidWeightKg(weightKg: number): boolean {
  return Number.isFinite(weightKg) && weightKg >= WEIGHT_MIN_KG && weightKg <= WEIGHT_MAX_KG;
}

/** "22.5" / "22,5" -> 22.5; returns null for invalid input. */
export function parseWeightInput(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.');
  if (normalized === '' || !/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!isValidWeightKg(value)) return null;
  return roundWeightKg(value);
}

export function formatWeight(weightKg: number): string {
  return Number.isInteger(weightKg) ? String(weightKg) : weightKg.toFixed(2).replace(/0$/, '');
}
