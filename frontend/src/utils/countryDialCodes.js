/**
 * Dial codes for the phone/WhatsApp country-code pickers.
 *
 * Ordered with India first (this CRM's primary market) and the rest
 * alphabetical, so the common case is the first entry rather than something
 * to hunt for. `code` is stored on the record as typed here, including the
 * leading "+", so it can be rendered directly; strip it when building a
 * wa.me link, which wants digits only.
 */
export const COUNTRY_DIAL_CODES = [
  { code: "+91", iso: "IN", name: "India" },
  { code: "+61", iso: "AU", name: "Australia" },
  { code: "+880", iso: "BD", name: "Bangladesh" },
  { code: "+55", iso: "BR", name: "Brazil" },
  { code: "+1", iso: "CA", name: "Canada" },
  { code: "+86", iso: "CN", name: "China" },
  { code: "+20", iso: "EG", name: "Egypt" },
  { code: "+33", iso: "FR", name: "France" },
  { code: "+49", iso: "DE", name: "Germany" },
  { code: "+852", iso: "HK", name: "Hong Kong" },
  { code: "+62", iso: "ID", name: "Indonesia" },
  { code: "+353", iso: "IE", name: "Ireland" },
  { code: "+972", iso: "IL", name: "Israel" },
  { code: "+39", iso: "IT", name: "Italy" },
  { code: "+81", iso: "JP", name: "Japan" },
  { code: "+254", iso: "KE", name: "Kenya" },
  { code: "+60", iso: "MY", name: "Malaysia" },
  { code: "+52", iso: "MX", name: "Mexico" },
  { code: "+977", iso: "NP", name: "Nepal" },
  { code: "+31", iso: "NL", name: "Netherlands" },
  { code: "+64", iso: "NZ", name: "New Zealand" },
  { code: "+234", iso: "NG", name: "Nigeria" },
  { code: "+92", iso: "PK", name: "Pakistan" },
  { code: "+63", iso: "PH", name: "Philippines" },
  { code: "+974", iso: "QA", name: "Qatar" },
  { code: "+966", iso: "SA", name: "Saudi Arabia" },
  { code: "+65", iso: "SG", name: "Singapore" },
  { code: "+27", iso: "ZA", name: "South Africa" },
  { code: "+82", iso: "KR", name: "South Korea" },
  { code: "+34", iso: "ES", name: "Spain" },
  { code: "+94", iso: "LK", name: "Sri Lanka" },
  { code: "+41", iso: "CH", name: "Switzerland" },
  { code: "+66", iso: "TH", name: "Thailand" },
  { code: "+971", iso: "AE", name: "UAE" },
  { code: "+44", iso: "GB", name: "United Kingdom" },
  { code: "+1", iso: "US", name: "United States" },
  { code: "+84", iso: "VN", name: "Vietnam" },
];

export const DEFAULT_DIAL_CODE = "+91";
