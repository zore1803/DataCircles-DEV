// components/settings/BillingCenter.jsx
//
// Redesigned from a fresh product-design pass, not by stacking the prior
// components — the "sidebar (state) + right column (history)" split from
// Option B. Left column is "what do I have, right now" and never changes
// shape as you scroll; right column is everything that happened or will
// happen. No Subscription Journey — reviewed against the rendered page and
// it added a box without adding information a user needed.
//
// Data sources are unchanged: useSubscription() for the live subscription
// doc, BillingTimeline/BillingHistory for events and payments. Nothing here
// recalculates a price, discount, or date — every number comes from state
// those hooks/components already fetch.
import React from "react";
import { useNavigate } from "react-router-dom";
import { Building2, ArrowRight, Gift } from "lucide-react";
import { useSubscription } from "../../contexts/SubscriptionContext";
import BillingSidebar from "./BillingSidebar";
import BillingTimeline from "./BillingTimeline";
import BillingHistory from "./BillingHistory";

const BillingCenter = () => {
  const navigate = useNavigate();
  const { subscription } = useSubscription();
  const sub = subscription?.subscription;

  if (!sub) {
    return (
      <div className="bg-white rounded-lg p-8 border border-gray-200 text-center max-w-2xl">
        <p className="text-sm text-gray-500 mb-3">No active subscription yet.</p>
        <button onClick={() => navigate("/settings/subscription")} className="text-blue-600 font-medium text-sm hover:underline">
          Choose a plan →
        </button>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-[300px_1fr] gap-6 items-start">
      <BillingSidebar subscription={sub} />

      {/* One continuous card for the whole right column — Timeline, Payment
          History, Invoices, and Billing Info are sections within it
          (divide-y), not separate floating boxes with gaps between them. */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 min-w-0">
        <div className="px-5 pt-4 pb-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Timeline</h2>
          <BillingTimeline bare />
        </div>

        <BillingHistory embedded />

        <button
          onClick={() => navigate("/settings/referrals")}
          className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-purple-50 rounded-lg text-purple-600">
              <Gift className="w-4 h-4" />
            </div>
            <p className="text-sm font-medium text-gray-900">Referrals — invite others, track your rewards</p>
          </div>
          <span className="flex items-center gap-1 text-xs font-semibold text-blue-600 flex-shrink-0">
            View <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </button>

        <button
          onClick={() => navigate("/settings/brand")}
          className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-purple-50 rounded-lg text-purple-600">
              <Building2 className="w-4 h-4" />
            </div>
            <p className="text-sm font-medium text-gray-900">Billing Information — Company, GST &amp; address</p>
          </div>
          <span className="flex items-center gap-1 text-xs font-semibold text-blue-600 flex-shrink-0">
            Edit <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </button>
      </div>
    </div>
  );
};

export default BillingCenter;
