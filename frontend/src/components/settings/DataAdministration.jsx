import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Database, TrendingUp, Loader2, Wallet as WalletIcon, Plus } from "lucide-react";
import API from "../../services/api";
import { walletAPI } from "../../services/walletApi";

// One usage bar shared by seats/storage/email-templates/every capped
// module — same visual treatment regardless of what's being measured.
function UsageBar({ label, used, limit, unit = "", unlimited = false }) {
  const pct = unlimited || !limit ? 0 : Math.min(100, (used / limit) * 100);
  const isNearLimit = !unlimited && pct >= 80;
  const isOverLimit = !unlimited && pct >= 100;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span
          className={`text-xs font-semibold ${
            isOverLimit ? "text-red-600" : isNearLimit ? "text-amber-600" : "text-gray-900"
          }`}
        >
          {unlimited ? `${used}${unit} · Unlimited` : `${used}${unit} of ${limit}${unit}`}
        </span>
      </div>
      {!unlimited && (
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isOverLimit ? "bg-red-500" : isNearLimit ? "bg-amber-500" : "bg-blue-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function DataAdministration() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [walletLoading, setWalletLoading] = useState(true);

  useEffect(() => {
    API.get("/usage-overview")
      .then((res) => setOverview(res.data))
      .catch(() => setOverview(null))
      .finally(() => setLoading(false));

    walletAPI
      .getWallet()
      .then((res) => setWallet(res.data))
      .catch(() => setWallet(null))
      .finally(() => setWalletLoading(false));
  }, []);

  const anyNearOrOverLimit =
    overview &&
    [overview.seats, overview.storage, overview.emailTemplates, ...overview.modules].some(
      (item) => !item.unlimited && item.limit && item.used / item.limit >= 0.8
    );

  return (
    <div className="space-y-6">
      <div className="bg-white border-2 border-gray-200 shadow-xl rounded-2xl overflow-hidden">
        <div className="p-8 border-b-2 border-gray-100 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 p-2.5 rounded-xl">
              <Database className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Data Administration</h2>
              <p className="text-sm text-gray-600">
                {overview ? `You're on the ${overview.planName} plan. ` : ""}
                See what your plan includes and how much of it you've used.
              </p>
            </div>
          </div>

          {/* Wallet balance — right here so buying an add-on's cost is
              visible against what's actually available to spend. */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3 flex items-center gap-4 flex-shrink-0">
            <div className="flex items-center gap-2">
              <WalletIcon className="w-4 h-4 text-emerald-700" />
              <div>
                <p className="text-[11px] font-medium text-emerald-700 leading-tight">Wallet Balance</p>
                <p className="text-lg font-bold text-emerald-900 leading-tight">
                  {walletLoading ? "…" : wallet ? `₹${wallet.balance.toFixed(2)}` : "—"}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate("/settings/wallet")}
              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Money
            </button>
          </div>
        </div>

        <div className="p-8">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
          ) : !overview ? (
            <div className="text-center py-16 text-sm text-gray-500">
              Couldn't load usage right now. Try again later.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <UsageBar
                  label={overview.seats.label}
                  used={overview.seats.used}
                  limit={overview.seats.limit}
                  unlimited={overview.seats.unlimited}
                />
                <UsageBar
                  label={overview.storage.label}
                  used={overview.storage.used}
                  limit={overview.storage.limit}
                  unit=" GB"
                  unlimited={overview.storage.unlimited}
                />
                <UsageBar
                  label={overview.emailTemplates.label}
                  used={overview.emailTemplates.used}
                  limit={overview.emailTemplates.limit}
                  unlimited={overview.emailTemplates.unlimited}
                />
                {overview.modules.map((m) => (
                  <UsageBar
                    key={m.key}
                    label={m.label}
                    used={m.used}
                    limit={m.limit}
                    unlimited={m.unlimited}
                  />
                ))}
              </div>

              {anyNearOrOverLimit && (
                <p className="text-xs text-amber-600 font-medium bg-amber-50 border border-amber-200 rounded-xl p-3">
                  One or more of your plan's limits is close to (or at) capacity — buy an add-on or upgrade to keep going.
                </p>
              )}

              <div className="border border-gray-200 rounded-xl p-6">
                <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  Need more room?
                </h4>
                <p className="text-sm text-gray-600 mb-4">
                  Buy an add-on for your current plan, or upgrade to a plan with higher limits included.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => navigate("/settings/subscription")}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-sm"
                  >
                    Buy Add-on
                  </button>
                  <button
                    onClick={() => navigate("/settings/subscription")}
                    className="px-5 py-2.5 rounded-xl font-medium text-gray-700 bg-white border-2 border-gray-200 hover:bg-gray-50 transition-colors text-sm"
                  >
                    Upgrade Plan
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DataAdministration;
