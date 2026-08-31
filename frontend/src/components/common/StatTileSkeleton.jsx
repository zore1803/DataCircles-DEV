import Skeleton from "./Skeleton";

/**
 * Loading counterpart to StatTile. Deliberately mirrors that component's
 * shell class-for-class - same 56px height, padding, gap, background and
 * border - and puts placeholders exactly where the icon, label, value and
 * trailing subtitle sit, so the row doesn't shift or resize when data lands.
 */
export default function StatTileSkeleton({ subtitle = false }) {
  return (
    <div className="h-[56px] w-full flex-1 flex items-center gap-2 px-3 bg-gray-50 border border-gray-200 rounded-xl min-w-0">
      <Skeleton shape="rounded" width={20} height={20} className="flex-shrink-0" />
      <div className="min-w-0 flex-1 flex items-end justify-between gap-2">
        {/* Label (11px) over value (14px), matching StatTile's text block. */}
        <div className="min-w-0 flex flex-col gap-1">
          <Skeleton width={64} height={9} />
          <Skeleton width={48} height={12} />
        </div>
        {/* Only where the loaded tile actually carries a trailing subtitle
            (the dashboard trend badges) - most company tiles have none. */}
        {subtitle && <Skeleton width={40} height={9} className="flex-shrink-0" />}
      </div>
    </div>
  );
}
