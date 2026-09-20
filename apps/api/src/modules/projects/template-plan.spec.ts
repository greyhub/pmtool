import { PROJECT_TEMPLATES, templateStats } from '@pmtool/shared-types';
import { planTemplate } from './template-plan';

const START = new Date('2026-09-21T12:00:00.000Z'); // a Monday

describe('planTemplate', () => {
  for (const template of PROJECT_TEMPLATES) {
    describe(template.id, () => {
      const plan = planTemplate(template, 'vi', START);
      const byKey = new Map(plan.tasks.map((t) => [t.key, t]));

      it('creates every phase, deliverable, work package, activity and milestone once', () => {
        const stats = templateStats(template);
        const count = (type: string, milestone = false) =>
          plan.tasks.filter(
            (t) => t.nodeType === type && t.isMilestone === milestone,
          ).length;
        expect(count('PHASE')).toBe(stats.phases);
        expect(count('DELIVERABLE')).toBe(stats.deliverables);
        expect(count('WORK_PACKAGE')).toBe(stats.workPackages);
        expect(count('ACTIVITY')).toBe(stats.activities);
        expect(plan.tasks.filter((t) => t.isMilestone)).toHaveLength(
          stats.milestones,
        );
      });

      it('lists parents before their children and respects the WBS hierarchy', () => {
        const rank = {
          PHASE: 0,
          DELIVERABLE: 1,
          WORK_PACKAGE: 2,
          ACTIVITY: 3,
        } as const;
        const seen = new Set<string>();
        for (const t of plan.tasks) {
          if (t.parentKey) {
            expect(seen.has(t.parentKey)).toBe(true);
            expect(rank[t.nodeType]).toBeGreaterThan(
              rank[byKey.get(t.parentKey)!.nodeType],
            );
          }
          seen.add(t.key);
        }
      });

      it('schedules on weekdays, with parents spanning their children and milestones on the phase end', () => {
        for (const t of plan.tasks) {
          expect([0, 6]).not.toContain(t.start.getUTCDay());
          expect([0, 6]).not.toContain(t.due.getUTCDay());
          expect(t.due.getTime()).toBeGreaterThanOrEqual(t.start.getTime());
          if (t.isMilestone) {
            expect(t.start.getTime()).toBe(t.due.getTime());
            expect(t.due.getTime()).toBe(
              byKey.get(t.parentKey!)!.due.getTime(),
            );
          }
          if (t.parentKey && !t.isMilestone) {
            const parent = byKey.get(t.parentKey)!;
            expect(t.start.getTime()).toBeGreaterThanOrEqual(
              parent.start.getTime(),
            );
            expect(t.due.getTime()).toBeLessThanOrEqual(parent.due.getTime());
          }
        }
      });

      it('never leaves a parent with a single child, so a fresh project has no 100%-rule warnings', () => {
        for (const t of template.phases.flatMap((p) => p.deliverables)) {
          expect(t.workPackages.length).toBeGreaterThanOrEqual(2);
          for (const wp of t.workPackages)
            expect(wp.activities.length).toBeGreaterThanOrEqual(2);
        }
      });

      it('has text in both languages', () => {
        const en = planTemplate(template, 'en', START);
        expect(en.tasks.every((t) => t.title.length > 0)).toBe(true);
        expect(en.tasks[0]!.title).not.toBe(plan.tasks[0]!.title);
      });
    });
  }

  it('starts on the next weekday when the project starts on a weekend', () => {
    const plan = planTemplate(
      PROJECT_TEMPLATES[0]!,
      'vi',
      new Date('2026-09-19T12:00:00.000Z'),
    ); // Saturday
    expect(plan.tasks[0]!.start.toISOString().slice(0, 10)).toBe('2026-09-21');
  });
});
