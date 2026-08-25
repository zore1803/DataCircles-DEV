import React, { useEffect, useState } from "react";
import { X, Pencil, Trash2, RotateCcw } from "lucide-react";

const money = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const getStatusBadgeColor = (status) => {
  switch (status?.toLowerCase()) {
    case "confirmed": return "bg-green-100 text-green-800";
    case "paid": return "bg-emerald-100 text-emerald-800";
    case "pending": return "bg-yellow-100 text-yellow-800";
    case "cancelled": return "bg-red-100 text-red-800";
    case "draft": return "bg-blue-100 text-blue-800";
    default: return "bg-gray-100 text-gray-800";
  }
};

/*
 * Read-only right-drawer for one Purchase Return. Unlike PurchasePreview
 * (which renders a server-generated PDF in an iframe via a download
 * endpoint), this renders the fields directly — there's no PDF template for
 * this document type yet, and a return is an internal record rather than
 * something handed to the vendor, so a plain detail view covers the need.
 */
const PurchaseReturnPreview = ({ purchaseReturn, isOpen, onClose, onEdit, onDelete }) => {
  const [isSliding, setIsSliding] = useState(false);

  useEffect(() => {
    if (isOpen) setTimeout(() => setIsSliding(true), 10);
  }, [isOpen]);

  const handleClose = () => {
    setIsSliding(false);
    setTimeout(() => onClose(), 300);
  };

  if (!isOpen || !purchaseReturn) return null;
  const p = purchaseReturn;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[10000] transition-opacity duration-300"
        style={{ opacity: isSliding ? 1 : 0 }}
        onClick={handleClose}
      />
      <div
        className={`fixed dc-panel-card dc-panel-w z-[10001] bg-white shadow-2xl flex flex-col overflow-hidden transform transition-transform duration-300 ease-out ${isSliding ? "translate-x-0" : "translate-x-[calc(100%+2rem)]"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center flex-shrink-0">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-gray-900 truncate">{p.returnNumber}</h2>
              <p className="text-xs text-gray-400 truncate">{formatDate(p.returnDate)}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={onEdit} title="Edit" className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={onDelete} title="Delete" className="p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={handleClose} title="Close" className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 mb-1">Vendor</p>
              <p className="text-sm font-semibold text-gray-900">{p.vendor?.name || "—"}</p>
              {p.vendor?.phone && <p className="text-xs text-gray-400">{p.vendor.phone}</p>}
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(p.status)}`}>
              {p.status}
            </span>
          </div>

          {p.purchase?.purchaseNumber && (
            <div className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-100 text-xs text-gray-600">
              Returned against <span className="font-semibold text-gray-800">{p.purchase.purchaseNumber}</span>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Items</p>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-[11px] font-bold text-gray-500 uppercase">Item</th>
                    <th className="px-3 py-2 text-[11px] font-bold text-gray-500 uppercase">Reason</th>
                    <th className="px-3 py-2 text-[11px] font-bold text-gray-500 uppercase text-right">Qty</th>
                    <th className="px-3 py-2 text-[11px] font-bold text-gray-500 uppercase text-right">Rate</th>
                    <th className="px-3 py-2 text-[11px] font-bold text-gray-500 uppercase text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(p.items || []).map((it, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-sm text-gray-900">{it.name}</td>
                      <td className="px-3 py-2 text-sm text-gray-500">{it.reason || "—"}</td>
                      <td className="px-3 py-2 text-sm text-gray-600 text-right">{it.quantity}</td>
                      <td className="px-3 py-2 text-sm text-gray-600 text-right">{money(it.unitPrice)}</td>
                      <td className="px-3 py-2 text-sm font-medium text-gray-900 text-right">{money(it.total ?? it.quantity * it.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="text-gray-900">{money(p.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Tax</span><span className="text-gray-900">{money(p.totalTax)}</span></div>
            <div className="flex justify-between text-base font-bold pt-1.5 border-t border-gray-100"><span className="text-gray-900">Total</span><span className="text-gray-900">{money(p.grandTotal)}</span></div>
          </div>

          {(p.mode || p.reason) && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              {p.mode && <div><p className="text-xs text-gray-400 mb-0.5">Refund Mode</p><p className="text-gray-900">{p.mode}</p></div>}
              {p.reason && <div><p className="text-xs text-gray-400 mb-0.5">Reason</p><p className="text-gray-900">{p.reason}</p></div>}
            </div>
          )}

          {p.notes && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Notes</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{p.notes}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default PurchaseReturnPreview;
