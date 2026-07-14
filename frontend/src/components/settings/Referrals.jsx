// components/settings/Referrals.jsx
//
// Org-facing referral dashboard — code, share link, stats, and reward
// history. Read-only: every number here comes straight from
// GET /subscription/referrals/overview (utils/referralUtils.js
// buildReferralOverview on the backend) — this component never computes a
// discount, eligibility, or status itself (ARCHITECTURE.md §8 rule #3/#19
// of REFERRAL_SYSTEM_DESIGN.md — frontend never calculates referral math).
import React, { useEffect, useState } from "react";
import {
  Gift,
  Copy,
  Check,
  Users,
  Send as SendIcon,
  Tag,
  Share2,
  Mail,
  Building2,
  ChevronRight,
} from "lucide-react";
import toast from "react-hot-toast";
import { subscriptionAPI } from "../../services/subscriptionApi";
import { formatPrice } from "../../utils/pricingSnapshot";

const formatDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (dt.getFullYear() < 2020) return "—";
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const rewardValueLabel = (reward) =>
  reward.rewardType === "fixed" ? formatPrice(reward.rewardValue) : `${reward.rewardValue}%`;

const REFERRAL_STATUS_STYLES = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  qualified: "bg-emerald-50 text-emerald-700 border-emerald-200",
  expired: "bg-gray-100 text-gray-500 border-gray-200",
};

const REWARD_STATUS_STYLES = {
  available: "bg-emerald-50 text-emerald-700 border-emerald-200",
  reserved: "bg-amber-50 text-amber-700 border-amber-200",
  consumed: "bg-gray-100 text-gray-500 border-gray-200",
  expired: "bg-gray-100 text-gray-400 border-gray-200",
  revoked: "bg-red-50 text-red-600 border-red-200",
};

