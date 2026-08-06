// Shared relative-date bucketing for the column filter panels.
//
// Previously each list tab carried its own identical copy of this, built on a
// `daysAgo()` helper that only ever looked backwards:
//
//   const daysAgo = (d) => Math.floor((Date.now() - new Date(d).getTime()) / DAY);
//   { label: "Today", test: (d) => daysAgo(d) < 1 }
//
// For a date in the FUTURE `daysAgo` is negative, and any negative number
// satisfies `< 1` — so every upcoming date fell into "Today" and the remaining
// buckets matched nothing. That silently broke the Due Date / Date & Time
// filters, where values are normally in the future.
//
// The fix is a SIGNED whole-day offset (negative = past, positive = future),
// compared from the start of each day so "Today" means the same calendar day
// rather than "less than 24h ago". Buckets are ordered most-specific first, so
// `find()` returns the tightest match.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const startOfDay = (value) => {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Whole days from today: 0 = today, negative = past, positive = future. */
export const dayOffset = (value) =>
  Math.round((startOfDay(value) - startOfDay(Date.now())) / MS_PER_DAY);

// "This Week"/"This Month" are direction-agnostic (a date 3 days either side of
// today is "This Week"), which keeps the original labels meaning what they did
// for backward-looking columns like Deals' Last Updated. "Upcoming" is new and
// necessary: without it, a date more than a month ahead matched no bucket at
// all, got an empty label, and became impossible to filter on.
export const DATE_RANGES = [
  { label: "Today", test: (d) => dayOffset(d) === 0 },
  { label: "This Week", test: (d) => Math.abs(dayOffset(d)) <= 7 },
  { label: "This Month", test: (d) => Math.abs(dayOffset(d)) <= 30 },
  { label: "Upcoming", test: (d) => dayOffset(d) > 30 },
  { label: "Older", test: (d) => dayOffset(d) < -30 },
];

export const DATE_RANGE_LABELS = DATE_RANGES.map((r) => r.label);

export const getDateRangeLabel = (date) => {
  if (!date) return "";
  // An unparseable date used to fall through every test and return "", which
  // read as "no value" — keep that, but decide it explicitly rather than by
  // NaN comparisons all happening to be false.
  if (Number.isNaN(new Date(date).getTime())) return "";
  return DATE_RANGES.find((r) => r.test(date))?.label || "";
};
