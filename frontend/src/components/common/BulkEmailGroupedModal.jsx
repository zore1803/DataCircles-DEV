import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
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
  const [emailOverrides, setEmailOverrides] = useState({});

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

      const companyId = doc.deal?.company?._id || `unknown_company_${doc._id}`;
      const contactId = doc.deal?.contact?._id || `unknown_contact_${doc._id}`;
      const groupKey = contactId; // Group by contact ID so each point-of-contact gets a separate email
      
      const contactName = doc.deal?.contact?.name || "";
      const defaultEmail = doc.deal?.contact?.email || "";
      const companyEmail = doc.deal?.company?.email || "";
      const email = emailOverrides[groupKey] !== undefined ? emailOverrides[groupKey] : defaultEmail;
      
      if (!emailMap[groupKey]) {
        const companyName =
          doc.deal?.company?.name || doc.deal?.title || email || "Unknown Customer";
        emailMap[groupKey] = { groupKey, email, defaultEmail, contactName, companyName, companyEmail, invoices: [] };
      }
      emailMap[groupKey].invoices.push(doc);
    }

    return {
      groups: Object.values(emailMap),
      skipped: skippedList,
    };
  }, [isOpen, selectedIds, documents, emailOverrides]);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isValidGroupEmail = (g) => g.email.trim() !== "" && emailRegex.test(g.email.trim());
  const sendableIds = groups.filter(isValidGroupEmail).flatMap((g) => g.invoices.map((inv) => inv._id));
  const totalEmails = groups.filter(isValidGroupEmail).length;
  const invalidFormatCount = groups.filter((g) => g.email.trim() !== "" && !emailRegex.test(g.email.trim())).length;

  const handleSend = async () => {
    if (sendableIds.length === 0) return;
    setSending(true);
    try {
      // Build invoice-level override map for the backend
      const invoiceOverrides = {};
      groups.forEach(g => {
        if (g.email !== g.defaultEmail && g.email.trim() !== "") {
          g.invoices.forEach(inv => {
            invoiceOverrides[inv._id] = g.email;
          });
        }
      });
      const res = await API.post("/invoices/bulk-email-grouped", { ids: sendableIds, overrides: invoiceOverrides });
      const { successfulIds = [], failedIds = [], skippedIds = [] } = res.data;
      const sentInvoiceCount = successfulIds.length;
      // Count how many distinct email groups had at least one success
      const emailsSent = groups.filter((g) =>
        g.invoices.some((inv) => successfulIds.includes(inv._id))
      ).length;
      const skipCount = skippedIds.length + skipped.length;

      if (sentInvoiceCount > 0) {
        toast.success("Emails sent successfully!");
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

  return createPortal(
    <div className="relative z-[9999]">
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
                key={group.groupKey}
                className="border border-gray-200 rounded-xl overflow-hidden"
              >
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[15px] font-semibold text-gray-900 truncate max-w-full">
                          {group.companyName}
                        </p>
                        {group.companyEmail && (
                          <span className="text-[11px] bg-gray-200/70 text-gray-600 px-2 py-0.5 rounded border border-gray-300 truncate max-w-full" title="Company Email">
                            {group.companyEmail}
                          </span>
                        )}
                      </div>
                      {group.contactName && (
                        <p className="text-xs text-gray-500 mt-0.5">Contact: {group.contactName}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-medium text-gray-500 hidden sm:inline">Send to:</span>
                      <div className="flex flex-col w-full sm:w-[260px] relative">
                        <input
                          type="email"
                          value={group.email}
                          onChange={(e) => setEmailOverrides(prev => ({ ...prev, [group.groupKey]: e.target.value }))}
                          placeholder="Enter contact email..."
                          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all placeholder:text-gray-400 bg-white shadow-sm"
                        />
                        {!group.email && <p className="text-[10px] text-red-500 absolute -bottom-4 right-0">Email required</p>}
                        {group.email.trim() !== "" && !emailRegex.test(group.email.trim()) && (
                          <p className="text-[10px] text-red-500 absolute -bottom-4 right-0">Invalid email format</p>
                        )}
                      </div>
                    </div>
                  </div>
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
              {invalidFormatCount > 0 && (
                <>
                  &nbsp;·&nbsp;
                  <span className="text-red-500">
                    {invalidFormatCount} invalid email{invalidFormatCount !== 1 ? "s" : ""}
                  </span>
                </>
              )}
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
    </div>,
    document.body
  );
};

export default BulkEmailGroupedModal;
