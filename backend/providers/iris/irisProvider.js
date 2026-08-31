// providers/iris/irisProvider.js
//
// IRIS IRP provider skeleton. Deliberately NOT wired to the network yet —
// this file exists so the service layer can depend on a stable interface
// while we're still waiting for real IRIS Sandbox credentials.
//
// Contract every provider must satisfy:
//   authenticate() → { token, expiresAt }
//   generateIRN(payload) → { irn, ackNo, ackDate, signedInvoice, signedQRCode, providerRequestId }
//   getIRN({ irn } | { docType, docNo, docDate }) → same shape as generateIRN (or null)
//   cancelIRN({ irn, reason, remarks }) → { cancelledAt, providerRequestId }
//
// Adding another provider (ClearTax, Masters India, direct-GSP) later means
// writing a sibling file with the same four methods and switching
// EINVOICE_PROVIDER — no changes to the service or mapper.
//
// Safety rule per the user's Phase-1 note: if credentials are missing, we
// throw a clearly-labelled ConfigurationError. The service layer catches it
// and records FAILED / failureCode="PROVIDER_NOT_CONFIGURED". We NEVER
// fabricate a successful IRP response.

class ConfigurationError extends Error {
  constructor(msg) { super(msg); this.name = "ConfigurationError"; this.code = "PROVIDER_NOT_CONFIGURED"; }
}
class NotImplementedError extends Error {
  constructor(msg) { super(msg); this.name = "NotImplementedError"; this.code = "PROVIDER_NOT_IMPLEMENTED"; }
}

function readConfig() {
  const env = (process.env.EINVOICE_ENVIRONMENT || "SANDBOX").toUpperCase();
  const prefix = env === "PRODUCTION" ? "EINVOICE_PRODUCTION" : "EINVOICE_SANDBOX";
  const cfg = {
    environment: env,
    clientId: process.env[`${prefix}_CLIENT_ID`] || "",
    clientSecret: process.env[`${prefix}_CLIENT_SECRET`] || "",
    username: process.env[`${prefix}_USERNAME`] || "",
    password: process.env[`${prefix}_PASSWORD`] || "",
    baseUrl: process.env[`${prefix}_BASE_URL`] || "",
    authUrl: process.env[`${prefix}_AUTH_URL`] || "",
    gstin: process.env[`${prefix}_GSTIN`] || "",
    timeoutMs: Number(process.env.EINVOICE_TIMEOUT_MS) || 15000,
  };
  return cfg;
}

function requireConfigured(cfg) {
  const missing = [];
  if (!cfg.clientId) missing.push("CLIENT_ID");
  if (!cfg.clientSecret) missing.push("CLIENT_SECRET");
  if (!cfg.baseUrl) missing.push("BASE_URL");
  if (missing.length) {
    throw new ConfigurationError(
      `IRIS ${cfg.environment} credentials missing: ${missing.join(", ")}. Set EINVOICE_${cfg.environment}_* env vars before generating an IRN.`
    );
  }
}

// ── Public interface ──────────────────────────────────────────────────
// Each method: read+check config, then throw NotImplementedError until the
// live-call code is wired in Phase 5. Any caller catching ConfigurationError
// gets the "credentials missing" story; catching NotImplementedError gets
// the "wired but not yet implemented" story. Both fail safely.

async function authenticate() {
  const cfg = readConfig();
  requireConfigured(cfg);
  throw new NotImplementedError("IRIS authenticate() will be implemented in Phase 5 once IRIS Sandbox credentials are available.");
}

async function generateIRN(/* payload */) {
  const cfg = readConfig();
  requireConfigured(cfg);
  throw new NotImplementedError("IRIS generateIRN() will be implemented in Phase 5.");
}

async function getIRN(/* { irn } | { docType, docNo, docDate } */) {
  const cfg = readConfig();
  requireConfigured(cfg);
  throw new NotImplementedError("IRIS getIRN() will be implemented in Phase 11 (recovery).");
}

async function cancelIRN(/* { irn, reason, remarks } */) {
  const cfg = readConfig();
  requireConfigured(cfg);
  throw new NotImplementedError("IRIS cancelIRN() will be implemented in Phase 12 (cancellation).");
}

function isConfigured() {
  try {
    requireConfigured(readConfig());
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = {
  name: "IRIS",
  authenticate,
  generateIRN,
  getIRN,
  cancelIRN,
  isConfigured,
  readConfig,
  ConfigurationError,
  NotImplementedError,
};
