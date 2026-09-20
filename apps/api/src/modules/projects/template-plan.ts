import {
  addWorkdays,
  nextWorkday,
  ProjectTemplate,
} from '@pmtool/shared-types';

export type Lang = 'vi' | 'en';

/** One task the template will create, in creation order (parents before children). */
export interface PlannedTask {
  key: string;
  parentKey: string | null;
  title: string;
  nodeType: 'PHASE' | 'DELIVERABLE' | 'WORK_PACKAGE' | 'ACTIVITY';
  isMilestone: boolean;
  start: Date;
  due: Date;
  /** WBS dictionary text for deliverables and work packages. */
  scope?: string;
  criteria?: string;
}

export interface TemplatePlan {
  tasks: PlannedTask[];
  end: Date;
}

/**
 * Lays a template out on the calendar: activities run one after another inside
 * their work package, work packages inside their deliverable, deliverables
 * inside their phase, phases one after another. Each phase ends on a milestone.
 */
export function planTemplate(
  template: ProjectTemplate,
  lang: Lang,
  projectStart: Date,
): TemplatePlan {
  const tasks: PlannedTask[] = [];
  let cursor = nextWorkday(projectStart);
  let n = 0;
  const id = () => `n${n++}`;

  for (const phase of template.phases) {
    const phaseKey = id();
    const phaseStart = cursor;
    const phaseSlot = tasks.length;
    tasks.push({
      key: phaseKey,
      parentKey: null,
      title: phase.title[lang],
      nodeType: 'PHASE',
      isMilestone: false,
      start: phaseStart,
      due: phaseStart,
    });

    for (const deliverable of phase.deliverables) {
      const dKey = id();
      const dStart = cursor;
      const dSlot = tasks.length;
      tasks.push({
        key: dKey,
        parentKey: phaseKey,
        title: deliverable.title[lang],
        nodeType: 'DELIVERABLE',
        isMilestone: false,
        start: dStart,
        due: dStart,
        criteria: deliverable.criteria[lang],
        scope: deliverable.title[lang],
      });

      for (const wp of deliverable.workPackages) {
        const wKey = id();
        const wStart = cursor;
        const wSlot = tasks.length;
        tasks.push({
          key: wKey,
          parentKey: dKey,
          title: wp.title[lang],
          nodeType: 'WORK_PACKAGE',
          isMilestone: false,
          start: wStart,
          due: wStart,
          scope: wp.scope[lang],
        });
        for (const act of wp.activities) {
          const aStart = cursor;
          // An activity of N working days occupies N days, so it ends N-1 workdays after it starts.
          const aDue = addWorkdays(aStart, Math.max(act.days - 1, 0));
          tasks.push({
            key: id(),
            parentKey: wKey,
            title: act.title[lang],
            nodeType: 'ACTIVITY',
            isMilestone: false,
            start: aStart,
            due: aDue,
          });
          cursor = addWorkdays(aDue, 1);
        }
        tasks[wSlot]!.due = lastDue(tasks, wKey, tasks[wSlot]!.start);
      }
      tasks[dSlot]!.due = lastDue(tasks, dKey, tasks[dSlot]!.start);
    }
    const phaseEnd = lastDue(tasks, phaseKey, phaseStart);
    tasks[phaseSlot]!.due = phaseEnd;
    tasks.push({
      key: id(),
      parentKey: phaseKey,
      title: phase.milestone[lang],
      nodeType: 'ACTIVITY',
      isMilestone: true,
      start: phaseEnd,
      due: phaseEnd,
    });
  }

  const end = tasks.reduce(
    (max, t) => (t.due > max ? t.due : max),
    projectStart,
  );
  return { tasks, end };
}

/** Latest due date among the descendants of `parentKey` (or `fallback` when it has none yet). */
function lastDue(
  tasks: PlannedTask[],
  parentKey: string,
  fallback: Date,
): Date {
  const inTree = new Set<string>([parentKey]);
  let latest = fallback;
  for (const t of tasks) {
    if (t.parentKey && inTree.has(t.parentKey)) {
      inTree.add(t.key);
      if (t.due > latest) latest = t.due;
    }
  }
  return latest;
}
