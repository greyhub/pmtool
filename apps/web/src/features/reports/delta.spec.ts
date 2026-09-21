import { describe, expect, it } from 'vitest';
import { deltaTone, formatDelta, shiftDate } from './delta';

describe('report deltas', () => {
  it('colours a change by whether the direction is good for that metric', () => {
    expect(deltaTone('done', 2)).toBe('good');
    expect(deltaTone('done', -1)).toBe('bad');
    expect(deltaTone('overdue', 2)).toBe('bad');
    expect(deltaTone('overdue', -2)).toBe('good');
    expect(deltaTone('inProgress', 5)).toBe('neutral');
  });

  it('shows no change as flat, whatever the metric', () => {
    expect(deltaTone('overdue', 0)).toBe('flat');
    expect(deltaTone('done', undefined)).toBe('flat');
  });

  it('formats with a sign and at most one decimal', () => {
    expect(formatDelta(3)).toBe('+3');
    expect(formatDelta(-1.54)).toBe('-1.5');
    expect(formatDelta(0.04)).toBe('0');
  });

  it('shifts calendar days across a month end', () => {
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
  });
});
