import Skeleton from "./Skeleton";

/**
 * Table-BODY-only skeleton for react-table-driven lists (Companies, Contacts,
 * Deals table view, etc.). The real header — column titles, filters, search,
 * tabs — stays mounted and renders immediately; only the <tbody> rows swap
 * to this while data is loading, so drop it in place of
 * `table.getRowModel().rows.map(...)` when `isLoading` is true:
 *
 *   {isLoading ? (
 *     <TableSkeletonRows numRows={12} hasCheckbox columns={columns} />
 *   ) : (
 *     table.getRowModel().rows.map(row => <tr>...</tr>)
 *   )}
 *
 * `columns` accepts either plain widths (number[]) or react-table leaf
 * columns (anything with a `.getSize()` / `.size`), so it can be built
 * directly from `table.getVisibleLeafColumns()`.
 */
const resolveWidth = (col) => {
  if (typeof col === "number") return col;
  if (typeof col?.getSize === "function") return col.getSize();
  if (typeof col?.size === "number") return col.size;
  return 150;
};

export function SkeletonRow({ columns, hasCheckbox = true, rowHeight = 44 }) {
  return (
    <tr style={{ height: rowHeight }}>
      {hasCheckbox && (
        <td className="px-4 py-2 align-middle border-r border-b border-[#E1E4EA]" style={{ width: 60 }}>
          <div className="flex justify-center items-center w-full">
            <div className="w-4 h-4 rounded border border-gray-300 animate-pulse bg-gray-100" />
          </div>
        </td>
      )}
      {columns.map((col, i) => (
        <td
          key={i}
          className="px-4 py-2 align-middle border-r border-b border-[#E1E4EA] last:border-r-0"
          style={{ width: resolveWidth(col) }}
        >
          <Skeleton width={`${60 + (i % 3) * 10}%`} height={13} />
        </td>
      ))}
    </tr>
  );
}

export default function TableSkeletonRows({ numRows = 12, columns, hasCheckbox = true, rowHeight = 44 }) {
  return (
    <>
      {Array.from({ length: numRows }).map((_, i) => (
        <SkeletonRow key={i} columns={columns} hasCheckbox={hasCheckbox} rowHeight={rowHeight} />
      ))}
    </>
  );
}
