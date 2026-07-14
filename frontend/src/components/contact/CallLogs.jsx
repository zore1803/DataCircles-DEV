import React, { useEffect, useState } from "react";
import API from "../../services/api";
import { 
  Phone, 
  Clock, 
  User, 
  MessageSquare, 
  Edit2, 
  Trash2, 
  PhoneOutgoing, 
  PhoneIncoming,
  Search,
  Plus,
  ChevronDown
} from "lucide-react";
import CallLogForm from "./CallLogForm";
import CallLogDetailView from "./CallLogDetailView";
import toast, { Toaster } from 'react-hot-toast';

const callTypeOptions = [
  { value: "Outbound", label: "Outbound", icon: PhoneOutgoing },
  { value: "Inbound", label: "Inbound", icon: PhoneIncoming },
];

const statusOptions = [
  { 
    value: "Connected", 
    label: "Connected", 
    color: "bg-gray-100 text-gray-800", 
    allowDuration: true 
  },
  { 
    value: "Missed", 
    label: "Missed", 
    color: "bg-gray-200 text-gray-700", 
    allowDuration: false 
  },
  { 
    value: "Voicemail", 
    label: "Voicemail", 
    color: "bg-gray-100 text-gray-800", 
    allowDuration: true 
  },
  { 
    value: "No Answer", 
    label: "No Answer", 
    color: "bg-gray-200 text-gray-700", 
    allowDuration: false 
  },
];

const CallLogs = ({ contactId }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editLog, setEditLog] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const user = JSON.parse(localStorage.getItem("user"));

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await API.get(`/call-logs/contact/${contactId}`);
      setLogs(res.data);
    } catch (err) {
      toast.error('Failed to fetch call logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [contactId]);

  // Filter and sort logs
  const filteredLogs = logs
    .filter(log => {
      const matchesSearch = log.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           log.user?.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || log.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === "newest") return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === "oldest") return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === "duration") return (b.duration || 0) - (a.duration || 0);
      return 0;
    });

  const handleDelete = async (id) => {
    if (window.confirm('Delete this call log?')) {
      try {
        await API.delete(`/call-logs/${id}`);
        fetchLogs();
        toast.success('Call log deleted');
      } catch (err) {
        if (err.response?.status === 402) {
          toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
        } else {
          toast.error(err.response?.data?.error || 'Failed to delete call log.');
        }
      }
    }
  };

  const handleEdit = (log) => {
    setEditLog(log);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditLog(null);
  };

  const formatDuration = (seconds) => {
    if (!seconds) return "—";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const getStatusConfig = (status) => {
    return statusOptions.find((s) => s.value === status) || statusOptions[0];
  };

  const getCallTypeIcon = (type) => {
    const typeConfig = callTypeOptions.find((t) => t.value === type);
    return typeConfig ? typeConfig.icon : Phone;
  };

  const formatRelativeTime = (date) => {
    const now = new Date();
    const callDate = new Date(date);
    const diffInHours = Math.abs(now - callDate) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return callDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      });
    } else if (diffInHours < 168) {
      return callDate.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return callDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  return (
    <div className="h-full">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Phone className="w-4 h-4" />
          <span>{filteredLogs.length} calls</span>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Call
        </button>
      </div>

      {/* Filters */}
      <div className="space-y-2 mb-4">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-gray-400"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full appearance-none px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-gray-400 bg-white pr-8"
            >
              <option value="all">All Status</option>
              {statusOptions.map(status => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full appearance-none px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-gray-400 bg-white pr-8"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="duration">Duration</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Call Log Form */}
      {showForm && (
        <CallLogForm
          contactId={contactId}
          editLog={editLog}
          isOpen={showForm}
          onClose={handleCloseForm}
          fetchLogs={fetchLogs}
          userId={user.id}
        />
      )}

      {/* Call Log Detail View */}
      {selectedLog && (
        <CallLogDetailView
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}

      {/* Call Logs List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-3"></div>
          <p className="text-sm text-gray-600">Loading...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <Phone className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600 mb-4">
            {logs.length === 0 ? 'No call logs yet' : 'No matching calls'}
          </p>
          {logs.length === 0 && (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm transition-colors"
            >
              Add First Call
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => {
            const CallIcon = getCallTypeIcon(log.callType);
            const statusConfig = getStatusConfig(log.status);
            
            return (
              <div 
                key={log._id} 
                className="bg-white rounded-lg border border-gray-200 p-3 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
                onClick={() => setSelectedLog(log)}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-gray-100">
                      <CallIcon className="w-3 h-3 text-gray-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">
                        {log.callType}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {formatRelativeTime(log.createdAt)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(log);
                      }}
                      className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(log._id);
                      }}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${statusConfig.color}`}>
                      {log.status}
                    </span>
                    <div className="flex items-center text-xs text-gray-600">
                      <Clock className="w-3 h-3 mr-1" />
                      {statusConfig.allowDuration ? formatDuration(log.duration) : "—"}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <User className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-700">
                      {log.user?.name || "Unknown"}
                    </span>
                  </div>
{/* 
                  {log.notes && (
                    <div className="bg-gray-50 rounded p-2">
                      <div className="flex items-start gap-1.5">
                        <MessageSquare className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                        <p
                          className="text-xs text-gray-700 line-clamp-2 prose prose-xs max-w-none"
                          dangerouslySetInnerHTML={{ __html: log.notes || '' }}
                        />
                      </div>
                    </div>
                  )} */}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CallLogs;
