import React, { useState, useEffect } from "react";
import {
  Save,
  X,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Package,
  IndianRupee,
  HardDrive,
  Mail,
  Tag,
  Layers,
  FileText,
  ChevronRight,
  Users,
  ToggleLeft,
  ToggleRight,
  Shield,
  Zap,
} from "lucide-react";
import toast from "react-hot-toast";
import API, { configureAxios } from "../services/api";

const Shimmer = () => (
  <div className="animate-pulse space-y-6">
    <div className="h-8 bg-gray-200 rounded w-1/4"></div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 h-64"></div>
      ))}
    </div>
  </div>
);

const EFFECT_TYPE_LABELS = {
  limit_boost: 'Limit Boost',
  module_unlock: 'Module Unlock',
  flag_only: 'Flag Only',
};

const TARGET_KEY_HINTS = {
  limit_boost: 'contacts, deals, emailTemplates, seats, fileStorage…',
  module_unlock: 'Module key, e.g. contacts, invoices',
  flag_only: 'Custom key, e.g. prioritySupport',
};

const ADDON_DRAFT_EMPTY = {
  key: '', displayName: '', description: '',
  pricingType: 'quantity', effectType: 'limit_boost',
  targetKey: '', incrementPerUnit: 1,
  price: { monthly: 0, yearly: 0 },
  maxQuantityPerOrg: '', sortOrder: 0, isActive: false,
  availableOnPlans: [],
};

const MODULE_ICONS = {
  contacts: Users,
  companies: Layers,
  deals: Zap,
  vendors: Package,
  invoices: FileText,
  quotations: FileText,
  "delivery-challans": FileText,
  tasks: CheckCircle2,
  callLogs: Layers,
  meetings: Layers,
  folders: Layers,
  tags: Tag,
  emails: Mail,
  purchases: Package,
};

const PLAN_STYLES = {
  trial:    { accent: "bg-gray-100 text-gray-600", dot: "bg-gray-400", ring: "border-gray-300" },
  test:     { accent: "bg-gray-100 text-gray-600", dot: "bg-gray-400", ring: "border-gray-300" },
  starter:  { accent: "bg-blue-50 text-blue-700",  dot: "bg-blue-500", ring: "border-blue-400" },
  growth:   { accent: "bg-purple-50 text-purple-700", dot: "bg-purple-500", ring: "border-purple-400" },
  business: { accent: "bg-indigo-50 text-indigo-700", dot: "bg-indigo-500", ring: "border-indigo-400" },
};

const formatLimit = (val) => {
  if (val === "unlimited" || val === undefined || val === null) return "∞";
  if (typeof val === "number") return val.toLocaleString();
  return val;
};

