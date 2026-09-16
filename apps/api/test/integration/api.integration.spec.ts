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
