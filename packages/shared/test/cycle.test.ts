import { describe, expect, it } from 'vitest';
import { isPermutation, nextWorkoutId } from '../src';

const workouts = [
  { id: 'C', position: 2 },
  { id: 'A', position: 0 },
  { id: 'D', position: 3 },
  { id: 'B', position: 1 },
];

describe('nextWorkoutId', () => {
  it('returns null for a program without workouts', () => {
    expect(nextWorkoutId([], null)).toBeNull();
  });
  it('starts with the first workout by position', () => {
    expect(nextWorkoutId(workouts, null)).toBe('A');
  });
  it('advances through the configured order and wraps D -> A', () => {
    expect(nextWorkoutId(workouts, 'A')).toBe('B');
    expect(nextWorkoutId(workouts, 'B')).toBe('C');
    expect(nextWorkoutId(workouts, 'C')).toBe('D');
    expect(nextWorkoutId(workouts, 'D')).toBe('A');
  });
  it('works with a single workout', () => {
    expect(nextWorkoutId([{ id: 'X', position: 0 }], 'X')).toBe('X');
  });
  it('restarts from the first workout when the last completed one was deleted', () => {
    expect(nextWorkoutId(workouts, 'deleted')).toBe('A');
  });
  it('follows a manually chosen workout (skips are not completions)', () => {
    // user did A, then manually picked C: next is D, B is not marked complete
    expect(nextWorkoutId(workouts, 'C')).toBe('D');
  });
  it('respects reordering', () => {
    const reordered = workouts.map((w) => (w.id === 'A' ? { ...w, position: 4 } : w));
    expect(nextWorkoutId(reordered, 'D')).toBe('A');
    expect(nextWorkoutId(reordered, 'A')).toBe('B');
  });
});

describe('isPermutation', () => {
  it('accepts exact permutations only', () => {
    expect(isPermutation(['b', 'a'], ['a', 'b'])).toBe(true);
    expect(isPermutation(['a', 'a'], ['a', 'b'])).toBe(false);
    expect(isPermutation(['a'], ['a', 'b'])).toBe(false);
    expect(isPermutation(['a', 'c'], ['a', 'b'])).toBe(false);
  });
});
