import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Filter,
  Plus,
  FileText,
  FileWarning,
  Landmark,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

export default function CompanyInvoicesTab({ invoices, summary, loading }) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredInvoices = useMemo(() => {
    if (!searchTerm.trim()) return invoices;
    const q = searchTerm.toLowerCase();
    return invoices.filter(
      (inv) =>
        (inv.invoiceNumber || "").toLowerCase().includes(q) ||
        (inv.status || "").toLowerCase().includes(q) ||
        (inv.deal?.title || "").toLowerCase().includes(q),
    );
  }, [invoices, searchTerm]);

  const totalInvoiced = summary?.totalAmount || 0;
  const totalCount = summary?.totalInvoices || invoices.length;
  const outstanding = summary?.amountDue || 0;
  const collected = summary?.amountPaid || 0;
  const overdueAmount = summary?.overdueAmount || 0;

  const pendingCount = invoices.filter((inv) => inv.status !== "Paid").length;
  const overdueCount = invoices.filter(
    (inv) =>
      inv.status !== "Paid" && inv.dueDate && new Date(inv.dueDate) < new Date(),
  ).length;
  const collectionRate =
    totalInvoiced > 0 ? Math.round((collected / totalInvoiced) * 100) : 0;

  const kpiTiles = [
    {
      label: "Total Invoiced",
      value: `₹${totalInvoiced.toLocaleString("en-IN")}`,
      icon: FileText,
      subtitle: `Over ${totalCount} invoices`,
      subtitleClass: "text-gray-400",
    },
    {
      label: "Outstanding Amount",
      value: `₹${outstanding.toLocaleString("en-IN")}`,
      icon: FileWarning,
      subtitle: `${pendingCount} invoices pending`,
      subtitleClass: "text-red-500",
    },
    {
      label: "Amount Collected",
      value: `₹${collected.toLocaleString("en-IN")}`,
      icon: Landmark,
      subtitle: `${collectionRate}% Collection Rate`,
      subtitleClass: "text-green-600",
      subtitleIcon: ArrowUp,
    },
    {
      label: "Overdue Invoices",
      value: overdueCount,
      icon: AlertTriangle,
      subtitle: `₹${overdueAmount.toLocaleString("en-IN")} Overdue`,
      subtitleClass: "text-red-500",
      subtitleIcon: ArrowDown,
    },
  ];

  return (
    <div>
      {/* KPI Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {kpiTiles.map((tile) => (
          <div
            key={tile.label}
            className="h-[72px] flex items-center gap-3 px-3 bg-white border border-gray-200 rounded-xl"
          >
            <div className="w-10 h-10 text-blue-600 border border-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
              <tile.icon size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-gray-500 truncate">{tile.label}</p>
              <div className="flex items-baseline gap-2 flex-wrap">
                <p className="text-base font-semibold text-gray-900">
                  {tile.value}
                </p>
                {tile.subtitle && (
                  <span
                    className={`text-[11px] flex items-center gap-0.5 ${tile.subtitleClass}`}
                  >
                    {tile.subtitleIcon && <tile.subtitleIcon size={10} />}
                    {tile.subtitle}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Controls */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by invoice by number, deal, or status..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-full text-sm focus:outline-none focus:border-blue-300"
          />
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50">
          <Filter size={14} />
          Filter
        </button>
        <Link
          to="/invoices?tab=tax"
          className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50"
          title="Add Invoice"
        >
          <Plus size={16} />
        </Link>
      </div>

      {/* Invoice list or empty state */}
      {loading ? (
        <div className="text-sm text-gray-500 text-center py-6">
          Loading invoices…
        </div>
      ) : filteredInvoices.length === 0 ? (
        <Link
          to="/invoices?tab=tax"
          className="flex flex-col items-center justify-center min-h-[300px] bg-gray-50 border border-gray-200 rounded-xl text-gray-500 hover:text-blue-600 hover:border-blue-200 transition-colors"
        >
          <FileText size={28} className="mb-2" />
          <span className="text-sm font-medium">Create New Invoice</span>
        </Link>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredInvoices.map((invoice) => (
            <div
              key={invoice._id}
              className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center font-semibold text-blue-700 flex-shrink-0">
                <FileText size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {invoice.invoiceNumber || invoice._id}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  ₹{(invoice.amount || 0).toLocaleString("en-IN")} · {invoice.status}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
