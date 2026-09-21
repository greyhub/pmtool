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
import { findTemplate, templateStats } from '@pmtool/shared-types';
import { AiQuotaService } from '../../src/modules/ai/ai-quota.service';
import { GoogleClient } from '../../src/modules/auth/google-client';
import { MailService } from '../../src/modules/mail/mail.service';
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

const fakeGoogle = {
  enabled: true,
  redirectUri: 'http://localhost:3001/api/v1/auth/google/callback',
  authUrl: (state: string) =>
    `https://accounts.example.test/auth?state=${state}`,
  exchange: async (code: string) => {
    if (code === 'boom') throw new Error('token exchange failed');
    const [email, name, verified] = code.split('|');
    return {
      sub: `sub-${email}`,
      email: email!.toLowerCase(),
      emailVerified: verified !== 'unverified',
      name: name ?? null,
      picture: null,
    };
  },
};

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
  })
    // Google is never called for real: a code is "email|name|verified" and decodes to that profile.
    .overrideProvider(GoogleClient)
    .useValue(fakeGoogle)
    .compile();
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

describe('Health', () => {
  it('answers liveness and readiness (readiness checks the database) without authentication', async () => {
    await request(app.getHttpServer()).get(`${API_PREFIX}/health`).expect(200);
    const ready = await request(app.getHttpServer())
      .get(`${API_PREFIX}/health/ready`)
      .expect(200);
    expect(ready.body.status ?? ready.body.data?.status).toBe('ok');
  });
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

    // Activity rows are written after the response is sent, so wait for all three.
    let res = await request(app.getHttpServer())
      .get(`${base}/${id}/history`)
      .set(auth)
      .expect(200);
    for (let i = 0; i < 40 && res.body.data.length < 3; i++) {
      await new Promise((r) => setTimeout(r, 100));
      res = await request(app.getHttpServer())
        .get(`${base}/${id}/history`)
        .set(auth)
        .expect(200);
    }
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

describe('Role-based access matrix', () => {
  type Role = 'OWNER' | 'ADMIN' | 'PM' | 'MEMBER' | 'VIEWER';
  const ALL: Role[] = ['OWNER', 'ADMIN', 'PM', 'MEMBER', 'VIEWER'];
  const EDITORS: Role[] = ['OWNER', 'ADMIN', 'PM', 'MEMBER'];
  const MANAGERS: Role[] = ['OWNER', 'ADMIN', 'PM'];
  const SPONSORS: Role[] = ['OWNER', 'ADMIN'];

  it('every role can do exactly what the permission table says, and an outsider can do nothing', async () => {
    const owner = await registerUser('Matrix Owner');
    const org = await createOrg(owner.accessToken, 'Matrix Org');
    const tokens: Record<Role, string> = {
      OWNER: owner.accessToken,
      ADMIN: (
        await inviteAndAccept(
          owner.accessToken,
          org.slug,
          'ADMIN',
          'Matrix Admin',
        )
      ).accessToken,
      PM: (
        await inviteAndAccept(owner.accessToken, org.slug, 'PM', 'Matrix PM')
      ).accessToken,
      MEMBER: (
        await inviteAndAccept(
          owner.accessToken,
          org.slug,
          'MEMBER',
          'Matrix Member',
        )
      ).accessToken,
      VIEWER: (
        await inviteAndAccept(
          owner.accessToken,
          org.slug,
          'VIEWER',
          'Matrix Viewer',
        )
      ).accessToken,
    };
    const outsider = await registerUser('Matrix Outsider');
    await createOrg(outsider.accessToken, 'Matrix Outsider Org');

    const project = await createProject(owner.accessToken, org.slug, 'MTX');
    const orgBase = `${API_PREFIX}/organizations/${org.slug}`;
    const base = `${orgBase}/projects/${project.key}`;
    const ownerAuth = { Authorization: `Bearer ${owner.accessToken}` };
    const http = () => request(app.getHttpServer());

    const task = (
      await http()
        .post(`${base}/tasks`)
        .set(ownerAuth)
        .send({ title: 'Seed' })
        .expect(201)
    ).body.data;
    const deliverable = (
      await http()
        .post(`${base}/deliverables`)
        .set(ownerAuth)
        .send({ name: 'Seed' })
        .expect(201)
    ).body.data;
    await http()
      .put(`${base}/scope`)
      .set(ownerAuth)
      .send({ inScope: 'x' })
      .expect(200);
    await http()
      .put(`${base}/charter`)
      .set(ownerAuth)
      .send({ purpose: 'x' })
      .expect(200);

    type Case = {
      name: string;
      method: 'get' | 'post' | 'put' | 'patch';
      path: string;
      body?: object;
      allowed: Role[];
    };
    const cases: Case[] = [
      // Reads: every member of the organization, viewers included.
      {
        name: 'read tasks',
        method: 'get',
        path: `${base}/tasks`,
        allowed: ALL,
      },
      {
        name: 'read scope',
        method: 'get',
        path: `${base}/scope`,
        allowed: ALL,
      },
      {
        name: 'read scope map',
        method: 'get',
        path: `${base}/scope-map`,
        allowed: ALL,
      },
      {
        name: 'read deliverables',
        method: 'get',
        path: `${base}/deliverables`,
        allowed: ALL,
      },
      {
        name: 'read activity feed',
        method: 'get',
        path: `${orgBase}/activity`,
        allowed: ALL,
      },
      {
        name: 'read members',
        method: 'get',
        path: `${orgBase}/members`,
        allowed: ALL,
      },
      // Day-to-day work: everyone but viewers.
      {
        name: 'create task',
        method: 'post',
        path: `${base}/tasks`,
        body: { title: 'x' },
        allowed: EDITORS,
      },
      {
        name: 'update task',
        method: 'patch',
        path: `${base}/tasks/${task.id}`,
        body: { priority: 'HIGH' },
        allowed: EDITORS,
      },
      {
        name: 'comment',
        method: 'post',
        path: `${base}/tasks/${task.id}/comments`,
        body: { body: 'hi' },
        allowed: EDITORS,
      },
      {
        name: 'log a risk',
        method: 'post',
        path: `${base}/risks`,
        body: { type: 'RISK', title: 'r', probability: 2, impact: 2 },
        allowed: EDITORS,
      },
      {
        name: 'log a document',
        method: 'post',
        path: `${base}/documents`,
        body: { title: 'd', url: 'https://example.test/d' },
        allowed: EDITORS,
      },
      {
        name: 'create deliverable',
        method: 'post',
        path: `${base}/deliverables`,
        body: { name: 'x' },
        allowed: EDITORS,
      },
      {
        name: 'submit deliverable',
        method: 'post',
        path: `${base}/deliverables/${deliverable.id}/submit`,
        allowed: EDITORS,
      },
      {
        name: 'write WBS dictionary',
        method: 'put',
        path: `${base}/wbs/${task.id}/dictionary`,
        body: { scopeDescription: 'x' },
        allowed: EDITORS,
      },
      // Management artifacts: PM and above.
      {
        name: 'edit charter',
        method: 'put',
        path: `${base}/charter`,
        body: { purpose: 'y' },
        allowed: MANAGERS,
      },
      {
        name: 'edit scope',
        method: 'put',
        path: `${base}/scope`,
        body: { inScope: 'y' },
        allowed: MANAGERS,
      },
      {
        name: 'add stakeholder',
        method: 'post',
        path: `${base}/stakeholders`,
        body: { fullName: 's' },
        allowed: MANAGERS,
      },
      {
        name: 'edit project',
        method: 'patch',
        path: base,
        body: { description: 'z' },
        allowed: MANAGERS,
      },
      {
        name: 'create project',
        method: 'post',
        path: `${orgBase}/projects`,
        body: { key: 'ZZ', name: 'Z' },
        allowed: MANAGERS,
      },
      {
        name: 'accept deliverable',
        method: 'post',
        path: `${base}/deliverables/${deliverable.id}/accept`,
        allowed: MANAGERS,
      },
      // Sign-off and organization admin.
      {
        name: 'approve charter',
        method: 'post',
        path: `${base}/charter/approve`,
        allowed: SPONSORS,
      },
      {
        name: 'approve scope',
        method: 'post',
        path: `${base}/scope/approve`,
        allowed: SPONSORS,
      },
      {
        name: 'invite a member',
        method: 'post',
        path: `${orgBase}/invites`,
        body: { email: 'x@example.test', role: 'VIEWER' },
        allowed: SPONSORS,
      },
      {
        name: 'rename organization',
        method: 'patch',
        path: orgBase,
        body: { name: 'Matrix Org' },
        allowed: SPONSORS,
      },
    ];

    const failures: string[] = [];
    for (const c of cases) {
      for (const role of ALL) {
        const res = await http()
          [c.method](c.path)
          .set('Authorization', `Bearer ${tokens[role]}`)
          .send(c.body ?? {});
        const denied = res.status === 403;
        const allowed = c.allowed.includes(role);
        // An allowed role must actually succeed (409 = a valid action in the wrong state).
        const brokenAllowed =
          allowed && res.status >= 400 && res.status !== 409;
        if (allowed === denied || brokenAllowed) {
          failures.push(
            `${c.name} as ${role}: got ${res.status}, expected ${allowed ? 'success' : '403'}`,
          );
        }
      }
      const out = await http()
        [c.method](c.path)
        .set('Authorization', `Bearer ${outsider.accessToken}`)
        .send(c.body ?? {});
      if (out.status !== 403)
        failures.push(`${c.name} as outsider: got ${out.status}, expected 403`);
    }
    expect(failures).toEqual([]);

    // Deleting a deliverable erases its sign-off trail: reviewers only.
    await http()
      .delete(`${base}/deliverables/${deliverable.id}`)
      .set('Authorization', `Bearer ${tokens.MEMBER}`)
      .expect(403);
    await http()
      .delete(`${base}/deliverables/${deliverable.id}`)
      .set('Authorization', `Bearer ${tokens.PM}`)
      .expect(200);
  });

  it("a role held on one project cannot be used to reach another project's records", async () => {
    const owner = await registerUser('Cross Owner');
    const org = await createOrg(owner.accessToken, 'Cross Org');
    const viewer = await inviteAndAccept(
      owner.accessToken,
      org.slug,
      'VIEWER',
      'Cross Viewer',
    );
    const viewerId = await getUserId(viewer.email);
    const projA = await createProject(owner.accessToken, org.slug, 'CRA');
    const projB = await createProject(owner.accessToken, org.slug, 'CRB');
    const http = () => request(app.getHttpServer());
    const asOwner = { Authorization: `Bearer ${owner.accessToken}` };
    const asViewer = { Authorization: `Bearer ${viewer.accessToken}` };
    const url = (key: string, path: string) =>
      `${API_PREFIX}/organizations/${org.slug}/projects/${key}/${path}`;

    // The viewer is promoted to PM on project A only.
    await http()
      .post(url(projA.key, 'members'))
      .set(asOwner)
      .send({ userId: viewerId, role: 'PM' })
      .expect(201);

    const risk = (
      await http()
        .post(url(projB.key, 'risks'))
        .set(asOwner)
        .send({ type: 'RISK', title: 'B risk', probability: 2, impact: 2 })
        .expect(201)
    ).body.data;
    const task = (
      await http()
        .post(url(projB.key, 'tasks'))
        .set(asOwner)
        .send({ title: 'B task' })
        .expect(201)
    ).body.data;
    const doc = (
      await http()
        .post(url(projB.key, 'documents'))
        .set(asOwner)
        .send({ title: 'B doc', url: 'https://example.test/b' })
        .expect(201)
    ).body.data;

    // Through project A's URL the viewer is PM — but B's records are not A's.
    await http()
      .patch(url(projA.key, `risks/${risk.id}`))
      .set(asViewer)
      .send({ title: 'hijack' })
      .expect(404);
    await http()
      .delete(url(projA.key, `risks/${risk.id}`))
      .set(asViewer)
      .expect(404);
    await http()
      .patch(url(projA.key, `tasks/${task.id}`))
      .set(asViewer)
      .send({ title: 'hijack' })
      .expect(404);
    await http()
      .delete(url(projA.key, `tasks/${task.id}`))
      .set(asViewer)
      .expect(404);
    await http()
      .patch(url(projA.key, `documents/${doc.id}`))
      .set(asViewer)
      .send({ name: 'hijack' })
      .expect(404);
    await http()
      .get(url(projA.key, `tasks/${task.id}`))
      .set(asViewer)
      .expect(404);

    // Through project B's own URL the viewer is still just a viewer.
    await http()
      .patch(url(projB.key, `risks/${risk.id}`))
      .set(asViewer)
      .send({ title: 'hijack' })
      .expect(403);

    // Nothing changed, and the owner still reaches them normally.
    const after = await http()
      .get(url(projB.key, `tasks/${task.id}`))
      .set(asOwner)
      .expect(200);
    expect(after.body.data.title).toBe('B task');
  });

  it('an ADMIN cannot demote or remove the OWNER', async () => {
    const owner = await registerUser('Escalation Owner');
    const org = await createOrg(owner.accessToken, 'Escalation Org');
    const admin = await inviteAndAccept(
      owner.accessToken,
      org.slug,
      'ADMIN',
      'Escalation Admin',
    );
    const members = await request(app.getHttpServer())
      .get(`${API_PREFIX}/organizations/${org.slug}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    const list = members.body.data as {
      id: string;
      role: string;
      user: { email: string };
    }[];
    const ownerRow = list.find((m) => m.user.email === owner.email)!;
    const adminRow = list.find((m) => m.user.email === admin.email)!;
    const url = (id: string) =>
      `${API_PREFIX}/organizations/${org.slug}/members/${id}`;
    const asAdmin = { Authorization: `Bearer ${admin.accessToken}` };

    // An ADMIN cannot make anyone an OWNER (only an OWNER can).
    await request(app.getHttpServer())
      .patch(url(adminRow.id))
      .set(asAdmin)
      .send({ role: 'OWNER' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(url(ownerRow.id))
      .set(asAdmin)
      .send({ role: 'MEMBER' })
      .expect(403);
    await request(app.getHttpServer())
      .delete(url(ownerRow.id))
      .set(asAdmin)
      .expect(403);

    // An OWNER can hand the role over, after which the new owner may remove the old one.
    await request(app.getHttpServer())
      .patch(url(adminRow.id))
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ role: 'OWNER' })
      .expect(200);
    await request(app.getHttpServer())
      .delete(url(ownerRow.id))
      .set(asAdmin)
      .expect(200);
  });

  it('refuses to assign work to, or name as owner, someone outside the organization', async () => {
    const owner = await registerUser('Foreign Owner');
    const org = await createOrg(owner.accessToken, 'Foreign Org');
    const project = await createProject(owner.accessToken, org.slug, 'FRN');
    const outsider = await registerUser('Foreign Outsider');
    await createOrg(outsider.accessToken, 'Foreign Outsider Org');
    const outsiderId = await getUserId(outsider.email);
    const base = `${API_PREFIX}/organizations/${org.slug}/projects/${project.key}`;
    const auth = { Authorization: `Bearer ${owner.accessToken}` };
    const http = () => request(app.getHttpServer());

    await http()
      .post(`${base}/tasks`)
      .set(auth)
      .send({ title: 'x', assigneeId: outsiderId })
      .expect(400);
    await http()
      .post(`${base}/tasks`)
      .set(auth)
      .send({ title: 'x', supporterIds: [outsiderId] })
      .expect(400);
    const task = (
      await http()
        .post(`${base}/tasks`)
        .set(auth)
        .send({ title: 'ok' })
        .expect(201)
    ).body.data;
    await http()
      .patch(`${base}/tasks/${task.id}`)
      .set(auth)
      .send({ assigneeId: outsiderId })
      .expect(400);
    await http()
      .post(`${base}/deliverables`)
      .set(auth)
      .send({ name: 'd', ownerId: outsiderId })
      .expect(400);
    await http()
      .post(`${base}/risks`)
      .set(auth)
      .send({
        type: 'RISK',
        title: 'r',
        probability: 1,
        impact: 1,
        ownerId: outsiderId,
      })
      .expect(400);
    await http()
      .put(`${base}/charter`)
      .set(auth)
      .send({ projectManagerId: outsiderId })
      .expect(400);
  });
});

describe('Free-tier cost controls', () => {
  it('caps AI calls per organization per day, and counts each organization separately', async () => {
    const ownerA = await registerUser('Quota Owner A');
    const orgA = await createOrg(ownerA.accessToken, 'Quota Org A');
    const ownerB = await registerUser('Quota Owner B');
    const orgB = await createOrg(ownerB.accessToken, 'Quota Org B');
    const quota = app.get(AiQuotaService);
    const idOf = async (slug: string) =>
      (
        await app
          .get(PrismaService)
          .db.organization.findUniqueOrThrow({ where: { slug } })
      ).id;
    const a = await idOf(orgA.slug);
    const b = await idOf(orgB.slug);

    // vitest.integration.config.mts sets AI_DAILY_LIMIT_PER_ORG=3.
    for (let i = 1; i <= 3; i++) expect((await quota.consume(a)).used).toBe(i);
    await expect(quota.consume(a)).rejects.toMatchObject({ status: 429 });
    expect((await quota.consume(b)).used).toBe(1);

    // A new Vietnam day starts a fresh allowance.
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    expect((await quota.consume(a, tomorrow)).used).toBe(1);
  });

  it('limits how many organizations one account may own', async () => {
    const owner = await registerUser('Many Orgs Owner');
    for (let i = 1; i <= 5; i++)
      await createOrg(owner.accessToken, `Cap Org ${i}`);
    await request(app.getHttpServer())
      .post(`${API_PREFIX}/organizations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Cap Org 6', slug: `cap-org-6-${Date.now()}` })
      .expect(403);
  });
});

describe('Password reset and email verification', () => {
  const http = () => request(app.getHttpServer());
  const tokenFrom = (mail: { text: string }) =>
    /token=([a-f0-9]+)/.exec(mail.text)![1]!;
  const mailsTo = (to: string) =>
    app.get(MailService).outbox.filter((m) => m.to === to);
  // The sign-up email is sent after the response, so wait for it to land.
  const waitForMail = async (to: string) => {
    for (let i = 0; i < 50 && mailsTo(to).length === 0; i++)
      await new Promise((r) => setTimeout(r, 50));
    return mailsTo(to);
  };

  it('emails a verification link on sign-up and marks the account verified when it is followed', async () => {
    const user = await registerUser('Verify Me');
    const me = () =>
      http()
        .get(`${API_PREFIX}/auth/me`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);
    expect((await me()).body.data.emailVerified).toBe(false);

    const [mail] = await waitForMail(user.email);
    expect(mail!.subject).toContain('Xác minh');
    const token = tokenFrom(mail!);

    await http()
      .post(`${API_PREFIX}/auth/verify-email`)
      .send({ token: 'nope' })
      .expect(400);
    await http()
      .post(`${API_PREFIX}/auth/verify-email`)
      .send({ token })
      .expect(200);
    expect((await me()).body.data.emailVerified).toBe(true);
    // A link works once.
    await http()
      .post(`${API_PREFIX}/auth/verify-email`)
      .send({ token })
      .expect(400);
    // Nothing more to send once verified.
    const again = await http()
      .post(`${API_PREFIX}/auth/resend-verification`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);
    expect(again.body.data.alreadyVerified).toBe(true);
  });

  it('resets a forgotten password once, ends old sessions, and never reveals whether an email has an account', async () => {
    const user = await registerUser('Forgot Pass');
    const before = mailsTo('nobody-here@example.test').length;

    // Unknown email: same answer, no email.
    await http()
      .post(`${API_PREFIX}/auth/forgot-password`)
      .send({ email: 'nobody-here@example.test' })
      .expect(200);
    expect(mailsTo('nobody-here@example.test').length).toBe(before);

    await http()
      .post(`${API_PREFIX}/auth/forgot-password`)
      .send({ email: user.email })
      .expect(200);
    const resetMail = mailsTo(user.email).find((m) =>
      m.subject.includes('Đặt lại'),
    )!;
    const token = tokenFrom(resetMail);

    // The new password must satisfy the same rules as registration.
    await http()
      .post(`${API_PREFIX}/auth/reset-password`)
      .send({ token, password: 'weak' })
      .expect(400);
    await http()
      .post(`${API_PREFIX}/auth/reset-password`)
      .send({ token, password: 'BrandNew123' })
      .expect(200);

    await http()
      .post(`${API_PREFIX}/auth/login`)
      .send({ email: user.email, password: 'Password123' })
      .expect(401);
    await http()
      .post(`${API_PREFIX}/auth/login`)
      .send({ email: user.email, password: 'BrandNew123' })
      .expect(200);
    // The link is single-use.
    await http()
      .post(`${API_PREFIX}/auth/reset-password`)
      .send({ token, password: 'Another123' })
      .expect(400);

    // Following the emailed link also proves the address.
    const login = await http()
      .post(`${API_PREFIX}/auth/login`)
      .send({ email: user.email, password: 'BrandNew123' })
      .expect(200);
    expect(login.body.data.user.emailVerified).toBe(true);
  });

  it('a newer reset link voids the older one', async () => {
    const user = await registerUser('Two Links');
    await http()
      .post(`${API_PREFIX}/auth/forgot-password`)
      .send({ email: user.email })
      .expect(200);
    await http()
      .post(`${API_PREFIX}/auth/forgot-password`)
      .send({ email: user.email })
      .expect(200);
    const [first, second] = mailsTo(user.email).filter((m) =>
      m.subject.includes('Đặt lại'),
    );
    await http()
      .post(`${API_PREFIX}/auth/reset-password`)
      .send({ token: tokenFrom(first!), password: 'Newer1234' })
      .expect(400);
    await http()
      .post(`${API_PREFIX}/auth/reset-password`)
      .send({ token: tokenFrom(second!), password: 'Newer1234' })
      .expect(200);
  });

  it('emails an invitation while still returning the link', async () => {
    const owner = await registerUser('Invite Mail Owner');
    const org = await createOrg(owner.accessToken, 'Invite Mail Org');
    const invitee = await registerUser('Invite Mail Guest');
    const res = await http()
      .post(`${API_PREFIX}/organizations/${org.slug}/invites`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: invitee.email, role: 'MEMBER' })
      .expect(201);
    expect(res.body.data.rawToken).toBeTruthy();
    const mail = mailsTo(invitee.email).find(
      (m) =>
        m.subject.includes('Invite Mail Org') || m.subject.includes('Lời mời'),
    )!;
    expect(mail.text).toContain(`token=${res.body.data.rawToken}`);
    expect(mail.text).toContain('Invite Mail Owner');
  });
});

describe('Privacy: export and account deletion', () => {
  const http = () => request(app.getHttpServer());
  const asUser = (u: { accessToken: string }) => ({
    Authorization: `Bearer ${u.accessToken}`,
  });

  it('exports a person their own data and an organization its workspace (owners/admins only)', async () => {
    const owner = await registerUser('Export Owner');
    const org = await createOrg(owner.accessToken, 'Export Org');
    const member = await inviteAndAccept(
      owner.accessToken,
      org.slug,
      'MEMBER',
      'Export Member',
    );
    const project = await createProject(owner.accessToken, org.slug, 'EXP');
    const base = `${API_PREFIX}/organizations/${org.slug}/projects/${project.key}`;
    const task = (
      await http()
        .post(`${base}/tasks`)
        .set(asUser(owner))
        .send({
          title: 'Việc cần xuất',
          assigneeId: await getUserId(member.email),
        })
        .expect(201)
    ).body.data;
    await http()
      .post(`${base}/tasks/${task.id}/comments`)
      .set(asUser(member))
      .send({ body: 'Bình luận của member' })
      .expect(201);

    const mine = (
      await http()
        .get(`${API_PREFIX}/users/me/export`)
        .set(asUser(member))
        .expect(200)
    ).body.data;
    expect(mine.profile.email).toBe(member.email);
    expect(JSON.stringify(mine)).not.toContain('passwordHash');
    expect(mine.organizations).toEqual([
      { name: 'Export Org', slug: org.slug, role: 'MEMBER' },
    ]);
    expect(mine.assignedTasks.map((t: { title: string }) => t.title)).toContain(
      'Việc cần xuất',
    );
    expect(mine.comments).toHaveLength(1);

    const orgUrl = `${API_PREFIX}/organizations/${org.slug}/export`;
    await http().get(orgUrl).set(asUser(member)).expect(403);
    const all = (await http().get(orgUrl).set(asUser(owner)).expect(200)).body
      .data;
    expect(all.organization.slug).toBe(org.slug);
    expect(all.tasks.map((t: { title: string }) => t.title)).toContain(
      'Việc cần xuất',
    );
    expect(all.comments[0].author.email).toBe(member.email);
    expect(all.members.map((m: { email: string }) => m.email).sort()).toEqual(
      [owner.email, member.email].sort(),
    );
    expect(JSON.stringify(all)).not.toContain('passwordHash');

    const stranger = await registerUser('Export Stranger');
    await createOrg(stranger.accessToken, 'Export Stranger Org');
    await http().get(orgUrl).set(asUser(stranger)).expect(403);
  });

  it('lets only an OWNER delete an organization, with their password, taking all its data along', async () => {
    const owner = await registerUser('Org Delete Owner');
    const org = await createOrg(owner.accessToken, 'Org To Delete');
    const admin = await inviteAndAccept(
      owner.accessToken,
      org.slug,
      'ADMIN',
      'Org Delete Admin',
    );
    const project = await createProject(owner.accessToken, org.slug, 'ODL');
    await http()
      .post(
        `${API_PREFIX}/organizations/${org.slug}/projects/${project.key}/tasks`,
      )
      .set(asUser(owner))
      .send({ title: 'Sẽ biến mất' })
      .expect(201);
    const url = `${API_PREFIX}/organizations/${org.slug}`;

    await http()
      .delete(url)
      .set(asUser(admin))
      .send({ password: 'Password123' })
      .expect(403);
    await http()
      .delete(url)
      .set(asUser(owner))
      .send({ password: 'WrongPass123' })
      .expect(403);
    await http()
      .delete(url)
      .set(asUser(owner))
      .send({ password: 'Password123' })
      .expect(204);

    const prisma = app.get(PrismaService);
    expect(
      await prisma.db.organization.count({ where: { slug: org.slug } }),
    ).toBe(0);
    expect(
      await prisma.db.task.count({ where: { title: 'Sẽ biến mất' } }),
    ).toBe(0);
    await http().get(url).set(asUser(owner)).expect(404);
  });

  it('erases an account: needs the password, refuses to orphan a shared organization, keeps what others rely on', async () => {
    const owner = await registerUser('Erase Owner');
    const org = await createOrg(owner.accessToken, 'Erase Shared Org');
    const member = await inviteAndAccept(
      owner.accessToken,
      org.slug,
      'MEMBER',
      'Erase Member',
    );
    const project = await createProject(owner.accessToken, org.slug, 'ERS');
    const base = `${API_PREFIX}/organizations/${org.slug}/projects/${project.key}`;
    const task = (
      await http()
        .post(`${base}/tasks`)
        .set(asUser(owner))
        .send({ title: 'Việc chung' })
        .expect(201)
    ).body.data;
    await http()
      .post(`${base}/tasks/${task.id}/comments`)
      .set(asUser(member))
      .send({ body: 'Tôi sẽ rời đi' })
      .expect(201);

    const del = (u: { accessToken: string }, password: string) =>
      http().delete(`${API_PREFIX}/users/me`).set(asUser(u)).send({ password });

    // Wrong password: refused.
    await del(member, 'WrongPass123').expect(403);
    // The only OWNER of an organization that still has other people cannot leave it headless.
    await del(owner, 'Password123').expect(409);

    // A plain member can leave; their comment stays, attributed to the placeholder name.
    await del(member, 'Password123').expect(204);
    await http()
      .post(`${API_PREFIX}/auth/login`)
      .send({ email: member.email, password: 'Password123' })
      .expect(401);
    const comments = (
      await http()
        .get(`${base}/tasks/${task.id}/comments`)
        .set(asUser(owner))
        .expect(200)
    ).body.data;
    expect(comments).toHaveLength(1);
    expect(comments[0].author.fullName).toBe('Người dùng đã xoá');
    const members = (
      await http()
        .get(`${API_PREFIX}/organizations/${org.slug}/members`)
        .set(asUser(owner))
        .expect(200)
    ).body.data;
    expect(members).toHaveLength(1);

    // Now the owner is alone, so deleting the account deletes the organization with it.
    const ownerId = await getUserId(owner.email);
    await del(owner, 'Password123').expect(204);
    const prisma = app.get(PrismaService);
    expect(
      await prisma.db.organization.count({ where: { slug: org.slug } }),
    ).toBe(0);
    const row = await prisma.db.user.findUniqueOrThrow({
      where: { email: `deleted-${ownerId}@deleted.invalid` },
    });
    expect(row.fullName).toBe('Người dùng đã xoá');
    // The address is free again.
    await request(app.getHttpServer())
      .post(`${API_PREFIX}/auth/register`)
      .send({
        email: owner.email,
        password: 'Password123',
        fullName: 'Back Again',
      })
      .expect(201);
  });
});

describe('Project templates', () => {
  it('starts a project from a template: scope, WBS with dictionary, milestones, records and risks, with a clean coverage report', async () => {
    const owner = await registerUser('Template Owner');
    const org = await createOrg(owner.accessToken, 'Template Org');
    const http = () => request(app.getHttpServer());
    const auth = { Authorization: `Bearer ${owner.accessToken}` };
    const stats = templateStats(findTemplate('software')!);

    const created = await http()
      .post(`${API_PREFIX}/organizations/${org.slug}/projects`)
      .set(auth)
      .send({
        key: 'TPL',
        name: 'Từ mẫu',
        templateId: 'software',
        locale: 'vi',
        startDate: '2026-09-21T05:00:00.000Z',
      })
      .expect(201);
    expect(created.body.data.startDate).toBeTruthy();
    expect(created.body.data.targetEndDate).toBeTruthy();

    const base = `${API_PREFIX}/organizations/${org.slug}/projects/TPL`;
    const tasks = (await http().get(`${base}/tasks`).set(auth).expect(200)).body
      .data as {
      humanKey: string;
      nodeType: string;
      isMilestone: boolean;
      dueDate: string;
    }[];
    const total =
      stats.phases +
      stats.deliverables +
      stats.workPackages +
      stats.activities +
      stats.milestones;
    expect(tasks).toHaveLength(total);
    expect(tasks.filter((t) => t.isMilestone)).toHaveLength(stats.milestones);
    expect(tasks.every((t) => t.dueDate)).toBe(true);
    const scope = (await http().get(`${base}/scope`).set(auth).expect(200)).body
      .data;
    expect(scope.status).toBe('DRAFT');
    expect(scope.inScope).toContain('Phân tích yêu cầu');

    const deliverables = (
      await http().get(`${base}/deliverables`).set(auth).expect(200)
    ).body.data;
    expect(deliverables).toHaveLength(stats.deliverables);
    const risks = (await http().get(`${base}/risks`).set(auth).expect(200)).body
      .data;
    expect(risks).toHaveLength(stats.risks);

    // Every template gap check that a template can satisfy is satisfied.
    const map = (await http().get(`${base}/scope-map`).set(auth).expect(200))
      .body.data;
    const failing = (key: string) =>
      map.checks.find((c: { key: string }) => c.key === key).offenders;
    expect(failing('workPackageWithoutActivity')).toEqual([]);
    expect(failing('workPackageWithoutDictionary')).toEqual([]);
    expect(failing('deliverableWithoutCriteria')).toEqual([]);
    expect(failing('deliverableWithoutRecord')).toEqual([]);
    expect(failing('activityOutsideWorkPackage')).toEqual([]);
    expect(failing('milestoneWithoutDeliverable')).toEqual([]);
    expect(failing('singleChildParent')).toEqual([]);

    // Keys run TPL-1..TPL-n with no gaps, so the next task continues the sequence.
    const next = await http()
      .post(`${base}/tasks`)
      .set(auth)
      .send({ title: 'Việc mới' })
      .expect(201);
    expect(next.body.data.humanKey).toBe(`TPL-${total + 1}`);
  });

  it('rejects an unknown template and builds English content on request', async () => {
    const owner = await registerUser('Template En');
    const org = await createOrg(owner.accessToken, 'Template En Org');
    const http = () => request(app.getHttpServer());
    const auth = { Authorization: `Bearer ${owner.accessToken}` };
    const url = `${API_PREFIX}/organizations/${org.slug}/projects`;

    await http()
      .post(url)
      .set(auth)
      .send({ key: 'NOPE', name: 'x', templateId: 'does-not-exist' })
      .expect(400);
    await http()
      .post(url)
      .set(auth)
      .send({ key: 'EVT', name: 'Event', templateId: 'event', locale: 'en' })
      .expect(201);
    const tasks = (await http().get(`${url}/EVT/tasks`).set(auth).expect(200))
      .body.data as { title: string }[];
    expect(tasks.some((t) => t.title === 'Event plan')).toBe(true);
  });
});

describe('Getting-started checklist', () => {
  it('ticks steps off from what the organization actually has', async () => {
    const owner = await registerUser('Onboard Owner');
    const org = await createOrg(owner.accessToken, 'Onboard Org');
    const http = () => request(app.getHttpServer());
    const auth = { Authorization: `Bearer ${owner.accessToken}` };
    const get = async () =>
      (
        await http()
          .get(`${API_PREFIX}/organizations/${org.slug}/dashboard/onboarding`)
          .set(auth)
          .expect(200)
      ).body.data as {
        steps: { key: string; done: boolean }[];
        completed: boolean;
        projectKey: string | null;
      };
    const done = (r: { steps: { key: string; done: boolean }[] }) =>
      r.steps.filter((s) => s.done).map((s) => s.key);

    const fresh = await get();
    expect(done(fresh)).toEqual([]);
    expect(fresh.projectKey).toBeNull();

    // A template project brings a project, tasks, scope/WBS and deliverables in one go.
    await http()
      .post(`${API_PREFIX}/organizations/${org.slug}/projects`)
      .set(auth)
      .send({ key: 'ONB', name: 'Onboarding', templateId: 'software' })
      .expect(201);
    const afterTemplate = await get();
    expect(done(afterTemplate)).toEqual([
      'createProject',
      'addTasks',
      'defineScope',
      'addDeliverable',
    ]);
    expect(afterTemplate.projectKey).toBe('ONB');
    expect(afterTemplate.completed).toBe(false);

    // A pending invitation counts as inviting a teammate.
    await http()
      .post(`${API_PREFIX}/organizations/${org.slug}/invites`)
      .set(auth)
      .send({ email: 'someone@example.test', role: 'MEMBER' })
      .expect(201);
    const all = await get();
    expect(all.completed).toBe(true);

    // Another organization's checklist is not readable.
    const other = await registerUser('Onboard Other');
    await createOrg(other.accessToken, 'Onboard Other Org');
    await http()
      .get(`${API_PREFIX}/organizations/${org.slug}/dashboard/onboarding`)
      .set({ Authorization: `Bearer ${other.accessToken}` })
      .expect(403);
  });
});

describe('Task CSV import and export', () => {
  it('round-trips a WBS through CSV into another project, keeping hierarchy, dates and people', async () => {
    const owner = await registerUser('Csv Owner');
    const org = await createOrg(owner.accessToken, 'Csv Org');
    const helper = await inviteAndAccept(
      owner.accessToken,
      org.slug,
      'MEMBER',
      'Csv Helper',
    );
    const viewer = await inviteAndAccept(
      owner.accessToken,
      org.slug,
      'VIEWER',
      'Csv Viewer',
    );
    const http = () => request(app.getHttpServer());
    const auth = { Authorization: `Bearer ${owner.accessToken}` };
    const projects = `${API_PREFIX}/organizations/${org.slug}/projects`;

    await http()
      .post(projects)
      .set(auth)
      .send({
        key: 'SRC',
        name: 'Source',
        templateId: 'software',
        locale: 'vi',
        startDate: '2026-09-21T05:00:00.000Z',
      })
      .expect(201);
    const srcTasks = (
      await http().get(`${projects}/SRC/tasks`).set(auth).expect(200)
    ).body.data as { id: string; title: string }[];
    // Give one task people so they survive the trip.
    await http()
      .patch(`${projects}/SRC/tasks/${srcTasks[5]!.id}`)
      .set(auth)
      .send({
        assigneeId: await getUserId(helper.email),
        supporterIds: [await getUserId(owner.email)],
        description: '=cmd|calc',
      })
      .expect(200);

    const exported = await http()
      .get(`${projects}/SRC/task-csv/export`)
      .set(auth)
      .expect(200);
    expect(exported.headers['content-type']).toContain('text/csv');
    expect(exported.headers['content-disposition']).toContain('SRC-wbs-');
    const csv = exported.text;
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain(helper.email);
    // A description that looks like a formula is defused for spreadsheets.
    expect(csv).toContain("'=cmd|calc");

    await http()
      .post(projects)
      .set(auth)
      .send({ key: 'DST', name: 'Destination' })
      .expect(201);
    const importUrl = `${projects}/DST/task-csv/import`;

    // A viewer may export but not import.
    await http()
      .get(`${projects}/SRC/task-csv/export`)
      .set({ Authorization: `Bearer ${viewer.accessToken}` })
      .expect(200);
    await http()
      .post(importUrl)
      .set({ Authorization: `Bearer ${viewer.accessToken}` })
      .send({ csv })
      .expect(403);

    const dry = (
      await http()
        .post(importUrl)
        .set(auth)
        .send({ csv, dryRun: true })
        .expect(200)
    ).body.data;
    expect(dry.errors).toEqual([]);
    expect(dry.committed).toBe(false);
    expect(dry.valid).toBe(srcTasks.length);
    expect(
      (await http().get(`${projects}/DST/tasks`).set(auth).expect(200)).body
        .data,
    ).toHaveLength(0);

    const done = (
      await http().post(importUrl).set(auth).send({ csv }).expect(200)
    ).body.data;
    expect(done.committed).toBe(true);

    const dstTasks = (
      await http().get(`${projects}/DST/tasks`).set(auth).expect(200)
    ).body.data as {
      title: string;
      humanKey: string;
      nodeType: string;
      parentTaskId: string | null;
      dueDate: string | null;
      assignees: { role: string; fullName: string }[];
      description: string | null;
    }[];
    expect(dstTasks).toHaveLength(srcTasks.length);
    expect(dstTasks.map((t) => t.humanKey).sort()).toEqual(
      Array.from({ length: srcTasks.length }, (_, i) => `DST-${i + 1}`).sort(),
    );
    // Same shape: same titles per type, same number of roots, dates carried over.
    const count = (list: { nodeType: string }[], type: string) =>
      list.filter((t) => t.nodeType === type).length;
    for (const type of ['PHASE', 'DELIVERABLE', 'WORK_PACKAGE', 'ACTIVITY']) {
      expect(count(dstTasks, type)).toBe(
        count(
          (await http().get(`${projects}/SRC/tasks`).set(auth).expect(200)).body
            .data,
          type,
        ),
      );
    }
    expect(dstTasks.filter((t) => t.parentTaskId === null).length).toBe(3);
    expect(dstTasks.every((t) => t.dueDate)).toBe(true);
    const withPeople = dstTasks.find((t) => t.assignees.length === 2)!;
    expect(
      withPeople.assignees.find((a) => a.role === 'PRIMARY')!.fullName,
    ).toBe('Csv Helper');
    // The defused formula is restored to the original text.
    expect(withPeople.description).toBe('=cmd|calc');
  });

  it('reports problems by line number and creates nothing when any line is bad', async () => {
    const owner = await registerUser('Csv Errors');
    const org = await createOrg(owner.accessToken, 'Csv Errors Org');
    const outsider = await registerUser('Csv Outsider');
    const project = await createProject(owner.accessToken, org.slug, 'CER');
    const http = () => request(app.getHttpServer());
    const auth = { Authorization: `Bearer ${owner.accessToken}` };
    const base = `${API_PREFIX}/organizations/${org.slug}/projects/${project.key}`;

    const csv = [
      'title,due,assignee',
      'Hợp lệ,2026-10-01,',
      ',2026-10-02,',
      `Người lạ,,${outsider.email}`,
    ].join('\n');
    const res = (
      await http()
        .post(`${base}/task-csv/import`)
        .set(auth)
        .send({ csv })
        .expect(200)
    ).body.data;
    expect(res.committed).toBe(false);
    expect(res.errors.map((e: { line: number }) => e.line)).toEqual([3, 4]);
    expect(res.valid).toBe(1);
    expect(
      (await http().get(`${base}/tasks`).set(auth).expect(200)).body.data,
    ).toHaveLength(0);

    await http()
      .post(`${base}/task-csv/import`)
      .set(auth)
      .send({ csv: '' })
      .expect(400);
  });
});

describe('Notifications and my tasks', () => {
  it('tells people about assignments, comments and sign-off, privately, and lists their tasks across projects', async () => {
    const owner = await registerUser('Notify Owner');
    const org = await createOrg(owner.accessToken, 'Notify Org');
    const member = await inviteAndAccept(
      owner.accessToken,
      org.slug,
      'MEMBER',
      'Notify Member',
    );
    const memberId = await getUserId(member.email);
    const http = () => request(app.getHttpServer());
    const asOwner = { Authorization: `Bearer ${owner.accessToken}` };
    const asMember = { Authorization: `Bearer ${member.accessToken}` };
    const orgUrl = `${API_PREFIX}/organizations/${org.slug}`;
    const feed = async (who: typeof asOwner) =>
      (await http().get(`${orgUrl}/notifications`).set(who).expect(200)).body
        .data as {
        items: {
          id: string;
          type: string;
          actorName: string;
          entityTitle: string;
          detail: string | null;
          read: boolean;
          projectKey: string;
        }[];
        unreadCount: number;
      };

    const a = await createProject(owner.accessToken, org.slug, 'NTA');
    const b = await createProject(owner.accessToken, org.slug, 'NTB');
    const taskA = (
      await http()
        .post(`${orgUrl}/projects/${a.key}/tasks`)
        .set(asOwner)
        .send({
          title: 'Việc ở A',
          assigneeId: memberId,
          dueDate: '2026-11-02T05:00:00.000Z',
        })
        .expect(201)
    ).body.data;
    await http()
      .post(`${orgUrl}/projects/${b.key}/tasks`)
      .set(asOwner)
      .send({
        title: 'Việc ở B',
        supporterIds: [memberId],
        dueDate: '2026-10-02T05:00:00.000Z',
      })
      .expect(201);
    await http()
      .post(`${orgUrl}/projects/${b.key}/tasks`)
      .set(asOwner)
      .send({ title: 'Không liên quan' })
      .expect(201);

    // The assignee is told once per task, naming who did it; the actor is not told about their own action.
    let mine = await feed(asMember);
    expect(
      mine.items
        .filter((n) => n.type === 'TASK_ASSIGNED')
        .map((n) => n.entityTitle)
        .sort(),
    ).toEqual(['Việc ở A', 'Việc ở B']);
    expect(mine.items[0]!.actorName).toBe('Notify Owner');
    expect(mine.unreadCount).toBe(2);
    expect((await feed(asOwner)).items).toHaveLength(0);

    // A comment reaches the assignee and the task's creator, but not its author.
    await http()
      .post(`${orgUrl}/projects/${a.key}/tasks/${taskA.id}/comments`)
      .set(asOwner)
      .send({ body: 'Nhớ nộp trước thứ Sáu' })
      .expect(201);
    mine = await feed(asMember);
    const comment = mine.items.find((n) => n.type === 'TASK_COMMENT')!;
    expect(comment.detail).toBe('Nhớ nộp trước thứ Sáu');
    await http()
      .post(`${orgUrl}/projects/${a.key}/tasks/${taskA.id}/comments`)
      .set(asMember)
      .send({ body: 'Đã rõ' })
      .expect(201);
    expect((await feed(asOwner)).items.map((n) => n.type)).toEqual([
      'TASK_COMMENT',
    ]);

    // Reassigning notifies only the newly added person.
    await http()
      .patch(`${orgUrl}/projects/${a.key}/tasks/${taskA.id}`)
      .set(asOwner)
      .send({
        supporterIds: [await getUserId(owner.email)],
        assigneeId: memberId,
      })
      .expect(200);
    expect(
      (await feed(asMember)).items.filter((n) => n.type === 'TASK_ASSIGNED'),
    ).toHaveLength(2);

    // Sign-off: submitting tells the reviewers; deciding tells the deliverable's people.
    const del = (
      await http()
        .post(`${orgUrl}/projects/${a.key}/deliverables`)
        .set(asMember)
        .send({ name: 'Báo cáo A' })
        .expect(201)
    ).body.data;
    await http()
      .post(`${orgUrl}/projects/${a.key}/deliverables/${del.id}/submit`)
      .set(asMember)
      .expect(200);
    expect(
      (await feed(asOwner)).items.some(
        (n) =>
          n.type === 'DELIVERABLE_SUBMITTED' && n.entityTitle === 'Báo cáo A',
      ),
    ).toBe(true);
    await http()
      .post(`${orgUrl}/projects/${a.key}/deliverables/${del.id}/reject`)
      .set(asOwner)
      .send({ reason: 'Thiếu phụ lục' })
      .expect(200);
    const rejected = (await feed(asMember)).items.find(
      (n) => n.type === 'DELIVERABLE_REJECTED',
    )!;
    expect(rejected.detail).toBe('Thiếu phụ lục');
    expect(rejected.projectKey).toBe(a.key);

    // Read state is per person and can be flipped one at a time or all at once.
    const before = (await feed(asMember)).unreadCount;
    await http()
      .post(`${orgUrl}/notifications/${rejected.id}/read`)
      .set(asMember)
      .expect(204);
    expect((await feed(asMember)).unreadCount).toBe(before - 1);
    await http()
      .post(`${orgUrl}/notifications/${rejected.id}/read`)
      .set(asOwner)
      .expect(204); // someone else's: no effect
    expect((await feed(asMember)).unreadCount).toBe(before - 1);
    await http()
      .post(`${orgUrl}/notifications/read-all`)
      .set(asMember)
      .expect(204);
    expect((await feed(asMember)).unreadCount).toBe(0);

    // My tasks: both projects, nearest deadline first, only mine, roles included.
    const list = (
      await http().get(`${orgUrl}/my-tasks`).set(asMember).expect(200)
    ).body.data as { title: string; role: string; projectKey: string }[];
    expect(list.map((t) => [t.title, t.role, t.projectKey])).toEqual([
      ['Việc ở B', 'SUPPORT', 'NTB'],
      ['Việc ở A', 'PRIMARY', 'NTA'],
    ]);
    // The owner only supports task A (added in the reassignment above).
    const ownerList = (
      await http().get(`${orgUrl}/my-tasks`).set(asOwner).expect(200)
    ).body.data as { title: string; role: string }[];
    expect(ownerList.map((t) => [t.title, t.role])).toEqual([
      ['Việc ở A', 'SUPPORT'],
    ]);

    // Another organization cannot read any of it.
    const stranger = await registerUser('Notify Stranger');
    await createOrg(stranger.accessToken, 'Notify Stranger Org');
    await http()
      .get(`${orgUrl}/notifications`)
      .set({ Authorization: `Bearer ${stranger.accessToken}` })
      .expect(403);
    await http()
      .get(`${orgUrl}/my-tasks`)
      .set({ Authorization: `Bearer ${stranger.accessToken}` })
      .expect(403);
  });
});

describe('Sign in with Google', () => {
  const WEB = 'http://localhost:3000';
  const api = `${API_PREFIX}/auth/google`;

  /** Runs start → callback with one browser (cookie jar) and returns the callback response. */
  async function signInWith(
    code: string,
    opts: { redirect?: string; stateOverride?: string } = {},
  ) {
    const agent = request.agent(app.getHttpServer());
    const started = await agent
      .get(`${api}/start`)
      .query({ redirect: opts.redirect, locale: 'vi' })
      .expect(302);
    const state = new URL(started.headers.location!).searchParams.get('state')!;
    const cb = await agent
      .get(`${api}/callback`)
      .query({ code, state: opts.stateOverride ?? state });
    return { agent, started, cb };
  }

  it('reports whether Google sign-in is available', async () => {
    const res = await request(app.getHttpServer())
      .get(`${api}/config`)
      .expect(200);
    expect(res.body.data.enabled).toBe(true);
  });

  it('creates an account on first sign-in, signs in through the refresh cookie, and is idempotent', async () => {
    const email = `gnew_${Date.now()}@example.com`;
    const { agent, started, cb } = await signInWith(
      `${email}|Nguyễn Gờ|verified`,
      { redirect: '/vi/some/page' },
    );
    expect(started.headers.location).toContain(
      'https://accounts.example.test/auth?state=',
    );
    expect(cb.status).toBe(302);
    expect(cb.headers.location).toBe(
      `${WEB}/vi/auth/google-done?redirect=%2Fvi%2Fsome%2Fpage`,
    );

    // The web page then trades the refresh cookie for an access token.
    const session = await agent.post(`${API_PREFIX}/auth/refresh`).expect(200);
    const me = await request(app.getHttpServer())
      .get(`${API_PREFIX}/auth/me`)
      .set('Authorization', `Bearer ${session.body.data.accessToken}`)
      .expect(200);
    expect(me.body.data).toMatchObject({
      email,
      fullName: 'Nguyễn Gờ',
      emailVerified: true,
      hasPassword: false,
    });

    // Signing in again reuses the account.
    await signInWith(`${email}|Tên khác|verified`);
    const count = await app
      .get(PrismaService)
      .db.user.count({ where: { email } });
    expect(count).toBe(1);
  });

  it('links to an existing password account by email and verifies it, without touching its password', async () => {
    const user = await registerUser('Has Password');
    const before = await app
      .get(PrismaService)
      .db.user.findUniqueOrThrow({ where: { email: user.email } });
    expect(before.emailVerifiedAt).toBeNull();

    const { cb } = await signInWith(`${user.email}|Whatever|verified`);
    expect(cb.headers.location).toContain('/vi/auth/google-done');
    const after = await app
      .get(PrismaService)
      .db.user.findUniqueOrThrow({ where: { email: user.email } });
    expect(after.id).toBe(before.id);
    expect(after.emailVerifiedAt).not.toBeNull();
    expect(after.hasPassword).toBe(true);
    expect(after.passwordHash).toBe(before.passwordHash);
    await request(app.getHttpServer())
      .post(`${API_PREFIX}/auth/login`)
      .send({ email: user.email, password: 'Password123' })
      .expect(200);
  });

  it('refuses a forged state, an unverified Google email, a failed exchange, and never creates the account', async () => {
    const email = `gbad_${Date.now()}@example.com`;
    const prisma = app.get(PrismaService);

    const forged = await signInWith(`${email}|X|verified`, {
      stateOverride: 'not-the-state',
    });
    expect(forged.cb.headers.location).toBe(`${WEB}/vi/login?error=google`);
    const unverified = await signInWith(`${email}|X|unverified`);
    expect(unverified.cb.headers.location).toBe(`${WEB}/vi/login?error=google`);
    const failed = await signInWith('boom');
    expect(failed.cb.headers.location).toBe(`${WEB}/vi/login?error=google`);
    // No cookie at all (callback opened directly): also refused.
    const bare = await request(app.getHttpServer())
      .get(`${api}/callback`)
      .query({ code: `${email}|X|verified`, state: 'x' });
    expect(bare.headers.location).toBe(`${WEB}/vi/login?error=google`);
    expect(await prisma.db.user.count({ where: { email } })).toBe(0);
  });

  it('only follows a same-site relative path after sign-in', async () => {
    const email = `gredir_${Date.now()}@example.com`;
    const { cb } = await signInWith(`${email}|R|verified`, {
      redirect: 'https://evil.example/steal',
    });
    expect(cb.headers.location).toBe(`${WEB}/vi/auth/google-done`);
    const { cb: cb2 } = await signInWith(`${email}|R|verified`, {
      redirect: '//evil.example',
    });
    expect(cb2.headers.location).toBe(`${WEB}/vi/auth/google-done`);
  });

  it('lets a Google-only account delete itself by retyping its email, since it has no password', async () => {
    const email = `gdel_${Date.now()}@example.com`;
    const { agent } = await signInWith(`${email}|Del|verified`);
    const token = (await agent.post(`${API_PREFIX}/auth/refresh`).expect(200))
      .body.data.accessToken as string;
    const auth = { Authorization: `Bearer ${token}` };
    const del = (body: object) =>
      request(app.getHttpServer())
        .delete(`${API_PREFIX}/users/me`)
        .set(auth)
        .send(body);

    await del({ password: 'anything' }).expect(403);
    await del({ confirmEmail: 'someone@else.com' }).expect(403);
    await del({ confirmEmail: email.toUpperCase() }).expect(204);
    expect(
      await app.get(PrismaService).db.user.count({ where: { email } }),
    ).toBe(0);
  });
});

describe('Bulk WBS level change', () => {
  it('re-levels legacy tasks by depth or by choice, validating the whole change and writing all-or-nothing', async () => {
    const owner = await registerUser('Bulk Owner');
    const org = await createOrg(owner.accessToken, 'Bulk Org');
    const viewer = await inviteAndAccept(
      owner.accessToken,
      org.slug,
      'VIEWER',
      'Bulk Viewer',
    );
    const project = await createProject(owner.accessToken, org.slug, 'BLK');
    const http = () => request(app.getHttpServer());
    const auth = { Authorization: `Bearer ${owner.accessToken}` };
    const base = `${API_PREFIX}/organizations/${org.slug}/projects/${project.key}`;
    const create = async (title: string, parentTaskId?: string) =>
      (
        await http()
          .post(`${base}/tasks`)
          .set(auth)
          .send({ title, parentTaskId })
          .expect(201)
      ).body.data as { id: string; nodeType: string };
    const levels = async () =>
      Object.fromEntries(
        (
          (await http().get(`${base}/tasks`).set(auth).expect(200)).body
            .data as { title: string; nodeType: string }[]
        ).map((t) => [t.title, t.nodeType]),
      );
    const bulk = (body: object, who = auth) =>
      http().post(`${base}/task-bulk/node-type`).set(who).send(body);

    // A legacy-style tree: everything created without levels (all activities, parents promoted).
    const root = await create('Gốc');
    const child = await create('Con', root.id);
    const leaf = await create('Lá', child.id);
    const other = await create('Việc lẻ');
    void leaf;

    // Dry run by depth reports the outcome and writes nothing.
    const dry = (await bulk({ byDepth: true, dryRun: true }).expect(200)).body
      .data;
    expect(dry.committed).toBe(false);
    expect(dry.counts).toEqual({
      PHASE: 1,
      DELIVERABLE: 1,
      WORK_PACKAGE: 0,
      ACTIVITY: 2,
    });
    // (Adding a child promotes an activity to a work package, so the legacy tree starts inconsistent.)
    expect(await levels()).toMatchObject({
      Gốc: 'WORK_PACKAGE',
      Con: 'WORK_PACKAGE',
      Lá: 'ACTIVITY',
      'Việc lẻ': 'ACTIVITY',
    });

    // By depth for real: root=PHASE, child=DELIVERABLE, leaf & loose = ACTIVITY.
    const done = (await bulk({ byDepth: true }).expect(200)).body.data;
    expect(done.committed).toBe(true);
    expect(await levels()).toMatchObject({
      Gốc: 'PHASE',
      Con: 'DELIVERABLE',
      Lá: 'ACTIVITY',
      'Việc lẻ': 'ACTIVITY',
    });
    // Nothing left to change: a second run is a no-op.
    expect((await bulk({ byDepth: true }).expect(200)).body.data).toMatchObject(
      { committed: false, changed: 0 },
    );

    // Explicit choice is validated against parents and children as a whole; a bad one changes nothing.
    const bad = (
      await bulk({ taskIds: [root.id], nodeType: 'ACTIVITY' }).expect(200)
    ).body.data;
    expect(bad.committed).toBe(false);
    expect(bad.errors[0].message).toContain('không thể nằm trong');
    expect(await levels()).toMatchObject({ Gốc: 'PHASE' });

    // A loose task can be moved to any level under no parent; ids from elsewhere are refused.
    expect(
      (await bulk({ taskIds: [other.id], nodeType: 'DELIVERABLE' }).expect(200))
        .body.data.committed,
    ).toBe(true);
    const foreign = (
      await bulk({ taskIds: ['not-mine'], nodeType: 'PHASE' }).expect(200)
    ).body.data;
    expect(foreign.errors[0].message).toContain('không thuộc dự án');

    // Same rules as editing a task: viewers cannot, and the request must say what to do.
    await bulk(
      { byDepth: true },
      { Authorization: `Bearer ${viewer.accessToken}` },
    ).expect(403);
    await bulk({}).expect(400);
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

    // The member sees the owner's character as taken (and not their own).
    const taken = await request(app.getHttpServer())
      .get(`${API_PREFIX}/users/me/taken-characters`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .expect(200);
    expect(taken.body.data).toContainEqual({
      character: 'panda',
      takenBy: 'Character Owner',
    });

    // A user with no shared org can freely pick the same character.
    const stranger = await registerUser('Character Stranger');
    const strangerTaken = await request(app.getHttpServer())
      .get(`${API_PREFIX}/users/me/taken-characters`)
      .set('Authorization', `Bearer ${stranger.accessToken}`)
      .expect(200);
    expect(strangerTaken.body.data).toEqual([]);
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
