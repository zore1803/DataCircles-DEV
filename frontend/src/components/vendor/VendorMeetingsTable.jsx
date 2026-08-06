import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { Plus, Calendar, Search, Trash2, Eye } from "lucide-react";
import API from "../../services/api";
import VendorMeetingForm from "./VendorMeetingForm";
import MeetingDetailsModal from "../company/MeetingDetailsModal";
import DataTable from "../common/DataTable";
import BulkActionBar from "../common/BulkActionBar";
import CompanyFilterPanel from "../company/CompanyFilterPanel";
import FilterIcon from "../common/FilterIcon";
import { useBulkSelection, useBulkStrip } from "../../hooks/useBulkSelection";
import toast from "react-hot-toast";

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
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [portalTarget, setPortalTarget] = useState(null);

  const [search, setSearch] = useState("");
  const [selectedFilters, setSelectedFilters] = useState({});
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [columnSizing, setColumnSizing] = useState({});
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setPortalTarget(document.getElementById("tab-actions-portal"));
  }, []);

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

      // Supporting data only — the meeting list already rendered above, so a
      // failure here (e.g. a 403 on the permission-gated user list) must not
      // blank out meetings that loaded fine.
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

  /* ── Search + filter ── */
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

  /* ── Bulk selection ── */
  const { selectedItems, toggleItem, clearSelection, selectAll } = useBulkSelection({
    items: filteredMeetings,
  });
  const { visible: stripVisible, closing: stripClosing } = useBulkStrip(selectedItems.length);

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

  /* ── Columns ── */
  const columns = useMemo(
    () => [
      {
        id: "selection",
        size: 44,
        enableResizing: false,
        header: () => (
          <div className="flex justify-center items-center w-full">
            <input
              type="checkbox"
              checked={filteredMeetings.length > 0 && selectedItems.length === filteredMeetings.length}
              onChange={(e) => (e.target.checked ? selectAll(filteredMeetings) : clearSelection())}
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
            {row.original.title}
          </span>
        ),
      },
      {
        id: "description",
        size: 240,
        header: "Description",
        cell: ({ row }) => (
          <span className="text-gray-600 truncate block" title={row.original.description}>
            {row.original.description || "—"}
          </span>
        ),
      },
      {
        id: "status",
        size: 120,
        header: "Status",
        cell: ({ row }) => (
          <span
            className={`inline-flex px-2 py-1 text-xs font-medium rounded capitalize ${
              STATUS_BADGE[row.original.status] || "bg-gray-100 text-gray-800"
            }`}
          >
            {row.original.status}
          </span>
        ),
      },
      {
        id: "meetingType",
        size: 130,
        header: "Type",
        cell: ({ row }) => (
          <span className="text-gray-700 capitalize">
            {row.original.meetingType ? row.original.meetingType.replace("-", " ") : "—"}
          </span>
        ),
      },
      {
        id: "priority",
        size: 110,
        header: "Priority",
        cell: ({ row }) => (
          <span
            className={`inline-flex px-2 py-1 text-xs font-medium rounded capitalize ${
              PRIORITY_BADGE[row.original.priority] || "bg-gray-100 text-gray-600"
            }`}
          >
            {row.original.priority || "—"}
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
            {row.original.location || "—"}
          </span>
        ),
      },
      {
        id: "actions",
        size: 100,
        enableResizing: false,
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedMeeting(row.original);
                setIsMeetingModalOpen(true);
              }}
              className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
              title="View"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm("Delete this meeting?")) handleMeetingDelete(row.original._id);
              }}
              className="p-1 text-gray-500 hover:text-red-600 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ),
      },
    ],
    [filteredMeetings, selectedItems, selectAll, clearSelection, toggleItem],
  );

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-900 font-medium mb-2">Error Loading Meetings</div>
        <p className="text-gray-600 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="h-full mt-2">
      {/* Action buttons, portaled into the tab header */}
      {portalTarget &&
        createPortal(
          <>
            <div className="relative h-9">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search meetings..."
                className="h-9 w-56 pl-9 pr-3 border border-gray-300 rounded-full text-sm focus:outline-none focus:border-blue-300"
              />
            </div>
            <button
              onClick={() => setShowFilterPanel(true)}
              className="relative flex items-center justify-center gap-2 h-9 px-3 text-sm font-medium text-gray-800 bg-white border border-gray-300 rounded-full hover:bg-gray-50 flex-shrink-0"
            >
              <FilterIcon className="w-4 h-4" />
              Filter
              {activeFilterCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full ring-2 ring-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowMeetingForm(true)}
              className="flex items-center gap-1 h-9 px-3 bg-blue-600 text-white rounded-lg hover:bg-blue-800 text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Meeting
            </button>
          </>,
          portalTarget,
        )}

      {stripVisible ? (
        <BulkActionBar
          selectedCount={selectedItems.length}
          entityName="meeting"
          isClosing={stripClosing}
          onSelectAll={() => selectAll(filteredMeetings)}
          onDeselectAll={clearSelection}
          onDelete={handleBulkDelete}
          isDeleting={isDeleting}
        />
      ) : (
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
          <Calendar className="w-4 h-4" />
          <span>{filteredMeetings.length} meetings</span>
        </div>
      )}

      <DataTable
        data={filteredMeetings}
        columns={columns}
        columnSizing={columnSizing}
        onColumnSizingChange={setColumnSizing}
        variant="card"
        maxHeight={560}
        loading={loading}
        rowClassName={(m) => (selectedItems.includes(m._id) ? "!bg-blue-50" : "")}
        emptyContent={
          <div className="flex flex-col items-center gap-2">
            <Calendar className="w-10 h-10 text-gray-400" />
            <p className="text-sm text-gray-600">
              {search || activeFilterCount ? "No meetings match your filters" : "No meetings yet"}
            </p>
            <p className="text-xs text-gray-500">
              {search || activeFilterCount
                ? "Try clearing the search or filters"
                : "Meetings will appear here once scheduled"}
            </p>
          </div>
        }
      />

      <CompanyFilterPanel
        isOpen={showFilterPanel}
        onClose={() => setShowFilterPanel(false)}
        columns={MEETING_FILTER_COLUMNS}
        data={meetings}
        getFieldValue={getMeetingFieldValue}
        selected={selectedFilters}
        onApply={setSelectedFilters}
      />

      {showMeetingForm && (
        <VendorMeetingForm
          open={showMeetingForm}
          mode="create"
          vendorId={vendorId}
          onSave={handleMeetingSave}
          onDelete={handleMeetingDelete}
          onClose={() => setShowMeetingForm(false)}
        />
      )}

      {selectedMeeting && (
        <MeetingDetailsModal
          open={isMeetingModalOpen}
          meetingData={selectedMeeting}
          users={users}
          onDelete={handleMeetingDelete}
          onClose={handleCloseMeetingModal}
        />
      )}
    </div>
  );
};

export default VendorMeetingsTable;
