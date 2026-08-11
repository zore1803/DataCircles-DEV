import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, Edit2, Trash2, MoreVertical } from "lucide-react";

// Multiply every ancestor `zoom` so fixed-position math done in visual px is
// corrected back into the layout px the portal actually paints in.
const getAncestorZoom = (el) => {
  let z = 1;
  let node = el;
  while (node && node.nodeType === 1) {
    const cz = parseFloat(getComputedStyle(node).zoom);
    if (cz && !Number.isNaN(cz)) z *= cz;
    node = node.parentElement;
  }
  return z || 1;
};

// Only one row menu should be open across the whole page at a time. Instead of
// lifting state into every table, each menu announces when it opens and the
// others close themselves.
const OPEN_EVENT = "dc-row-actions-open";

/**
 * Three-dot (⋮) row actions menu. Renders a kebab button that opens a small
 * portaled dropdown with Quick View / Edit / Delete. Any action whose handler
 * is omitted is hidden. Portaled to <body> so it never gets clipped by the
 * table's overflow container.
 */
export default function RowActionsMenu({
  onView,
  onEdit,
  onDelete,
  viewLabel = "Quick View",
  editLabel = "Edit",
  deleteLabel = "Delete",
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const idRef = useRef(Symbol("row-actions"));
  const menuRef = useRef(null);

  // Close this menu when another one opens.
  useEffect(() => {
    const handler = (e) => {
      if (e.detail !== idRef.current) {
        setOpen(false);
        setPos(null);
      }
    };
    window.addEventListener(OPEN_EVENT, handler);
    return () => window.removeEventListener(OPEN_EVENT, handler);
  }, []);

  // Close on scroll/resize so the menu never floats away from its row.
  useEffect(() => {
    if (!open) return;
    const close = () => {
      setOpen(false);
      setPos(null);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const items = [
    onView && { key: "view", label: viewLabel, icon: Eye, onClick: onView, danger: false },
    onEdit && { key: "edit", label: editLabel, icon: Edit2, onClick: onEdit, danger: false },
    onDelete && { key: "delete", label: deleteLabel, icon: Trash2, onClick: onDelete, danger: true, divider: true },
  ].filter(Boolean);

  const toggle = (e) => {
    e.stopPropagation();
    if (open) {
      setOpen(false);
      setPos(null);
      return;
    }

    const zMenu = getAncestorZoom(document.body);
    const MENU_W = 150;
    const MARGIN = 8;
    const ITEM_H = 34;
    const MENU_H = items.length * ITEM_H + 12 + (onDelete ? 5 : 0);

    const rect = e.currentTarget.getBoundingClientRect();
    const viewportH = window.innerHeight / zMenu;
    const viewportW = window.innerWidth / zMenu;

    // Anchor at the row's vertical centre, then clamp into the viewport, so the
    // menu never spills across the rows below the one that was clicked.
    const rowCenter = (rect.top + rect.bottom) / (2 * zMenu);
    let top = rowCenter - MENU_H / 2;
    top = Math.max(MARGIN, Math.min(top, viewportH - MENU_H - MARGIN));

    let left = rect.right / zMenu - MENU_W - 12;
    left = Math.min(left, viewportW - MENU_W - MARGIN);
    left = Math.max(left, MARGIN);

    setPos({ top, left });
    setOpen(true);
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: idRef.current }));
  };

  const runAction = (e, fn) => {
    e.stopPropagation();
    setOpen(false);
    setPos(null);
    fn?.();
  };

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={toggle}
        className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
        title="More actions"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && pos && createPortal(
        <>
          <div
            className="fixed inset-0 z-[9998]"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              setPos(null);
            }}
          />
          <div
            ref={menuRef}
            style={{ position: "fixed", top: pos.top, left: pos.left }}
            className="w-[150px] z-[9999] bg-white border border-[#E5E5EC] rounded-lg shadow-[7px_24px_24px_-7px_rgba(0,0,0,0.25)] p-1.5 flex flex-col gap-0.5 animate-in fade-in zoom-in duration-150 origin-top-right"
          >
            {items.map((item) => (
              <div key={item.key} className="contents">
                {item.divider && <div className="w-full border-t border-[#F1F1F5] my-0.5" />}
                <button
                  type="button"
                  onClick={(e) => runAction(e, item.onClick)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-normal whitespace-nowrap ${
                    item.danger
                      ? "text-red-600 hover:bg-red-50"
                      : "text-[#161618] hover:bg-gray-50"
                  }`}
                >
                  <item.icon className={`w-3.5 h-3.5 ${item.danger ? "" : "text-[#1C1B1F]"}`} />
                  {item.label}
                </button>
              </div>
            ))}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}

/**
 * Merge the row-actions ⋮ menu into the LAST visible data column instead of
 * giving actions their own column. Any existing column with id "actions" is
 * dropped first, then the last non-selection column's cell is wrapped so its
 * normal content sits on the left and the ⋮ menu sits flush right. The menu
 * therefore rides along with whichever column is currently last (after
 * hiding/reordering/pinning) rather than being a separate pinned column.
 *
 * @param {Array}    orderedColumns - columns already in final visual order
 * @param {Function} renderMenu     - (rowOriginal) => <RowActionsMenu .../>
 */
export function withRowActionsColumn(orderedColumns, renderMenu) {
  const cols = orderedColumns.filter((c) => c.id !== "actions");
  if (!cols.length) return cols;

  // Last column that isn't the selection checkbox.
  let idx = cols.length - 1;
  while (idx >= 0 && cols[idx].id === "selection") idx--;
  if (idx < 0) return cols;

  const last = cols[idx];
  const originalCell = last.cell;
  cols[idx] = {
    ...last,
    cell: (ctx) => (
      <div className="flex items-center justify-between gap-2 w-full">
        <div className="min-w-0 flex-1">
          {typeof originalCell === "function" ? originalCell(ctx) : originalCell}
        </div>
        <div className="flex-shrink-0">{renderMenu(ctx.row.original)}</div>
      </div>
    ),
  };
  return cols;
}
