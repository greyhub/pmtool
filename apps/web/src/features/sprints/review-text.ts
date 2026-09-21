import type { SprintReviewDto } from '@pmtool/shared-types';

export interface ReviewTextLabels {
  title: string; // "Sprint review — {name}"
  period: string;
  goal: string;
  goalResult: Record<'MET' | 'PARTIAL' | 'MISSED', string> & { none: string };
  summary: string;
  committed: string;
  completed: string;
  added: string;
  unfinished: string;
  velocity: string;
  delivered: string;
  left: string;
  people: string;
  notes: string;
  carriedSprint: (name: string) => string;
  carriedBacklog: string;
  addedTag: string;
  unit: string;
  preview: string;
}

const n = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));

/** The review as plain text (Markdown-friendly) to paste into chat, email or minutes. */
export function reviewToText(r: SprintReviewDto, l: ReviewTextLabels): string {
  const s = r.summary;
  const lines: string[] = [`# ${l.title}`, `${l.period}${r.isPreview ? ` — ${l.preview}` : ''}`];
  if (r.sprint.goal) lines.push(`${l.goal}: ${r.sprint.goal}`);
  lines.push(`**${l.goal}** → ${r.goalResult ? l.goalResult[r.goalResult] : l.goalResult.none}`);
  lines.push('', `## ${l.summary}`);
  lines.push(`- ${l.committed}: ${s.committed === null ? '—' : n(s.committed)} ${l.unit}`);
  lines.push(
    `- ${l.completed}: ${n(s.completed)} / ${n(s.finalPlanned)} ${l.unit} (${s.completionPct}%)`,
  );
  if (s.added > 0) lines.push(`- ${l.added}: +${n(s.added)} ${l.unit}`);
  lines.push(`- ${l.unfinished}: ${n(s.unfinished)} ${l.unit}`);
  if (r.velocityAvg !== null) lines.push(`- ${l.velocity}: ${n(r.velocityAvg)} ${l.unit}`);
  if (r.delivered.length > 0) {
    lines.push('', `## ${l.delivered} (${r.delivered.length})`);
    for (const i of r.delivered)
      lines.push(
        `- ${i.humanKey} ${i.title} — ${n(i.load)}${i.assignee ? ` (${i.assignee.name})` : ''}${i.addedMidSprint ? ` [${l.addedTag}]` : ''}`,
      );
  }
  if (r.unfinished.length > 0) {
    lines.push('', `## ${l.left} (${r.unfinished.length})`);
    for (const i of r.unfinished) {
      const to = i.carriedTo
        ? i.carriedTo.kind === 'sprint'
          ? l.carriedSprint(i.carriedTo.name ?? '')
          : l.carriedBacklog
        : '';
      lines.push(
        `- ${i.humanKey} ${i.title} — ${n(i.load)}${i.assignee ? ` (${i.assignee.name})` : ''}${i.addedMidSprint ? ` [${l.addedTag}]` : ''}${to ? ` → ${to}` : ''}`,
      );
    }
  }
  if (r.people.length > 0) {
    lines.push('', `## ${l.people}`);
    for (const p of r.people)
      lines.push(`- ${p.name}: ${n(p.doneLoad)} ${l.unit} (${p.doneCount})`);
  }
  if (r.reviewNotes) lines.push('', `## ${l.notes}`, r.reviewNotes);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}
