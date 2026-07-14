// components/AllMeetings.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FiSearch, FiFilter, FiDownload, FiX } from "react-icons/fi";
import { Plus, Edit2, Trash2 } from "lucide-react";
import jsPDF from "jspdf";
import { autoTable } from "jspdf-autotable";
import API from "../services/api";
import toast from "react-hot-toast";
import MeetingDetailsModal from "../components/company/MeetingDetailsModal";

const formatDateTime = (isoDate) => {
  const date = new Date(isoDate);
  return (
    date.toLocaleDateString() +
    " " +
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
};

const formatDateForDisplay = (isoDate) => {
  return new Date(isoDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const AllMeetings = () => {
  const [meetings, setMeetings] = useState([]);
  const [userMap, setUserMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Modal states
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [users, setUsers] = useState([]);

  const navigate = useNavigate();

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [meetingsRes, usersRes] = await Promise.all([
        API.get("/meetings/all-meetings"),
        API.get("/auth/all-user"),
      ]);

      setMeetings(meetingsRes.data);

      const allUsers = usersRes.data.allUsers;
      const userObj = {};
      allUsers.forEach((u) => {
        userObj[u._id] = u.name;
      });
      setUserMap(userObj);
      setUsers(allUsers);
    } catch (err) {
      setError("Failed to load meetings");
      console.error("Error fetching meetings:", err);
      toast.error(err.response?.data?.error || "Failed to load meetings");
    } finally {
      setLoading(false);
    }
  };

  const getMeetingStatusBadge = (status) => {
    const statusClasses = {
      scheduled: "bg-blue-100 text-blue-700",
      completed: "bg-green-100 text-green-700",
      cancelled: "bg-red-100 text-red-700",
      "no-show": "bg-orange-100 text-orange-700",
    };
    return statusClasses[status] || "bg-gray-100 text-gray-700";
  };

  const getPriorityBadge = (priority) => {
    const priorityClasses = {
      high: "bg-red-100 text-red-700",
      medium: "bg-yellow-100 text-yellow-700",
      low: "bg-green-100 text-green-700",
    };
    return priorityClasses[priority] || "bg-gray-100 text-gray-700";
  };

  // Filter and search logic
  const filteredMeetings = useMemo(() => {
    return meetings.filter((meeting) => {
      const matchesSearch =
        meeting.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (meeting.description &&
          meeting.description
            .toLowerCase()
            .includes(searchTerm.toLowerCase())) ||
        (meeting.assignedTo &&
          userMap[meeting.assignedTo] &&
          userMap[meeting.assignedTo]
            .toLowerCase()
            .includes(searchTerm.toLowerCase()));

      const matchesStatus = !statusFilter || meeting.status === statusFilter;
      const matchesPriority =
        !priorityFilter || meeting.priority === priorityFilter;
      const matchesType = !typeFilter || meeting.meetingType === typeFilter;
      const matchesUser = !userFilter || meeting.assignedTo === userFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesType &&
        matchesUser
      );
    });
  }, [
    meetings,
    searchTerm,
    statusFilter,
    priorityFilter,
    typeFilter,
    userFilter,
    userMap,
  ]);

  // Pagination logic
  const totalPages = Math.ceil(filteredMeetings.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedMeetings = filteredMeetings.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  // Export to PDF function
  const exportToPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text("All Meetings Report", 14, 22);

    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 32);
    doc.text(`Total Meetings: ${filteredMeetings.length}`, 14, 38);

    const tableData = filteredMeetings.map((meeting) => [
      meeting.title,
      meeting.description || "No description",
      formatDateTime(meeting.scheduledAt),
      `${meeting.duration} min`,
      meeting.contact || meeting.vendor || meeting.company
        ? meeting.contact?.name ||
        meeting.vendor?.name ||
        meeting.participants[0].name ||
        "Unknown"
        : "N/A",
      (meeting.priority || "medium").charAt(0).toUpperCase() +
      (meeting.priority || "medium").slice(1),
      meeting.status.charAt(0).toUpperCase() + meeting.status.slice(1),
      (meeting.meetingType?.replace("-", " ") || "in-person")
        .charAt(0)
        .toUpperCase() +
      (meeting.meetingType?.replace("-", " ") || "in-person").slice(1),
    ]);

    autoTable(doc, {
      head: [
        [
          "Title",
          "Description",
          "Scheduled At",
          "Duration",
          "Assigned To",
          "Priority",
          "Status",
          "Type",
        ],
      ],
      body: tableData,
      startY: 45,
      styles: {
        fontSize: 7,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 30 },
        2: { cellWidth: 25 },
        3: { cellWidth: 15 },
        4: { cellWidth: 20 },
        5: { cellWidth: 15 },
        6: { cellWidth: 15 },
        7: { cellWidth: 20 },
      },
    });

    doc.save(`meetings-report-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("");
    setPriorityFilter("");
    setTypeFilter("");
    setUserFilter("");
    setCurrentPage(1);
  };

  // Get unique values for filters
  const uniqueStatuses = [
    ...new Set(meetings.map((meeting) => meeting.status)),
  ];
  const uniquePriorities = [
    ...new Set(meetings.map((meeting) => meeting.priority).filter(Boolean)),
  ];
  const uniqueTypes = [
    ...new Set(meetings.map((meeting) => meeting.meetingType).filter(Boolean)),
  ];
  const uniqueUsers = [
    ...new Set(meetings.map((meeting) => meeting.assignedTo).filter(Boolean)),
  ];

  // Meeting modal handlers
  const handleMeetingClick = (meeting, e) => {
    // Prevent opening modal when clicking on action buttons
    if (e.target.closest("button") || e.target.closest("select")) {
      return;
    }
    setSelectedMeeting(meeting);
    setIsMeetingModalOpen(true);
  };

  const handleCloseMeetingModal = () => {
    setIsMeetingModalOpen(false);
    setSelectedMeeting(null);
  };

  const handleDeleteFromModal = async (meetingId) => {
    try {
      await API.delete(`/meetings/${meetingId}`);
      await fetchAllData();
      handleCloseMeetingModal();
      toast.success("Meeting deleted successfully");
    } catch (error) {
      console.error("Error deleting meeting:", error);
      if (error.response?.status === 402) {
        toast.error(error.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(error.response?.data?.error || "Failed to delete meeting");
      }
      throw error;
    }
  };

  const handleDelete = async (meetingId, e) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this meeting?")) {
      try {
        await API.delete(`/meetings/${meetingId}`);
        await fetchAllData();
        toast.success("Meeting deleted successfully");
      } catch (error) {
        console.error("Error deleting meeting:", error);
        if (error.response?.status === 402) {
          toast.error(error.response?.data?.message || "An active subscription is required to make changes.");
        } else {
          toast.error(error.response?.data?.error || "Failed to delete meeting");
        }
      }
    }
  };

  if (loading && meetings.length === 0) {
    return (
      <div className="w-[90%] mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="bg-white rounded-xl shadow-lg border border-gray-200/50 p-6">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-[90%] mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <div className="text-red-600 text-lg font-medium mb-2">
            Error Loading Meetings
          </div>
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-bold text-3xl text-slate-900">All Meetings</h1>
        <div className="flex items-center space-x-3">
          <button
            onClick={exportToPDF}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 flex items-center space-x-2"
          >
            <FiDownload className="w-4 h-4" />
            <span>Export PDF</span>
          </button>
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors duration-200"
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200/50 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search meetings..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full bg-gradient-to-r from-white to-blue-100 border border-[#E0E0E1] rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center space-x-2"
          >
            <FiFilter className="w-4 h-4" />
            <span>Filters</span>
          </button>

          {/* Clear Filters */}
          {(searchTerm ||
            statusFilter ||
            priorityFilter ||
            typeFilter ||
            userFilter) && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 flex items-center space-x-2"
              >
                <FiX className="w-4 h-4" />
                <span>Clear</span>
              </button>
            )}
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Statuses</option>
                {uniqueStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Priorities</option>
                {uniquePriorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority.charAt(0).toUpperCase() + priority.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Types</option>
                {uniqueTypes.map((type) => (
                  <option key={type} value={type}>
                    {type.replace("-", " ").charAt(0).toUpperCase() +
                      type.replace("-", " ").slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* User Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assigned To
              </label>
              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Users</option>
                {uniqueUsers.map((userId) => (
                  <option key={userId} value={userId}>
                    {userMap[userId] || "Unknown"}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-600">
          Showing {startIndex + 1} to{" "}
          {Math.min(startIndex + itemsPerPage, filteredMeetings.length)} of{" "}
          {filteredMeetings.length} meetings
        </p>
      </div>

      {/* Meetings Table */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200/50 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200/50">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Meetings</h2>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
              {filteredMeetings.length}{" "}
              {filteredMeetings.length === 1 ? "Meeting" : "Meetings"}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">Meeting Title</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4">Scheduled At</th>
                <th className="px-6 py-4">Duration</th>
                <th className="px-6 py-4">Assigned To</th>
                <th className="px-6 py-4">Priority</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm text-slate-700">
              {paginatedMeetings.length === 0 ? (
                <tr>
                  <td
                    colSpan="9"
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    No meetings found matching your criteria
                  </td>
                </tr>
              ) : (
                paginatedMeetings.map((meeting) => (
                  <tr
                    key={meeting._id}
                    className="hover:bg-slate-50/50 transition-colors duration-200 cursor-pointer"
                    onClick={(e) => handleMeetingClick(meeting, e)}
                  >
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {meeting.title}
                    </td>
                    <td className="px-6 py-4 text-slate-600 max-w-xs">
                      <div className="truncate">
                        {meeting.description || "No description"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-blue-600 font-medium">
                      {formatDateTime(meeting.scheduledAt)}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {meeting.duration} min
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {meeting.contact || meeting.vendor || meeting.company
                        ? meeting.contact?.name ||
                        meeting.vendor?.name ||
                        meeting.participants[0]?.name ||
                        "Unknown"
                        : "N/A"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${getPriorityBadge(
                          meeting.priority
                        )}`}
                      >
                        {meeting.priority || "medium"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${getMeetingStatusBadge(
                          meeting.status
                        )}`}
                      >
                        {meeting.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium capitalize">
                        {meeting.meetingType?.replace("-", " ") || "in-person"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handleDelete(meeting._id, e)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200/50 flex items-center justify-between">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            <div className="flex items-center space-x-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-2 text-sm rounded-lg ${page === currentPage
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                  >
                    {page}
                  </button>
                )
              )}
            </div>

            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(prev + 1, totalPages))
              }
              disabled={currentPage === totalPages}
              className="px-3 py-2 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Meeting Details Modal */}
      {selectedMeeting && (
        <MeetingDetailsModal
          open={isMeetingModalOpen}
          meetingData={selectedMeeting}
          users={users}
          onDelete={handleDeleteFromModal}
          onClose={handleCloseMeetingModal}
        />
      )}
    </div>
  );
};

export default AllMeetings;
