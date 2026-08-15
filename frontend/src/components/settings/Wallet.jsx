// components/settings/Wallet.jsx
//
// Org-facing prepaid credit wallet. Independent of the subscription ΓÇö nothing
// here reads or changes plan state. Pricing (credit value, GST) always comes
// from the backend; this component never computes what will be charged.
import React, { useCallback, useEffect, useState } from "react";
import {
  Wallet as WalletIcon,
  Plus,
  Sparkles,
  FileText,
  Package,
  MessageCircle,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Info,
} from "lucide-react";
import toast from "react-hot-toast";
import { walletAPI } from "../../services/walletApi";
import useRazorpay from "../../hooks/useRazorpay";

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

const formatDateTime = (d) =>
  new Date(d).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatRupees = (n) =>
  `Γé╣${Number(n).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const TYPE_META = {
  CREDIT_PURCHASE: { label: "Purchase", style: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  FREE_CREDIT: { label: "Free credit", style: "bg-sky-50 text-sky-700 ring-sky-200" },
  ADMIN_CREDIT: { label: "Admin credit", style: "bg-violet-50 text-violet-700 ring-violet-200" },
  USAGE_DEBIT: { label: "Usage", style: "bg-slate-100 text-slate-600 ring-slate-200" },
  REFUND: { label: "Refund", style: "bg-amber-50 text-amber-700 ring-amber-200" },
  ADJUSTMENT: { label: "Adjustment", style: "bg-amber-50 text-amber-700 ring-amber-200" },
};

// Usage-based features that will consume credits once they ship. Listed here so
// customers understand what they're pre-paying for; none of them are wired to
// walletService.debit() yet.
const UPCOMING_FEATURES = [
  { icon: MessageCircle, label: "WhatsApp messaging" },
  { icon: Sparkles, label: "AI document processing" },
  { icon: Receipt, label: "Bulk e-invoice & e-way bill generation" },
  { icon: Package, label: "Future purchases and add-ons" },
];

const Wallet = () => {
  const { razorpayLoaded, openCheckout } = useRazorpay();
  const [wallet, setWallet] = useState(null);
  const [history, setHistory] = useState({ transactions: [], page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [rupeeAmount, setRupeeAmount] = useState("");
  const [purchasing, setPurchasing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [walletRes, historyRes] = await Promise.all([
        walletAPI.getWallet(),
        walletAPI.getTransactions({ page, limit: 10 }),
      ]);
      setWallet(walletRes.data);
      setHistory(historyRes.data);
    } catch (err) {
      console.error("Failed to load wallet:", err);
      toast.error("Couldn't load your wallet. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const creditValue = wallet?.creditValueInRupees || 1;
  const gstRate = wallet?.gstRate ?? 18;
  const enteredRupees = Number(rupeeAmount) || 0;
  const creditsToBuy = enteredRupees / creditValue;
  const gstPreview = (enteredRupees * gstRate) / 100;
  const totalPreview = enteredRupees + gstPreview;

  const handleBuy = async () => {
    if (!(creditsToBuy > 0)) {
      toast.error("Enter an amount to add.");
      return;
    }
    if (!razorpayLoaded) {
      toast.error("Payment gateway is still loading. Try again in a moment.");
      return;
    }

    setPurchasing(true);
    try {
      const { data } = await walletAPI.createOrder(creditsToBuy);
      openCheckout({
        key: data.key,
        amount: data.order.amount,
        currency: data.order.currency,
        order_id: data.order.id,
        name: "Wallet Credits",
        description: `${data.credits} credits`,
        theme: { color: "#059669" },
        handler: async (response) => {
          try {
            await walletAPI.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast.success("Credits added to your wallet.");
            setRupeeAmount("");
            setPage(1);
            await load();
          } catch (err) {
            console.error("Wallet verification failed:", err);
            toast.error("Payment received but verification failed. Refresh in a moment.");
          } finally {
            setPurchasing(false);
          }
        },
        modal: { ondismiss: () => setPurchasing(false) },
        onPaymentFailed: (error) => {
          toast.error(`Payment failed: ${error.description}`);
          setPurchasing(false);
        },
      });
    } catch (err) {
      console.error("Failed to start wallet top-up:", err);
      toast.error(err.response?.data?.error || "Couldn't start the payment.");
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="h-44 rounded-2xl bg-gray-100 lg:col-span-1" />
          <div className="h-44 rounded-2xl bg-gray-100 lg:col-span-2" />
        </div>
        <div className="h-56 rounded-2xl bg-gray-100" />
        <div className="h-72 rounded-2xl bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Balance + what credits are for */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 p-6 text-white shadow-sm lg:col-span-1">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-white/5" />
          <div className="relative">
            <div className="mb-5 flex items-center gap-2.5">
              <div className="rounded-xl bg-white/20 p-2 backdrop-blur-sm">
                <WalletIcon className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-emerald-50">Credit balance</p>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-5xl font-bold leading-none tracking-tight">
                {wallet.balance.toFixed(2)}
              </p>
              <span className="text-sm font-medium text-emerald-100">credits</span>
            </div>
            <p className="mt-3 inline-flex rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-emerald-50">
              1 credit = {formatRupees(creditValue)}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 lg:col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Where credits apply</p>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
              Rolling out soon
            </span>
          </div>
          <p className="mb-4 text-xs text-gray-500">
            Credits are consumed by usage-based features as they become available.
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {UPCOMING_FEATURES.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-3.5 py-3 text-sm text-gray-700"
              >
                <Icon className="h-4 w-4 shrink-0 text-emerald-600" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top-up */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <p className="text-sm font-semibold text-gray-900">Add credits</p>
        <p className="mt-0.5 text-xs text-gray-500">
          Choose a quick amount or enter your own.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {QUICK_AMOUNTS.map((amount) => {
            const active = enteredRupees === amount;
            return (
              <button
                key={amount}
                type="button"
                onClick={() => setRupeeAmount(String(amount))}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                    : "border-gray-200 bg-white text-gray-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                }`}
              >
                Γé╣{amount.toLocaleString("en-IN")}
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div>
            <label
              htmlFor="wallet-amount"
              className="mb-1.5 block text-xs font-medium text-gray-600"
            >
              Amount to add
            </label>
            <div className="flex items-center rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 transition focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
              <span className="mr-1.5 text-lg text-gray-400">Γé╣</span>
              <input
                id="wallet-amount"
                type="number"
                min="0"
                value={rupeeAmount}
                onChange={(e) => setRupeeAmount(e.target.value)}
                placeholder="0"
                className="w-full bg-transparent text-lg font-semibold text-gray-900 outline-none placeholder:font-normal placeholder:text-gray-300"
              />
              {creditsToBuy > 0 && (
                <span className="ml-2 shrink-0 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  {creditsToBuy.toFixed(2)} credits
                </span>
              )}
            </div>

            <button
              onClick={handleBuy}
              disabled={purchasing || !(creditsToBuy > 0)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              <Plus className="h-4 w-4" />
              {purchasing ? "ProcessingΓÇª" : "Buy Credits"}
            </button>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
            <p className="mb-3 text-xs font-medium text-gray-600">Payment summary</p>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Subtotal</dt>
                <dd className="font-medium text-gray-900">{formatRupees(enteredRupees)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">GST ({gstRate}%)</dt>
                <dd className="font-medium text-gray-900">{formatRupees(gstPreview)}</dd>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2.5">
                <dt className="font-semibold text-gray-900">Total payable</dt>
                <dd className="text-base font-bold text-emerald-700">
                  {formatRupees(totalPreview)}
                </dd>
              </div>
            </dl>
            <p className="mt-3 flex items-start gap-1.5 text-xs text-gray-400">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              GST is charged on top of the amount at the time of payment. Credits added are
              unaffected by GST.
            </p>
          </div>
        </div>
      </div>

      {/* Ledger */}
      <div className="rounded-2xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <p className="text-sm font-semibold text-gray-900">Wallet Credit Usage History</p>
          {history.total > 0 && (
            <span className="text-xs text-gray-400">
              {history.total} {history.total === 1 ? "entry" : "entries"}
            </span>
          )}
        </div>

        {history.transactions.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <div className="mb-3 rounded-2xl bg-gray-50 p-3.5">
              <FileText className="h-6 w-6 text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-700">No wallet activity yet</p>
            <p className="mt-1 text-xs text-gray-400">
              Purchases, grants, and usage will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-6 py-3 font-medium">Credits</th>
                  <th className="px-6 py-3 font-medium">Type</th>
                  <th className="px-6 py-3 font-medium">Notes</th>
                  <th className="px-6 py-3 text-right font-medium">Balance After</th>
                  <th className="px-6 py-3 text-right font-medium">Date &amp; Time</th>
                </tr>
              </thead>
              <tbody>
                {history.transactions.map((tx) => {
                  const meta = TYPE_META[tx.type] || {
                    label: tx.type.replace(/_/g, " ").toLowerCase(),
                    style: "bg-gray-100 text-gray-600 ring-gray-200",
                  };
                  const isDebit = tx.amount < 0;
                  return (
                    <tr
                      key={tx._id}
                      className="border-b border-gray-50 transition last:border-0 hover:bg-gray-50/60"
                    >
                      <td className="px-6 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold tabular-nums ${
                            isDebit ? "text-rose-600" : "text-emerald-600"
                          }`}
                        >
                          {isDebit ? (
                            <ArrowDownRight className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          )}
                          {tx.amount > 0 ? "+" : ""}
                          {tx.amount.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${meta.style}`}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-gray-600">{tx.description}</td>
                      <td className="px-6 py-3.5 text-right font-medium tabular-nums text-gray-900">
                        {tx.balanceAfter.toFixed(2)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5 text-right text-gray-500">
                        {formatDateTime(tx.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {history.totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-3.5 text-sm">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="rounded-lg border border-gray-200 px-3 py-1.5 font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-1 text-gray-500">
              Page {history.page} of {history.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, history.totalPages))}
              disabled={page >= history.totalPages}
              className="rounded-lg border border-gray-200 px-3 py-1.5 font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Wallet;
