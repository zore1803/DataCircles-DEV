// components/AllTasks.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FiSearch, FiFilter, FiDownload, FiX } from "react-icons/fi";
import { Plus, Edit2, Trash2, Pin } from "lucide-react";
import jsPDF from "jspdf";
import { autoTable } from "jspdf-autotable";
import API from "../services/api";
import TaskForm from "../components/Task/TaskForm";
import TaskDetailsModal from "../components/Task/TaskDetailsModal";
import toast from "react-hot-toast";

const formatDate = (isoDate) => {
  return new Date(isoDate).toISOString().split("T")[0];
};

const formatDateForDisplay = (isoDate) => {
  return new Date(isoDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const AllTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [userMap, setUserMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Task form and modal states
  const [showForm, setShowForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    status: "Pending",
    relatedTo: "",
    relationModel: "Company",
    users: []
  });

  // Related data for form
  const [companies, setCompanies] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [users, setUsers] = useState([]);

  const navigate = useNavigate();

  //Pinning rows
  const [pinnedIds, setPinnedIds] = useState(() => {
    const saved = localStorage.getItem("pinned_companies");
    return saved ? JSON.parse(saved) : [];
  });

  // Sync pins to local storage so they persist on refresh
  useEffect(() => {
    localStorage.setItem("pinned_companies", JSON.stringify(pinnedIds));
  }, [pinnedIds]);

  //function to toggle pinning
  const togglePin = (e, companyId) => {
    e.stopPropagation(); // Prevents triggering row selection or navigation
    setPinnedIds((prev) =>
      prev.includes(companyId)
        ? prev.filter((id) => id !== companyId) // Unpin
        : [companyId, ...prev] // Pin (adds to start of list)
    );
    toast.success(pinnedIds.includes(companyId) ? "Unpinned" : "Pinned to top");
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [tasksRes, usersRes, companiesRes, contactsRes, dealsRes, vendorsRes] = await Promise.all([
        API.get('/tasks/admin'),
        API.get("/auth/all-user"),
        API.get("/companies"),
        API.get("/contacts"),
        API.get("/deals"),
        API.get("/vendors")
      ]);

      setTasks(tasksRes.data);

      const allUsers = usersRes.data.allUsers;
      const userObj = {};
      allUsers.forEach((u) => {
        userObj[u._id] = u.name;
      });
      setUserMap(userObj);
      setUsers(allUsers);

      setCompanies(companiesRes.data);
      setContacts(contactsRes.data);
      setDeals(dealsRes.data);
      setVendors(vendorsRes.data);
    } catch (err) {
      setError('Failed to load tasks');
      console.error('Error fetching tasks:', err);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const getTaskStatusBadge = (status) => {
    const statusClasses = {
      "To Do": "bg-yellow-100 text-yellow-700",
      "Pending": "bg-yellow-100 text-yellow-700",
      "In Progress": "bg-blue-100 text-blue-700",
      "Completed": "bg-green-100 text-green-700",
      "Cancelled": "bg-red-100 text-red-700"
    };
    return statusClasses[status] || "bg-gray-100 text-gray-700";
  };

  // Filter and search logic
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch =
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (userMap[task.user] && userMap[task.user].toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = !statusFilter || task.status === statusFilter;
      const matchesUser = !userFilter || task.user === userFilter;
      const matchesDate = !dateFilter || formatDate(task.dueDate) === dateFilter;

      return matchesSearch && matchesStatus && matchesUser && matchesDate;
    });
  }, [tasks, searchTerm, statusFilter, userFilter, dateFilter, userMap]);

  // Pagination logic
  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTasks = filteredTasks.slice(startIndex, startIndex + itemsPerPage);

  // Export to PDF function
  const exportToPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text('All Tasks Report', 14, 22);

    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 32);
    doc.text(`Total Tasks: ${filteredTasks.length}`, 14, 38);

    const tableData = filteredTasks.map(task => [
      task.title,
      task.description || 'No description',
      formatDateForDisplay(task.dueDate),
      userMap[task.users[0]._id] || "-",
      task.status === "Pending" ? "To Do" : task.status,
      formatDateForDisplay(task.createdAt)
    ]);

    autoTable(doc, {
      head: [['Title', 'Description', 'Due Date', 'Assigned To', 'Status', 'Created At']],
      body: tableData,
      startY: 45,
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [139, 69, 19],
        textColor: 255,
      },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 40 },
        2: { cellWidth: 25 },
        3: { cellWidth: 25 },
        4: { cellWidth: 20 },
        5: { cellWidth: 25 },
      },
    });

    doc.save(`tasks-report-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("");
    setUserFilter("");
    setDateFilter("");
    setCurrentPage(1);
  };

  // Get unique values for filters
  const uniqueStatuses = [...new Set(tasks.map(task => task.status))];
  const uniqueUsers = [...new Set(tasks.map(task => task.users[0]._id))];

  // Task click handler - open details modal
  const handleTaskClick = (task, e) => {
    // Prevent opening modal when clicking on action buttons
    if (e.target.closest('button') || e.target.closest('select')) {
      return;
    }
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  const handleCloseTaskModal = () => {
    setIsTaskModalOpen(false);
    setSelectedTask(null);
  };

  const handleDeleteFromModal = async (taskId) => {
    try {
      await API.delete(`/tasks/${taskId}`);
      await fetchAllData();
      handleCloseTaskModal();
      toast.success("Task deleted successfully");
    } catch (error) {
      console.error("Error deleting task:", error);
      throw error;
    }
  };

  // Task form handlers
  const toggleForm = () => {
    if (showForm) {
      resetForm();
    }
    setShowForm(!showForm);
  };

  const resetForm = () => {
    setForm({
      title: "",
      description: "",
      dueDate: "",
      status: "Pending",
      relatedTo: "",
      relationModel: "Company",
      users: []
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Task title is required");
      return;
    }

    try {
      setLoading(true);
      if (form._id) {
        await API.put(`/tasks/${form._id}`, form);
        toast.success("Task updated successfully");
      } else {
        await API.post("/tasks", form);
        toast.success("Task created successfully");
      }
      await fetchAllData();
      setShowForm(false);
      resetForm();
    } catch (error) {
      console.error("Error saving task:", error);
      if (error.response?.status === 402) {
        toast.error(error.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(error.response?.data?.message || "Failed to save task");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (task, e) => {
    e.stopPropagation();

    // Fetch related entity if needed
    if (task.relatedTo?._id && task.relationModel) {
      const isEntityInList = (list, id) => list.some(item => item._id === id);

      if (task.relationModel === "Company" && !isEntityInList(companies, task.relatedTo._id)) {
        try {
          const response = await API.get(`/companies/${task.relatedTo._id}`);
          setCompanies([...companies, response.data]);
        } catch (error) {
          console.error("Failed to fetch company", error);
        }
      } else if (task.relationModel === "Contact" && !isEntityInList(contacts, task.relatedTo._id)) {
        try {
          const response = await API.get(`/contacts/${task.relatedTo._id}`);
          setContacts([...contacts, response.data]);
        } catch (error) {
          console.error("Failed to fetch contact", error);
        }
      } else if (task.relationModel === "Deal" && !isEntityInList(deals, task.relatedTo._id)) {
        try {
          const response = await API.get(`/deals/${task.relatedTo._id}`);
          setDeals([...deals, response.data]);
        } catch (error) {
          console.error("Failed to fetch deal", error);
        }
      } else if (task.relationModel === "Vendor" && !isEntityInList(vendors, task.relatedTo._id)) {
        try {
          const response = await API.get(`/vendors/${task.relatedTo._id}`);
          setVendors([...vendors, response.data]);
        } catch (error) {
          console.error("Failed to fetch vendor", error);
        }
      }
    }

    setForm({
      _id: task._id,
      title: task.title || "",
      description: task.description || "",
      dueDate: task.dueDate?.substring(0, 10) || "",
      status: task.status || "Pending",
      relatedTo: task.relatedTo?._id || task.relatedTo || "",
      relationModel: task.relationModel || "Company",
      users: Array.isArray(task.users) ? task.users.map(user => user._id || user) : []
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (taskId, e) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this task?")) {
      try {
        await API.delete(`/tasks/${taskId}`);
        await fetchAllData();
        toast.success("Task deleted successfully");
      } catch (error) {
        console.error("Error deleting task:", error);
        if (error.response?.status === 402) {
          toast.error(error.response?.data?.message || "An active subscription is required to make changes.");
        } else {
          toast.error(error.response?.data?.error || "Failed to delete task");
        }
      }
    }
  };

  const handleCancelEdit = () => {
    resetForm();
    setShowForm(false);
  };

  const getRelatedToName = (task) => {
    const map = {
      Company: companies,
      Contact: contacts,
      Deal: deals,
      Vendor: vendors,
    };
    const options = map[task.relationModel] || [];
    const relatedToId = task.relatedTo?._id || task.relatedTo;
    const related = options.find(item => item._id === relatedToId);
    return related ? (related.name || related.title || "N/A") : "N/A";
  };

  if (loading && tasks.length === 0) {
    return (
      <div className="w-[90%] mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="bg-white rounded-xl shadow-lg border border-gray-200/50 p-6">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
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
          <div className="text-red-600 text-lg font-medium mb-2">Error Loading Tasks</div>
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-bold text-3xl text-slate-900">All Tasks</h1>
        <div className="flex items-center space-x-3">
          <button
            onClick={toggleForm}
            className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>{showForm ? 'Cancel' : 'Add Task'}</span>
          </button>
          <button
            onClick={exportToPDF}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 flex items-center space-x-2"
          >
            <FiDownload className="w-4 h-4" />
            <span>Export PDF</span>
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors duration-200"
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      {/* Task Form */}
      {showForm && (
        <TaskForm
          form={form}
          setForm={setForm}
          companies={companies}
          contacts={contacts}
          deals={deals}
          vendors={vendors}
          users={users}
          loading={loading}
          onSubmit={handleSubmit}
          onCancel={form._id ? handleCancelEdit : toggleForm}
          fetchTasks={fetchAllData}
        />
      )}

      {/* Search and Filter Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200/50 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full bg-gradient-to-r from-white to-blue-100 border border-[#E0E0E1] rounded-lg outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
          {(searchTerm || statusFilter || userFilter || dateFilter) && (
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
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">All Statuses</option>
                {uniqueStatuses.map(status => (
                  <option key={status} value={status}>{status === "Pending" ? "To Do" : status}</option>
                ))}
              </select>
            </div>

            {/* User Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">All Users</option>
                {uniqueUsers.map(userId => (
                  <option key={userId} value={userId}>{userMap[userId] || 'admin'}</option>
                ))}
              </select>
            </div>

            {/* Date Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
        )}
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-600">
          Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredTasks.length)} of {filteredTasks.length} tasks
        </p>
      </div>

      {/* Tasks Table */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200/50 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 px-6 py-4 border-b border-gray-200/50">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Tasks</h2>
            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
              {filteredTasks.length} {filteredTasks.length === 1 ? 'Task' : 'Tasks'}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-semibold">
              <tr>
                <th className="px-4 py-4 w-10 text-center">
                  <Pin className="w-4 h-4 text-slate-400 mx-auto" />
                </th>
                <th className="px-6 py-4">Task Title</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4">Due Date</th>
                <th className="px-6 py-4">Assigned To</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Created At</th>
                {/* <th className="px-6 py-4">Actions</th> */}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm text-slate-700">
              {paginatedTasks.length === 0 ? (
                <tr>
                  {/* Updated colSpan to 8 because we added a column */}
                  <td colSpan="8" className="px-6 py-8 text-center text-slate-500">
                    No tasks found matching your criteria
                  </td>
                </tr>
              ) : (
                /* --- Local Sorting: Pinned items first on current page --- */
                paginatedTasks
                  .slice()
                  .sort((a, b) => {
                    const aPinned = pinnedIds.includes(a._id);
                    const bPinned = pinnedIds.includes(b._id);
                    return aPinned === bPinned ? 0 : aPinned ? -1 : 1;
                  })
                  .map((task) => {
                    const isPinned = pinnedIds.includes(task._id);

                    return (
                      <tr
                        key={task._id}
                        /* Add highlight for pinned rows */
                        className={`hover:bg-slate-50/50 transition-colors duration-200 cursor-pointer ${isPinned ? "bg-blue-50/40 border-l-2 border-blue-400" : ""
                          }`}
                        onClick={(e) => handleTaskClick(task, e)}
                      >
                        {/* 1. NEW Pin Cell */}
                        <td className="px-4 py-4 text-center">
                          <button
                            onClick={(e) => togglePin(e, task._id)}
                            className={`p-1.5 rounded-lg transition-all ${isPinned
                                ? "text-blue-500 bg-blue-100 shadow-sm"
                                : "text-slate-300 hover:text-slate-500 hover:bg-slate-100"
                              }`}
                            title={isPinned ? "Unpin" : "Pin to top"}
                          >
                            <Pin className={`w-4 h-4 ${isPinned ? "fill-current" : ""}`} />
                          </button>
                        </td>

                        <td className="px-6 py-4 font-medium text-slate-900">
                          {task.title}
                        </td>
                        <td className="px-6 py-4 text-slate-600 max-w-xs">
                          <div className="truncate line-clamp-1" dangerouslySetInnerHTML={{ __html: task.description || 'No description' }}>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-blue-600 font-medium">
                          {formatDateForDisplay(task.dueDate)}
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          {userMap[task.users[0]._id] || "-"}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getTaskStatusBadge(task.status)}`}>
                            {task.status === "Pending" ? "To Do" : task.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          {formatDateForDisplay(task.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => handleEdit(task, e)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => handleDelete(task._id, e)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200/50 flex items-center justify-between">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            <div className="flex items-center space-x-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-2 text-sm rounded-lg ${page === currentPage
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  {page}
                </button>
              ))}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Task Details Modal */}
      {selectedTask && (
        <TaskDetailsModal
          open={isTaskModalOpen}
          taskData={selectedTask}
          users={users}
          onDelete={handleDeleteFromModal}
          onClose={handleCloseTaskModal}
          getRelatedToName={getRelatedToName}
        />
      )}
    </div>
  );
};

export default AllTasks;
