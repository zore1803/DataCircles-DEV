import React, { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import API from "../../services/api";
import toast from "react-hot-toast";
import SearchableDropdown from "../contact/SearchableDropdown";

const REFUND_MODES = ["Cash", "UPI", "Bank Transfer", "Cheque", "Card", "Credit Note", "Other"];
const STATUS_OPTIONS = ["Draft", "Pending", "Confirmed", "Refunded", "Cancelled"];
const REASON_OPTIONS = ["Damaged", "Defective", "Wrong Item", "Wrong Size/Variant", "Customer Changed Mind", "Other"];

const money = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const lineKey = (itemId, variantId) => `${itemId || ""}|${variantId || "none"}`;

/*
 * Right-drawer create/edit form for a Sales Return.
 *
 * A Sales Return is ALWAYS against an existing Invoice — the backend derives
 * customer/deal from that Invoice server-side and refuses any Sales Return
 * without one. Flow: pick Invoice -> customer + invoice items auto-load with
 * Original / Already Returned / Remaining -> enter Return Qty + Reason per
 * line coming back -> Draft or Confirm.
 *
 * "Confirmed" is the single status that moves stock (Sales Return brings
 * goods IN — see salesReturnController.syncSalesReturnStock) and is terminal
 * once reached; the STATUS can only move onward to Refunded (financial only).
 * Item quantities remain editable after Confirmed: the backend applies the
 * delta between the old and new quantity, never the full new quantity again.
 */
const SalesReturnForm = ({ editingReturn, onRequestClose, onSuccess, onError }) => {
  const isEditing = !!editingReturn;
  const [isSliding, setIsSliding] = useState(false);

  const [invoices, setInvoices] = useState([]);
  const [invoiceId, setInvoiceId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [availableItems, setAvailableItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const [lines, setLines] = useState({});
  const [originalQuantities, setOriginalQuantities] = useState({});

  const [returnDate, setReturnDate] = useState(new Date().toISOString().split("T")[0]);
  const [refundMode, setRefundMode] = useState("");
  const [refundReference, setRefundReference] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("Draft");
  const [saving, setSaving] = useState(false);

  const oldStatus = editingReturn?.status;
  const isLocked = oldStatus === "Confirmed" || oldStatus === "Refunded";
  const availableStatusOptions = oldStatus === "Confirmed"
    ? ["Confirmed", "Refunded"]
    : oldStatus === "Refunded"
      ? ["Refunded"]
      : STATUS_OPTIONS.filter((s) => s !== "Refunded" || isEditing);

  useEffect(() => {
    setTimeout(() => setIsSliding(true), 10);
  }, []);

  useEffect(() => {
    API.get("/invoices")
      .then((res) => {
        const list = res.data?.invoices || res.data || [];
        setInvoices(Array.isArray(list) ? list : []);
      })
      .catch(() => setInvoices([]));
  }, []);

  const loadAvailableItems = async (id, excludeReturnId) => {
    if (!id) {
      setAvailableItems([]);
      setCustomerName("");
      setInvoiceNumber("");
      return;
    }
    setLoadingItems(true);
    try {
      const params = excludeReturnId ? `?excludeReturnId=${excludeReturnId}` : "";
      const res = await API.get(`/sales-returns/invoice/${id}/available${params}`);
      const deal = res.data.invoice?.deal;
      setCustomerName(
        deal?.contact?.name || deal?.company?.name || deal?.contactPerson || deal?.title || "Customer"
      );
      setInvoiceNumber(res.data.invoice.invoiceNumber);
      setAvailableItems(res.data.items || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load invoice items");
      setAvailableItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    if (!editingReturn) return;
    const iId = editingReturn.invoice?._id || editingReturn.invoice || "";
    setInvoiceId(iId);
    setReturnDate(
      editingReturn.returnDate
        ? new Date(editingReturn.returnDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0]
    );
    setRefundMode(editingReturn.refundMode || "");
    setRefundReference(editingReturn.refundReference || "");
    setReason(editingReturn.reason || "");
    setNotes(editingReturn.notes || "");
    setStatus(editingReturn.status || "Draft");

    const seeded = {};
    const original = {};
    (editingReturn.items || []).forEach((it) => {
      const itemId = it.itemId?._id || it.itemId;
      const key = lineKey(itemId, it.variantId);
      seeded[key] = { returnQty: it.quantity, reason: it.reason || "" };
      original[key] = it.quantity;
    });
    setLines(seeded);
    setOriginalQuantities(original);

    if (iId) loadAvailableItems(iId, editingReturn._id);
  }, [editingReturn]);

  const handleClose = () => {
    setIsSliding(false);
    setTimeout(() => onRequestClose(), 300);
  };

  const handleInvoiceChange = (id) => {
    setInvoiceId(id);
    setLines({});
    loadAvailableItems(id, null);
  };

  const setLine = (key, patch) => {
    setLines((prev) => ({ ...prev, [key]: { ...(prev[key] || { returnQty: "", reason: "" }), ...patch } }));
  };

  const selectedLines = useMemo(
    () =>
      availableItems
        .map((item) => {
          const key = lineKey(item.itemId, item.variantId);
          const line = lines[key];
          const qty = parseFloat(line?.returnQty) || 0;
          return { item, key, qty, reason: line?.reason || "" };
        })
        .filter((l) => l.qty > 0),
    [availableItems, lines]
  );

  const subtotal = selectedLines.reduce((sum, l) => sum + l.qty * (l.item.unitPrice || 0), 0);

  const invoiceOptions = invoices.map((inv) => ({
    _id: inv._id,
    label: `${inv.invoiceNumber} · ${
      inv.deal?.contact?.name || inv.deal?.company?.name || inv.deal?.title || "Customer"
    } · ${money(inv.amount)}`,
  }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!invoiceId) return toast.error("Select an Invoice to return against");
    if (selectedLines.length === 0) return toast.error("Enter a Return Qty for at least one item");

    const overLimit = selectedLines.find(
      (l) => l.qty > (l.item.remaining + (originalQuantities[l.key] || 0))
    );
    if (overLimit) {
      const cap = overLimit.item.remaining + (originalQuantities[overLimit.key] || 0);
      return toast.error(`Only ${cap} unit(s) available to return for "${overLimit.item.name}"`);
    }

    setSaving(true);
    try {
      const payload = {
        invoice: invoiceId,
        returnDate,
        items: selectedLines.map((l) => ({
          itemId: l.item.itemId || undefined,
          variantId: l.item.variantId || undefined,
          parentItemId: l.item.parentItemId || undefined,
          isVariant: !!l.item.variantId,
          name: l.item.variantName ? `${l.item.name} (${l.item.variantName})` : l.item.name,
          description: l.item.description || "",
          hsn: l.item.hsn || "",
          quantity: l.qty,
          unitPrice: l.item.unitPrice,
          gstRate: l.item.gstRate,
          taxInclusive: l.item.taxInclusive,
          reason: l.reason,
        })),
        refundMode,
        refundReference,
        reason,
        notes,
        status,
      };

      if (isEditing) {
        await API.put(`/sales-returns/${editingReturn._id}`, payload);
      } else {
        await API.post("/sales-returns", payload);
      }
      onSuccess?.();
    } catch (err) {
      onError?.(err.response?.data?.error || err.response?.data?.message || "Failed to save sales return");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100020] flex justify-end">
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-300 ${isSliding ? "opacity-40" : "opacity-0"}`}
        onClick={handleClose}
      />
      <form
        onSubmit={handleSubmit}
        className={`relative bg-white w-full max-w-3xl h-full overflow-y-auto shadow-2xl transition-transform duration-300 ${isSliding ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isEditing ? "Edit Sales Return" : "New Sales Return"}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Return goods against an existing Invoice. Stock is restored on Confirm.
            </p>
          </div>
          <button type="button" onClick={handleClose} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Original Invoice *</label>
              <SearchableDropdown
                options={invoiceOptions}
                value={invoiceId}
                onChange={handleInvoiceChange}
                placeholder="Select an invoice"
                displayKey="label"
                disabled={isEditing}
              />
              {isEditing && (
                <p className="text-[11px] text-gray-400 mt-1">Invoice can't change after creation.</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Customer</label>
              <input
                type="text"
                value={customerName}
                readOnly
                placeholder="Auto-filled from invoice"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Return Date</label>
              <input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {availableStatusOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {isLocked && (
                <p className="text-[11px] text-amber-600 mt-1">
                  Already {oldStatus} — stock has been applied; only Refunded is available.
                </p>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-900">Items to return</h3>
              {loadingItems && <span className="text-xs text-gray-500">Loading…</span>}
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2 text-left">Product / Variant</th>
                    <th className="px-3 py-2 text-right">Original</th>
                    <th className="px-3 py-2 text-right">Returned</th>
                    <th className="px-3 py-2 text-right">Returnable</th>
                    <th className="px-3 py-2 text-right w-24">Return Qty</th>
                    <th className="px-3 py-2 text-right">Rate</th>
                    <th className="px-3 py-2 text-left w-40">Reason</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {availableItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-gray-400">
                        {invoiceId ? "No returnable items on this invoice." : "Select an invoice to load items."}
                      </td>
                    </tr>
                  ) : (
                    availableItems.map((item) => {
                      const key = lineKey(item.itemId, item.variantId);
                      const line = lines[key] || { returnQty: "", reason: "" };
                      const originalOnThisReturn = originalQuantities[key] || 0;
                      const displayReturned = item.alreadyReturned + originalOnThisReturn;
                      const displayReturnable = item.remaining + originalOnThisReturn;
                      const qty = parseFloat(line.returnQty) || 0;
                      const total = qty * (item.unitPrice || 0);
                      return (
                        <tr key={key} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <div className="font-medium text-gray-900">{item.name}</div>
                            {item.variantName && (
                              <div className="text-[11px] text-gray-500">{item.variantName}</div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">{item.originalQuantity}</td>
                          <td className="px-3 py-2 text-right">{displayReturned}</td>
                          <td className="px-3 py-2 text-right font-medium">{displayReturnable}</td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              max={displayReturnable}
                              step="1"
                              value={line.returnQty}
                              onChange={(e) => setLine(key, { returnQty: e.target.value })}
                              className="w-20 px-2 py-1 text-right border border-gray-200 rounded"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">{money(item.unitPrice)}</td>
                          <td className="px-3 py-2">
                            <select
                              value={line.reason}
                              onChange={(e) => setLine(key, { reason: e.target.value })}
                              className="w-full px-2 py-1 text-xs border border-gray-200 rounded"
                            >
                              <option value="">—</option>
                              {REASON_OPTIONS.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-right font-medium">{money(total)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Refund Mode</label>
              <select
                value={refundMode}
                onChange={(e) => setRefundMode(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              >
                <option value="">—</option>
                {REFUND_MODES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Refund Reference</label>
              <input
                type="text"
                value={refundReference}
                onChange={(e) => setRefundReference(e.target.value)}
                placeholder="UTR / cheque #"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Overall Reason</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              >
                <option value="">—</option>
                {REASON_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </div>
          </div>

          <div className="flex justify-end text-sm text-gray-700">
            <div className="w-64 space-y-1">
              <div className="flex justify-between"><span>Subtotal</span><span className="font-medium">{money(subtotal)}</span></div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t px-6 py-3 flex justify-end gap-2">
          <button type="button" onClick={handleClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : isEditing ? "Update" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SalesReturnForm;
