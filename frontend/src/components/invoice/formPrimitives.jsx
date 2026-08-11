import React, { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, MapPin } from "lucide-react";
import { createPortal } from "react-dom";
import { getAncestorZoom } from "../../utils/domUtils";

/*
 * Small building blocks shared by Accounting.jsx's CreateInvoicePanel (the
 * default split-view create/edit screen) and FullWidthDocumentPanel (the
 * alternate full-width layout opened via the "Hide preview" toggle). Moved
 * out to their own module so neither screen has to duplicate — and risk
 * drifting from — the other's copy of the same picker/address/label markup.
 */

export const SectionHeader = ({ number, title }) => (
  <div className="flex items-center gap-2.5 w-full mb-1.5 mt-2 first:mt-0">
    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-[#F0F6FF] text-[#0085FF] text-[10px] font-semibold flex-shrink-0">
      {number}
    </div>
    <span className="text-[15px] font-semibold text-[#1F2937] whitespace-nowrap">
      {title}
    </span>
  </div>
);

export const GSTIN_REGEX =
  /^[0-9]{2}[A-Z0-9]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/;

export const blankItem = () => ({
  _id: null,
  name: "",
  description: "",
  rate: "",
  quantity: 1,
  hsn: "",
  isVariant: false,
  parentItemId: null,
  discountType: "amount",
  discount: 0,
});

// Same shape as the backend's postalAddressSchema (Invoice/ProformaInvoice/
// Quotation/DeliveryChallan models), so the form can round-trip a document's
// saved address without dropping fields.
export const emptyAddress = () => ({
  addressLine1: "",
  addressLine2: "",
  pincode: "",
  city: "",
  state: "",
  country: "",
});

export const isAddressEmpty = (addr) =>
  !addr || Object.values(addr).every((v) => !v || !String(v).trim());

export const AddressFieldsGroup = ({ label, value, onChange, disabled = false }) => {
  const safeValue = value || emptyAddress();
  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl border border-slate-200 bg-[#FAFAFA] transition-all hover:bg-slate-50 hover:border-slate-300 w-full shadow-sm @md:col-span-2">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[#0085FF]">
          <MapPin className="w-3.5 h-3.5" />
        </div>
        <span className="text-[14px] font-semibold text-slate-800">{label}</span>
      </div>
      <div className="flex flex-col gap-3">
        <div className="relative">
          <input
            type="text"
            value={safeValue.addressLine1 || ""}
            disabled={disabled}
            onChange={(e) => onChange({ ...safeValue, addressLine1: e.target.value })}
            placeholder="Address line 1"
            className="w-full h-11 px-3.5 rounded-[12px] border border-slate-200 bg-white text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0085FF] transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200"
          />
        </div>
        <div className="relative">
          <input
            type="text"
            value={safeValue.addressLine2 || ""}
            disabled={disabled}
            onChange={(e) => onChange({ ...safeValue, addressLine2: e.target.value })}
            placeholder="Address line 2"
            className="w-full h-11 px-3.5 rounded-[12px] border border-slate-200 bg-white text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0085FF] transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200"
          />
        </div>
        <div className="grid grid-cols-2 @md:grid-cols-3 gap-3">
          <input
            type="text"
            value={safeValue.city || ""}
            disabled={disabled}
            onChange={(e) => onChange({ ...safeValue, city: e.target.value })}
            placeholder="City"
            className="w-full h-11 px-3.5 rounded-[12px] border border-slate-200 bg-white text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0085FF] transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200"
          />
          <input
            type="text"
            value={safeValue.state || ""}
            disabled={disabled}
            onChange={(e) => onChange({ ...safeValue, state: e.target.value })}
            placeholder="State"
            className="w-full h-11 px-3.5 rounded-[12px] border border-slate-200 bg-white text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0085FF] transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200"
          />
          <input
            type="text"
            value={safeValue.pincode || ""}
            disabled={disabled}
            onChange={(e) => onChange({ ...safeValue, pincode: e.target.value })}
            placeholder="Pincode"
            className="w-full h-11 px-3.5 rounded-[12px] border border-slate-200 bg-white text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0085FF] transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 @md:col-span-1 col-span-2"
          />
        </div>
        <div className="relative">
          <input
            type="text"
            value={safeValue.country || ""}
            disabled={disabled}
            onChange={(e) => onChange({ ...safeValue, country: e.target.value })}
            placeholder="Country"
            className="w-full h-11 px-3.5 rounded-[12px] border border-slate-200 bg-white text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0085FF] transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200"
          />
        </div>
      </div>
    </div>
  );
};

/* Small searchable select used for the Deal and Item pickers. Kept local so
   the panel doesn't inherit behaviour from the older form's dropdowns. */
export const PickerSelect = ({
  value,
  options,
  placeholder,
  onSelect,
  searchable = true,
  icon: Icon,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState({});
  const wrapRef = useRef(null);
  const dropdownRef = useRef(null);

  const updatePosition = useCallback(() => {
    if (open && wrapRef.current) {
      // rect is VISUAL px; this dropdown portals to document.body, which
      // paints inside the app's dynamic <html> zoom, so every rect-derived
      // value has to be divided by that zoom or it drifts off-position —
      // same correction the column menu and drag ghost already apply.
      const zoom = getAncestorZoom(document.body);
      const rect = wrapRef.current.getBoundingClientRect();
      const left = rect.left / zoom;
      const top = rect.top / zoom;
      const bottom = rect.bottom / zoom;
      const triggerWidth = rect.width / zoom;
      const viewportWidth = window.innerWidth / zoom;
      const viewportHeight = window.innerHeight / zoom;
      const spaceBelow = viewportHeight - bottom;
      const spaceAbove = top;
      const MARGIN = 8;

      // Item pickers sit in narrow grid columns — tying the dropdown's width
      // to the trigger's own width (as narrow as ~80px there) is what made
      // it look like a crushed little box. Give it a real minimum width
      // instead, and clamp so it never runs past the right edge.
      const width = Math.max(triggerWidth, 260);
      let left_ = Math.min(left, viewportWidth - width - MARGIN);
      left_ = Math.max(left_, MARGIN);

      let style = {
        position: "fixed",
        left: `${left_}px`,
        width: `${width}px`,
        zIndex: 99999, // Ensure it floats above dialogs
      };

      if (spaceBelow < 256 && spaceAbove > spaceBelow) {
        style.bottom = `${viewportHeight - top + 4}px`;
        style.maxHeight = `${Math.min(256, spaceAbove - 16)}px`;
      } else {
        style.top = `${bottom + 4}px`;
        style.maxHeight = `${Math.min(256, spaceBelow - 16)}px`;
      }
      setDropdownStyle(style);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      updatePosition();
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
      return () => {
        window.removeEventListener("resize", updatePosition);
        window.removeEventListener("scroll", updatePosition, true);
      };
    }
  }, [open, updatePosition]);

  useEffect(() => {
    const onDocClick = (e) => {
      const clickedInWrap = wrapRef.current && wrapRef.current.contains(e.target);
      const clickedInDropdown = dropdownRef.current && dropdownRef.current.contains(e.target);
      if (!clickedInWrap && !clickedInDropdown) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const selected = options.find((o) => o.value === value);
  const filtered = query
    ? options.filter((o) =>
      o.label.toLowerCase().includes(query.toLowerCase())
    )
    : options;

  return (
    <div ref={wrapRef} className="relative w-full min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full h-10 flex items-center gap-2 px-3 rounded-[25px] border border-[#E1E4EA] bg-white text-left hover:border-[#C9CFD8] focus:outline-none focus:border-[#0085FF] transition-colors"
      >
        {Icon && <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />}
        <span
          className={`flex-1 truncate text-sm ${selected ? "text-[#1F2937]" : "text-[#99A0AE]"
            }`}
        >
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="bg-white border border-[#E1E4EA] rounded-lg shadow-xl flex flex-col overflow-hidden"
        >
          {searchable && (
            <div className="p-2 bg-white border-b border-[#E1E4EA] flex-shrink-0">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="w-full h-8 px-2 text-sm rounded-md border border-[#E1E4EA] focus:outline-none focus:border-[#0085FF]"
              />
            </div>
          )}
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 && (
              <p className="px-3 py-3 text-sm text-gray-400">No results</p>
            )}
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onSelect(o);
                  setOpen(false);
                  setQuery("");
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 transition-colors ${o.value === value ? "bg-blue-50 text-blue-600 font-medium" : "text-gray-700"
                  }`}
              >
                <span className="flex-1 truncate">{o.label}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export const FieldLabel = ({ children, required }) => (
  <label className="block text-xs text-[#525866] mb-1.5">
    {children}
    {required && <span className="text-red-500 ml-0.5">*</span>}
  </label>
);
