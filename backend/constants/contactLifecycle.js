// backend/constants/contactLifecycle.js
//
// THE authoritative definition of the Contact lifecycle. Every other place
// that needs to know which statuses are legal — the Contact model's enums and
// pre-save hook, contactService's create/update paths, contactController's
// updateLifecycleStage, and (mirrored) the frontend's utils/contactConstants.js
// — reads it from here instead of restating it.
//
// The lifecycle is two fields that always move together:
//
//   lifecycleStage          stageStatus
//   ----------------------  ------------------------------------------
//   Lead                    New | Contacted | Interested | Unqualified
//   Sales Qualified Lead    Qualified | Lost
//   Customer                Won | Churned
//
//   Lead/Interested  ->  Sales Qualified Lead/Qualified  ->  Customer/Won
//
// A status is only meaningful inside its stage: "Won" is not a Lead status,
// and the backend has never inferred one field from the other on its own —
// callers send BOTH and the combination is validated here. That is a
// deliberate design, not a gap; the only thing that was missing was a single
// place to state it, which is why three drifting copies existed.
//
// This list is a fixed product concept, NOT org-configurable (unlike Deal
// statuses, which live in dealSettings) — so a hardcoded map is correct here.

const STAGE_STATUS_MAP = Object.freeze({
  Lead: Object.freeze(["New", "Contacted", "Interested", "Unqualified"]),
  "Sales Qualified Lead": Object.freeze(["Qualified", "Lost"]),
  Customer: Object.freeze(["Won", "Churned"]),
});

const LIFECYCLE_STAGES = Object.freeze(Object.keys(STAGE_STATUS_MAP));

// Flattened, in lifecycle order — the mongoose enum for stageStatus.
const STAGE_STATUSES = Object.freeze(
  LIFECYCLE_STAGES.reduce((all, stage) => all.concat(STAGE_STATUS_MAP[stage]), [])
);

// The status a stage lands on when a caller moves the stage without naming a
// status (e.g. an import that only sets lifecycleStage).
const DEFAULT_STAGE_STATUSES = Object.freeze({
  Lead: "New",
  "Sales Qualified Lead": "Qualified",
  Customer: "Won",
});

function isValidStage(stage) {
  return Object.prototype.hasOwnProperty.call(STAGE_STATUS_MAP, stage);
}

function isValidCombination(stage, status) {
  return isValidStage(stage) && STAGE_STATUS_MAP[stage].includes(status);
}

// Every status belongs to exactly one stage, so a status alone is enough to
// recover its stage. This is what lets a caller that only knows the new
// status (a Kanban drop, a status dropdown) still send a consistent pair.
function stageForStatus(status) {
  return LIFECYCLE_STAGES.find((stage) => STAGE_STATUS_MAP[stage].includes(status)) || null;
}

function defaultStatusForStage(stage) {
  return DEFAULT_STAGE_STATUSES[stage] || null;
}

// Shared wording so the API says the same thing wherever the check runs.
function invalidCombinationMessage(stage, status) {
  if (!isValidStage(stage)) {
    return `Invalid lifecycle stage '${stage}'. Expected one of: ${LIFECYCLE_STAGES.join(", ")}`;
  }
  return `Invalid status '${status}' for lifecycle stage '${stage}'. Expected one of: ${STAGE_STATUS_MAP[stage].join(", ")}`;
}

module.exports = {
  STAGE_STATUS_MAP,
  LIFECYCLE_STAGES,
  STAGE_STATUSES,
  DEFAULT_STAGE_STATUSES,
  isValidStage,
  isValidCombination,
  stageForStatus,
  defaultStatusForStage,
  invalidCombinationMessage,
};
