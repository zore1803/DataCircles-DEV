import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import API from "../../services/api";
import { formatNumberToIndian } from "../../utils/numberFormatter"; // Adjust path if needed
import toast, { Toaster } from "react-hot-toast";
import {
  User,
  Building2,
  Calendar,
  IndianRupeeIcon,
  ExternalLink,
  Clock,
  Check,
  ChevronDown,
  LayoutGrid,
  Eye,
  EyeOff,
  FolderOpen,
  Activity
} from "lucide-react";

// --- Info Card Component ---
const InfoCard = ({ title, value, icon: Icon, action, description }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <div className="bg-blue-50 p-2 rounded-lg">
          <Icon className="w-4 h-4 text-blue-600" />
        </div>
        <span className="text-sm font-medium text-gray-600">{title}</span>
      </div>
      {action}
    </div>
    <div className="mb-1">
      <p className="text-lg font-bold text-gray-900 truncate">{value || "—"}</p>
    </div>
    {description && <p className="text-xs text-gray-500 truncate">{description}</p>}
  </div>
);

const BasicDetails = ({ deal, dealFieldList = [] }) => {
  const [showEmptyFields, setShowEmptyFields] = useState(false);
  const [isOwnerDropdownOpen, setIsOwnerDropdownOpen] = useState(false);
  const [searchOwnerQuery, setSearchOwnerQuery] = useState("");
  const [availableUsers, setAvailableUsers] = useState([]);

  const currentUserStr = localStorage.getItem("user");
  const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;

  const hasEditPermission = () => {
    if (currentUser?.role === 'admin') return true;
    return currentUser?.permissions?.some(
      (p) => p.name.toLowerCase() === 'deals' && p.permission === 'read-write'
    );
  };

  useEffect(() => {
    const fetchTeamUsers = async () => {
      if (!hasEditPermission()) return;
      try {
        const response = await API.get("/auth/all-user");
        setAvailableUsers(response.data.allUsers || []);
      } catch (error) {
        console.error("Unable to load team list:", error);
      }
    };
    fetchTeamUsers();
  }, []);

  const handleOwnerChange = async (newOwnerId) => {
    if (!hasEditPermission()) return;

    if (deal.user?._id === newOwnerId) {
      setIsOwnerDropdownOpen(false);
      return;
    }

    try {
      await API.put(`/deals/${deal._id}`, { user: newOwnerId });
      toast.success("Owner reassigned successfully.");
      setIsOwnerDropdownOpen(false);
      window.location.reload(); 
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Failed to update owner.");
      }
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short', day: '2-digit', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true
    });
  };

  // --- PREMIUM CUSTOM FIELDS LOGIC ---
  const isEmpty = (value) => {
    if (value === null || value === undefined || value === "") return true;
    if (typeof value === "string" && value.trim() === "") return true;
    if (Array.isArray(value) && value.length === 0) return true;
    return false;
  };

  const getMergedAdditionalFields = () => {
    if (!dealFieldList || dealFieldList.length === 0) {
      return (deal.additionalFields || []).map(f => ({ ...f, category: "Uncategorized" }));
    }

    const existingValuesMap = new Map();
    if (deal.additionalFields && deal.additionalFields.length > 0) {
      deal.additionalFields.forEach((field) => {
        existingValuesMap.set(field.key, field.value);
      });
    }

    return dealFieldList.map((templateField) => {
      const value = existingValuesMap.get(templateField.name);
      return {
        key: templateField.name,
        value: value !== undefined ? value : null,
        type: templateField.type,
        options: templateField.options,
        required: templateField.required,
        category: templateField.category || "Uncategorized",
      };
    });
  };

  const getVisibleAdditionalFields = () => {
    const mergedFields = getMergedAdditionalFields();
    if (!showEmptyFields) return mergedFields.filter((field) => !isEmpty(field.value));
    return mergedFields;
  };

  const renderAdditionalFieldValue = (field) => {
    if (isEmpty(field.value)) return <span className="text-gray-400 italic font-normal">Not available</span>;

    // Type Normalizer
    const typeStr = (field.type || "").toLowerCase();
    let normalizedType = "string";

    if (typeStr.includes("multi-line") || typeStr === "text") normalizedType = "text";
    else if (typeStr.includes("number")) normalizedType = "number";
    else if (typeStr.includes("dropdown")) normalizedType = "dropdown";
    else if (typeStr.includes("url")) normalizedType = "url";
    else if (typeStr.includes("date")) normalizedType = "date";
    else if (typeStr.includes("multi-select") || typeStr.includes("checkbox") || typeStr === "multiselect") normalizedType = "multiselect";

    switch (normalizedType) {
      case "url":
        const url = field.value.startsWith("http") ? field.value : `https://${field.value}`;
        return <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-words font-medium">{field.value}</a>;
      case "date":
        try { return <span className="text-gray-900 font-medium">{new Date(field.value).toLocaleDateString()}</span>; }
        catch { return <span className="text-gray-900 font-medium break-words">{field.value}</span>; }
      case "multiselect":
        if (Array.isArray(field.value)) {
          return (
            <div className="flex flex-wrap gap-1.5">
              {field.value.map((item, idx) => (
                <span key={idx} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">{item}</span>
              ))}
            </div>
          );
        }
        return <span className="text-gray-900 font-medium break-words">{field.value}</span>;
      case "number":
        return <span className="text-gray-900 font-medium">{Number(field.value).toLocaleString()}</span>;
      default:
        return <span className="text-gray-900 font-medium break-words">{field.value}</span>;
    }
  };

  const visibleAdditionalFields = getVisibleAdditionalFields();
  const groupedFields = Object.entries(
    visibleAdditionalFields.reduce((acc, field) => {
      const cat = field.category || "Uncategorized";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(field);
      return acc;
    }, {})
  ).sort(([catA], [catB]) => {
    if (catA === "Uncategorized") return 1;
    if (catB === "Uncategorized") return -1;
    return catA.localeCompare(catB);
  });

  return (
    <div className="space-y-6">
      <Toaster position="top-right" toastOptions={{ style: { zIndex: 99999 } }} />

      {/* --- ACTION BAR (OWNER & AUDIT) --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-xl border border-gray-200 relative z-50 hover:shadow-sm transition-shadow">
        {/* Owner Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-500">Owner:</span>
          <div className="relative">
            <button
              onClick={() => hasEditPermission() && setIsOwnerDropdownOpen(!isOwnerDropdownOpen)}
              className={`flex items-center gap-1.5 px-2 py-1 -ml-2 rounded text-sm font-bold transition-colors ${hasEditPermission() ? 'text-gray-900 hover:bg-gray-50 cursor-pointer' : 'text-gray-900 cursor-default'}`}
              disabled={!hasEditPermission()}
            >
              {deal.user?.name || "Unassigned"}
              {hasEditPermission() && <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            {isOwnerDropdownOpen && hasEditPermission() && (
              <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-xl z-50">
                <div className="p-3 border-b border-gray-100 flex justify-between items-center">
                  <h4 className="text-xs font-semibold text-gray-700">Assign Owner</h4>
                  <button onClick={() => setIsOwnerDropdownOpen(false)} className="text-xs text-gray-500 border border-gray-200 px-2 py-1 rounded hover:bg-gray-50">Close</button>
                </div>
                <div className="p-2">
                  <input type="text" placeholder="Search..." className="w-full text-sm border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:border-blue-500 mb-2" value={searchOwnerQuery} onChange={(e) => setSearchOwnerQuery(e.target.value)} />
                  <div className="max-h-48 overflow-y-auto">
                    <button onClick={() => handleOwnerChange(null)} className="w-full text-left flex items-center gap-3 p-2 hover:bg-gray-50 rounded text-sm">
                      <div className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-medium">N</div>
                      <span className="text-gray-700">None</span>
                      {!deal.user && <Check className="w-4 h-4 text-green-600 ml-auto" />}
                    </button>
                    {availableUsers.filter(u => u.name?.toLowerCase().includes(searchOwnerQuery.toLowerCase())).map((mappedUser) => (
                      <button key={mappedUser._id} onClick={() => handleOwnerChange(mappedUser._id)} className="w-full text-left flex items-center gap-3 p-2 hover:bg-gray-50 rounded text-sm">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-medium text-xs">{mappedUser.name?.[0]?.toUpperCase()}</div>
                        <div className="flex flex-col">
                          <span className="text-gray-900 font-medium">{mappedUser.name}</span>
                          <span className="text-gray-500 text-xs">{mappedUser.email}</span>
                        </div>
                        {deal.user?._id === mappedUser._id && <Check className="w-4 h-4 text-green-600 ml-auto" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Audit Timestamps */}
        <div className="flex flex-col text-xs text-right mt-4 md:mt-0 relative group/audit cursor-default">
          <div className="flex items-center justify-end gap-1.5 text-gray-500">
            <Clock className="w-3.5 h-3.5" />
            <span>Updated: {formatDateTime(deal.updatedAt)}</span>
          </div>
          <div className="text-gray-400">by: <span className="font-medium text-gray-600">{deal.lastUpdatedBy?.name || 'Unknown'}</span></div>
          <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 p-4 rounded-xl shadow-xl opacity-0 group-hover/audit:opacity-100 transition-opacity pointer-events-none z-40 min-w-[250px] text-left">
            <div className="mb-3">
              <div className="flex justify-between items-center text-gray-600 mb-1"><span>Update On:</span><span className="font-medium">{formatDateTime(deal.updatedAt)}</span></div>
              <div className="flex justify-between items-center text-gray-600"><span>Updated by:</span><span className="font-medium text-gray-900">{deal.lastUpdatedBy?.name || 'Unknown'}</span></div>
            </div>
            <div className="border-t border-gray-200 my-3"></div>
            <div>
              <div className="flex justify-between items-center text-gray-600 mb-1"><span>Added on:</span><span className="font-medium">{formatDateTime(deal.createdAt)}</span></div>
              <div className="flex justify-between items-center text-gray-600"><span>Added by:</span><span className="font-medium text-gray-900">{deal.createdBy?.name || 'Unknown'}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* --- BUILT-IN SYSTEM FIELDS --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Amount */}
        <InfoCard 
          title="Amount" 
          value={`₹${formatNumberToIndian(deal.amount || 0)}`} 
          icon={IndianRupeeIcon} 
        />
        {/* Status */}
        <InfoCard 
          title="Status" 
          value={<span className="capitalize">{deal.status || 'Open'}</span>} 
          icon={Activity} 
        />
        {/* Company */}
        <InfoCard 
          title="Company" 
          value={deal.company?.name || "No company"} 
          icon={Building2} 
          action={deal.company && (<Link to={`/companies/${deal.company._id}`} className="text-gray-400 hover:text-blue-600"><ExternalLink className="w-4 h-4" /></Link>)} 
        />
        {/* Contact */}
        <InfoCard 
          title="Contact Person" 
          value={deal.contact?.name || "No contact"} 
          icon={User} 
        />
      </div>

      {/* --- PREMIUM CUSTOM FIELDS RENDERER --- */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-blue-600" />
            Additional Information
          </h2>

          <button
            onClick={() => setShowEmptyFields(!showEmptyFields)}
            className="flex items-center gap-2 text-xs font-semibold text-gray-600 hover:text-blue-600 px-3 py-1.5 border border-gray-200 rounded-md hover:bg-blue-50 hover:border-blue-200 transition-colors shadow-sm bg-white"
          >
            {showEmptyFields ? (
              <><EyeOff className="w-3.5 h-3.5" /> Hide Empty Fields</>
            ) : (
              <><Eye className="w-3.5 h-3.5" /> Show All Fields</>
            )}
          </button>
        </div>

        <div className="space-y-5">
          {groupedFields.map(([categoryName, categoryFields]) => (
            <div key={categoryName} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-gray-50/80 px-5 py-3 border-b border-gray-200 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-gray-800 tracking-wide uppercase">{categoryName}</h3>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                  {categoryFields.map((field, idx) => (
                    <div key={`additional-${idx}`} className="flex flex-col sm:flex-row sm:items-start sm:gap-4 border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                      <span className="text-gray-500 font-medium w-40 flex-shrink-0 mb-1 sm:mb-0">
                        {field.key}
                        {field.required && <span className="text-red-500 ml-1" title="Required">*</span>}
                      </span>
                      <div className="flex-1 min-w-0">
                        {renderAdditionalFieldValue(field)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {groupedFields.length === 0 && (
            <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-400 text-sm italic mt-4">
              {!showEmptyFields
                ? 'No populated custom fields available. Click "Show All Fields" above.'
                : 'No custom fields have been configured in Settings yet.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BasicDetails;