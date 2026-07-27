import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";

// The layout is scaled with CSS `zoom` (a dynamic zoom on <html> that tracks the
// window size, plus 0.75 on #root). getBoundingClientRect() and mouse clientX/Y are
// both reported in fully-scaled VISUAL coordinates, so the grab offset (measured)
// needs no correction. The drag-ghost, however, is portaled onto document.body,
// which sits *inside* the <html> zoom — so any coordinate we *set* on it via
// style.left/top is multiplied by that zoom when painted. We therefore divide the
// values we set by the ghost's effective ancestor zoom so it tracks the cursor 1:1
// at any window size / browser zoom.
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

/**
 * Reusable data table with sticky header, pinned/sticky columns, column
 * drag-to-reorder (with a portal drag-ghost), column resize and row
 * drag/long-press selection. All page-specific rendering (cells, header
 * menus, selection state) is supplied by the parent through `columns` and
 * the callback props — this component only owns the generic table shell.
 *
 * `variant`:
 *  - "fixed": edge-to-edge scroll area anchored with position:fixed (used by
 *    full-page lists like Companies).
 *  - "card":  a normal scroll container that stays inside its parent card
 *    (used by the Invoices list on the dashboard).
 */
export default function DataTable({
  data,
  columns,
  columnSizing,
  onColumnSizingChange,
  pinnedColumns = [], // [{ key, side: 'left' | 'right' }]
  selectionColId = "selection",
  visibleColumns = [], // [{ key, label }] — used for the drag-ghost label
  onColumnReorder, // (draggedKey, targetKey) => void
  getGhostPreview, // (colId) => string[]
  rowClassName, // (rowOriginal) => string
  onRowMouseDown,
  onRowMouseUp,
  onRowMouseLeave,
  onRowTouchStart,
  onRowTouchEnd,
  variant = "fixed",
  fixedTop = 128,
  fixedBottom = 64,
  maxHeight = 480,
  loading = false,
  loadingContent,
  emptyContent,
}) {
  const [draggedColKey, setDraggedColKey] = useState(null);
  const [dragOverColKey, setDragOverColKey] = useState(null);
  const [dragGhost, setDragGhost] = useState(null);
  const dragOverRef = useRef(null);
  const ghostElRef = useRef(null);

  const table = useReactTable({
    data,
    columns,
    state: { columnSizing },
    onColumnSizingChange,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
    enableColumnResizing: true,
  });

  const startColumnDrag = (e, colId) => {
    if (e.button !== 0) return;
    if (e.target.closest("button") || e.target.closest("[data-resize-handle]")) return;
    if (!onColumnReorder) return;

    e.preventDefault();
    window.getSelection?.()?.removeAllRanges();

    const th = e.currentTarget;
    const rect = th.getBoundingClientRect();
    const label = visibleColumns.find((vc) => vc.key === colId)?.label || colId;
    const previewRows = getGhostPreview ? getGhostPreview(colId) : [];
    // Grab offset is measured in visual space (rect + clientX both visual) — no
    // correction. `zGhost` scales the values we SET on the body-portal ghost so
    // they map back to visual space (the ghost is painted inside the <html> zoom).
    const zGhost = getAncestorZoom(document.body);
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    dragOverRef.current = null;
    setDraggedColKey(colId);
    setDragOverColKey(null);
    document.body.style.userSelect = "none";
    // Only the label/previewRows/dimensions go through React state (set once).
    // x/y position is mutated directly on the DOM node below so mousemove never
    // triggers a re-render of the whole table.
    setDragGhost({
      label,
      previewRows,
      offsetX,
      offsetY,
      width: rect.width / zGhost,
      height: rect.height / zGhost,
    });

    const positionGhost = (clientX, clientY) => {
      const el = ghostElRef.current;
      if (!el) return;
      const visualTop = clientY - offsetY;
      const visualLeft = clientX - offsetX;
      el.style.top = `${visualTop / zGhost}px`;
      el.style.left = `${visualLeft / zGhost}px`;
      el.style.maxHeight = `${Math.max(100, window.innerHeight - visualTop - 72) / zGhost}px`;
    };
    requestAnimationFrame(() => positionGhost(e.clientX, e.clientY));

    const handleMouseMove = (moveEvent) => {
      positionGhost(moveEvent.clientX, moveEvent.clientY);

      const elAtPoint = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
      const thAtPoint = elAtPoint?.closest("th[data-col-id]");
      const overKey = thAtPoint?.getAttribute("data-col-id") || null;
      if (dragOverRef.current !== overKey) {
        dragOverRef.current = overKey;
        setDragOverColKey(overKey);
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      const overKey = dragOverRef.current;
      if (overKey && overKey !== colId) {
        onColumnReorder(colId, overKey);
      }
      dragOverRef.current = null;
      setDraggedColKey(null);
      setDragOverColKey(null);
      setDragGhost(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const leftPinnedKeys = pinnedColumns.filter((p) => p.side === "left").map((p) => p.key);
  const rightPinnedKeys = pinnedColumns.filter((p) => p.side === "right").map((p) => p.key);
  const allHeaders = table.getHeaderGroups()[0]?.headers || [];

  const pinnedLeftOffsets = {};
  let cumulativeLeft = 0;
  allHeaders.forEach((h) => {
    const isLeftStickyCol = h.column.id === selectionColId || leftPinnedKeys.includes(h.column.id);
    if (isLeftStickyCol) {
      pinnedLeftOffsets[h.column.id] = cumulativeLeft;
      cumulativeLeft += h.getSize();
    }
  });

  const pinnedRightOffsets = {};
  let cumulativeRight = 0;
  [...allHeaders].reverse().forEach((h) => {
    if (rightPinnedKeys.includes(h.column.id)) {
      pinnedRightOffsets[h.column.id] = cumulativeRight;
      cumulativeRight += h.getSize();
    }
  });

  const lastLeftPinnedKey = leftPinnedKeys.length > 0 ? leftPinnedKeys[leftPinnedKeys.length - 1] : null;
  const firstRightPinnedKey = rightPinnedKeys.length > 0 ? rightPinnedKeys[0] : null;

  const scrollStyle =
    variant === "fixed"
      ? {
          position: "fixed",
          top: fixedTop,
          left: "var(--sidebar-width, 0px)",
          right: 0,
          bottom: fixedBottom,
        }
      : { maxHeight, minHeight: 0 };

  return (
    <>
      <div
        className={variant === "fixed" ? "overflow-x-auto overflow-y-auto" : "overflow-auto w-full dc-card-scroll"}
        style={{ ...scrollStyle, overflowY: variant === "card" ? "auto" : undefined }}
      >
        <div className={`relative bg-white ${variant === "fixed" ? "border border-[#E1E4EA]" : ""} ${loading ? "pointer-events-none opacity-60" : ""}`}>
          <table
            className="w-full border-separate border-spacing-0 text-left"
            style={{ minWidth: `${table.getTotalSize()}px`, tableLayout: "fixed" }}
          >
            <thead className="bg-[#F5F7FA] border-b border-[#E1E4EA] sticky top-0 z-30 select-none">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const colId = header.column.id;
                    const isLeftSticky = colId === selectionColId || leftPinnedKeys.includes(colId);
                    const isRightSticky = rightPinnedKeys.includes(colId);
                    const isSticky = isLeftSticky || isRightSticky;
                    const isLeftBoundary = lastLeftPinnedKey ? colId === lastLeftPinnedKey : colId === selectionColId;
                    const isRightBoundary = colId === firstRightPinnedKey;
                    const isDraggable = colId !== selectionColId && !!onColumnReorder;
                    const isDragging = draggedColKey === colId;
                    const isDragOver = dragOverColKey === colId && draggedColKey && draggedColKey !== colId;

                    return (
                      <th
                        key={header.id}
                        data-col-id={colId}
                        onMouseDown={isDraggable ? (e) => startColumnDrag(e, colId) : undefined}
                        style={{
                          width: header.getSize(),
                          position: isSticky ? "sticky" : "relative",
                          left: isLeftSticky ? pinnedLeftOffsets[colId] ?? 0 : "auto",
                          right: isRightSticky ? pinnedRightOffsets[colId] ?? 0 : "auto",
                          zIndex: isSticky ? 20 : 1,
                          opacity: isDragging ? 0.35 : 1,
                        }}
                        className={`px-4 py-3 text-sm font-bold text-[#525866] border-r border-[#E1E4EA] transition-colors bg-[#F5F7FA] ${isDraggable ? "cursor-grab active:cursor-grabbing" : ""} ${isLeftBoundary
                          ? "border-r-2 border-r-gray-300"
                          : "last:border-r-0"
                          } ${isRightBoundary ? "border-l-2 border-l-gray-300" : ""} ${isDragOver ? "bg-blue-100" : "hover:bg-gray-100"}`}
                      >
                        <div className="w-full min-w-0">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </div>

                        {colId !== selectionColId && header.column.getCanResize() && (
                          <div
                            data-resize-handle="true"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              header.getResizeHandler()(e);
                            }}
                            onTouchStart={header.getResizeHandler()}
                            className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none z-50 bg-transparent"
                          />
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>

            <tbody className="bg-white">
              {loading && data.length === 0 ? (
                <tr>
                  <td colSpan={table.getAllColumns().length} className="px-6 py-12 text-center">
                    {loadingContent || <p>Loading...</p>}
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={table.getAllColumns().length} className="px-6 py-12 text-center text-gray-500 font-inter">
                    {emptyContent || <p className="font-medium">No records found</p>}
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`bg-white hover:bg-blue-50 transition-colors ${rowClassName ? rowClassName(row.original) : ""}`}
                    onMouseDown={onRowMouseDown ? () => onRowMouseDown(row.original) : undefined}
                    onMouseUp={onRowMouseUp}
                    onMouseLeave={onRowMouseLeave}
                    onTouchStart={onRowTouchStart ? () => onRowTouchStart(row.original) : undefined}
                    onTouchEnd={onRowTouchEnd}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const colId = cell.column.id;
                      const isLeftSticky = colId === selectionColId || leftPinnedKeys.includes(colId);
                      const isRightSticky = rightPinnedKeys.includes(colId);
                      const isSticky = isLeftSticky || isRightSticky;
                      const isLeftBoundary = lastLeftPinnedKey ? colId === lastLeftPinnedKey : colId === selectionColId;
                      const isRightBoundary = colId === firstRightPinnedKey;
                      const isColDragging = draggedColKey === colId;

                      return (
                        <td
                          key={cell.id}
                          style={{
                            width: cell.column.getSize(),
                            position: isSticky ? "sticky" : "static",
                            left: isLeftSticky ? pinnedLeftOffsets[colId] ?? 0 : "auto",
                            right: isRightSticky ? pinnedRightOffsets[colId] ?? 0 : "auto",
                            zIndex: isSticky ? 10 : 1,
                            opacity: isColDragging ? 0.35 : 1,
                          }}
                          className={`px-4 py-2 align-middle text-sm text-[#1C1B1F] bg-inherit border-r border-b border-[#E1E4EA] ${isLeftBoundary
                            ? "border-r-2 border-r-gray-200"
                            : "last:border-r-0"
                            } ${isRightBoundary ? "border-l-2 border-l-gray-200" : ""}`}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {dragGhost && createPortal(
        <div
          ref={ghostElRef}
          style={{
            position: "fixed",
            top: -9999,
            left: -9999,
            width: dragGhost.width,
            zIndex: 10000,
            pointerEvents: "none",
          }}
          className="flex flex-col bg-white rounded-lg shadow-2xl overflow-hidden"
        >
          <div className="px-4 py-3 bg-[#F5F7FA] border-b border-[#E1E4EA]" style={{ height: dragGhost.height }}>
            <span className="text-sm font-bold text-[#525866] truncate block">{dragGhost.label}</span>
          </div>
          {dragGhost.previewRows.map((rowVal, i) => (
            <div key={i} className="px-4 py-2 border-b border-[#F1F1F5] last:border-b-0">
              <span className="text-sm text-gray-700 truncate block">{rowVal}</span>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
