// scripts/verifySessionEnforcement.js
//
// End-to-end proof that the DataCircles session system actually GATES
// access to a real HTTP route protected by sessionAuth — not just that the
// service-layer functions behave correctly in isolation (see
// verifySessionEstablishment.js for that). This is what closes the gap
// flagged during the route-migration review: establishing a session is
// meaningless unless a protected route actually rejects requests without
// a valid one.
//
// Spins up a minimal real HTTP server (cookie-parser + the real
// /session/establish, /session, /session/:id, /session/logout routes +
// one dummy `sessionAuth`-protected route, exactly the composition every
// migrated route file now uses: `[sessionAuth, csrfCheck]`), drives it
// with plain http requests carrying a real cookie jar, and proves:
//
//   Session 1 established -> protected route: 200
//   Session 2 established -> protected route: 200
//   3rd concurrent login -> rejected (409 SESSION_LIMIT_REACHED)
//   Revoke session 1 -> session 1's next request: 401
//   Session 2 -> still 200 (unaffected by revoking session 1)
//   New login after revoke -> succeeds (freed slot reused)
//
// WRITES disposable User/Organization/Session documents and deletes them
// after the run — do NOT point this at a production database.
//
// Run with: CONFIRM_TEST_DB=yes MONGO_URI=<disposable db> node scripts/verifySessionEnforcement.js

const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const User = require('../models/User');
const Organization = require('../models/Organization');
const Session = require('../models/Session');
const sessionAuth = require('../middlewares/sessionAuth');
const csrfCheck = require('../middlewares/csrfCheck');
const sessionController = require('../controllers/sessionController');

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
  try {
    await fn();
    passed++;
    console.log(`  ok - ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL - ${name}`);
    console.error(err);
  }
}

// --- Minimal real server, mirroring exactly how every migrated route file
// composes auth: router.use/get/post([sessionAuth, csrfCheck], handler). ---
function buildApp() {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());

  // The establishment boundary normally re-verifies the Auth0/phone JWT
  // (see routes/session.js). For this test we already know the user id —
  // stub that step and call the same establish() controller logic that
  // production code calls, so we exercise the REAL reservation/cookie code.
  app.post('/test/establish-as/:userId', async (req, res, next) => {
    req.user = await User.findById(req.params.userId);
    if (!req.user) return res.status(404).json({ message: 'test user not found' });
    sessionController.establish(req, res).catch(next);
  });

  app.post('/session/logout', sessionController.logout);
  app.get('/session', sessionAuth, sessionController.list);
  app.get('/session/me', sessionAuth, sessionController.me);
  app.delete('/session/:id', sessionAuth, csrfCheck, sessionController.revoke);

  // A stand-in for "any migrated app route" — same middleware composition
  // every real route file now uses.
  app.get('/protected/ping', sessionAuth, (req, res) => {
    res.json({ ok: true, userId: String(req.user._id) });
  });

  return app;
}

