#!/usr/bin/env node
// Creates the project that builds PMTool INSIDE PMTool (dogfooding), from its own git history: charter, scope, WBS with
// deliverables / work packages / activities (each finished task dated by the commit that finished it), four sprints with
// burndown and review, risks, stakeholders, documents and milestones.
//
//   node infra/dogfood/seed.mjs                  # add project PMT to organization "dgna" of grey@gmail.com
//   EMAIL=... ORG=... KEY=... node infra/dogfood/seed.mjs
//   node infra/dogfood/seed.mjs --reset          # delete the project this script made (only) and stop
//
// Dev database by default. It acts through the running API as the given user (a short-lived token signed with the dev JWT secret,
// no password needed), so history, activity and notifications are produced by the product itself; then it corrects timestamps
// (task completion, sprint start/close, daily snapshots) so the charts and reports show the real timeline.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHARTER, DOCUMENTS, MILESTONES, PHASES, RISKS, SCOPE, SPRINTS, STAKEHOLDERS, at, docUrl } from './pmtool-data.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const API = process.env.API ?? 'http://localhost:3001/api/v1';
const EMAIL = process.env.EMAIL ?? 'grey@gmail.com';
const ORG = process.env.ORG ?? 'dgna';
const KEY = process.env.KEY ?? 'PMT';
const MARK = '[dogfood-seed]';
// Defaults target the dev database. Another target (e.g. production) is chosen only through these variables:
//   PG_CONTAINER=pmtool-postgres-1 PG_DB=pmtool JWT_ENV_FILE=infra/.env.prod API=https://pm.dgna.vn/api/v1 EMAIL=... node infra/dogfood/seed.mjs
const PG_CONTAINER = process.env.PG_CONTAINER ?? 'infra-postgres-1';
const PG_USER = process.env.PG_USER ?? 'pmtool';
const PG_DB = process.env.PG_DB ?? 'pmtool_dev';
const JWT_ENV_FILE = path.resolve(ROOT, process.env.JWT_ENV_FILE ?? 'apps/api/.env');
const DOCKER_ENV = { ...process.env, PATH: `/Applications/Docker.app/Contents/Resources/bin:${process.env.PATH}` };

