import Skeleton from "./Skeleton";

/**
 * Card-shaped skeleton matching the real deal card layout/dimensions
 * (300x132px): title bar + 3-dot placeholder, amount bar, divider, then a
 * footer row (icon square + company-name bar + circular avatar badge).
 * Shared between the in-place Deals kanban skeleton (ModernKanbanColumn)
 * and the page-level PageSkeleton "kanban" variant, so both stay in sync.
 */
export default function DealCardSkeleton() {
  return (
    <div
      style={{ width: "300px", height: "132px", boxSizing: "border-box" }}
      className="flex flex-col items-start bg-white border border-[#E5E5EC] rounded-[10px] p-4 gap-4"
    >
      <div className="flex flex-col items-start gap-2 w-full">
        <div className="flex items-center justify-between w-full">
          <Skeleton width="60%" height={14} />
          <Skeleton width={4} height={16} shape="rect" />
        </div>
        <Skeleton width="35%" height={14} />
      </div>

      <div className="w-full border-t border-[#F1F1F5]" />

      <div className="flex items-center gap-2 w-full">
        <Skeleton width={18} height={18} className="flex-shrink-0" style={{ borderRadius: 5 }} />
        <Skeleton width="50%" height={12} className="flex-1" />
        <Skeleton shape="circle" width={18} height={18} className="flex-shrink-0" />
      </div>
    </div>
  );
}
