// Strips everything but digits and compares by the last 10 digits, so
// "+91 98765 43210", "919876543210", "098765-43210" and "9876543210" are
// all treated as the same number regardless of whether a country code (or
// a leading trunk 0) is present.
function normalizePhone(phone) {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  return digits.slice(-10);
}

module.exports = normalizePhone;
