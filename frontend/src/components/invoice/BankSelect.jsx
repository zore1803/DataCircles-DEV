// Bank-account picker for the invoice / quotation / proforma / challan forms.
// A custom dropdown (not a native <select>) so each row can show the bank's
// logo via <BankLogo>, matching the payment form's picker. The chosen account
// id rides on the document payload as `bankDetails`; the backend prints that
// account, falling back to the org default when it's blank.
import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import BankLogo from "../BankLogo";

const labelFor = (b) => b?.bankName || b?.bank || "Bank";
const lastFourOf = (b) =>
  b?.accountNumber ? String(b.accountNumber).slice(-4) : "";

const BankSelect = ({ banks = [], value = "", onChange }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  // Close on outside click / Escape, like every other menu in these forms.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = banks.find((b) => b._id === value) || null;

  const pick = (id) => {
    onChange?.(id);
    setOpen(false);
  };

  return (
    <div className="relative w-full" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 h-10 rounded-lg border border-gray-200 bg-white px-3 text-[13px] focus:outline-none focus:border-blue-500 transition-colors"
      >
        {selected ? (
          <span className="flex items-center gap-2 min-w-0">
            <BankLogo bankName={labelFor(selected)} size={20} />
            <span className="truncate text-[#1F2937]">
              {labelFor(selected)}
              {selected.branch ? ` (${selected.branch})` : ""}
              {lastFourOf(selected) ? ` — XXXX${lastFourOf(selected)}` : ""}
              {selected.isDefault ? " (Default)" : ""}
            </span>
          </span>
        ) : (
          <span className="text-gray-400">No bank on this document</span>
        )}
        <ChevronDown
          className={`w-4 h-4 flex-shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-20 w-full mt-1.5 bg-white border border-gray-100 rounded-xl shadow-xl max-h-56 overflow-y-auto">
          <button
            type="button"
            onClick={() => pick("")}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-[12px] text-left hover:bg-gray-50 transition-colors text-gray-500"
          >
            No bank on this document
          </button>
          {banks.map((b) => {
            const name = labelFor(b);
            const lastFour = lastFourOf(b);
            return (
              <button
                key={b._id}
                type="button"
                onClick={() => pick(b._id)}
                className={`flex items-center gap-2.5 w-full px-4 py-2.5 text-[12px] text-left hover:bg-gray-50 transition-colors ${b._id === value ? "bg-gray-50" : ""}`}
              >
                <BankLogo bankName={name} size={20} />
                <span className="font-medium text-[#1F2937] truncate">
                  {name}
                  {b.branch ? ` (${b.branch})` : ""}
                  {b.isDefault ? " (Default)" : ""}
                </span>
                {lastFour && (
                  <span className="text-[#1F2937] opacity-50 text-[11px] ml-auto flex-shrink-0">
                    XXXX{lastFour}
                  </span>
                )}
              </button>
            );
          })}
          {banks.length === 0 && (
            <div className="px-4 py-3 text-[12px] text-gray-400">
              No bank accounts yet — add them in Settings → Bank Details.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BankSelect;
