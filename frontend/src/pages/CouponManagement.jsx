// pages/CouponManagement.jsx
import React, { useState, useEffect, useCallback } from "react";
import {
  Tag, Search, Plus, X, Save, Trash2, ToggleLeft, ToggleRight,
  Percent, IndianRupee, Calendar, BarChart3, Shuffle,
} from "lucide-react";
import toast from "react-hot-toast";
import API, { configureAxios } from "../services/api";
import { couponAPI } from "../services/couponApi";

const PLAN_OPTIONS = ["starter", "growth", "business"];

const EMPTY_DRAFT = {
  code: "", name: "", description: "", isActive: true,
  scope: { type: "global", organizations: [] },
  rules: [],
  eligibility: { billingCycle: "both" },
  duration: { type: "lifetime", cycles: "" },
  validity: { startDate: "", expiryDate: "" },
  usageLimits: { maxRedemptions: "", maxRedemptionsPerOrganization: "" },
};

// Only lifetime/until_cancelled are enforced today (see backend Coupon model
// comment) — the others are shown so admins know what's coming, but selecting
// them is blocked with an explanation rather than silently doing nothing.
const DURATION_OPTIONS = [
  { value: "lifetime", label: "Lifetime", enabled: true },
  { value: "until_cancelled", label: "Until cancelled by Super Admin", enabled: true },
  { value: "first_payment", label: "First payment only (not yet supported)", enabled: false },
  { value: "fixed_cycles", label: "Fixed number of billing cycles (not yet supported)", enabled: false },
  { value: "until_date", label: "Until a specific date (not yet supported)", enabled: false },
];

// A short, unambiguous random code (no 0/O/1/I) — good enough for a coupon
// code humans type in at checkout; uniqueness is still enforced server-side
// on create, so a rare collision just surfaces as the normal "already exists"
// error rather than needing a pre-check here.
const generateCouponCode = (length = 8) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

const statusOf = (coupon) => {
  if (!coupon.isActive) return "disabled";
  if (coupon.validity?.expiryDate && new Date(coupon.validity.expiryDate) < new Date()) return "expired";
  if (coupon.validity?.startDate && new Date(coupon.validity.startDate) > new Date()) return "scheduled";
  return "active";
};

const STATUS_BADGE = {
  active: "bg-green-100 text-green-700",
  expired: "bg-gray-100 text-gray-500",
  disabled: "bg-red-100 text-red-600",
  scheduled: "bg-blue-100 text-blue-600",
};

const Field = ({ label, children }) => (
  <div>
    <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
    {children}
  </div>
);

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

