import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { formatNumberToIndian } from "../../utils/numberFormatter";
import {
  Edit2,
  Trash2,
  FileText,
  Tag,
  IndianRupee,
  Calendar,
  Building2,
  ChevronsUpDown,
  Eye,
  Pin,
  PinOff,
} from "lucide-react";
import CustomDropdown from "../common/CustomDropdown";

// TanStack Table
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";

export default function DealsTable({
  sortedTableDeals = [],
  selectedRows = [],
  handleSelectAll,
  handleRowSelect,
  handleRowMouseDown,
  handleRowMouseUp,
  handleRowTouchStart,
  handleRowTouchEnd,
  handleStatusChange,
  handleEditDeal,
  handleDeleteDeal,
  isStale,
  statuses = [],
  permission = "readonly",
  sortConfig = {},
  handleSort,
  selectionMode = false,
  loading = false,
  setQuickViewDealId,
  starredDeals = [], // Added
  toggleStar,
}) {
  const [columnSizing, setColumnSizing] = useState({});

  const [pinnedColumn, setPinnedColumn] = useState(null);

  const togglePinColumn = (colKey) => {
    setPinnedColumn((prev) => (prev === colKey ? null : colKey));
  };

  const columnHelper = createColumnHelper();

  const columns = useMemo(() => {
    const baseCols = [
      // 1. Selection Checkbox Column
      columnHelper.display({
        id: "selection",
        size: 60,
        enableResizing: false,
        header: () => (
          <div className="flex justify-center items-center w-full">
            <input
              type="checkbox"
              checked={
                selectedRows.length === sortedTableDeals.length &&
                sortedTableDeals.length > 0
              }
              onChange={(e) => {
                e.stopPropagation();
                handleSelectAll(e);
              }}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex justify-center items-center w-full">
            <input
              type="checkbox"
              checked={selectedRows.includes(row.original._id)}
              onChange={(e) => {
                e.stopPropagation();
                handleRowSelect(row.original._id);
              }}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
          </div>
        ),
      }),

      // 2. Deal ID Column
      columnHelper.display({
        id: "dealId",
        size: 127,
        enableResizing: false,
        header: () => (
          <div className="flex items-center gap-2 w-full">
            <span className="truncate" title="Deal ID">Deal ID</span>
          </div>
        ),
        cell: ({ row }) => {
          const shortId = row.original._id.slice(-5).toUpperCase();
          return (
            <span className="text-sm font-medium text-[#525866] truncate" title={`DL-${shortId}`}>
              DL-{shortId}
            </span>
          );
        },
      }),

      // 3. Title Column
      columnHelper.accessor("title", {
        id: "title",
        size: 185,
        header: () => {
          const isPinned = pinnedColumn === "title";
          return (
            <div
              className="flex items-center justify-between w-full group cursor-pointer select-none"
              onDoubleClick={(e) => { e.stopPropagation(); togglePinColumn("title"); }}
            >
              <div
                className="flex items-center gap-2 flex-1 overflow-hidden"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSort("title");
                }}
              >
                <FileText className="w-4 h-4 flex-shrink-0" />
                <span className="truncate" title="Deal Name">Deal Name</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); togglePinColumn("title"); }}
                className={`ml-2 p-1 rounded hover:bg-gray-200 transition-opacity flex-shrink-0 ${isPinned ? "opacity-100 text-blue-600" : "opacity-0 group-hover:opacity-100 text-gray-400"}`}
                title={isPinned ? "Unpin Column" : "Pin Column"}
              >
                {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
              </button>
            </div>
          );
        },
        cell: ({ row, getValue }) => {
          const deal = row.original;
          return (
            <div className="flex items-center justify-between w-full group relative">
              <Link
                to={`/deals/${deal._id}`}
                onClick={(e) => e.stopPropagation()}
                className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-all duration-150 ease-out truncate flex-1 pr-4"
                title={getValue()}
              >
                {getValue()}
              </Link>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-150 ease-out pointer-events-none group-hover:pointer-events-auto bg-white/80 backdrop-blur-[2px] rounded-lg">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setQuickViewDealId(deal._id);
                  }}
                  className="p-1.5 rounded-md bg-white shadow-sm border border-gray-200 hover:bg-blue-50 text-blue-600 transition-colors"
                  title="Quick view"
                >
                  <Eye size={15} />
                </button>
                {permission === "read-write" && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditDeal(deal);
                      }}
                      className="p-1.5 rounded-md hover:bg-blue-50 text-gray-500 hover:text-blue-600 transition-all duration-150 transform hover:scale-110 active:scale-95"
                      title="Edit Deal"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDeal(deal._id);
                      }}
                      className="p-1.5 rounded-md hover:bg-red-50 text-gray-500 hover:text-red-600 transition-all duration-150 transform hover:scale-110 active:scale-95"
                      title="Delete Deal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        },
      }),

      // Company
      columnHelper.accessor((row) => row.company?.name, {
        id: "company",
        size: 150,
        header: () => {
          const isPinned = pinnedColumn === "company";
          return (
            <div
              className="flex items-center justify-between w-full group cursor-pointer select-none"
              onDoubleClick={(e) => { e.stopPropagation(); togglePinColumn("company"); }}
            >
              <div
                className="flex items-center gap-2 flex-1 overflow-hidden"
                onClick={(e) => { e.stopPropagation(); handleSort("company"); }}
              >
                <Building2 className="w-4 h-4 flex-shrink-0" />
                <span className="truncate" title="Company">Company</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); togglePinColumn("company"); }}
                className={`ml-2 p-1 rounded hover:bg-gray-200 transition-opacity flex-shrink-0 ${isPinned ? "opacity-100 text-blue-600" : "opacity-0 group-hover:opacity-100 text-gray-400"}`}
              >
                {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
              </button>
            </div>
          );
        },
        cell: ({ row }) => {
          const companyName = row.original.company?.name || "-";
          return (
            <span className="text-sm text-gray-900 truncate block" title={companyName}>
              {companyName}
            </span>
          );
        },
      }),

      // Contact
      columnHelper.accessor((row) => row.contact?.name, {
        id: "contact",
        size: 150,
        header: () => (
          <div className="flex items-center gap-2 w-full">
            <span className="truncate" title="Contact">Contact</span>
          </div>
        ),
        cell: ({ row }) => {
          const contactName = row.original.contact?.name || "-";
          return (
            <span className="text-sm text-gray-900 truncate block" title={contactName}>
              {contactName}
            </span>
          );
        },
      }),

      // Status
      columnHelper.accessor("status", {
        id: "status",
        size: 131,
        header: () => {
          const isPinned = pinnedColumn === "status";
          return (
            <div
              className="flex items-center justify-between w-full group cursor-pointer select-none"
              onDoubleClick={(e) => { e.stopPropagation(); togglePinColumn("status"); }}
            >
              <div
                className="flex items-center gap-2 flex-1 overflow-hidden"
                onClick={(e) => { e.stopPropagation(); handleSort("status"); }}
              >
                <Tag className="w-4 h-4 flex-shrink-0" />
                <span className="truncate" title="Stage">Stage</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); togglePinColumn("status"); }}
                className={`ml-2 p-1 rounded hover:bg-gray-200 transition-opacity flex-shrink-0 ${isPinned ? "opacity-100 text-blue-600" : "opacity-0 group-hover:opacity-100 text-gray-400"}`}
              >
                {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
              </button>
            </div>
          );
        },
        cell: ({ row }) => {
          const dealStatus = row.original.status;
          return (
            <div className="flex items-center gap-2 w-full" onClick={(e) => e.stopPropagation()}>
              <CustomDropdown
                options={statuses}
                value={dealStatus}
                onChange={(newStatus) => handleStatusChange(row.original._id, dealStatus, newStatus)}
                placeholder="Select Stage"
                className="w-full h-auto"
                buttonClassName="flex items-center justify-between w-full bg-transparent border-0 p-0 gap-2 group cursor-pointer"
                renderValue={(value) => {
                  const pillStyle =
                    value === "Won"
                      ? { backgroundColor: "rgba(0, 201, 80, 0.1)", color: "#00A63E" }
                      : value === "Lost"
                        ? { backgroundColor: "rgba(232, 34, 34, 0.1)", color: "#E82222" }
                        : { backgroundColor: "rgba(0, 133, 255, 0.1)", color: "#0085FF" };
                  return (
                    <span
                      className="px-3 py-[5px] rounded-full font-medium text-xs truncate"
                      style={pillStyle}
                    >
                      {value}
                    </span>
                  );
                }}
                dropdownIcon={<ChevronsUpDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors flex-shrink-0" />}
              />
            </div>
          );
        },
      }),

      // Amount
      columnHelper.accessor("amount", {
        id: "amount",
        size: 123,
        header: () => {
          const isPinned = pinnedColumn === "amount";
          return (
            <div
              className="flex items-center justify-between w-full group cursor-pointer select-none"
              onDoubleClick={(e) => { e.stopPropagation(); togglePinColumn("amount"); }}
            >
              <div
                className="flex items-center gap-2 flex-1 overflow-hidden"
                onClick={(e) => { e.stopPropagation(); handleSort("amount"); }}
              >
                <IndianRupee className="w-4 h-4 flex-shrink-0" />
                <span className="truncate" title="Amount">Amount</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); togglePinColumn("amount"); }}
                className={`ml-2 p-1 rounded hover:bg-gray-200 transition-opacity flex-shrink-0 ${isPinned ? "opacity-100 text-blue-600" : "opacity-0 group-hover:opacity-100 text-gray-400"}`}
              >
                {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
              </button>
            </div>
          );
        },
        cell: ({ getValue }) => {
          const val = parseInt(getValue() || 0);
          const formatted = `₹${formatNumberToIndian(val)}`;
          return (
            <h6 className="text-sm font-semibold text-gray-900 truncate" title={formatted}>
              {formatted}
            </h6>
          );
        },
      }),

      // Due Date (sourced from the real "Expected Close Date" custom field, when set)
      columnHelper.display({
        id: "dueDate",
        size: 171,
        header: () => (
          <div className="flex items-center gap-2 w-full">
            <Calendar className="w-4 h-4 flex-shrink-0" />
            <span className="truncate" title="Due Date">Due Date</span>
          </div>
        ),
        cell: ({ row }) => {
          const dueDateField = row.original.additionalFields?.find(
            (f) => f.key === "Expected Close Date"
          );
          if (!dueDateField?.value) {
            return <div className="text-sm text-gray-400 truncate">—</div>;
          }
          const formattedDate = new Date(dueDateField.value).toLocaleDateString("en-US", {
            day: "numeric",
            month: "long",
            year: "numeric",
          });
          return (
            <div className="text-sm text-gray-600 truncate" title={formattedDate}>
              {formattedDate}
            </div>
          );
        },
      }),

      // Actions
      columnHelper.display({
        id: "actions",
        size: 120,
        enableResizing: false,
        header: () => (
          <div className="flex items-center gap-2 w-full">
            <span className="truncate" title="Actions">Actions</span>
          </div>
        ),
        cell: ({ row }) => {
          const deal = row.original;
          return (
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setQuickViewDealId(deal._id);
                }}
                className="text-gray-500 hover:text-blue-600 transition-colors"
                title="Quick view"
              >
                <Eye className="w-4 h-4" />
              </button>
              {permission === "read-write" && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditDeal(deal);
                    }}
                    className="text-gray-500 hover:text-blue-600 transition-colors"
                    title="Edit Deal"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDeal(deal._id);
                    }}
                    className="text-red-500 hover:text-red-700 transition-colors"
                    title="Delete Deal"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          );
        },
      }),
    ];

    // Reorder logic: Move pinned column to index 2 (right after selection and star)
    if (pinnedColumn) {
      const pinnedIndex = baseCols.findIndex(col => col.id === pinnedColumn);
      if (pinnedIndex > 1) { // 0 is Selection, 1 is Star
        const [pinned] = baseCols.splice(pinnedIndex, 1);
        baseCols.splice(2, 0, pinned);
      }
    }

    return baseCols;
  }, [
    selectedRows,
    sortedTableDeals.length,
    sortConfig,
    statuses,
    permission,
    handleSort,
    handleSelectAll,
    handleRowSelect,
    handleStatusChange,
    handleEditDeal,
    handleDeleteDeal,
    pinnedColumn,
    starredDeals,
  ]);

  const table = useReactTable({
    data: sortedTableDeals,
    columns,
    state: { columnSizing },
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
    enableColumnResizing: true,
  });

  const isInteractiveElement = (target) => {
    return (
      target.tagName === "INPUT" ||
      target.tagName === "BUTTON" ||
      target.tagName === "A" ||
      target.closest(".custom-dropdown") ||
      target.closest(".action-menu-container") ||
      target.closest("button") ||
      target.closest("a")
    );
  };

  return (
    <div
      className={`relative bg-white ${loading ? "pointer-events-none opacity-60" : ""}`}
    >
        <table
          className="w-full text-sm text-gray-700 border-separate border-spacing-0 text-left"
          style={{
            width: "100%",
            minWidth: `${table.getTotalSize()}px`,
            tableLayout: "fixed",
          }}
        >
          <thead className="bg-[#F5F7FA] border-b border-[#E1E4EA]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const colId = header.column.id;

                  // Selection, Star, and Pinned columns are all sticky
                  const isSticky = colId === "selection" || colId === pinnedColumn;
                  const isRightMostSticky = pinnedColumn ? colId === pinnedColumn : colId === "selection";

                  // Calculate left offsets incrementally
                  let leftOffset = "auto";
                  if (colId === "selection") leftOffset = 0;
                  if (colId === pinnedColumn) leftOffset = 60; // selection width

                  return (
                    <th
                      key={header.id}
                      style={{
                        width: header.getSize(),
                        minWidth: header.getSize(),
                        maxWidth: header.getSize(),
                        height: "56px",
                        position: isSticky ? "sticky" : "relative",
                        left: leftOffset,
                        zIndex: isSticky ? 20 : 1,
                      }}
                      className={`px-3 font-medium text-[#525866] text-xs border-r border-[#E1E4EA] hover:bg-gray-100 transition-colors bg-[#F5F7FA] ${isRightMostSticky
                        ? "border-r-2 border-r-gray-300"
                        : "last:border-r-0"
                        }`}
                    >
                      <div className="truncate w-full">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                      </div>

                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none hover:bg-blue-400 z-50 ${header.column.getIsResizing()
                            ? "bg-blue-500"
                            : "bg-transparent"
                            }`}
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          <tbody className="divide-y divide-[#E1E4EA] bg-white">
            {sortedTableDeals.length === 0 ? (
              <tr>
                <td
                  colSpan={table.getAllColumns().length}
                  className="px-6 py-12 text-center text-gray-500 font-medium"
                >
                  No deals found.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, rowIndex) => {
                const deal = row.original;
                const isSelected = selectedRows.includes(deal._id);
                const stale = isStale(deal.createdAt);
                const isLastRow = rowIndex === table.getRowModel().rows.length - 1;

                return (
                  <tr
                    key={row.id}
                    onMouseDown={(e) => {
                      if (isInteractiveElement(e.target)) return;
                      handleRowMouseDown(deal._id);
                    }}
                    onMouseUp={(e) => {
                      if (isInteractiveElement(e.target)) return;
                      handleRowMouseUp();
                    }}
                    onMouseLeave={(e) => {
                      if (isInteractiveElement(e.target)) return;
                      handleRowMouseUp();
                    }}
                    onTouchStart={(e) => {
                      if (isInteractiveElement(e.target)) return;
                      handleRowTouchStart(deal._id);
                    }}
                    onTouchEnd={(e) => {
                      if (isInteractiveElement(e.target)) return;
                      handleRowTouchEnd();
                    }}
                    // Added bg-white to ensure content behind sticky columns is hidden
                    className={`bg-white transition-colors ${stale ? "bg-red-50" : ""} cursor-pointer ${isSelected
                      ? "bg-blue-100 border-l-4 border-blue-500"
                      : "hover:bg-gray-50"
                      }`}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const colId = cell.column.id;

                      // Apply same stickiness calculation as the header
                      const isSticky = colId === "selection" || colId === pinnedColumn;
                      const isRightMostSticky = pinnedColumn ? colId === pinnedColumn : colId === "selection";

                      let leftOffset = "auto";
                      if (colId === "selection") leftOffset = 0;
                      if (colId === pinnedColumn) leftOffset = 60;

                      return (
                        <td
                          key={cell.id}
                          style={{
                            width: cell.column.getSize(),
                            minWidth: cell.column.getSize(),
                            maxWidth: cell.column.getSize(),
                            height: "54px",
                            position: isSticky ? "sticky" : "static",
                            left: leftOffset,
                            zIndex: isSticky ? 10 : 1,
                          }}
                          className={`px-3 py-3 text-sm font-medium text-[#222530] align-middle bg-inherit ${isRightMostSticky
                            ? "border-r-2 border-r-gray-200"
                            : ""
                            } ${colId === "selection" && isLastRow ? "rounded-bl-lg" : ""}`}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
    </div>
  );
}
