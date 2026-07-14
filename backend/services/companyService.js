const Company = require("../models/Company");
const { processAdditionalFields } = require("./fieldCoercionService");

function normalizeSocialMedia(socialMedia) {
  return {
    twitter: socialMedia.twitter || "",
    linkedin: socialMedia.linkedin || "",
    facebook: socialMedia.facebook || "",
    whatsapp: socialMedia.whatsapp || "",
  };
}

/**
 * Purpose: Create a Company document from raw submitted data. Orchestration
 * only — preserves companyController.createCompany's exact original
 * behavior, including the `user` fallback quirk (rawData._id if present,
 * else the acting user's id) shared with contactService, kept as-is.
 * Inputs:
 *   organizationId: ObjectId|string
 *   rawData: plain object (e.g. req.body)
 *   options: { actingUserId, createdByUserId, profilePictureUrl?, session? }
 * Outputs: Promise<CompanyDocument> (populated with user/createdBy/lastUpdatedBy names)
 * Side effects: one Company insert (participates in `session` if provided)
 * Errors thrown: Mongoose ValidationError (missing required `name`/`industry`)
 * Known callers: companyController.createCompany (Phase 0)
 */
async function createCompany(
  organizationId,
  rawData,
  { actingUserId, createdByUserId, profilePictureUrl, session } = {}
) {
  const companyData = {
    ...rawData,
    organization: organizationId,
    user: rawData._id || actingUserId,
    createdBy: createdByUserId,
    lastUpdatedBy: createdByUserId,
  };

  if (profilePictureUrl) {
    companyData.profilePicture = profilePictureUrl;
  }

  if (rawData.socialMedia) {
    companyData.socialMedia = normalizeSocialMedia(rawData.socialMedia);
  }

  if (rawData.additionalFields) {
    companyData.additionalFields = await processAdditionalFields(
      "company",
      rawData.additionalFields,
      organizationId
    );
  }

  const company = await Company.create([companyData], { session }).then((docs) => docs[0]);

  await company.populate([
    { path: "user", select: "name" },
    { path: "createdBy", select: "name" },
    { path: "lastUpdatedBy", select: "name" },
  ]);

  return company;
}

/**
 * Purpose: Update an existing Company document from raw submitted data.
 * Permission checking stays in the controller (see contactService's note —
 * same rationale applies).
 * Inputs:
 *   companyId: ObjectId|string
 *   organizationId: ObjectId|string
 *   rawData: plain object (e.g. req.body)
 *   options: { lastUpdatedByUserId, profilePictureUrl?, session? }
 * Outputs: Promise<CompanyDocument|null> - null if no matching company (caller maps to 404)
 * Side effects: one Company findOneAndUpdate (participates in `session` if provided)
 * Errors thrown: Mongoose ValidationError (runValidators: true)
 * Known callers: companyController.updateCompany (Phase 0)
 */
async function updateCompany(
  companyId,
  organizationId,
  rawData,
  { lastUpdatedByUserId, profilePictureUrl, session } = {}
) {
  const updateData = {
    ...rawData,
    lastUpdatedBy: lastUpdatedByUserId,
  };

  delete updateData.createdBy;

  if (profilePictureUrl) {
    updateData.profilePicture = profilePictureUrl;
  }

  if (rawData.socialMedia) {
    updateData.socialMedia = normalizeSocialMedia(rawData.socialMedia);
  }

  if (rawData.additionalFields) {
    updateData.additionalFields = await processAdditionalFields(
      "company",
      rawData.additionalFields,
      organizationId
    );
  }

  const company = await Company.findOneAndUpdate(
    { _id: companyId, organization: organizationId },
    updateData,
    { new: true, runValidators: true, session }
  )
    .populate("user", "name")
    .populate("createdBy", "name")
    .populate("lastUpdatedBy", "name");

  return company;
}

module.exports = {
  createCompany,
  updateCompany,
};