const psql = (sql) => execFileSync('docker', ['exec', PG_CONTAINER, 'psql', '-U', PG_USER, '-d', PG_DB, '-tA', '-v', 'ON_ERROR_STOP=1', '-c', sql], { env: DOCKER_ENV }).toString().trim();
const lit = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const ts = (d) => `'${d.toISOString()}'::timestamp`;
const day = (d) => new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 10); // Vietnam calendar day of an instant
const addDays = (key, n) => new Date(Date.parse(`${key}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

// ---- who we act as ------------------------------------------------------------------------------------------------
const userId = psql(`select id from users where email = ${lit(EMAIL)}`);
if (!userId) throw new Error(`No user ${EMAIL} in the target database.`);
const req = createRequire(path.join(ROOT, 'apps/api/package.json'));
const jwt = req(req.resolve('jsonwebtoken', { paths: [req.resolve('@nestjs/jwt')] }));
// .env values may be quoted; dotenv strips the quotes, so do the same.
const secret = /^JWT_ACCESS_SECRET=(.*)$/m
  .exec(readFileSync(JWT_ENV_FILE, 'utf8'))?.[1]
  ?.trim()
  .replace(/^(['"])(.*)\1$/, '$2');
if (!secret) throw new Error(`JWT_ACCESS_SECRET not found in ${JWT_ENV_FILE}`);
const token = jwt.sign({ sub: userId, email: EMAIL }, secret, { expiresIn: '1h' });

async function call(method, url, body, ok = [200, 201, 204]) {
  const res = await fetch(`${API}${url}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!ok.includes(res.status)) throw new Error(`${method} ${url} → ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text).data : null;
}

const orgRow = psql(`select id from organizations where slug = ${lit(ORG)}`);
if (!orgRow) throw new Error(`No organization ${ORG}.`);
const projectRow = psql(`select id, description from projects where "organizationId" = ${lit(orgRow)} and key = ${lit(KEY)}`);

if (process.argv.includes('--reset')) {
  if (!projectRow) {
    console.log('Nothing to reset.');
    process.exit(0);
  }
  const [pid, desc] = projectRow.split('|');
  if (!desc?.includes(MARK)) throw new Error(`Project ${KEY} was not created by this script; refusing to delete it.`);
  psql(`begin; delete from entity_history where "projectId" = ${lit(pid)}; delete from activity_logs where "projectId" = ${lit(pid)}; delete from notifications where "projectKey" = ${lit(KEY)} and "organizationId" = ${lit(orgRow)}; delete from projects where id = ${lit(pid)}; commit;`);
  console.log(`Deleted project ${KEY} (${pid}).`);
  process.exit(0);
}
if (projectRow) throw new Error(`Project ${KEY} already exists in ${ORG}. Use --reset to remove the one this script made.`);

const commitsPerDay = {};
for (const l of execFileSync('git', ['log', '--format=%ad', '--date=format:%m-%d'], { cwd: ROOT }).toString().trim().split('\n')) commitsPerDay[l] = (commitsPerDay[l] ?? 0) + 1;

// ---- 1. project, charter, scope ------------------------------------------------------------------------------------
console.log('Project, charter and scope…');
const org = `/organizations/${ORG}`;
const project = await call('POST', `${org}/projects`, {
  key: KEY,
  name: 'PMTool — nền tảng quản lý dự án PMBOK',
  description: `${MARK} Dự án xây dựng chính PMTool, quản lý bằng PMTool. Dữ liệu dựng từ lịch sử git thật (85 commit, 14–21/9/2026).`,
  startDate: at('09-14').toISOString(),
  targetEndDate: at('09-28', '17:00').toISOString(),
});
const P = `${org}/projects/${KEY}`;
await call('PATCH', P, { status: 'ACTIVE', sprintsEnabled: true });
await call('PUT', `${P}/charter`, { ...CHARTER, projectManagerId: userId });
await call('POST', `${P}/charter/approve`);
await call('PUT', `${P}/scope`, SCOPE);
await call('POST', `${P}/scope/approve`);

// ---- 2. sprints ----------------------------------------------------------------------------------------------------
console.log('Sprints…');
const sprints = [];
for (const s of SPRINTS) {
  const created = await call('POST', `${P}/sprints`, { name: s.name, goal: s.goal, startDate: at(s.start).toISOString(), endDate: at(s.end).toISOString() });
  sprints.push({ ...s, id: created.id });
}
const sprintOfDone = (d) => {
  const k = day(d);
  const md = k.slice(5);
  if (md <= '09-16') return 1;
  if (md <= '09-19') return 2;
  return 3;
};

// ---- 3. WBS --------------------------------------------------------------------------------------------------------
console.log('WBS…');
/** Every node created, with what the fix-ups later need. */
const nodes = [];
const leaves = []; // activities
const iso = (d) => d.toISOString();
const startFor = (a) => {
  if (a.done) {
    const dk = day(a.done);
    const s = at(addDays(dk, a.sp >= 5 ? -1 : 0).slice(5), '09:00');
    return s < at('09-14', '09:00') ? at('09-14', '09:00') : s;
  }
  return at('09-22', '09:00');
};
const dueFor = (a) => (a.done ? at(day(a.done).slice(5), '23:00') : a.sprint === 4 ? at('09-27', '17:00') : null);

async function createNode(parent, fields) {
  const t = await call('POST', `${P}/tasks`, { assigneeId: userId, ...(parent ? { parentTaskId: parent.id } : {}), ...fields });
  return t;
}

const byKey = new Map();
for (const ph of PHASES) {
  const acts = ph.deliverables.flatMap((d) => d.items);
  const doneAll = acts.every((a) => a.done);
  const starts = acts.map(startFor);
  const dues = acts.map(dueFor).filter(Boolean);
  const phaseNode = await createNode(null, { title: ph.title, nodeType: 'PHASE', startDate: iso(new Date(Math.min(...starts))), ...(dues.length ? { dueDate: iso(new Date(Math.max(...dues))) } : {}) });
  const phaseRec = { id: phaseNode.id, kind: 'PHASE', title: ph.title, children: [], done: doneAll };
  nodes.push(phaseRec);

  for (const d of ph.deliverables) {
    const dStarts = d.items.map(startFor);
    const dDues = d.items.map(dueFor).filter(Boolean);
    const dNode = await createNode(phaseNode, {
      title: d.title,
      nodeType: 'DELIVERABLE',
      startDate: iso(new Date(Math.min(...dStarts))),
      ...(dDues.length ? { dueDate: iso(new Date(Math.max(...dDues))) } : {}),
    });
    const dRec = { id: dNode.id, kind: 'DELIVERABLE', title: d.title, criteria: d.criteria, children: [], done: d.items.every((a) => a.done), spec: d, phase: phaseRec };
    phaseRec.children.push(dRec);
    nodes.push(dRec);

    for (const [wpTitle, isFix] of [['Phát triển', false], ['Sửa lỗi và hoàn thiện', true]]) {
      const items = d.items.filter((a) => Boolean(a.fix) === isFix);
      if (items.length === 0) continue;
      const wStarts = items.map(startFor);
      const wDues = items.map(dueFor).filter(Boolean);
      const wNode = await createNode(dNode, {
        title: `${wpTitle}: ${d.title}`,
        nodeType: 'WORK_PACKAGE',
        startDate: iso(new Date(Math.min(...wStarts))),
        ...(wDues.length ? { dueDate: iso(new Date(Math.max(...wDues))) } : {}),
      });
      const wRec = { id: wNode.id, kind: 'WORK_PACKAGE', title: wNode.title, children: [], done: items.every((a) => a.done) };
      dRec.children.push(wRec);
      nodes.push(wRec);
      for (const a of items) {
        const node = await createNode(wNode, {
          title: a.title,
          nodeType: 'ACTIVITY',
          storyPoints: a.sp,
          priority: a.priority ?? (a.fix ? 'HIGH' : 'MEDIUM'),
          startDate: iso(startFor(a)),
          ...(dueFor(a) ? { dueDate: iso(dueFor(a)) } : {}),
        });
        const rec = { id: node.id, kind: 'ACTIVITY', title: a.title, done: a.done, sp: a.sp, fix: Boolean(a.fix), sprint: a.done ? sprintOfDone(a.done) : (a.sprint ?? null), spec: a, parent: wRec, deliverable: dRec, phase: phaseRec };
        wRec.children.push(rec);
        leaves.push(rec);
        nodes.push(rec);
        if (a.key) byKey.set(a.key, rec);
      }
    }
  }
}

// Milestones, each closing a phase.
const milestoneOf = [0, 1, 3, 4, 8].map((i) => nodes.filter((n) => n.kind === 'PHASE')[i]);
const milestones = [];
for (const [i, m] of MILESTONES.entries()) {
  const when = at(m.day.slice(0, 5), m.day.slice(6));
  const node = await createNode(milestoneOf[i], { title: m.title, nodeType: 'ACTIVITY', isMilestone: true, dueDate: iso(when), priority: 'HIGH' });
  const rec = { id: node.id, kind: 'MILESTONE', title: m.title, done: m.done ? when : null, when };
  milestones.push(rec);
  nodes.push(rec);
}

// Dependencies within the deployment work.
for (const rec of leaves) {
  if (rec.spec.after) await call('POST', `${P}/dependencies`, { predecessorId: byKey.get(rec.spec.after).id, successorId: rec.id });
}

// ---- 4. sprints run, in order --------------------------------------------------------------------------------------
console.log('Running the sprints…');
const setDone = (id, pct = 100) => call('PATCH', `${P}/tasks/${id}`, { status: 'DONE', percentComplete: pct });
for (const [idx, s] of sprints.entries()) {
  const mine = leaves.filter((l) => l.sprint === s.n);
  // Planned work goes in before the sprint starts; the repairs that turned up are added afterwards.
  for (const l of mine.filter((l) => !l.fix)) await call('PATCH', `${P}/tasks/${l.id}`, { sprintId: s.id });
  await call('POST', `${P}/sprints/${s.id}/start`);
  for (const l of mine.filter((l) => l.fix)) await call('PATCH', `${P}/tasks/${l.id}`, { sprintId: s.id });
  s.tasks = mine;
  if (s.n === 4) {
    for (const l of mine) {
      if (l.spec.status && l.spec.status !== 'TODO') await call('PATCH', `${P}/tasks/${l.id}`, { status: l.spec.status, percentComplete: l.spec.pct ?? 0 });
    }
    continue; // still running
  }
  for (const l of mine) await setDone(l.id);
  await call('POST', `${P}/sprints/${s.id}/close`, { moveUnfinishedTo: null });
  await call('PUT', `${P}/sprints/${s.id}/review`, { reviewNotes: s.notes, goalResult: s.goalResult });
}

// ---- 5. structure nodes and milestones follow their children --------------------------------------------------------
const allDone = (n) => (n.kind === 'ACTIVITY' ? Boolean(n.done) : n.children.every(allDone));
const maxDone = (n) => (n.kind === 'ACTIVITY' ? n.done : new Date(Math.max(...n.children.map(maxDone))));
const leavesOf = (n) => (n.kind === 'ACTIVITY' ? [n] : n.children.flatMap(leavesOf));
for (const n of nodes.filter((n) => n.kind === 'WORK_PACKAGE' || n.kind === 'DELIVERABLE' || n.kind === 'PHASE')) {
  n.doneAt = allDone(n) ? maxDone(n) : null;
  if (n.doneAt) {
    await setDone(n.id);
  } else {
    const all = leavesOf(n);
    const pct = Math.round((100 * all.filter((l) => l.done).length) / all.length);
    if (pct > 0) await call('PATCH', `${P}/tasks/${n.id}`, { status: 'IN_PROGRESS', percentComplete: pct });
  }
}
for (const m of milestones) if (m.done) await setDone(m.id);

// ---- 6. deliverables (sign-off), dictionary, risks, stakeholders, documents ----------------------------------------------
console.log('Deliverables, risks, stakeholders, documents…');
const deliverables = [];
for (const d of nodes.filter((n) => n.kind === 'DELIVERABLE')) {
  const created = await call('POST', `${P}/deliverables`, { name: d.title, acceptanceCriteria: d.criteria, taskId: d.id, ownerId: userId, ...(d.doneAt ? { dueDate: iso(d.doneAt) } : {}) });
  const rec = { id: created.id, node: d, accepted: Boolean(d.doneAt), doneAt: d.doneAt };
  if (d.doneAt) {
    await call('POST', `${P}/deliverables/${created.id}/submit`);
    await call('POST', `${P}/deliverables/${created.id}/accept`);
  } else if (d.spec.status === 'IN_PROGRESS') {
    await call('PATCH', `${P}/deliverables/${created.id}`, { status: 'IN_PROGRESS' }).catch(() => {});
  }
  deliverables.push(rec);
}

const dict = (title, body) => call('PUT', `${P}/wbs/${nodes.find((n) => n.title === title).id}/dictionary`, body);
await dict('Khung phạm vi PMBOK', {
  scopeDescription: 'Cho người dùng dựng WBS đúng chuẩn PMBOK: Giai đoạn → Giao phẩm → Gói công việc → Hoạt động, có từ điển WBS cho từng phần tử, phát biểu phạm vi và sơ đồ liên kết trên dashboard.',
  acceptanceCriteria: 'Quy tắc phân cấp được áp dụng ở API và giao diện; mã WBS tự sinh theo thứ tự; sơ đồ hiện các cảnh báo độ phủ.',
  requiredResources: '1 nhà phát triển, trợ lý AI',
  technicalReferences: 'docs/kien-truc.md §1.4',
  costEstimate: 0,
});
await dict('Hệ thống chạy thật cho nhóm dùng thử kín', {
  scopeDescription: 'Đưa PMTool lên Mac mini qua Cloudflare Tunnel tại pm.dgna.vn, có sao lưu hằng đêm chép ra ngoài máy, email và đăng nhập Google, điều khoản đã rà soát, giám sát bên ngoài.',
  acceptanceCriteria: 'health/ready ok qua HTTPS; diễn tập khôi phục khớp số dòng; khởi động lại máy trang tự lên lại; người dùng thử đăng ký, đặt lại mật khẩu, đăng nhập Google được.',
  assumptions: 'Cloudflare và gói miễn phí đủ dùng; có nguồn lưu trữ ngoài (Google Drive/B2).',
  constraints: 'Máy chủ đặt tại nhà: phụ thuộc điện và mạng.',
  requiredResources: 'Mac mini M4, tài khoản Cloudflare, SMTP miễn phí, kho lưu trữ ngoài',
  technicalReferences: 'docs/trien-khai-mac-mini.md, docs/van-hanh.md',
  costEstimate: 0,
});
await dict('Vá bảo mật thư viện', {
  scopeDescription: 'Giảm cảnh báo pnpm audit --prod từ 52 xuống mức chấp nhận được trước khi mở công khai.',
  acceptanceCriteria: 'Không còn cảnh báo cao/nghiêm trọng; toàn bộ test vẫn xanh.',
  technicalReferences: 'docs/van-hanh.md §7.1',
});

// Every work package gets its dictionary entry, so the coverage check starts clean.
for (const wp of nodes.filter((n) => n.kind === 'WORK_PACKAGE')) {
  const parentDeliverable = nodes.find((n) => n.kind === 'DELIVERABLE' && n.children.includes(wp));
  const titles = wp.children.map((c) => c.title);
  await call('PUT', `${P}/wbs/${wp.id}/dictionary`, {
    scopeDescription: `Thực hiện: ${titles.join('; ')}.`.slice(0, 1900),
    acceptanceCriteria: parentDeliverable?.criteria,
    requiredResources: '1 nhà phát triển, trợ lý AI',
    qualityRequirements: 'Kiểm thử đầy đủ (unit, tích hợp, E2E) trước khi đẩy; tài liệu cập nhật.',
    costEstimate: 0,
  });
}

const riskRows = [];
for (const r of RISKS) {
  const created = await call('POST', `${P}/risks`, { type: r.type, title: r.title, description: r.d, probability: r.p, impact: r.i, ownerId: userId, ...(r.due ? { dueDate: iso(at(r.due.slice(0, 5), r.due.slice(6))) } : {}) });
  if (r.status !== 'IDENTIFIED') await call('PATCH', `${P}/risks/${created.id}`, { status: r.status });
  riskRows.push({ id: created.id, ...r });
}
for (const s of STAKEHOLDERS) await call('POST', `${P}/stakeholders`, s);
for (const d of DOCUMENTS) await call('POST', `${P}/documents`, { title: d.title, category: d.category, version: d.version, status: d.status, url: docUrl(d.path), description: d.d, ownerId: userId });

// ---- 7. put the real timeline on everything ------------------------------------------------------------------------------
console.log('Setting timestamps from the git history…');
const stmts = [];
const nodeCreated = (n) => (n.kind === 'ACTIVITY' ? startFor(n.spec) : n.kind === 'MILESTONE' ? at('09-14', '09:00') : new Date(Math.min(...n.children.map(nodeCreated))));
for (const n of nodes) {
  const created = nodeCreated(n);
  const doneAt = n.kind === 'ACTIVITY' ? n.done : n.kind === 'MILESTONE' ? n.done : n.doneAt;
  stmts.push(`update tasks set "createdAt" = ${ts(created)}, "completedAt" = ${doneAt ? ts(doneAt) : 'NULL'}, "updatedAt" = ${ts(doneAt ?? created)} where id = ${lit(n.id)}`);
}
stmts.push(`update projects set "createdAt" = ${ts(at('09-14', '21:31'))} where key = ${lit(KEY)} and "organizationId" = ${lit(orgRow)}`);

// Sprints: real start/close, work joined before the start unless it was a repair found during the sprint.
const sprintById = new Map();
for (const s of sprints) {
  const startedAt = at(s.start, '00:30');
  const closedAt = s.n < 4 ? at(s.end, '23:30') : null;
  const planned = s.tasks.filter((l) => !l.fix);
  const committed = planned.reduce((n, l) => n + l.sp, 0);
  const completed = s.n < 4 ? s.tasks.reduce((n, l) => n + l.sp, 0) : null;
  stmts.push(`update sprints set "startedAt" = ${ts(startedAt)}, "closedAt" = ${closedAt ? ts(closedAt) : 'NULL'}, "committedLoad" = ${committed}, "completedLoad" = ${completed ?? 'NULL'}, "updatedAt" = ${ts(closedAt ?? startedAt)}, "createdAt" = ${ts(at(s.start, '00:00'))} where id = ${lit(s.id)}`);
  for (const l of s.tasks) {
    const added = l.fix ? new Date(Math.max(startedAt.getTime() + 3_600_000, (l.done ?? startedAt).getTime() - 3_600_000)) : new Date(startedAt.getTime() - 3_600_000);
    stmts.push(`update tasks set "sprintAddedAt" = ${ts(added)} where id = ${lit(l.id)}`);
  }
  sprintById.set(s.n, { ...s, startedAt, closedAt, committed });
}

// Burndown: the state of each sprint at the end of every day.
for (const s of sprints.filter((x) => x.n < 4)) {
  stmts.push(`delete from sprint_daily_snapshots where "sprintId" = ${lit(s.id)}`);
  const last = closedAtKey(s);
  for (let k = s.start; ; k = addDays(`2026-${k}`, 1).slice(5)) {
    const endOfDay = at(k, '23:59');
    const inSprint = s.tasks.filter((l) => !l.fix || (l.done && l.done <= endOfDay));
    const planned = inSprint.reduce((n, l) => n + l.sp, 0);
    const done = inSprint.filter((l) => l.done && l.done <= endOfDay).reduce((n, l) => n + l.sp, 0);
    stmts.push(`insert into sprint_daily_snapshots (id, "organizationId", "sprintId", date, planned, done, "taskCount", "doneCount", "generatedAt") values (gen_random_uuid()::text, ${lit(orgRow)}, ${lit(s.id)}, '2026-${k}', ${planned}, ${done}, ${inSprint.length}, ${inSprint.filter((l) => l.done && l.done <= endOfDay).length}, ${ts(endOfDay)})`);
    if (k === last) break;
  }
}
function closedAtKey(s) {
  return s.end;
}

// Deliverable sign-off dates, risk creation dates.
for (const d of deliverables) {
  if (d.accepted) stmts.push(`update deliverables set "createdAt" = ${ts(nodeCreated(d.node))}, "submittedAt" = ${ts(d.doneAt)}, "reviewedAt" = ${ts(new Date(d.doneAt.getTime() + 600_000))}, "updatedAt" = ${ts(d.doneAt)} where id = ${lit(d.id)}`);
  else stmts.push(`update deliverables set "createdAt" = ${ts(nodeCreated(d.node))} where id = ${lit(d.id)}`);
}
for (const r of riskRows) {
  const created = at(r.created.slice(0, 5), r.created.slice(6));
  const updated = r.status === 'RESOLVED' && r.due ? at(r.due.slice(0, 5), r.due.slice(6)) : created;
  stmts.push(`update risk_issues set "createdAt" = ${ts(created)}, "updatedAt" = ${ts(updated)} where id = ${lit(r.id)}`);
}

// Daily project snapshots for the days before today, so the daily report can compare them.
const today = day(new Date());
stmts.push(`delete from project_daily_snapshots where "projectId" = (select id from projects where key = ${lit(KEY)} and "organizationId" = ${lit(orgRow)})`);
for (let k = '09-14'; `2026-${k}` < today; k = addDays(`2026-${k}`, 1).slice(5)) {
  const end = at(k, '23:59');
  const existing = nodes.filter((n) => nodeCreated(n) <= end);
  const doneBy = (n) => {
    const d = n.kind === 'ACTIVITY' || n.kind === 'MILESTONE' ? n.done : n.doneAt;
    return d && d <= end;
  };
  const done = existing.filter(doneBy).length;
  const createdToday = existing.filter((n) => day(nodeCreated(n)) === `2026-${k}`).length;
  const completedToday = existing.filter((n) => doneBy(n) && day(n.kind === 'ACTIVITY' || n.kind === 'MILESTONE' ? n.done : n.doneAt) === `2026-${k}`).length;
  const delivs = deliverables.filter((d) => nodeCreated(d.node) <= end);
  const acceptedBy = delivs.filter((d) => d.accepted && d.doneAt <= end).length;
  const openRisks = riskRows.filter((r) => r.type === 'RISK' && at(r.created.slice(0, 5), r.created.slice(6)) <= end && !(r.status === 'RESOLVED' && r.due && at(r.due.slice(0, 5), r.due.slice(6)) <= end)).length;
  const openIssues = riskRows.filter((r) => r.type === 'ISSUE' && at(r.created.slice(0, 5), r.created.slice(6)) <= end && !(r.status === 'RESOLVED' && r.due && at(r.due.slice(0, 5), r.due.slice(6)) <= end)).length;
  const sp = [...sprintById.values()].find((s) => s.start <= k && k <= s.end && s.n < 4);
  const spInSprint = sp ? sp.tasks.filter((l) => !l.fix || (l.done && l.done <= end)) : [];
  stmts.push(
    `insert into project_daily_snapshots (id, "organizationId", "projectId", date, "tasksTotal", todo, "inProgress", "inReview", done, blocked, overdue, "progressPct", "createdCount", "completedCount", "openRisks", "openIssues", "deliverablesTotal", "deliverablesAccepted", "milestonesTotal", "milestonesDone", "sprintPlanned", "sprintDone", "activityCount", "activeUsers", "generatedAt") values (gen_random_uuid()::text, ${lit(orgRow)}, (select id from projects where key = ${lit(KEY)} and "organizationId" = ${lit(orgRow)}), '2026-${k}', ${existing.length}, ${existing.length - done}, 0, 0, ${done}, 0, 0, ${existing.length === 0 ? 0 : Math.round((done / existing.length) * 1000) / 10}, ${createdToday}, ${completedToday}, ${openRisks}, ${openIssues}, ${delivs.length}, ${acceptedBy}, ${milestones.length}, ${milestones.filter((m) => m.done && m.done <= end).length}, ${sp ? spInSprint.reduce((n, l) => n + l.sp, 0) : 'NULL'}, ${sp ? spInSprint.filter((l) => l.done && l.done <= end).reduce((n, l) => n + l.sp, 0) : 'NULL'}, ${commitsPerDay[k] ?? 0}, 1, ${ts(end)})`,
  );
}

psql(`begin; ${stmts.join('; ')}; commit;`);

// ---- 8. verify -------------------------------------------------------------------------------------------------------------
const count = (t, col = '"projectId"') => psql(`select count(*) from ${t} where ${col} = (select id from projects where key = ${lit(KEY)} and "organizationId" = ${lit(orgRow)})`);
console.log(`\nDone. Project ${KEY} in ${ORG}:`);
console.log(`  tasks ${count('tasks')} (activities ${leaves.length}, done ${leaves.filter((l) => l.done).length}) · sprints ${count('sprints')} · deliverables ${count('deliverables')} · risks ${count('risk_issues')} · stakeholders ${count('stakeholders')} · documents ${count('project_documents')}`);
console.log(`  open in the app:  /vi/${ORG}/projects/${KEY}/dashboard`);
