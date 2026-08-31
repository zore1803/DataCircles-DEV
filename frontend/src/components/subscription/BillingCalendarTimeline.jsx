import React, { useMemo, useState, useEffect, useRef } from "react";
import { groupPaidSegmentsByTier, addBillingCycle } from "../../utils/billingCalendarSegments";

const LABEL_COL = "104px";

// One hue per plan tier, distinct from the trial's own blue-500 — found
// live: Growth's original bg-blue-600 sat right next to the trial's
// blue-500 and read as "basically the same color."
//
// Deliberately DESATURATED (slate/stone/deep-violet, not teal-600/amber-800/
// orange-500 — all tried and reported as "very bad and too bright" live).
// The rest of the app uses white cards, gray borders, and exactly one
// accent color; a saturated rainbow of tiers fights that, so these read as
// muted material tones that differ in hue and depth without shouting.
// Growth is stone (a warm brownish gray), per the explicit brownish
// request, at a lightness that stays quiet next to the others.
// An unrecognized plan name (a future new tier not added to this map yet)
// falls back here too rather than rendering unstyled.
const PLAN_TIER_COLOR = {
  starter: "bg-slate-400",
  growth: "bg-stone-500",
  business: "bg-violet-800",
  default: "bg-stone-500",
};

// Border-color counterpart, for the projection's own connector lines — kept
// as its own map (not derived from PLAN_TIER_COLOR's bg-* strings) so an
// upgrade/downgrade connector reads as tied to the branch it leads to,
// rather than the same neutral gray used for the REAL historical tier-
// ladder connectors (BillingCalendarTimeline's own `connectors` — a
// projection line must never look identical to a real one, or a real
// past transition and a hypothetical what-if become indistinguishable).
const PLAN_TIER_BORDER_COLOR = {
  starter: "border-slate-300",
  growth: "border-stone-400",
  business: "border-violet-400",
  default: "border-stone-400",
};

function pct(date, range) {
  if (!date) return null;
  const t = new Date(date).getTime();
  const frac = (t - range.start.getTime()) / (range.end.getTime() - range.start.getTime());
  return Math.min(100, Math.max(0, frac * 100));
}

