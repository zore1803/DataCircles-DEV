const Company = require("../models/Company");
const Deal = require("../models/Deal");

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

// Accounting documents (Invoice, ProformaInvoice, Quotation, DeliveryChallan)
// link to a company only indirectly, through their Deal (doc.deal ->
// Deal.company) — there's no direct company field on these models. This
// resolves "every deal id belonging to a company this user owns" in one
// query, for controllers that need the same $in-friendly id list Contact/
// Deal's own-only filter already uses.
async function getOwnedDealIds(userId, organizationId) {
  const ownedCompanyIds = await getOwnedCompanyIds(userId, organizationId);
  if (ownedCompanyIds.length === 0) return [];
  const deals = await Deal.find({ company: { $in: ownedCompanyIds }, organization: organizationId })
    .select("_id")
    .lean();
  return deals.map((d) => d._id);
}

module.exports = { getOwnedCompanyIds, getOwnedDealIds };
