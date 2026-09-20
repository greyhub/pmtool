import { parseCsv } from './csv';
import { fold, parseTaskRows, ImportContext } from './task-import';

const ctx = (over: Partial<ImportContext> = {}): ImportContext => ({
  existing: new Map([['PRJ-1', { id: 't1', nodeType: 'WORK_PACKAGE' }]]),
  members: new Map([
    ['an@example.com', 'u_an'],
    ['binh@example.com', 'u_binh'],
  ]),
  ...over,
});
const parse = (csv: string, c = ctx()) => parseTaskRows(parseCsv(csv), c);

describe('fold', () => {
  it('ignores case, diacritics and separators', () => {
    expect(fold('Giai đoạn')).toBe('giai_doan');
    expect(fold('  Cần LÀM ')).toBe('can_lam');
    expect(fold('Work-package')).toBe('work_package');
  });
});

describe('parseTaskRows', () => {
  it('reads a minimal file: only a title is required, the rest defaults', () => {
    const r = parse('title\nViệc A\nViệc B');
    expect(r.errors).toEqual([]);
    expect(
      r.tasks.map((t) => [
        t.title,
        t.nodeType,
        t.status,
        t.priority,
        t.percentComplete,
      ]),
    ).toEqual([
      ['Việc A', 'ACTIVITY', 'TODO', 'MEDIUM', 0],
      ['Việc B', 'ACTIVITY', 'TODO', 'MEDIUM', 0],
    ]);
  });

  it('accepts Vietnamese and English headers and values, and both date formats', () => {
    const r = parse(
      'Tên;Cấp WBS;Trạng thái;Ưu tiên;Bắt đầu;Đến hạn;Hoàn thành;Người phụ trách;Người hỗ trợ\n' +
        'Khảo sát;Gói công việc;Đang làm;Cao;21/09/2026;2026-09-25;40%;AN@example.com;binh@example.com',
    );
    expect(r.errors).toEqual([]);
    const t = r.tasks[0]!;
    expect([t.nodeType, t.status, t.priority, t.percentComplete]).toEqual([
      'WORK_PACKAGE',
      'IN_PROGRESS',
      'HIGH',
      40,
    ]);
    expect(t.startDate!.toISOString().slice(0, 10)).toBe('2026-09-21');
    expect(t.dueDate!.toISOString().slice(0, 10)).toBe('2026-09-25');
    expect([t.assigneeId, t.supporterIds]).toEqual(['u_an', ['u_binh']]);
  });

  it('links parents by ref, orders parents before children, and links to existing keys', () => {
    const r = parse(
      'ref,parent,title,type\nc,p,Con,Hoạt động\np,,Cha,Giao phẩm\nx,PRJ-1,Vào gói có sẵn,Hoạt động',
    );
    expect(r.errors).toEqual([]);
    expect(r.tasks.map((t) => t.title)).toEqual([
      'Cha',
      'Con',
      'Vào gói có sẵn',
    ]);
    const x = r.tasks.find((t) => t.title === 'Vào gói có sẵn')!;
    expect(x.parentExistingId).toBe('t1');
  });

  it('reports each bad line with its number and keeps the good ones', () => {
    const r = parse(
      [
        'title,due,status,percent,assignee',
        ',2026-09-25,,,', // no title
        'Ổn,2026-09-25,,,',
        'Sai ngày,31/02/2026,,,',
        'Sai trạng thái,,Xong xuôi,,',
        'Sai %,,,150,',
        'Người lạ,,,,ai@example.com',
      ].join('\n'),
    );
    expect(r.tasks.map((t) => t.title)).toEqual(['Ổn']);
    expect(r.errors.map((e) => e.line)).toEqual([2, 4, 5, 6, 7]);
    expect(r.errors[3]!.message).toContain('150');
  });

  it('rejects a milestone without a due date and snaps its start to the due date', () => {
    const bad = parse('title,milestone\nMốc,có');
    expect(bad.errors[0]!.message).toContain('ngày đến hạn');
    const ok = parse(
      'title,milestone,start,due\nMốc,yes,2026-09-01,2026-09-30',
    );
    expect(ok.tasks[0]!.startDate!.toISOString().slice(0, 10)).toBe(
      '2026-09-30',
    );
  });

  it('enforces the WBS hierarchy, promoting an activity that gains a child', () => {
    const wrong = parse(
      'ref,parent,title,type\ng,,Gói,Gói công việc\np,g,Giai đoạn con,Giai đoạn',
    );
    expect(wrong.errors).toHaveLength(1);
    expect(wrong.errors[0]!.line).toBe(3);

    const promote = parse('ref,parent,title\na,,Việc cha\nb,a,Việc con');
    expect(promote.errors).toEqual([]);
    expect(promote.tasks.find((t) => t.title === 'Việc cha')!.nodeType).toBe(
      'WORK_PACKAGE',
    );

    const promoteExisting = parse(
      'parent,title\nPRJ-2,Con',
      ctx({
        existing: new Map([['PRJ-2', { id: 't2', nodeType: 'ACTIVITY' }]]),
      }),
    );
    expect(promoteExisting.promotedExistingIds).toEqual(['t2']);
  });

  it('rejects unknown parents, duplicate refs and cycles', () => {
    expect(parse('parent,title\nNOPE,Việc').errors[0]!.message).toContain(
      'NOPE',
    );
    expect(parse('ref,title\na,Một\na,Hai').errors[0]!.message).toContain(
      'trùng',
    );
    const cycle = parse('ref,parent,title\na,b,Một\nb,a,Hai');
    expect(cycle.errors.length).toBeGreaterThan(0);
    expect(cycle.tasks).toEqual([]);
  });

  it('undoes the apostrophe the exporter puts before formula-like text', () => {
    expect(parse("title\n'-Bắt đầu bằng dấu trừ").tasks[0]!.title).toBe(
      '-Bắt đầu bằng dấu trừ',
    );
  });

  it('needs a title column, and caps the number of rows', () => {
    expect(parse('foo,bar\n1,2').errors[0]!.message).toContain('title');
    const many =
      'title\n' + Array.from({ length: 2001 }, (_, i) => `t${i}`).join('\n');
    expect(parse(many).errors[0]!.message).toContain('2000');
  });
});
