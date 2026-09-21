import { EstimationUnit } from '@pmtool/shared-types';

export interface LoadTask {
  status: string;
  storyPoints: number | null;
  estimateHours: number | null;
}

/** A task's size in the project's unit; unsized work counts as 0 so it never blocks planning. */
export function loadOf(task: LoadTask, unit: EstimationUnit): number {
  return (unit === 'POINTS' ? task.storyPoints : task.estimateHours) ?? 0;
}

export function totals(tasks: LoadTask[], unit: EstimationUnit) {
  let planned = 0;
  let done = 0;
  let doneCount = 0;
  for (const t of tasks) {
    const load = loadOf(t, unit);
    planned += load;
    if (t.status === 'DONE') {
      done += load;
      doneCount += 1;
    }
  }
  return {
    plannedLoad: planned,
    doneLoad: done,
    taskCount: tasks.length,
    doneCount,
  };
}
