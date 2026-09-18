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
