#!/usr/bin/env node
// One-off cleanup: before the join-time auto-assignment fix (see UsersService.resolveCharacterConflictOnJoin),
// members who never visited Settings all stayed on the "fox" default and silently collided in the same org.
// For every org, keeps whoever joined that org earliest on the colliding character and reassigns everyone
// else in that org to a random character nobody else in *their* orgs is using — the exact same rule the
// real join flow now enforces, applied here through the real PATCH /users/me/preferences endpoint (not a
// raw SQL write), so the server's own validation is the safety net.
//
// Usage:
//   node infra/dedupe-characters.mjs                # dry run — prints what it would change, changes nothing
//   node infra/dedupe-characters.mjs --apply         # actually applies the reassignments
//
// Target selection (same convention as infra/dogfood/seed.mjs):
//   PG_CONTAINER=infra-postgres-1 PG_USER=pmtool PG_DB=pmtool_dev   (dev defaults)
//   JWT_ENV_FILE=apps/api/.env                                      (dev default)
// For production:
//   PG_CONTAINER=pmtool-postgres-1 PG_USER=pmtool PG_DB=pmtool JWT_ENV_FILE=infra/.env.prod \
//   API=https://pm.dgna.vn/api/v1 node infra/dedupe-characters.mjs --apply
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APPLY = process.argv.includes('--apply');

const PG_CONTAINER = process.env.PG_CONTAINER ?? 'infra-postgres-1';
const PG_USER = process.env.PG_USER ?? 'pmtool';
const PG_DB = process.env.PG_DB ?? 'pmtool_dev';
const JWT_ENV_FILE = path.resolve(ROOT, process.env.JWT_ENV_FILE ?? 'apps/api/.env');
const API = process.env.API ?? 'http://localhost:3001/api/v1';

const DOCKER_ENV = { ...process.env, PATH: `/Applications/Docker.app/Contents/Resources/bin:${process.env.PATH}` };
const psqlJson = (sql) =>
  JSON.parse(
    execFileSync(
      'docker',
      ['exec', PG_CONTAINER, 'psql', '-U', PG_USER, '-d', PG_DB, '-tA', '-v', 'ON_ERROR_STOP=1', '-c', `SELECT json_agg(t) FROM (${sql}) t`],
      { env: DOCKER_ENV },
    )
      .toString()
      .trim() || '[]',
  );

// The same 52-character catalog the app ships, in the same fixed order (only used to know the full universe).
const MASCOT_CHARACTERS = [
  'bear', 'bunny', 'cat', 'deer', 'dino', 'fox', 'frog', 'hamster', 'hedgehog', 'koala', 'mouse', 'otter', 'owl',
  'panda', 'penguin', 'pug', 'raccoon', 'redpanda', 'sheep', 'sloth', 'tiger', 'afro', 'astronaut', 'bald',
  'ballerina', 'beard', 'builder', 'cap', 'chef', 'glasses', 'grandpa', 'granny', 'hijabi', 'nurse', 'pirate',
  'scientist', 'sikh', 'skater', 'wizard', 'clockwork', 'crt', 'cube', 'drone', 'gearbot', 'knight', 'lantern',
  'postbot', 'radio', 'rocket', 'scout', 'toaster', 'tv',
];

const req = createRequire(path.join(ROOT, 'apps/api/package.json'));
const jwt = req(req.resolve('jsonwebtoken', { paths: [req.resolve('@nestjs/jwt')] }));
const secret = /^JWT_ACCESS_SECRET=(.*)$/m
  .exec(readFileSync(JWT_ENV_FILE, 'utf8'))?.[1]
  ?.trim()
  .replace(/^(['"])(.*)\1$/, '$2');
if (!secret) throw new Error(`JWT_ACCESS_SECRET not found in ${JWT_ENV_FILE}`);

async function patchCharacter(userId, email, character) {
  const token = jwt.sign({ sub: userId, email }, secret, { expiresIn: '5m' });
  const res = await fetch(`${API}/users/me/preferences`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ mascotCharacter: character }),
  });
  if (!res.ok) throw new Error(`PATCH preferences for ${email} -> ${res.status} ${await res.text()}`);
}

const orgs = psqlJson(`SELECT id, slug, name FROM organizations WHERE status = 'ACTIVE'`);
console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'} against ${PG_CONTAINER}/${PG_DB} via ${API} — ${orgs.length} active orgs`);

// user.id -> current (possibly already-updated-in-this-run) character, seeded from the DB.
const allMembers = psqlJson(`
  SELECT m."organizationId", m."userId", m."createdAt", u.email, u."fullName", u."mascotCharacter"
  FROM memberships m JOIN users u ON u.id = m."userId"
`);
const characterByUser = new Map(allMembers.map((m) => [m.userId, m.mascotCharacter]));
const orgsByUser = new Map();
for (const m of allMembers) {
  if (!orgsByUser.has(m.userId)) orgsByUser.set(m.userId, []);
  orgsByUser.get(m.userId).push(m.organizationId);
}

let changes = 0;
for (const org of orgs) {
  const members = allMembers
    .filter((m) => m.organizationId === org.id)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const byCharacter = new Map();
  for (const m of members) {
    const c = characterByUser.get(m.userId);
    if (!byCharacter.has(c)) byCharacter.set(c, []);
    byCharacter.get(c).push(m);
  }

  for (const [character, group] of byCharacter) {
    if (group.length < 2) continue;
    const [keeper, ...rest] = group; // earliest joiner in this org keeps it
    console.log(`\n[${org.slug}] "${character}" is used by ${group.length}: keeping ${keeper.fullName} (${keeper.email})`);
    for (const m of rest) {
      const myOrgIds = orgsByUser.get(m.userId);
      const takenElsewhere = new Set(
        allMembers.filter((x) => myOrgIds.includes(x.organizationId) && x.userId !== m.userId).map((x) => characterByUser.get(x.userId)),
      );
      const free = MASCOT_CHARACTERS.filter((c) => !takenElsewhere.has(c));
      if (free.length === 0) {
        console.log(`  ! ${m.fullName} (${m.email}): no free character across their orgs — skipped`);
        continue;
      }
      const pick = free[Math.floor(Math.random() * free.length)];
      console.log(`  - ${m.fullName} (${m.email}): ${character} -> ${pick}`);
      changes++;
      characterByUser.set(m.userId, pick); // so later orgs in this same run see the update
      if (APPLY) {
        await patchCharacter(m.userId, m.email, pick);
      }
    }
  }
}

console.log(`\n${APPLY ? 'Applied' : 'Would apply'} ${changes} reassignment(s).`);
if (!APPLY && changes > 0) console.log('Re-run with --apply to actually change them.');
