import Skeleton from "./Skeleton";

/**
 * Card-shaped skeleton matching the real note card in
 * components/company/NoteSection.jsx (`NoteCard`): a 70px gradient header band,
 * then a 2-line title, a meta row (type + date), a 3-line preview, and a footer
 * row with the author avatar.
 *
 * The Notes tab defaults to Grid view, so this — not TableSkeletonRows — is what
 * the common path needs; showing table rows that then snap into a card grid is a
 * layout jump, which is the thing a skeleton exists to prevent.
 */
export default function NoteCardSkeleton() {
  return (
    <div
      className="bg-white flex flex-col items-start overflow-hidden w-full"
      style={{
        borderRadius: 12,
        border: "1px solid #F3F4F6",
        boxShadow: "0px 0px 6px rgba(0, 0, 0, 0.02), 0px 2px 4px rgba(0, 0, 0, 0.08)",
      }}
    >
      {/* Header band — same gradient as the real card, so the loaded state
          doesn't shift or change colour underneath the user. */}
      <div
        className="relative w-full flex-shrink-0"
        style={{
          height: 70,
          background: "linear-gradient(180deg, #C7E4FF 0%, #FFFFFF 100%)",
        }}
      />

      <div
        className="flex flex-col items-start w-full flex-1"
        style={{ padding: "10px 16px 16px" }}
      >
        <div className="flex flex-col items-start w-full" style={{ gap: 14 }}>
          <div className="flex flex-col items-start w-full" style={{ gap: 12 }}>
            {/* Title (line-clamp-2 in the real card) */}
            <div className="flex flex-col w-full" style={{ gap: 6 }}>
              <Skeleton width="85%" height={14} />
              <Skeleton width="55%" height={14} />
            </div>

            {/* Meta row: note type + created date */}
            <div className="flex items-center" style={{ gap: 12 }}>
              <Skeleton width={84} height={12} />
              <Skeleton width={72} height={12} />
            </div>
          </div>

          {/* Preview text (line-clamp-3) */}
          <div className="flex flex-col w-full" style={{ gap: 6 }}>
            <Skeleton width="100%" height={12} />
            <Skeleton width="95%" height={12} />
            <Skeleton width="60%" height={12} />
          </div>
        </div>

        {/* Footer: author avatar + name */}
        <div
          className="flex items-center justify-between w-full mt-auto"
          style={{ paddingTop: 20 }}
        >
          <div className="flex items-center" style={{ gap: 12 }}>
            <Skeleton shape="circle" width={24} height={24} className="flex-shrink-0" />
            <Skeleton width={90} height={12} />
          </div>
        </div>
      </div>
    </div>
  );
}
