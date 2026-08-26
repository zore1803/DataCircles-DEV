import React, { useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Filter,
  Download,
  MoreVertical,
  CheckCircle2,
  Edit2,
  X,
} from "lucide-react";

// UI-only Sales page — the backend Sales Order module has been removed.
// All API/form/preview/share/export logic was intentionally stripped; this
// screen now renders the shell (toolbar, table, empty state, pagination)
// with static placeholder rows so the layout stays intact for a future
// rebuild of the Sales module.
const PLACEHOLDER_ROWS = [
  {
    _id: "1",
    number: "SO-0001",
    customer: "—",
    amount: 0,
    status: "Draft",
    fulfillment: "Pending",
    date: "",
    dueDate: "",
  },
];

const STATUS_STYLES = {
  Draft: "bg-gray-100 text-gray-600 border-gray-200",
  Confirmed: "bg-green-50 text-green-700 border-green-200",
  Cancelled: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_ICONS = {
  Draft: Edit2,
  Confirmed: CheckCircle2,
  Cancelled: X,
};

const SalesReturn = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const rows = PLACEHOLDER_ROWS;

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Sales Return</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your sales returns
          </p>
        </div>
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium opacity-60 cursor-not-allowed"
          title="Sales module is not connected"
        >
          <Plus className="w-4 h-4" />
          New Sales Return
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search sales returns..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left w-12">
                  <input type="checkbox" className="w-4 h-4 text-blue-600 border-gray-300 rounded" />
                </th>
                <th className="px-4 py-3 text-left">Number</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Fulfillment</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Expected Delivery</th>
                <th className="px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                    No sales returns yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const StatusIcon = STATUS_ICONS[row.status] || Edit2;
                  return (
                    <tr key={row._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <input type="checkbox" className="w-4 h-4 text-blue-600 border-gray-300 rounded" />
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{row.number}</td>
                      <td className="px-4 py-3 text-gray-700">{row.customer}</td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        ₹{row.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_STYLES[row.status] || STATUS_STYLES.Draft}`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{row.fulfillment}</td>
                      <td className="px-4 py-3 text-gray-600">{row.date || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{row.dueDate || "—"}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
          <div>Showing {rows.length} of {rows.length}</div>
          <div className="flex items-center gap-2">
            <button className="p-1.5 border border-gray-200 rounded hover:bg-gray-50" disabled>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2">Page 1 of 1</span>
            <button className="p-1.5 border border-gray-200 rounded hover:bg-gray-50" disabled>
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="ml-4 flex items-center gap-1 text-xs">
              <span>Rows</span>
              <button className="inline-flex items-center gap-1 px-2 py-1 border border-gray-200 rounded">
                50 <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesReturn;
