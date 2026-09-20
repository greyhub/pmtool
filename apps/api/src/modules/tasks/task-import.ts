import {
  canContain,
  TASK_PRIORITIES,
  TASK_STATUSES,
  WBS_NODE_TYPES,
  WbsNodeType,
} from '@pmtool/shared-types';

export const MAX_IMPORT_ROWS = 2000;

/** "Việc A" / "viec a" / "VIEC-A" all compare equal: lower-case, no diacritics, single separators. */
export function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const COLUMN_ALIASES: Record<string, string[]> = {
  ref: ['ref', 'key', 'id', 'ma', 'ma_cv', 'ma_cong_viec'],
  parent: [
    'parent',
    'parent_ref',
    'parent_key',
    'cha',
    'ma_cha',
    'cong_viec_cha',
  ],
  title: ['title', 'name', 'ten', 'tieu_de', 'ten_cong_viec'],
  type: ['type', 'level', 'node_type', 'wbs_level', 'cap', 'cap_wbs', 'loai'],
  status: ['status', 'trang_thai'],
  priority: ['priority', 'uu_tien', 'do_uu_tien'],
  start: ['start', 'start_date', 'bat_dau', 'ngay_bat_dau'],
  due: [
    'due',
    'due_date',
    'end',
    'end_date',
    'han',
    'den_han',
    'ngay_den_han',
    'ket_thuc',
  ],
  percent: [
    'percent',
    'percent_complete',
    'progress',
    'hoan_thanh',
    'phan_tram',
  ],
  estimate: [
    'estimate',
    'estimate_hours',
    'estimate_h',
    'uoc_tinh',
    'gio_uoc_tinh',
  ],
  milestone: ['milestone', 'is_milestone', 'moc', 'la_moc'],
  assignee: [
    'assignee',
    'owner',
    'primary_assignee',
    'nguoi_phu_trach',
    'phu_trach',
  ],
  supporters: ['supporters', 'nguoi_ho_tro', 'ho_tro'],
  description: ['description', 'desc', 'mo_ta'],
};

function enumMap<T extends string>(
  values: readonly T[],
  labels: Record<T, string[]>,
): Map<string, T> {
  const map = new Map<string, T>();
  for (const v of values) {
    map.set(fold(v), v);
    for (const label of labels[v]) map.set(fold(label), v);
  }
  return map;
}

const STATUS_MAP = enumMap(TASK_STATUSES, {
  TODO: ['Cần làm', 'To do', 'Todo', 'Backlog'],
  IN_PROGRESS: ['Đang làm', 'In progress', 'Doing'],
  IN_REVIEW: ['Đang xem xét', 'In review', 'Review'],
  DONE: ['Hoàn thành', 'Done', 'Complete', 'Completed'],
  BLOCKED: ['Bị chặn', 'Blocked'],
});
const PRIORITY_MAP = enumMap(TASK_PRIORITIES, {
  LOW: ['Thấp', 'Low'],
  MEDIUM: ['Trung bình', 'Medium', 'Normal'],
  HIGH: ['Cao', 'High'],
  CRITICAL: ['Khẩn cấp', 'Critical', 'Urgent'],
});
const TYPE_MAP = enumMap(WBS_NODE_TYPES, {
  PHASE: ['Giai đoạn', 'Phase'],
  DELIVERABLE: ['Giao phẩm', 'Deliverable'],
  WORK_PACKAGE: ['Gói công việc', 'Work package', 'Workpackage'],
  ACTIVITY: ['Hoạt động', 'Activity', 'Task', 'Công việc'],
});
const TRUE_WORDS = new Set(['1', 'true', 'yes', 'y', 'x', 'co', 'có', 'moc']);

export interface ImportContext {
  /** Existing tasks of the project by humanKey (upper-cased), for `parent` references outside the file. */
  existing: Map<string, { id: string; nodeType: WbsNodeType }>;
  /** Organization members by lower-cased email. */
  members: Map<string, string>;
}

export interface ImportTask {
  /** 1-based spreadsheet line (header = line 1). */
  line: number;
  ref: string | null;
  /** A ref from this file, or null. */
  parentRef: string | null;
  /** Id of an existing task when the parent is not in the file. */
  parentExistingId: string | null;
  title: string;
  nodeType: WbsNodeType;
  status: (typeof TASK_STATUSES)[number];
  priority: (typeof TASK_PRIORITIES)[number];
  startDate: Date | null;
  dueDate: Date | null;
  percentComplete: number;
  estimateHours: number | null;
  isMilestone: boolean;
  assigneeId: string | null;
  supporterIds: string[];
  description: string | null;
}

export interface ImportError {
  line: number;
  message: string;
}

export interface ImportResult {
  tasks: ImportTask[];
  errors: ImportError[];
  /** Existing tasks that will be promoted to WORK_PACKAGE because an activity got a child. */
  promotedExistingIds: string[];
}

/** Undoes the apostrophe the exporter adds in front of formula-looking text. */
function cell(value: string | undefined): string {
  const v = (value ?? '').trim();
  return /^'[=+\-@]/.test(v) ? v.slice(1) : v;
}

