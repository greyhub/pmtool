import { describe, expect, it } from 'vitest';
import type { SprintDto } from '@pmtool/shared-types';
import { velocityOf } from './velocity';

const sp = (status: SprintDto['status'], completedLoad: number | null, closedAt: string | null) =>
  ({ status, completedLoad, closedAt }) as SprintDto;

describe('velocityOf', () => {
  it('is null before any sprint has closed', () => {
    expect(velocityOf([sp('ACTIVE', null, null), sp('PLANNED', null, null)])).toBeNull();
  });
  it('averages only the most recent closed sprints', () => {
    const all = [
      sp('CLOSED', 100, '2026-01-01'),
      sp('CLOSED', 10, '2026-02-01'),
      sp('CLOSED', 20, '2026-03-01'),
      sp('CLOSED', 30, '2026-04-01'),
    ];
    expect(velocityOf(all)).toBe(20);
  });
});
