import Skeleton from "./Skeleton";

/**
 * Matches the 72px-tall icon+label+number stat tile used across the Deals
 * kanban KPI strip and company profile stat rows, so loading and loaded
 * states occupy identical space.
 */
export default function StatTileSkeleton() {
  return (
    <div className="h-[72px] flex items-center gap-2 px-3 bg-white border border-gray-200 rounded-xl">
      <Skeleton shape="rect" width={40} height={40} className="rounded-lg flex-shrink-0" />
      <div className="min-w-0 flex-1 flex flex-col gap-1.5">
        <Skeleton width="70%" height={10} />
        <Skeleton width="50%" height={14} />
      </div>
    </div>
  );
}
