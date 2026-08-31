// middlewares/sessionAuth.js
//
// Authenticates application requests off the DataCircles session cookie
// rather than the Auth0/phone JWT. This is the "DataCircles owns the
// application session" boundary: it never re-verifies Auth0/phone
// credentials, and never trusts a client-supplied user id — the only
// source of identity is the Session row resolved from the cookie.
//
// Not yet wired into any application route (see the session-management
// backend infra rollout plan) — routes opt in explicitly.
const User = require("../models/User");
const sessionService = require("../services/sessionService");
const { COOKIE_NAME } = require("../utils/sessionCookie");

module.exports = async function sessionAuth(req, res, next) {
  const sessionId = req.cookies && req.cookies[COOKIE_NAME];
  if (!sessionId) {
    return res.status(401).json({ code: "SESSION_MISSING", message: "No active session" });
  }

  const session = await sessionService.findActiveSession(sessionId);
  if (!session) {
    return res.status(401).json({ code: "SESSION_INVALID", message: "Session is invalid or expired" });
  }

  const user = await User.findById(session.userId);
  if (!user) {
    return res.status(401).json({ code: "SESSION_INVALID", message: "Session is invalid or expired" });
  }

  sessionService.touchLastActive(session);

  req.user = user;
  req.session = session;
  next();
};
