import React, { useMemo } from "react";

const LABEL_COL = "100px";

function pct(date, range) {
  if (!date) return null;
  const t = new Date(date).getTime();
  const frac = (t - range.start.getTime()) / (range.end.getTime() - range.start.getTime());
  return Math.min(100, Math.max(0, frac * 100));
}

// Only month boundaries. No weekly ticks.
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

// Collapses markers occurring on the exact same day to prevent visual overlap
function clusterMarkers(markers) {
  const clusters = {};
  markers.forEach(m => {
    const d = new Date(m.date).toDateString();
    if (!clusters[d]) clusters[d] = { date: m.date, events: [], tone: m.tone };
    clusters[d].events.push(m);
    // Upgrade tone to critical if any event is critical
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
        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-6">No active subscription</span>
        <span className="text-[10px] text-gray-400 mt-1">Choose a plan to continue</span>
      </div>
    );
  }

  const isScheduled = seg.tone === "scheduled";
  const isPast = seg.tone === "past";
  const isAnnual = isBase && seg.billingCycle === "yearly" && !isScheduled;
  const isTrial = seg.tone === "trial";

  const colorStr = isScheduled ? "border-amber-400" : (isPast ? "bg-gray-300" : "bg-indigo-600");
  const baseClass = `absolute top-1/2 -translate-y-1/2 h-2.5 rounded-full ${isScheduled ? `border-2 border-dashed ${colorStr}` : colorStr}`;

  return (
    <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `${left}%`, width: `${width}%` }}>
      {/* Inline Label Above Segment */}
      <div className="absolute bottom-full mb-2 left-0 truncate pr-2 text-xs font-bold text-gray-700">
        {seg.planName} {seg.billingCycle && <span className="font-normal text-gray-500">· {seg.billingCycle === 'yearly' ? 'Annual' : 'Monthly'}</span>}
        {seg.quantity != null && <span className="font-normal text-gray-500">· ×{seg.quantity}</span>}
        {isScheduled && <span className="ml-2 text-[9px] font-black tracking-widest text-amber-600 uppercase">Scheduled</span>}
      </div>

      {isAnnual ? (
        <div className="absolute top-1/2 -translate-y-1/2 h-4 w-full bg-indigo-600 rounded-md shadow-sm overflow-hidden flex items-center px-2">
           <span className="text-[9px] font-black uppercase text-white tracking-widest truncate">Full Paid Term</span>
           {right >= 95 && <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-r from-transparent to-white/40" />}
        </div>
      ) : (
        <div className={`${baseClass} w-full`} />
      )}
    </div>
  );
};

const MarkerCluster = ({ cluster, range, onSelect }) => {
  const left = pct(cluster.date, range);
  if (left == null) return null;

  let markerClass = "bg-white border-gray-400 text-gray-600";
  if (cluster.tone === "critical") markerClass = "bg-white border-amber-500 text-amber-500";
  else if (cluster.tone === "scheduled") markerClass = "bg-white border-amber-400 text-amber-500";

  return (
    <div 
      className="absolute top-1/2 -translate-y-1/2 z-20 flex flex-col items-center group cursor-pointer"
      style={{ left: `${left}%`, marginLeft: "-6px" }}
      onClick={() => onSelect(cluster.events[0])} // For now, just pass the first event to inspector
    >
      <div className={`w-3 h-3 rounded-full border-[2.5px] transition-transform hover:scale-125 ${markerClass}`} />
      
      {/* The date and brief summary appear below the marker */}
      <div className="absolute top-full mt-2 flex flex-col items-center pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity">
        <span className="text-[10px] font-bold text-gray-900 whitespace-nowrap">
          {new Date(cluster.date).toLocaleDateString("en-IN", { day: 'numeric', month: 'short' }).toUpperCase()}
        </span>
        {cluster.events.length === 1 && (
          <span className="text-[9px] font-medium text-gray-500 whitespace-nowrap mt-0.5">
            {cluster.events[0].title || 'Transition'}
          </span>
        )}
        {cluster.events.length > 1 && (
          <span className="text-[9px] font-medium text-gray-500 whitespace-nowrap mt-0.5">
            {cluster.events.length} changes
          </span>
        )}
      </div>
    </div>
  );
};

// A Single Continuous Track
const Track = ({ title, segments, markers, range, isBase }) => {
  const clusters = useMemo(() => clusterMarkers(markers || []), [markers]);

  return (
    <div className="relative mb-16">
      {/* Track Label */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[80px] text-right pr-6">
        <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest">{title}</h3>
      </div>
      
      {/* Track Content */}
      <div className="relative h-16" style={{ marginLeft: LABEL_COL }}>
        {segments.map((seg, i) => (
          <Segment key={i} seg={seg} range={range} isBase={isBase} />
        ))}
        {clusters.map((cluster, i) => (
          <MarkerCluster key={i} cluster={cluster} range={range} />
        ))}
      </div>
    </div>
  );
};

const BillingCalendarTimeline = ({ now, range, basePlanSegments, basePlanMarkers, addonLanes, onSelectEvent }) => {
  const ticks = monthTicks(range);
  const todayPct = pct(now, range);

  return (
    <div className="overflow-x-auto w-full pb-16">
      <div style={{ minWidth: 900, position: "relative" }} className="py-4">
        
        {/* Date axis (Months only) */}
        <div className="relative h-10 border-b border-gray-100 mb-10" style={{ marginLeft: LABEL_COL }}>
          {ticks.map((t, i) => (
            <div key={i} className="absolute bottom-2 flex flex-col items-center -translate-x-1/2" style={{ left: `${pct(t.date, range)}%` }}>
              <div className="text-[10px] font-bold text-gray-400 tracking-widest">
                {t.label}
              </div>
              <div className="w-px h-1.5 bg-gray-200 mt-1" />
            </div>
          ))}
        </div>

        {/* TODAY line - faint structural line */}
        {todayPct != null && (
          <div
            className="absolute top-0 bottom-0 border-l border-blue-200 pointer-events-none z-0"
            style={{ left: `calc(${LABEL_COL} + (100% - ${LABEL_COL}) * ${todayPct / 100})` }}
          >
            <div className="absolute top-3 -translate-x-1/2 -translate-y-full text-[9px] font-black tracking-widest text-blue-500 uppercase">
              Today
            </div>
          </div>
        )}

        <div className="relative z-10 pt-4">
          
          {/* EXACTLY ONE PLAN TRACK */}
          <Track 
            title="Plan" 
            segments={basePlanSegments} 
            markers={basePlanMarkers} 
            range={range} 
            isBase={true} 
          />

          {/* EXACTLY ONE TRACK PER ADD-ON */}
          {addonLanes.map((lane) => (
            <Track 
              key={lane.key}
              title={lane.name} // Usually "Seat"
              segments={lane.segments.map(s => ({...s, planName: lane.name, billingCycle: lane.cycle}))}
              markers={lane.scheduled ? [{ date: lane.scheduled.effectiveAt, title: `${lane.name} changes`, tone: 'scheduled' }] : []}
              range={range}
              isBase={false}
            />
          ))}

        </div>
      </div>
    </div>
  );
};

export default BillingCalendarTimeline;
