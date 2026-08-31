// middlewares/csrfCheck.js
//
// Double-submit CSRF check for cookie-authenticated mutating requests.
// Must run AFTER sessionAuth (needs req.session). The client-facing CSRF
// token is HMAC(session.csrfSecret, session.sessionId) — derivable by the
// server but not forgeable by an attacker who can merely trigger a
// cookie-carrying cross-site request, since csrfSecret never leaves the
// server. See services/sessionService.deriveCsrfToken.
const crypto = require("crypto");
const { deriveCsrfToken } = require("../services/sessionService");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

module.exports = function csrfCheck(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }
  if (!req.session) {
    // sessionAuth should always run first; treat missing session as a bug,
    // not silently skip the check.
    return res.status(401).json({ code: "SESSION_MISSING", message: "No active session" });
  }

  const provided = req.headers["x-csrf-token"];
  const expected = deriveCsrfToken(req.session.csrfSecret, req.session.sessionId);

  const providedBuf = Buffer.from(String(provided || ""), "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  const valid =
    providedBuf.length === expectedBuf.length &&
    crypto.timingSafeEqual(providedBuf, expectedBuf);

  if (!valid) {
    return res.status(403).json({ code: "CSRF_INVALID", message: "Invalid or missing CSRF token" });
  }
  next();
};
