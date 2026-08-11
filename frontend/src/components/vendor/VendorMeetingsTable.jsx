import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Skeleton from "../common/Skeleton";
import { Plus, Calendar, Search, Trash2, Eye } from "lucide-react";
import API from "../../services/api";
import VendorMeetingForm from "./VendorMeetingForm";
import MeetingDetailsModal from "../company/MeetingDetailsModal";
import DataTable from "../common/DataTable";
import RowActionsMenu, { withRowActionsColumn } from "../common/RowActionsMenu";
import BulkActionBar from "../common/BulkActionBar";
import TablePaginationFooter from "../common/TablePaginationFooter";
import CompanyFilterPanel from "../company/CompanyFilterPanel";
import FilterIcon from "../common/FilterIcon";
import { useBulkSelection, useBulkStrip } from "../../hooks/useBulkSelection";
import { useTopLoadingSignal } from "../common/TopLoadingBar";
import toast from "react-hot-toast";
import HighlightText from "../common/HighlightText";
import { exportToCSV } from "../../utils/exportToCSV";
import { useLocalStorageState } from "../../hooks/useLocalStorageState";

const stripHtml = (html) => String(html || "").replace(/<[^>]*>/g, "").trim();

/* `options` seeds each dropdown with the schema's full enum (models/Meeting.js)
   so a value stays filterable even when no current row uses it. */
const MEETING_FILTER_COLUMNS = [
  { key: "status", label: "Status", options: ["scheduled", "completed", "cancelled", "no-show"] },
  { key: "meetingType", label: "Type", options: ["in-person", "video-call", "phone-call"] },
  { key: "priority", label: "Priority", options: ["low", "medium", "high"] },
];

const getMeetingFieldValue = (meeting, key) => meeting[key];

const STATUS_BADGE = {
  scheduled: "bg-blue-50 text-blue-700",
  completed: "bg-green-50 text-green-700",
  cancelled: "bg-gray-200 text-gray-700",
  "no-show": "bg-red-50 text-red-600",
};

const PRIORITY_BADGE = {
  high: "bg-red-50 text-red-600",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-gray-100 text-gray-600",
};

const formatDateTime = (iso) => {
  if (!iso) return { date: "—", time: "" };
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    time: d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
  };
};

