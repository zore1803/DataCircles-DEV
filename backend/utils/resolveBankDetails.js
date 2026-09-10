const BankDetails = require("../models/BankDetails");
const getDefaultBankDetails = require("./getDefaultBankDetails");

/**
 * Bank account to print on a document.
 *
 * If the document carries an explicit `bankDetails` reference (chosen in the
 * invoice form's "Select Bank" dropdown), that account is used, as long as it
 * still belongs to the same organisation. Otherwise it falls back to the
 * organisation's default bank (see getDefaultBankDetails).
 *
 * @param {object} doc           - the invoice / quotation / proforma / challan doc
 * @param {string} organizationId
 * @returns {Promise<object|null>} a BankDetails document (or null)
 */
async function resolveBankDetails(doc, organizationId) {
  const chosenId = doc?.bankDetails?._id || doc?.bankDetails;
  if (chosenId && organizationId) {
    const chosen = await BankDetails.findOne({
      _id: chosenId,
      organization: organizationId,
    });
    if (chosen) return chosen;
  }
  return getDefaultBankDetails(organizationId);
}

module.exports = resolveBankDetails;
