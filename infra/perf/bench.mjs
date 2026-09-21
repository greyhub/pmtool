#!/usr/bin/env node
// Local performance benchmark: builds one large project in the DEV database (2,500 tasks with parents, assignees,
// dependencies, comments, risks, deliverables, activity) and times the main API calls against it.
//   node infra/perf/bench.mjs            # seed + measure (creates a fresh throw-away org each run)
// Needs the API on :3001 and the dev Postgres container (infra-postgres-1). Never point it at real data.
import { execFileSync } from 'node:child_process';

const API = process.env.API ?? 'http://localhost:3001/api/v1';
const TASKS = Number(process.env.TASKS ?? 2500);
const RUNS = Number(process.env.RUNS ?? 7);
const env = { ...process.env, PATH: `/Applications/Docker.app/Contents/Resources/bin:${process.env.PATH}` };
const psql = (sql) => execFileSync('docker', ['exec', 'infra-postgres-1', 'psql', '-U', 'pmtool', '-d', 'pmtool_dev', '-tA', '-c', sql], { env }).toString().trim();
const call = async (method, path, token, body) => {
  const res = await fetch(`${API}${path}`, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  return { status: res.status, bytes: text.length, json: text ? JSON.parse(text) : null };
};

const email = `bench${Date.now()}@example.com`;
const reg = await call('POST', '/auth/register', null, { email, password: 'Password123', fullName: 'Bench User' });
const token = reg.json.data.accessToken;
const slug = `bench-${Date.now()}`;
const org = (await call('POST', '/organizations', token, { name: 'Bench Org', slug })).json.data;
const project = (await call('POST', `/organizations/${slug}/projects`, token, { key: 'BIG', name: 'Big project' })).json.data;
const userId = psql(`select id from users where email='${email}'`);
const col = psql(`select id from board_columns where "projectId"='${project.id}' order by "orderIndex" limit 1`);
const P = `'${project.id}'`, O = `'${org.id}'`, U = `'${userId}'`;

console.log(`seeding ${TASKS} tasks…`);
psql(`
insert into tasks (id,"organizationId","projectId","humanKey","parentTaskId",title,"nodeType",status,priority,"percentComplete","orderIndex","boardColumnId","createdById","startDate","dueDate","estimateHours","storyPoints","createdAt","updatedAt","completedAt")
select 'bt'||g, ${O}, ${P}, 'BIG-'||g,
  case when g<=5 then null when g<=55 then 'bt'||(1+(g-6)%5) else 'bt'||(6+(g-56)%50) end,
  'Task '||g||' '||md5(g::text),
  (case when g<=5 then 'PHASE' when g<=55 then 'WORK_PACKAGE' else 'ACTIVITY' end)::"WbsNodeType",
  (array['TODO','IN_PROGRESS','IN_REVIEW','DONE','BLOCKED'])[1+g%5]::"TaskStatus",
  (array['LOW','MEDIUM','HIGH','CRITICAL'])[1+g%4]::"TaskPriority",
  (g*7)%101, g, '${col}', ${U},
  now() - ((g%90)||' days')::interval, now() + (((g%60)-20)||' days')::interval, (g%16), (g%13),
  now() - ((g%120)||' days')::interval, now(), case when g%5=3 then now() - ((g%30)||' days')::interval end
from generate_series(1,${TASKS}) g;
insert into task_assignees ("organizationId","taskId","userId",role) select ${O}, 'bt'||g, ${U}, 'PRIMARY' from generate_series(1,${TASKS}) g;
insert into task_dependencies (id,"organizationId","predecessorId","successorId") select 'bd'||g, ${O}, 'bt'||(g+60), 'bt'||(g+61) from generate_series(1,600) g;
insert into comments (id,"organizationId","taskId","authorId",body) select 'bc'||g, ${O}, 'bt'||(1+g%${TASKS}), ${U}, '{"type":"doc","content":[]}'::jsonb from generate_series(1,1500) g;
insert into risk_issues (id,"organizationId","projectId",type,title,"createdById",probability,impact,"severityScore","updatedAt") select 'br'||g, ${O}, ${P}, (case when g%4=0 then 'ISSUE' else 'RISK' end)::"RiskIssueType", 'Risk '||g, ${U}, 3,3,9, now() from generate_series(1,250) g;
insert into deliverables (id,"organizationId","projectId",name,"createdById","updatedAt") select 'bl'||g, ${O}, ${P}, 'Deliverable '||g, ${U}, now() from generate_series(1,120) g;
insert into activity_logs (id,"organizationId","actorId","entityType","entityId",action,"projectId","createdAt") select 'ba'||g, ${O}, ${U}, 'Task', 'bt'||(1+g%${TASKS}), 'updated', ${P}, now() - ((g%14)||' days')::interval - ((g%1440)||' minutes')::interval from generate_series(1,4000) g;
update projects set "taskSequence" = ${TASKS} where id = ${P};
analyze;
`);
const taskId = 'bt' + Math.floor(TASKS / 2);

const B = `/organizations/${slug}/projects/BIG`;
const endpoints = [
  ['projects list', `/organizations/${slug}/projects`],
  ['tasks list (all)', `${B}/tasks`],
  ['task detail', `${B}/tasks/${taskId}`],
  ['task history', `${B}/tasks/${taskId}/history`],
  ['task comments', `${B}/tasks/${taskId}/comments`],
  ['dependencies', `${B}/dependencies`],
  ['project dashboard', `${B}/dashboard`],
  ['org dashboard', `/organizations/${slug}/dashboard`],
  ['scope map', `${B}/scope-map`],
  ['daily report', `${B}/reports/daily`],
  ['risks', `${B}/risks`],
  ['deliverables', `${B}/deliverables`],
  ['milestones', `${B}/milestones`],
  ['board columns', `${B}/board-columns`],
  ['my tasks', `/organizations/${slug}/my-tasks`],
  ['activity feed', `/organizations/${slug}/activity`],
  ['members', `/organizations/${slug}/members`],
  ['csv export', `${B}/task-csv/export`],
];
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
console.log(`\n${'endpoint'.padEnd(20)} ${'status'.padEnd(6)} ${'median ms'.padStart(9)} ${'max ms'.padStart(7)} ${'KB'.padStart(7)}`);
const results = [];
for (const [name, path] of endpoints) {
  const times = [];
  let last;
  for (let i = 0; i < RUNS; i++) {
    const t = performance.now();
    last = await call('GET', path, token);
    times.push(performance.now() - t);
  }
  results.push({ name, status: last.status, median: median(times), max: Math.max(...times), kb: last.bytes / 1024 });
  console.log(`${name.padEnd(20)} ${String(last.status).padEnd(6)} ${median(times).toFixed(0).padStart(9)} ${Math.max(...times).toFixed(0).padStart(7)} ${(last.bytes / 1024).toFixed(0).padStart(7)}`);
}
console.log(`\n(org ${slug}; ${TASKS} tasks) — delete it from the dev DB when done.`);
if (process.env.JSON) console.log(JSON.stringify(results));