function parseDate(value: string): Date | null {
  const v = value.trim();
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(v);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    return null;
  }
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
    ? date
    : null;
}

/** Turns spreadsheet rows (first row = header) into validated tasks, or a list of line-numbered problems. */
export function parseTaskRows(
  rows: string[][],
  ctx: ImportContext,
): ImportResult {
  const errors: ImportError[] = [];
  const empty: ImportResult = { tasks: [], errors, promotedExistingIds: [] };
  if (rows.length === 0) {
    errors.push({ line: 1, message: 'Tệp trống' });
    return empty;
  }
  if (rows.length - 1 > MAX_IMPORT_ROWS) {
    errors.push({
      line: 1,
      message: `Tối đa ${MAX_IMPORT_ROWS} dòng mỗi lần nhập`,
    });
    return empty;
  }

  const header = rows[0]!.map((h) => fold(cell(h)));
  const col = (name: keyof typeof COLUMN_ALIASES) =>
    header.findIndex((h) => COLUMN_ALIASES[name]!.includes(h));
  const idx = Object.fromEntries(
    Object.keys(COLUMN_ALIASES).map((k) => [k, col(k)]),
  ) as Record<string, number>;
  if (idx.title! < 0) {
    errors.push({ line: 1, message: 'Thiếu cột "title" (tên công việc)' });
    return empty;
  }
  const get = (row: string[], name: string) =>
    idx[name]! >= 0 ? cell(row[idx[name]!]) : '';

  const tasks: ImportTask[] = [];
  const seenRefs = new Map<string, number>();

  rows.slice(1).forEach((row, i) => {
    const line = i + 2;
    const fail = (message: string) => errors.push({ line, message });

    const title = get(row, 'title');
    if (!title) return fail('Thiếu tên công việc');
    if (title.length > 300)
      return fail('Tên công việc quá dài (tối đa 300 ký tự)');

    const ref = get(row, 'ref') || null;
    if (ref) {
      const first = seenRefs.get(ref);
      if (first !== undefined)
        return fail(`Mã "${ref}" trùng với dòng ${first}`);
      seenRefs.set(ref, line);
    }

    const rawType = get(row, 'type');
    const nodeType = rawType ? TYPE_MAP.get(fold(rawType)) : 'ACTIVITY';
    if (!nodeType)
      return fail(
        `Cấp WBS "${rawType}" không hợp lệ (Giai đoạn, Giao phẩm, Gói công việc, Hoạt động)`,
      );

    const rawStatus = get(row, 'status');
    const status = rawStatus ? STATUS_MAP.get(fold(rawStatus)) : 'TODO';
    if (!status) return fail(`Trạng thái "${rawStatus}" không hợp lệ`);

    const rawPriority = get(row, 'priority');
    const priority = rawPriority
      ? PRIORITY_MAP.get(fold(rawPriority))
      : 'MEDIUM';
    if (!priority) return fail(`Độ ưu tiên "${rawPriority}" không hợp lệ`);

    const rawStart = get(row, 'start');
    const rawDue = get(row, 'due');
    const startDate = rawStart ? parseDate(rawStart) : null;
    const dueDate = rawDue ? parseDate(rawDue) : null;
    if (rawStart && !startDate)
      return fail(
        `Ngày bắt đầu "${rawStart}" không hợp lệ (dùng yyyy-mm-dd hoặc dd/mm/yyyy)`,
      );
    if (rawDue && !dueDate)
      return fail(
        `Ngày đến hạn "${rawDue}" không hợp lệ (dùng yyyy-mm-dd hoặc dd/mm/yyyy)`,
      );
    if (startDate && dueDate && startDate > dueDate)
      return fail('Ngày bắt đầu sau ngày đến hạn');

    const rawMilestone = get(row, 'milestone');
    const isMilestone = rawMilestone
      ? TRUE_WORDS.has(fold(rawMilestone)) ||
        TRUE_WORDS.has(rawMilestone.toLowerCase())
      : false;
    if (isMilestone && !dueDate)
      return fail('Mốc quan trọng cần có ngày đến hạn');

    const rawPercent = get(row, 'percent').replace('%', '');
    const percentComplete = rawPercent ? Number(rawPercent) : 0;
    if (
      rawPercent &&
      (!Number.isInteger(percentComplete) ||
        percentComplete < 0 ||
        percentComplete > 100)
    ) {
      return fail(
        `% hoàn thành "${rawPercent}" phải là số nguyên từ 0 đến 100`,
      );
    }
    const rawEstimate = get(row, 'estimate');
    const estimateHours = rawEstimate
      ? Number(rawEstimate.replace(',', '.'))
      : null;
    if (
      estimateHours !== null &&
      (!Number.isFinite(estimateHours) || estimateHours < 0)
    ) {
      return fail(`Giờ ước tính "${rawEstimate}" không hợp lệ`);
    }

    const emailToId = (email: string) =>
      ctx.members.get(email.trim().toLowerCase());
    const rawAssignee = get(row, 'assignee');
    let assigneeId: string | null = null;
    if (rawAssignee) {
      assigneeId = emailToId(rawAssignee) ?? null;
      if (!assigneeId)
        return fail(
          `Người phụ trách "${rawAssignee}" không phải thành viên của tổ chức`,
        );
    }
    const supporterIds: string[] = [];
    for (const email of get(row, 'supporters')
      .split(/[;|]/)
      .map((s) => s.trim())
      .filter(Boolean)) {
      const id = emailToId(email);
      if (!id)
        return fail(
          `Người hỗ trợ "${email}" không phải thành viên của tổ chức`,
        );
      if (id !== assigneeId && !supporterIds.includes(id))
        supporterIds.push(id);
    }

    tasks.push({
      line,
      ref,
      parentRef: get(row, 'parent') || null,
      parentExistingId: null,
      title,
      nodeType,
      status,
      priority,
      startDate: isMilestone ? dueDate : startDate,
      dueDate,
      percentComplete,
      estimateHours,
      isMilestone,
      assigneeId,
      supporterIds,
      description: get(row, 'description') || null,
    });
  });

  // ---- parents: a ref in this file, else an existing task key ------------------------------
  const byRef = new Map(
    tasks.filter((t) => t.ref).map((t) => [t.ref as string, t]),
  );
  const promoted = new Set<string>();
  const valid: ImportTask[] = [];
  for (const t of tasks) {
    if (!t.parentRef) {
      valid.push(t);
      continue;
    }
    if (byRef.has(t.parentRef)) {
      valid.push(t);
    } else {
      const existing = ctx.existing.get(t.parentRef.toUpperCase());
      if (!existing) {
        errors.push({
          line: t.line,
          message: `Không tìm thấy công việc cha "${t.parentRef}" (mã trong tệp hoặc mã công việc có sẵn)`,
        });
        continue;
      }
      t.parentExistingId = existing.id;
      valid.push(t);
    }
  }

  // ---- order parents before children, reject cycles ----------------------------------------
  const ordered: ImportTask[] = [];
  const state = new Map<ImportTask, 'visiting' | 'done'>();
  const visit = (t: ImportTask): boolean => {
    const s = state.get(t);
    if (s === 'done') return true;
    if (s === 'visiting') {
      errors.push({ line: t.line, message: 'Vòng lặp công việc cha–con' });
      return false;
    }
    state.set(t, 'visiting');
    const parent = t.parentRef ? byRef.get(t.parentRef) : undefined;
    if (parent && !valid.includes(parent)) {
      errors.push({
        line: t.line,
        message: `Công việc cha "${t.parentRef}" (dòng ${parent.line}) có lỗi`,
      });
      return false;
    }
    if (parent && !visit(parent)) return false;
    state.set(t, 'done');
    ordered.push(t);
    return true;
  };
  for (const t of valid) visit(t);

  // ---- WBS hierarchy: a child must sit below its parent ------------------------------------
  const typeOf = new Map<ImportTask, WbsNodeType>(
    ordered.map((t) => [t, t.nodeType]),
  );
  const finalTasks: ImportTask[] = [];
  const failed = new Set<ImportTask>();
  for (const t of ordered) {
    const parentInFile = t.parentRef ? byRef.get(t.parentRef) : undefined;
    if (parentInFile && failed.has(parentInFile)) {
      failed.add(t);
      errors.push({
        line: t.line,
        message: `Công việc cha "${t.parentRef}" (dòng ${parentInFile.line}) có lỗi`,
      });
      continue;
    }
    const parentType = parentInFile
      ? typeOf.get(parentInFile)
      : t.parentExistingId
        ? ctx.existing.get(t.parentRef!.toUpperCase())!.nodeType
        : undefined;
    if (parentType) {
      let effective = parentType;
      // Like adding a subtask in the app: an activity that gains a child becomes a work package.
      if (parentType === 'ACTIVITY') {
        effective = 'WORK_PACKAGE';
        if (parentInFile) typeOf.set(parentInFile, 'WORK_PACKAGE');
        else promoted.add(t.parentExistingId!);
      }
      if (!canContain(effective, t.nodeType)) {
        failed.add(t);
        errors.push({
          line: t.line,
          message: `"${rawLabel(t.nodeType)}" không thể nằm trong "${rawLabel(effective)}"`,
        });
        continue;
      }
    }
    finalTasks.push(t);
  }
  for (const t of finalTasks) t.nodeType = typeOf.get(t) ?? t.nodeType;

  errors.sort((a, b) => a.line - b.line);
  return {
    tasks: finalTasks,
    errors,
    promotedExistingIds: Array.from(promoted),
  };
}

const LABELS: Record<WbsNodeType, string> = {
  PHASE: 'Giai đoạn',
  DELIVERABLE: 'Giao phẩm',
  WORK_PACKAGE: 'Gói công việc',
  ACTIVITY: 'Hoạt động',
};
function rawLabel(type: WbsNodeType): string {
  return LABELS[type];
}
