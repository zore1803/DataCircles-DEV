// pages/FormDetailPage.jsx
// Form Detail — Build order step 2, per FORMS_FRONTEND_ARCHITECTURE.md §1.2/§3. New top-level
// route (/forms/:id), mirroring /companies/:id -> CompanyProfilePage.jsx's structure exactly:
// useParams for the id, a tab bar + activeTab useState, conditional content blocks per tab.
// Overview is real from the start (cheap — reuses data the other tabs need anyway); Submissions/
// Duplicate Reviews are placeholders until their own build-order steps land.
//
// Builder is NOT one of these tabs — later, explicit decision (post-dating the architecture doc's
// original tab list): Builder is a dedicated full-width route, /forms/:id/builder, sibling to this
// page rather than a tab within it. See FormBuilderPage.jsx.
import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import API from "../services/api";
import toast from "react-hot-toast";
import { ArrowLeft, Copy } from "lucide-react";

// Second independent copy of this exact pattern within Forms (FormsList.jsx has the first) — per
// architecture doc §6/decision 1, "copy, don't extract." Logged as flagged debt in
// FORMS_IMPLEMENTATION.md alongside the drawer duplication.
const STATUS_CONFIG = {
  draft: { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200", dot: "bg-gray-400" },
  published: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", dot: "bg-green-500" },
  paused: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" },
  archived: { bg: "bg-gray-50", text: "text-gray-500", border: "border-gray-200", dot: "bg-gray-400" },
};
const FormStatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

// Same small inline relative-time helper as FormsList.jsx — no shared date util exists in this
// codebase (confirmed in the frontend audit), so it stays local per file rather than becoming a
// new shared abstraction.
function timeAgo(dateString) {
  if (!dateString) return "—";
  const diffMs = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString();
}

const loadingMessages = [
  "Loading your form…",
  "Pulling up the details…",
  "Almost there — just a moment…",
];
const randomMessage = loadingMessages[Math.floor(Math.random() * loadingMessages.length)];

// Builder is deliberately NOT one of these tabs — per explicit decision, it's a dedicated full-width
// route (/forms/:id/builder), sibling to this tabbed page, not a tab within it. See FormBuilderPage.jsx.
const tabs = ["Overview", "Submissions", "Duplicate Reviews", "Settings"];

function OverviewTab({ form, activeVersion, submissionCount, pendingReviewCount, lastSubmittedAt, setActiveTab, navigate }) {
  // No public Forms renderer page exists in the frontend yet (confirmed in the original frontend
  // audit) — only the backend accepts submissions, at POST /api/public/forms/:publicSlug/submit.
  // Showing a fake-working "open this URL" link would silently 404. Surface the real slug (useful
  // for a developer testing the backend endpoint directly) without pretending a public page exists.
  const publicSlug = form.publishState?.publicSlug || null;

  const copySlug = () => {
    if (!publicSlug) return;
    navigator.clipboard.writeText(publicSlug);
    toast.success("Slug copied");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <p className="text-xs text-gray-500 font-medium">Version</p>
          <p className="text-xl font-bold text-gray-900 mt-1">
            {activeVersion ? `v${activeVersion.versionNumber}` : "—"}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {activeVersion ? `Published ${timeAgo(activeVersion.publishedAt)}` : "Not published yet"}
          </p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <p className="text-xs text-gray-500 font-medium">Status</p>
          <div className="mt-1"><FormStatusBadge status={form.status} /></div>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <p className="text-xs text-gray-500 font-medium">Submissions</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{submissionCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {lastSubmittedAt ? `Last submission ${timeAgo(lastSubmittedAt)}` : "None yet"}
          </p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <p className="text-xs text-gray-500 font-medium">Pending Reviews</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{pendingReviewCount}</p>
          <p className={`text-xs mt-0.5 ${pendingReviewCount > 0 ? "text-amber-600 font-medium" : "text-gray-400"}`}>
            {pendingReviewCount > 0 ? "Needs attention" : "All clear"}
          </p>
        </div>
      </div>

      {publicSlug && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-blue-700 font-medium">Public slug (no public form page exists yet)</p>
            <span className="text-sm text-blue-800 truncate block">{publicSlug}</span>
          </div>
          <button onClick={copySlug} className="p-1.5 hover:bg-blue-100 rounded-lg shrink-0" title="Copy slug">
            <Copy className="w-4 h-4 text-blue-700" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => navigate(`/forms/${form._id}/builder`)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          Continue Editing
        </button>
        <button
          onClick={() => setActiveTab("Submissions")}
          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          View Submissions
        </button>
        <button
          onClick={() => setActiveTab("Duplicate Reviews")}
          disabled={pendingReviewCount === 0}
          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Review Duplicates
        </button>
        {/* "Open Public Form" intentionally omitted — no public renderer page exists yet to open. */}
      </div>
    </div>
  );
}

function FormSettingsTab({ form, onFormUpdated }) {
  const [title, setTitle] = useState(form.title);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const saveTitle = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      const res = await API.patch(`/forms/${form._id}`, { title: title.trim() });
      onFormUpdated(res.data.form);
      toast.success("Saved");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    setPublishing(true);
    try {
      const res = await API.post(`/forms/${form._id}/publish`);
      onFormUpdated(res.data.form);
      toast.success(`Published (version ${res.data.versionNumber})`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to publish");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={saveTitle}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Module</label>
        <p className="text-sm text-gray-500">{form.module} (can't be changed after creation)</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Publish</label>
        <div className="flex items-center gap-3">
          <FormStatusBadge status={form.status} />
          <button
            onClick={publish}
            disabled={publishing}
            className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {publishing ? "Publishing..." : "Publish"}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Publishing requires at least one field in the Builder — an empty form can't be published.
        </p>
      </div>
    </div>
  );
}

function PlaceholderTab({ label }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-gray-500 font-medium">{label} — coming soon</p>
    </div>
  );
}

const FormDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [activeVersion, setActiveVersion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Overview");
  const [submissionCount, setSubmissionCount] = useState(0);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const [lastSubmittedAt, setLastSubmittedAt] = useState(null);

  const loadForm = useCallback(async () => {
    try {
      setLoading(true);
      const [formRes, submissionsRes, reviewsRes] = await Promise.all([
        API.get(`/forms/${id}`),
        // limit:1 sorted by submittedAt desc (formController.listSubmissions default sort) also
        // hands back the single most recent submission for free — no separate endpoint needed.
        API.get(`/forms/${id}/submissions`, { params: { limit: 1 } }),
        API.get("/duplicate-reviews", { params: { formId: id, decision: "pending", limit: 1 } }),
      ]);
      setForm(formRes.data.form);
      setActiveVersion(formRes.data.activeVersion);
      setLastSubmittedAt(submissionsRes.data.submissions?.[0]?.submittedAt || null);
      setSubmissionCount(submissionsRes.data.pagination?.totalCount || 0);
      setPendingReviewCount(reviewsRes.data.pagination?.totalCount || 0);
    } catch (err) {
      if (err.response?.status === 404) {
        toast.error("Form not found");
        navigate("/settings/forms");
      } else {
        toast.error("Failed to load form");
      }
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadForm();
  }, [loadForm]);

  if (loading || !form) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="mt-3 text-gray-600 font-medium">{randomMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div>
        <Link
          to="/settings/forms"
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 mb-4 transition-all w-fit text-sm font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Forms
        </Link>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{form.title}</h1>
            <FormStatusBadge status={form.status} />
          </div>
          <p className="text-gray-500 text-sm mt-1">{form.module} Form</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg">
          <nav className="flex items-center border-b border-gray-200 overflow-x-auto">
            <div className="flex flex-1">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${
                    activeTab === tab
                      ? "border-b-2 border-blue-600 text-blue-600 -mb-[1px]"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </nav>

          <div className="p-6 min-h-[400px]">
            {activeTab === "Overview" && (
              <OverviewTab
                form={form}
                activeVersion={activeVersion}
                submissionCount={submissionCount}
                pendingReviewCount={pendingReviewCount}
                lastSubmittedAt={lastSubmittedAt}
                setActiveTab={setActiveTab}
                navigate={navigate}
              />
            )}
            {activeTab === "Submissions" && <PlaceholderTab label="Submissions" />}
            {activeTab === "Duplicate Reviews" && <PlaceholderTab label="Duplicate Reviews" />}
            {activeTab === "Settings" && <FormSettingsTab form={form} onFormUpdated={setForm} />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormDetailPage;
