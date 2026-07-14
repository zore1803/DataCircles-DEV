// services/duplicateDetectionService.js
// Standalone, module-agnostic matching engine — FORMS_ARCHITECTURE.md §2.4, FORMS_DOMAIN_MODEL.md
// §DuplicateReview. Deliberately built as a generic service (not Forms-specific) so bulk-import
// and manual-create can call it later without a migration (D6). Only Forms wires it up for now.
const Contact = require("../models/Contact");
const Company = require("../models/Company");
const Vendor = require("../models/Vendor");
const DuplicateReview = require("../models/DuplicateReview");

const ENGINE_VERSION = "v1"; // stamped onto every DuplicateReview — FORMS_SCHEMA.md invariant-adjacent (§ DuplicateReview.engineVersion)

function normalizeDomain(website) {
  if (!website) return "";
  return String(website)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
}

function normalizeName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Lightweight token-overlap similarity — avoids adding a fuzzy-matching dependency for a v1
// deterministic engine (FORMS_ARCHITECTURE.md §2.4: "deterministic — no ML in phase 1").
function nameSimilarity(a, b) {
  const ta = new Set(normalizeName(a).split(" ").filter(Boolean));
  const tb = new Set(normalizeName(b).split(" ").filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  const intersection = [...ta].filter((t) => tb.has(t)).length;
  const union = new Set([...ta, ...tb]).size;
  return union === 0 ? 0 : intersection / union; // Jaccard similarity, 0..1
}

/**
 * Purpose: Find potential duplicate matches for candidate data against existing CRM records.
 * Inputs: { organization, module: "Contact"|"Company"|"Vendor", candidateData: plain object }
 * Outputs: Promise<Array<{ existingRecord: {module, recordId}, score, matchDetails, reasonSummary }>>
 *   — sorted descending by score. Empty array if nothing scores above the lowest reportable band.
 * Side effects: read-only queries against Contact/Company/Vendor
 * Errors thrown: none (unknown module resolves to [])
 * Known callers: submissionService (Phase 4 wiring); designed for future Import/manual-create reuse
 */
async function findDuplicates({ organization, module, candidateData }) {
  if (module === "Contact") return findContactDuplicates(organization, candidateData);
  if (module === "Company") return findCompanyDuplicates(organization, candidateData);
  if (module === "Vendor") return findVendorDuplicates(organization, candidateData);
  return [];
}

async function findContactDuplicates(organization, data) {
  const matches = [];
  if (data.email) {
    const existing = await Contact.findOne({ organization, email: data.email });
    if (existing) {
      // Exact email match is treated as near-certain (FORMS_ARCHITECTURE.md §2.4: "exact email
      // match (high confidence)") — weighted to clear the ≥95 auto-attach band on its own,
      // consistent with the illustrative score bands in §2.4. Phone/name are minor corroborating
      // signals only, not load-bearing for the score.
      matches.push(
        buildMatch("Contact", existing._id, [
          { signal: "email", matched: true, existingValue: existing.email, incomingValue: data.email, weight: 97 },
          { signal: "phone", matched: !!(data.phone && existing.phone === data.phone), existingValue: existing.phone, incomingValue: data.phone, weight: 2 },
          nameSignal(existing.name, data.name, 1),
        ])
      );
    }
  }
  return matches.sort((a, b) => b.score - a.score);
}

async function findCompanyDuplicates(organization, data) {
  const matches = [];
  const domain = normalizeDomain(data.website);

  const orClauses = [];
  if (data.gstin) orClauses.push({ gstin: data.gstin });
  if (domain) orClauses.push({ website: { $regex: escapeRegex(domain), $options: "i" } });

  if (orClauses.length === 0) return matches;

  const candidates = await Company.find({ organization, $or: orClauses }).limit(10);
  for (const existing of candidates) {
    // GSTIN is a unique legal identifier — an exact match alone should clear the ≥95 auto-attach
    // band, same calibration reasoning as Contact's email weight above.
    matches.push(
      buildMatch("Company", existing._id, [
        { signal: "gstin", matched: !!(data.gstin && existing.gstin === data.gstin), existingValue: existing.gstin, incomingValue: data.gstin, weight: 96 },
        { signal: "website", matched: !!(domain && normalizeDomain(existing.website) === domain), existingValue: existing.website, incomingValue: data.website, weight: 90 },
        nameSignal(existing.name, data.name, 15),
      ])
    );
  }
  return matches.sort((a, b) => b.score - a.score);
}

async function findVendorDuplicates(organization, data) {
  const matches = [];
  if (!data.gstin && !data.name) return matches;

  const orClauses = [];
  if (data.gstin) orClauses.push({ gstin: data.gstin });
  if (data.name) orClauses.push({ name: { $regex: escapeRegex(normalizeName(data.name)), $options: "i" } });

  const candidates = await Vendor.find({ organization, $or: orClauses }).limit(10);
  for (const existing of candidates) {
    // Same calibration as Company: exact GSTIN alone should clear the auto-attach band on its own.
    matches.push(
      buildMatch("Vendor", existing._id, [
        { signal: "gstin", matched: !!(data.gstin && existing.gstin === data.gstin), existingValue: existing.gstin, incomingValue: data.gstin, weight: 96 },
        nameSignal(existing.name, data.name, 30),
      ])
    );
  }
  return matches.sort((a, b) => b.score - a.score);
}

function nameSignal(existingName, incomingName, weight) {
  const similarity = nameSimilarity(existingName, incomingName);
  return {
    signal: "name_fuzzy",
    matched: similarity >= 0.5,
    existingValue: existingName,
    incomingValue: incomingName,
    weight: Math.round(similarity * weight),
  };
}

function buildMatch(module, recordId, matchDetails) {
  const score = Math.min(100, matchDetails.reduce((sum, d) => sum + (d.matched ? d.weight : 0), 0));
  const matchedSignals = matchDetails.filter((d) => d.matched).map((d) => d.signal);
  return {
    existingRecord: { module, recordId },
    score,
    matchDetails,
    reasonSummary: matchedSignals.length ? `Matched on ${matchedSignals.join(", ")}` : "No strong signals matched",
  };
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Purpose: Check whether a prior, resolved decision already exists for this existing record —
 * the "don't ask again" mechanism (FORMS_DOMAIN_MODEL.md §DuplicateReview, product requirement).
 * Inputs: { organization, existingRecordModule, existingRecordId }
 * Outputs: Promise<DuplicateReviewDocument | null> — most recent non-pending decision, if any
 * Side effects: one read query
 */
async function findPriorDecision({ organization, existingRecordModule, existingRecordId }) {
  return DuplicateReview.findOne({
    organization,
    "existingRecord.module": existingRecordModule,
    "existingRecord.recordId": existingRecordId,
    decision: { $ne: "pending" },
  }).sort({ decidedAt: -1 });
}

/**
 * Purpose: Persist a DuplicateReview for a match that needs human (or auto-attach) resolution.
 * Inputs: { organization, module, formSubmission (nullable), existingRecord, incomingData,
 *           score, matchDetails, reasonSummary }
 * Outputs: Promise<DuplicateReviewDocument>
 * Side effects: one DuplicateReview insert
 */
async function createReview({ organization, module, formSubmission, existingRecord, incomingData, score, matchDetails, reasonSummary }) {
  return DuplicateReview.create({
    organization,
    module,
    formSubmission: formSubmission || undefined,
    existingRecord,
    incomingData,
    score,
    matchDetails,
    reasonSummary,
    engineVersion: ENGINE_VERSION,
    decision: "pending",
  });
}

module.exports = { findDuplicates, findPriorDecision, createReview, ENGINE_VERSION };
