import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../services/api";
import { ArrowUpRight, MoreHorizontal, ChevronDown, ListFilter } from "lucide-react";

// Helper for 12th Nov style dates
const formatDueDay = (isoDate) => {
  const date = new Date(isoDate);
  const day = date.getDate();
  const month = date.toLocaleString("en-US", { month: "short" });

  const suffix = (d) => {
    if (d > 3 && d < 21) return "th";
    switch (d % 10) {
      case 1: return "st";
      case 2: return "nd";
      case 3: return "rd";
      default: return "th";
    }
  };

  return `${day}${suffix(day)} ${month}`;
};

const formatCurrency = (amount) =>
  `₹${Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PaymentInformation = ({ invoices, summary }) => {
  const [invoiceData, setInvoiceData] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRelatedData = async () => {
      const updatedInvoices = await Promise.all(
        (invoices || []).map(async (invoice) => {
          try {
            let companyRes;
            // Attempt to get company from deal or directly if available
            const companyId = invoice.company?._id || invoice.deal?.company?._id;

            if (companyId) {
              companyRes = await API.get(`/companies/${companyId}`);
            }
            const company = companyRes?.data;

            return {
              ...invoice,
              companyName: company?.name || "DataCircles", // Fallback for mockup parity
              invoiceNo: `#${String(invoice.invoiceNumber || "000000").padStart(6, "0")}`,
            };
          } catch (err) {
            return {
              ...invoice,
              companyName: "DataCircles",
              invoiceNo: "#000000",
            };
          }
        })
      );

      setInvoiceData(updatedInvoices.slice(0, 10)); // Just show 10 for dashboard
    };

    if (invoices?.length > 0) fetchRelatedData();
    else setInvoiceData([]);
  }, [invoices]);

  return (
    <div className="bg-white rounded-[20px] border border-[#F2F2F7] shadow-sm font-inter overflow-hidden">
      {/* Top Header */}
      <div className="p-8 pb-4 flex justify-between items-center">
        <h2 className="text-[20px] font-bold text-[#111216]">Revenue</h2>
        <div className="flex items-center gap-2">
          <button className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
            <ArrowUpRight className="w-4 h-4 text-gray-500" />
          </button>
          <button className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
            <MoreHorizontal className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Summary Stats Row */}
      <div className="px-8 mb-8 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <p className="text-[12px] text-gray-400 font-medium mb-1">Total Invoices Issued for</p>
          <h3 className="text-[24px] font-bold text-[#111216]">{formatCurrency(summary?.totalIssued || 0)}</h3>
        </div>
        <div>
          <p className="text-[12px] text-gray-400 font-medium mb-1">Total Paid</p>
          <h3 className="text-[24px] font-bold text-[#111216]">{formatCurrency(summary?.totalPaid || 0)}</h3>
        </div>
        <div>
          <p className="text-[12px] text-gray-400 font-medium mb-1">Total Un-paid</p>
          <h3 className="text-[24px] font-bold text-[#111216]">{formatCurrency(summary?.totalUnpaid || 0)}</h3>
        </div>
      </div>

      {/* Table Section */}
      <div className="overflow-x-auto border-t border-[#F2F2F7]">
        <table className="min-w-full text-sm text-left border-collapse">
          <thead>
            <tr className="border-b border-[#F2F2F7]">
              <th className="px-8 py-4 font-bold text-[#111216] text-[13px] border-r border-[#F2F2F7] min-w-[215px]">
                <div className="flex items-center gap-2 cursor-pointer group">
                  Invoice No. <ListFilter className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" />
                </div>
              </th>
              <th className="px-6 py-4 font-bold text-[#111216] text-[13px] border-r border-[#F2F2F7] min-w-[215px]">Client</th>
              <th className="px-6 py-4 font-bold text-[#111216] text-[13px] border-r border-[#F2F2F7] min-w-[215px]">Amount</th>
              <th className="px-6 py-4 font-bold text-[#111216] text-[13px] border-r border-[#F2F2F7] min-w-[215px]">Due Date</th>
              <th className="px-6 py-4 font-bold text-[#111216] text-[13px] border-r border-[#F2F2F7] min-w-[215px]">Status</th>
              <th className="px-6 py-4 font-bold text-[#111216] text-[13px] min-w-[215px]">Tags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F2F2F7]">
            {invoiceData.map((inv) => (
              <tr key={inv._id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-8 py-4 font-medium text-gray-500 border-r border-[#F2F2F7] min-w-[215px]">{inv.invoiceNo}</td>
                <td className="px-6 py-4 border-r border-[#F2F2F7] min-w-[215px]">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center p-1 overflow-hidden shrink-0">
                      <div className="w-full h-full bg-white rounded-[2px] opacity-80" />
                    </div>
                    <span className="font-bold text-[#111216]">{inv.companyName}</span>
                  </div>
                </td>
                <td className="px-6 py-4 font-bold text-[#111216] border-r border-[#F2F2F7] min-w-[215px]">
                  {Number(inv.amount || 0).toLocaleString()}
                </td>
                <td className="px-6 py-4 font-bold text-gray-500 border-r border-[#F2F2F7] min-w-[215px]">
                  {formatDueDay(inv.date)}
                </td>
                <td className="px-6 py-4 border-r border-[#F2F2F7] min-w-[215px]">
                  <span className="px-3 py-1 bg-green-50 text-[#10b981] rounded-full text-[11px] font-bold">
                    Active
                  </span>
                </td>
                <td className="px-6 py-4 min-w-[215px]">
                  <div className="flex gap-2">
                    <span className="px-3 py-1 bg-red-50 text-red-500 rounded-full text-[11px] font-bold whitespace-nowrap">
                      High Priority
                    </span>
                    <span className="px-3 py-1 bg-blue-50 text-blue-500 rounded-full text-[11px] font-bold whitespace-nowrap">
                      VIP
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="p-6 border-t border-[#F2F2F7] flex items-center justify-between text-[13px] text-gray-500 font-medium">
        <div className="flex items-center gap-3">
          <span>Show</span>
          <button className="flex items-center gap-2 px-2 py-1 bg-white border border-[#F2F2F7] rounded-md hover:bg-gray-50 transition-colors">
            10 <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
        <div>
          1 to 10 of {invoices?.length || 37} results
        </div>
      </div>
    </div>
  );
};

export default PaymentInformation;

