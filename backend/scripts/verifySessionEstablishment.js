// scripts/verifySessionEstablishment.js
//
// Fixture-based verification for the DataCircles application-session layer
// (services/sessionService.js, models/Session.js). WRITES disposable
// User/Organization/Session documents and deletes them after each fixture —
// do NOT point this at a production database.
//
// Covers: basic establish/reject/logout/revoke lifecycle, cross-auth
// convergence (both "Google" and "phone" identities count toward the same
// user's 2-session cap), authorization boundaries, and — the important
// one — concurrency: N simultaneous establish() calls against a user
// starting from 0, 1, and 2 existing live sessions must never leave more
// than 2 live sessions, proven by actually racing Promise.all rather than
// inspecting the code.
//
// Run with: CONFIRM_TEST_DB=yes MONGO_URI=<disposable db> node scripts/verifySessionEstablishment.js
// Exits non-zero on any failed assertion.

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const User = require('../models/User');
const Organization = require('../models/Organization');
const Session = require('../models/Session');
const sessionService = require('../services/sessionService');

if (process.env.CONFIRM_TEST_DB !== 'yes') {
  console.error(
    '❌ Refusing to run: this script CREATES and DELETES documents. ' +
    'Set CONFIRM_TEST_DB=yes and point MONGO_URI at a disposable/test database first.'
  );
  process.exit(1);
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  const registry = { User: [], Organization: [], Session: [] };
  try {
    await fn(registry);
    passed++;
    console.log(`  ok - ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL - ${name}`);
    console.error(err);
  } finally {
    await cleanup(registry);
  }
}

async function cleanup(registry) {
  await Session.deleteMany({ _id: { $in: registry.Session } });
  await User.deleteMany({ _id: { $in: registry.User } });
  await Organization.deleteMany({ _id: { $in: registry.Organization } });
}

async function trackedCreate(Model, registryKey, registry, doc) {
  const created = await Model.create(doc);
  registry[registryKey].push(created._id);
  return created;
}

let counter = 0;
async function makeUser(registry) {
  counter += 1;
  const organization = await trackedCreate(Organization, 'Organization', registry, {
    name: `Session Verify Org ${counter}`,
    code: `SESSVERIFY${Date.now()}${counter}`,
  });
  const user = await trackedCreate(User, 'User', registry, {
    auth0Id: `google-oauth2|verify-${Date.now()}-${counter}`,
    name: `Verify User ${counter}`,
    email: `session-verify-${Date.now()}-${counter}@example.com`,
    organization: organization._id,
  });
  return { user, organization };
}

async function establish(user, organization) {
  const { session, csrfToken } = await sessionService.establishSession({
    userId: user._id,
    organization: organization._id,
    ip: '127.0.0.1',
    userAgent: 'verify-script',
  });
  return { session, csrfToken };
}

