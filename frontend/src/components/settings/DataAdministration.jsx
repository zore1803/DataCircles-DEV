import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Database, HardDrive, TrendingUp, Loader2 } from "lucide-react";
import API from "../../services/api";

function DataAdministration() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    API.get("/folders/org-storage-info")
      .then((res) => setUsage(res.data))
      .catch(() => setUsage(null))
      .finally(() => setLoading(false));
  }, []);

  const pct = usage ? Math.min(100, Number(usage.usagePercentage) || 0) : 0;
  const isNearLimit = pct >= 80;
  const isOverLimit = pct >= 100;

  return (
    <div className="space-y-6">
      <div className="bg-white border-2 border-gray-200 shadow-xl rounded-2xl overflow-hidden">
        <div className="p-8 border-b-2 border-gray-100 flex items-center gap-3">
          <div className="bg-blue-50 p-2.5 rounded-xl">
            <Database className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Data Administration</h2>
            <p className="text-sm text-gray-600">
              See how much storage your organization is using across all users.
            </p>
          </div>
        </div>

        <div className="p-8">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
          ) : !usage ? (
            <div className="text-center py-16 text-sm text-gray-500">
              Couldn't load storage usage right now. Try again later.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-5 h-5 text-gray-400" />
                    <span className="text-sm font-medium text-gray-500">Storage Used</span>
                  </div>
                  <span
                    className={`text-sm font-semibold ${
                      isOverLimit ? "text-red-600" : isNearLimit ? "text-amber-600" : "text-gray-900"
                    }`}
                  >
                    {usage.currentUsageFormatted} of {usage.storageLimitFormatted}
                  </span>
                </div>
                <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isOverLimit ? "bg-red-500" : isNearLimit ? "bg-amber-500" : "bg-blue-500"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-500">{pct}% used</span>
                  <span className="text-xs text-gray-500">{usage.remainingSpaceFormatted} remaining</span>
                </div>
                {isOverLimit && (
                  <p className="mt-3 text-xs text-red-600 font-medium">
                    You've used up your available storage. Buy an add-on or upgrade your plan to keep uploading files.
                  </p>
                )}
                {!isOverLimit && isNearLimit && (
                  <p className="mt-3 text-xs text-amber-600 font-medium">
                    You're close to your storage limit — consider adding more space.
                  </p>
                )}
              </div>

              <div className="border border-gray-200 rounded-xl p-6">
                <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  Need more room?
                </h4>
                <p className="text-sm text-gray-600 mb-4">
                  Buy an additional storage add-on for your current plan, or upgrade to a plan with more storage included.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => navigate("/settings/subscription")}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-sm"
                  >
                    Buy Storage Add-on
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
