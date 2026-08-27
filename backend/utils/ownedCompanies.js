const Company = require("../models/Company");

// Own-only staff should also see everything tied to a company they've been
// made the owner of (Company.owner), not just records they personally
// created — e.g. a company's contacts, deals, meetings, etc. Shared by every
// controller that needs to widen its own-only filter with "or belongs to a
// company I own".
async function getOwnedCompanyIds(userId, organizationId) {
  const companies = await Company.find({ owner: userId, organization: organizationId })
    .select("_id")
    .lean();
  return companies.map((c) => c._id);
}

module.exports = { getOwnedCompanyIds };
