// pages/ReferralProgramAdmin.jsx
//
// Super Admin — Referral Program management. Org-scoped by design: every
// backend endpoint (backend/controllers/referralAdminController.js) operates
// on a single organization's ReferralProgram / rewards, so this page first
// selects an org, then manages its program, referrals, and rewards.
//
// Read-only where it must be: reward status (available/reserved/consumed/
// expired/revoked) and referral status come straight from the backend
// (buildReferralOverview) — this page never computes referral math. Program
// edits only affect rewards created AFTER the change (Reward is immutable).
import React, { useState, useEffect, useCallback } from "react";
import {
  Gift, Search, Save, Ban, Plus, Users, Tag, Clock, Building2, X,
} from "lucide-react";
import toast from "react-hot-toast";
import { configureAxios } from "../services/api";
import { referralAdminAPI } from "../services/referralAdminApi";

const REFERRAL_STATUS_BADGE = {
  pending: "bg-amber-100 text-amber-700",
  qualified: "bg-green-100 text-green-700",
  expired: "bg-gray-100 text-gray-500",
};
const REWARD_STATUS_BADGE = {
  available: "bg-green-100 text-green-700",
  reserved: "bg-amber-100 text-amber-700",
  consumed: "bg-gray-100 text-gray-500",
  expired: "bg-gray-100 text-gray-400",
  revoked: "bg-red-100 text-red-600",
};

