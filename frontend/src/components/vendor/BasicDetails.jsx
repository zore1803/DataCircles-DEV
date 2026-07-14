import React, {useState} from "react";
import {
  User,
  Phone,
  Mail,
  Building2,
  FileText,
  MapPin,
  TrendingUp,
  TrendingDown,
  Wallet,
  LayoutGrid,
  FolderOpen,
  Eye,
  EyeOff
} from 'lucide-react';

const BasicDetails = ({ vendor, payments, vendorFieldList = [] }) => {
  const addressString = [
    vendor.address?.line1,
    vendor.address?.line2,
    vendor.address?.city,
    vendor.address?.state,
    vendor.address?.pincode,
    vendor.address?.country,
  ]
    .filter(Boolean)
    .join(", ");

  const totalPaymentsIn = payments
    ? payments
      .filter((p) => p.direction === "IN")
      .reduce((sum, p) => sum + p.amount, 0)
    : 0;
  const totalPaymentsOut = payments
    ? payments
      .filter((p) => p.direction === "OUT")
      .reduce((sum, p) => sum + p.amount, 0)
    : 0;

  const netBalance = totalPaymentsIn - totalPaymentsOut;
  const [showEmptyFields, setShowEmptyFields] = useState(false);

  // Helper function to format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Helper function to render field value based on type
  // 1. Check if a value is empty
  const isEmpty = (value) => {
    if (value === null || value === undefined || value === "") return true;
    if (typeof value === "string" && value.trim() === "") return true;
    if (Array.isArray(value) && value.length === 0) return true;
    return false;
  };

  // 2. Merge saved vendor data with the template schema
  const getMergedAdditionalFields = () => {
    if (!vendorFieldList || vendorFieldList.length === 0) {
      return (vendor.additionalFields || []).map(f => ({ ...f, category: "Uncategorized" }));
    }

    const existingValuesMap = new Map();
    if (vendor.additionalFields && vendor.additionalFields.length > 0) {
      vendor.additionalFields.forEach((field) => {
        existingValuesMap.set(field.key, field.value);
      });
    }

    return vendorFieldList.map((templateField) => {
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

  // 3. Filter based on toggle state
  const getVisibleAdditionalFields = () => {
    const mergedFields = getMergedAdditionalFields();
    if (!showEmptyFields) {
      return mergedFields.filter((field) => !isEmpty(field.value));
    }
    return mergedFields;
  };

  // 4. Advanced Field Renderer (handles URLs, Dates, Multiselects, etc.)
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

  // 5. Group the visible fields by category
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
      {/* Vendor Information */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Vendor Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Name */}
          <div className="p-3 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-gray-600" />
              <p className="text-xs text-gray-600">Name</p>
            </div>
            <p className="text-sm font-medium text-gray-900">{vendor.name || "—"}</p>
          </div>

          {/* Phone */}
          <div className="p-3 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Phone className="w-4 h-4 text-gray-600" />
              <p className="text-xs text-gray-600">Phone</p>
            </div>
            <p className="text-sm font-medium text-gray-900">{vendor.phone || "—"}</p>
          </div>

          {/* Email */}
          <div className="p-3 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="w-4 h-4 text-gray-600" />
              <p className="text-xs text-gray-600">Email</p>
            </div>
            <p className="text-sm font-medium text-gray-900">{vendor.email || "—"}</p>
          </div>

          {/* Company */}
          <div className="p-3 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-gray-600" />
              <p className="text-xs text-gray-600">Company</p>
            </div>
            <p className="text-sm font-medium text-gray-900">{vendor.company || "—"}</p>
          </div>

          {/* GSTIN */}
          <div className="p-3 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-gray-600" />
              <p className="text-xs text-gray-600">GSTIN</p>
            </div>
            <p className="text-sm font-medium text-gray-900">{vendor.gstin || "—"}</p>
          </div>

          {/* Address */}
          <div className="p-3 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-gray-600" />
              <p className="text-xs text-gray-600">Address</p>
            </div>
            <p className="text-sm font-medium text-gray-900 line-clamp-2">{addressString || "—"}</p>
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="border-t border-gray-200 pt-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Financial Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Payments In */}
          <div className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-gray-600" />
              <p className="text-xs text-gray-600">Total Received</p>
            </div>
            <h6 className="text-2xl font-bold text-gray-900">
              {formatCurrency(totalPaymentsIn)}
            </h6>
          </div>

          {/* Payments Out */}
          <div className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="w-4 h-4 text-gray-600" />
              <p className="text-xs text-gray-600">Total Paid</p>
            </div>
            <h6 className="text-2xl font-bold text-gray-900">
              {formatCurrency(totalPaymentsOut)}
            </h6>
          </div>
        </div>

        {/* Net Balance */}
        <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-900">Net Balance</span>
            </div>
            <h6 className={`text-lg font-bold ${netBalance >= 0 ? 'text-gray-900' : 'text-gray-700'}`}>
              {formatCurrency(netBalance)}
            </h6>
          </div>
          <p className="text-xs text-gray-600 mt-2">
            {netBalance >= 0 ? "You'll receive" : "You owe"}
          </p>
        </div>
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

          {/* Smarter Empty State Feedback */}
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
