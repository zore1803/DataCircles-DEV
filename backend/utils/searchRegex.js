// utils/searchRegex.js
//
// Builds a case-insensitive $regex pattern for free-text search fields
// (company/contact/deal name, industry, address, notes, etc.) that treats
// "&" and the word "and" as interchangeable — a customer searching "finance
// and banking" should still find a record stored as "Finance & Banking", and
// vice versa, since users don't reliably type the symbol.
//
// Also escapes regex metacharacters in the raw input first: previously the
// user's search string went straight into $regex unescaped, so a search
// term containing ., *, +, ?, (, etc. either silently matched more/less than
// intended or threw a regex syntax error.
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildFuzzySearchPattern(term) {
  const escaped = escapeRegex(String(term || '').trim());
  if (!escaped) return escaped;
  return escaped
    .replace(/&/g, '(?:&|and)')
    .replace(/\band\b/gi, '(?:and|&)');
}

module.exports = { escapeRegex, buildFuzzySearchPattern };