const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (dt.getFullYear() < 2020) return "—";
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};
const rewardValueLabel = (r) => (r.rewardType === "fixed" ? `₹${r.rewardValue}` : `${r.rewardValue}%`);

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500";
const Field = ({ label, children, hint }) => (
  <div>
    <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
    {children}
    {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
  </div>
);

const ReferralProgramAdmin = () => {
  const [orgSearch, setOrgSearch] = useState("");
  const [orgResults, setOrgResults] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null);

  const [program, setProgram] = useState(null);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savingProgram, setSavingProgram] = useState(false);
  const [showGrant, setShowGrant] = useState(false);
  const [grantDraft, setGrantDraft] = useState({ rewardType: "percentage", rewardValue: 20, maxRewardAmount: "", expiresAt: "" });

  // Org search (debounced) — reuses the coupon module's org search endpoint.
  // An empty query returns all orgs (backend filter is {} when search is
  // blank), so the list is browsable on load without having to guess a name.
  useEffect(() => {
    if (selectedOrg) return; // no need to search once one is picked
    const t = setTimeout(async () => {
      try {
        const res = await referralAdminAPI.searchOrganizations(orgSearch.trim());
        setOrgResults(res.data.organizations || []);
      } catch (err) {
        // Surface auth/other failures instead of silently showing "no orgs".
        console.error("Org search failed:", err);
        toast.error(err.response?.data?.error || "Couldn't load organizations");
        setOrgResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [orgSearch, selectedOrg]);

  const loadOrg = useCallback(async (orgId) => {
    try {
      setLoading(true);
      configureAxios();
      const [progRes, ovRes] = await Promise.all([
        referralAdminAPI.getProgram(orgId),
        referralAdminAPI.getOrganizationOverview(orgId),
      ]);
      setProgram(progRes.data.program);
      setOverview(ovRes.data);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to load referral data");
    } finally {
      setLoading(false);
    }
  }, []);

  const selectOrg = (org) => {
    setSelectedOrg(org);
    setOrgResults([]);
    setOrgSearch("");
    loadOrg(org._id);
  };

  const saveProgram = async () => {
    if (!selectedOrg) return;
    setSavingProgram(true);
    try {
      const payload = {
        enabled: program.enabled,
        rewardType: program.rewardType,
        rewardValue: Number(program.rewardValue),
        maxRewardAmount: program.maxRewardAmount === "" || program.maxRewardAmount == null ? null : Number(program.maxRewardAmount),
        stacksWithCoupons: program.stacksWithCoupons,
        expiryDurationDays: program.expiryDurationDays === "" || program.expiryDurationDays == null ? null : Number(program.expiryDurationDays),
        honoredDuringTrial: program.honoredDuringTrial,
        minimumActiveDays: Number(program.minimumActiveDays) || 0,
        maxPendingReferrals: program.maxPendingReferrals === "" || program.maxPendingReferrals == null ? null : Number(program.maxPendingReferrals),
        maxTotalReferrals: program.maxTotalReferrals === "" || program.maxTotalReferrals == null ? null : Number(program.maxTotalReferrals),
      };
      const res = await referralAdminAPI.updateProgram(selectedOrg._id, payload);
      setProgram(res.data.program);
      toast.success("Referral program updated");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save program");
    } finally {
      setSavingProgram(false);
    }
  };

  const grantReward = async () => {
    if (!selectedOrg) return;
    const value = Number(grantDraft.rewardValue);
    if (!value || value <= 0) { toast.error("Reward value must be a positive number"); return; }
    try {
      await referralAdminAPI.grantManualReward({
        organizationId: selectedOrg._id,
        rewardType: grantDraft.rewardType,
        rewardValue: value,
        maxRewardAmount: grantDraft.maxRewardAmount === "" ? null : Number(grantDraft.maxRewardAmount),
        expiresAt: grantDraft.expiresAt || null,
      });
      toast.success("Reward granted");
      setShowGrant(false);
      setGrantDraft({ rewardType: "percentage", rewardValue: 20, maxRewardAmount: "", expiresAt: "" });
      loadOrg(selectedOrg._id);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to grant reward");
    }
  };

  const revokeReward = async (reward) => {
    if (!window.confirm(`Revoke this ${rewardValueLabel(reward)} reward? This can't be undone.`)) return;
    try {
      await referralAdminAPI.revokeReward(reward._id);
      toast.success("Reward revoked");
      loadOrg(selectedOrg._id);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to revoke reward");
    }
  };

  const setP = (patch) => setProgram((p) => ({ ...p, ...patch }));

  return (
    <div className="space-y-5">
      {/* Org selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <label className="block text-xs font-medium text-gray-500 mb-1">Organization</label>
        {selectedOrg ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-purple-600" />
              <span className="font-semibold text-gray-900">{selectedOrg.name}</span>
            </div>
            <button onClick={() => { setSelectedOrg(null); setProgram(null); setOverview(null); }} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> Change
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={orgSearch}
              onChange={(e) => setOrgSearch(e.target.value)}
              placeholder="Search an organization to manage its referral program..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            {orgResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                {orgResults.map((org) => (
                  <button key={org._id} onClick={() => selectOrg(org)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                    {org.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {!selectedOrg && (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-400">
          <Gift className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          Select an organization above to view and manage its referral program.
        </div>
      )}

      {selectedOrg && loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-400">Loading…</div>
      )}

      {selectedOrg && !loading && program && (
        <>
          {/* Program config */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><Gift className="w-4 h-4 text-purple-600" /> Program configuration</h3>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={!!program.enabled} onChange={(e) => setP({ enabled: e.target.checked })} />
                {program.enabled ? "Enabled" : "Disabled"}
              </label>
            </div>
            <p className="text-[11px] text-amber-600 mb-4">Changes only affect rewards created after saving — existing rewards are immutable and never rewritten.</p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Reward type">
                <select value={program.rewardType} onChange={(e) => setP({ rewardType: e.target.value })} className={inputCls}>
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed (₹)</option>
                </select>
              </Field>
              <Field label="Reward value">
                <input type="number" min="0" value={program.rewardValue} onChange={(e) => setP({ rewardValue: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Max reward amount (₹, blank = none)">
                <input type="number" min="0" value={program.maxRewardAmount ?? ""} onChange={(e) => setP({ maxRewardAmount: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Expiry (days, blank = never)" hint="How long a granted reward stays usable.">
                <input type="number" min="0" value={program.expiryDurationDays ?? ""} onChange={(e) => setP({ expiryDurationDays: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Max pending referrals (blank = ∞)">
                <input type="number" min="0" value={program.maxPendingReferrals ?? ""} onChange={(e) => setP({ maxPendingReferrals: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Max total referrals (blank = ∞)">
                <input type="number" min="0" value={program.maxTotalReferrals ?? ""} onChange={(e) => setP({ maxTotalReferrals: e.target.value })} className={inputCls} />
              </Field>

              {/* Not enforced yet — the backend model stores these but no code
                  reads them (mirrors the coupon page's "not yet supported"
                  fields). Shown greyed so admins aren't misled into thinking
                  they take effect. */}
              <Field label="Min active days before qualifying" hint="⚠ Not enforced yet — saved but has no effect.">
                <input type="number" min="0" value={program.minimumActiveDays ?? 0} onChange={(e) => setP({ minimumActiveDays: e.target.value })} className={`${inputCls} bg-gray-50 text-gray-400`} />
              </Field>
              <Field label="Stacks with coupons" hint="⚠ Not enforced yet — coupons + referral rewards currently always stack.">
                <select value={program.stacksWithCoupons ? "yes" : "no"} onChange={(e) => setP({ stacksWithCoupons: e.target.value === "yes" })} className={`${inputCls} bg-gray-50 text-gray-400`}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </Field>
              <Field label="Honored during trial" hint="⚠ Not enforced yet — saved but has no effect.">
                <select value={program.honoredDuringTrial ? "yes" : "no"} onChange={(e) => setP({ honoredDuringTrial: e.target.value === "yes" })} className={`${inputCls} bg-gray-50 text-gray-400`}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </Field>
            </div>

            <div className="flex justify-end mt-5">
              <button onClick={saveProgram} disabled={savingProgram} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50">
                <Save className="w-4 h-4" /> {savingProgram ? "Saving…" : "Save program"}
              </button>
            </div>
          </div>

          {/* Summary stats */}
          {overview?.summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Referrals sent", value: overview.summary.referralsSent ?? 0 },
                { label: "Pending", value: overview.summary.referralsPending ?? 0 },
                { label: "Qualified", value: overview.summary.referralsQualified ?? 0 },
                { label: "Rewards available", value: overview.summary.rewardsAvailable ?? 0 },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
                  <p className="text-xs text-gray-500">{s.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Rewards */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><Tag className="w-4 h-4 text-purple-600" /> Rewards</h3>
              <button onClick={() => setShowGrant(true)} className="flex items-center gap-1.5 text-xs font-medium bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700">
                <Plus className="w-3.5 h-3.5" /> Grant manual reward
              </button>
            </div>
            {(overview?.rewards || []).length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-400">No rewards for this organization yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="text-left px-4 py-2.5">Reward</th>
                    <th className="text-left px-4 py-2.5">Source</th>
                    <th className="text-left px-4 py-2.5">Earned</th>
                    <th className="text-left px-4 py-2.5">Expires</th>
                    <th className="text-left px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {overview.rewards.map((r) => (
                    <tr key={r._id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-semibold text-gray-900">{rewardValueLabel(r)} off</td>
                      <td className="px-4 py-2.5 text-gray-500">{r.source || "REFERRAL"}</td>
                      <td className="px-4 py-2.5 text-gray-500">{fmtDate(r.createdAt)}</td>
                      <td className="px-4 py-2.5 text-gray-500">{r.expiresAt ? fmtDate(r.expiresAt) : "Never"}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${REWARD_STATUS_BADGE[r.status] || "bg-gray-100 text-gray-500"}`}>{r.status}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {r.status !== "revoked" && r.status !== "consumed" && (
                          <button onClick={() => revokeReward(r)} className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium">
                            <Ban className="w-3.5 h-3.5" /> Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Referrals */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><Users className="w-4 h-4 text-purple-600" /> Referrals made</h3>
            </div>
            {(overview?.referralsSent || overview?.referrals || []).length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-400">This organization hasn't referred anyone yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="text-left px-4 py-2.5">Referred organization</th>
                    <th className="text-left px-4 py-2.5">Joined</th>
                    <th className="text-left px-4 py-2.5">Qualified</th>
                    <th className="text-left px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(overview.referralsSent || overview.referrals).map((r) => (
                    <tr key={r._id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{r.referredOrganization?.name || "Organization"}</td>
                      <td className="px-4 py-2.5 text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {fmtDate(r.createdAt)}</td>
                      <td className="px-4 py-2.5 text-gray-500">{fmtDate(r.qualifiedAt)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${REFERRAL_STATUS_BADGE[r.status] || "bg-gray-100 text-gray-500"}`}>{r.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Grant reward modal */}
      {showGrant && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[1000] p-4" onClick={() => setShowGrant(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Grant manual reward</h2>
              <button onClick={() => setShowGrant(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
            </div>
            <p className="text-xs text-gray-500 mb-4">Grants a reward to <span className="font-semibold">{selectedOrg?.name}</span> (source: MANUAL). Use for support/goodwill cases.</p>
            <div className="space-y-4">
              <Field label="Reward type">
                <select value={grantDraft.rewardType} onChange={(e) => setGrantDraft({ ...grantDraft, rewardType: e.target.value })} className={inputCls}>
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed (₹)</option>
                </select>
              </Field>
              <Field label="Reward value">
                <input type="number" value={grantDraft.rewardValue} onChange={(e) => setGrantDraft({ ...grantDraft, rewardValue: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Max reward amount (₹, blank = none)">
                <input type="number" value={grantDraft.maxRewardAmount} onChange={(e) => setGrantDraft({ ...grantDraft, maxRewardAmount: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Expires at (blank = never)">
                <input type="date" value={grantDraft.expiresAt} onChange={(e) => setGrantDraft({ ...grantDraft, expiresAt: e.target.value })} className={inputCls} />
              </Field>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowGrant(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
              <button onClick={grantReward} className="px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 text-white hover:bg-purple-700">Grant reward</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReferralProgramAdmin;
