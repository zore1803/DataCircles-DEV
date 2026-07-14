const Contact = require("../models/Contact");
const { processAdditionalFields } = require("./fieldCoercionService");

function normalizeSocialMedia(socialMedia) {
  return {
    twitter: socialMedia.twitter || "",
    linkedin: socialMedia.linkedin || "",
    facebook: socialMedia.facebook || "",
    whatsapp: socialMedia.whatsapp || "",
  };
}

const DEFAULT_STAGE_STATUSES = {
  Lead: "New",
  "Sales Qualified Lead": "Qualified",
  Customer: "Won",
};

/**
 * Purpose: Create a Contact document from raw submitted data. Orchestration
 * only — preserves contactController.createContact's exact original
 * behavior, including two quirks intentionally kept as-is (not "fixed"
 * during this refactor): (1) `user` is set from `rawData._id` if present,
 * else falls back to the acting user's id — an existing oddity, not
 * introduced here; (2) populate() is called before save() (works today
 * because populate no-ops on empty/unset refs pre-save, but is unusual
 * ordering worth flagging rather than silently reordering).
 * Inputs:
 *   organizationId: ObjectId|string
 *   rawData: plain object (e.g. req.body)
 *   options: { actingUserId, createdByUserId, avatarUrl?, session? }
 *     - actingUserId: used for the `user` fallback (req.user._id in the original)
 *     - createdByUserId: used for createdBy/lastUpdatedBy (req.user._id in the original)
 * Outputs: Promise<ContactDocument> (populated with user/createdBy/lastUpdatedBy names)
 * Side effects: one Contact insert (participates in `session` if provided)
 * Errors thrown: Mongoose ValidationError (missing required fields, invalid
 *   lifecycleStage/stageStatus combination via the model's pre-save hook)
 * Known callers: contactController.createContact (Phase 0)
 */
async function createContact(
  organizationId,
  rawData,
  { actingUserId, createdByUserId, avatarUrl, session } = {}
) {
  let contactData = {
    ...rawData,
    organization: organizationId,
    user: rawData._id || actingUserId,
    createdBy: createdByUserId,
    lastUpdatedBy: createdByUserId,
  };

  if (avatarUrl) {
    contactData.avatar = avatarUrl;
  }

  if (rawData.socialMedia) {
    contactData.socialMedia = normalizeSocialMedia(rawData.socialMedia);
  }

  if (!contactData.lifecycleStage) {
    contactData.lifecycleStage = "Lead";
  }

  if (!contactData.stageStatus) {
    contactData.stageStatus = DEFAULT_STAGE_STATUSES[contactData.lifecycleStage];
  }

  if (rawData.additionalFields) {
    contactData.additionalFields = await processAdditionalFields(
      "contact",
      rawData.additionalFields,
      organizationId
    );
  }

  const newContact = new Contact(contactData);
  // Ordering preserved from the original controller: populate() before save().
  await newContact.populate([
    { path: "user", select: "name" },
    { path: "createdBy", select: "name" },
    { path: "lastUpdatedBy", select: "name" },
  ]);
  await newContact.save({ session });

  return newContact;
}

/**
 * Purpose: Update an existing Contact document from raw submitted data.
 * Permission checking (403 for non-admin users lacking read-write) is
 * intentionally NOT part of this function — that's request/route-context
 * logic, kept in the controller, not the service (services take explicit
 * params, not req/permissions objects).
 * Inputs:
 *   contactId: ObjectId|string
 *   organizationId: ObjectId|string
 *   rawData: plain object (e.g. req.body)
 *   options: { lastUpdatedByUserId, avatarUrl?, session? }
 * Outputs: Promise<ContactDocument|null> - null if no matching contact (caller maps to 404)
 * Side effects: one Contact findOneAndUpdate (participates in `session` if provided)
 * Errors thrown: Mongoose ValidationError (runValidators: true)
 * Known callers: contactController.updateContact (Phase 0)
 */
async function updateContact(
  contactId,
  organizationId,
  rawData,
  { lastUpdatedByUserId, avatarUrl, session } = {}
) {
  let updateData = {
    ...rawData,
    lastUpdatedBy: lastUpdatedByUserId,
  };

  delete updateData.createdBy;

  if (avatarUrl) {
    updateData.avatar = avatarUrl;
  }

  if (rawData.socialMedia) {
    updateData.socialMedia = normalizeSocialMedia(rawData.socialMedia);
  }

  if (updateData.lifecycleStage && !updateData.stageStatus) {
    updateData.stageStatus = DEFAULT_STAGE_STATUSES[updateData.lifecycleStage];
  }

  if (rawData.additionalFields) {
    updateData.additionalFields = await processAdditionalFields(
      "contact",
      rawData.additionalFields,
      organizationId
    );
  }

  const updatedContact = await Contact.findOneAndUpdate(
    { _id: contactId, organization: organizationId },
    updateData,
    { new: true, runValidators: true, session }
  )
    .populate("company")
    .populate("user", "name")
    .populate("createdBy", "name")
    .populate("lastUpdatedBy", "name");

  return updatedContact;
}

module.exports = {
  createContact,
  updateContact,
};
