import { render, screen } from '@testing-library/react';
import {
  AssigneeIcons,
  buildStatusColorCss,
  computeGridWidth,
  ganttHighlightTime,
  type GanttTaskInput,
} from './GanttChart';

describe('ganttHighlightTime', () => {
  const today = new Date('2026-03-11T00:00:00.000Z'); // a Wednesday

  it('marks the current day as today, taking priority over weekend', () => {
    expect(ganttHighlightTime(today, 'day', today)).toBe('pm-gantt-today');
  });

  it('marks Saturday/Sunday as weekend', () => {
    const saturday = new Date('2026-03-14T00:00:00.000Z');
    const sunday = new Date('2026-03-15T00:00:00.000Z');
    expect(ganttHighlightTime(saturday, 'day', today)).toBe('wx-weekend');
    expect(ganttHighlightTime(sunday, 'day', today)).toBe('wx-weekend');
  });

  it('returns nothing for an ordinary weekday that is not today', () => {
    const thursday = new Date('2026-03-12T00:00:00.000Z');
    expect(ganttHighlightTime(thursday, 'day', today)).toBe('');
  });

  it('ignores non-day units', () => {
    expect(ganttHighlightTime(today, 'hour', today)).toBe('');
  });
});

describe('buildStatusColorCss', () => {
  const baseTask: GanttTaskInput = { id: 't1', text: 'Task', start: new Date(), end: new Date() };

  it('emits a rule per task with a barColor, targeting its colon-prefixed data-task-id', () => {
    const css = buildStatusColorCss([
      { ...baseTask, id: 'abc123', barColor: 'var(--color-success)' },
    ]);
    expect(css).toContain('.wx-bar[data-task-id=":abc123"]');
    expect(css).toContain('--wx-gantt-task-color:var(--color-success)');
    expect(css).toContain('--wx-gantt-summary-color:var(--color-success)');
    expect(css).toContain('--wx-gantt-milestone-color:var(--color-success)');
  });

  it('skips tasks without a barColor', () => {
    const css = buildStatusColorCss([{ ...baseTask, id: 'no-color' }]);
    expect(css).toBe('');
  });

  it('emits one rule per colored task, in order', () => {
    const css = buildStatusColorCss([
      { ...baseTask, id: 'a', barColor: 'red' },
      { ...baseTask, id: 'b' },
      { ...baseTask, id: 'c', barColor: 'blue' },
    ]);
    const rules = css.split('\n');
    expect(rules).toHaveLength(2);
    expect(rules[0]).toContain('data-task-id=":a"');
    expect(rules[1]).toContain('data-task-id=":c"');
  });
});

describe('computeGridWidth', () => {
  it('sums the width of every column', () => {
    expect(computeGridWidth([{ id: 'a', width: 200 }, { id: 'b', width: 90 }])).toBe(290);
  });

  it('treats a missing width as 0', () => {
    expect(computeGridWidth([{ id: 'a', width: 200 }, { id: 'b' }])).toBe(200);
  });

  it('returns 0 for no columns', () => {
    expect(computeGridWidth([])).toBe(0);
  });
});

describe('AssigneeIcons', () => {
  it('shows a dash when there are no assignees', () => {
    render(<AssigneeIcons assignees={[]} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders one icon per assignee, up to 2, each labeled with their name', () => {
    render(<AssigneeIcons assignees={[{ name: 'Nguyễn Văn A', character: 'fox' }]} />);
    expect(screen.getByLabelText('Nguyễn Văn A')).toBeInTheDocument();
  });

  it('caps at 2 icons and shows a "+N" tail for the rest', () => {
    render(
      <AssigneeIcons
        assignees={[
          { name: 'A', character: 'fox' },
          { name: 'B', character: 'otter' },
          { name: 'C', character: 'panda' },
        ]}
      />,
    );
    expect(screen.getByLabelText('A')).toBeInTheDocument();
    expect(screen.getByLabelText('B')).toBeInTheDocument();
    expect(screen.queryByLabelText('C')).not.toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
  });
});
