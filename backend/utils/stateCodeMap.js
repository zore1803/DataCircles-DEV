/**
 * stateCodeMap.js
 *
 * Central lookup utility for Indian GST state codes (2-digit numeric).
 * Used by the E-Invoice mapper to convert a human-readable state name
 * (e.g. "Maharashtra") into the IRP-required numeric code (e.g. "27").
 *
 * Single source of truth — never ask users to type a numeric code manually.
 * Usage:
 *   const { getStateCode } = require('./stateCodeMap');
 *   getStateCode('Maharashtra'); // → "27"
 *   getStateCode('27');          // → "27"  (passthrough if already a code)
 */

const STATE_CODE_MAP = {
  // Jammu & Kashmir
  "jammu and kashmir": "01",
  "jammu & kashmir": "01",
  "j&k": "01",
  "jk": "01",

  // Himachal Pradesh
  "himachal pradesh": "02",
  "hp": "02",

  // Punjab
  "punjab": "03",

  // Chandigarh
  "chandigarh": "04",

  // Uttarakhand
  "uttarakhand": "05",
  "uttaranchal": "05",

  // Haryana
  "haryana": "06",

  // Delhi
  "delhi": "07",
  "new delhi": "07",

  // Rajasthan
  "rajasthan": "08",

  // Uttar Pradesh
  "uttar pradesh": "09",
  "up": "09",

  // Bihar
  "bihar": "10",

  // Sikkim
  "sikkim": "11",

  // Arunachal Pradesh
  "arunachal pradesh": "12",

  // Nagaland
  "nagaland": "13",

  // Manipur
  "manipur": "14",

  // Mizoram
  "mizoram": "15",

  // Tripura
  "tripura": "16",

  // Meghalaya
  "meghalaya": "17",

  // Assam
  "assam": "18",

  // West Bengal
  "west bengal": "19",
  "wb": "19",

  // Jharkhand
  "jharkhand": "20",

  // Odisha
  "odisha": "21",
  "orissa": "21",

  // Chhattisgarh
  "chhattisgarh": "22",

  // Madhya Pradesh
  "madhya pradesh": "23",
  "mp": "23",

  // Gujarat
  "gujarat": "24",

  // Daman and Diu + Dadra and Nagar Haveli (merged UT)
  "daman and diu": "25",
  "dadra and nagar haveli and daman and diu": "26",
  "dadra & nagar haveli": "26",
  "dnhdd": "26",

  // Maharashtra
  "maharashtra": "27",
  "mh": "27",

  // Andhra Pradesh (old unified)
  "andhra pradesh": "28",
  "ap": "28",

  // Karnataka
  "karnataka": "29",

  // Goa
  "goa": "30",

  // Lakshadweep
  "lakshadweep": "31",

  // Kerala
  "kerala": "32",

  // Tamil Nadu
  "tamil nadu": "33",
  "tn": "33",

  // Puducherry
  "puducherry": "34",
  "pondicherry": "34",

  // Andaman and Nicobar Islands
  "andaman and nicobar islands": "35",
  "andaman & nicobar": "35",

  // Telangana
  "telangana": "36",
  "ts": "36",

  // Andhra Pradesh (post-bifurcation)
  "andhra pradesh (new)": "37",

  // Ladakh
  "ladakh": "38",

  // Other Territory
  "other territory": "97",
};

/**
 * Returns the 2-digit GST state code for a given state name or code.
 *
 * @param {string} stateInput - State name (e.g. "Maharashtra") or existing numeric code (e.g. "27")
 * @returns {string|null} - 2-digit code string, or null if not found
 */
function getStateCode(stateInput) {
  if (!stateInput) return null;

  const trimmed = stateInput.trim();

  // Passthrough: if it's already a valid 2-digit numeric code, return as-is
  if (/^\d{2}$/.test(trimmed)) return trimmed;

  const lookup = trimmed.toLowerCase();
  return STATE_CODE_MAP[lookup] || null;
}

/**
 * Returns the state name for a given 2-digit GST state code.
 * Useful for display in UI or audit logs.
 *
 * @param {string} code - 2-digit state code (e.g. "27")
 * @returns {string|null}
 */
function getStateName(code) {
  if (!code) return null;
  const entry = Object.entries(STATE_CODE_MAP).find(([, v]) => v === code.trim());
  return entry ? entry[0] : null;
}

module.exports = { getStateCode, getStateName, STATE_CODE_MAP };
