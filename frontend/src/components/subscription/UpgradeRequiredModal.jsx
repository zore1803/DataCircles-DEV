import { Sparkles, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Generic "this needs a higher plan" gate dialog. Bulk row selection is the
// first caller (see hooks/useBulkSelection.js), but this is deliberately not
// bulk-selection-specific — `feature` is just the sentence fragment slotted
// into "X requires the {planLabel} plan or above.", so any other
// plan-tier-gated action can reuse it instead of writing its own modal.
const PLAN_LABELS = { starter: "Starter", growth: "Growth", business: "Business" };

const UpgradeRequiredModal = ({
  open,
  onClose,
  minPlan = "growth",
  feature = "This feature",
}) => {
  const navigate = useNavigate();
  if (!open) return null;

  const planLabel = PLAN_LABELS[minPlan] || minPlan;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[10010] p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
        <div className="p-6 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-blue-50 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Upgrade Required</h3>
          <p className="text-sm text-gray-500 mb-6">
            {feature} requires the <span className="font-semibold text-gray-700">{planLabel}</span> plan or above.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={onClose}
              className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              Not now
            </button>
            <button
              onClick={() => {
                onClose();
                navigate("/settings/subscription");
              }}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              Upgrade Plan
            </button>
          </div>
        </div>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default UpgradeRequiredModal;
