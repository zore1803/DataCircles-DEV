import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Minus, AlertTriangle, MinusCircle, PlusCircle, ChevronDown } from "lucide-react";
import API from "../../services/api";
import toast from "react-hot-toast";
import { getAncestorZoom } from "../../utils/domUtils";

/*
 * Records a single stock-in or stock-out against one item. The direction is fixed by the caller
 * (the row's Stock In / Stock Out buttons), so this form never asks the user which way stock is
 * moving — only how much, when, and why.
 *
 * The backend is the authority on whether an out-movement is allowed: it rejects removing more
 * than is on hand unless `allowNegative` is sent. This form surfaces that as an inline
 * confirmation rather than silently forcing it through.
 */

// Suggestions for the Category combobox. The field is free-text — these are only shortcuts, and
// anything typed here is stored verbatim (the backend maps known wordings onto its reason enum).
const CATEGORY_SUGGESTIONS = {
  in: ["Purchase", "Customer Return", "Opening Stock", "Adjustment", "Transfer In", "Other"],
  out: ["Sale", "Damage / Loss", "Adjustment", "Transfer Out", "Other"],
};

// <input type="date"> needs yyyy-MM-dd regardless of how the value is displayed.
const toDateInputValue = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

/*
 * Free-text combobox: type anything, or pick from the suggestions.
 *
 * Deliberately NOT a native <datalist> — browsers render that with their own OS chrome (an
 * opaque dark popup on Windows) that ignores the app's styling entirely. This mirrors
 * common/CustomDropdown instead: the menu is portaled to <body> at a fixed position measured off
 * the trigger, so a drawer's `overflow-y-auto` can't clip it, and it sits above the drawer's
 * z-index. CustomDropdown itself can't be reused here because it's select-only (a <button>), and
 * this field has to stay typeable.
 */
