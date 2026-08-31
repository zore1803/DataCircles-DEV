// utils/sessionCookie.js
//
// Centralizes the dc_session cookie's flags.
//
// PRODUCTION: frontend/backend are on different registrable domains in
// every deployed environment (see backend/server.js CORS whitelist), so
// the cookie must be SameSite=None — which browsers only honor when
// Secure is also set, i.e. over HTTPS. This is non-negotiable in prod.
//
// DEVELOPMENT: localhost:5173 (frontend) and localhost:5000 (backend) are
// different ORIGINS (different ports) but the SAME SITE — the SameSite
// cookie attribute is scoped to scheme+registrable-domain, which ignores
// port. So SameSite=Lax (not None) correctly allows the cookie on
// cross-port fetch/XHR here, and Lax does not require Secure. Verified
// empirically (two plain-HTTP localhost servers on different ports, one
// setting a SameSite=Lax cookie, the other receiving it back on a
// credentials:'include' fetch) rather than assumed — plain http://
// localhost cannot carry a Secure cookie at all, which is why this can't
// just reuse the prod flags locally.
const { SESSION_TTL_DAYS } = require("../services/sessionService");

const COOKIE_NAME = "dc_session";
const MAX_AGE_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

function cookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
    maxAge: MAX_AGE_MS,
  };
}

function setSessionCookie(res, sessionId) {
  res.cookie(COOKIE_NAME, sessionId, cookieOptions());
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
}

module.exports = { COOKIE_NAME, setSessionCookie, clearSessionCookie };
