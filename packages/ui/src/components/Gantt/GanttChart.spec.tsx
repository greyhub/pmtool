import { fireEvent, render, screen } from '@testing-library/react';
import {
  AssigneeIcons,
  buildStatusColorCss,
  aimCell,
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

describe('buildStatusColorCss progress wash', () => {
  const base: GanttTaskInput = { id: 't1', text: 'T', start: new Date(), end: new Date(), barColor: 'red' };

  it('fades only the unfinished remainder, keeping the done part solid', () => {
    expect(buildStatusColorCss([{ ...base, progress: 40 }])).toContain(
      'linear-gradient(to right, transparent 40%, rgba(255,255,255,0.55) 40%)',
    );
  });

  it('fades the whole bar at 0%, nothing at 100%, and clamps out-of-range values', () => {
    expect(buildStatusColorCss([{ ...base, progress: 0 }])).toContain('transparent 0%, rgba(255,255,255,0.55) 0%');
    expect(buildStatusColorCss([{ ...base, progress: 100 }])).not.toContain('linear-gradient');
    expect(buildStatusColorCss([{ ...base, progress: 250 }])).not.toContain('linear-gradient');
  });

  it('leaves milestones untouched', () => {
    expect(buildStatusColorCss([{ ...base, type: 'milestone', progress: 0 }])).not.toContain('linear-gradient');
  });
});

describe('AssigneeIcons roles', () => {
  it('lists the primary first regardless of input order, and tags tooltips with the role', () => {
    const { container } = render(
      <AssigneeIcons
        roleLabels={{ primary: 'Phụ trách', support: 'Hỗ trợ' }}
        assignees={[
          { name: 'Helper', character: 'otter', role: 'SUPPORT' },
          { name: 'Boss', character: 'fox', role: 'PRIMARY' },
        ]}
      />,
    );
    const icons = container.querySelectorAll('[aria-label]');
    expect(icons[0]).toHaveAttribute('aria-label', 'Boss — Phụ trách');
    expect(icons[1]).toHaveAttribute('aria-label', 'Helper — Hỗ trợ');
  });

  it('never lets supporters push the primary out of the visible icons', () => {
    render(
      <AssigneeIcons
        assignees={[
          { name: 'S1', character: 'otter', role: 'SUPPORT' },
          { name: 'S2', character: 'panda', role: 'SUPPORT' },
          { name: 'Boss', character: 'fox', role: 'PRIMARY' },
        ]}
      />,
    );
    expect(screen.getByLabelText('Boss')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
  });
});

describe('aimCell', () => {
  it('looks straight ahead (center cell) when the cursor is on top of the icon', () => {
    expect(aimCell(0, 0)).toBe(4);
    expect(aimCell(5, -5)).toBe(4);
  });

  it('maps each of the 8 directions to its cell in the 3x3 sheet', () => {
    const far = 100;
    expect(aimCell(far, 0)).toBe(5); // right
    expect(aimCell(far, far)).toBe(8); // down-right
    expect(aimCell(0, far)).toBe(7); // down
    expect(aimCell(-far, far)).toBe(6); // down-left
    expect(aimCell(-far, 0)).toBe(3); // left
    expect(aimCell(-far, -far)).toBe(0); // up-left
    expect(aimCell(0, -far)).toBe(1); // up
    expect(aimCell(far, -far)).toBe(2); // up-right
  });

  it('treats a cursor just left of the icon as left, not wrapping to right (atan2 seam)', () => {
    expect(aimCell(-100, -1)).toBe(3);
    expect(aimCell(-100, 1)).toBe(3);
  });
});

describe('AssigneeIcons tooltip', () => {
  const assignees = [{ name: 'Nguyễn A', character: 'fox', role: 'PRIMARY' as const }];

  it('shows the person\'s name immediately on hover and hides it on leave', () => {
    render(<AssigneeIcons assignees={assignees} roleLabels={{ primary: 'Phụ trách', support: 'Hỗ trợ' }} />);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    const icon = screen.getByLabelText('Nguyễn A — Phụ trách');
    fireEvent.pointerEnter(icon);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Nguyễn A — Phụ trách');

    fireEvent.pointerLeave(icon);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('also shows on keyboard focus', () => {
    render(<AssigneeIcons assignees={assignees} />);
    fireEvent.focus(screen.getByLabelText('Nguyễn A'));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Nguyễn A');
  });
});
