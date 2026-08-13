import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";
import { getAncestorZoom } from "../../utils/domUtils";

// Single "⋮" button that pops a small action card, portaled to document.body
// and position-clamped for the app's dynamic zoom — same pattern as
// NoteCard's menu (components/vendor/NoteSection.jsx, components/company/NoteSection.jsx)
// and the column header menus in DataTable.jsx. `actions` is
// [{ label, icon: Icon, onClick, danger }].
export default function RowActionsMenu({ actions }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);

  const visibleActions = actions.filter(Boolean);
  if (visibleActions.length === 0) return null;

  return (
    <div className="relative flex-shrink-0" onMouseDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        ref={btnRef}
        onClick={(e) => {
          e.stopPropagation();
          if (open) {
            setOpen(false);
            setPos(null);
            return;
          }
          const zMenu = getAncestorZoom(document.body);
          const MENU_W = 160;
          const MENU_H = visibleActions.length * 34 + 12;
          const MARGIN = 8;
          const rect = e.currentTarget.getBoundingClientRect();
          const viewportH = window.innerHeight / zMenu;
          const viewportW = window.innerWidth / zMenu;
          let calcTop = rect.bottom / zMenu + 4;
          calcTop = Math.max(MARGIN, Math.min(calcTop, viewportH - MENU_H - MARGIN));
          let calcLeft = rect.right / zMenu - MENU_W;
          calcLeft = Math.min(calcLeft, viewportW - MENU_W - MARGIN);
          calcLeft = Math.max(calcLeft, MARGIN);
          setPos({ top: calcTop, left: calcLeft });
          setOpen(true);
        }}
        className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-500"
        title="More options"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => { setOpen(false); setPos(null); }} />
          <div
            style={{ position: "fixed", top: pos.top, left: pos.left }}
            className="w-[160px] z-[9999] bg-white border border-[#E5E5EC] rounded-lg shadow-[7px_24px_24px_-7px_rgba(0,0,0,0.25)] p-1.5 flex flex-col gap-0.5 animate-in fade-in zoom-in duration-150 origin-top-right"
            onClick={(e) => e.stopPropagation()}
          >
            {visibleActions.map((action) => (
              <button
                key={action.label}
                onClick={() => {
                  setOpen(false);
                  setPos(null);
                  action.onClick();
                }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-normal whitespace-nowrap ${
                  action.danger ? "text-red-600 hover:bg-red-50" : "text-[#161618] hover:bg-gray-50"
                }`}
              >
                <action.icon className="w-3.5 h-3.5" />
                {action.label}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
