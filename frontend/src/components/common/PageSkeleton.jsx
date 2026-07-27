import Skeleton from "./Skeleton";
import DealCardSkeleton from "./DealCardSkeleton";

// Structured loading placeholders, shown instead of a spinner while a page's
// data is still loading. `variant` picks a layout that roughly matches what
// the real page will look like, so the transition from loading -> loaded
// doesn't cause a jarring layout shift. Built entirely from the shared
// <Skeleton /> primitive — no raw animate-pulse divs here.
const Card = ({ h = 90 }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4" style={{ height: h }}>
    <Skeleton width="40%" height={12} className="mb-3" />
    <Skeleton width="60%" height={20} />
  </div>
);

const TableSkeleton = ({ rows = 10, cols = 6 }) => (
  <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
    <div className="flex items-center gap-6 border-b border-gray-200 bg-gray-50 px-4 py-3">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} width={80 + (i % 3) * 20} height={10} />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="flex items-center gap-6 border-b border-gray-100 px-4 py-3 last:border-b-0">
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton key={c} width={60 + ((r + c) % 4) * 25} height={12} />
        ))}
      </div>
    ))}
  </div>
);

// Matches the real Deals page top-to-bottom: title strip, KPI strip, search
// strip, then the kanban board itself (column header + total bar + cards).
const KanbanSkeleton = ({ columns = 3, cards = 3 }) => (
  <div className="space-y-0 -m-6">
    {/* Title strip: "Deals" + subtitle, more-menu + New Deal button */}
    <div className="flex items-center justify-between gap-3 bg-white border-b border-gray-200 px-6" style={{ height: 64 }}>
      <div className="flex flex-col gap-1.5">
        <Skeleton width={50} height={16} />
        <Skeleton width={160} height={12} />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton shape="circle" width={40} height={40} />
        <Skeleton width={110} height={40} shape="rect" className="rounded-full" />
      </div>
    </div>

    {/* KPI strip: 4 stat cards */}
    <div className="flex items-center gap-6 bg-white border-b border-gray-200 px-6" style={{ height: 120 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="relative flex-1 rounded-xl border border-gray-200 bg-white" style={{ padding: 16, height: 72 }}>
          <div className="flex items-end gap-3.5" style={{ height: 40 }}>
            <Skeleton shape="circle" width={40} height={40} className="flex-shrink-0" />
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <Skeleton width="60%" height={10} />
              <Skeleton width="45%" height={16} />
            </div>
          </div>
          <div className="absolute flex items-center gap-1" style={{ right: 16, bottom: 16 }}>
            <Skeleton width={40} height={11} />
          </div>
        </div>
      ))}
    </div>

    {/* Search + filter/view-toggle strip */}
    <div className="flex items-center justify-between gap-3 bg-white px-6 py-3">
      <Skeleton width="100%" height={40} shape="rect" className="rounded-full" />
      <div className="flex items-center gap-3 flex-shrink-0 ml-3">
        <Skeleton shape="circle" width={40} height={40} />
        <Skeleton width={72} height={32} shape="rect" className="rounded-full" />
      </div>
    </div>

    {/* Kanban board */}
    <div className="flex gap-4 px-6 pt-6 pb-6 overflow-x-auto">
      {Array.from({ length: columns }).map((_, c) => (
        <div key={c} className="w-[340px] flex-shrink-0 rounded-xl border border-gray-200 bg-white overflow-hidden">
          {/* Column header: title + count badge + plus icon */}
          <div className="flex items-center justify-between px-4" style={{ height: 46, background: "#F5F7FA" }}>
            <div className="flex items-center gap-1.5">
              <Skeleton width={60} height={12} />
              <Skeleton shape="circle" width={22} height={22} />
            </div>
            <Skeleton shape="circle" width={16} height={16} />
          </div>
          {/* Total bar (plain gray, no gradient) */}
          <div className="px-5 pt-5">
            <Skeleton width="100%" height={67} shape="rect" className="rounded-[10px]" />
          </div>
          {/* Deal cards */}
          <div className="flex flex-col items-start gap-3.5 px-5 py-5">
            {Array.from({ length: cards }).map((_, i) => (
              <DealCardSkeleton key={i} />
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

const CardsSkeleton = ({ count = 6 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <Card key={i} />
    ))}
  </div>
);

const ProfileSkeleton = () => (
  <div className="space-y-4">
    <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5">
      <Skeleton shape="circle" width={56} height={56} className="flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton width="30%" height={16} />
        <Skeleton width="45%" height={12} />
      </div>
    </div>
    <div className="flex gap-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} width={90} height={30} className="rounded-full" />
      ))}
    </div>
    <CardsSkeleton count={3} />
    <TableSkeleton rows={5} cols={4} />
  </div>
);

const GenericSkeleton = () => (
  <div className="space-y-4">
    <Skeleton width="25%" height={22} />
    <Skeleton width="60%" height={12} />
    <CardsSkeleton count={4} />
  </div>
);

const VARIANTS = {
  table: TableSkeleton,
  kanban: KanbanSkeleton,
  cards: CardsSkeleton,
  profile: ProfileSkeleton,
  generic: GenericSkeleton,
};

/**
 * Full-page structured loading placeholder. Fills the same fixed content
 * band used by the app's real page bodies (top:64, left:sidebar, right:0,
 * bottom:0) so it sits in exactly the space the real content will occupy.
 */
export default function PageSkeleton({ variant = "generic", ...rest }) {
  const Body = VARIANTS[variant] || GenericSkeleton;
  return (
    <div
      className="fixed overflow-y-auto bg-gray-50 p-6 z-20"
      style={{ top: 64, left: "var(--sidebar-width, 0px)", right: 0, bottom: 0 }}
    >
      <Body {...rest} />
    </div>
  );
}

export { TableSkeleton, KanbanSkeleton, CardsSkeleton, ProfileSkeleton, GenericSkeleton };