const VendorMeetingsTable = ({ vendorId }) => {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [users, setUsers] = useState([]);

  const [search, setSearch] = useState("");
  const [selectedFilters, setSelectedFilters] = useState({});
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [columnSizing, setColumnSizing] = useLocalStorageState("vendor-meetings-col-widths", {});
  const [isDeleting, setIsDeleting] = useState(false);

  const [columnOrder, setColumnOrder] = useLocalStorageState("vendor-meetings-col-order", () => [
    "selection", "title", "description", "status", "meetingType", "priority", "scheduledAt", "duration", "location", "actions"
  ]);
  const [hiddenColumns, setHiddenColumns] = useLocalStorageState("vendor-meetings-hidden-cols", new Set());
  const [pinnedColumns, setPinnedColumns] = useLocalStorageState("vendor-meetings-pinned-cols", []);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  const filterButtonRef = useRef(null);

  const handleColumnReorder = (draggedKey, targetKey) => {
    setColumnOrder((prev) => {
      const newOrder = [...prev];
      const draggedIdx = newOrder.indexOf(draggedKey);
      const targetIdx = newOrder.indexOf(targetKey);
      if (draggedIdx === -1 || targetIdx === -1) return prev;
      newOrder.splice(draggedIdx, 1);
      newOrder.splice(targetIdx, 0, draggedKey);
      return newOrder;
    });
  };

  const handlePinColumn = (colId, side) => {
    setPinnedColumns((prev) => [...prev.filter((p) => p.key !== colId), { key: colId, side }]);
  };

  const handleUnpinColumn = (colId) => {
    setPinnedColumns((prev) => prev.filter((p) => p.key !== colId));
  };

  const handleHideColumn = (colId) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      next.add(colId);
      return next;
    });
  };

  const handleSort = (key, direction) => {
    setSortConfig({ key, direction });
  };

  const refetchMeetings = useCallback(async () => {
    const response = await API.get("/meetings", { params: { vendorId } });
    setMeetings(response.data?.meetings || []);
  }, [vendorId]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        await refetchMeetings();
        setError(null);
      } catch (err) {
        setError("Failed to load meetings");
        console.error("Error fetching meetings:", err);
        toast.error(err.response?.data?.error || "Failed to load meetings.");
        setLoading(false);
        return;
      }

      try {
        const usersResponse = await API.get("/auth/all-user");
        setUsers(usersResponse.data?.allUsers || []);
      } catch (err) {
        console.error("Error fetching users for participants:", err);
      }

      setLoading(false);
    };

    if (vendorId) fetchData();
  }, [vendorId, refetchMeetings]);

  const filteredMeetings = useMemo(() => {
    let rows = meetings;

    const term = search.trim().toLowerCase();
    if (term) {
      rows = rows.filter((m) =>
        [m.title, m.description, m.status, m.meetingType, m.priority, m.location]
          .some((v) => String(v || "").toLowerCase().includes(term)),
      );
    }

    Object.entries(selectedFilters).forEach(([key, values]) => {
      if (!values?.length) return;
      rows = rows.filter((m) => values.includes(String(getMeetingFieldValue(m, key) ?? "")));
    });

    return rows;
  }, [meetings, search, selectedFilters]);

  const activeFilterCount = Object.values(selectedFilters).reduce(
    (n, arr) => n + (arr?.length || 0),
    0,
  );

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  useEffect(() => {
    setPage(1);
  }, [filteredMeetings, search, selectedFilters]);

  const sortedMeetings = useMemo(() => {
    if (!sortConfig.key) return filteredMeetings;
    return [...filteredMeetings].sort((a, b) => {
      let aVal = getMeetingFieldValue(a, sortConfig.key) ?? "";
      let bVal = getMeetingFieldValue(b, sortConfig.key) ?? "";
      if (sortConfig.key === "scheduledAt") {
        aVal = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
        bVal = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
      }
      const aCmp = typeof aVal === "number" ? aVal : String(aVal).toLowerCase();
      const bCmp = typeof bVal === "number" ? bVal : String(bVal).toLowerCase();
      if (aCmp < bCmp) return sortConfig.direction === "asc" ? -1 : 1;
      if (aCmp > bCmp) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredMeetings, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedMeetings.length / limit));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const [isPaging, setIsPaging] = useState(false);
  useTopLoadingSignal(isPaging);
  const goToPage = (n) => {
    if (n === page) return;
    setIsPaging(true);
    setPage(n);
    setTimeout(() => setIsPaging(false), 220);
  };
  const paginatedMeetings = useMemo(
    () => sortedMeetings.slice((page - 1) * limit, page * limit),
    [sortedMeetings, page, limit],
  );

  const { selectedItems, toggleItem, clearSelection, selectAll } = useBulkSelection({
    items: filteredMeetings,
  });
  const { visible: stripVisible, closing: stripClosing } = useBulkStrip(selectedItems.length);

  const handleExportSelected = () => {
    const dataToExport = meetings
      .filter((m) => selectedItems.includes(m._id))
      .map((m) => ({
        "Title": m.title || "",
        "Description": stripHtml(m.description || ""),
        "Platform": m.platform || "",
        "Duration (min)": m.duration || "",
        "Scheduled At": m.scheduledAt ? new Date(m.scheduledAt).toLocaleString() : "",
      }));
    if (dataToExport.length === 0) return;
    const headers = Object.keys(dataToExport[0]).join(",");
    const rows = dataToExport.map(row => Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    exportToCSV([headers, ...rows], `meetings_export_${new Date().toISOString().split("T")[0]}.csv`);
  };

  const handleBulkDelete = async () => {
    if (!selectedItems.length) return;
    if (!window.confirm(`Delete ${selectedItems.length} meeting(s)? This cannot be undone.`)) return;
    setIsDeleting(true);
    try {
      await Promise.all(selectedItems.map((id) => API.delete(`/meetings/${id}`)));
      await refetchMeetings();
      clearSelection();
      toast.success("Meetings deleted!");
    } catch (err) {
      console.error("Bulk delete failed:", err);
      toast.error(err.response?.data?.error || "Failed to delete some meetings.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMeetingSave = async (meetingData) => {
    try {
      await API.post("/meetings", { ...meetingData, vendorId, linkedTo: "vendor" });
      await refetchMeetings();
      toast.success("Meeting created!");
      setShowMeetingForm(false);
    } catch (err) {
      console.error("Error saving meeting:", err);
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Failed to create meeting.");
      }
      throw err;
    }
  };

  const handleMeetingDelete = async (meetingId) => {
    try {
      await API.delete(`/meetings/${meetingId}`);
      await refetchMeetings();
      toast.success("Meeting deleted!");
      handleCloseMeetingModal();
    } catch (err) {
      console.error("Error deleting meeting:", err);
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Failed to delete meeting.");
      }
      throw err;
    }
  };

  const handleCloseMeetingModal = () => {
    setIsMeetingModalOpen(false);
    setSelectedMeeting(null);
  };

  // Wired to MeetingDetailsModal's Edit button (onEdit) — previously
  // unpassed, so that button silently did nothing. Closes the read-only
  // popup and opens VendorMeetingForm against the same meeting, in edit mode.
  const handleEditMeeting = (meeting) => {
    handleCloseMeetingModal();
    setEditingMeeting(meeting);
    setShowMeetingForm(true);
  };

  const baseColumns = useMemo(
    () => [
      {
        id: "selection",
        size: 64,
        enableResizing: false,
        header: () => (
          <div className="flex justify-center items-center w-full">
            <input
              type="checkbox"
              checked={
                selectedItems.length > 0 &&
                selectedItems.length === filteredMeetings.length
              }
              onChange={(e) =>
                e.target.checked ? selectAll(filteredMeetings) : clearSelection()
              }
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex justify-center items-center w-full">
            <input
              type="checkbox"
              checked={selectedItems.includes(row.original._id)}
              onChange={() => toggleItem(row.original._id)}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
          </div>
        ),
      },
      {
        id: "title",
        accessorKey: "title",
        size: 240,
        header: "Meeting",
        cell: ({ row }) => (
          <span className="font-medium text-gray-900 truncate block" title={row.original.title}>
            {row.original.title ? <HighlightText text={row.original.title} query={search} /> : "—"}
          </span>
        ),
      },
      {
        id: "description",
        size: 240,
        header: "Description",
        cell: ({ row }) => (
          <span className="text-gray-600 truncate block" title={row.original.description}>
            {row.original.description ? <HighlightText text={row.original.description} query={search} /> : "—"}
          </span>
        ),
      },
      {
        id: "status",
        size: 120,
        header: "Status",
        cell: ({ row }) => (
          <span
            className={`inline-flex px-2 py-1 text-xs font-medium rounded capitalize ${STATUS_BADGE[row.original.status] || "bg-gray-100 text-gray-800"
              }`}
          >
            {row.original.status ? <HighlightText text={row.original.status} query={search} /> : "—"}
          </span>
        ),
      },
      {
        id: "meetingType",
        size: 130,
        header: "Type",
        cell: ({ row }) => (
          <span className="text-gray-700 capitalize">
            {row.original.meetingType ? <HighlightText text={row.original.meetingType.replace("-", " ")} query={search} /> : "—"}
          </span>
        ),
      },
      {
        id: "priority",
        size: 110,
        header: "Priority",
        cell: ({ row }) => (
          <span
            className={`inline-flex px-2 py-1 text-xs font-medium rounded capitalize ${PRIORITY_BADGE[row.original.priority] || "bg-gray-100 text-gray-600"
              }`}
          >
            {row.original.priority ? <HighlightText text={row.original.priority} query={search} /> : "—"}
          </span>
        ),
      },
      {
        id: "scheduledAt",
        size: 160,
        header: "Scheduled",
        cell: ({ row }) => {
          const { date, time } = formatDateTime(row.original.scheduledAt);
          return (
            <div className="flex flex-col leading-tight">
              <span className="text-gray-900">{date}</span>
              <span className="text-xs text-gray-500">{time}</span>
            </div>
          );
        },
      },
      {
        id: "duration",
        size: 100,
        header: "Duration",
        cell: ({ row }) => (
          <span className="text-gray-700">
            {row.original.duration ? `${row.original.duration} min` : "—"}
          </span>
        ),
      },
      {
        id: "location",
        size: 200,
        header: "Location",
        cell: ({ row }) => (
          <span className="text-gray-700 truncate block" title={row.original.location}>
            {row.original.location ? <HighlightText text={row.original.location} query={search} /> : "—"}
          </span>
        ),
      },
    ],
    [paginatedMeetings, selectedItems, selectAll, clearSelection, toggleItem, search],
  );

  const finalColumns = useMemo(() => {
    const visibleBase = baseColumns.filter(c => !hiddenColumns.has(c.id));
    const selectionCol = visibleBase.find(c => c.id === "selection");
    const otherCols = visibleBase.filter(c => c.id !== "selection" && c.id !== "actions");

    const leftPinnedKeys = new Set(pinnedColumns.filter(p => p.side === 'left').map(p => p.key));
    const rightPinnedKeys = new Set(pinnedColumns.filter(p => p.side === 'right').map(p => p.key));

    const leftCols = otherCols.filter(c => leftPinnedKeys.has(c.id));
    const rightCols = otherCols.filter(c => rightPinnedKeys.has(c.id));
    const midCols = otherCols.filter(c => !leftPinnedKeys.has(c.id) && !rightPinnedKeys.has(c.id));

    midCols.sort((a, b) => columnOrder.indexOf(a.id) - columnOrder.indexOf(b.id));

    const ordered = [
      ...(selectionCol ? [selectionCol] : []),
      ...leftCols,
      ...midCols,
      ...rightCols,
    ];
    return withRowActionsColumn(ordered, (meeting) => (
      <RowActionsMenu
        onView={() => {
          setSelectedMeeting(meeting);
          setIsMeetingModalOpen(true);
        }}
        onEdit={() => handleEditMeeting(meeting)}
        onDelete={() => {
          if (window.confirm("Delete this meeting?")) handleMeetingDelete(meeting._id);
        }}
      />
    ));
  }, [baseColumns, columnOrder, hiddenColumns, pinnedColumns]);

  const visibleColumnsForGhost = useMemo(() => finalColumns.map(c => ({ key: c.id, label: c.header })), [finalColumns]);
  const getGhostPreview = (colId) => {
    return paginatedMeetings.slice(0, 10).map((m) => {
      let val = m[colId];
      if (colId === 'scheduledAt') {
        val = new Date(m.scheduledAt).toLocaleDateString([], {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
      }
      return String(val ?? "").trim() || "—";
    });
  };

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-900 font-medium mb-2">Error Loading Meetings</div>
        <p className="text-gray-600 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="h-full mt-0">
      {/* Action Buttons (Portaled to Tab Header) removed */}

      {!loading && meetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 min-h-[300px] bg-gray-50 border border-gray-200 rounded-xl text-gray-500">
          <Calendar className="w-10 h-10 text-gray-400" />
          <p className="text-sm text-gray-600">No meetings yet</p>
          <p className="text-xs text-gray-500">Meetings will appear here once created</p>
          <button
            onClick={() => {
              setEditingMeeting(null);
              setShowMeetingForm(true);
            }}
            className="mt-2 flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Add new meeting
          </button>
        </div>
      ) : stripVisible ? (
        <BulkActionBar
          selectedCount={selectedItems.length}
          entityName="meeting"
          isClosing={stripClosing}
          onSelectAll={() => selectAll(filteredMeetings)}
          onDeselectAll={clearSelection}
          onExport={handleExportSelected}
          onCancel={clearSelection}
          onDelete={handleBulkDelete}
          isDeleting={isDeleting}
        />
      ) : (
        <div className="flex items-center gap-4 mb-2" style={{ height: "44px" }}>
          <div className="relative flex-1 h-full">
            <Search size={20} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-900 opacity-50" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search meetings..."
              className="w-full h-full pl-10 pr-3.5 border border-[rgba(31,41,55,0.1)] rounded-full text-sm focus:outline-none focus:border-[#0085FF]"
            />
          </div>
          <button
            ref={filterButtonRef}
            onClick={() => setShowFilterPanel(true)}
            className="relative flex items-center justify-center gap-2 px-3 text-sm font-medium text-gray-800 bg-white border rounded-full hover:bg-gray-50 flex-shrink-0"
            style={{
              height: "44px",
              borderColor: activeFilterCount > 0 ? "#0085FF" : "#E1E4EA",
            }}
          >
            <FilterIcon size={16} />
            Filter
            {activeFilterCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full ring-2 ring-white">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingMeeting(null);
              setShowMeetingForm(true);
            }}
            className="flex items-center justify-center rounded-full border hover:bg-gray-50 flex-shrink-0"
            style={{ width: "44px", height: "44px", borderColor: "rgba(31, 41, 55, 0.1)" }}
          >
            <Plus size={20} className="text-gray-700" />
          </button>
        </div>
      )}

      {(loading || meetings.length > 0) && (
      <div className="bg-white border border-[#E1E4EA] rounded-xl shadow-[0px_2px_4px_rgba(28,27,31,0.04)] overflow-hidden">
        <DataTable
          data={paginatedMeetings}
          columns={finalColumns}
          columnSizing={columnSizing}
          onColumnSizingChange={setColumnSizing}
          pinnedColumns={pinnedColumns}
          onPinColumn={handlePinColumn}
          onUnpinColumn={handleUnpinColumn}
          onHideColumn={handleHideColumn}
          onSort={handleSort}
          onColumnReorder={handleColumnReorder}
          visibleColumns={visibleColumnsForGhost}
          getGhostPreview={getGhostPreview}
          variant="card"
          maxHeight={290}
          loading={loading}
          rowClassName={(m) => (selectedItems.includes(m._id) ? "!bg-blue-50" : "")}
          loadingContent={
            <div className="space-y-0">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-[#E1E4EA] last:border-b-0">
                  <Skeleton width={16} height={16} />
                  <Skeleton width={90} height={13} />
                  <Skeleton width={70} height={13} />
                  <Skeleton width={60} height={13} />
                  <Skeleton width={80} height={13} />
                  <Skeleton width={60} height={13} />
                </div>
              ))}
            </div>
          }
          emptyContent={
            <div className="flex flex-col items-center gap-2">
              <Calendar className="w-10 h-10 text-gray-400" />
              <p className="text-sm text-gray-600">
                {search || activeFilterCount ? "No meetings match your filters" : "No meetings yet"}
              </p>
              <p className="text-xs text-gray-500">
                {search || activeFilterCount
                  ? "Try clearing the search or filters"
                  : "Meetings will appear here once created"}
              </p>
              {!search && !activeFilterCount && (
                <button
                  onClick={() => {
                    setEditingMeeting(null);
                    setShowMeetingForm(true);
                  }}
                  className="mt-2 flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus size={16} />
                  Add new meeting
                </button>
              )}
            </div>
          }
        />

        <div className="border-t border-[#E1E4EA] px-5">
          <TablePaginationFooter
            currentPage={page}
            totalPages={totalPages}
            totalCount={filteredMeetings.length}
            limit={limit}
            onPageChange={goToPage}
            onLimitChange={(n) => {
              setLimit(n);
              setPage(1);
            }}
          />
        </div>
      </div>
      )}

      <CompanyFilterPanel
        isOpen={showFilterPanel}
        onClose={() => setShowFilterPanel(false)}
        columns={MEETING_FILTER_COLUMNS}
        data={meetings}
        getFieldValue={getMeetingFieldValue}
        selected={selectedFilters}
        onApply={setSelectedFilters}
        triggerRef={filterButtonRef}
      />

      {showMeetingForm && (
        <VendorMeetingForm
          open={showMeetingForm}
          mode={editingMeeting ? "view" : "create"}
          meetingData={editingMeeting}
          startInEditMode={!!editingMeeting}
          vendorId={vendorId}
          onSave={handleMeetingSave}
          onDelete={handleMeetingDelete}
          onClose={async () => {
            // VendorMeetingForm has no dedicated "update succeeded" callback —
            // it calls onClose() after both create and edit saves, so the
            // refetch that used to only happen on create (inside
            // handleMeetingSave) needs to happen here too, or an edited
            // meeting's changes wouldn't show up in the table until a manual
            // refresh.
            setShowMeetingForm(false);
            setEditingMeeting(null);
            await refetchMeetings();
          }}
        />
      )}

      {selectedMeeting && (
        <MeetingDetailsModal
          open={isMeetingModalOpen}
          meetingData={selectedMeeting}
          users={users}
          onDelete={handleMeetingDelete}
          onEdit={handleEditMeeting}
          onClose={handleCloseMeetingModal}
        />
      )}
    </div>
  );
};

export default VendorMeetingsTable;
