import React from "react";
import { PackageX, X } from "lucide-react";

// Parses backend inventorySync.js's thrown message — either
// "Insufficient stock for product: <name>" or
// "Insufficient stock for variant of: <name>" — into just the product name,
// so the dialog can bold it instead of repeating the raw sentence.
const parseItemName = (message) => {
  const match = /Insufficient stock for (?:variant of: )?(.+)$/i.exec(message || "");
  return match ? match[1].trim() : null;
};

// Centered confirmation-style dialog (same shell as the "Unsaved Changes"
// dialogs in CompanyForm/QuickDealForm etc.) shown instead of a toast when a
// document save fails specifically because an item's quantity exceeds
// available stock — a toast disappears before the user can act on it, and
// this failure needs a deliberate "go fix the quantity" response, not a
// passive notice.
const InsufficientStockDialog = ({ isOpen, message, onClose }) => {
  if (!isOpen) return null;

  const itemName = parseItemName(message);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100030] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="relative px-6 pt-6 pb-5 text-center">
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="mx-auto w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
            <PackageX className="w-7 h-7 text-red-500" strokeWidth={1.75} />
          </div>

          <h3 className="text-[16px] font-bold text-[#111216] mb-1.5">
            Insufficient Stock
          </h3>

          <p className="text-sm text-gray-500 leading-relaxed">
            {itemName ? (
              <>
                <span className="font-semibold text-gray-700">{itemName}</span> doesn't have
                enough stock to cover the quantity on this document.
              </>
            ) : (
              message || "One or more items don't have enough stock to cover the quantity on this document."
            )}
            {" "}Reduce the quantity or restock the item, then try again.
          </p>
        </div>

        <div className="px-6 pb-6">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-[#158FFF] hover:opacity-90 text-white text-sm font-bold rounded-[25px] transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

export default InsufficientStockDialog;
