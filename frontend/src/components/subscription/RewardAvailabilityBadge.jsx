// components/subscription/RewardAvailabilityBadge.jsx
//
// BILLING_UX_SPEC.md §2.2 — "one API call, five render sites." One small
// component, fed by subscriptionAPI.getRewardAvailability(), used
// identically on the billing dashboard, plan cards, and Manage Subscription.
// Always states ELIGIBILITY, not just existence (§2.2's mandatory rule) —
// "a reward exists" doesn't answer "why didn't it apply to what I just
// bought."
import React, { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { subscriptionAPI } from "../../services/subscriptionApi";

const RewardAvailabilityBadge = ({ compact = false }) => {
  const [availability, setAvailability] = useState(null);

  useEffect(() => {
    let cancelled = false;
    subscriptionAPI.getRewardAvailability()
      .then((res) => { if (!cancelled) setAvailability(res.data); })
      .catch(() => { if (!cancelled) setAvailability({ available: false }); });
    return () => { cancelled = true; };
  }, []);

  if (!availability?.available) return null;

  const valueLabel = availability.rewardType === "percentage"
    ? `${availability.rewardValue}% OFF`
    : `₹${availability.rewardValue} OFF`;

  if (compact) {
    return (
      <div className="mt-2 rounded-lg bg-purple-50 border border-purple-200 px-3 py-2">
        <p className="text-xs font-semibold text-purple-800 flex items-center gap-1.5">
          <Gift className="w-3.5 h-3.5" /> Referral Reward Available — {valueLabel} your next purchase
        </p>
        <p className="text-[11px] text-purple-600 mt-0.5">
          Eligible for: {availability.eligibleFor.join(" · ")}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-purple-50 border border-purple-200 px-3 py-2.5">
      <p className="text-xs font-semibold text-purple-800 flex items-center gap-1.5">
        <Gift className="w-3.5 h-3.5" /> {valueLabel} referral reward available
      </p>
      <p className="text-[11px] text-purple-600 mt-0.5">
        Eligible for: {availability.eligibleFor.join(" · ")}
      </p>
    </div>
  );
};

export default RewardAvailabilityBadge;