async function liveSessionCount(userId) {
  return Session.countDocuments({
    userId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');
  console.log('DataCircles session-establishment fixture verification\n');

  await test('Basic: 1st and 2nd establish succeed, 3rd is rejected with SESSION_LIMIT_REACHED', async (registry) => {
    const { user, organization } = await makeUser(registry);

    const first = await establish(user, organization);
    registry.Session.push(first.session._id);
    const second = await establish(user, organization);
    registry.Session.push(second.session._id);

    assert.equal(first.session.slot !== second.session.slot, true, 'the two live sessions must occupy different slots');
    assert.equal(await liveSessionCount(user._id), 2);

    await assert.rejects(
      () => establish(user, organization),
      sessionService.SessionLimitError,
      'a 3rd establish while 2 sessions are live must be rejected',
    );
    assert.equal(await liveSessionCount(user._id), 2, 'rejected establish must not create a 3rd row');
  });

  await test('Logout revokes the session; a revoked session is not counted as live and frees its slot', async (registry) => {
    const { user, organization } = await makeUser(registry);
    const { session } = await establish(user, organization);
    registry.Session.push(session._id);

    await sessionService.revokeSession(session.sessionId);
    assert.equal(await liveSessionCount(user._id), 0);

    const found = await sessionService.findActiveSession(session.sessionId);
    assert.equal(found, null, 'a revoked session must not resolve via findActiveSession (what sessionAuth uses)');

    const { session: reestablished } = await establish(user, organization);
    registry.Session.push(reestablished._id);
    assert.equal(await liveSessionCount(user._id), 1, 'a freed slot must be reusable');
  });

  await test('Expired session is not counted as live and does not pass findActiveSession', async (registry) => {
    const { user, organization } = await makeUser(registry);
    const { session } = await establish(user, organization);
    registry.Session.push(session._id);

    session.expiresAt = new Date(Date.now() - 1000);
    await session.save();

    assert.equal(await liveSessionCount(user._id), 0);
    const found = await sessionService.findActiveSession(session.sessionId);
    assert.equal(found, null);
  });

  await test('Cross-auth: a "Google" establish and a "phone" establish for the same user count toward one shared 2-session cap', async (registry) => {
    const { user, organization } = await makeUser(registry);
    // establishSession itself doesn't know or care which identity provider
    // authenticated the request (Auth0 vs phone) — both call sites
    // (controllers/sessionController.js establish, and authController.js
    // verifyOtp) pass the same resolved userId. Simulating two calls here
    // exercises exactly that shared path.
    const googleLogin = await establish(user, organization);
    registry.Session.push(googleLogin.session._id);
    const phoneLogin = await establish(user, organization);
    registry.Session.push(phoneLogin.session._id);

    assert.equal(await liveSessionCount(user._id), 2);
    await assert.rejects(() => establish(user, organization), sessionService.SessionLimitError);
  });

  await test('Authorization: revokeSessionById refuses to revoke a session belonging to a different user', async (registry) => {
    const { user: userA, organization: orgA } = await makeUser(registry);
    const { user: userB, organization: orgB } = await makeUser(registry);
    const { session: sessionA } = await establish(userA, orgA);
    registry.Session.push(sessionA._id);

    const revokedAsB = await sessionService.revokeSessionById(userB._id, sessionA._id);
    assert.equal(revokedAsB, false, 'user B must not be able to revoke user A session by passing its id');
    assert.equal(await liveSessionCount(userA._id), 1, 'session A must remain live');

    const revokedAsA = await sessionService.revokeSessionById(userA._id, sessionA._id);
    assert.equal(revokedAsA, true, 'the owning user must be able to revoke their own session');
  });

  await test('logout-others (revokeOtherSessions) keeps the current session and revokes the rest', async (registry) => {
    const { user, organization } = await makeUser(registry);
    const first = await establish(user, organization);
    registry.Session.push(first.session._id);
    const second = await establish(user, organization);
    registry.Session.push(second.session._id);

    await sessionService.revokeOtherSessions(user._id, first.session.sessionId);
    assert.equal(await liveSessionCount(user._id), 1);
    assert.notEqual(await sessionService.findActiveSession(first.session.sessionId), null, 'the current session must survive');
    assert.equal(await sessionService.findActiveSession(second.session.sessionId), null, 'the other session must be revoked');
  });

  // --- Concurrency: the important one ---------------------------------
  // Fires N concurrent establishSession() calls and asserts the live count
  // never exceeds 2, starting from 0, 1, and 2 pre-existing live sessions.
  // Concurrency bugs are probabilistic, so this races repeatedly.
  async function raceEstablish(user, organization, n) {
    const attempts = await Promise.allSettled(
      Array.from({ length: n }, () => establish(user, organization)),
    );
    return attempts;
  }

  await test('Concurrency, starting from 0 live sessions: N concurrent establishes never exceed 2 live sessions', async (registry) => {
    for (let trial = 0; trial < 5; trial++) {
      const { user, organization } = await makeUser(registry);
      const attempts = await raceEstablish(user, organization, 6);
      attempts.forEach((a) => {
        if (a.status === 'fulfilled') registry.Session.push(a.value.session._id);
      });

      const succeeded = attempts.filter((a) => a.status === 'fulfilled').length;
      const rejected = attempts.filter((a) => a.status === 'rejected').length;
      assert.equal(succeeded, 2, `trial ${trial}: exactly 2 of the 6 concurrent establishes should succeed, got ${succeeded}`);
      assert.equal(rejected, 4, `trial ${trial}: the other 4 must be rejected, got ${rejected}`);

      const liveCount = await liveSessionCount(user._id);
      assert.equal(liveCount, 2, `trial ${trial}: invariant violated — expected <=2 live sessions, found ${liveCount}`);

      const slots = await Session.find({ userId: user._id, revokedAt: null }).select('slot');
      const distinctSlots = new Set(slots.map((s) => s.slot));
      assert.equal(distinctSlots.size, 2, `trial ${trial}: the 2 live sessions must occupy distinct slots (0 and 1), not double-book one`);
    }
  });

  await test('Concurrency, starting from 1 live session: at most 1 more of N concurrent establishes succeeds', async (registry) => {
    for (let trial = 0; trial < 5; trial++) {
      const { user, organization } = await makeUser(registry);
      const { session: existing } = await establish(user, organization);
      registry.Session.push(existing._id);

      const attempts = await raceEstablish(user, organization, 6);
      attempts.forEach((a) => {
        if (a.status === 'fulfilled') registry.Session.push(a.value.session._id);
      });

      const succeeded = attempts.filter((a) => a.status === 'fulfilled').length;
      assert.equal(succeeded, 1, `trial ${trial}: exactly 1 of 6 concurrent establishes should succeed when 1 slot is already taken, got ${succeeded}`);

      const liveCount = await liveSessionCount(user._id);
      assert.equal(liveCount, 2, `trial ${trial}: invariant violated — expected exactly 2 live sessions, found ${liveCount}`);
    }
  });

  await test('Concurrency, starting from 2 live sessions (full): all N concurrent establishes are rejected', async (registry) => {
    for (let trial = 0; trial < 5; trial++) {
      const { user, organization } = await makeUser(registry);
      const first = await establish(user, organization);
      registry.Session.push(first.session._id);
      const second = await establish(user, organization);
      registry.Session.push(second.session._id);

      const attempts = await raceEstablish(user, organization, 6);
      attempts.forEach((a) => {
        if (a.status === 'fulfilled') registry.Session.push(a.value.session._id);
      });

      const succeeded = attempts.filter((a) => a.status === 'fulfilled').length;
      assert.equal(succeeded, 0, `trial ${trial}: no concurrent establish should succeed when both slots are already live, got ${succeeded}`);

      const liveCount = await liveSessionCount(user._id);
      assert.equal(liveCount, 2, `trial ${trial}: invariant violated — expected exactly 2 live sessions, found ${liveCount}`);
    }
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
