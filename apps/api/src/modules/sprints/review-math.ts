import { ReviewItemDto, SprintReviewDto } from '@pmtool/shared-types';
import { loadOf } from './sprint-load';

export interface ReviewTask {
  id: string;
  humanKey: string;
  title: string;
  status: ReviewItemDto['status'];
  storyPoints: number | null;
  estimateHours: number | null;
  sprintAddedAt: Date | null;
  assignee: { id: string; name: string; character: string } | null;
}

const round = (n: number) => Math.round(n * 10) / 10;

/** The sprint's contents as review items. Work that joined after the sprint started is flagged as added mid-sprint. */
export function buildItems(
  tasks: ReviewTask[],
  unit: 'POINTS' | 'HOURS',
  startedAt: Date | null,
): ReviewItemDto[] {
  return tasks.map((t) => ({
    id: t.id,
    humanKey: t.humanKey,
    title: t.title,
    status: t.status,
    load: loadOf(t, unit),
    addedMidSprint: Boolean(
      startedAt && t.sprintAddedAt && t.sprintAddedAt > startedAt,
    ),
    assignee: t.assignee,
    carriedTo: null,
  }));
}

/**
 * Totals for the review. `committed` is the promise at the start; what was added later is the rest of what was planned by the end.
 * Completion is measured against everything that ended up planned, so a sprint that took on extra work and finished it all reads 100%.
 */
export function summarize(
  items: ReviewItemDto[],
  committed: number | null,
): SprintReviewDto['summary'] {
  const done = items.filter((i) => i.status === 'DONE');
  const open = items.filter((i) => i.status !== 'DONE');
  const sum = (xs: ReviewItemDto[]) =>
    round(xs.reduce((n, i) => n + i.load, 0));
  const finalPlanned = sum(items);
  const completed = sum(done);
  const added = sum(items.filter((i) => i.addedMidSprint));
  return {
    committed,
    added,
    finalPlanned,
    completed,
    unfinished: sum(open),
    completionPct:
      finalPlanned === 0 ? 0 : Math.round((completed / finalPlanned) * 100),
    doneCount: done.length,
    unfinishedCount: open.length,
    addedCount: items.filter((i) => i.addedMidSprint).length,
  };
}

/** Who finished how much (by the accountable person); unassigned work is grouped under nobody and omitted. */
export function byPerson(items: ReviewItemDto[]): SprintReviewDto['people'] {
  const map = new Map<string, SprintReviewDto['people'][number]>();
  for (const i of items) {
    if (!i.assignee) continue;
    const p = map.get(i.assignee.id) ?? {
      id: i.assignee.id,
      name: i.assignee.name,
      character: i.assignee.character,
      doneLoad: 0,
      doneCount: 0,
      unfinishedCount: 0,
    };
    if (i.status === 'DONE') {
      p.doneLoad = round(p.doneLoad + i.load);
      p.doneCount += 1;
    } else {
      p.unfinishedCount += 1;
    }
    map.set(i.assignee.id, p);
  }
  return [...map.values()].sort(
    (a, b) =>
      b.doneLoad - a.doneLoad ||
      b.doneCount - a.doneCount ||
      a.name.localeCompare(b.name),
  );
}

/** Mean completed load of up to three closed sprints before the given one (list is oldest to newest); null when there are none. */
export function velocityBefore(
  closed: { id: string; completed: number }[],
  currentId: string | null,
): number | null {
  const idx = currentId
    ? closed.findIndex((c) => c.id === currentId)
    : closed.length;
  const before = (idx < 0 ? closed : closed.slice(0, idx)).slice(-3);
  if (before.length === 0) return null;
  return round(before.reduce((n, c) => n + c.completed, 0) / before.length);
}
