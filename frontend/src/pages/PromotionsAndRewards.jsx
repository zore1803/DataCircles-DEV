// pages/PromotionsAndRewards.jsx
//
// Super Admin — unified "Promotions & Rewards" section. UI-level unification
// ONLY: Coupons and Referral Rewards remain entirely separate backend
// engines (Coupon vs Reward/RewardUsage models), each already feeding the
// same Modifier abstraction for pricing. This page just puts their admin
// screens behind tabs. No Analytics tab yet — platform-wide coupon/referral
// stats will live on the Super Admin Overview page.
import React, { useState } from "react";
import { Tag, Gift } from "lucide-react";
import CouponManagement from "./CouponManagement";
import ReferralProgramAdmin from "./ReferralProgramAdmin";

const TABS = [
  { id: "coupons", label: "Coupons", icon: Tag },
  { id: "referrals", label: "Referral Program", icon: Gift },
];

const PromotionsAndRewards = () => {
  const [tab, setTab] = useState("coupons");

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Promotions &amp; Rewards</h1>
        <p className="text-sm text-gray-500 mt-1">Discount coupons and referral rewards in one place.</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === id
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* CouponManagement is rendered untouched — it keeps its own internal
          header and full behaviour. It has its own max-width/padding wrapper,
          so it sits fine inside this container. */}
      {tab === "coupons" && <CouponManagement />}
      {tab === "referrals" && <ReferralProgramAdmin />}
    </div>
  );
};

export default PromotionsAndRewards;