const prettyKey = (k) => (k || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const CouponManagement = () => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [editing, setEditing] = useState(null); // coupon._id or 'new'
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [addons, setAddons] = useState([]);
  const [orgSearch, setOrgSearch] = useState("");
  const [orgResults, setOrgResults] = useState([]);

  const fetchCoupons = useCallback(async () => {
    try {
      setLoading(true);
      configureAxios();
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== "all") params.status = statusFilter;
      const res = await couponAPI.getCoupons(params);
      setCoupons(res.data.coupons || []);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to load coupons");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const t = setTimeout(fetchCoupons, 250);
    return () => clearTimeout(t);
  }, [fetchCoupons]);

  useEffect(() => {
    configureAxios();
    API.get("/super-admin/addons").then((res) => setAddons(res.data.addons || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!editing) return;
    const t = setTimeout(async () => {
      try {
        const res = await couponAPI.searchOrganizations(orgSearch);
        setOrgResults(res.data.organizations || []);
      } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [orgSearch, editing]);

  // All products (plans + add-ons) as a flat list, each carrying enough info
  // to build/read a rule row: { productType, productKey, label }.
  const allProducts = [
    ...PLAN_OPTIONS.map((p) => ({ productType: "plan", productKey: p, label: prettyKey(p) })),
    ...addons.map((a) => ({ productType: "addon", productKey: a.key, label: a.displayName })),
  ];

  const openNew = () => {
    setDraft(JSON.parse(JSON.stringify(EMPTY_DRAFT)));
    setEditing("new");
  };

  const openEdit = (coupon) => {
    setDraft({
      ...JSON.parse(JSON.stringify(coupon)),
      rules: coupon.rules || [],
      eligibility: { billingCycle: coupon.eligibility?.billingCycle || "both" },
      duration: {
        type: coupon.duration?.type || "lifetime",
        cycles: coupon.duration?.cycles ?? "",
      },
      validity: {
        startDate: coupon.validity?.startDate ? coupon.validity.startDate.slice(0, 10) : "",
        expiryDate: coupon.validity?.expiryDate ? coupon.validity.expiryDate.slice(0, 10) : "",
      },
      usageLimits: {
        maxRedemptions: coupon.usageLimits?.maxRedemptions ?? "",
        maxRedemptionsPerOrganization: coupon.usageLimits?.maxRedemptionsPerOrganization ?? "",
      },
    });
    setEditing(coupon._id);
  };

  const closeEditor = () => { setEditing(null); setDraft(null); setOrgSearch(""); setOrgResults([]); };

  const handleSave = async () => {
    if (!draft.code.trim() || !draft.name.trim()) {
      toast.error("Code and name are required");
      return;
    }
    if (!draft.rules || draft.rules.length === 0) {
      toast.error("Enable at least one product and set its discount");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...draft,
        duration: {
          type: draft.duration.type,
          cycles: draft.duration.cycles === "" ? null : Number(draft.duration.cycles),
        },
        usageLimits: {
          maxRedemptions: draft.usageLimits.maxRedemptions === "" ? null : Number(draft.usageLimits.maxRedemptions),
          maxRedemptionsPerOrganization: draft.usageLimits.maxRedemptionsPerOrganization === "" ? null : Number(draft.usageLimits.maxRedemptionsPerOrganization),
        },
        validity: {
          startDate: draft.validity.startDate || null,
          expiryDate: draft.validity.expiryDate || null,
        },
        scope: {
          type: draft.scope.type,
          organizations: (draft.scope.organizations || []).map((o) => (typeof o === "string" ? o : o._id)),
        },
      };

      if (editing === "new") {
        await couponAPI.createCoupon(payload);
        toast.success("Coupon created");
      } else {
        await couponAPI.updateCoupon(editing, payload);
        toast.success("Coupon updated");
      }
      closeEditor();
      fetchCoupons();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save coupon");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (coupon) => {
    try {
      await couponAPI.toggleCouponStatus(coupon._id);
      fetchCoupons();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update status");
    }
  };

  const handleDelete = async (coupon) => {
    if (!window.confirm(`Delete coupon "${coupon.code}"? Coupons with redemption history are archived instead.`)) return;
    try {
      const res = await couponAPI.deleteCoupon(coupon._id);
      toast.success(res.data.archived ? "Coupon archived (had redemption history)" : "Coupon deleted");
      fetchCoupons();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete coupon");
    }
  };

  const addOrganization = (org) => {
    setDraft((d) => {
      if ((d.scope.organizations || []).some((o) => (o._id || o) === org._id)) return d;
      return { ...d, scope: { ...d.scope, organizations: [...(d.scope.organizations || []), org] } };
    });
  };

  const removeOrganization = (orgId) => {
    setDraft((d) => ({
      ...d,
      scope: { ...d.scope, organizations: d.scope.organizations.filter((o) => (o._id || o) !== orgId) },
    }));
  };

  // Rule helpers — a "product row" is enabled iff a rule exists for it.
  const ruleFor = (productType, productKey) =>
    (draft.rules || []).find((r) => r.productType === productType && r.productKey === productKey);

  const toggleProductRule = (productType, productKey) => {
    setDraft((d) => {
      const existing = (d.rules || []).find((r) => r.productType === productType && r.productKey === productKey);
      if (existing) {
        return { ...d, rules: d.rules.filter((r) => r !== existing) };
      }
      return { ...d, rules: [...(d.rules || []), { productType, productKey, discountType: "percentage", discountValue: 0 }] };
    });
  };

  const updateProductRule = (productType, productKey, patch) => {
    setDraft((d) => ({
      ...d,
      rules: d.rules.map((r) =>
        r.productType === productType && r.productKey === productKey ? { ...r, ...patch } : r
      ),
    }));
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Tag className="w-6 h-6 text-blue-600" /> Coupon Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">Create and manage discount rules for checkout.</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> New Coupon
        </button>
      </div>

      {/* Search + filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code or name..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {["all", "active", "expired", "disabled"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                statusFilter === s ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
        ) : coupons.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No coupons found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="text-left px-4 py-3">Code</th>
                <th className="text-left px-4 py-3">Discount Rules</th>
                <th className="text-left px-4 py-3">Scope</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Redemptions</th>
                <th className="text-left px-4 py-3">Discount Given</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {coupons.map((c) => (
                <tr key={c._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">{c.code}</div>
                    <div className="text-xs text-gray-500">{c.name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {(c.rules || []).map((r) => (
                        <span key={`${r.productType}-${r.productKey}`} className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-xs text-gray-700">
                          {prettyKey(r.productKey)}: {r.discountType === "percentage" ? `${r.discountValue}%` : `₹${r.discountValue}`}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {c.scope?.type === "global" ? "Global" : `${c.scope?.organizations?.length || 0} orgs`}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[statusOf(c)]}`}>
                      {statusOf(c)}
                    </span>
                  </td>
                  <td className="px-4 py-3">{c.analytics?.totalRedemptions || 0}</td>
                  <td className="px-4 py-3">₹{c.analytics?.totalDiscountValue || 0}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(c)} className="text-blue-600 hover:underline text-xs font-medium mr-3">
                      Edit
                    </button>
                    <button onClick={() => handleToggle(c)} className="text-gray-500 hover:text-gray-700 mr-3" title={c.isActive ? "Disable" : "Enable"}>
                      {c.isActive ? <ToggleRight className="w-5 h-5 text-green-600" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <button onClick={() => handleDelete(c)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Editor panel */}
      {draft && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[1000] p-4" onClick={closeEditor}>
          <div
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">{editing === "new" ? "New Coupon" : `Edit ${draft.code}`}</h2>
              <button onClick={closeEditor}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
            </div>

            <div className="space-y-5">
              {/* Basic */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Coupon Code">
                  <div className="flex gap-1.5">
                    <input
                      value={draft.code}
                      onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
                      disabled={editing !== "new"}
                      placeholder="WELCOME20"
                      className={`${inputCls} uppercase disabled:bg-gray-100`}
                    />
                    {editing === "new" && (
                      <button
                        type="button"
                        onClick={() => setDraft({ ...draft, code: generateCouponCode() })}
                        title="Generate a random code"
                        className="shrink-0 px-2.5 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                      >
                        <Shuffle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </Field>
                <Field label="Coupon Name">
                  <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputCls} />
                </Field>
              </div>
              <Field label="Description">
                <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2} className={inputCls} />
              </Field>

              {/* Scope */}
              <Field label="Scope">
                <div className="flex gap-2 mb-2">
                  {["global", "organizations"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setDraft({ ...draft, scope: { ...draft.scope, type: t } })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize border ${
                        draft.scope.type === t ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600"
                      }`}
                    >
                      {t === "global" ? "Global (anyone)" : "Selected Organizations"}
                    </button>
                  ))}
                </div>
                {draft.scope.type === "organizations" && (
                  <div className="border border-gray-200 rounded-lg p-3">
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {(draft.scope.organizations || []).map((o) => (
                        <span key={o._id || o} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full">
                          {o.name || o}
                          <button onClick={() => removeOrganization(o._id || o)}><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                    </div>
                    <input
                      value={orgSearch}
                      onChange={(e) => setOrgSearch(e.target.value)}
                      placeholder="Search organizations..."
                      className={inputCls}
                    />
                    {orgResults.length > 0 && (
                      <div className="mt-1 border border-gray-100 rounded-lg max-h-32 overflow-y-auto">
                        {orgResults.map((org) => (
                          <button
                            key={org._id}
                            onClick={() => addOrganization(org)}
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50"
                          >
                            {org.name}
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      Only these organizations can redeem this coupon, so per-organization usage limits below aren't shown — the org list already controls who's eligible.
                    </p>
                  </div>
                )}
              </Field>

              {/* Discount Rules — replaces the old single discount + eligibility
                  checkboxes. Each product (plan or add-on) can be individually
                  enabled with its own discount type/value, so one coupon can
                  give 30% off Starter, 15% off Growth, and a flat ₹100 off
                  Seats, with Storage left at no discount, all at once. */}
              <Field label="Discount Rules — enable a product and set its own discount">
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {allProducts.map(({ productType, productKey, label }) => {
                    const rule = ruleFor(productType, productKey);
                    const enabled = !!rule;
                    return (
                      <div key={`${productType}-${productKey}`} className="flex items-center gap-3 px-3 py-2">
                        <label className="flex items-center gap-2 w-40 shrink-0 text-sm">
                          <input type="checkbox" checked={enabled} onChange={() => toggleProductRule(productType, productKey)} />
                          {label}
                        </label>
                        {enabled ? (
                          <>
                            <select
                              value={rule.discountType}
                              onChange={(e) => updateProductRule(productType, productKey, { discountType: e.target.value })}
                              className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs"
                            >
                              <option value="percentage">%</option>
                              <option value="fixed">₹ Fixed</option>
                            </select>
                            <div className="relative w-28">
                              {rule.discountType === "percentage"
                                ? <Percent className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                                : <IndianRupee className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />}
                              <input
                                type="number"
                                value={rule.discountValue}
                                onChange={(e) => updateProductRule(productType, productKey, { discountValue: Number(e.target.value) })}
                                className="w-full pl-6 pr-2 py-1.5 border border-gray-300 rounded-lg text-xs"
                              />
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">No discount</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Field>

              <Field label="Billing Cycle">
                <select
                  value={draft.eligibility.billingCycle}
                  onChange={(e) => setDraft({ ...draft, eligibility: { ...draft.eligibility, billingCycle: e.target.value } })}
                  className={inputCls}
                >
                  <option value="both">Both</option>
                  <option value="monthly">Monthly only</option>
                  <option value="yearly">Annual only</option>
                </select>
              </Field>

              {/* Duration — how long the discount stays in effect on a
                  subscription once applied. Only Lifetime/Until cancelled are
                  actually enforced; the others exist so admins can see what's
                  planned, but are blocked with an explanation if selected. */}
              <Field label="Duration">
                <select
                  value={draft.duration.type}
                  onChange={(e) => setDraft({ ...draft, duration: { ...draft.duration, type: e.target.value } })}
                  className={inputCls}
                >
                  {DURATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} disabled={!opt.enabled}>{opt.label}</option>
                  ))}
                </select>
                {!DURATION_OPTIONS.find((o) => o.value === draft.duration.type)?.enabled && (
                  <p className="text-xs text-amber-600 mt-1">
                    This duration isn't enforced yet — the system can't auto-revert pricing after a set period. Choose Lifetime or Until cancelled.
                  </p>
                )}
                {draft.duration.type === "fixed_cycles" && (
                  <input
                    type="number"
                    value={draft.duration.cycles}
                    onChange={(e) => setDraft({ ...draft, duration: { ...draft.duration, cycles: e.target.value } })}
                    placeholder="Number of billing cycles"
                    className={`${inputCls} mt-2`}
                  />
                )}
              </Field>

              {/* Validity */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start Date">
                  <input type="date" value={draft.validity.startDate} onChange={(e) => setDraft({ ...draft, validity: { ...draft.validity, startDate: e.target.value } })} className={inputCls} />
                </Field>
                <Field label="Expiry Date">
                  <input type="date" value={draft.validity.expiryDate} onChange={(e) => setDraft({ ...draft, validity: { ...draft.validity, expiryDate: e.target.value } })} className={inputCls} />
                </Field>
              </div>

              {/* Usage limits — hidden entirely for org-scoped coupons since
                  the organization allow-list already controls who's eligible;
                  showing redemption caps on top of that is redundant/confusing. */}
              {draft.scope.type !== "organizations" && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Max Total Redemptions (blank = unlimited)">
                    <input type="number" value={draft.usageLimits.maxRedemptions} onChange={(e) => setDraft({ ...draft, usageLimits: { ...draft.usageLimits, maxRedemptions: e.target.value } })} className={inputCls} />
                  </Field>
                  <Field label="Max Redemptions / Organization">
                    <input type="number" value={draft.usageLimits.maxRedemptionsPerOrganization} onChange={(e) => setDraft({ ...draft, usageLimits: { ...draft.usageLimits, maxRedemptionsPerOrganization: e.target.value } })} className={inputCls} />
                  </Field>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />
                Active
              </label>

              {/* Analytics (edit mode only) */}
              {editing !== "new" && draft.analytics && (
                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 flex items-center gap-4">
                  <BarChart3 className="w-4 h-4 text-gray-400" />
                  <span>{draft.analytics.totalRedemptions || 0} redemptions</span>
                  <span>{draft.analytics.organizationsUsed?.length || 0} orgs</span>
                  <span>₹{draft.analytics.totalDiscountValue || 0} discounted</span>
                  <span>₹{draft.analytics.revenueInfluenced || 0} revenue influenced</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
              <button onClick={closeEditor} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Coupon"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CouponManagement;
