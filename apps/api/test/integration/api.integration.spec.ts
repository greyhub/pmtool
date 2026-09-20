import path from 'node:path';
import { execSync } from 'node:child_process';
import { INestApplication, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { hashLinkCode } from '../../src/modules/telegram/link-code.util';

/**
 * Full-stack integration tests against a real, ephemeral Postgres
 * (Testcontainers) and the actual Nest HTTP pipeline — guards, the
 * tenant-scoping Prisma extension, and the AsyncLocalStorage request
 * context included. Unit tests already cover business-logic edge cases
 * (cycle detection, severity scoring, ...) with a mocked Prisma; this
 * suite instead proves the two invariants that only show up when the
 * whole stack is wired together: cross-tenant isolation and RBAC.
 */
let container: StartedPostgreSqlContainer;
let app: INestApplication;

const API_PREFIX = '/api/v1';

function uniqueSuffix(): string {
  return Math.random().toString(36).slice(2, 10);
}

async function registerUser(
  fullName: string,
): Promise<{ accessToken: string; email: string }> {
  const email = `${uniqueSuffix()}@example.com`;
  const res = await request(app.getHttpServer())
    .post(`${API_PREFIX}/auth/register`)
    .send({ email, password: 'Password123', fullName })
    .expect(201);
  return { accessToken: res.body.data.accessToken, email };
}

async function createOrg(
  accessToken: string,
  name: string,
): Promise<{ id: string; slug: string }> {
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${uniqueSuffix()}`;
  const res = await request(app.getHttpServer())
    .post(`${API_PREFIX}/organizations`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ name, slug })
    .expect(201);
  return res.body.data;
}

async function createProject(
  accessToken: string,
  orgSlug: string,
  key: string,
): Promise<{ id: string; key: string }> {
  const res = await request(app.getHttpServer())
    .post(`${API_PREFIX}/organizations/${orgSlug}/projects`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ key, name: `${key} Project` })
    .expect(201);
  return res.body.data;
}

/** Invites a fresh user into `orgSlug` with `role` and has them accept — used to get a real, non-OWNER role for RBAC tests. */
async function inviteAndAccept(
  inviterAccessToken: string,
  orgSlug: string,
  role: 'ADMIN' | 'PM' | 'MEMBER' | 'VIEWER',
  fullName: string,
): Promise<{ accessToken: string; email: string }> {
  const invitee = await registerUser(fullName);
  const invite = await request(app.getHttpServer())
    .post(`${API_PREFIX}/organizations/${orgSlug}/invites`)
    .set('Authorization', `Bearer ${inviterAccessToken}`)
    .send({ email: invitee.email, role })
    .expect(201);
  await request(app.getHttpServer())
    .post(`${API_PREFIX}/invites/accept`)
    .set('Authorization', `Bearer ${invitee.accessToken}`)
    .send({ token: invite.body.data.rawToken })
    .expect(200);
  return invitee;
}

/** Looks up a registered user's id by email — used to build ProjectMember payloads in tests. */
async function getUserId(email: string): Promise<string> {
  const prisma = app.get(PrismaService);
  const user = await prisma.db.user.findUniqueOrThrow({ where: { email } });
  return user.id;
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();

  process.env.DATABASE_URL = container.getConnectionUri();
  process.env.REDIS_URL = 'redis://localhost:6379'; // not connected to in Phase 1
  process.env.JWT_ACCESS_SECRET =
    'integration-test-access-secret-at-least-32-chars';
  process.env.JWT_REFRESH_SECRET =
    'integration-test-refresh-secret-at-least-32-chars';
  process.env.CORS_ORIGIN = 'http://localhost:3000';
  process.env.NODE_ENV = 'test';
  process.env.TELEGRAM_WEBHOOK_SECRET = 'integration-test-webhook-secret';
  // TELEGRAM_BOT_TOKEN is deliberately left unset: it disables the
  // real Telegram HTTP calls (webhook registration on boot, and the
  // link-code endpoint, which needs a live getMe call) — those aren't
  // reachable from this sandboxed environment. The webhook secret check
  // and code-consumption logic below don't depend on the bot token.

  execSync('pnpm exec prisma migrate deploy', {
    cwd: path.resolve(__dirname, '../..'),
    env: process.env,
    stdio: 'inherit',
  });

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  await app.init();
}, 120_000);

afterAll(async () => {
  await app?.close();
  await container?.stop();
});

describe('Auth flow', () => {
  it('registers, then authenticates subsequent requests with the access token', async () => {
    const { accessToken, email } = await registerUser('Auth Flow Tester');

    const me = await request(app.getHttpServer())
      .get(`${API_PREFIX}/auth/me`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(me.body.data.email).toBe(email);
  });

  it('rejects requests with no access token', async () => {
    await request(app.getHttpServer()).get(`${API_PREFIX}/auth/me`).expect(401);
  });
});

describe('Tenant isolation', () => {
  it('a member of org A cannot read org A data through org B credentials, and vice versa', async () => {
    const ownerA = await registerUser('Owner A');
    const orgA = await createOrg(ownerA.accessToken, 'Org A');
    await request(app.getHttpServer())
      .post(`${API_PREFIX}/organizations/${orgA.slug}/projects`)
      .set('Authorization', `Bearer ${ownerA.accessToken}`)
      .send({ key: 'ALPH', name: 'Alpha Project' })
      .expect(201);

    const ownerB = await registerUser('Owner B');
    const orgB = await createOrg(ownerB.accessToken, 'Org B');

    // B has a valid JWT and a real org of their own, but is not a member of org A.
    const crossTenantRead = await request(app.getHttpServer())
      .get(`${API_PREFIX}/organizations/${orgA.slug}/projects`)
      .set('Authorization', `Bearer ${ownerB.accessToken}`);
    expect(crossTenantRead.status).toBe(403);

    // And the reverse holds too.
    const reverseRead = await request(app.getHttpServer())
      .get(`${API_PREFIX}/organizations/${orgB.slug}/projects`)
      .set('Authorization', `Bearer ${ownerA.accessToken}`);
    expect(reverseRead.status).toBe(403);

    // Each owner can still read their own org's projects.
    const ownRead = await request(app.getHttpServer())
      .get(`${API_PREFIX}/organizations/${orgA.slug}/projects`)
      .set('Authorization', `Bearer ${ownerA.accessToken}`)
      .expect(200);
    expect(ownRead.body.data).toHaveLength(1);
    expect(ownRead.body.data[0].key).toBe('ALPH');
  });
});

describe('RBAC enforcement', () => {
  it('a MEMBER cannot create a project, but the inviting OWNER can', async () => {
    const owner = await registerUser('RBAC Owner');
    const org = await createOrg(owner.accessToken, 'RBAC Org');

    const member = await registerUser('RBAC Member');

    const invite = await request(app.getHttpServer())
      .post(`${API_PREFIX}/organizations/${org.slug}/invites`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: member.email, role: 'MEMBER' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`${API_PREFIX}/invites/accept`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ token: invite.body.data.rawToken })
      .expect(200);

    const memberCreateAttempt = await request(app.getHttpServer())
      .post(`${API_PREFIX}/organizations/${org.slug}/projects`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ key: 'BETA', name: 'Beta Project' });
    expect(memberCreateAttempt.status).toBe(403);

    await request(app.getHttpServer())
      .post(`${API_PREFIX}/organizations/${org.slug}/projects`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ key: 'BETA', name: 'Beta Project' })
      .expect(201);
  });
});

describe('Gamification', () => {
  it('completing a task awards points that show up on the leaderboard', async () => {
    const owner = await registerUser('Gamification Owner');
    const org = await createOrg(owner.accessToken, 'Gamification Org');
    const project = await createProject(owner.accessToken, org.slug, 'GAM');

    const createTaskRes = await request(app.getHttpServer())
      .post(
        `${API_PREFIX}/organizations/${org.slug}/projects/${project.key}/tasks`,
      )
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Integration test task' })
      .expect(201);
    const taskId = createTaskRes.body.data.id;

    await request(app.getHttpServer())
      .patch(
        `${API_PREFIX}/organizations/${org.slug}/projects/${project.key}/tasks/${taskId}`,
      )
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ status: 'DONE' })
      .expect(200);

    const leaderboard = await request(app.getHttpServer())
      .get(`${API_PREFIX}/organizations/${org.slug}/gamification/leaderboard`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(leaderboard.body.data).toHaveLength(1);
    // 5 (task_created) + 10 (task_completed)
    expect(leaderboard.body.data[0]).toMatchObject({
      totalPoints: 15,
      currentStreakDays: 1,
      rank: 1,
    });
  });
});

describe('Quests', () => {
  it('completes the due-today, due-this-week, and progress-update quests, then the login quest, awarding each bonus exactly once', async () => {
    const owner = await registerUser('Quests Owner');
    const org = await createOrg(owner.accessToken, 'Quests Org');
    const project = await createProject(owner.accessToken, org.slug, 'QST');
    const ownerId = await getUserId(owner.email);

    const createTaskRes = await request(app.getHttpServer())
      .post(
        `${API_PREFIX}/organizations/${org.slug}/projects/${project.key}/tasks`,
      )
      .set('Authorization', `Bearer ${owner.accessToken}`)
      // Due "right now" so it always lands inside both today's and this
      // week's VN-calendar window, regardless of what time this runs.
      .send({
        title: 'Due today task',
        dueDate: new Date().toISOString(),
        assigneeId: ownerId,
      })
      .expect(201);
    const taskId = createTaskRes.body.data.id;

    await request(app.getHttpServer())
      .patch(
        `${API_PREFIX}/organizations/${org.slug}/projects/${project.key}/tasks/${taskId}`,
      )
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ percentComplete: 50 })
      .expect(200)
      .expect((res) => {
        expect(res.body.data.percentComplete).toBe(50);
      });

    await request(app.getHttpServer())
      .patch(
        `${API_PREFIX}/organizations/${org.slug}/projects/${project.key}/tasks/${taskId}`,
      )
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ status: 'DONE' })
      .expect(200);

    const questsRes = await request(app.getHttpServer())
      .get(`${API_PREFIX}/organizations/${org.slug}/gamification/quests`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    const byKey = (key: string) =>
      questsRes.body.data.find((q: { questKey: string }) => q.questKey === key);
    expect(byKey('DAILY_DUE_TASKS')).toMatchObject({
      progress: 1,
      target: 1,
      completed: true,
      points: 15,
    });
    expect(byKey('WEEKLY_DUE_TASKS')).toMatchObject({
      progress: 1,
      target: 1,
      completed: true,
      points: 30,
    });
    expect(byKey('DAILY_PROGRESS_UPDATE')).toMatchObject({
      progress: 1,
      target: 1,
      completed: true,
      points: 5,
    });
    expect(byKey('DAILY_LOGIN')).toMatchObject({ completed: false });

    // 5 (task_created) + 5 (progress update) + 10 (task_completed) + 15 (daily due) + 30 (weekly due)
    let leaderboard = await request(app.getHttpServer())
      .get(`${API_PREFIX}/organizations/${org.slug}/gamification/leaderboard`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    expect(leaderboard.body.data[0].totalPoints).toBe(65);

    // Logging in (not registering — the account already exists) triggers the login quest.
    await request(app.getHttpServer())
      .post(`${API_PREFIX}/auth/login`)
      .send({ email: owner.email, password: 'Password123' })
      .expect(200);

    leaderboard = await request(app.getHttpServer())
      .get(`${API_PREFIX}/organizations/${org.slug}/gamification/leaderboard`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    expect(leaderboard.body.data[0].totalPoints).toBe(70); // +5 DAILY_LOGIN

    // A second login the same day, and a second quests read, must not double-award anything.
    await request(app.getHttpServer())
      .post(`${API_PREFIX}/auth/login`)
      .send({ email: owner.email, password: 'Password123' })
      .expect(200);
    await request(app.getHttpServer())
      .get(`${API_PREFIX}/organizations/${org.slug}/gamification/quests`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    leaderboard = await request(app.getHttpServer())
      .get(`${API_PREFIX}/organizations/${org.slug}/gamification/leaderboard`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    expect(leaderboard.body.data[0].totalPoints).toBe(70);
  });

  it('lists the due-task quests with target 0 (and awards nothing) when nothing is due', async () => {
    const owner = await registerUser('No Quests Owner');
    const org = await createOrg(owner.accessToken, 'No Quests Org');

    const res = await request(app.getHttpServer())
      .get(`${API_PREFIX}/organizations/${org.slug}/gamification/quests`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    const byKey = (key: string) =>
      res.body.data.find((q: { questKey: string }) => q.questKey === key);
    expect(res.body.data).toHaveLength(4);
    expect(byKey('DAILY_DUE_TASKS')).toMatchObject({
      target: 0,
      completed: false,
    });
    expect(byKey('WEEKLY_DUE_TASKS')).toMatchObject({
      target: 0,
      completed: false,
    });
  });
});

describe('Deliverables and milestones', () => {
  it('runs a deliverable through submit and PM sign-off, and rolls it up on its milestone', async () => {
    const pm = await registerUser('Deliverable PM');
    const org = await createOrg(pm.accessToken, 'Deliverable Org');
    const member = await inviteAndAccept(
      pm.accessToken,
      org.slug,
      'MEMBER',
      'Deliverable Member',
    );
    const project = await createProject(pm.accessToken, org.slug, 'DLV');
    const other = await createProject(pm.accessToken, org.slug, 'OTH');
    const proj = `${API_PREFIX}/organizations/${org.slug}/projects/${project.key}`;
    const asPm = { Authorization: `Bearer ${pm.accessToken}` };
    const asMember = { Authorization: `Bearer ${member.accessToken}` };
    const due = new Date(Date.now() + 5 * 86400000).toISOString();

    // A milestone is a task: start is forced to equal due, and it needs a due date.
    await request(app.getHttpServer())
      .post(`${proj}/tasks`)
      .set(asPm)
      .send({ title: 'Mốc không ngày', isMilestone: true })
      .expect(400);
    const milestone = await request(app.getHttpServer())
      .post(`${proj}/tasks`)
      .set(asPm)
      .send({
        title: 'Bàn giao GĐ1',
        isMilestone: true,
        dueDate: due,
        startDate: new Date(Date.now() - 86400000).toISOString(),
      })
      .expect(201);
    expect(milestone.body.data.isMilestone).toBe(true);
    expect(milestone.body.data.startDate).toBe(milestone.body.data.dueDate);
    const otherTask = await request(app.getHttpServer())
      .post(
        `${API_PREFIX}/organizations/${org.slug}/projects/${other.key}/tasks`,
      )
      .set(asPm)
      .send({ title: 'Việc dự án khác' })
      .expect(201);

    // A deliverable can't point at a task from another project.
    await request(app.getHttpServer())
      .post(`${proj}/deliverables`)
      .set(asMember)
      .send({ name: 'Sai dự án', taskId: otherTask.body.data.id })
      .expect(400);

    const created = await request(app.getHttpServer())
      .post(`${proj}/deliverables`)
      .set(asMember)
      .send({
        name: 'Báo cáo GĐ1',
        acceptanceCriteria: 'Đủ 3 chương',
        taskId: milestone.body.data.id,
      })
      .expect(201);
    const id = created.body.data.id;
    expect(created.body.data).toMatchObject({
      status: 'PLANNED',
      task: { isMilestone: true },
    });

    // Can't be reviewed before it's submitted.
    await request(app.getHttpServer())
      .post(`${proj}/deliverables/${id}/accept`)
      .set(asPm)
      .expect(409);
    await request(app.getHttpServer())
      .post(`${proj}/deliverables/${id}/submit`)
      .set(asMember)
      .expect(200);

    // A MEMBER can submit but not sign off; rejection needs a reason.
    await request(app.getHttpServer())
      .post(`${proj}/deliverables/${id}/accept`)
      .set(asMember)
      .expect(403);
    await request(app.getHttpServer())
      .post(`${proj}/deliverables/${id}/reject`)
      .set(asPm)
      .send({})
      .expect(400);
    const rejected = await request(app.getHttpServer())
      .post(`${proj}/deliverables/${id}/reject`)
      .set(asPm)
      .send({ reason: 'Thiếu chương 3' })
      .expect(200);
    expect(rejected.body.data).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'Thiếu chương 3',
    });

    // Rework and resubmit, then accept.
    await request(app.getHttpServer())
      .post(`${proj}/deliverables/${id}/submit`)
      .set(asMember)
      .expect(200);
    const accepted = await request(app.getHttpServer())
      .post(`${proj}/deliverables/${id}/accept`)
      .set(asPm)
      .expect(200);
    expect(accepted.body.data).toMatchObject({
      status: 'ACCEPTED',
      rejectionReason: null,
      reviewedBy: { fullName: 'Deliverable PM' },
    });

    const rollup = await request(app.getHttpServer())
      .get(`${proj}/milestones`)
      .set(asPm)
      .expect(200);
    expect(rollup.body.data).toHaveLength(1);
    expect(rollup.body.data[0]).toMatchObject({
      title: 'Bàn giao GĐ1',
      deliverablesTotal: 1,
      deliverablesAccepted: 1,
      isOverdue: false,
    });

    // Editing the accepted deliverable's content withdraws the sign-off, and the milestone count drops.
    const edited = await request(app.getHttpServer())
      .patch(`${proj}/deliverables/${id}`)
      .set(asMember)
      .send({ name: 'Báo cáo GĐ1 (v2)' })
      .expect(200);
    expect(edited.body.data).toMatchObject({
      status: 'IN_PROGRESS',
      reviewedAt: null,
    });
    const after = await request(app.getHttpServer())
      .get(`${proj}/milestones`)
      .set(asPm)
      .expect(200);
    expect(after.body.data[0]).toMatchObject({
      deliverablesTotal: 1,
      deliverablesAccepted: 0,
    });
  });

  it('keeps deliverables and milestones tenant-isolated', async () => {
    const ownerA = await registerUser('Deliv Owner A');
    const orgA = await createOrg(ownerA.accessToken, 'Deliv Org A');
    const projA = await createProject(ownerA.accessToken, orgA.slug, 'DLA');
    await request(app.getHttpServer())
      .post(
        `${API_PREFIX}/organizations/${orgA.slug}/projects/${projA.key}/deliverables`,
      )
      .set('Authorization', `Bearer ${ownerA.accessToken}`)
      .send({ name: 'Bí mật' })
      .expect(201);

    const ownerB = await registerUser('Deliv Owner B');
    await createOrg(ownerB.accessToken, 'Deliv Org B');
    for (const path of ['deliverables', 'milestones']) {
      await request(app.getHttpServer())
        .get(
          `${API_PREFIX}/organizations/${orgA.slug}/projects/${projA.key}/${path}`,
        )
        .set('Authorization', `Bearer ${ownerB.accessToken}`)
        .expect(403);
    }
  });

  it('turning a task into a milestone snaps its start to the due date', async () => {
    const owner = await registerUser('Promote Owner');
    const org = await createOrg(owner.accessToken, 'Promote Org');
    const project = await createProject(owner.accessToken, org.slug, 'PRM');
    const base = `${API_PREFIX}/organizations/${org.slug}/projects/${project.key}/tasks`;
    const auth = { Authorization: `Bearer ${owner.accessToken}` };
    const start = new Date(Date.now() - 3 * 86400000).toISOString();
    const due = new Date(Date.now() + 3 * 86400000).toISOString();
    const task = await request(app.getHttpServer())
      .post(base)
      .set(auth)
      .send({ title: 'Việc thường', startDate: start, dueDate: due })
      .expect(201);
    expect(task.body.data.isMilestone).toBe(false);

    const promoted = await request(app.getHttpServer())
      .patch(`${base}/${task.body.data.id}`)
      .set(auth)
      .send({ isMilestone: true })
      .expect(200);
    expect(promoted.body.data.startDate).toBe(promoted.body.data.dueDate);

    // Moving a milestone's due date drags its start along.
    const newDue = new Date(Date.now() + 10 * 86400000).toISOString();
    const moved = await request(app.getHttpServer())
      .patch(`${base}/${task.body.data.id}`)
      .set(auth)
      .send({ dueDate: newDue })
      .expect(200);
    expect(moved.body.data.startDate).toBe(moved.body.data.dueDate);
    expect(new Date(moved.body.data.dueDate).toISOString()).toBe(newDue);

    // A milestone can't lose its due date.
    await request(app.getHttpServer())
      .patch(`${base}/${task.body.data.id}`)
      .set(auth)
      .send({ dueDate: null })
      .expect(400);
  });
});

describe('Task history', () => {
  it('records what changed on each edit, skips no-ops, and keeps other tasks out', async () => {
    const owner = await registerUser('History Owner');
    const org = await createOrg(owner.accessToken, 'History Org');
    const helper = await inviteAndAccept(
      owner.accessToken,
      org.slug,
      'MEMBER',
      'History Helper',
    );
    const ownerId = await getUserId(owner.email);
    const helperId = await getUserId(helper.email);
    const project = await createProject(owner.accessToken, org.slug, 'HST');
    const base = `${API_PREFIX}/organizations/${org.slug}/projects/${project.key}/tasks`;
    const auth = { Authorization: `Bearer ${owner.accessToken}` };

    const task = await request(app.getHttpServer())
      .post(base)
      .set(auth)
      .send({ title: 'Việc có lịch sử', assigneeId: ownerId })
      .expect(201);
    const id = task.body.data.id;
    const other = await request(app.getHttpServer())
      .post(base)
      .set(auth)
      .send({ title: 'Việc khác' })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`${base}/${other.body.data.id}`)
      .set(auth)
      .send({ status: 'DONE' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`${base}/${id}`)
      .set(auth)
      .send({ status: 'IN_PROGRESS', percentComplete: 40 })
      .expect(200);
    // Resending the same values changes nothing and must not add an entry.
    await request(app.getHttpServer())
      .patch(`${base}/${id}`)
      .set(auth)
      .send({ status: 'IN_PROGRESS', percentComplete: 40 })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`${base}/${id}`)
      .set(auth)
      .send({ assigneeId: helperId, supporterIds: [ownerId] })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`${base}/${id}/history`)
      .set(auth)
      .expect(200);
    const entries = res.body.data as {
      action: string;
      actor: { fullName: string };
      changes: any[];
    }[];
    // Newest first: reassignment, then status/progress, then creation.
    expect(entries.map((e) => e.action)).toEqual([
      'updated',
      'updated',
      'created',
    ]);
    expect(entries[0]!.changes).toEqual([
      { field: 'assignee', from: 'History Owner', to: 'History Helper' },
      { field: 'supporters', added: ['History Owner'], removed: [] },
    ]);
    expect(entries[1]!.changes).toEqual([
      { field: 'status', from: 'TODO', to: 'IN_PROGRESS' },
      { field: 'percentComplete', from: 0, to: 40 },
    ]);
    expect(entries[1]!.actor.fullName).toBe('History Owner');

    // Another org's member can't read it.
    const stranger = await registerUser('History Stranger');
    await createOrg(stranger.accessToken, 'History Stranger Org');
    await request(app.getHttpServer())
      .get(`${base}/${id}/history`)
      .set('Authorization', `Bearer ${stranger.accessToken}`)
      .expect(403);
  });
});

describe('WBS, scope statement and dictionary', () => {
  it('enforces the node-type hierarchy, keeps a dictionary per task, gates scope approval, and builds the scope map', async () => {
    const owner = await registerUser('Wbs Owner');
    const org = await createOrg(owner.accessToken, 'Wbs Org');
    const member = await inviteAndAccept(
      owner.accessToken,
      org.slug,
      'MEMBER',
      'Wbs Member',
    );
    const project = await createProject(owner.accessToken, org.slug, 'WBS');
    const base = `${API_PREFIX}/organizations/${org.slug}/projects/${project.key}`;
    const auth = { Authorization: `Bearer ${owner.accessToken}` };
    const http = () => request(app.getHttpServer());
    const create = (body: Record<string, unknown>) =>
      http().post(`${base}/tasks`).set(auth).send(body);

    const phase = (
      await create({ title: 'Giai đoạn 1', nodeType: 'PHASE' }).expect(201)
    ).body.data;
    expect(phase.nodeType).toBe('PHASE');

    // Unspecified means activity; the WBS tab sends the level it wants.
    const plain = (
      await create({ title: 'Việc thường', parentTaskId: phase.id }).expect(201)
    ).body.data;
    expect(plain.nodeType).toBe('ACTIVITY');
    const deliverable = (
      await create({
        title: 'Giao phẩm A',
        nodeType: 'DELIVERABLE',
        parentTaskId: phase.id,
      }).expect(201)
    ).body.data;
    expect(deliverable.nodeType).toBe('DELIVERABLE');

    // A phase cannot live inside a deliverable.
    await create({
      title: 'Sai cấp',
      nodeType: 'PHASE',
      parentTaskId: deliverable.id,
    }).expect(400);

    const wp = (
      await create({
        title: 'Gói 1',
        nodeType: 'WORK_PACKAGE',
        parentTaskId: deliverable.id,
      }).expect(201)
    ).body.data;
    expect(wp.nodeType).toBe('WORK_PACKAGE');
    const activity = (
      await create({ title: 'Hoạt động 1', parentTaskId: wp.id }).expect(201)
    ).body.data;
    expect(activity.nodeType).toBe('ACTIVITY');

    // Retyping must still fit under the parent and above the children.
    await http()
      .patch(`${base}/tasks/${wp.id}`)
      .set(auth)
      .send({ nodeType: 'ACTIVITY' })
      .expect(400);
    await http()
      .patch(`${base}/tasks/${wp.id}`)
      .set(auth)
      .send({ nodeType: 'PHASE' })
      .expect(400);

    // Adding a child under a plain activity promotes it to a work package.
    const subActivity = (
      await create({ title: 'Việc con', parentTaskId: activity.id }).expect(201)
    ).body.data;
    expect(subActivity.nodeType).toBe('ACTIVITY');
    const promoted = await http()
      .get(`${base}/tasks/${activity.id}`)
      .set(auth)
      .expect(200);
    expect(promoted.body.data.nodeType).toBe('WORK_PACKAGE');

    // WBS dictionary: empty, then upserted, then updated in place.
    const dict = `${base}/wbs/${wp.id}/dictionary`;
    expect((await http().get(dict).set(auth).expect(200)).body.data).toBeNull();
    const saved = await http()
      .put(dict)
      .set(auth)
      .send({ scopeDescription: 'Khảo sát', costEstimate: 1200 })
      .expect(200);
    expect(saved.body.data.scopeDescription).toBe('Khảo sát');
    expect(saved.body.data.costEstimate).toBe(1200);
    const updated = await http()
      .put(dict)
      .set(auth)
      .send({ acceptanceCriteria: 'Được duyệt' })
      .expect(200);
    expect(updated.body.data.scopeDescription).toBe('Khảo sát');
    expect(updated.body.data.acceptanceCriteria).toBe('Được duyệt');
    // A dictionary of a task outside this project is not addressable.
    await http()
      .get(`${base}/wbs/does-not-exist/dictionary`)
      .set(auth)
      .expect(404);

    // Scope statement: a MEMBER can read but not edit/approve; editing an approved one reverts it.
    expect(
      (await http().get(`${base}/scope`).set(auth).expect(200)).body.data,
    ).toBeNull();
    const memberAuth = { Authorization: `Bearer ${member.accessToken}` };
    await http().get(`${base}/scope`).set(memberAuth).expect(200);
    await http()
      .put(`${base}/scope`)
      .set(memberAuth)
      .send({ inScope: 'x' })
      .expect(403);
    await http()
      .put(`${base}/scope`)
      .set(auth)
      .send({ inScope: 'Làm A', outOfScope: 'Không làm B' })
      .expect(200);
    await http().post(`${base}/scope/approve`).set(memberAuth).expect(403);
    const approved = await http()
      .post(`${base}/scope/approve`)
      .set(auth)
      .expect(201);
    expect(approved.body.data.status).toBe('APPROVED');
    const reverted = await http()
      .put(`${base}/scope`)
      .set(auth)
      .send({ inScope: 'Làm A và C' })
      .expect(200);
    expect(reverted.body.data.status).toBe('DRAFT');
    expect(reverted.body.data.outOfScope).toBe('Không làm B');

    // Scope map: chain, WBS codes and coverage.
    const map = (await http().get(`${base}/scope-map`).set(auth).expect(200))
      .body.data;
    const node = (id: string) =>
      map.nodes.find((n: { id: string }) => n.id === id);
    expect(node(deliverable.id).code).toBe('1.2');
    expect(node(wp.id).code).toBe('1.2.1');
    expect(node(wp.id).hasDictionary).toBe(true);
    const offenders = (key: string) =>
      map.checks.find((c: { key: string }) => c.key === key).offenders;
    expect(offenders('deliverableWithoutRecord')).toContain(deliverable.id);
    expect(offenders('workPackageWithoutDictionary')).toContain(activity.id);
    expect(offenders('workPackageWithoutDictionary')).not.toContain(wp.id);

    // Tenant isolation.
    const other = await registerUser('Wbs Other');
    await createOrg(other.accessToken, 'Wbs Other Org');
    for (const path of ['scope', 'scope-map', `wbs/${wp.id}/dictionary`]) {
      await http()
        .get(`${base}/${path}`)
        .set('Authorization', `Bearer ${other.accessToken}`)
        .expect(403);
    }
  });
});

describe('Task assignees', () => {
  it('keeps exactly one primary assignee, with everyone else as supporters', async () => {
    const owner = await registerUser('Assignee Owner');
    const org = await createOrg(owner.accessToken, 'Assignee Org');
    const helper = await inviteAndAccept(
      owner.accessToken,
      org.slug,
      'MEMBER',
      'Assignee Helper',
    );
    const other = await inviteAndAccept(
      owner.accessToken,
      org.slug,
      'MEMBER',
      'Assignee Other',
    );
    const ownerId = await getUserId(owner.email);
    const helperId = await getUserId(helper.email);
    const otherId = await getUserId(other.email);
    const project = await createProject(owner.accessToken, org.slug, 'ASG');
    const base = `${API_PREFIX}/organizations/${org.slug}/projects/${project.key}/tasks`;
    const auth = { Authorization: `Bearer ${owner.accessToken}` };

    const created = await request(app.getHttpServer())
      .post(base)
      .set(auth)
      // The primary is also (wrongly) listed as a supporter — must collapse to one row.
      .send({
        title: 'Có người phụ trách',
        assigneeId: ownerId,
        supporterIds: [ownerId, helperId],
      })
      .expect(201);
    const roles = (t: { assignees: { id: string; role: string }[] }) =>
      Object.fromEntries(t.assignees.map((a) => [a.id, a.role]));
    expect(roles(created.body.data)).toEqual({
      [ownerId]: 'PRIMARY',
      [helperId]: 'SUPPORT',
    });
    expect(created.body.data.assignees[0].role).toBe('PRIMARY');

    // Changing only the primary keeps the supporters (and the old primary is dropped, not demoted).
    const swapped = await request(app.getHttpServer())
      .patch(`${base}/${created.body.data.id}`)
      .set(auth)
      .send({ assigneeId: otherId })
      .expect(200);
    expect(roles(swapped.body.data)).toEqual({
      [otherId]: 'PRIMARY',
      [helperId]: 'SUPPORT',
    });

    // Changing only the supporters keeps the primary.
    const resupported = await request(app.getHttpServer())
      .patch(`${base}/${created.body.data.id}`)
      .set(auth)
      .send({ supporterIds: [ownerId] })
      .expect(200);
    expect(roles(resupported.body.data)).toEqual({
      [otherId]: 'PRIMARY',
      [ownerId]: 'SUPPORT',
    });

    // null clears the primary without touching supporters.
    const cleared = await request(app.getHttpServer())
      .patch(`${base}/${created.body.data.id}`)
      .set(auth)
      .send({ assigneeId: null })
      .expect(200);
    expect(roles(cleared.body.data)).toEqual({ [ownerId]: 'SUPPORT' });

    // The old array field is gone — a client still sending it must not silently succeed.
    await request(app.getHttpServer())
      .post(base)
      .set(auth)
      .send({ title: 'x', assigneeIds: [ownerId] })
      .expect(201)
      .expect((res) => expect(res.body.data.assignees).toHaveLength(0));
  });

  it('a supporter does not count toward the due-today quest, the primary does', async () => {
    const owner = await registerUser('Quest Primary');
    const org = await createOrg(owner.accessToken, 'Quest Primary Org');
    const helper = await inviteAndAccept(
      owner.accessToken,
      org.slug,
      'MEMBER',
      'Quest Supporter',
    );
    const ownerId = await getUserId(owner.email);
    const helperId = await getUserId(helper.email);
    const project = await createProject(owner.accessToken, org.slug, 'QPR');
    await request(app.getHttpServer())
      .post(
        `${API_PREFIX}/organizations/${org.slug}/projects/${project.key}/tasks`,
      )
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        title: 'Hôm nay',
        dueDate: new Date().toISOString(),
        assigneeId: ownerId,
        supporterIds: [helperId],
      })
      .expect(201);
    const target = async (token: string) => {
      const res = await request(app.getHttpServer())
        .get(`${API_PREFIX}/organizations/${org.slug}/gamification/quests`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      return res.body.data.find(
        (q: { questKey: string }) => q.questKey === 'DAILY_DUE_TASKS',
      ).target;
    };
    expect(await target(owner.accessToken)).toBe(1);
    expect(await target(helper.accessToken)).toBe(0);
  });
});

describe('User preferences', () => {
  it('defaults mascotCharacter to fox, and PATCH persists a new selection', async () => {
    const user = await registerUser('Preferences User');

    const before = await request(app.getHttpServer())
      .get(`${API_PREFIX}/auth/me`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    expect(before.body.data.mascotCharacter).toBe('fox');

    await request(app.getHttpServer())
      .patch(`${API_PREFIX}/users/me/preferences`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ mascotCharacter: 'otter' })
      .expect(200)
      .expect((res) => {
        expect(res.body.data.mascotCharacter).toBe('otter');
      });

    const after = await request(app.getHttpServer())
      .get(`${API_PREFIX}/auth/me`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    expect(after.body.data.mascotCharacter).toBe('otter');
  });

  it('rejects an unknown character slug', async () => {
    const user = await registerUser('Preferences User Bad');

    await request(app.getHttpServer())
      .patch(`${API_PREFIX}/users/me/preferences`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ mascotCharacter: 'not-a-real-character' })
      .expect(400);
  });

  it('rejects a mascotCharacter another member of the same org already has, but allows it once that org member changes away from it', async () => {
    const owner = await registerUser('Character Owner');
    const org = await createOrg(owner.accessToken, 'Character Org');
    const member = await inviteAndAccept(
      owner.accessToken,
      org.slug,
      'MEMBER',
      'Character Member',
    );

    await request(app.getHttpServer())
      .patch(`${API_PREFIX}/users/me/preferences`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ mascotCharacter: 'panda' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`${API_PREFIX}/users/me/preferences`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ mascotCharacter: 'panda' })
      .expect(409);

    // A user with no shared org can freely pick the same character.
    const stranger = await registerUser('Character Stranger');
    await request(app.getHttpServer())
      .patch(`${API_PREFIX}/users/me/preferences`)
      .set('Authorization', `Bearer ${stranger.accessToken}`)
      .send({ mascotCharacter: 'panda' })
      .expect(200);

    // Once the owner moves off "panda", the member can now take it.
    await request(app.getHttpServer())
      .patch(`${API_PREFIX}/users/me/preferences`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ mascotCharacter: 'owl' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`${API_PREFIX}/users/me/preferences`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ mascotCharacter: 'panda' })
      .expect(200);
  });
});

describe('Telegram integration', () => {
  it('consuming a valid link code via the webhook links the chat id to the user', async () => {
    const user = await registerUser('Telegram User');
    const prisma = app.get(PrismaService);
    const userRecord = await prisma.db.user.findUniqueOrThrow({
      where: { email: user.email },
    });

    const rawCode = 'integration-test-link-code';
    await prisma.db.telegramLinkCode.create({
      data: {
        userId: userRecord.id,
        codeHash: hashLinkCode(rawCode),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    await request(app.getHttpServer())
      .post(`${API_PREFIX}/integrations/telegram/webhook`)
      .set('X-Telegram-Bot-Api-Secret-Token', 'integration-test-webhook-secret')
      .send({
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: 999888777 },
          text: `/start ${rawCode}`,
        },
      })
      .expect(201);

    const updated = await prisma.db.user.findUniqueOrThrow({
      where: { id: userRecord.id },
    });
    expect(updated.telegramChatId).toBe('999888777');

    const status = await request(app.getHttpServer())
      .get(`${API_PREFIX}/integrations/telegram/status`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    expect(status.body.data.linked).toBe(true);
  });

  it('rejects a webhook call whose secret header does not match', async () => {
    await request(app.getHttpServer())
      .post(`${API_PREFIX}/integrations/telegram/webhook`)
      .set('X-Telegram-Bot-Api-Secret-Token', 'not-the-right-secret')
      .send({
        update_id: 2,
        message: { message_id: 2, chat: { id: 1 }, text: '/start bogus' },
      })
      .expect(401);
  });

  it('defaults digest preferences to enabled/17:00, and persists an update through GET /status', async () => {
    const user = await registerUser('Digest User');

    const initial = await request(app.getHttpServer())
      .get(`${API_PREFIX}/integrations/telegram/status`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    expect(initial.body.data.dailyDigestEnabled).toBe(true);
    expect(initial.body.data.dailyDigestHour).toBe(17);

    await request(app.getHttpServer())
      .patch(`${API_PREFIX}/integrations/telegram/digest-preferences`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ dailyDigestEnabled: false, dailyDigestHour: 9 })
      .expect(200)
      .expect((res) => {
        expect(res.body.data.dailyDigestEnabled).toBe(false);
        expect(res.body.data.dailyDigestHour).toBe(9);
      });

    const after = await request(app.getHttpServer())
      .get(`${API_PREFIX}/integrations/telegram/status`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    expect(after.body.data.dailyDigestEnabled).toBe(false);
    expect(after.body.data.dailyDigestHour).toBe(9);
  });

  it('rejects an unauthenticated digest-preferences update', async () => {
    await request(app.getHttpServer())
      .patch(`${API_PREFIX}/integrations/telegram/digest-preferences`)
      .send({ dailyDigestEnabled: true, dailyDigestHour: 8 })
      .expect(401);
  });
});

describe('Project Charter', () => {
  it('PM can save and approve a charter; a MEMBER can read but not edit it, and re-editing an approved charter reverts it to DRAFT', async () => {
    const owner = await registerUser('Charter Owner');
    const org = await createOrg(owner.accessToken, 'Charter Org');
    const project = await createProject(owner.accessToken, org.slug, 'CHR');
    const member = await inviteAndAccept(
      owner.accessToken,
      org.slug,
      'MEMBER',
      'Charter Member',
    );

    const base = `${API_PREFIX}/organizations/${org.slug}/projects/${project.key}/charter`;

    // Nothing saved yet.
    const empty = await request(app.getHttpServer())
      .get(base)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    expect(empty.body.data).toBeNull();

    // MEMBER cannot edit the charter (governance artifact, PM+ only).
    await request(app.getHttpServer())
      .put(base)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ purpose: 'Should be forbidden' })
      .expect(403);

    // Owner (counts as PM+) saves it.
    const saved = await request(app.getHttpServer())
      .put(base)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ purpose: 'Ra mắt sản phẩm mới', sponsorName: 'CEO' })
      .expect(200);
    expect(saved.body.data.purpose).toBe('Ra mắt sản phẩm mới');
    expect(saved.body.data.status).toBe('DRAFT');

    // MEMBER can still read it.
    const memberRead = await request(app.getHttpServer())
      .get(base)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .expect(200);
    expect(memberRead.body.data.sponsorName).toBe('CEO');

    // Approve it.
    const approved = await request(app.getHttpServer())
      .post(`${base}/approve`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(201);
    expect(approved.body.data.status).toBe('APPROVED');
    expect(approved.body.data.approvedBy.fullName).toBe('Charter Owner');

    // Editing it again reverts status to DRAFT.
    const editedAfterApproval = await request(app.getHttpServer())
      .put(base)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ purpose: 'Phạm vi đã thay đổi' })
      .expect(200);
    expect(editedAfterApproval.body.data.status).toBe('DRAFT');
    expect(editedAfterApproval.body.data.approvedById).toBeNull();
  });
});

describe('Stakeholder Register', () => {
  it('PM can add stakeholders, a MEMBER cannot, and everyone can read the list', async () => {
    const owner = await registerUser('Stakeholder Owner');
    const org = await createOrg(owner.accessToken, 'Stakeholder Org');
    const project = await createProject(owner.accessToken, org.slug, 'STK');
    const member = await inviteAndAccept(
      owner.accessToken,
      org.slug,
      'MEMBER',
      'Stakeholder Member',
    );

    const base = `${API_PREFIX}/organizations/${org.slug}/projects/${project.key}/stakeholders`;

    await request(app.getHttpServer())
      .post(base)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ fullName: 'Khách hàng ngoài' })
      .expect(403);

    const created = await request(app.getHttpServer())
      .post(base)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        fullName: 'Khách hàng chiến lược',
        organizationName: 'Công ty ABC',
        influence: 'HIGH',
        interest: 'HIGH',
      })
      .expect(201);
    expect(created.body.data.influence).toBe('HIGH');

    const list = await request(app.getHttpServer())
      .get(base)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .expect(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].fullName).toBe('Khách hàng chiến lược');
  });
});

describe('Document Registry', () => {
  it('a MEMBER can log a document, a VIEWER cannot', async () => {
    const owner = await registerUser('Document Owner');
    const org = await createOrg(owner.accessToken, 'Document Org');
    const project = await createProject(owner.accessToken, org.slug, 'DOC');
    const member = await inviteAndAccept(
      owner.accessToken,
      org.slug,
      'MEMBER',
      'Document Member',
    );
    const viewer = await inviteAndAccept(
      owner.accessToken,
      org.slug,
      'VIEWER',
      'Document Viewer',
    );

    const base = `${API_PREFIX}/organizations/${org.slug}/projects/${project.key}/documents`;

    await request(app.getHttpServer())
      .post(base)
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .send({ title: 'Should be forbidden', url: 'https://example.com/x.pdf' })
      .expect(403);

    const created = await request(app.getHttpServer())
      .post(base)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({
        title: 'Biên bản họp kickoff',
        url: 'https://example.com/kickoff.pdf',
        category: 'MEETING_NOTES',
      })
      .expect(201);
    expect(created.body.data.category).toBe('MEETING_NOTES');

    const list = await request(app.getHttpServer())
      .get(base)
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .expect(200);
    expect(list.body.data).toHaveLength(1);
  });
});

describe('Organization invite management', () => {
  it('rejects inviting an email that is already a member', async () => {
    const owner = await registerUser('Invite Conflict Owner');
    const org = await createOrg(owner.accessToken, 'Invite Conflict Org');
    const member = await inviteAndAccept(
      owner.accessToken,
      org.slug,
      'MEMBER',
      'Invite Conflict Member',
    );

    await request(app.getHttpServer())
      .post(`${API_PREFIX}/organizations/${org.slug}/invites`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: member.email, role: 'ADMIN' })
      .expect(409);
  });

  it('re-inviting the same pending email replaces the old invite instead of stacking duplicates', async () => {
    const owner = await registerUser('Invite Replace Owner');
    const org = await createOrg(owner.accessToken, 'Invite Replace Org');
    const inviteeEmail = `${uniqueSuffix()}@example.com`;

    const first = await request(app.getHttpServer())
      .post(`${API_PREFIX}/organizations/${org.slug}/invites`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: inviteeEmail, role: 'MEMBER' })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post(`${API_PREFIX}/organizations/${org.slug}/invites`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: inviteeEmail, role: 'ADMIN' })
      .expect(201);

    const pending = await request(app.getHttpServer())
      .get(`${API_PREFIX}/organizations/${org.slug}/invites`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    const matching = pending.body.data.filter(
      (inv: { email: string }) => inv.email === inviteeEmail,
    );
    expect(matching).toHaveLength(1);
    expect(matching[0].role).toBe('ADMIN');

    // Register the invitee under the EXACT invited email (registerUser()
    // always picks a random one) so acceptance's email-match check passes.
    const inviteeReg = await request(app.getHttpServer())
      .post(`${API_PREFIX}/auth/register`)
      .send({
        email: inviteeEmail,
        password: 'Password123',
        fullName: 'Invite Replace Invitee',
      })
      .expect(201);
    const invitee = { accessToken: inviteeReg.body.data.accessToken };

    // The first (superseded) token must no longer work.
    await request(app.getHttpServer())
      .post(`${API_PREFIX}/invites/accept`)
      .set('Authorization', `Bearer ${invitee.accessToken}`)
      .send({ token: first.body.data.rawToken })
      .expect(404);

    // The second (current) token still works.
    await request(app.getHttpServer())
      .post(`${API_PREFIX}/invites/accept`)
      .set('Authorization', `Bearer ${invitee.accessToken}`)
      .send({ token: second.body.data.rawToken })
      .expect(200);
  });

  it('lets an OWNER/ADMIN cancel a pending invite, after which its token no longer works', async () => {
    const owner = await registerUser('Invite Cancel Owner');
    const org = await createOrg(owner.accessToken, 'Invite Cancel Org');
    const inviteeEmail = `${uniqueSuffix()}@example.com`;

    const invite = await request(app.getHttpServer())
      .post(`${API_PREFIX}/organizations/${org.slug}/invites`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: inviteeEmail, role: 'MEMBER' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(
        `${API_PREFIX}/organizations/${org.slug}/invites/${invite.body.data.id}`,
      )
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    const pending = await request(app.getHttpServer())
      .get(`${API_PREFIX}/organizations/${org.slug}/invites`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    expect(
      pending.body.data.find(
        (inv: { email: string }) => inv.email === inviteeEmail,
      ),
    ).toBeUndefined();

    const invitee = await registerUser('Invite Cancel Invitee');
    await request(app.getHttpServer())
      .post(`${API_PREFIX}/invites/accept`)
      .set('Authorization', `Bearer ${invitee.accessToken}`)
      .send({ token: invite.body.data.rawToken })
      .expect(404);
  });

  it('a plain MEMBER cannot cancel a pending invite', async () => {
    const owner = await registerUser('Invite Cancel RBAC Owner');
    const org = await createOrg(owner.accessToken, 'Invite Cancel RBAC Org');
    const member = await inviteAndAccept(
      owner.accessToken,
      org.slug,
      'MEMBER',
      'Invite Cancel RBAC Member',
    );
    const invite = await request(app.getHttpServer())
      .post(`${API_PREFIX}/organizations/${org.slug}/invites`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: `${uniqueSuffix()}@example.com`, role: 'MEMBER' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(
        `${API_PREFIX}/organizations/${org.slug}/invites/${invite.body.data.id}`,
      )
      .set('Authorization', `Bearer ${member.accessToken}`)
      .expect(403);
  });
});

describe('Organization archive', () => {
  it('hides an archived org from the list, blocks new projects/invites, unarchive restores it', async () => {
    const owner = await registerUser('Archive Owner');
    const org = await createOrg(owner.accessToken, 'Archive Org');

    await request(app.getHttpServer())
      .post(`${API_PREFIX}/organizations/${org.slug}/archive`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    const list = await request(app.getHttpServer())
      .get(`${API_PREFIX}/organizations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    expect(
      list.body.data.find((o: { slug: string }) => o.slug === org.slug),
    ).toBeUndefined();

    await request(app.getHttpServer())
      .post(`${API_PREFIX}/organizations/${org.slug}/projects`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ key: 'ARCH', name: 'Should be blocked' })
      .expect(403);

    const member = await registerUser('Archive Invitee');
    await request(app.getHttpServer())
      .post(`${API_PREFIX}/organizations/${org.slug}/invites`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: member.email, role: 'MEMBER' })
      .expect(403);

    await request(app.getHttpServer())
      .post(`${API_PREFIX}/organizations/${org.slug}/unarchive`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    const listAfter = await request(app.getHttpServer())
      .get(`${API_PREFIX}/organizations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    expect(
      listAfter.body.data.find((o: { slug: string }) => o.slug === org.slug),
    ).toBeDefined();

    await request(app.getHttpServer())
      .post(`${API_PREFIX}/organizations/${org.slug}/projects`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ key: 'ARCH', name: 'Now allowed' })
      .expect(201);
  });

  it('still allows shrinkage (member removal) while archived', async () => {
    const owner = await registerUser('Archive Shrink Owner');
    const org = await createOrg(owner.accessToken, 'Archive Shrink Org');
    const member = await inviteAndAccept(
      owner.accessToken,
      org.slug,
      'MEMBER',
      'Archive Shrink Member',
    );
    const membersList = await request(app.getHttpServer())
      .get(`${API_PREFIX}/organizations/${org.slug}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    const membershipId = membersList.body.data.find(
      (m: { user: { email: string } }) => m.user.email === member.email,
    ).id;

    await request(app.getHttpServer())
      .post(`${API_PREFIX}/organizations/${org.slug}/archive`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`${API_PREFIX}/organizations/${org.slug}/members/${membershipId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
  });
});

describe('Project-level RBAC overrides', () => {
  it('grants a project-scoped override upward: an org VIEWER made PM on one project can act there but not on another', async () => {
    const owner = await registerUser('Override Owner');
    const org = await createOrg(owner.accessToken, 'Override Org');
    const projectA = await createProject(owner.accessToken, org.slug, 'OVA');
    const projectB = await createProject(owner.accessToken, org.slug, 'OVB');
    const viewer = await inviteAndAccept(
      owner.accessToken,
      org.slug,
      'VIEWER',
      'Override Viewer',
    );

    // Baseline: a VIEWER cannot create tasks anywhere.
    await request(app.getHttpServer())
      .post(
        `${API_PREFIX}/organizations/${org.slug}/projects/${projectA.key}/tasks`,
      )
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .send({ title: 'Should be forbidden' })
      .expect(403);

    // Grant a PM override on project A only.
    await request(app.getHttpServer())
      .post(
        `${API_PREFIX}/organizations/${org.slug}/projects/${projectA.key}/members`,
      )
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ userId: await getUserId(viewer.email), role: 'PM' })
      .expect(201);

    // Now allowed on project A...
    await request(app.getHttpServer())
      .post(
        `${API_PREFIX}/organizations/${org.slug}/projects/${projectA.key}/tasks`,
      )
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .send({ title: 'Now allowed on A' })
      .expect(201);

    // ...but still forbidden on project B in the same org (proves per-project scope, not a global unlock).
    await request(app.getHttpServer())
      .post(
        `${API_PREFIX}/organizations/${org.slug}/projects/${projectB.key}/tasks`,
      )
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .send({ title: 'Still forbidden on B' })
      .expect(403);
  });

  it('grants a project-scoped override downward: an org PM demoted to VIEWER on one project is blocked there but not elsewhere', async () => {
    const owner = await registerUser('Downgrade Owner');
    const org = await createOrg(owner.accessToken, 'Downgrade Org');
    const projectA = await createProject(owner.accessToken, org.slug, 'DGA');
    const projectB = await createProject(owner.accessToken, org.slug, 'DGB');
    const pm = await inviteAndAccept(
      owner.accessToken,
      org.slug,
      'PM',
      'Downgrade PM',
    );

    // Baseline: org PM can create tasks anywhere.
    await request(app.getHttpServer())
      .post(
        `${API_PREFIX}/organizations/${org.slug}/projects/${projectB.key}/tasks`,
      )
      .set('Authorization', `Bearer ${pm.accessToken}`)
      .send({ title: 'Allowed on B by default' })
      .expect(201);

    // Downgrade to VIEWER on project A only.
    await request(app.getHttpServer())
      .post(
        `${API_PREFIX}/organizations/${org.slug}/projects/${projectA.key}/members`,
      )
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ userId: await getUserId(pm.email), role: 'VIEWER' })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `${API_PREFIX}/organizations/${org.slug}/projects/${projectA.key}/tasks`,
      )
      .set('Authorization', `Bearer ${pm.accessToken}`)
      .send({ title: 'Now forbidden on A' })
      .expect(403);

    // Still allowed on project B, unaffected.
    await request(app.getHttpServer())
      .post(
        `${API_PREFIX}/organizations/${org.slug}/projects/${projectB.key}/tasks`,
      )
      .set('Authorization', `Bearer ${pm.accessToken}`)
      .send({ title: 'Still allowed on B' })
      .expect(201);
  });

  it('re-inviting a removed member at a lower role does not resurrect their old project override', async () => {
    const owner = await registerUser('Resurrect Owner');
    const org = await createOrg(owner.accessToken, 'Resurrect Org');
    const project = await createProject(owner.accessToken, org.slug, 'RES');
    const pm = await inviteAndAccept(
      owner.accessToken,
      org.slug,
      'PM',
      'Resurrect PM',
    );
    const userId = await getUserId(pm.email);

    await request(app.getHttpServer())
      .post(
        `${API_PREFIX}/organizations/${org.slug}/projects/${project.key}/members`,
      )
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ userId, role: 'OWNER' })
      .expect(201);

    const membersList = await request(app.getHttpServer())
      .get(`${API_PREFIX}/organizations/${org.slug}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    const membershipId = membersList.body.data.find(
      (m: { user: { email: string } }) => m.user.email === pm.email,
    ).id;
    await request(app.getHttpServer())
      .delete(`${API_PREFIX}/organizations/${org.slug}/members/${membershipId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    // Re-invite the SAME email at VIEWER — the old project OWNER override
    // must not silently reactivate. (inviteAndAccept always registers a
    // brand-new random user, so it can't be reused for "the same person".)
    const reinvite = await request(app.getHttpServer())
      .post(`${API_PREFIX}/organizations/${org.slug}/invites`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: pm.email, role: 'VIEWER' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`${API_PREFIX}/invites/accept`)
      .set('Authorization', `Bearer ${pm.accessToken}`)
      .send({ token: reinvite.body.data.rawToken })
      .expect(200);

    await request(app.getHttpServer())
      .post(
        `${API_PREFIX}/organizations/${org.slug}/projects/${project.key}/tasks`,
      )
      .set('Authorization', `Bearer ${pm.accessToken}`)
      .send({ title: 'Should still be forbidden as VIEWER' })
      .expect(403);

    const overrides = await request(app.getHttpServer())
      .get(
        `${API_PREFIX}/organizations/${org.slug}/projects/${project.key}/members`,
      )
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    // The project creator's own auto-created OWNER override is unrelated and
    // still expected; only the removed-and-rejoined user's override must be gone.
    expect(
      overrides.body.data.find((m: { userId: string }) => m.userId === userId),
    ).toBeUndefined();
  });
});

describe('Project member management authorization', () => {
  it("a delegated project-level OWNER (plain org MEMBER) can manage that project's members; a plain org PM with no override cannot", async () => {
    const owner = await registerUser('Delegate Owner');
    const org = await createOrg(owner.accessToken, 'Delegate Org');
    const project = await createProject(owner.accessToken, org.slug, 'DEL');
    const delegate = await inviteAndAccept(
      owner.accessToken,
      org.slug,
      'MEMBER',
      'Delegate Member',
    );
    const outsider = await inviteAndAccept(
      owner.accessToken,
      org.slug,
      'PM',
      'Delegate Outsider PM',
    );

    await request(app.getHttpServer())
      .post(
        `${API_PREFIX}/organizations/${org.slug}/projects/${project.key}/members`,
      )
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ userId: await getUserId(delegate.email), role: 'OWNER' })
      .expect(201);

    // The plain org PM (no override on this project) cannot manage its membership.
    await request(app.getHttpServer())
      .post(
        `${API_PREFIX}/organizations/${org.slug}/projects/${project.key}/members`,
      )
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .send({ userId: await getUserId(owner.email), role: 'MEMBER' })
      .expect(403);

    // The delegated project-level OWNER (plain org MEMBER) can.
    await request(app.getHttpServer())
      .post(
        `${API_PREFIX}/organizations/${org.slug}/projects/${project.key}/members`,
      )
      .set('Authorization', `Bearer ${delegate.accessToken}`)
      .send({ userId: await getUserId(outsider.email), role: 'VIEWER' })
      .expect(201);
  });
});

describe('Artifacts', () => {
  it('list omits htmlContent, single-get includes it, a VIEWER can read but not create', async () => {
    const owner = await registerUser('Artifact Owner');
    const org = await createOrg(owner.accessToken, 'Artifact Org');
    const project = await createProject(owner.accessToken, org.slug, 'ART');
    const member = await inviteAndAccept(
      owner.accessToken,
      org.slug,
      'MEMBER',
      'Artifact Member',
    );
    const viewer = await inviteAndAccept(
      owner.accessToken,
      org.slug,
      'VIEWER',
      'Artifact Viewer',
    );

    const base = `${API_PREFIX}/organizations/${org.slug}/projects/${project.key}/artifacts`;

    await request(app.getHttpServer())
      .post(base)
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .send({ title: 'Should be forbidden', htmlContent: '<h1>x</h1>' })
      .expect(403);

    const created = await request(app.getHttpServer())
      .post(base)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({
        title: 'Sơ đồ tiến độ',
        htmlContent: '<h1 id="hello">Xin chào</h1>',
      })
      .expect(201);
    expect(created.body.data.htmlContent).toBe('<h1 id="hello">Xin chào</h1>');

    const list = await request(app.getHttpServer())
      .get(base)
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .expect(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].title).toBe('Sơ đồ tiến độ');
    expect(list.body.data[0]).not.toHaveProperty('htmlContent');

    const detail = await request(app.getHttpServer())
      .get(`${base}/${created.body.data.id}`)
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .expect(200);
    expect(detail.body.data.htmlContent).toBe('<h1 id="hello">Xin chào</h1>');
  });
});