const PlanCard = ({ plan, onClick, isSelected }) => {
  const style = PLAN_STYLES[plan.planId] || PLAN_STYLES.starter;
  const modules = plan.features?.modules || {};
  const enabledModules = Object.entries(modules).filter(([, v]) => v.read || v.write);
  const limitedModules = Object.entries(modules).filter(([, v]) => v.limit !== undefined && v.limit !== "unlimited");

  return (
    <button
      onClick={() => onClick(plan)}
      className={`text-left w-full bg-white rounded-xl border-2 p-5 transition-all duration-200 hover:shadow-md flex flex-col gap-4 ${
        isSelected ? `${style.ring} ring-2 ring-offset-1 shadow-md` : "border-gray-100 hover:border-gray-200"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide ${style.accent}`}>
          {plan.planId}
        </span>
        <span className={`w-2 h-2 rounded-full ${plan.isActive ? style.dot : "bg-gray-300"}`} />
      </div>

      <div>
        <p className="text-2xl font-bold text-gray-900">
          ₹{plan.monthlyPrice}
          <span className="text-sm font-normal text-gray-400">/mo</span>
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          ₹{plan.yearlyPrice}/yr · {plan.discount}% off
        </p>
      </div>

      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between text-gray-500">
          <span>Email templates</span>
          <span className="font-medium text-gray-800">{plan.features?.emailTemplates ?? "—"}</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>Sales pipelines</span>
          <span className="font-medium text-gray-800">{plan.features?.salesPipelines ?? "—"}</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>Custom fields</span>
          <span className="font-medium text-gray-800">{plan.features?.customFields ?? "—"}</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>Storage</span>
          <span className="font-medium text-gray-800">
            {Math.round((plan.features?.fileStorage || 0) / (1024 * 1024 * 1024))} GB
          </span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>Modules on</span>
          <span className="font-medium text-gray-800">{enabledModules.length}</span>
        </div>
        {limitedModules.length > 0 && (
          <div className="flex justify-between text-gray-500">
            <span>Capped modules</span>
            <span className="font-medium text-gray-800">{limitedModules.length}</span>
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-gray-100">
        <div className="flex flex-wrap gap-1">
          {enabledModules.slice(0, 5).map(([name]) => (
            <span key={name} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
              {name.replace(/-/g, " ")}
            </span>
          ))}
          {enabledModules.length > 5 && (
            <span className="text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">
              +{enabledModules.length - 5} more
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center text-xs text-blue-600 font-medium mt-auto">
        Edit plan <ChevronRight className="w-3.5 h-3.5 ml-1" />
      </div>
    </button>
  );
};

const Toggle = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
      checked ? "bg-blue-600" : "bg-gray-200"
    }`}
  >
    <span
      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
        checked ? "translate-x-5" : "translate-x-1"
      }`}
    />
  </button>
);

const ModuleRow = ({ moduleName, config, onChange }) => {
  const Icon = MODULE_ICONS[moduleName] || Layers;
  return (
    <div className="flex items-center gap-4 py-2.5 px-3 hover:bg-gray-50 rounded-lg">
      <Icon className="w-4 h-4 text-gray-400 shrink-0" />
      <span className="text-sm text-gray-700 flex-1 capitalize">
        {moduleName.replace(/-/g, " ")}
      </span>
      <div className="flex items-center gap-5">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <span className="text-xs text-gray-400">Read</span>
          <Toggle checked={!!config.read} onChange={(v) => onChange(moduleName, "read", v)} />
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <span className="text-xs text-gray-400">Write</span>
          <Toggle checked={!!config.write} onChange={(v) => onChange(moduleName, "write", v)} />
        </label>
        {config.limit !== undefined && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">Limit</span>
            <input
              type="text"
              value={config.limit}
              onChange={(e) => onChange(moduleName, "limit", e.target.value)}
              placeholder="unlimited"
              className="w-24 text-xs border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
            />
          </div>
        )}
      </div>
    </div>
  );
};

const Field = ({ label, children }) => (
  <div>
    <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
    {children}
  </div>
);

const NumberInput = ({ value, onChange, suffix }) => (
  <div className="relative">
    <input
      type="number"
      min="0"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
    {suffix && (
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{suffix}</span>
    )}
  </div>
);

const AddonFormFields = ({ form, onChange, onPriceChange, isNew = false }) => (
  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
    {isNew && (
      <Field label="Key (permanent, snake_case)">
        <input
          type="text"
          value={form.key}
          onChange={(e) => onChange('key', e.target.value)}
          placeholder="e.g. extra_contacts"
          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </Field>
    )}
    <Field label="Display Name">
      <input
        type="text"
        value={form.displayName}
        onChange={(e) => onChange('displayName', e.target.value)}
        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      />
    </Field>
    <Field label="Pricing Type">
      <select
        value={form.pricingType}
        onChange={(e) => onChange('pricingType', e.target.value)}
        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        <option value="quantity">Quantity (1, 2, 3…)</option>
        <option value="boolean">Boolean (on / off)</option>
      </select>
    </Field>
    <Field label="Effect Type">
      <select
        value={form.effectType}
        onChange={(e) => onChange('effectType', e.target.value)}
        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        <option value="limit_boost">Limit Boost</option>
        <option value="module_unlock">Module Unlock</option>
        <option value="flag_only">Flag Only</option>
      </select>
    </Field>
    {(form.effectType === 'limit_boost' || form.effectType === 'module_unlock') && (
      <Field label={`Target Key — ${TARGET_KEY_HINTS[form.effectType]}`}>
        <input
          type="text"
          value={form.targetKey || ''}
          onChange={(e) => onChange('targetKey', e.target.value)}
          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </Field>
    )}
    {form.effectType === 'limit_boost' && (
      <Field label="Increment per Unit">
        <NumberInput value={form.incrementPerUnit ?? 1} onChange={(v) => onChange('incrementPerUnit', v)} />
      </Field>
    )}
    <Field label="Monthly Price (₹)">
      <NumberInput value={form.price?.monthly ?? 0} onChange={(v) => onPriceChange('monthly', v)} />
    </Field>
    <Field label="Yearly Price (₹)">
      <NumberInput value={form.price?.yearly ?? 0} onChange={(v) => onPriceChange('yearly', v)} />
    </Field>
    <Field label="Max Qty per Org (blank = unlimited)">
      <input
        type="number"
        min="1"
        value={form.maxQuantityPerOrg ?? ''}
        placeholder="Unlimited"
        onChange={(e) => onChange('maxQuantityPerOrg', e.target.value === '' ? null : Number(e.target.value))}
        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      />
    </Field>
  </div>
);

