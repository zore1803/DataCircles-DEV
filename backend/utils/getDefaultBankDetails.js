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

module.exports = getDefaultBankDetails;
