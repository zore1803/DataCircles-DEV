import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { formatNumberToIndian } from "../../utils/numberFormatter";
import {
  ChevronUp,
  ChevronDown,
  Edit2,
  Trash2,
  FileText,
  Tag,
  IndianRupee,
  Calendar,
  Building2,
  MoreVertical,
  ChevronsUpDown,
  Eye,
  Star,    // Added
  Pin,     // Added
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

const getColorTheme = (index, status) => {
  if (status === "Won") return "green";
  if (status === "Lost") return "red";
  const themes = ["blue", "purple", "indigo", "cyan", "teal"];
  const safeIndex = index >= 0 ? index : 0;
  return themes[safeIndex % themes.length];
};

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
  const [activeActionMenu, setActiveActionMenu] = useState(null);
  const [columnSizing, setColumnSizing] = useState({});

  const [pinnedColumn, setPinnedColumn] = useState(null);

  const togglePinColumn = (colKey) => {
    setPinnedColumn((prev) => (prev === colKey ? null : colKey));
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (activeActionMenu && !event.target.closest(".action-menu-container")) {
        setActiveActionMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeActionMenu]);

  const toggleActionMenu = (e, dealId) => {
    e.stopPropagation();
    setActiveActionMenu(activeActionMenu === dealId ? null : dealId);
  };

  const SortIcons = ({ field }) => (
    <div className="flex flex-col ml-1">
      <ChevronUp
        className={`w-3 h-3 ${sortConfig.key === field && sortConfig.direction === "asc"
          ? "text-blue-600"
          : "text-gray-400"
          }`}
      />
      <ChevronDown
        className={`w-3 h-3 -mt-1 ${sortConfig.key === field && sortConfig.direction === "desc"
          ? "text-blue-600"
          : "text-gray-400"
          }`}
      />
    </div>
  );

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

      // 2. Star Column
      columnHelper.display({
        id: "star",
        size: 60,
        enableResizing: false,
        header: () => (
          <div className="flex justify-center items-center w-full">
            <Star className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </div>
        ),
        cell: ({ row }) => {
          const isStarred = starredDeals.includes(row.original._id);
          return (
            <div className="flex justify-center items-center w-full">
              <button
                onClick={(e) => toggleStar(e, row.original._id)}
                className="focus:outline-none hover:scale-110 transition-transform"
                title={isStarred ? "Unstar" : "Star"}
              >
                <Star
                  className={`w-4 h-4 transition-colors ${isStarred
                    ? "text-yellow-400 fill-yellow-400"
                    : "text-gray-300 hover:text-yellow-400"
                    }`}
                />
              </button>
            </div>
          );
        },
      }),

      // 3. Title Column
      columnHelper.accessor("title", {
        id: "title",
        size: 250,
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
                <SortIcons field="title" />
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
              <div className="flex items-center gap-3 flex-1 truncate pr-4">
                <Link
                  to={`/deals/${deal._id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-all duration-150 ease-out truncate"
                  title={getValue()}
                >
                  {getValue()}
                </Link>
              </div>

              {permission === "read-write" && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-150 ease-out pointer-events-none group-hover:pointer-events-auto bg-white/80 backdrop-blur-[2px] rounded-lg px-1">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setQuickViewDealId(deal._id);
                    }}
                    className="p-1.5 rounded-md bg-white shadow-sm border border-gray-200 hover:bg-blue-50 text-blue-600"
                    title="Quick view"
                  >
                    <Eye size={15} />
                  </button>
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
                </div>
              )}
            </div>
          );
        },
      }),

      // Status
      columnHelper.accessor("status", {
        id: "status",
        size: 200,
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
                <SortIcons field="status" />
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
          const theme = getColorTheme(statuses.indexOf(dealStatus), dealStatus);
          return (
            <div className="flex items-center gap-2 w-full" onClick={(e) => e.stopPropagation()}>
              <CustomDropdown
                options={statuses}
                value={dealStatus}
                onChange={(newStatus) => handleStatusChange(row.original._id, dealStatus, newStatus)}
                placeholder="Select Stage"
                className="w-full h-auto"
                buttonClassName="flex items-center justify-between w-full bg-transparent border-0 p-0 gap-2 group cursor-pointer"
                renderValue={(value) => (
                  <span className={`px-3 py-1.5 rounded-full border border-${theme}-200 bg-${theme}-50 text-${theme}-700 font-bold text-xs truncate`}>
                    {value}
                  </span>
                )}
                dropdownIcon={<ChevronsUpDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors flex-shrink-0" />}
              />
            </div>
          );
        },
      }),

      // Amount
      columnHelper.accessor("amount", {
        id: "amount",
        size: 180,
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
                <SortIcons field="amount" />
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

      // Last Updated
      columnHelper.accessor("updatedAt", {
        id: "updatedAt",
        size: 180,
        header: () => {
          const isPinned = pinnedColumn === "updatedAt";
          return (
            <div
              className="flex items-center justify-between w-full group cursor-pointer select-none"
              onDoubleClick={(e) => { e.stopPropagation(); togglePinColumn("updatedAt"); }}
            >
              <div
                className="flex items-center gap-2 flex-1 overflow-hidden"
                onClick={(e) => { e.stopPropagation(); handleSort("updatedAt"); }}
              >
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <span className="truncate" title="Last Updated">Last Updated</span>
                <SortIcons field="updatedAt" />
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); togglePinColumn("updatedAt"); }}
                className={`ml-2 p-1 rounded hover:bg-gray-200 transition-opacity flex-shrink-0 ${isPinned ? "opacity-100 text-blue-600" : "opacity-0 group-hover:opacity-100 text-gray-400"}`}
              >
                {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
              </button>
            </div>
          );
        },
        cell: ({ getValue }) => {
          const formattedDate = new Date(getValue()).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          return (
            <div className="text-sm text-gray-600 truncate" title={formattedDate}>
              {formattedDate}
            </div>
          );
        },
      }),

      // Company + Actions
      columnHelper.accessor("company", {
        id: "company",
        size: 250,
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
                <SortIcons field="company" />
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
          const deal = row.original;
          const companyName = deal.company?.name || "-";
          return (
            <div className="flex items-center justify-between w-full relative action-menu-container">
              <span className="text-sm text-gray-900 truncate pr-2" title={companyName}>
                {companyName}
              </span>
              {permission === "read-write" && (
                <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => toggleActionMenu(e, deal._id)}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {activeActionMenu === deal._id && (
                    <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-lg border border-gray-100 z-50 py-1 overflow-hidden">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditDeal(deal);
                          setActiveActionMenu(null);
                        }}
                        className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 hover:text-blue-600 flex items-center gap-2"
                      >
                        <Edit2 className="w-3 h-3" /> Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDeal(deal._id);
                          setActiveActionMenu(null);
                        }}
                        className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 hover:text-red-600 flex items-center gap-2"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  )}
                </div>
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
    activeActionMenu,
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
      className={`relative overflow-hidden ${loading ? "pointer-events-none opacity-60" : ""
        }`}
    >
      <div className="overflow-auto pb-4">
        <table
          className="w-full text-sm text-gray-700 border-collapse text-left"
          style={{
            width: "100%",
            minWidth: `${table.getTotalSize()}px`,
            tableLayout: "fixed",
          }}
        >
          <thead className="bg-gray-50 border-b border-gray-200">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const colId = header.column.id;

                  // Selection, Star, and Pinned columns are all sticky
                  const isSticky = colId === "selection" || colId === "star" || colId === pinnedColumn;
                  const isRightMostSticky = pinnedColumn ? colId === pinnedColumn : colId === "star";

                  // Calculate left offsets incrementally
                  let leftOffset = "auto";
                  if (colId === "selection") leftOffset = 0;
                  if (colId === "star") leftOffset = 60; // selection width
                  if (colId === pinnedColumn) leftOffset = 120; // selection (60) + star (40)

                  return (
                    <th
                      key={header.id}
                      style={{
                        width: header.getSize(),
                        minWidth: header.getSize(),
                        maxWidth: header.getSize(),
                        position: isSticky ? "sticky" : "relative",
                        left: leftOffset,
                        zIndex: isSticky ? 20 : 1,
                      }}
                      className={`px-4 py-3 font-semibold text-gray-700 uppercase tracking-wider text-xs border-r border-gray-200 hover:bg-gray-100 transition-colors bg-gray-50 ${isRightMostSticky
                        ? "border-r-2 border-r-gray-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
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

          <tbody className="divide-y divide-gray-100 bg-white">
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
              table.getRowModel().rows.map((row) => {
                const deal = row.original;
                const isSelected = selectedRows.includes(deal._id);
                const stale = isStale(deal.createdAt);

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
                      const isSticky = colId === "selection" || colId === "star" || colId === pinnedColumn;
                      const isRightMostSticky = pinnedColumn ? colId === pinnedColumn : colId === "star";

                      let leftOffset = "auto";
                      if (colId === "selection") leftOffset = 0;
                      if (colId === "star") leftOffset = 60;
                      if (colId === pinnedColumn) leftOffset = 100;

                      return (
                        <td
                          key={cell.id}
                          style={{
                            width: cell.column.getSize(),
                            minWidth: cell.column.getSize(),
                            maxWidth: cell.column.getSize(),
                            position: isSticky ? "sticky" : "static",
                            left: leftOffset,
                            zIndex: isSticky ? 10 : 1,
                          }}
                          className={`px-4 py-2 border-r border-[#E5E5EC] align-middle bg-inherit ${isRightMostSticky
                            ? "border-r-2 border-r-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]"
                            : "last:border-r-0"
                            }`}
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
    </div>
  );
}
