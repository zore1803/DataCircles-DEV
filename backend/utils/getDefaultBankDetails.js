const BankDetails = require("../models/BankDetails");

async function getDefaultBankDetails(organizationId) {
  if (!organizationId) return null;

  const defaultBank = await BankDetails.findOne({
    organization: organizationId,
    isDefault: true,
  }).sort({ updatedAt: -1 });

  if (defaultBank) return defaultBank;

  return BankDetails.findOne({ organization: organizationId }).sort({ updatedAt: -1 });
}

// Resolves the bank account a document should print: the one explicitly
// picked on it (bankDetailsId), falling back to the org's default when
// that's unset or was since deleted.
async function resolveBankDetails(organizationId, bankDetailsId) {
  if (bankDetailsId) {
    const picked = await BankDetails.findOne({
      _id: bankDetailsId,
      organization: organizationId,
    });
    if (picked) return picked;
  }
  return getDefaultBankDetails(organizationId);
}

module.exports = getDefaultBankDetails;
module.exports.resolveBankDetails = resolveBankDetails;
