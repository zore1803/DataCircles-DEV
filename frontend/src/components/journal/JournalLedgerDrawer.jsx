import React, { useEffect, useState } from "react";
import { X, BookText, ArrowDownCircle, ArrowUpCircle, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import API from "../../services/api";

const money = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

// Same dc-panel-card quick-drawer chrome as QuickJournalForm/CallLogForm —
// shows the transaction history (Date / Description / Pay In / Pay Out /
// Balance) for one Journal, and lets the user record a new Pay In/Pay Out
// straight from here (via onOpenPayIn/onOpenPayOut, opened by the caller so
// there's a single PayInOutModal instance instead of one per drawer).
const JournalLedgerDrawer = ({ isOpen, journalId, refreshKey, onClose, onOpenPayIn, onOpenPayOut }) => {
  const [isSliding, setIsSliding] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setTimeout(() => setIsSliding(true), 10);
    } else {
      setIsSliding(false);
      setTimeout(() => setShouldRender(false), 300);
    }
  }, [isOpen]);

  const fetchLedger = () => {
    if (!journalId) return;
    setLoading(true);
    API.get(`/journals/${journalId}/ledger`)
      .then((res) => setData(res.data))
      .catch((err) => toast.error(err.response?.data?.error || "Failed to load ledger"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isOpen || !journalId) return;
    setData(null);
    fetchLedger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, journalId]);

  // Re-pull without clearing `data` first — a Pay In/Out recorded from this
  // same drawer (or from the list's row menu while this drawer stayed open)
  // lands here without a loading flash.
  useEffect(() => {
    if (!isOpen || !journalId || refreshKey === undefined) return;
    fetchLedger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const handleClose = () => {
    setIsSliding(false);
    setTimeout(() => onClose(), 300);
  };

  const handleDeleteEntry = async (entryId) => {
    if (!journalId) return;
    setDeletingId(entryId);
    try {
      await API.delete(`/journals/${journalId}/entries/${entryId}`);
      toast.success("Entry deleted");
      fetchLedger();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete entry");
    } finally {
      setDeletingId(null);
    }
  };

  if (!shouldRender) return null;

  const journal = data?.journal;
  const rows = data?.rows || [];
  const summary = data?.summary;

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
        {/* Header — matches the CompanyForm/QuickJournalForm quick-drawer header spec */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-[#D9D9D9] flex-shrink-0 bg-white gap-1">
          <div className="min-w-0">
            <h2 className="text-[14px] font-normal leading-5 text-[#78788D] uppercase tracking-wide truncate">
              Ledger{journal ? ` · ${journal.name}` : ""}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            title="Close"
            className="w-5 h-5 flex items-center justify-center text-[#1C1B1F] hover:opacity-70 transition-opacity flex-shrink-0"
            aria-label="Close"
          >
            <X className="w-[18px] h-[18px]" strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading ledger…</div>
          ) : !data ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <BookText className="w-8 h-8 mb-2" />
              <p className="text-sm">No ledger data</p>
            </div>
          ) : (
            <>
              {/* Summary chips */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4">
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
                    Credit {money(summary.credit)}
                  </span>
                  <span className="px-3 py-1.5 rounded-full bg-red-50 text-red-700 text-xs font-semibold">
                    Debit {money(summary.debit)}
                  </span>
                  <span className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold">
                    Net {money(summary.net)}
                  </span>
                  <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${summary.balance < 0 ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>
                    Balance {money(summary.balance)}
                  </span>
                </div>

                {/* Record directly from the ledger, not just from the list's ⋮ menu */}
                {journal?.status !== "cancelled" && (onOpenPayIn || onOpenPayOut) && (
                  <div className="flex gap-2">
                    {onOpenPayIn && (
                      <button
                        type="button"
                        onClick={() => onOpenPayIn(journal)}
                        className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition-colors"
                      >
                        <ArrowDownCircle className="w-3.5 h-3.5" /> Pay In
                      </button>
                    )}
                    {onOpenPayOut && (
                      <button
                        type="button"
                        onClick={() => onOpenPayOut(journal)}
                        className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors"
                      >
                        <ArrowUpCircle className="w-3.5 h-3.5" /> Pay Out
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Transaction table */}
              <div className="px-6 pb-6">
                {/* `overflow-x-auto` (not `overflow-hidden`) — this drawer's narrowest
                    breakpoint is only 440px wide, which 6 whitespace-nowrap columns
                    (Date/Description/Pay In/Pay Out/Balance/delete) don't fit inside.
                    `overflow-hidden` here silently clipped Balance and the delete
                    button off the visible edge instead of making them reachable. */}
                <div className="border border-[#E1E4EA] rounded-xl overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left">
                    <thead className="bg-[#F5F7FA]">
                      <tr>
                        <th className="px-3 py-2.5 text-xs font-bold text-[#525866] uppercase tracking-wide">Date</th>
                        <th className="px-3 py-2.5 text-xs font-bold text-[#525866] uppercase tracking-wide">Description</th>
                        <th className="px-3 py-2.5 text-xs font-bold text-[#525866] uppercase tracking-wide text-right">Pay In</th>
                        <th className="px-3 py-2.5 text-xs font-bold text-[#525866] uppercase tracking-wide text-right">Pay Out</th>
                        <th className="px-3 py-2.5 text-xs font-bold text-[#525866] uppercase tracking-wide text-right">Balance</th>
                        <th className="px-3 py-2.5 w-10" />
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-[#F1F1F5]">
                      {rows.map((row) => {
                        // The Opening Balance row is synthesized (its _id is a string like
                        // "<journalId>-opening", never a real ObjectId) — it can't be deleted.
                        const isOpeningRow = row._id === `${journal?._id}-opening`;
                        return (
                          <tr key={row._id}>
                            <td className="px-3 py-2.5 text-sm text-gray-600 whitespace-nowrap">{formatDate(row.date)}</td>
                            <td className="px-3 py-2.5 text-sm text-gray-900 font-medium truncate">{row.description}</td>
                            <td className="px-3 py-2.5 text-sm text-emerald-600 font-semibold text-right whitespace-nowrap">
                              {row.payIn != null ? money(row.payIn) : "—"}
                            </td>
                            <td className="px-3 py-2.5 text-sm text-red-600 font-semibold text-right whitespace-nowrap">
                              {row.payOut != null ? money(row.payOut) : "—"}
                            </td>
                            <td className={`px-3 py-2.5 text-sm font-bold text-right whitespace-nowrap ${row.balance < 0 ? "text-red-600" : "text-gray-900"}`}>
                              {money(row.balance)}
                            </td>
                            <td className="px-1 py-2.5 text-right">
                              {!isOpeningRow && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteEntry(row._id)}
                                  disabled={deletingId === row._id}
                                  className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                  title="Delete entry"
                                >
                                  {deletingId === row._id ? (
                                    <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default JournalLedgerDrawer;
