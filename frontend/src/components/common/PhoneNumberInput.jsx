import { COUNTRY_DIAL_CODES, DEFAULT_DIAL_CODE } from "../../utils/countryDialCodes";

/**
 * One phone field for the whole app: a country-code dropdown (IN +91 by
 * default) next to the number.
 *
 * Stores and emits a single string — "+91 9876543210" — rather than a pair of
 * fields. Every model already keeps `phone` as a plain String, and plenty of
 * code reads it straight out (duplicate detection, exports, SMS "to", contact
 * cards); splitting it into an object would mean touching all of them and
 * migrating existing records. Keeping one string means old values still work
 * and nothing downstream has to change.
 *
 * A value saved before this field existed has no code — it parses as "no code
 * chosen", so the dropdown shows the default without silently claiming the
 * number is Indian in the stored data until the user actually saves.
 */
export const splitPhone = (value) => {
  const raw = (value || "").trim();
  const m = raw.match(/^(\+\d{1,4})[\s-]*(.*)$/);
  if (m) return { code: m[1], number: m[2].trim() };
  return { code: "", number: raw };
};

export const joinPhone = (code, number) => {
  const n = (number || "").trim();
  if (!n) return "";
  return `${code || DEFAULT_DIAL_CODE} ${n}`;
};

export default function PhoneNumberInput({
  value,
  onChange,
  placeholder = "9876543210",
  disabled = false,
  className = "",
  selectClassName = "",
  inputClassName = "",
  id,
}) {
  const { code, number } = splitPhone(value);
  const selected = code || DEFAULT_DIAL_CODE;

  const emit = (nextCode, nextNumber) => onChange(joinPhone(nextCode, nextNumber));

  return (
    <div className={`flex items-stretch gap-2 ${className}`}>
      <select
        aria-label="Country code"
        value={selected}
        disabled={disabled}
        onChange={(e) => emit(e.target.value, number)}
        className={
          selectClassName ||
          "border border-[#E0E0E1] rounded-xl px-2 h-12 text-[14px] text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all flex-shrink-0"
        }
      >
        {COUNTRY_DIAL_CODES.map((c) => (
          <option key={`${c.iso}-${c.code}`} value={c.code}>
            {c.iso} {c.code}
          </option>
        ))}
      </select>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        disabled={disabled}
        value={number}
        // Digits only — the code comes from the dropdown, so anything typed
        // here is the subscriber number.
        onChange={(e) => emit(selected, e.target.value.replace(/[^0-9]/g, ""))}
        className={
          inputClassName ||
          "flex-1 min-w-0 border border-[#E0E0E1] rounded-xl px-4 h-12 text-[14px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-[#A0A0A0]"
        }
        placeholder={placeholder}
      />
    </div>
  );
}
