import React, { useMemo } from "react";
import { RotateCcw, Zap } from "lucide-react";

const formatMoney = (n) =>
  `₹${(Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (d) => {
  if (!d) return "";
  const date = new Date(d);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

// Settles a payment against the party's open documents. Credit payments list
// invoices, Debit payments list purchase bills — the shape is identical, only
// the labels differ, which is what the `documentType` prop switches.
//
// Two invariants are enforced here as well as on the server: no single line
// can exceed what that document still owes, and the lines together can't
// exceed the payment. Whatever is left over is shown as the credit balance
// that will be stored against the party for later use, not silently dropped.
export default function PaymentAllocationPanel({
  documentType,          // "Invoice" | "Purchase"
  documents,             // [{ _id, number, date, dueDate, total, paid, due }]
  loading,
  allocations,           // { [documentId]: string }
  onChange,              // (nextAllocations) => void
  paymentAmount,
  partySelected,
  creditBalance = 0,
  // The panel serves two callers now — a new payment being split, and an
  // existing credit balance being spent. The running-total labels differ
  // between those ("Payment amount" vs "Credit available"), and the empty
  // state does too, so they're passed in rather than hardcoded.
  amountLabel = "Payment amount",
  emptyHint = "The full amount will be held as a credit balance.",
  leftoverLabel = "Left as credit balance",
  leftoverHint = null,
  // Noun used in the over-applied warning — "payment" when splitting a new
  // one, "credit" when spending a balance.
  amountNoun = "payment",
}) {
  const isInvoice = documentType === "Invoice";
  const docLabel = isInvoice ? "invoice" : "bill";
  const docLabelPlural = isInvoice ? "invoices" : "bills";

  const amount = Number(paymentAmount) || 0;

  const totalAllocated = useMemo(
    () =>
      Object.values(allocations).reduce(
        (sum, v) => sum + (Number(v) || 0),
        0
      ),
    [allocations]
  );

  const unallocated = Math.round((amount - totalAllocated) * 100) / 100;
  const overAllocated = unallocated < -0.01;

  const setLine = (docId, value) => {
    const next = { ...allocations };
    if (value === "" || value === null) delete next[docId];
    else next[docId] = value;
    onChange(next);
  };

  // Oldest document first until the money runs out — the ordinary way a
  // receipt gets applied, offered as one click instead of typed by hand.
  const autoAllocate = () => {
    let remaining = amount;
    const next = {};
    for (const doc of documents) {
      if (remaining <= 0.01) break;
      const take = Math.min(doc.due, remaining);
      if (take > 0.01) {
        next[doc._id] = String(Math.round(take * 100) / 100);
        remaining = Math.round((remaining - take) * 100) / 100;
      }
    }
    onChange(next);
  };

  if (!partySelected) {
    return (
      <div className="rounded-2xl border border-dashed border-[#1F2937]/15 px-4 py-6 text-center">
        <p className="text-[12px] text-[#1F2937] opacity-50">
          Pick a {isInvoice ? "customer" : "vendor"} to see their open {docLabelPlural}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-[13px] font-medium text-[#161618] tracking-[-0.05em]">
          Apply to open {docLabelPlural}
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={autoAllocate}
            disabled={!documents.length || amount <= 0}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-[#1F2937]/10 text-[11px] font-medium text-[#158FFF] hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title={`Fill oldest ${docLabel} first`}
          >
            <Zap className="w-3 h-3" />
            Auto-apply
          </button>
          <button
            type="button"
            onClick={() => onChange({})}
            disabled={totalAllocated === 0}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-[#1F2937]/10 text-[11px] font-medium text-[#78788D] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Clear
          </button>
        </div>
      </div>

      {creditBalance > 0.01 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
          <p className="text-[11px] text-amber-800">
            This {isInvoice ? "customer" : "vendor"} already has{" "}
            <span className="font-semibold">{formatMoney(creditBalance)}</span> in unapplied credit
            from earlier payments.
          </p>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-[#1F2937]/10 px-4 py-6 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-[#158FFF] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : documents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#1F2937]/15 px-4 py-6 text-center">
          <p className="text-[12px] text-[#1F2937] opacity-60">
            No open {docLabelPlural} for this {isInvoice ? "customer" : "vendor"}.
          </p>
          <p className="text-[11px] text-[#1F2937] opacity-40 mt-1">{emptyHint}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#1F2937]/10 divide-y divide-[#1F2937]/5 max-h-64 overflow-y-auto">
          {documents.map((doc) => {
            const value = allocations[doc._id] ?? "";
            const numeric = Number(value) || 0;
            const exceedsDue = numeric > doc.due + 0.01;

            return (
              <div key={doc._id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium text-[#1F2937] truncate">
                    {doc.number || `${documentType} ${String(doc._id).slice(-6)}`}
                  </p>
                  <p className="text-[10.5px] text-[#1F2937] opacity-50 truncate">
                    {/* Whose document this is — shown when the list can span
                        several parties, which it does whenever credit is being
                        spent across customers. */}
                    {doc.partyName ? `${doc.partyName} · ` : ""}
                    {formatDate(doc.date)} · {formatMoney(doc.total)} total
                    {doc.paid > 0.01 ? ` · ${formatMoney(doc.paid)} paid` : ""}
                  </p>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-[10.5px] text-[#1F2937] opacity-50">Due</p>
                  <p className="text-[12px] font-semibold text-[#1F2937]">{formatMoney(doc.due)}</p>
                </div>

                <div className="w-28 flex-shrink-0">
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#1F2937] opacity-50 text-[11px]">
                      ₹
                    </span>
                    <input
                      type="number"
                      min="0"
                      max={doc.due}
                      step="0.01"
                      value={value}
                      placeholder="0.00"
                      onChange={(e) => setLine(doc._id, e.target.value)}
                      className={`w-full border rounded-full pl-6 pr-2 h-[32px] text-[12px] text-[#1F2937] focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all ${
                        exceedsDue ? "border-red-500" : "border-[#1F2937]/10"
                      }`}
                    />
                  </div>
                  {exceedsDue && (
                    <p className="mt-0.5 text-[10px] text-red-600 text-right">
                      Max {formatMoney(doc.due)}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    // Capped by whatever is still unapplied (plus whatever
                    // this line already holds, so re-clicking it isn't
                    // penalised) — filling a document's whole balance must
                    // never push the total past the money available.
                    const availableForLine = Math.round((unallocated + numeric) * 100) / 100;
                    const take = Math.min(doc.due, Math.max(0, availableForLine));
                    setLine(doc._id, String(Math.round(take * 100) / 100));
                  }}
                  className="flex-shrink-0 text-[10.5px] font-medium text-[#158FFF] hover:underline"
                  title={`Apply as much of this ${docLabel} as the amount covers`}
                >
                  Full
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Running total. The leftover line is the whole point of the feature —
          it says out loud where unapplied money goes instead of leaving the
          user to wonder whether it vanished. */}
      <div className="rounded-2xl bg-gray-50 border border-[#1F2937]/5 px-3 py-2.5 space-y-1">
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-[#78788D]">{amountLabel}</span>
          <span className="font-medium text-[#1F2937]">{formatMoney(amount)}</span>
        </div>
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-[#78788D]">Applied to {docLabelPlural}</span>
          <span className="font-medium text-[#1F2937]">{formatMoney(totalAllocated)}</span>
        </div>
        <div className="flex items-center justify-between text-[12px] pt-1 border-t border-[#1F2937]/5">
          <span className={overAllocated ? "text-red-600 font-medium" : "text-[#78788D]"}>
            {overAllocated ? "Over-applied by" : leftoverLabel}
          </span>
          <span className={`font-semibold ${overAllocated ? "text-red-600" : "text-[#158FFF]"}`}>
            {formatMoney(Math.abs(unallocated))}
          </span>
        </div>
        {overAllocated && (
          <p className="text-[10.5px] text-red-600">
            Reduce the applied amounts — they can&rsquo;t add up to more than the {amountNoun}.
          </p>
        )}
        {!overAllocated && unallocated > 0.01 && (
          <p className="text-[10.5px] text-[#1F2937] opacity-50">
            {leftoverHint ||
              `Held against this ${isInvoice ? "customer" : "vendor"} and reusable on a future ${docLabel}.`}
          </p>
        )}
      </div>
    </div>
  );
}