const PlanManagement = () => {
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [editedPlan, setEditedPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [newModuleName, setNewModuleName] = useState("");
  const [showAddModule, setShowAddModule] = useState(false);

  // Addon state
  const [allAddons, setAllAddons] = useState([]);
  const [addonForms, setAddonForms] = useState({}); // { [addonId]: partial overrides }
  const [addonSaving, setAddonSaving] = useState(null);
  const [addonDeleting, setAddonDeleting] = useState(null);
  const [showNewAddon, setShowNewAddon] = useState(false);
  const [newAddonDraft, setNewAddonDraft] = useState(null);
  const [newAddonSaving, setNewAddonSaving] = useState(false);

  useEffect(() => { fetchPlans(); fetchAddons(); }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      configureAxios();
      const res = await API.get("/super-admin/plans");
      setPlans(res.data.plans || []);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to fetch plans");
      toast.error(err.response?.data?.error || "Failed to fetch plans");
    } finally {
      setLoading(false);
    }
  };

  const fetchAddons = async () => {
    try {
      configureAxios();
      const res = await API.get("/super-admin/addons");
      setAllAddons(res.data.addons || []);
    } catch (err) {
      console.error("Failed to fetch add-ons:", err);
    }
  };

  const handleSelectPlan = (plan) => {
    setSelectedPlan(plan);
    setEditedPlan(JSON.parse(JSON.stringify(plan)));
    setShowAddModule(false);
    setAddonForms({});
    setShowNewAddon(false);
    setNewAddonDraft(null);
  };

  // planAddons: add-ons relevant to the currently edited plan
  const planAddons = editedPlan
    ? allAddons.filter(
        (a) => a.availableOnPlans.length === 0 || a.availableOnPlans.includes(editedPlan.planId)
      )
    : [];

  const getAddonForm = (addon) => {
    const overrides = addonForms[addon._id] || {};
    return {
      ...addon,
      ...overrides,
      price: { ...addon.price, ...(overrides.price || {}) },
    };
  };

  const handleAddonFieldChange = (addonId, field, value) => {
    setAddonForms((prev) => ({ ...prev, [addonId]: { ...prev[addonId], [field]: value } }));
  };

  const handleAddonPriceChange = (addonId, cycle, value) => {
    setAddonForms((prev) => ({
      ...prev,
      [addonId]: {
        ...prev[addonId],
        price: { ...(prev[addonId]?.price || {}), [cycle]: value },
      },
    }));
  };

  const handleSaveAddon = async (addonId) => {
    setAddonSaving(addonId);
    try {
      configureAxios();
      const overrides = addonForms[addonId] || {};
      await API.put(`/super-admin/addons/${addonId}`, overrides);
      toast.success("Add-on saved");
      await fetchAddons();
      setAddonForms((prev) => { const n = { ...prev }; delete n[addonId]; return n; });
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save add-on");
    } finally {
      setAddonSaving(null);
    }
  };

  const handleDeleteAddon = async (addonId) => {
    setAddonDeleting(addonId);
    try {
      configureAxios();
      await API.delete(`/super-admin/addons/${addonId}`);
      toast.success("Add-on deleted");
      await fetchAddons();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete add-on");
    } finally {
      setAddonDeleting(null);
    }
  };

  const handleNewAddonFieldChange = (field, value) => {
    setNewAddonDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleNewAddonPriceChange = (cycle, value) => {
    setNewAddonDraft((prev) => ({ ...prev, price: { ...prev.price, [cycle]: value } }));
  };

  const handleCreateAddon = async () => {
    setNewAddonSaving(true);
    try {
      configureAxios();
      const payload = {
        ...newAddonDraft,
        maxQuantityPerOrg:
          newAddonDraft.maxQuantityPerOrg === '' || newAddonDraft.maxQuantityPerOrg == null
            ? null
            : Number(newAddonDraft.maxQuantityPerOrg),
      };
      await API.post("/super-admin/addons", payload);
      toast.success("Add-on created");
      await fetchAddons();
      setShowNewAddon(false);
      setNewAddonDraft(null);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create add-on");
    } finally {
      setNewAddonSaving(false);
    }
  };

  const handleClose = () => {
    setSelectedPlan(null);
    setEditedPlan(null);
  };

  const handleModuleChange = (moduleName, field, value) => {
    setEditedPlan((prev) => {
      const updated = { ...prev };
      updated.features = { ...updated.features };
      updated.features.modules = { ...updated.features.modules };
      updated.features.modules[moduleName] = {
        ...updated.features.modules[moduleName],
        [field]:
          field === "limit"
            ? value === "unlimited" ? "unlimited" : Number(value)
            : value,
      };
      return updated;
    });
  };

  const handleFeatureChange = (field, value) => {
    setEditedPlan((prev) => ({ ...prev, features: { ...prev.features, [field]: value } }));
  };

  const handlePriceChange = (field, value) => {
    setEditedPlan((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddModule = () => {
    const name = newModuleName.trim();
    if (!name) return;
    if (editedPlan.features.modules[name]) {
      toast.error(`Module "${name}" already exists`);
      return;
    }
    setEditedPlan((prev) => ({
      ...prev,
      features: {
        ...prev.features,
        modules: { ...prev.features.modules, [name]: { read: false, write: false } },
      },
    }));
    setNewModuleName("");
    setShowAddModule(false);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      configureAxios();
      const res = await API.put(`/super-admin/plans/${editedPlan.planId}`, {
        monthlyPrice: editedPlan.monthlyPrice,
        yearlyPrice: editedPlan.yearlyPrice,
        discount: editedPlan.discount,
        isActive: editedPlan.isActive,
        features: editedPlan.features,
      });
      toast.success(
        `Saved — applied to ${res.data.affectedOrganizations} org${res.data.affectedOrganizations === 1 ? "" : "s"}`
      );
      await fetchPlans();
      setSelectedPlan(res.data.plan);
      setEditedPlan(JSON.parse(JSON.stringify(res.data.plan)));
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update plan");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Shimmer />;

  if (error && plans.length === 0)
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Plan Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          Click a plan to edit pricing, modules, and limits.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {plans.map((plan) => (
          <PlanCard
            key={plan._id}
            plan={plan}
            onClick={handleSelectPlan}
            isSelected={selectedPlan?._id === plan._id}
          />
        ))}
      </div>

      {editedPlan && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide ${
                (PLAN_STYLES[editedPlan.planId] || PLAN_STYLES.starter).accent
              }`}>
                {editedPlan.planId}
              </span>
              <span className="text-sm text-gray-500">Changes apply immediately to all orgs on this plan</span>
            </div>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-8">
            {/* Pricing */}
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Pricing</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Monthly price (₹/user)">
                  <NumberInput value={editedPlan.monthlyPrice} onChange={(v) => handlePriceChange("monthlyPrice", v)} />
                </Field>
                <Field label="Yearly price (₹/user)">
                  <NumberInput value={editedPlan.yearlyPrice} onChange={(v) => handlePriceChange("yearlyPrice", v)} />
                </Field>
                <Field label="Discount (%)">
                  <NumberInput value={editedPlan.discount} onChange={(v) => handlePriceChange("discount", v)} suffix="%" />
                </Field>
                <Field label="Status">
                  <button
                    onClick={() => handlePriceChange("isActive", !editedPlan.isActive)}
                    className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      editedPlan.isActive
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-gray-50 text-gray-500 border-gray-200"
                    }`}
                  >
                    {editedPlan.isActive
                      ? <><CheckCircle2 className="w-4 h-4" /> Active</>
                      : <><XCircle className="w-4 h-4" /> Inactive</>}
                  </button>
                </Field>
              </div>
            </section>

            {/* Usage limits */}
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Usage limits</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Email templates">
                  <NumberInput value={editedPlan.features.emailTemplates || 0} onChange={(v) => handleFeatureChange("emailTemplates", v)} />
                </Field>
                <Field label="Sales pipelines">
                  <NumberInput value={editedPlan.features.salesPipelines || 0} onChange={(v) => handleFeatureChange("salesPipelines", v)} />
                </Field>
                <Field label="Custom fields">
                  <NumberInput value={editedPlan.features.customFields || 0} onChange={(v) => handleFeatureChange("customFields", v)} />
                </Field>
                <Field label="Record tags">
                  <NumberInput value={editedPlan.features.recordTags || 0} onChange={(v) => handleFeatureChange("recordTags", v)} />
                </Field>
                <Field label="Website forms">
                  <NumberInput value={editedPlan.features.websiteForms || 0} onChange={(v) => handleFeatureChange("websiteForms", v)} />
                </Field>
                <Field label="File storage">
                  <NumberInput
                    value={Math.round((editedPlan.features.fileStorage || 0) / (1024 * 1024 * 1024))}
                    onChange={(v) => handleFeatureChange("fileStorage", v * 1024 * 1024 * 1024)}
                    suffix="GB"
                  />
                </Field>
                <Field label="Included seats">
                  <NumberInput
                    value={editedPlan.features.includedSeats ?? 1}
                    onChange={(v) => handleFeatureChange("includedSeats", v)}
                  />
                </Field>
                <Field label="Extra seat price — Monthly (₹)">
                  <NumberInput
                    value={editedPlan.features.extraSeatPrice?.monthly ?? 0}
                    onChange={(v) =>
                      setEditedPlan((prev) => ({
                        ...prev,
                        features: {
                          ...prev.features,
                          extraSeatPrice: { ...prev.features.extraSeatPrice, monthly: v },
                        },
                      }))
                    }
                    suffix="₹/mo"
                  />
                </Field>
                <Field label="Extra seat price — Yearly (₹)">
                  <NumberInput
                    value={editedPlan.features.extraSeatPrice?.yearly ?? 0}
                    onChange={(v) =>
                      setEditedPlan((prev) => ({
                        ...prev,
                        features: {
                          ...prev.features,
                          extraSeatPrice: { ...prev.features.extraSeatPrice, yearly: v },
                        },
                      }))
                    }
                    suffix="₹/yr"
                  />
                </Field>
              </div>
              {editedPlan.features.extraSeatRazorpayPlanIds?.monthly ? (
                <p className="mt-2 text-xs text-green-600 font-medium">Razorpay plan linked ✓</p>
              ) : (
                <p className="mt-2 text-xs text-amber-600">
                  Razorpay extra-seat plan not yet created — run{" "}
                  <code className="font-mono">scripts/createExtraSeatRazorpayPlan.js</code> after setting prices above.
                </p>
              )}
            </section>

            {/* Feature flags */}
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Feature flags</h2>
              <div className="flex gap-6">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <Toggle
                    checked={!!editedPlan.features.rottenDeals}
                    onChange={(v) => handleFeatureChange("rottenDeals", v)}
                  />
                  <span className="text-sm text-gray-700">Rotten deals</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <Toggle
                    checked={!!editedPlan.features.advancedReports}
                    onChange={(v) => handleFeatureChange("advancedReports", v)}
                  />
                  <span className="text-sm text-gray-700">Advanced reports</span>
                </label>
              </div>
            </section>

            {/* Module access */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Module access</h2>
                <button
                  onClick={() => setShowAddModule(!showAddModule)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  + Add module
                </button>
              </div>

              {showAddModule && (
                <div className="flex items-center gap-2 mb-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <input
                    type="text"
                    value={newModuleName}
                    onChange={(e) => setNewModuleName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddModule()}
                    placeholder="e.g. quotations"
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <button
                    onClick={handleAddModule}
                    className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
              )}

              <div className="border border-gray-100 rounded-xl divide-y divide-gray-50 overflow-hidden">
                {Object.entries(editedPlan.features.modules || {}).map(([name, config]) => (
                  <ModuleRow
                    key={name}
                    moduleName={name}
                    config={config}
                    onChange={handleModuleChange}
                  />
                ))}
              </div>
            </section>

            {/* Purchasable Add-ons */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Purchasable Add-ons</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Add-ons shown here are available on this plan (or all plans). Each add-on has a real mechanical effect enforced at access-control time.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowNewAddon(true);
                    setNewAddonDraft({ ...ADDON_DRAFT_EMPTY, availableOnPlans: [editedPlan.planId] });
                  }}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 shrink-0 ml-4"
                >
                  + New Add-on
                </button>
              </div>

              {planAddons.length === 0 && !showNewAddon && (
                <p className="text-sm text-gray-400 py-2">No add-ons configured for this plan yet.</p>
              )}

              {planAddons.length > 0 && (
                <div className="space-y-3">
                  {planAddons.map((addon) => {
                    const form = getAddonForm(addon);
                    const isDirty = !!addonForms[addon._id] && Object.keys(addonForms[addon._id]).length > 0;
                    return (
                      <div key={addon._id} className="border border-gray-200 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                              {addon.key}
                            </code>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              form.effectType === 'limit_boost' ? 'bg-blue-50 text-blue-700' :
                              form.effectType === 'module_unlock' ? 'bg-purple-50 text-purple-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {EFFECT_TYPE_LABELS[form.effectType] || form.effectType}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">Visible to customers</span>
                            <Toggle
                              checked={!!form.isActive}
                              onChange={(v) => handleAddonFieldChange(addon._id, 'isActive', v)}
                            />
                          </div>
                        </div>

                        <AddonFormFields
                          form={form}
                          onChange={(field, value) => handleAddonFieldChange(addon._id, field, value)}
                          onPriceChange={(cycle, value) => handleAddonPriceChange(addon._id, cycle, value)}
                          isNew={false}
                        />

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            onClick={() => handleDeleteAddon(addon._id)}
                            disabled={addonDeleting === addon._id || addonSaving === addon._id}
                            className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
                          >
                            {addonDeleting === addon._id ? 'Deleting…' : 'Delete'}
                          </button>
                          <button
                            onClick={() => handleSaveAddon(addon._id)}
                            disabled={!isDirty || addonSaving === addon._id || addonDeleting === addon._id}
                            className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {addonSaving === addon._id ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {showNewAddon && newAddonDraft && (
                <div className="mt-3 border border-blue-200 rounded-xl p-4 bg-blue-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-900">New Add-on</span>
                    <button
                      onClick={() => { setShowNewAddon(false); setNewAddonDraft(null); }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <AddonFormFields
                    form={newAddonDraft}
                    onChange={handleNewAddonFieldChange}
                    onPriceChange={handleNewAddonPriceChange}
                    isNew={true}
                  />

                  <div className="flex items-center gap-3 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Toggle
                        checked={!!newAddonDraft.isActive}
                        onChange={(v) => handleNewAddonFieldChange('isActive', v)}
                      />
                      <span className="text-xs text-gray-600">Visible to customers immediately</span>
                    </label>
                    <div className="ml-auto flex gap-2">
                      <button
                        onClick={() => { setShowNewAddon(false); setNewAddonDraft(null); }}
                        disabled={newAddonSaving}
                        className="px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreateAddon}
                        disabled={newAddonSaving}
                        className="px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {newAddonSaving ? 'Creating…' : 'Create Add-on'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
            <button
              onClick={handleClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Saving...</>
              ) : (
                <><Save className="w-4 h-4" /> Save changes</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanManagement;