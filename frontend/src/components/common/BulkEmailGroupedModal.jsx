import React, { useMemo, useState } from "react";
import { X, Mail, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import API from "../../services/api";

/**
 * BulkEmailGroupedModal — Invoices tab only.
 *
 * Groups the selected invoices by customer email (from deal.company.email),
 * shows a preview of what will be sent, then POSTs to the backend which
 * generates PDFs server-side and sends one email per customer with all their
 * invoice PDFs attached.
 */
const BulkEmailGroupedModal = ({ isOpen, onClose, selectedIds, documents, onSuccess }) => {
  const [sending, setSending] = useState(false);

  // Build groups from the already-loaded invoice list so the user gets an
  // instant preview without an extra round-trip. Deduplication is done here
  // and the backend also deduplicates for safety.
  const { groups, skipped } = useMemo(() => {
    if (!isOpen || !selectedIds || selectedIds.length === 0) {
      return { groups: [], skipped: [] };
    }

    const seenIds = new Set();
    const emailMap = {};
    const skippedList = [];

    for (const id of selectedIds) {
      // Deduplicate
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      const doc = documents.find((d) => d._id === id);
      if (!doc) {
        // Not found on the current page — backend will handle it, but surface it
        skippedList.push({ id, label: id, reason: "not in current page view" });
        continue;
      }

      if (!doc.deal) {
        skippedList.push({ id, label: `#${doc.invoiceNumber || id}`, reason: "no deal linked" });
        continue;
      }

      const email = doc.deal?.company?.email;
      if (!email) {
        skippedList.push({ id, label: `#${doc.invoiceNumber || id}`, reason: "no customer email" });
        continue;
      }

      if (!emailMap[email]) {
        const companyName =
          doc.deal?.company?.name || doc.deal?.title || email;
        emailMap[email] = { email, companyName, invoices: [] };
      }
      emailMap[email].invoices.push(doc);
    }

    return {
      groups: Object.values(emailMap),
      skipped: skippedList,
    };
  }, [isOpen, selectedIds, documents]);

  const sendableIds = groups.flatMap((g) => g.invoices.map((inv) => inv._id));
  const totalEmails = groups.length;

  const handleSend = async () => {
    if (sendableIds.length === 0) return;
    setSending(true);
    try {
      const res = await API.post("/invoices/bulk-email-grouped", { ids: sendableIds });
      const { successfulIds = [], failedIds = [], skippedIds = [] } = res.data;
      const sentInvoiceCount = successfulIds.length;
      // Count how many distinct email groups had at least one success
      const emailsSent = groups.filter((g) =>
        g.invoices.some((inv) => successfulIds.includes(inv._id))
      ).length;
      const skipCount = skippedIds.length + skipped.length;

      if (sentInvoiceCount > 0) {
        toast.success(
          `Sent ${emailsSent} email${emailsSent !== 1 ? "s" : ""} (${sentInvoiceCount} invoice${sentInvoiceCount !== 1 ? "s" : ""})${skipCount > 0 ? `. ${skipCount} skipped.` : ""}`
        );
      } else {
        toast.error("All emails failed — check email server configuration");
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to send emails");
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  const formatAmount = (amount) =>
    amount != null
      ? `₹${Number(amount).toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : "";

  // Collect unique skip reasons for the warning summary
  const uniqueReasons = [...new Set(skipped.map((s) => s.reason))];

  return (
    <div className="relative z-[100]">
      <div
        className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onClose}
      />
      <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div className="mx-auto max-w-lg w-full bg-white rounded-2xl shadow-xl overflow-hidden pointer-events-auto flex flex-col max-h-[80vh]">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white flex-shrink-0">
            <h2 className="text-lg font-semibold text-gray-900">
              Send Invoices by Email
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body — scrollable */}
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            {groups.length === 0 && skipped.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-8">
                No invoices selected.
              </p>
            )}

            {/* One card per customer */}
            {groups.map((group) => (
              <div
                key={group.email}
                className="border border-gray-200 rounded-xl overflow-hidden"
              >
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">
                    {group.companyName}
                  </p>
                  <p className="text-xs text-gray-500">{group.email}</p>
                </div>
                <ul className="divide-y divide-gray-100">
                  {group.invoices.map((inv) => (
                    <li
                      key={inv._id}
                      className="px-4 py-2.5 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        {/* Green dot = will be sent */}
                        <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                        </div>
                        <span className="text-sm text-gray-700">
                          #{inv.invoiceNumber || inv._id}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {formatAmount(inv.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* Skipped invoices warning */}
            {skipped.length > 0 && (
              <div className="border border-amber-200 bg-amber-50 rounded-xl p-4">
                <div className="flex items-start gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-amber-800">
                    {skipped.length} invoice{skipped.length !== 1 ? "s" : ""} cannot
                    be sent ({uniqueReasons.join(", ")})
                  </p>
                </div>
                <p className="text-xs text-amber-700 ml-6">
                  {skipped.map((s) => s.label).join(", ")}
                </p>
              </div>
            )}
          </div>

          {/* Summary bar */}
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex-shrink-0">
            <p className="text-xs text-gray-500 text-center">
              {totalEmails} email{totalEmails !== 1 ? "s" : ""} will be sent
              &nbsp;·&nbsp;
              {sendableIds.length} invoice{sendableIds.length !== 1 ? "s" : ""}{" "}
              attached
            </p>
          </div>

          {/* Actions */}
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-white flex-shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending || sendableIds.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {sending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  Send {totalEmails} Email{totalEmails !== 1 ? "s" : ""}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkEmailGroupedModal;