const StatCard = ({ icon, iconBg, label, value, sublabel }) => (
  <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4 flex items-center gap-4">
    <div className={`p-2.5 rounded-xl ${iconBg}`}>{icon}</div>
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
      {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
    </div>
  </div>
);

const StatusPill = ({ status, styles }) => (
  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${styles[status] || "bg-gray-100 text-gray-500 border-gray-200"}`}>
    {status}
  </span>
);

const Referrals = () => {
  const [code, setCode] = useState(null);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const [codeRes, overviewRes] = await Promise.all([
          subscriptionAPI.getReferralCode(),
          subscriptionAPI.getReferralOverview(),
        ]);
        if (cancelled) return;
        setCode(codeRes.data.code);
        setOverview(overviewRes.data);
      } catch (err) {
        console.error("Failed to load referral overview:", err);
        if (!cancelled) toast.error("Couldn't load your referral info. Try refreshing.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const shareLink = code ? `${window.location.origin}?ref=${code}` : "";

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — copy it manually.");
    }
  };

  const handleSendInvite = async () => {
    const trimmedEmail = inviteEmail.trim();
    if (!trimmedEmail) {
      toast.error("Enter an email address first.");
      return;
    }
    try {
      setSendingInvite(true);
      await subscriptionAPI.sendReferralEmail(trimmedEmail, inviteMessage.trim());
      toast.success(`Invite sent to ${trimmedEmail}`);
      setInviteEmail("");
      setInviteMessage("");
    } catch (err) {
      console.error("Failed to send referral invite:", err);
      toast.error(err?.response?.data?.error || "Couldn't send the invite. Try again.");
    } finally {
      setSendingInvite(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-sm text-gray-500">
        Loading your referral info…
      </div>
    );
  }

  const summary = overview?.summary || {};
  const rewards = overview?.rewards || [];
  const referralsSent = overview?.referralsSent || [];
  const referredBy = overview?.referredBy;
  const topReward = rewards.find((r) => r.status === "available") || rewards[0];

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<SendIcon className="w-4 h-4 text-purple-600" />}
          iconBg="bg-purple-50"
          label="Referrals sent"
          value={summary.referralsSent ?? 0}
          sublabel="Total invitations sent"
        />
        <StatCard
          icon={<span className="block w-4 h-4 rounded-full border-2 border-amber-500" />}
          iconBg="bg-amber-50"
          label="Pending"
          value={summary.referralsPending ?? 0}
          sublabel="Awaiting first payment"
        />
        <StatCard
          icon={<Check className="w-4 h-4 text-emerald-600" />}
          iconBg="bg-emerald-50"
          label="Qualified"
          value={summary.referralsQualified ?? 0}
          sublabel="Completed first payment"
        />
        <StatCard
          icon={<Gift className="w-4 h-4 text-purple-600" />}
          iconBg="bg-purple-50"
          label="Rewards available"
          value={summary.rewardsAvailable ?? 0}
          sublabel="Ready to use"
        />
      </div>

      {/* Reward banner */}
      {topReward && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-4 flex items-center gap-4">
          <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 shrink-0">
            <Tag className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Your reward</p>
            <p className="text-lg font-bold text-gray-900">{rewardValueLabel(topReward)} off your next purchase</p>
            <p className="text-xs text-gray-400">
              Earned {formatDate(topReward.createdAt)}
              {topReward.expiresAt ? ` · Expires ${formatDate(topReward.expiresAt)}` : " · Never expires"}
            </p>
          </div>
          <StatusPill status={topReward.status} styles={REWARD_STATUS_STYLES} />
        </div>
      )}

      {/* Two-column: invite / referred people */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Invite a friend + email */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Invite a friend</h2>
              <p className="text-xs text-gray-500">Share your code — when they become a paying customer, you both earn a reward.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
              <span className="text-base font-mono font-bold tracking-wider text-gray-900">{code}</span>
            </div>
            <button
              onClick={() => handleCopy(code)}
              title="Copy code"
              className="inline-flex items-center justify-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold px-3.5 py-2.5 rounded-lg transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={() => handleCopy(shareLink)}
              className="inline-flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap"
            >
              <Share2 className="w-3.5 h-3.5" />
              Copy share link
            </button>
          </div>

          {referredBy && (
            <div className="mb-4 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 text-xs text-blue-700">
              You joined via a referral from <span className="font-semibold">{referredBy.referrerOrganization?.name || "another organization"}</span>.
            </div>
          )}

          {/* Invite via Email */}
          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <Mail className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-bold text-gray-900">Invite via email</h3>
            </div>
            <div className="space-y-2.5">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="friend@company.com"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400"
              />
              <textarea
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                placeholder="Add a personal message (optional)"
                rows={2}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400"
              />
              <button
                onClick={handleSendInvite}
                disabled={sendingInvite}
                className="inline-flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors w-full sm:w-auto"
              >
                <SendIcon className="w-3.5 h-3.5" />
                {sendingInvite ? "Sending…" : "Send invite"}
              </button>
            </div>
          </div>
        </div>

        {/* People you've referred */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 pt-5 pb-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
              <Users className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-gray-900">People you've referred</h2>
          </div>

          {referralsSent.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-gray-500">Nobody has used your code yet — share it to start earning rewards.</p>
          ) : (
            <>
              <div className="hidden sm:grid grid-cols-[1fr_auto_auto] gap-4 px-6 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <span>Company</span>
                <span>Joined</span>
                <span className="text-right">Status</span>
              </div>
              <div className="divide-y divide-gray-100">
                {referralsSent.map((r) => (
                  <div key={r._id} className="px-6 py-3.5 grid grid-cols-[1fr_auto_auto] items-center gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                        <Building2 className="w-3.5 h-3.5" />
                      </div>
                      <p className="text-sm font-semibold text-gray-900 truncate">{r.referredOrganization?.name || "Organization"}</p>
                    </div>
                    <div className="text-xs text-gray-400 whitespace-nowrap">
                      {formatDate(r.createdAt)}
                      {r.qualifiedAt && <div>Qualified {formatDate(r.qualifiedAt)}</div>}
                    </div>
                    <div className="justify-self-end">
                      <StatusPill status={r.status} styles={REFERRAL_STATUS_STYLES} />
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full flex items-center justify-center gap-1 px-6 py-3.5 text-sm font-semibold text-purple-600 hover:bg-purple-50 transition-colors border-t border-gray-100">
                View all referrals <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Rewards list (all, not just top) */}
      {rewards.length > 1 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 pt-4 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">All rewards</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {rewards.map((r) => (
              <div key={r._id} className="px-6 py-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
                    <Tag className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{rewardValueLabel(r)} off your next purchase</p>
                    <p className="text-xs text-gray-400">
                      Earned {formatDate(r.createdAt)}
                      {r.expiresAt ? ` · Expires ${formatDate(r.expiresAt)}` : " · Never expires"}
                    </p>
                  </div>
                </div>
                <StatusPill status={r.status} styles={REWARD_STATUS_STYLES} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Referrals;
