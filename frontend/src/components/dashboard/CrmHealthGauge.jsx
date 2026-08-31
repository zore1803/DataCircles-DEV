/*
 * Semicircular health gauge — the "Chart" block of the CRM tab's first card.
 *
 * Built as SVG arcs rather than the design's stack of absolutely-positioned,
 * rotated rectangles: the same picture, but it scales with the card and
 * doesn't depend on a fixed 280x280 box. The four bands step through the
 * brand blue at a fixed 0.05 → 0.25 → 0.5 → 0.75 → solid ramp, separated by
 * the design's white hairlines. The value is read from the figure in the
 * middle - the design's rotated square marker sat on top of the arc and read
 * as a stray black block rather than a pointer.
 */
const SIZE = 240;
const CX = SIZE / 2;
const CY = SIZE / 2 + 30;
const R = 114;
const STROKE = 22; // radial thickness of the band
const START = 180; // left end of the arc
const SWEEP = 180; // half circle

const polar = (angleDeg, radius) => {
  const a = (angleDeg * Math.PI) / 180;
  return { x: CX + radius * Math.cos(a), y: CY + radius * Math.sin(a) };
};

const arcPath = (fromDeg, toDeg, radius) => {
  const start = polar(fromDeg, radius);
  const end = polar(toDeg, radius);
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${large} 1 ${end.x} ${end.y}`;
};

// The design's five segments, left to right (Main 2 → Main 3 → Main 5 →
// Main 4 → Main 1): a fixed opacity ramp, not a progress track — every
// segment is always drawn at its own opacity whatever the value is. The two
// end pieces are the narrow caps (40px wide in the design against ~278px for
// the three middle shapes), so they get a correspondingly smaller sweep.
const SEGMENTS = [
  { sweep: 22, opacity: 0.05 },
  { sweep: 45, opacity: 0.25 },
  { sweep: 45, opacity: 0.5 },
  { sweep: 45, opacity: 0.75 },
  { sweep: 23, opacity: 1 },
];

export default function CrmHealthGauge({ value = 0, label = "" }) {
  const pct = Math.min(100, Math.max(0, value));
  // Running start angle per segment, with the design's white hairline showing
  // as a small gap between neighbours.
  const GAP = 1.4;
  let cursor = START;
  const arcs = SEGMENTS.map((seg, i) => {
    const from = cursor + (i === 0 ? 0 : GAP);
    const to = cursor + seg.sweep - (i === SEGMENTS.length - 1 ? 0 : GAP);
    cursor += seg.sweep;
    return { from, to, opacity: seg.opacity };
  });

  return (
    <svg
      // Cropped to the drawing rather than the full square box: the arc only
      // occupies the upper middle of a SIZE x SIZE canvas, so a square
      // viewBox wasted about half the height and rendered the gauge small.
      // The crop hugs the arc's outer radius (CY - R - STROKE/2 = 27) and
      // stops just under the caption, so the gauge grows upward inside the
      // card without the card itself getting taller.
      viewBox={`-6 22 ${SIZE + 12} 136`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
      style={{ maxHeight: 240 }}
      role="img"
      aria-label={`${pct}% ${label}`}
    >
      {arcs.map((a, i) => {
        const isLast = i === arcs.length - 1;
        // The band and its rounded tip are drawn inside one group whose
        // opacity is applied to the composited result. Painting them as two
        // semi-transparent shapes instead meant the disc and the stroke
        // overlapped and their alphas compounded, leaving a visibly darker
        // patch at the arc's ends.
        // Both ends are rounded. The faint first segment's cap is safe to
        // draw again now that the band and its tip share one group opacity:
        // as two separately-transparent shapes their alphas compounded where
        // they overlapped, which is what made this end look like a darker
        // blob rather than a rounded tip.
        const isFirst = i === 0;
        const cap = isFirst
          ? polar(START, R)
          : isLast
          ? polar(START + SWEEP, R)
          : null;
        return (
          <g key={i} opacity={a.opacity}>
            <path
              d={arcPath(a.from, a.to, R)}
              fill="none"
              stroke="#0085FF"
              strokeWidth={STROKE}
            />
            {cap && <circle cx={cap.x} cy={cap.y} r={STROKE / 2} fill="#0085FF" />}
          </g>
        );
      })}

      <text
        x={CX}
        y={CY - 26}
        textAnchor="middle"
        style={{ fontFamily: "'DM Sans', Inter, sans-serif", fontWeight: 500, fontSize: 32, fill: "#21201F" }}
      >
        {pct}%
      </text>
      <text
        x={CX}
        y={CY - 2}
        textAnchor="middle"
        style={{ fontFamily: "'DM Sans', Inter, sans-serif", fontWeight: 500, fontSize: 15, fill: "rgba(33, 32, 31, 0.74)" }}
      >
        {label}
      </text>
    </svg>
  );
}
