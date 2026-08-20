import React, { useEffect, useState } from "react";
import { X, Plus, Trash2, ChevronDown } from "lucide-react";
import API from "../../services/api";
import toast from "react-hot-toast";

const MODES = ["Cash", "UPI", "Bank Transfer", "Cheque", "Card", "Other"];
const STATUS_OPTIONS = ["Draft", "Pending", "Paid", "Cancelled"];

const blankItem = () => ({ name: "", quantity: 1, unitPrice: 0 });

const money = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/*
 * Right-drawer create/edit form for a Purchase Return. Same dc-panel-card
 * quick-drawer shell as PurchaseForm/CompanyForm/ItemForm. Deliberately
 * simpler than PurchaseForm's item entry (no live catalog ItemSearchSelect):
 * a return's line items are picked either by loading them straight off an
 * existing Purchase (see the vendor -> "Return against" picker below) or
 * typed by hand for a standalone return, so a full product search isn't the
 * primary path the way it is for a fresh Purchase bill.
 */
const PurchaseReturnForm = ({ editingReturn, vendors, onRequestClose, onSuccess, onError }) => {
  const isEditing = !!editingReturn;
  const [isSliding, setIsSliding] = useState(false);

  const [vendor, setVendor] = useState("");
  const [vendorPurchases, setVendorPurchases] = useState([]);
  const [sourcePurchaseId, setSourcePurchaseId] = useState("");
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split("T")[0]);
  const [items, setItems] = useState([blankItem()]);
  const [mode, setMode] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("Draft");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsSliding(true), 10);
  }, []);

  useEffect(() => {
    if (!editingReturn) return;
    setVendor(editingReturn.vendor?._id || editingReturn.vendor || "");
    setSourcePurchaseId(editingReturn.purchase?._id || editingReturn.purchase || "");
    setReturnDate(
      editingReturn.returnDate ? new Date(editingReturn.returnDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]
    );
    setItems(
      (editingReturn.items || []).map((it) => ({
        name: it.name,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        itemId: it.itemId?._id || it.itemId,
      }))
    );
    setMode(editingReturn.mode || "");
    setReason(editingReturn.reason || "");
    setNotes(editingReturn.notes || "");
    setStatus(editingReturn.status || "Draft");
  }, [editingReturn]);

  // Once a vendor is picked, offer their existing Purchases as "return
  // against" candidates — mirrors PurchaseForm's PO picker, just pointed at
  // Purchase instead of PurchaseOrder.
  useEffect(() => {
    if (!vendor) {
      setVendorPurchases([]);
      return;
    }
    API.get(`/purchases/vendor/${vendor}`)
      .then((res) => setVendorPurchases(res.data || []))
      .catch(() => setVendorPurchases([]));
  }, [vendor]);

  const handleClose = () => {
    setIsSliding(false);
    setTimeout(() => onRequestClose(), 300);
  };

  const loadSourcePurchase = (purchaseId) => {
    setSourcePurchaseId(purchaseId);
    if (!purchaseId) return;
    const source = vendorPurchases.find((p) => p._id === purchaseId);
    if (!source) return;
    setItems(
      (source.items || []).map((it) => ({
        name: it.name,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        itemId: it.itemId?._id || it.itemId,
      }))
    );
  };

  const updateItem = (index, patch) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };
  const addItem = () => setItems((prev) => [...prev, blankItem()]);
  const removeItem = (index) => setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  const subtotal = items.reduce((sum, it) => sum + (parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!vendor) {
      toast.error("Select a vendor");
      return;
    }
    const cleanItems = items.filter((it) => it.name.trim());
    if (cleanItems.length === 0) {
      toast.error("Add at least one item");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        vendor,
        purchase: sourcePurchaseId || null,
        returnDate,
        items: cleanItems.map((it) => ({
          itemId: it.itemId || undefined,
          name: it.name,
          quantity: parseFloat(it.quantity) || 0,
          unitPrice: parseFloat(it.unitPrice) || 0,
        })),
        mode,
        reason,
        notes,
        status,
      };

      if (isEditing) {
        await API.put(`/purchase-returns/${editingReturn._id}`, payload);
      } else {
        await API.post("/purchase-returns", payload);
      }
      onSuccess?.();
    } catch (err) {
      onError?.(err.response?.data?.error || err.response?.data?.message || "Failed to save purchase return");
    } finally {
      setSaving(false);
    }
  };

  // Same pill field spec as QuickCompanyForm/QuickVendorForm/QuickJournalForm
  // — was a mismatched rounded-lg/h-10/text-sm before.
  const fieldClass =
    "w-full border border-[#1F2937]/10 rounded-full px-3 h-8 text-[12px] text-[#1F2937] focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all";
  const labelClass = "block text-[12px] font-medium text-[#161618] tracking-[-0.05em] mb-2";

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[10000] transition-opacity duration-300 ease-in-out"
        style={{ opacity: isSliding ? 1 : 0 }}
        onClick={handleClose}
      />
      {/* Same dc-panel-card/dc-panel-w shell as PurchaseForm/CompanyForm/ItemForm */}
      <div
        className={`fixed dc-panel-card dc-panel-w z-[10001] bg-white shadow-2xl flex flex-col overflow-hidden transform transition-transform duration-300 ease-out ${isSliding ? "translate-x-0" : "translate-x-[calc(100%+2rem)]"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — matches the CompanyForm/ItemForm quick-drawer header spec */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-[#D9D9D9] flex-shrink-0 bg-white gap-1">
          <h2 className="text-[14px] font-normal leading-5 text-[#78788D] uppercase tracking-wide">
            {isEditing ? `Edit Return ${editingReturn.returnNumber}` : "New Purchase Return"}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            title="Close"
            className="w-5 h-5 flex items-center justify-center text-[#1C1B1F] hover:opacity-70 transition-opacity"
            aria-label="Close"
          >
            <X className="w-[18px] h-[18px]" strokeWidth={2} />
          </button>
        </div>

        <form id="pr-form" onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto px-6 py-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Vendor *</label>
              <div className="relative">
                <select
                  value={vendor}
                  onChange={(e) => { setVendor(e.target.value); setSourcePurchaseId(""); }}
                  required
                  className={`${fieldClass} appearance-none bg-white cursor-pointer pr-8`}
                >
                  <option value="">Select vendor</option>
                  {vendors.map((v) => (
                    <option key={v._id} value={v._id}>{v.name}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Return Date</label>
              <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className={fieldClass} />
            </div>
          </div>

          {vendor && vendorPurchases.length > 0 && (
            <div>
              <label className={labelClass}>
                Return Against Purchase <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <select
                  value={sourcePurchaseId}
                  onChange={(e) => loadSourcePurchase(e.target.value)}
                  className={`${fieldClass} appearance-none bg-white cursor-pointer pr-8`}
                >
                  <option value="">Standalone return (no bill selected)</option>
                  {vendorPurchases.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.purchaseNumber} · {money(p.grandTotal)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5">Selecting a bill pre-fills its items below — edit quantities as needed.</p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[12px] font-medium text-[#161618] tracking-[-0.05em]">Items *</label>
              <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
                <Plus className="w-3.5 h-3.5" /> Add Item
              </button>
            </div>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={it.name}
                    onChange={(e) => updateItem(i, { name: e.target.value })}
                    placeholder="Item name"
                    className={`${fieldClass} flex-1 min-w-0`}
                  />
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={it.quantity}
                    onChange={(e) => updateItem(i, { quantity: e.target.value })}
                    placeholder="Qty"
                    className={`${fieldClass} w-20 flex-shrink-0`}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={it.unitPrice}
                    onChange={(e) => updateItem(i, { unitPrice: e.target.value })}
                    placeholder="Rate"
                    className={`${fieldClass} w-24 flex-shrink-0`}
                  />
                  <span className="w-24 flex-shrink-0 text-[12px] font-medium text-gray-600 text-right truncate">
                    {money((parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0))}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    disabled={items.length === 1}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-2 text-sm">
              <span className="text-gray-500 mr-2">Subtotal</span>
              <span className="font-bold text-gray-900">{money(subtotal)}</span>
            </div>
          </div>

          <div>
            <label className={labelClass}>Refund Mode</label>
            <div className="flex flex-wrap gap-2">
              {MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode((prev) => (prev === m ? "" : m))}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    mode === m ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-300 text-gray-600 hover:border-gray-400"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Reason</label>
              <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Damaged goods" className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <div className="relative">
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${fieldClass} appearance-none bg-white cursor-pointer pr-8`}>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Internal notes about this return..."
              className="w-full px-3 py-2 border border-[#1F2937]/10 rounded-2xl text-[12px] focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all resize-none"
            />
          </div>
        </form>

        {/* Footer — matches the CompanyForm/ItemForm quick-drawer footer spec */}
        <div className="flex-shrink-0 py-2.5 px-4 border-t border-gray-100 bg-white flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-6 py-2 border border-gray-200 text-gray-700 rounded-[25px] text-sm font-bold hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="pr-form"
            disabled={saving}
            className="px-6 py-2 bg-[#158FFF] text-white rounded-[25px] text-sm font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Return"}
          </button>
        </div>
      </div>
    </>
  );
};

export default PurchaseReturnForm;
