import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import DealsTable from "./DealsTable";
import API from "../../services/api";
import toast from 'react-hot-toast';
import {
  X,
  ChevronDown,
  User,
  Building2,
  Mail,
  Phone,
  TrendingUp,
  ArrowRight,
  Edit3,
  CheckCircle2,
  XCircle,
  Target,
  Trophy,
  Check,
  Clock,
  FolderOpen,
  LayoutGrid,
  Info,
  Eye,
  EyeOff
} from "lucide-react";
import AppToaster from "../AppToaster";

// Lifecycle Stage Modal Component  
const LifecycleStageModal = ({ isOpen, onClose, contact, onUpdate }) => {
  const [selectedStage, setSelectedStage] = useState(contact.lifecycleStage || "Lead");
  const [selectedStatus, setSelectedStatus] = useState(contact.stageStatus || "New");
  const [isUpdating, setIsUpdating] = useState(false);

  const lifecycleStageOptions = {
    "Lead": ["New", "Contacted", "Interested", "Unqualified"],
    "Sales Qualified Lead": ["Qualified", "Lost"],
    "Customer": ["Won", "Churned"]
  };

  const allLifecycleStages = Object.keys(lifecycleStageOptions);

  const handleStageChange = (newStage) => {
    setSelectedStage(newStage);
    setSelectedStatus(lifecycleStageOptions[newStage][0]);
  };

  const handleSave = async () => {
    try {
      setIsUpdating(true);
      await API.put(`/contacts/${contact._id}/lifecycle-stage`, {
        lifecycleStage: selectedStage,
        stageStatus: selectedStatus
      });

      if (onUpdate) {
        onUpdate({
          ...contact,
          lifecycleStage: selectedStage,
          stageStatus: selectedStatus
        });
      }

      toast.success("Lifecycle stage updated!");
      onClose();
    } catch (error) {
      console.error("Failed to update lifecycle stage:", error);
      if (error.response?.status === 402) {
        toast.error(error.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(error.response?.data?.error || "Failed to update lifecycle stage");
      }
    } finally {
      setIsUpdating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-5 w-full max-w-md border border-gray-200">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Update Lifecycle Stage</h3>
            <p className="text-xs text-gray-600 mt-1">Manage contact progression</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Lifecycle Stage
            </label>
            <select
              value={selectedStage}
              onChange={(e) => handleStageChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white transition-all focus:outline-none focus:border-gray-400"
              disabled={isUpdating}
            >
              {allLifecycleStages.map((stage) => (
                <option key={stage} value={stage}>{stage}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white transition-all focus:outline-none focus:border-gray-400"
              disabled={isUpdating}
            >
              {lifecycleStageOptions[selectedStage]?.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 pt-5">
          <button
            onClick={onClose}
            disabled={isUpdating}
            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isUpdating}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isUpdating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Lifecycle Flow Component
const LifecycleStages = ({ contact, onContactUpdate }) => {
  const [showLifecycleModal, setShowLifecycleModal] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [pendingStageIndex, setPendingStageIndex] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const stageConfigs = [
    {
      key: 'New',
      label: 'New',
      bgColor: 'bg-blue-500',
      bgColorLight: 'bg-blue-50',
      textColor: 'text-white',
      textColorDark: 'text-blue-700',
      arrowBorderColor: 'border-l-blue-500',
      options: null,
    },
    {
      key: 'Contacted',
      label: 'Contacted',
      bgColor: 'bg-indigo-500',
      bgColorLight: 'bg-indigo-50',
      textColor: 'text-white',
      textColorDark: 'text-indigo-700',
      arrowBorderColor: 'border-l-indigo-500',
      options: null,
    },
    {
      key: 'Interested',
      label: 'Interested',
      bgColor: 'bg-purple-500',
      bgColorLight: 'bg-purple-50',
      textColor: 'text-white',
      textColorDark: 'text-purple-700',
      arrowBorderColor: 'border-l-purple-500',
      options: ['Interested', 'Unqualified'],
    },
    {
      key: 'Qualified',
      label: 'Qualified',
      bgColor: 'bg-yellow-500',
      bgColorLight: 'bg-yellow-50',
      textColor: 'text-white',
      textColorDark: 'text-yellow-700',
      arrowBorderColor: 'border-l-yellow-500',
      options: ['Qualified', 'Lost'],
    },
    {
      key: 'Won',
      label: 'Won/Churned',
      bgColor: 'bg-green-500',
      bgColorLight: 'bg-green-50',
      textColor: 'text-white',
      textColorDark: 'text-green-700',
      arrowBorderColor: 'border-l-green-500',
      options: ['Won', 'Churned'],
    }
  ];

  const getCurrentStageIndex = () => {
    const statusToIndex = {
      'New': 0,
      'Contacted': 1,
      'Interested': 2,
      'Unqualified': 2,
      'Qualified': 3,
      'Lost': 3,
      'Won': 4,
      'Churned': 4
    };
    return statusToIndex[contact.stageStatus] || 0;
  };

  const currentStageIndex = getCurrentStageIndex();

  const handleStageClick = async (stageIndex, option = null) => {
    if (isUpdating) return;

    if (stageConfigs[stageIndex].options && !option) {
      if (showStatusDropdown && pendingStageIndex === stageIndex) {
        setShowStatusDropdown(false);
        setPendingStageIndex(null);
      } else {
        setShowStatusDropdown(true);
        setPendingStageIndex(stageIndex);
      }
      return;
    }

    const targetStatus = option || stageConfigs[stageIndex].key;

    try {
      setIsUpdating(true);

      let lifecycleStage = contact.lifecycleStage;
      if (['New', 'Contacted', 'Interested', 'Unqualified'].includes(targetStatus)) {
        lifecycleStage = 'Lead';
      } else if (['Qualified', 'Lost'].includes(targetStatus)) {
        lifecycleStage = 'Sales Qualified Lead';
      } else if (['Won', 'Churned'].includes(targetStatus)) {
        lifecycleStage = 'Customer';
      }

      await API.put(`/contacts/${contact._id}/lifecycle-stage`, {
        lifecycleStage,
        stageStatus: targetStatus
      });

      if (onContactUpdate) {
        onContactUpdate({
          ...contact,
          lifecycleStage,
          stageStatus: targetStatus
        });
      }

      setShowStatusDropdown(false);
      setPendingStageIndex(null);
      toast.success("Status updated!");

    } catch (error) {
      console.error("Failed to update status:", error);
      if (error.response?.status === 402) {
        toast.error(error.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(error.response?.data?.error || "Failed to update status");
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const getStageDisplayInfo = (stageIndex) => {
    const stage = stageConfigs[stageIndex];
    const isCurrent = stageIndex === currentStageIndex;

    if (stage.options && isCurrent) {
      const currentStatus = contact.stageStatus;
      if (stage.options.includes(currentStatus)) {
        return {
          ...stage,
          label: currentStatus,
          bgColor: ['Unqualified', 'Lost', 'Churned'].includes(currentStatus) ? 'bg-red-500' : stage.bgColor,
          bgColorLight: ['Unqualified', 'Lost', 'Churned'].includes(currentStatus) ? 'bg-red-50' : stage.bgColorLight,
          textColorDark: ['Unqualified', 'Lost', 'Churned'].includes(currentStatus) ? 'text-red-700' : stage.textColorDark,
          arrowBorderColor: ['Unqualified', 'Lost', 'Churned'].includes(currentStatus) ? 'border-l-red-500' : stage.arrowBorderColor
        };
      }
    }

    return stage;
  };

  return (
    <div className="mb-6">
      <AppToaster />

      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Lifecycle:</span>
          <button
            className="flex items-center gap-1 text-gray-900 hover:text-gray-700 transition-colors font-medium"
            onClick={() => setShowLifecycleModal(true)}
          >
            <span>{contact.lifecycleStage}</span>
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={() => setShowLifecycleModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm"
        >
          <Edit3 className="w-3 h-3" />
          <span>Edit</span>
        </button>
      </div>

      {/* Progress Flow */}
      <div className="relative">
        <div className="flex items-center">
          {stageConfigs.map((stageConfig, index) => {
            const displayInfo = getStageDisplayInfo(index);
            const isActive = index <= currentStageIndex;
            const isCurrent = index === currentStageIndex;
            const isPending = pendingStageIndex === index;
            const hasOptions = stageConfig.options && stageConfig.options.length > 0;

            return (
              <div key={index} className="relative flex-1">
                <div className="relative">
                  <div
                    className={`
                      relative px-3 py-2.5 text-xs font-medium text-center cursor-pointer
                      transition-all duration-300
                      ${isActive ? displayInfo.bgColor : displayInfo.bgColorLight}
                      ${isActive ? displayInfo.textColor : displayInfo.textColorDark}
                      ${index === 0 ? 'rounded-l-lg' : ''}
                      ${index === stageConfigs.length - 1 ? 'rounded-r-lg' : ''}
                      ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                    onClick={() => !isUpdating && handleStageClick(index)}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span className="whitespace-nowrap">{displayInfo.label}</span>
                      {hasOptions && isCurrent && (
                        <ChevronDown className={`w-3 h-3 transition-transform ${showStatusDropdown && isPending ? 'rotate-180' : ''}`} />
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  {index < stageConfigs.length - 1 && isActive && (
                    <div
                      className={`
                        absolute top-0 right-0 w-0 h-0 
                        border-t-[18px] border-b-[18px] border-l-[14px]
                        border-t-transparent border-b-transparent
                        ${displayInfo.arrowBorderColor}
                        transform translate-x-full z-10
                        transition-all duration-300
                      `}
                    />
                  )}
                </div>

                {/* Dropdown Options */}
                {showStatusDropdown && isPending && stageConfig.options && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-30 overflow-hidden">
                    {stageConfig.options.map((option, optIndex) => {
                      const isNegative = ['Unqualified', 'Lost', 'Churned'].includes(option);
                      const isPositive = option === 'Won';

                      return (
                        <div
                          key={option}
                          className={`
                            px-3 py-2 text-sm cursor-pointer transition-all
                            ${contact.stageStatus === option ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}
                            ${isNegative ? 'hover:bg-red-50' : ''}
                            ${isPositive ? 'hover:bg-green-50' : ''}
                            ${optIndex !== stageConfig.options.length - 1 ? 'border-b border-gray-100' : ''}
                            ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}
                            flex items-center gap-2
                          `}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isUpdating) {
                              handleStageClick(index, option);
                            }
                          }}
                        >
                          {isNegative ? <XCircle className="w-4 h-4 text-red-600" /> :
                            isPositive ? <Trophy className="w-4 h-4 text-green-600" /> :
                              <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                          <span>{option}</span>
                          {contact.stageStatus === option && (
                            <div className="ml-auto">
                              <CheckCircle2 className="w-4 h-4 text-blue-600" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Current Status Display */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600">Current:</span>
          <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${['Unqualified', 'Lost', 'Churned'].includes(contact.stageStatus) ? 'bg-red-100 text-red-700' :
            contact.stageStatus === 'Won' ? 'bg-green-100 text-green-700' :
              contact.stageStatus === 'Qualified' ? 'bg-yellow-100 text-yellow-700' :
                contact.stageStatus === 'Interested' ? 'bg-purple-100 text-purple-700' :
                  contact.stageStatus === 'Contacted' ? 'bg-indigo-100 text-indigo-700' :
                    'bg-blue-100 text-blue-700'
            }`}>
            <span>{contact.stageStatus}</span>
          </div>
        </div>

        {isUpdating && (
          <div className="flex items-center gap-2 text-gray-600">
            <div className="w-3 h-3 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs">Updating...</span>
          </div>
        )}
      </div>

      <LifecycleStageModal
        isOpen={showLifecycleModal}
        onClose={() => setShowLifecycleModal(false)}
        contact={contact}
        onUpdate={onContactUpdate}
      />
    </div>
  );
};

// Contact Info Card
const ContactInfoCard = ({ icon: Icon, label, value, action }) => (
  <div className="p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-all group relative">
    <div className="flex items-center justify-between mb-2">
      <Icon className="w-4 h-4 text-gray-600" />
      {action}
    </div>
    <p className="text-xs text-gray-500 mb-1">{label}</p>
    <p className="text-sm font-medium text-gray-900 truncate">{value || '—'}</p>

    {/* Tooltip - shows on hover if value exists and is long enough to truncate */}
    {value && value.length > 15 && (
      <div className="absolute left-0 right-0 bottom-full mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 pointer-events-none shadow-lg">
        <div className="break-words">{value}</div>
        {/* Arrow */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
          <div className="border-4 border-transparent border-t-gray-900"></div>
        </div>
      </div>
    )}
  </div>
);


// Additional Fields Section
const AdditionalFieldsSection = ({ fields }) => {
  if (!fields || fields.length === 0) return null;

  return (
    <div className="border-t border-gray-200 pt-4 mt-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Additional Information</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {fields.map((field, idx) => (
          <div key={idx} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-xs font-medium text-gray-600 mb-1">{field.key}</p>
            <p className="text-sm font-medium text-gray-900">{field.value || '—'}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const BasicDetails = ({ contact, company, deals, contactFieldList = [], onContactUpdate, onDealCreated }) => {
  const [showEmptyFields, setShowEmptyFields] = useState(false); // 👉 NEW Togle State

  // --- PASTE THIS BLOCK STARTING HERE ---
  const [isOwnerDropdownOpen, setIsOwnerDropdownOpen] = useState(false);
  const [searchOwnerQuery, setSearchOwnerQuery] = useState("");
  const [availableUsers, setAvailableUsers] = useState([]);

  const currentUserStr = localStorage.getItem("user");
  const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;

  const hasEditPermission = () => {
    if (currentUser?.role === 'admin') return true;
    return currentUser?.permissions?.some(
      (p) => p.name.toLowerCase() === 'contacts' && p.permission === 'read-write'
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

    // VALIDATION 1: Prevent empty/null values
    if (!newOwnerId) {
      toast.error("Invalid owner selected.");
      return;
    }

    // VALIDATION 2: Prevent re-assigning to the current owner
    if (data.user?._id === newOwnerId) {
      setIsOwnerDropdownOpen(false);
      return;
    }

    try {
      await API.put(`/companies/${data._id}`, { user: newOwnerId });
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
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // 👉 NEW: Helper functions for custom fields
  const isEmpty = (value) => {
    if (value === null || value === undefined || value === "") return true;
    if (typeof value === "string" && value.trim() === "") return true;
    if (Array.isArray(value) && value.length === 0) return true;
    return false;
  };

  const getMergedAdditionalFields = () => {
    if (!contactFieldList || contactFieldList.length === 0) {
      return (contact.additionalFields || []).map(f => ({ ...f, category: "Uncategorized" }));
    }

    const existingValuesMap = new Map();
    if (contact.additionalFields && contact.additionalFields.length > 0) {
      contact.additionalFields.forEach((field) => {
        existingValuesMap.set(field.key, field.value);
      });
    }

    return contactFieldList.map((templateField) => {
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
    if (!showEmptyFields) {
      return mergedFields.filter((field) => !isEmpty(field.value));
    }
    return mergedFields;
  };

  const renderAdditionalFieldValue = (field) => {
    if (isEmpty(field.value)) {
      return <span className="text-gray-400 italic font-normal">Not available</span>;
    }

    switch (field.type) {
      case "url":
        const url = field.value.startsWith("http") ? field.value : `https://${field.value}`;
        return (
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-words font-medium">
            {field.value}
          </a>
        );
      case "date":
        try {
          return <span className="text-gray-900 font-medium">{new Date(field.value).toLocaleDateString()}</span>;
        } catch {
          return <span className="text-gray-900 font-medium break-words">{field.value}</span>;
        }
      case "multiselect":
        if (Array.isArray(field.value)) {
          return (
            <div className="flex flex-wrap gap-1.5">
              {field.value.map((item, idx) => (
                <span key={idx} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {item}
                </span>
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

      {/* --- PASTE THIS UI BLOCK STARTING HERE --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-lg border border-gray-200 relative z-50">

        {/* LEFT SIDE: Owner Dropdown */}
        <div className="flex items-center gap-2 ">
          <span className="text-sm font-medium text-gray-500">Owner:</span>

          <div className="relative">
            <button
              onClick={() => hasEditPermission() && setIsOwnerDropdownOpen(!isOwnerDropdownOpen)}
              className={`flex items-center gap-1.5 px-2 py-1 -ml-2 rounded text-sm font-semibold transition-colors ${hasEditPermission() ? 'text-gray-900 hover:bg-gray-50 cursor-pointer' : 'text-gray-900 cursor-default'
                }`}
              disabled={!hasEditPermission()}
            >
              {contact.user?.name || "Unassigned"}
              {hasEditPermission() && <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            {isOwnerDropdownOpen && hasEditPermission() && (
              <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-md shadow-xl">
                <div className="p-3 border-b border-gray-100 flex justify-between items-center">
                  <h4 className="text-xs font-semibold text-gray-700">Assign Owner</h4>
                  <button onClick={() => setIsOwnerDropdownOpen(false)} className="text-xs text-gray-500 border border-gray-200 px-2 py-1 rounded hover:bg-gray-50">Close</button>
                </div>

                <div className="p-2">
                  <div className="relative mb-2">
                    <input type="text" placeholder="Search..." className="w-full text-sm border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:border-blue-500" value={searchOwnerQuery} onChange={(e) => setSearchOwnerQuery(e.target.value)} />
                  </div>

                  <div className="max-h-48 overflow-y-auto">
                    <button onClick={() => handleOwnerChange(null)} className="w-full text-left flex items-center gap-3 p-2 hover:bg-gray-50 rounded text-sm">
                      <div className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-medium">N</div>
                      <span className="text-gray-700">None</span>
                      {!contact.user && <Check className="w-4 h-4 text-green-600 ml-auto" />}
                    </button>

                    {availableUsers.filter(u => u.name?.toLowerCase().includes(searchOwnerQuery.toLowerCase())).map((mappedUser) => {
                      const isCurrentOwner = contact.user?._id === mappedUser._id;
                      const initials = mappedUser.name ? mappedUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U';

                      return (
                        <button key={mappedUser._id} onClick={() => handleOwnerChange(mappedUser._id)} className="w-full text-left flex items-center gap-3 p-2 hover:bg-gray-50 rounded text-sm">
                          <div className="w-7 h-7 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-medium text-xs">{initials}</div>
                          <div className="flex flex-col">
                            <span className="text-gray-900 font-medium">{mappedUser.name}</span>
                            <span className="text-gray-500 text-xs">{mappedUser.email}</span>
                          </div>
                          {isCurrentOwner && <Check className="w-4 h-4 text-green-600 ml-auto" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDE: Audit Timestamps (Hover Reveal) */}
        <div className="flex flex-col text-xs text-right mt-4 md:mt-0 relative group/audit cursor-default">
          <div className="flex items-center justify-end gap-1.5 text-gray-500">
            <Clock className="w-3.5 h-3.5" />
            <span>Updated: {formatDateTime(contact.updatedAt)}</span>
          </div>
          <div className="text-gray-400">by: <span className="font-medium text-gray-600">{contact.lastUpdatedBy?.name || 'Unknown'}</span></div>

          <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 p-4 rounded-md shadow-xl opacity-0 group-hover/audit:opacity-100 transition-opacity pointer-events-none z-40 min-w-[250px] text-left">

            {/* Last Updated */}
            <div className="mb-3">
              <div className="flex justify-between items-center text-gray-600 mb-1">
                <span>Update On:</span>
                <span className="font-medium">{formatDateTime(contact.updatedAt)}</span>
              </div>
              <div className="flex justify-between items-center text-gray-600">
                <span>Updated by:</span>
                <span className="font-medium text-gray-900">{contact.lastUpdatedBy?.name || 'Unknown'}</span>
              </div>
            </div>

            {/* Separator Line */}
            <div className="border-t border-gray-200 my-3"></div>

            {/* Original Creation */}
            <div>
              <div className="flex justify-between items-center text-gray-600 mb-1">
                <span>Added on:</span>
                <span className="font-medium">{formatDateTime(contact.createdAt)}</span>
              </div>
              <div className="flex justify-between items-center text-gray-600">
                <span>Added by:</span>
                <span className="font-medium text-gray-900">{contact.createdBy?.name || 'Unknown'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AppToaster />

      {/* Lifecycle Stages */}
      <LifecycleStages contact={contact} onContactUpdate={onContactUpdate} />

      {/* Contact Information Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <ContactInfoCard
          icon={Mail}
          label="Email"
          value={contact.email}
        />

        <ContactInfoCard
          icon={Phone}
          label="Phone"
          value={contact.phone}
        />

        <ContactInfoCard
          icon={Building2}
          label="Company"
          value={company?.name || 'No company'}
          action={company && (
            <Link
              to={`/companies/${company._id}`}
              className="p-1 text-gray-400 hover:text-gray-900 transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        />

        <ContactInfoCard
          icon={TrendingUp}
          label="Status"
          value={contact.stageStatus}
        />
      </div>

      {/* --- PREMIUM CUSTOM FIELDS RENDERER --- */}
      <div className="border-t border-gray-200 pt-6 mt-6">
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
          {/* --- SECTIONS: DYNAMIC CUSTOM CATEGORIES --- */}
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

          {/* 👉 FIXED: Smarter Empty State Feedback */}
          {groupedFields.length === 0 && (
            <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-400 text-sm italic mt-4">
              {!showEmptyFields
                ? 'No populated custom fields available. Click "Show All Fields" above.'
                : 'No custom fields have been configured in Settings yet.'}
            </div>
          )}
        </div>
      </div>

      {/* Deals Section */}
      <div className="border-t border-gray-200 pt-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-gray-600" />
            <div>
              <h3 className="text-lg font-bold text-gray-900">Associated Deals</h3>
              <p className="text-sm text-gray-600">
                {deals?.length || 0} deal{deals?.length !== 1 ? 's' : ''} in pipeline
              </p>
            </div>
          </div>
        </div>

        <DealsTable
          deals={deals || []}
          contact={contact}
          company={company}
          onDealCreated={onDealCreated}
        />
      </div>
    </div>
  );
};

export default BasicDetails;