// --- Tiny cookie-jar HTTP client (no supertest/axios dependency needed) ---
function request(server, { method, path, cookie, body, csrfToken }) {
  return new Promise((resolve, reject) => {
    const { port } = server.address();
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          ...(cookie ? { Cookie: cookie } : {}),
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let json = null;
          try { json = data ? JSON.parse(data) : null; } catch { /* non-JSON body */ }
          const setCookie = res.headers['set-cookie'];
          resolve({ status: res.statusCode, body: json, setCookie });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// Extracts just the dc_session=<value> pair from a Set-Cookie header array,
// dropping HttpOnly/Secure/SameSite/etc. attributes, so it can be replayed
// as a plain Cookie header on the next request.
function extractSessionCookie(setCookieHeaders) {
  if (!setCookieHeaders) return null;
  const raw = setCookieHeaders.find((c) => c.startsWith('dc_session='));
  if (!raw) return null;
  return raw.split(';')[0];
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');
  console.log('DataCircles session ENFORCEMENT (end-to-end HTTP) verification\n');

  const app = buildApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  const cleanupIds = { User: [], Organization: [], Session: [] };
  async function cleanup() {
    await Session.deleteMany({ _id: { $in: cleanupIds.Session } });
    await User.deleteMany({ _id: { $in: cleanupIds.User } });
    await Organization.deleteMany({ _id: { $in: cleanupIds.Organization } });
  }

  try {
    const organization = await Organization.create({
      name: 'Enforcement Verify Org',
      code: `ENFVERIFY${Date.now()}`,
    });
    cleanupIds.Organization.push(organization._id);
    const user = await User.create({
      auth0Id: `google-oauth2|enforcement-verify-${Date.now()}`,
      name: 'Enforcement Verify User',
      email: `enforcement-verify-${Date.now()}@example.com`,
      organization: organization._id,
    });
    cleanupIds.User.push(user._id);

    let session1Cookie, session2Cookie, session1CsrfToken;

    await test('Session 1 established -> protected route returns 200', async () => {
      const est = await request(server, { method: 'POST', path: `/test/establish-as/${user._id}` });
      assert.equal(est.status, 200, `establish should succeed, got ${est.status}: ${JSON.stringify(est.body)}`);
      session1Cookie = extractSessionCookie(est.setCookie);
      session1CsrfToken = est.body.csrfToken;
      assert.ok(session1Cookie, 'establish response must set the dc_session cookie');
      assert.ok(session1CsrfToken, 'establish response must return a csrfToken for subsequent mutating requests');

      const ping = await request(server, { method: 'GET', path: '/protected/ping', cookie: session1Cookie });
      assert.equal(ping.status, 200, 'a real protected route must accept a freshly-established session');
      assert.equal(ping.body.userId, String(user._id));
    });

    await test('Session 2 established -> protected route returns 200', async () => {
      const est = await request(server, { method: 'POST', path: `/test/establish-as/${user._id}` });
      assert.equal(est.status, 200);
      session2Cookie = extractSessionCookie(est.setCookie);
      assert.ok(session2Cookie);
      assert.notEqual(session2Cookie, session1Cookie, 'the two sessions must be distinct cookies');

      const ping = await request(server, { method: 'GET', path: '/protected/ping', cookie: session2Cookie });
      assert.equal(ping.status, 200);
    });

    await test('3rd concurrent login is rejected with SESSION_LIMIT_REACHED, and does not disturb sessions 1 or 2', async () => {
      const est = await request(server, { method: 'POST', path: `/test/establish-as/${user._id}` });
      assert.equal(est.status, 409, `3rd establish must be rejected, got ${est.status}`);
      assert.equal(est.body.code, 'SESSION_LIMIT_REACHED');

      const ping1 = await request(server, { method: 'GET', path: '/protected/ping', cookie: session1Cookie });
      const ping2 = await request(server, { method: 'GET', path: '/protected/ping', cookie: session2Cookie });
      assert.equal(ping1.status, 200, 'session 1 must remain unaffected by the rejected 3rd attempt');
      assert.equal(ping2.status, 200, 'session 2 must remain unaffected by the rejected 3rd attempt');
    });

    await test('Revoking session 1 (via DELETE /session/:id) makes its NEXT request 401, while session 2 keeps working', async () => {
      const list = await request(server, { method: 'GET', path: '/session', cookie: session1Cookie });
      assert.equal(list.status, 200);
      const ownRow = list.body.sessions.find((s) => s.current);
      assert.ok(ownRow, 'the listing must mark the calling session as current');

      const revokeNoCsrf = await request(server, { method: 'DELETE', path: `/session/${ownRow.id}`, cookie: session1Cookie });
      assert.equal(revokeNoCsrf.status, 403, 'a mutating request with no CSRF token must be rejected — this is the CSRF middleware actually working');
      assert.equal(revokeNoCsrf.body.code, 'CSRF_INVALID');

      const revoke = await request(server, { method: 'DELETE', path: `/session/${ownRow.id}`, cookie: session1Cookie, csrfToken: session1CsrfToken });
      assert.equal(revoke.status, 200, `revoke should succeed with a valid CSRF token: ${JSON.stringify(revoke.body)}`);

      const pingAfterRevoke = await request(server, { method: 'GET', path: '/protected/ping', cookie: session1Cookie });
      assert.equal(pingAfterRevoke.status, 401, 'a revoked session must be rejected on its very next request');

      const ping2 = await request(server, { method: 'GET', path: '/protected/ping', cookie: session2Cookie });
      assert.equal(ping2.status, 200, 'session 2 must be unaffected by session 1 being revoked');
    });

    await test('A new login after the revoke succeeds (the freed slot is reusable) and protects a real route', async () => {
      const est = await request(server, { method: 'POST', path: `/test/establish-as/${user._id}` });
      assert.equal(est.status, 200, `new login should succeed once a slot is freed: ${JSON.stringify(est.body)}`);
      const newCookie = extractSessionCookie(est.setCookie);

      const ping = await request(server, { method: 'GET', path: '/protected/ping', cookie: newCookie });
      assert.equal(ping.status, 200);

      const pingNoCookie = await request(server, { method: 'GET', path: '/protected/ping' });
      assert.equal(pingNoCookie.status, 401, 'a protected route must reject requests with no session cookie at all');
    });

    // Regression test for the exact bypass found during the browser
    // review: a request carrying NO dc_session cookie at all (the state of
    // a browser that only ever authenticated via Auth0 and never called
    // /session/establish) must be rejected by /session/me — this is the
    // endpoint PrivateRoute.jsx now depends on, precisely so identity
    // alone (Auth0/phone JWT) can never substitute for a live DataCircles
    // session.
    await test('GET /session/me (what PrivateRoute now checks) rejects a request with no dc_session cookie, and accepts one with a valid session', async () => {
      const noCookie = await request(server, { method: 'GET', path: '/session/me' });
      assert.equal(noCookie.status, 401, '/session/me must reject a request with no dc_session cookie at all — identity alone must not grant access');

      // Fresh user — the shared `user` above already has 2 live sessions
      // from earlier tests in this run, which would make a 3rd establish
      // correctly (but irrelevantly, for this test) hit SESSION_LIMIT_REACHED.
      const freshUser = await User.create({
        auth0Id: `google-oauth2|enforcement-verify-sessionme-${Date.now()}`,
        name: 'Session Me Verify User',
        email: `enforcement-verify-sessionme-${Date.now()}@example.com`,
        organization: organization._id,
      });
      cleanupIds.User.push(freshUser._id);

      const est = await request(server, { method: 'POST', path: `/test/establish-as/${freshUser._id}` });
      assert.equal(est.status, 200);
      const cookie = extractSessionCookie(est.setCookie);

      const withCookie = await request(server, { method: 'GET', path: '/session/me', cookie });
      assert.equal(withCookie.status, 200);
      assert.equal(withCookie.body.authenticated, true);
    });
  } finally {
    await cleanup();
    await new Promise((resolve) => server.close(resolve));
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
