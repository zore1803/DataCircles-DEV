import React, { useMemo, useState, useEffect, useRef } from "react";

const LABEL_COL = "104px";

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

  // Trial renders a shade lighter than a real paid segment (blue-500 vs the
  // app's blue-600 accent) — this leaves headroom for the adjustment-
  // extension overlay to read as "one step darker than the trial bar"
  // without turning near-navy the way blue-600 + a darker-still overlay did.
  const colorStr = isScheduled ? "border-amber-400" : (isPast ? "bg-gray-300" : (isTrial ? "bg-blue-500" : "bg-blue-600"));
  const baseClass = `absolute top-1/2 -translate-y-1/2 h-3.5 rounded-full ${isScheduled ? `border-[3px] border-dashed ${colorStr}` : `${colorStr} shadow-sm`}`;

  return (
    <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `${left}%`, width: `${width}%` }}>
      {/* Inline label above segment */}
      <div className="absolute bottom-full mb-2.5 left-0 truncate pr-2 text-sm font-semibold text-gray-800">
        {isTrial ? 'Free Trial' : seg.planName} {!isTrial && seg.billingCycle && <span className="font-normal text-gray-400">· {seg.billingCycle === 'yearly' ? 'Annual' : 'Monthly'}</span>}
        {seg.quantity != null && <span className="font-normal text-gray-400">· ×{seg.quantity}</span>}
        {isScheduled && <span className="ml-2 text-[11px] font-bold tracking-wide text-amber-600 uppercase">Scheduled</span>}
      </div>

      {isAnnual ? (
        <div className="absolute top-1/2 -translate-y-1/2 h-5 w-full bg-blue-600 rounded-full shadow-sm overflow-hidden flex items-center px-3">
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

// Mirrors backend/utils/renewalEngine.js's own addBillingCycle exactly —
// monthly is a CALENDAR month via setMonth(+1), not a flat 30 days, and
// annual is a calendar year via setFullYear(+1). The branch length on the
// chart needs to be the same policy the backend actually bills on, not an
// approximation invented on the frontend.
function addBillingCycle(date, cycle) {
  const next = new Date(date);
  if (cycle === 'monthly') next.setMonth(next.getMonth() + 1);
  else next.setFullYear(next.getFullYear() + 1);
  return next;
}

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

// A single continuous track — one lane per billing object.
const Track = ({ title, segments, markers, range, isBase, onSelectEvent, trialConversion }) => {
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
    <div className={`relative ${trialConversion ? 'mb-40' : 'mb-16'}`}>
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[92px] text-right pr-5">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{title}</h3>
      </div>

      <div className="relative h-16" style={{ marginLeft: LABEL_COL }}>
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
      </div>
    </div>
  );
};

const BillingCalendarTimeline = ({ now, range, basePlanSegments, basePlanMarkers, addonLanes, onSelectEvent, trialEndsAt }) => {
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
          <Track
            title="Plan"
            segments={basePlanSegments}
            markers={basePlanMarkers}
            range={range}
            isBase={true}
            onSelectEvent={onSelectEvent}
            trialConversion={trialEndsAt ? { now, trialEnd: trialEndsAt, onPreview: setPreviewMs } : null}
          />

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
