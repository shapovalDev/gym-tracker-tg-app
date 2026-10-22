import { describe, expect, it } from 'vitest';
import { previousCounterpart, setLabels, setsOfType } from '../src';

const prev = [
  { setNumber: 1, setType: 'warmup' as const, weightKg: 20 },
  { setNumber: 2, setType: 'warmup' as const, weightKg: 40 },
  { setNumber: 3, setType: 'working' as const, weightKg: 60 },
  { setNumber: 4, weightKg: 62.5 }, // legacy row without a type = working
];

describe('set helpers', () => {
  it('matches the n-th set of the same type from last time', () => {
    expect(previousCounterpart(prev, 'working', 0)?.weightKg).toBe(60);
    expect(previousCounterpart(prev, 'working', 1)?.weightKg).toBe(62.5);
    expect(previousCounterpart(prev, 'warmup', 1)?.weightKg).toBe(40);
    expect(previousCounterpart(prev, 'working', 2)).toBeNull();
    expect(previousCounterpart(null, 'working', 0)).toBeNull();
  });
  it('labels warm-ups separately from working sets', () => {
    const labels = setLabels(prev, 'Р');
    expect(prev.map((s) => labels.get(s))).toEqual(['Р1', 'Р2', '1', '2']);
    expect(setLabels(prev).get(prev[0]!)).toBe('W1');
  });
  it('filters by type in recorded order', () => {
    expect(setsOfType([...prev].reverse(), 'working').map((s) => s.setNumber)).toEqual([3, 4]);
  });
});
