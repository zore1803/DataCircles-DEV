// src/data/bankLogos.js
/**
 * Helper that returns the public URL for a bank logo stored in the
 * `public/bank-icons` folder. Assets placed in `public` are served directly
 * from the site root, so we can reference them via static URLs.
 *
 * This file maintains a **static map** of known banks to their relative URL
 * inside `public/bank-icons`. An alias map handles common name variations
 * (e.g., "HDFC" vs "HDFC Bank"). Adding a new logo only requires an entry
 * in `logoMap`.
 */

// Normalise a string: trim spaces, remove non‑alphanumeric chars, lower‑case.
function normalise(str) {
  return String(str)
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

// Alias map – maps a normalised variation to the canonical key used in `logoMap`.
const aliasMap = {
  // HDFC variations – actual file is bi_hdfcbank.png
  hdfc: "hdfcbank",
  hdfcbank: "hdfcbank",
  // State Bank of India – file is bi_sbi.png
  sbi: "sbi",
  sbiindia: "sbi",
  statebankofindia: "sbi",
  // ICICI Bank – file is bi_icicibank.png
  icici: "icicibank",
  icicibank: "icicibank",
  // Axis Bank – file is bi_axisbank.png
  axis: "axisbank",
  axisbank: "axisbank",
  // Kotak Mahindra Bank – file is bi_kotak.png
  kotak: "kotak",
  kotakmahindra: "kotak",
  kotakmahindrabank: "kotak",
  // Punjab National Bank – file is bi_pnb.png
  pnb: "pnb",
  punjabnationalbank: "pnb",
  punjabnational: "pnb",
  // Add more aliases as needed
};

// Static map of canonical keys to their public URLs (relative to the site root).
const logoMap = {
  hdfcbank: "/bank-icons/private_sector_banks/bi_hdfcbank.png",
  sbi: "/bank-icons/public_sector_banks/bi_sbi.png",
  icicibank: "/bank-icons/private_sector_banks/bi_icicibank.png",
  axisbank: "/bank-icons/private_sector_banks/bi_axisbank.png",
  kotak: "/bank-icons/private_sector_banks/bi_kotak.png",
  pnb: "/bank-icons/private_sector_banks/bi_pnb.png",
  // Extend this map with additional banks as needed.
};

/**
 * Returns the public URL for a bank logo, or `null` if no logo is defined.
 * @param {string} bankName Full bank name (e.g. "HDFC Bank")
 * @returns {string|null}
 */
export function getBankLogoUrl(bankName) {
  if (!bankName) return null;
  const normalized = normalise(bankName);
  const canonical = aliasMap[normalized] || normalized;
  return logoMap[canonical] || null;
}