// Month-boundary ticks — only meaningful once the visible window spans
// enough time for "1st of the month" labels to actually land inside it.
function monthTicks(range) {
  const ticks = [];
  const cursor = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
  while (cursor <= range.end) {
    if (cursor >= range.start) {
      ticks.push({
        date: new Date(cursor),
        label: cursor.toLocaleDateString("en-IN", { month: "short", year: "numeric" }).toUpperCase()
      });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return ticks;
}

// Weekly day-level ticks (e.g. "11 AUG") — used instead of monthTicks for a
// narrow window (a trial-only calendar capped to ~2-3 weeks). A window that
// short can easily contain zero month boundaries at all — a 7-day trial
// starting mid-August never touches Sept 1, so monthTicks alone renders no
// dates whatsoever (found live: user reported "there are no dates").
function dayTicks(range) {
  const ticks = [];
  const spanMs = range.end.getTime() - range.start.getTime();
  const spanDays = spanMs / (24 * 60 * 60 * 1000);
  // Roughly 4-6 ticks regardless of exact span, rounded to a whole number
  // of days so labels land on clean dates rather than odd fractional ones.
  const stepDays = Math.max(1, Math.round(spanDays / 5));
  const cursor = new Date(range.start);
  cursor.setHours(0, 0, 0, 0);
  while (cursor <= range.end) {
    if (cursor >= range.start) {
      ticks.push({
        date: new Date(cursor),
        label: cursor.toLocaleDateString("en-IN", { day: "numeric", month: "short" }).toUpperCase(),
      });
    }
    cursor.setDate(cursor.getDate() + stepDays);
  }
  return ticks;
}

// The chart's pixel width must grow with how many ticks it have to fit —
// a fixed width regardless of zoom is what made 1Y's twelve month labels
// overlap into an unreadable smear. First attempt at this used a single
// max(720, tickCount*110) formula — still wrong for 6M specifically: 6
// month-ticks * 110px = 660px, which is BELOW the 720 floor, so it silently
// clamped back down to the exact same width as a 5-tick 1M day-view, while
// now needing to fit the visibly wider "SEPT 2026" labels (found live —
// reported as "smooshed" going from 1M to 6M). Month labels need more
// room per tick than day labels ("SEPT 2026" vs "17 AUG"), so they get
// their own, larger per-tick allowance, and there's no artificial floor
// pulling a legitimately-wide requirement back down.
function chartWidth(tickCount, isMonthly) {
  const perTick = isMonthly ? 150 : 100;
  return Math.max(600, tickCount * perTick);
}

// Collapses markers occurring on the exact same day to prevent visual overlap
function clusterMarkers(markers) {
  const clusters = {};
  markers.forEach(m => {
    const d = new Date(m.date).toDateString();
    if (!clusters[d]) clusters[d] = { date: m.date, events: [], tone: m.tone };
    clusters[d].events.push(m);
    if (m.tone === 'critical') clusters[d].tone = 'critical';
  });
  return Object.values(clusters);
}

const Segment = ({ seg, range, isBase }) => {
  let left = pct(seg.start, range);
  let right = seg.end ? pct(seg.end, range) : 100;
  if (left == null) left = 0;
  if (right < left) right = left;
  const width = Math.max(0, right - left);

  if (seg.tone === "none") {
    // A terminal notice. Empty space on the track, just text.
    return (
      <div
        className="absolute top-1/2 -translate-y-1/2 flex flex-col items-start pl-4"
        style={{ left: `${left}%`, width: `${width}%` }}
      >
        <span className="text-xs font-semibold text-gray-500 mt-6">No active subscription</span>
        <span className="text-[11px] text-gray-400 mt-0.5">Choose a plan to continue</span>
      </div>
    );
  }

  const isScheduled = seg.tone === "scheduled";
  const isPast = seg.tone === "past";
  const isAnnual = isBase && seg.billingCycle === "yearly" && !isScheduled;
  const isTrial = seg.tone === "trial";

  // Each plan TIER gets its own hue on the paid track (not just current-
  // vs-past) — found necessary live: with every tier rendered in the same
  // flat blue, a real Starter -> Growth -> Business history read as one
  // undifferentiated bar with no visual sense of which stretch was which
  // plan. isPast fades it (opacity) rather than flattening it to gray, so
  // history stays identifiable by tier while still reading as "not current".
  // Add-on lanes (isBase=false) get their own hue too — add-ons were
  // originally hardcoded to bg-blue-600, indistinguishable from the trial's
  // blue-500 right above them. Indigo, then orange, were both tried and
  // reported as too bright/bad live — teal-700 is muted enough to sit
  // quietly next to the (deliberately desaturated) tier colors while still
  // being clearly its own thing, since an add-on is a different KIND of
  // object than a plan tier, not another rung on the same ladder.
  const tierColor = isBase && !isTrial ? (PLAN_TIER_COLOR[(seg.planName || '').toLowerCase()] || PLAN_TIER_COLOR.default) : 'bg-teal-700';

  // Trial renders a shade lighter than a real paid segment (blue-500 vs the
  // app's blue-600 accent) — this leaves headroom for the adjustment-
  // extension overlay to read as "one step darker than the trial bar"
  // without turning near-navy the way blue-600 + a darker-still overlay did.
  const colorStr = isScheduled ? "border-amber-400" : (isTrial ? "bg-blue-500" : tierColor);
  const fadeClass = isPast && !isScheduled ? "opacity-50" : "";
  const baseClass = `absolute top-1/2 -translate-y-1/2 h-3.5 rounded-full ${isScheduled ? `border-[3px] border-dashed ${colorStr}` : `${colorStr} ${fadeClass} shadow-sm`}`;

  return (
    <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `${left}%`, width: `${width}%` }}>
      {/* Inline label above segment */}
      <div className="absolute bottom-full mb-2.5 left-0 truncate pr-2 text-sm font-semibold text-gray-800">
        {isTrial ? 'Free Trial' : seg.planName} {!isTrial && seg.billingCycle && <span className="font-normal text-gray-400">· {seg.billingCycle === 'yearly' ? 'Annual' : 'Monthly'}</span>}
        {seg.quantity != null && <span className="font-normal text-gray-400">· ×{seg.quantity}</span>}
        {isScheduled && <span className="ml-2 text-[11px] font-bold tracking-wide text-amber-600 uppercase">Scheduled</span>}
      </div>

      {isAnnual ? (
        <div className={`absolute top-1/2 -translate-y-1/2 h-5 w-full ${tierColor} ${fadeClass} rounded-full shadow-sm overflow-hidden flex items-center px-3`}>
           <span className="text-[10px] font-bold uppercase text-white tracking-wide truncate">Full paid term</span>
           {right >= 95 && <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-r from-transparent to-white/40" />}
        </div>
      ) : (
        <div className={`${baseClass} w-full`} />
      )}
    </div>
  );
};

// Fourth pass — and this time the fix is subtraction, not another color
// scheme. Every previous version (hatching+red, then a solid extension
// box + a ghost box) assumed there'd be roughly ONE adjustment to show.
// A real org with multiple admin actions (extend, extend again, end
// early — three separate events, confirmed live) painted THREE overlay
// boxes on the SAME bar, each independently spanning its OWN
// previousEnd/newEnd — including boxes for dates that no longer mean
// anything once a LATER adjustment superseded them. The boxes overlapped
// each other and bled past the real bar's actual end, which is exactly
// what covered up the "No active subscription" label at 1Y/2Y (found
// live — text rendering cut off mid-word behind a stray dashed pill).
//
// There is no box-based design that scales to an arbitrary number of
// historical adjustments without this — so adjustments no longer paint
// anything on the bar at all. They're just markers now, same pipeline as
// every other billing event (clusterMarkers/MarkerCluster below), deduped
// by day like everything else. The bar itself only ever reflects the
// CURRENT, final state (Segment, unchanged) — the full before/after story
// for each historical adjustment lives in the Trial Adjustment History
// panel (BillingCalendarModal.jsx), which already renders it correctly as
// plain text with no positional math to get wrong.

const isAdminTrialAdjustment = (m) =>
  m.eventType === 'TRIAL_ADJUSTED' || (m.eventType === 'TRIAL_ENDED' && m.metadata?.endedBy === 'admin');

const MarkerCluster = ({ cluster, range, onSelect }) => {
  const left = pct(cluster.date, range);
  if (left == null) return null;

  let markerClass = "bg-white border-gray-400";
  if (cluster.tone === "critical") markerClass = "bg-white border-amber-500";
  else if (cluster.tone === "scheduled") markerClass = "bg-white border-amber-400";

  // A single admin adjustment gets its actual before/after dates in the
  // hover detail (same info the old on-bar boxes tried to show, minus the
  // overlap bug) — everything else keeps the plain title/count.
  const singleEvent = cluster.events.length === 1 ? cluster.events[0] : null;
  const adjustment = singleEvent && isAdminTrialAdjustment(singleEvent) ? singleEvent.metadata : null;

  return (
    <button
      type="button"
      className="absolute top-1/2 -translate-y-1/2 z-20 flex flex-col items-center group cursor-pointer"
      style={{ left: `${left}%`, marginLeft: "-7px" }}
      onClick={() => onSelect(cluster.events[0])}
    >
      <div className={`w-3.5 h-3.5 rounded-full border-[3px] shadow-md transition-transform group-hover:scale-125 ${markerClass}`} />

      {/* Detail text is hover-only now — the dot + its position on the
          axis is the always-visible signal; date/title/count is secondary
          detail (per the density rule: always show state + date + major
          markers, push everything else to hover). This is also what stops
          6M/1Y from accumulating permanent text under every single marker. */}
      <div className="absolute top-full mt-2.5 flex flex-col items-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-30">
        <div className="bg-gray-900 text-white text-[11px] rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
          <p className="font-bold">
            {new Date(cluster.date).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          {adjustment?.previousEnd && adjustment?.newEnd ? (
            <p className="text-gray-300 mt-0.5">
              {singleEvent.title || 'Trial adjusted'} — was ending {new Date(adjustment.previousEnd).toLocaleDateString("en-IN", { day: 'numeric', month: 'short' })}, now {new Date(adjustment.newEnd).toLocaleDateString("en-IN", { day: 'numeric', month: 'short' })}
            </p>
          ) : cluster.events.length === 1 ? (
            <p className="text-gray-300 mt-0.5">{cluster.events[0].title || 'Transition'}</p>
          ) : (
            <p className="text-gray-300 mt-0.5">{cluster.events.length} changes</p>
          )}
        </div>
      </div>
    </button>
  );
};

// Brings the shading back ("why does it not anymore") — but as ONE net
// region, not one box per historical event. Per-event boxes were exactly
// what caused the overlap bug removed above; comparing only the FIRST
// adjustment's previousEnd (the trial's original, never-touched end) to
// the LAST adjustment's newEnd (today's actual final end) collapses any
// number of intermediate extends/reduces into a single, always-correct,
// never-overlapping shaded span — same darker-extension / pale-ghost-
// reduction visual language as before, just computed net instead of
// per-step. No hover detail here (the marker dots already carry that);
// this is purely the "this part of the bar changed" cue.
const NetTrialAdjustment = ({ originalEnd, currentEnd, range }) => {
  const orig = new Date(originalEnd);
  const curr = new Date(currentEnd);
  if (orig.getTime() === curr.getTime()) return null; // net zero — nothing to show

  const isExtension = curr > orig;
  const spanStart = isExtension ? orig : curr;
  const spanEnd = isExtension ? curr : orig;

  let left = pct(spanStart, range);
  let right = pct(spanEnd, range);
  if (left == null || right == null) return null;
  if (right < left) right = left;
  const width = Math.max(1, right - left);

  return (
    <div className="absolute top-1/2 -translate-y-1/2 h-3.5 pointer-events-none" style={{ left: `${left}%`, width: `${width}%` }}>
      {isExtension ? (
        <div className="absolute inset-0 rounded-full bg-blue-700" />
      ) : (
        <div className="absolute inset-0 rounded-full bg-blue-50 border-[1.5px] border-dashed border-blue-300" />
      )}
    </div>
  );
};

// Draggable, on-chart conversion projection — lives directly on the trial
// bar, not as a separate slider widget below the chart (found live: a
// standalone slider read as disconnected from the calendar it was supposed
// to be explaining).
//
// Third pass. What broke the first two: the handle was trapped between
// "today" and "trial end" — but a real customer can start a plan any day,
// including after the trial lapses, and the UI actively prevented showing
// that. Fixed by letting the handle roam the *entire visible chart*, with
// the trial-end boundary drawn as a marker on the track rather than a wall.
// Monthly and Annual also read identically before (same-length lines with
// only a text label distinguishing them) — fixed by making each branch's
// actual pixel length track its real duration (1 month vs 1 year against
// the same date scale everything else on this chart uses), so the length
// itself teaches the difference, with a "↻ renews …" tag where it lands.
// Branches also live in their own well-separated lanes below the bar now,
// instead of crowding the segment label directly above the handle.
// Fifth pass. The fourth version failed for a specific, nameable reason:
// the handle and the branches were two independently-positioned things
// (handle in its own document-flow row, branches in rows below it) instead
// of one shared coordinate system — so nothing ever visibly "came from" the
// handle, it just looked like a marker sitting above two unrelated dashed
// lines. Fixed by putting the handle AND both branches inside a single SVG
// coordinate space that spans the whole fork area: the handle's x is
// computed once and reused, unchanged, as the literal start point of both
// branch paths — they cannot drift apart because they are the same number.
//
// The handle itself now sits ON the trial bar (same y as the bar's own
// center), not below it — dragging it visually feels like sliding a point
// along the real bar. Each branch is a short diagonal peeling away from
// that exact point into its own lane, then a horizontal run with a real
// fade (three opacity stops via an SVG gradient, not a flat dashed line
// that just stops) toward a "renews …" tag at its end. Branches are hidden
// until the user actually touches the handle — before that there's only a
// quiet "drag to preview" hint, so the projection only appears once someone
// asks for it, per the "should only appear on interaction" requirement.
//
// The interactive hit-box is still exactly the slider row (HANDLE_ROW_H)
// and every other element (SVG paths, text labels) is pointer-events-none
// — that's what fixed the earlier click-hijack bug and nothing about this
// rebuild changes that guarantee.
const HANDLE_ROW_H = 24;
const BAR_CENTER_Y = 32; // matches the bar row's own h-16 top-1/2 center
// Pulled up from {78, 112} now that the handle caption row was removed
// (its date moved to the axis) — no reason to leave the gap it used to fill.
// Spacing between lanes widened (32px → 44px) and lanes moved down slightly
// as part of making the branches themselves bigger/bolder (thicker stroke
// needs more room to not look cramped against its own label).
const LANE_Y = { monthly: 66, annual: 110 };
// Legend pushed further down (was FORK_HEIGHT-14, right against Annual's
// own label/renewal-date row) — needs real clearance from the Annual lane,
// not to just barely clear it.
const LEGEND_Y = LANE_Y.annual + 40;
const FORK_HEIGHT = LEGEND_Y + 20;
const KINK_PX = 26; // fixed real-pixel diagonal, same at every zoom level


const TrialConversionFork = ({ range, now, onPreview }) => {
  // Hooks must run unconditionally — called before the validity check below,
  // not after (an early return before useState would violate the Rules of
  // Hooks the instant range/now/trialEnd ever produced a null on one render
  // and not another).
  const [sliderValue, setSliderValue] = useState(0); // 0-100 across the clamped drag range
  const [touched, setTouched] = useState(false); // branches stay hidden until the user drags/clicks
  // Click-to-toggle: a plain click (no movement) on an already-visible
  // handle turns the branches back off — a second click toggles them off
  // just like the first click toggled them on. A drag (the value actually
  // changes) always ends up ON and is never toggled off by this, even if
  // it started from an already-visible state — only a genuine no-movement
  // click can turn it off. touchedAtDragStartRef captures the state from
  // BEFORE this gesture's onPointerDown flips it to true, since state
  // updates are async and can't be read back synchronously afterward.
  const dragStartRef = useRef({ value: 0, wasTouched: false });

  // Reports the currently-previewed date up to the parent axis, so "Today",
  // "Trial ends", and the projection date can all render as one group of
  // key dates above the ordinary calendar ticks — the axis has no other way
  // to know what's being dragged, since the slider's own state lives here.
  useEffect(() => {
    if (!onPreview) return;
    if (!touched || !now) { onPreview(null); return; }
    const maxDragMs = range.end.getTime();
    onPreview(now.getTime() + (sliderValue / 100) * (maxDragMs - now.getTime()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [touched, sliderValue, now, range.end]);

  const trackLeft = pct(now, range);
  if (trackLeft == null) return null;

  const nowMs = now.getTime();
  const rangeEndMs = range.end.getTime();
  // Drag now spans the FULL visible chart (today → range.end), not an
  // arbitrary trial-end+30-days cap — that cap was its own confusing thing:
  // the dotted rail/handle would stop dead in the middle of a 3M/6M/1Y
  // view for no reason visible on the chart itself (found live: "why does
  // it only extend a month, this makes no sense"). The zoom buttons (1M/
  // 3M/6M/1Y/2Y) are already the control for "how far into the future,"
  // so the drag range should just match whatever the user picked there —
  // one control for that, not two disagreeing ones.
  const maxDragMs = rangeEndMs;
  if (maxDragMs <= nowMs) return null;

  const handleDateMs = nowMs + (sliderValue / 100) * (maxDragMs - nowMs);
  const handlePct = trackLeft + (sliderValue / 100) * (pct(new Date(maxDragMs), range) - trackLeft);
  const branches = [
    { id: 'monthly', label: 'Monthly', renewLabel: 'renews', cycle: 'monthly', laneY: LANE_Y.monthly, stroke: '#2563eb', textClass: 'text-blue-600' },
    { id: 'annual', label: 'Annual', renewLabel: 'renews', cycle: 'yearly', laneY: LANE_Y.annual, stroke: '#9333ea', textClass: 'text-purple-600' },
  ];

  return (
    <div className="relative pointer-events-none" style={{ height: `${FORK_HEIGHT}px`, marginTop: `-${BAR_CENTER_Y}px` }}>
      {/* No trial-end tick drawn in here anymore — BillingCalendarTimeline
          already draws one continuous amber guideline from the "Trial
          ends" axis label all the way down through the bar; a second,
          shorter one starting mid-fork was a redundant duplicate at the
          same x position. */}

      {/* Second pass on the branches' own rendering. The single SVG path
          (diagonal + long horizontal run in ONE <path>, drawn against a
          "0 0 1000 H" viewBox stretched non-uniformly via
          preserveAspectRatio="none") looked right at 1M but turned into
          fat, stretched-out blobs at 1Y/2Y (found live). Cause: SVG
          stroke-dasharray is defined in the viewBox's own coordinate units,
          and preserveAspectRatio="none" scales x and y by DIFFERENT
          factors — at 2Y the chart is ~5x wider than at 1M, so the SAME
          dash length was being stretched ~5x horizontally while staying
          the same vertically, turning round dashes into ellipses.
          Fix: only the short diagonal kink still uses SVG, sized in real,
          un-stretched pixels (viewBox width/height == actual rendered
          width/height, so scale factor is always exactly 1, at every
          zoom). The long horizontal run is now a plain CSS
          border-dashed div — the browser renders border-dash patterns in
          real CSS pixels regardless of the element's percentage width, so
          it can never be stretched by zoom the way an SVG dasharray was. */}
      {touched && branches.map((b) => {
        const rawEndMs = addBillingCycle(new Date(handleDateMs), b.cycle).getTime();
        const clipped = rawEndMs > rangeEndMs;
        const endMs = clipped ? rangeEndMs : rawEndMs;
        const endPct = pct(new Date(endMs), range);
        return (
          <React.Fragment key={b.id}>
            <svg
              className="absolute pointer-events-none"
              width={KINK_PX}
              height={b.laneY - BAR_CENTER_Y}
              viewBox={`0 0 ${KINK_PX} ${b.laneY - BAR_CENTER_Y}`}
              style={{ left: `${handlePct}%`, top: `${BAR_CENTER_Y}px`, overflow: 'visible' }}
            >
              <line x1="0" y1="0" x2={KINK_PX} y2={b.laneY - BAR_CENTER_Y} stroke={b.stroke} strokeOpacity="0.75" strokeWidth="5" strokeLinecap="round" strokeDasharray="2 6" />
            </svg>
            <div
              className="absolute h-0 border-t-[5px] border-dashed"
              style={{
                left: `calc(${handlePct}% + ${KINK_PX}px)`,
                width: `calc(${endPct - handlePct}% - ${KINK_PX}px)`,
                top: `${b.laneY}px`,
                borderColor: b.stroke,
                opacity: 0.75,
                WebkitMaskImage: `linear-gradient(to right, black 0%, black 45%, transparent 95%)`,
                maskImage: `linear-gradient(to right, black 0%, black 45%, transparent 95%)`,
              }}
            />
            {/* Label sits BELOW its own dashed line now, not centered on
                top of it — text and dots overlapping/interleaving each
                other made both unreadable (found live: "cannot read
                properly"). A few px clearance below is enough to keep the
                label visibly attached to its line without touching it. */}
            <span
              className={`absolute text-[11px] font-bold whitespace-nowrap ${b.textClass}`}
              style={{ left: `calc(${handlePct}% + 32px)`, top: `${b.laneY + 6}px` }}
            >
              {b.label}
            </span>
            {!clipped && (
              // Shows the actual computed renewal date, the same way the
              // handle's own date is shown up on the axis — mirrors
              // backend/utils/renewalEngine.js's addBillingCycle exactly
              // (calendar month/year, not a flat day count), so "30 Sept"
              // here is the same date the real renewal would land on.
              <span
                className={`absolute text-[10px] font-semibold whitespace-nowrap opacity-80 ${b.textClass}`}
                style={{ left: `calc(${endPct}% + 4px)`, top: `${b.laneY + 6}px` }}
              >
                ↻ {b.renewLabel} {new Date(endMs).toLocaleDateString("en-IN", { day: 'numeric', month: 'short' })}
              </span>
            )}
          </React.Fragment>
        );
      })}

      {/* No date/caption text here anymore — the previewed date now lives
          exactly once, up in the axis's own key-dates row (fed by
          onPreview), connected to this exact handle position by the
          dashed guideline BillingCalendarTimeline draws. Repeating it here
          too was the literal duplicate this was reported for ("remove the
          18 Aug — billing anchor part"). Only the pre-touch hint stays,
          since there's nothing yet for the axis to show. */}
      {!touched && (
        <span
          className="absolute -translate-x-1/2 text-[10px] font-semibold text-gray-400 whitespace-nowrap"
          style={{ left: `${handlePct}%`, top: `${BAR_CENTER_Y + 14}px` }}
        >
          drag to preview Monthly / Annual
        </span>
      )}

      {touched && (
        <div className="flex items-center gap-4 text-[9px] text-gray-400" style={{ position: 'absolute', left: 0, top: `${LEGEND_Y}px` }}>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-blue-600 rounded-full" />Real</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-0 border-t-2 border-dotted border-gray-400 opacity-60" />Projected — nothing charged</span>
        </div>
      )}

      {/* Handle itself + its interactive row — sits ON the bar (BAR_CENTER_Y),
          the ONLY pointer-events-enabled element in this whole overlay, and
          its hit-box is pinned to exactly HANDLE_ROW_H so nothing below can
          ever fall inside the slider's own bounding box.
          Root cause of the cross-zoom misalignment (verified live): this
          input's width was `calc(100% - trackLeft%)` — it visually spanned
          all the way to the chart's right edge, and a NATIVE range input
          maps its value 0–100 linearly across its own rendered width. But
          handlePct above maps that same 0–100 across a SMALLER sub-range
          (trackLeft → maxDragPct, clamped to trial-end + 30 days) — at 1M
          zoom maxDragMs already equals range.end so the two ranges happen
          to coincide, which is exactly why "it works perfectly at 1M": the
          bug was invisible there by coincidence, not because it was fixed.
          At 3M/6M/1Y, range.end sits well past maxDragMs, so the input's
          visual span and handlePct's math span became two different
          things — the browser-drawn thumb and the SVG/guideline drifted
          apart by the gap between them. Fix: give the input the SAME
          narrower width the math actually uses, so both are the same
          number by construction, not by accident of zoom level. */}
      <input
        type="range"
        min={0}
        max={100}
        value={sliderValue}
        onChange={(e) => { setSliderValue(Number(e.target.value)); setTouched(true); }}
        onPointerDown={() => {
          dragStartRef.current = { value: sliderValue, wasTouched: touched };
          setTouched(true);
        }}
        onPointerUp={() => {
          const { value, wasTouched } = dragStartRef.current;
          // No movement happened (onChange never fired to change the
          // value) AND it was already visible before this click — that's
          // a plain second click, so turn it back off. Any actual drag
          // (value changed) skips this and stays on.
          if (sliderValue === value && wasTouched) setTouched(false);
        }}
        className="absolute appearance-none bg-transparent cursor-grab active:cursor-grabbing z-30 pointer-events-auto trial-fork-slider"
        style={{ left: `${trackLeft}%`, width: `${pct(new Date(maxDragMs), range) - trackLeft}%`, top: `${BAR_CENTER_Y - HANDLE_ROW_H / 2}px`, height: `${HANDLE_ROW_H}px` }}
      />
    </div>
  );
};

// Paid-subscription upgrade/downgrade projection — the "what-if" layer for
// an org already on a real paid plan (the trial's own fork above is a
// SEPARATE component/concept; this one attaches only to the current tier's
// row). Renders as light/faded SOLID bars, never dashed — dashed is
// reserved for a genuinely SCHEDULED change (a real ScheduledChange
// document), faded-solid means "hypothetical, nothing committed, moving
// the slider changes nothing real." Never written into paidPlanSegments/
// tierGroups — these must never appear in the Billing Journey strip or be
// mistaken for real history.
//
// Upgrade moves with the slider (immediate + prorated, backend-verified
// contract — see verifyUpgradePreviewContract.js): the amount and target
// renewal date come from previewPlanUpgrade(), never computed here.
// Downgrade NEVER moves — it's always scheduled for the current renewal
// regardless of slider position, which is real billing behavior the visual
// should teach, not hide.
const PlanChangeProjection = ({
  range, currentEnd, upgrade, downgrade,
  sliderValue, sliderMin, sliderMax, onSliderChange, onPreview,
}) => {
  // Same click-to-reveal / click-again-to-hide pattern as the trial fork's
  // own handle, applied here too — "just like the trial projections, that
  // was perfect." A drag (value actually changes) always leaves it ON; only
  // a genuine no-movement click toggles it off, mirroring
  // TrialConversionFork's dragStartRef technique exactly. Both branches
  // (upgrade AND downgrade) reveal/hide together — one shared handle, one
  // shared toggle, not two independent ones.
  const [touched, setTouched] = useState(false);
  const dragStartRef = useRef({ value: 0, wasTouched: false });

  // Feeds the selected date up to the SHARED axis preview row (the same
  // mechanism TrialConversionFork's own onPreview drives) — "dates should
  // be on top... just like we did for trial projections." Not a second,
  // locally-rendered date label; one date display, one place, same as the
  // trial fork already established.
  useEffect(() => {
    if (!onPreview) return;
    onPreview(touched ? sliderValue.getTime() : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [touched, sliderValue]);

  if (!upgrade && !downgrade) return null;

  const BAR_CENTER_Y = 32; // vertical center of the row's own h-16 (64px) box
  const HANDLE_ROW_H = 22;

  const sliderLeftPct = pct(sliderMin, range);
  const sliderRightPct = pct(sliderMax, range);
  const trackWidthPct = sliderRightPct != null && sliderLeftPct != null ? sliderRightPct - sliderLeftPct : 0;

  // Growth's own real segment renders its label ABOVE its bar (Segment's
  // `bottom-full mb-2.5`, ~text-sm line height + margin ≈ 30px of space
  // above the bar's own top edge). Found live: the upgrade projection's
  // label used PROJECTION_OFFSET_Y=40 measured from the bar's CENTER, which
  // put it almost exactly where the real segment's own label already sits —
  // the two texts printed on top of each other, and the faded bar read as
  // sitting ON the real bar rather than clearly above it. Fixed two ways:
  // (1) the upgrade block's order is bar-then-label (label BELOW its own
  // bar, same as downgrade already does) so the two labels don't compete
  // for the same "above the bar" real estate at all; (2) pushed well
  // clear of the real label's ~-25px to +15px zone.
  const UPGRADE_BAR_TOP = BAR_CENTER_Y - 58; // bar sits here; its own label renders ~18px below that (still just clear of growth's real label's -25px zone) — the row's own `pt-5` wrapper (20px) may not fully contain this if this happens to be the TOPMOST tier row; worth a live check, same as this file's other estimated-not-measured constants.
  const DOWNGRADE_BAR_TOP = BAR_CENTER_Y + 44;

  const handlePct = pct(sliderValue, range);

  return (
    <>
      {/* Dotted drag rail — same affordance as the trial fork's own
          dragRailLeft/dragRailWidth (Track component), spanning the
          slider's full draggable range so it's visually obvious there's
          something to slide, even before the first click reveals the
          projection bars themselves. */}
      {sliderLeftPct != null && (
        <div
          className="absolute h-0 border-t-2 border-dotted border-gray-300 pointer-events-none"
          style={{ left: `${sliderLeftPct}%`, width: `${trackWidthPct}%`, top: `${BAR_CENTER_Y}px` }}
        />
      )}

      {/* A short dotted connector from the slider handle up/down to each
          revealed branch — same idea as the trial fork's diagonal kink,
          simplified to a plain vertical line since these branches don't
          fan out sideways the way the trial's Monthly/Annual ones do.
          Colored to the TARGET branch (not neutral gray) — a projection
          connector must never look like the real historical tier-ladder
          connectors, which stay gray on purpose (see BillingCalendarTimeline's
          own `connectors`, and PLAN_TIER_BORDER_COLOR's own comment). */}
      {touched && upgrade && handlePct != null && (
        <div
          className={`absolute w-0 border-l-2 border-dotted opacity-60 ${PLAN_TIER_BORDER_COLOR[(upgrade.targetPlanName || '').toLowerCase()] || PLAN_TIER_BORDER_COLOR.default} pointer-events-none`}
          style={{ left: `${handlePct}%`, top: `${UPGRADE_BAR_TOP + 14}px`, height: `${BAR_CENTER_Y - 7 - (UPGRADE_BAR_TOP + 14)}px` }}
        />
      )}
      {/* Downgrade's connector deliberately starts at the SLIDER handle
          (not straight down from the fixed renewal point) and bends over
          to the renewal date — the bend is the point: wherever the handle
          moves, this line's horizontal run stretches or shrinks, but it
          always lands at the SAME fixed x (renewal). That's the visual
          teaching moment for "downgrade never moves, no matter when you
          say you'd make it." */}
      {touched && downgrade && handlePct != null && (() => {
        const renewalPct = pct(currentEnd, range);
        if (renewalPct == null) return null;
        const waypointY = BAR_CENTER_Y + 20;
        const left = Math.min(handlePct, renewalPct);
        const width = Math.abs(renewalPct - handlePct);
        const downgradeBorder = PLAN_TIER_BORDER_COLOR[(downgrade.targetPlanName || '').toLowerCase()] || PLAN_TIER_BORDER_COLOR.default;
        return (
          <React.Fragment>
            <div
              className={`absolute w-0 border-l-2 border-dotted opacity-60 ${downgradeBorder} pointer-events-none`}
              style={{ left: `${handlePct}%`, top: `${BAR_CENTER_Y + 7}px`, height: `${waypointY - (BAR_CENTER_Y + 7)}px` }}
            />
            <div
              className={`absolute h-0 border-t-2 border-dotted opacity-60 ${downgradeBorder} pointer-events-none`}
              style={{ left: `${left}%`, width: `${width}%`, top: `${waypointY}px` }}
            />
            <div
              className={`absolute w-0 border-l-2 border-dotted opacity-60 ${downgradeBorder} pointer-events-none`}
              style={{ left: `${renewalPct}%`, top: `${waypointY}px`, height: `${DOWNGRADE_BAR_TOP - waypointY}px` }}
            />
          </React.Fragment>
        );
      })()}

      {touched && upgrade && (
        <div
          className="absolute flex flex-col items-start"
          style={{
            left: `${pct(sliderValue, range)}%`,
            width: `${Math.max(0, (pct(upgrade.newRenewalDate, range) ?? 0) - (pct(sliderValue, range) ?? 0))}%`,
            top: `${UPGRADE_BAR_TOP}px`,
          }}
        >
          <div className={`h-3.5 w-full rounded-full ${PLAN_TIER_COLOR[(upgrade.targetPlanName || '').toLowerCase()] || PLAN_TIER_COLOR.default} opacity-25`} />
          <div className="text-[11px] font-semibold text-gray-500 mt-1 truncate whitespace-nowrap">
            <span className="uppercase tracking-wide text-[9px] font-bold text-gray-400 mr-1">Preview</span>
            {upgrade.targetPlanName} · {upgrade.loading ? 'Calculating…' : `₹${upgrade.dueToday} now`}
          </div>
        </div>
      )}

      {touched && downgrade && (
        <div
          className="absolute flex flex-col items-start"
          style={{
            left: `${pct(currentEnd, range)}%`,
            width: `${Math.max(0, (pct(downgrade.visualEnd, range) ?? 0) - (pct(currentEnd, range) ?? 0))}%`,
            top: `${DOWNGRADE_BAR_TOP}px`,
          }}
        >
          <div className={`h-3.5 w-full rounded-full ${PLAN_TIER_COLOR[(downgrade.targetPlanName || '').toLowerCase()] || PLAN_TIER_COLOR.default} opacity-25`} />
          <div className="text-[11px] font-semibold text-gray-500 mt-1 truncate whitespace-nowrap">
            <span className="uppercase tracking-wide text-[9px] font-bold text-gray-400 mr-1">Preview</span>
            If downgraded: {downgrade.targetPlanName} · starts at renewal
          </div>
        </div>
      )}

      {!touched && handlePct != null && (
        <span
          className="absolute -translate-x-1/2 text-[10px] font-semibold text-gray-400 whitespace-nowrap"
          style={{ left: `${handlePct}%`, top: `${BAR_CENTER_Y + 14}px` }}
        >
          drag to preview upgrade/downgrade
        </span>
      )}


      {/* One shared slider — "when would you make this change?" — controls
          ONLY the upgrade branch's position (downgrade is date-invariant by
          design), but toggles BOTH branches' visibility together. Same
          invisible-range-input-over-the-bar technique as the trial fork's
          own handle, including its click-vs-drag distinction. */}
      {sliderLeftPct != null && (
        <input
          type="range"
          min={sliderMin.getTime()}
          max={sliderMax.getTime()}
          step={60 * 60 * 1000}
          value={sliderValue.getTime()}
          onChange={(e) => { onSliderChange(new Date(Number(e.target.value))); setTouched(true); }}
          onPointerDown={() => {
            dragStartRef.current = { value: sliderValue.getTime(), wasTouched: touched };
            setTouched(true);
          }}
          onPointerUp={() => {
            const { value, wasTouched } = dragStartRef.current;
            if (sliderValue.getTime() === value && wasTouched) setTouched(false);
          }}
          className="absolute appearance-none bg-transparent cursor-grab active:cursor-grabbing z-30 plan-change-slider"
          style={{ left: `${sliderLeftPct}%`, width: `${trackWidthPct}%`, top: `${BAR_CENTER_Y - HANDLE_ROW_H / 2}px`, height: `${HANDLE_ROW_H}px` }}
        />
      )}
    </>
  );
};

// A single continuous track — one lane per billing object.
const Track = ({ title, segments, markers, range, isBase, onSelectEvent, trialConversion, planChangeProjection }) => {
  const allMarkers = useMemo(() => markers || [], [markers]);
  // Admin trial adjustments now flow through the SAME clusterMarkers
  // pipeline as every other event (see the note above AdjustmentOverlay's
  // old spot) — no more separate box-rendering path.
  const clusters = useMemo(() => clusterMarkers(allMarkers), [allMarkers]);
  // Net shading: first adjustment's previousEnd vs last adjustment's
  // newEnd — see NetTrialAdjustment's own comment for why this is one
  // computed span instead of one box per event.
  const netAdjustment = useMemo(() => {
    const events = allMarkers
      .filter(isAdminTrialAdjustment)
      .filter((m) => m.metadata?.previousEnd && m.metadata?.newEnd)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    if (events.length === 0) return null;
    return { originalEnd: events[0].metadata.previousEnd, currentEnd: events[events.length - 1].metadata.newEnd };
  }, [allMarkers]);

  // A faint dotted rail spanning the projection handle's full draggable
  // range — today → the full visible chart edge, matching whatever zoom
  // the user picked (not a separate, shorter cap of its own — see the
  // note on maxDragMs inside TrialConversionFork for why that used to
  // stop the rail dead in the middle of the chart for no visible reason).
  // A plain visual affordance that this is something to slide, not just a
  // marker sitting on the bar. Rendered BEFORE Segment below (same
  // stacking context, default DOM-order painting) so it sits visibly
  // BEHIND the real trial bar and only shows in the empty space beyond it.
  let dragRailLeft = null;
  let dragRailWidth = null;
  if (trialConversion) {
    const dragTrackLeft = pct(trialConversion.now, range);
    const dragMaxPct = 100;
    if (dragTrackLeft != null && dragMaxPct > dragTrackLeft) {
      dragRailLeft = dragTrackLeft;
      dragRailWidth = dragMaxPct - dragTrackLeft;
    }
  }

  return (
    <div className={`relative ${trialConversion || planChangeProjection ? 'mb-40' : 'mb-16'}`}>
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[92px] text-right pr-5">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{title}</h3>
      </div>

      <div className="relative h-16 overflow-visible" style={{ marginLeft: LABEL_COL }}>
        {dragRailLeft != null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 h-0 border-t-2 border-dotted border-gray-300 pointer-events-none"
            style={{ left: `${dragRailLeft}%`, width: `${dragRailWidth}%` }}
          />
        )}
        {segments.map((seg, i) => (
          <Segment key={i} seg={seg} range={range} isBase={isBase} />
        ))}
        {netAdjustment && (
          <NetTrialAdjustment originalEnd={netAdjustment.originalEnd} currentEnd={netAdjustment.currentEnd} range={range} />
        )}
        {clusters.map((cluster, i) => (
          <MarkerCluster key={i} cluster={cluster} range={range} onSelect={onSelectEvent} />
        ))}
        {/* The fork renders inside the SAME positioned box as the bar (not
            a sibling below it) so its handle can share the bar's exact
            vertical center — that shared coordinate is what makes the
            branches look like they grow out of the bar instead of floating
            near it. It overflows below via negative margin + overflow
            visible; nothing here changes the bar's own markup or colors. */}
        {trialConversion && (
          <TrialConversionFork range={range} now={trialConversion.now} onPreview={trialConversion.onPreview} />
        )}
        {/* Same "same positioned box, overflow visible" technique as the
            trial fork above, for the CURRENT paid tier's row only. */}
        {planChangeProjection && <PlanChangeProjection range={range} {...planChangeProjection} />}
      </div>
    </div>
  );
};

const BillingCalendarTimeline = ({ now, range, trialSegments, trialMarkers, paidPlanSegments, paidPlanMarkers, addonLanes, onSelectEvent, trialEndsAt, planChange }) => {
  const spanDays = (range.end.getTime() - range.start.getTime()) / (24 * 60 * 60 * 1000);
  const isMonthly = spanDays > 45;
  // At 1Y+ zoom the key-date text (TODAY / TRIAL ENDS · date / the preview
  // date) has nowhere near enough horizontal room and reads as a smear of
  // overlapping bold text (found live: "everything looks smooshed
  // together"). Past this width, keep only the dashed guideline lines —
  // still exact, still connected to the bar — and drop the text labels
  // that were fighting each other for the same few pixels. The static
  // month ticks below (SEPT 2026, OCT 2026…) already carry enough context
  // once the view is this zoomed out.
  const crowded = spanDays > 300;
  const ticks = isMonthly ? monthTicks(range) : dayTicks(range);
  const todayPct = pct(now, range);
  const trialEndPct = trialEndsAt ? pct(trialEndsAt, range) : null;
  // Reported up from the fork's own drag state (see TrialConversionFork's
  // onPreview) — the axis has no other way to know what date is currently
  // being previewed, since that state lives inside the Plan track's fork.
  const [previewMs, setPreviewMs] = useState(null);

  // The previewed date and Today/Trial-ends are DIFFERENT tiers, not one —
  // when the dragged preview lands on the same day as Today or Trial ends
  // (a very common case, since dragging usually starts right there), a
  // single shared row mashed their text together into one unreadable
  // string. Preview always renders in its own row ABOVE Today/Trial ends,
  // regardless of where it horizontally lands, so the two can never
  // collide — this is a fixed row assignment, not a collision check.
  const staticKeyDates = [
    { id: 'today', pct: todayPct, label: 'Today', colorClass: 'text-blue-600' },
    trialEndPct != null ? { id: 'trial-end', pct: trialEndPct, label: `Trial ends · ${new Date(trialEndsAt).toLocaleDateString("en-IN", { day: 'numeric', month: 'short' })}`, colorClass: 'text-amber-600' } : null,
  ].filter((d) => d && d.pct != null);
  const previewLabel = previewMs != null
    ? { pct: pct(new Date(previewMs), range), label: new Date(previewMs).toLocaleDateString("en-IN", { day: 'numeric', month: 'short' }) }
    : null;

  // Real bug found by measuring actual rendered rects (not guessed): this
  // outer chart div has "pr-16" (64px right padding) on it, but percentage
  // `left` for an absolutely-positioned child resolves against the padding
  // box (the FULL width including that padding), while every other element
  // on this chart (ticks, the bar, markers) sits inside a normal-flow div
  // whose own width:auto is the CONTENT box (full width minus that same
  // 64px). Using plain "100%" for the guideline's calc() silently used the
  // wrong, larger width — verified live: a guideline computed at x=483px
  // sat 35px right of the marker it was supposed to point at (x=448px),
  // and the gap grew/shrank with the pr-16 constant exactly. Fixing it
  // means subtracting that same 64px here too, so the guideline's percentage
  // basis matches the bar's percentage basis exactly.
  const AXIS_RIGHT_PAD_PX = 64; // must match the chart container's pr-16
  const guidelineX = (p) => `calc(${LABEL_COL} + (100% - ${LABEL_COL} - ${AXIS_RIGHT_PAD_PX}px) * ${p / 100})`;

  // Guidelines no longer start at the very top of the axis block (that ran
  // them behind/above their own label's row, and behind an unrelated row
  // above it) — each starts right below the row its OWN label lives in.
  // The bottom target (bar center) doesn't move, so height = that fixed
  // point minus wherever this particular line starts.
  // When crowded, the two text rows above don't render at all — the whole
  // axis block is shorter by exactly their flow height (16px row + 22px
  // row w/ margin = 38px), so the bar's own vertical position shifts up by
  // that same amount. The guideline's bottom target has to shift with it,
  // or it overshoots past the bar by the same 38px it saved at the top.
  const BAR_CENTER_ABS_Y = crowded ? 136 : 174; // measured directly via getBoundingClientRect in a live harness — axis block top → Plan bar's vertical center
  // When crowded, there's no text row above to clear — lines can start
  // right at the top of the axis block instead of below a row that no
  // longer renders.
  const PREVIEW_LINE_TOP = crowded ? 4 : 20; // just under the preview row (h-4)
  const KEY_LINE_TOP = crowded ? 4 : 44; // just under the Today/Trial-ends row

  // One row per plan tier (Business top, Starter bottom) plus the trial's
  // own row below all of them — see the tier-ladder comment at the render
  // site for why. Computed here (not inside the JSX) since the trial->paid
  // connector below needs the same row geometry.
  const tierGroups = useMemo(() => groupPaidSegmentsByTier(paidPlanSegments), [paidPlanSegments]);

  const ROW_HEIGHT_PX = 128; // Track's own h-16 (64px) + mb-16 (64px) — see the render-site comment
  const TALL_ROW_HEIGHT_PX = 224; // h-16 (64px) + mb-40 (160px) — Track uses this taller margin whenever trialConversion OR planChangeProjection is attached (see Track's own className)
  const ROWS_TOP_PAD_PX = 20; // the wrapping div's own pt-5
  // Found live: the tier connector lines (e.g. Starter -> Trial) silently
  // vanished the moment a plan-change projection was added to the current
  // tier's row — that row got Track's taller `mb-40` margin (same CSS branch
  // trialConversion already used), but this array still assumed every tier
  // row was the plain 128px height, so every row's computed Y BELOW the
  // current tier came out wrong by the missing 96px, pushing those
  // connectors to nonsensical positions. Must mirror Track's own
  // `trialConversion || planChangeProjection ? 'mb-40' : 'mb-16'` exactly.
  const rowHeights = [
    ...tierGroups.map((g) => (planChange && g.planName === planChange.currentPlanName ? TALL_ROW_HEIGHT_PX : ROW_HEIGHT_PX)),
    ...(trialSegments.length > 0 ? [trialEndsAt ? TALL_ROW_HEIGHT_PX : ROW_HEIGHT_PX] : []),
  ];
  const rowCenterY = (rowIndex) => {
    let top = ROWS_TOP_PAD_PX;
    for (let i = 0; i < rowIndex; i++) top += rowHeights[i];
    return top + 32; // the bar sits at the vertical center of its own 64px (h-16) box
  };

  const markerBelongsToSegments = (marker, segments) => {
    const t = new Date(marker.date).getTime();
    return segments.some((s) => {
      const start = new Date(s.start).getTime();
      const end = s.end ? new Date(s.end).getTime() : Infinity;
      return t >= start && t <= end;
    });
  };

  const prettyTierName = (planName) => (planName ? planName.charAt(0).toUpperCase() + planName.slice(1) : planName);

  // Every real transition gets a connector — not just trial->first-paid-
  // tier. Found live: an org that went trial -> Starter -> upgraded to
  // Growth only had a connector drawn for the FIRST hop; the Starter ->
  // Growth upgrade (a different pair of rows) had no line at all, even
  // though it's exactly the same kind of "I was here, then moved" moment.
  // Built by flattening every row's own segments back into one
  // chronological list (tagged with which physical row each one lives on),
  // then connecting each pair of immediately-adjacent segments whose rows
  // differ — this naturally covers trial->tier, tier->tier (up OR down),
  // and generalizes to any future tier without special-casing which pair
  // it is.
  const connectors = useMemo(() => {
    const flat = [];
    tierGroups.forEach((g, rowIndex) => {
      g.segments.forEach((seg) => flat.push({ ...seg, rowIndex }));
    });
    const trialRowIndex = tierGroups.length; // trial is always the row right after every tier row
    trialSegments.forEach((seg) => flat.push({ ...seg, rowIndex: trialRowIndex }));
    flat.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    const list = [];
    for (let i = 0; i < flat.length - 1; i++) {
      const cur = flat[i];
      const next = flat[i + 1];
      if (!cur.end || cur.rowIndex === next.rowIndex) continue;
      // Only a genuine back-to-back transition (this segment's own end IS
      // the next one's start) earns a line — not any two segments that
      // merely happen to be adjacent once sorted.
      if (Math.abs(new Date(cur.end).getTime() - new Date(next.start).getTime()) > 60 * 1000) continue;
      const p = pct(cur.end, range);
      if (p == null) continue;
      list.push({ pct: p, topY: rowCenterY(Math.min(cur.rowIndex, next.rowIndex)), bottomY: rowCenterY(Math.max(cur.rowIndex, next.rowIndex)) });
    }
    return list;
  }, [trialSegments, tierGroups, range]);

  return (
    <div className="overflow-x-auto w-full">
      <div style={{ minWidth: chartWidth(ticks.length, isMonthly), position: "relative" }} className="pt-2 pb-4 pr-16">

        {/* Four separate vertical LEVELS, never sharing a y-position:
            (1) the live drag preview, its own row, always on top.
            (2) Today / Trial ends, one row below that.
            (3) the plain grey calendar ticks below that, unchanged weight.
            (4) the Plan track's own bar, further down — where all three
            dashed guidelines above terminate, so each date visibly points
            at the exact spot on the bar it describes. Nothing floats near
            the bar anymore (no duplicate caption, no extra dot) — the
            guideline IS the connection. Extra pr-16 above (and here) gives
            the rightmost tick room to render fully — it sits at left:100%
            with -translate-x-1/2 centering, so without trailing space its
            right half was clipped by the scroll container's edge (found
            live on the 6M/1Y views). */}
        {!crowded && (
          <>
            <div className="relative h-4" style={{ marginLeft: LABEL_COL }}>
              {previewLabel && (
                <div className="absolute top-0 -translate-x-1/2 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap text-purple-600" style={{ left: `${previewLabel.pct}%` }}>
                  {previewLabel.label}
                </div>
              )}
            </div>

            <div className="relative h-4 mt-1.5" style={{ marginLeft: LABEL_COL }}>
              {staticKeyDates.map((d) => (
                <div key={d.id} className={`absolute top-0 -translate-x-1/2 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap ${d.colorClass}`} style={{ left: `${d.pct}%` }}>
                  {d.label}
                </div>
              ))}
            </div>
          </>
        )}

        <div className="relative h-9 border-b border-gray-200 mb-16 mt-2" style={{ marginLeft: LABEL_COL }}>
          {ticks.map((t, i) => (
            <div key={i} className="absolute bottom-2 flex flex-col items-center -translate-x-1/2" style={{ left: `${pct(t.date, range)}%` }}>
              <div className="text-xs font-semibold text-gray-500 tracking-wide">
                {t.label}
              </div>
              <div className="w-px h-2 bg-gray-300 mt-1" />
            </div>
          ))}
        </div>

        {/* Guidelines — each dashed line runs from its date label at the
            top all the way down to the Plan track's bar, so the label and
            the point on the bar it refers to are visibly the same thing,
            not two separate pieces of UI a reader has to mentally connect. */}
        {todayPct != null && (
          <div
            className="absolute border-l-[1.5px] border-dashed border-blue-300 pointer-events-none z-0"
            style={{ left: guidelineX(todayPct), top: `${KEY_LINE_TOP}px`, height: `${BAR_CENTER_ABS_Y - KEY_LINE_TOP}px` }}
          />
        )}
        {trialEndPct != null && (
          <div
            className="absolute border-l-[1.5px] border-dashed border-amber-300 pointer-events-none z-0"
            style={{ left: guidelineX(trialEndPct), top: `${KEY_LINE_TOP}px`, height: `${BAR_CENTER_ABS_Y - KEY_LINE_TOP}px` }}
          />
        )}
        {previewLabel && (
          <div
            className="absolute border-l-[1.5px] border-dashed border-purple-300 pointer-events-none z-0"
            style={{ left: guidelineX(previewLabel.pct), top: `${PREVIEW_LINE_TOP}px`, height: `${BAR_CENTER_ABS_Y - PREVIEW_LINE_TOP}px` }}
          />
        )}

        <div className="relative z-10 pt-5">
          {/* Paid subscription — split into one row PER PLAN TIER the org
              has ever been on, Business highest/top down to Starter lowest
              (groupPaidSegmentsByTier), rendered ABOVE the trial's
              historical row below. Found necessary live: a single shared
              row put every tier end-to-end on one flat line with no visual
              sense of "that was an upgrade" vs "that was a downgrade" —
              real vertical LEVELS make a tier change a real jump between
              rows, not just a color change on the same line. Never shares
              a track with the trial (see billingCalendarSegments.js's own
              comment on why a shared track produced overlapping trial/paid
              segments in the first place).
              ROW_HEIGHT_PX below MUST match this Track's own CSS (h-16 =
              64px bar box + mb-16 = 64px gap = 128px per row; the trial
              row is taller — mb-40 = 160px — only while its drag-to-explore
              fork is attached) — needed to compute the connector line's
              pixel geometry purely in JS, since sibling Tracks don't share
              a ref to measure each other's real rendered position. Estimated
              from the same CSS constants the rows themselves use, not
              independently guessed — but still worth a live visual check
              after this lands, same caveat as this file's other
              hand-computed pixel constants (BAR_CENTER_ABS_Y etc.). */}
          {tierGroups.map((group) => (
            <Track
              key={group.planName}
              title={prettyTierName(group.planName)}
              segments={group.segments}
              markers={paidPlanMarkers.filter((m) => markerBelongsToSegments(m, group.segments))}
              range={range}
              isBase={true}
              onSelectEvent={onSelectEvent}
              // Upgrade/downgrade projections only ever attach to the CURRENT
              // tier's own row (planChange.currentPlanName) — never a
              // historical tier's row, since you can only branch a
              // what-if from where you actually are today.
              planChangeProjection={planChange && group.planName === planChange.currentPlanName ? { ...planChange, onPreview: setPreviewMs } : null}
            />
          ))}

          {/* Trial — historical foundation. Always rendered if it ever
              existed, never replaced or deleted once a paid plan exists;
              the drag-to-explore Monthly/Annual fork only attaches here,
              and only while the trial is still actually active (trialEndsAt
              is null once converted or genuinely lapsed). */}
          {trialSegments.length > 0 && (
            <Track
              title={tierGroups.length > 0 ? "Trial (history)" : "Plan"}
              segments={trialSegments}
              markers={trialMarkers}
              range={range}
              isBase={true}
              onSelectEvent={onSelectEvent}
              trialConversion={trialEndsAt ? { now, trialEnd: trialEndsAt, onPreview: setPreviewMs } : null}
            />
          )}

          {/* Trial -> paid connector — a dashed line from the exact moment
              the trial ended (trialSegments[0].end, which
              buildTrialTrackSegments sets to the real conversion date when
              that's what happened) up to whichever tier row the org
              actually converted INTO, so the two rows read as one
              continuous story ("I was here, then I moved up/down to
              here") instead of two unrelated bars that happen to share a
              modal. */}
          {connectors.map((c, i) => (
            <React.Fragment key={i}>
              <div
                className="absolute border-l-[1.5px] border-dashed border-gray-300 pointer-events-none z-0"
                style={{ left: guidelineX(c.pct), top: `${c.topY}px`, height: `${c.bottomY - c.topY}px` }}
              />
              <div
                className="absolute w-1.5 h-1.5 rounded-full bg-gray-400 pointer-events-none z-10 -translate-x-1/2 -translate-y-1/2"
                style={{ left: guidelineX(c.pct), top: `${c.topY}px` }}
              />
            </React.Fragment>
          ))}

          {addonLanes.map((lane) => (
            <Track
              key={lane.key}
              title={lane.name}
              segments={lane.segments.map(s => ({...s, planName: lane.name, billingCycle: lane.cycle}))}
              markers={lane.scheduled ? [{ date: lane.scheduled.effectiveAt, title: `${lane.name} changes`, tone: 'scheduled' }] : []}
              range={range}
              isBase={false}
              onSelectEvent={onSelectEvent}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default BillingCalendarTimeline;