function CategoryCombobox({ value, onChange, options, placeholder, className }) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const wrapRef = useRef(null);
  const fieldRef = useRef(null);
  const menuRef = useRef(null);

  const positionMenu = () => {
    const el = fieldRef.current;
    if (!el) return;
    const zoom = getAncestorZoom(document.body);
    const rect = el.getBoundingClientRect();
    const viewportH = window.innerHeight / zoom;
    const viewportW = window.innerWidth / zoom;
    const MAX_MENU_H = 240;
    const MARGIN = 8;

    const top = rect.bottom / zoom;
    const spaceBelow = viewportH - top;
    // Flip above the field when there isn't room below — the drawer's category field sits
    // mid-panel, so a menu pinned below would otherwise run off the bottom.
    const openUp = spaceBelow < Math.min(MAX_MENU_H, 160) && rect.top / zoom > spaceBelow;

    setMenuPos({
      top: openUp ? undefined : top + 4,
      bottom: openUp ? viewportH - rect.top / zoom + 4 : undefined,
      left: Math.min(rect.left / zoom, viewportW - rect.width / zoom - MARGIN),
      width: rect.width / zoom,
      maxHeight: Math.max(120, (openUp ? rect.top / zoom : spaceBelow) - MARGIN - 4),
    });
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    positionMenu();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (
        wrapRef.current && !wrapRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    // Capture phase so scrolling the drawer body (a nested scroll container) closes the menu
    // rather than leaving a fixed-position portal stranded away from its field.
    const handleScroll = () => setIsOpen(false);
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [isOpen]);

  // Typing narrows the suggestions, but never blocks a value that isn't in the list.
  const query = (value || "").trim().toLowerCase();
  const filtered = query
    ? options.filter((o) => o.toLowerCase().includes(query))
    : options;

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative" ref={fieldRef}>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={`${className} pr-10`}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setIsOpen((o) => !o)}
          className="absolute right-0 top-0 h-full px-3 flex items-center text-gray-400 hover:text-gray-600"
          aria-label="Show categories"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {isOpen && menuPos && createPortal(
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: menuPos.top,
            bottom: menuPos.bottom,
            left: menuPos.left,
            width: menuPos.width,
            maxHeight: menuPos.maxHeight,
            // Above this drawer (z-[99999]) — matches CustomDropdown's own stacking choice.
            zIndex: 100060,
          }}
          className="bg-white border border-[#E1E4EA] rounded-xl shadow-xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200"
        >
          <div className="overflow-y-auto py-1.5">
            {filtered.length === 0 ? (
              <div className="px-4 py-2.5 text-[13px] text-gray-400">
                No matching category — press enter to use “{value}”.
              </div>
            ) : (
              filtered.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    onChange(option);
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-2.5 text-sm text-left hover:bg-[#F2F2F7] transition-colors ${
                    option === value ? "bg-[#F2F2F7] text-blue-600 font-semibold" : "text-gray-700"
                  }`}
                >
                  {option}
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default function StockMovementModal({ isOpen, onClose, item, direction, onSuccess }) {
  const isIn = direction === "in";

  const [form, setForm] = useState({
    quantity: "",
    recordDate: toDateInputValue(new Date()),
    category: "",
    notes: "",
    unitPrice: "",
    priceIncludesTax: false,
  });
  const [loading, setLoading] = useState(false);
  // Set when the server rejects an over-issue; turns the submit button into an explicit
  // "record anyway" confirmation instead of repeating the same failing request.
  const [negativeWarning, setNegativeWarning] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setForm({
      quantity: "",
      recordDate: toDateInputValue(new Date()),
      category: "",
      notes: "",
      // Seeded from the item so the value line is meaningful straight away: an in-movement is
      // valued at what it costs to buy, an out-movement at what it sells for.
      unitPrice: String((isIn ? item?.purchasePrice : item?.sellingPrice) ?? ""),
      priceIncludesTax: false,
    });
    setNegativeWarning(null);
  }, [isOpen, direction, item?._id]);

  const currentStock = Number(item?.inventory?.currentStock) || 0;
  const qty = parseFloat(form.quantity);
  const hasQty = Number.isFinite(qty) && qty > 0;
  const projected = hasQty ? (isIn ? currentStock + qty : currentStock - qty) : currentStock;

  const movementValue = useMemo(() => {
    const price = parseFloat(form.unitPrice);
    if (!Number.isFinite(qty) || !Number.isFinite(price)) return 0;
    return qty * price;
  }, [qty, form.unitPrice]);

  if (!isOpen || !item) return null;

  const set = (patch) => setForm((p) => ({ ...p, ...patch }));

  const submit = async (allowNegative = false) => {
    if (!hasQty) {
      toast.error("Enter a quantity greater than zero");
      return;
    }
    setLoading(true);
    try {
      await API.post(`/inventory/${item._id}/stock-${isIn ? "in" : "out"}`, {
        quantity: qty,
        recordDate: form.recordDate || undefined,
        category: form.category,
        notes: form.notes,
        unitPrice: form.unitPrice === "" ? undefined : Number(form.unitPrice),
        priceIncludesTax: form.priceIncludesTax,
        ...(allowNegative ? { allowNegative: true } : {}),
      });
      toast.success(`Stock ${isIn ? "added" : "removed"} successfully`);
      onSuccess?.();
      onClose();
    } catch (err) {
      const data = err.response?.data;
      if (data?.code === "INSUFFICIENT_STOCK") {
        setNegativeWarning(data.error);
      } else {
        toast.error(data?.error || `Failed to record stock ${isIn ? "in" : "out"}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const accentBtn = isIn
    ? "bg-[#16A34A] hover:bg-green-700"
    : "bg-[#DC2626] hover:bg-red-700";

  const fieldClass =
    "w-full h-11 px-3 border border-[#E1E4EA] rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:border-[#0085FF] focus:ring-1 focus:ring-[#0085FF]";
  const labelClass = "block text-sm font-semibold text-gray-800 mb-1.5";
  const helpClass = "mt-1.5 text-xs text-gray-500 leading-relaxed";

  return (
    <>
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[99998]" onClick={onClose} aria-hidden="true" />

      <div className="fixed dc-panel-card dc-panel-w bg-white shadow-2xl z-[99999] flex flex-col overflow-hidden animate-slideInRight">
        {/* ── Header: close + item name on the left, the primary action on the right ── */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#E1E4EA] bg-white flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold text-gray-900 truncate">{item.name}</h2>
          </div>
          <button
            type="button"
            onClick={() => submit(!!negativeWarning)}
            disabled={loading}
            className={`flex items-center gap-2 px-4 h-10 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50 flex-shrink-0 ${accentBtn}`}
          >
            {isIn ? <PlusCircle className="w-4 h-4" /> : <MinusCircle className="w-4 h-4" />}
            {isIn ? "Add quantity" : "Remove quantity"}
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto bg-[#F7F8FA] px-5 py-5 space-y-5">
          {/* Quantity information */}
          <div>
            <div className="flex items-center justify-between gap-3 mb-2.5">
              <h3 className="text-base font-bold text-gray-900">Quantity information</h3>
              {/* Out-only: prefills the quantity with everything on hand, i.e. zero the item out. */}
              {!isIn && (
                <button
                  type="button"
                  onClick={() => {
                    set({ quantity: String(currentStock) });
                    setNegativeWarning(null);
                  }}
                  className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <MinusCircle className="w-4 h-4" />
                  Clear Stock
                </button>
              )}
            </div>

            <div className="bg-white border border-[#E1E4EA] rounded-xl p-5 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>
                    <span className="text-red-500">*</span> Quantity
                  </label>
                  {/* Unit is a fixed suffix, not an input — the item's own unit governs. */}
                  <div className="flex items-stretch">
                    <input
                      type="number"
                      autoFocus
                      min="0"
                      step="any"
                      value={form.quantity}
                      onChange={(e) => {
                        set({ quantity: e.target.value });
                        setNegativeWarning(null);
                      }}
                      placeholder="0"
                      className={`${fieldClass} rounded-r-none`}
                    />
                    <span className="h-11 px-3 flex items-center border border-l-0 border-[#E1E4EA] rounded-r-lg bg-gray-50 text-sm font-semibold text-gray-600 whitespace-nowrap">
                      {(item.primaryUnit || "PCS").split(" ")[0]}
                    </span>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Record Date</label>
                  <input
                    type="date"
                    value={form.recordDate}
                    onChange={(e) => set({ recordDate: e.target.value })}
                    className={fieldClass}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Select Category</label>
                {/* Free-text with suggestions — the reference allows typing a custom category. */}
                <CategoryCombobox
                  value={form.category}
                  onChange={(v) => set({ category: v })}
                  options={CATEGORY_SUGGESTIONS[isIn ? "in" : "out"]}
                  placeholder="Select category or type your own"
                  className={fieldClass}
                />
                <p className={helpClass}>
                  Choose the category or type your own category that describes the reason for this
                  stock {isIn ? "in" : "out"}.
                </p>
              </div>

              <div>
                <label className={labelClass}>Remarks</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => set({ notes: e.target.value })}
                  className="w-full px-3 py-2.5 border border-[#E1E4EA] rounded-lg text-sm resize-y focus:outline-none focus:border-[#0085FF] focus:ring-1 focus:ring-[#0085FF]"
                />
                <p className={helpClass}>Add notes here to help you remember important details.</p>
              </div>
            </div>
          </div>

          {/* Price details */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <h3 className="text-base font-bold text-gray-900">
                Price Details (used to calculate P&amp;L reports)
              </h3>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                Optional
              </span>
            </div>

            <div className="bg-white border border-[#E1E4EA] rounded-xl p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Price</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.unitPrice}
                    onChange={(e) => set({ unitPrice: e.target.value })}
                    placeholder="0"
                    className={fieldClass}
                  />
                  <label className="mt-2.5 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.priceIncludesTax}
                      onChange={(e) => set({ priceIncludesTax: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-xs text-gray-600">This price includes tax as well.</span>
                  </label>
                </div>

                <div>
                  <label className={labelClass}>Stock {isIn ? "In" : "Out"} Value</label>
                  {/* Derived, never typed — qty × price, so it can't disagree with the inputs. */}
                  <div className="w-full h-11 px-3 flex items-center border border-[#E1E4EA] rounded-lg bg-gray-50 text-sm font-semibold text-gray-900">
                    {movementValue.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Current -> projected, so the effect of the entry is visible before saving. */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white border border-[#E1E4EA]">
            <span className="text-sm text-gray-500">Current stock</span>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="text-gray-900">{currentStock}</span>
              {hasQty && (
                <>
                  <span className="text-gray-400">→</span>
                  <span className={projected < 0 ? "text-red-600" : "text-gray-900"}>{projected}</span>
                </>
              )}
              <span className="text-[11px] font-medium text-gray-400 uppercase">
                {(item.primaryUnit || "").split(" ")[0]}
              </span>
            </div>
          </div>

          {negativeWarning && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-amber-900">{negativeWarning}</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Recording this will leave the item with negative stock.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Sticky footer action, mirroring the header button ── */}
        <div className="flex-shrink-0 px-5 py-4 border-t border-[#E1E4EA] bg-white">
          <button
            type="button"
            onClick={() => submit(!!negativeWarning)}
            disabled={loading}
            className={`w-full h-11 flex items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
              negativeWarning ? "bg-amber-500 hover:bg-amber-600" : accentBtn
            }`}
          >
            {loading && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {!loading && (isIn ? <Plus className="w-4 h-4" /> : <Minus className="w-4 h-4" />)}
            {negativeWarning ? "Record Anyway" : isIn ? "Add Quantity" : "Remove Quantity"}
          </button>
        </div>
      </div>
    </>
  );
}
