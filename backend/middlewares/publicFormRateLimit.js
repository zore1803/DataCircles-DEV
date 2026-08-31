// middlewares/publicFormRateLimit.js
// Abuse controls for the unauthenticated form endpoints.
//
// Deliberately NOT a captcha. The product promise is: open link → fill form → submit. No account,
// no challenge, no friction. Rate limiting and server-side controls first; a challenge only if
// there is a demonstrated need these cannot cover.
//
// Two independent keys, because each covers the other's blind spot:
//
//   per IP   — catches ordinary abuse (one script hammering a form). The key comes from proxy
//              headers, which a caller can forge, so this alone is not sufficient.
//   per FORM — catches distributed or header-spoofed abuse. Whatever the source claims to be, one
//              form can only absorb so much. This is what actually protects the organization's CRM
//              from being filled with junk.
//
// Both must pass. Limits are sized for a real form: a burst allows a person retrying or several
// colleagues submitting at once, while the sustained ceiling stays far below what would matter.
const rateLimit = require("express-rate-limit");

// Same extraction as utils/RateLimiter.js so both surfaces agree on what "the client" is. Note this
// trusts proxy headers: Express `trust proxy` is not enabled on this app, so `req.ip` would be the
// proxy's address rather than the visitor's. Behind Cloudflare/Render these headers are overwritten
// by the edge and are reliable; direct-to-origin traffic could forge them, which is precisely why
// the per-form limiter below does not depend on them.
const getClientIp = (req) =>
  req.headers["cf-connecting-ip"] ||
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
  req.headers["x-real-ip"] ||
  req.connection?.remoteAddress ||
  "unknown";

const tooMany = (message) => (req, res) =>
  res.status(429).json({ error: message, retryAfter: req.rateLimit?.resetTime });

// A submission writes CRM records, so this is the most consequential endpoint.
const submitPerIp = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `sub:${getClientIp(req)}`,
  handler: tooMany("Too many submissions from this device. Please wait a few minutes and try again."),
});

// Ceiling for one form regardless of who is submitting — the backstop when the IP key is forged.
// Sized so a genuinely popular form (an event sign-up) is unaffected.
const submitPerForm = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `subform:${req.params.publicSlug}`,
  handler: tooMany("This form is receiving an unusually high number of submissions. Please try again shortly."),
});

// Uploads get their own, tighter budget. They are NOT bound to a completed submission — a caller
// can upload repeatedly and never submit — so without a separate limit this is an open door to
// unbounded S3 objects and storage cost. Deliberately lower than the submission limit: a form
// realistically has one or two file fields, so a visitor needs only a handful of uploads.
const uploadPerIp = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `up:${getClientIp(req)}`,
  handler: tooMany("Too many uploads from this device. Please wait a few minutes and try again."),
});

const uploadPerForm = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `upform:${req.params.publicSlug}`,
  handler: tooMany("This form is receiving an unusually high number of uploads. Please try again shortly."),
});

// Reading a form is harmless, but an unlimited public GET is still a free amplifier for scraping.
// Generous enough to be invisible to any real visitor.
const readPerIp = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `get:${getClientIp(req)}`,
  handler: tooMany("Too many requests. Please wait a moment."),
});

module.exports = { submitPerIp, submitPerForm, uploadPerIp, uploadPerForm, readPerIp, getClientIp };
