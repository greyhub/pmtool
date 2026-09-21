import { BurndownDayDto, BurndownDto } from '@pmtool/shared-types';
import { addDaysKey } from '../reports/report-math';

export interface DaySnapshot {
  date: string;
  planned: number;
  done: number;
}

export interface BurndownInput {
  startKey: string;
  endKey: string;
  todayKey: string;
  status: 'PLANNED' | 'ACTIVE' | 'CLOSED';
  committed: number | null;
  /** Day the sprint was closed (Vietnam calendar day), if it was. */
  closedKey: string | null;
  snapshots: DaySnapshot[];
}

const round = (n: number) => Math.round(n * 10) / 10;

function dayKeys(startKey: string, lastKey: string): string[] {
  const keys: string[] = [];
  for (let k = startKey; k <= lastKey; k = addDaysKey(k, 1)) keys.push(k);
  return keys;
}

/**
 * Turns the stored end-of-day snapshots into the burndown chart's series and a plain verdict.
 * The ideal line falls evenly (by calendar day) from the commitment on the first day to zero on the last.
 * Days without a snapshot (the server was off at midnight) carry the previous value forward, flagged as estimated;
 * the first day falls back to the commitment itself.
 */
export function buildBurndown(
  input: BurndownInput,
): Pick<
  BurndownDto,
  | 'days'
  | 'pace'
  | 'committed'
  | 'planned'
  | 'done'
  | 'remaining'
  | 'scopeChange'
> & { endKey: string } {
  const { startKey, endKey, todayKey, status, closedKey, snapshots } = input;
  const committed = input.committed;
  const plannedDays = dayKeys(startKey, endKey);
  const n = plannedDays.length;
  // A sprint still running past its end date keeps drawing until today (the overrun).
  const lastKey = status === 'ACTIVE' && todayKey > endKey ? todayKey : endKey;
  const keys = dayKeys(startKey, lastKey);
  const byDate = new Map(snapshots.map((s) => [s.date, s]));
  const lastActualKey = closedKey ?? (todayKey < lastKey ? todayKey : lastKey);
  const base = committed ?? snapshots[0]?.planned ?? 0;

  let prev: { planned: number; done: number } | null = null;
  const days: BurndownDayDto[] = keys.map((date, i) => {
    const ideal = n <= 1 ? 0 : i >= n - 1 ? 0 : round(base * (1 - i / (n - 1)));
    const snap = byDate.get(date);
    const happened = status !== 'PLANNED' && date <= lastActualKey;
    if (!happened)
      return {
        date,
        ideal,
        remaining: null,
        planned: null,
        done: null,
        estimated: false,
      };
    if (snap) {
      prev = { planned: snap.planned, done: snap.done };
      return {
        date,
        ideal,
        remaining: round(snap.planned - snap.done),
        planned: snap.planned,
        done: snap.done,
        estimated: false,
      };
    }
    const carried =
      prev ?? (date === startKey ? { planned: base, done: 0 } : null);
    if (!carried)
      return {
        date,
        ideal,
        remaining: null,
        planned: null,
        done: null,
        estimated: false,
      };
    prev = carried;
    return {
      date,
      ideal,
      remaining: round(carried.planned - carried.done),
      planned: carried.planned,
      done: carried.done,
      estimated: true,
    };
  });

  const actual = [...days].reverse().find((d) => d.remaining !== null);
  const planned = actual?.planned ?? base;
  const done = actual?.done ?? 0;
  const remaining = actual?.remaining ?? base;
  const scopeChange = committed === null ? 0 : round(planned - committed);

  const todayIdx = keys.indexOf(
    todayKey < startKey ? startKey : todayKey > lastKey ? lastKey : todayKey,
  );
  const idealToday = days[Math.max(0, todayIdx)]?.ideal ?? 0;
  const deltaVsIdeal = round(remaining - idealToday);
  const elapsed = Math.max(0, todayIdx); // whole days completed before the day being looked at
  const burnPerDay = elapsed >= 1 ? round(done / elapsed) : 0;
  const daysLeft = Math.max(0, n - 1 - todayIdx);
  const projectedRemainingAtEnd =
    elapsed >= 1
      ? round(Math.max(0, remaining - burnPerDay * daysLeft))
      : round(remaining);
  const tolerance = base * 0.1;

  let verdict: BurndownDto['pace']['status'];
  if (status === 'PLANNED' || todayKey < startKey) verdict = 'not_started';
  else if (status === 'CLOSED') verdict = 'closed';
  else if (deltaVsIdeal < -tolerance) verdict = 'ahead';
  else if (deltaVsIdeal <= tolerance) verdict = 'on_track';
  else verdict = 'behind';

  const overrunDays =
    status === 'ACTIVE' && todayKey > endKey ? keys.length - n : 0;
  return {
    endKey: lastKey,
    committed,
    planned,
    done,
    remaining,
    scopeChange,
    days,
    pace: {
      status: verdict,
      deltaVsIdeal,
      burnPerDay,
      projectedRemainingAtEnd,
      overrunDays,
    },
  };
}
