// components/settings/FormsList.jsx
// Forms List — Build order step 1, per FORMS_FRONTEND_ARCHITECTURE.md §2. Renders inside the
// Settings shell at /settings/forms (settingsItems entry in Settings.jsx). Table via TanStack,
// copying Companies.jsx's useReactTable usage exactly (§2.1); empty/loading states copy
// Companies.jsx's ternary exactly (§2.4); permission check copies Contacts.jsx's exact per-page
// pattern (§2.6). No shared Table/Modal/Badge component introduced — see the architecture doc's
// "copy, don't extract" decision.
import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import API from "../../services/api";
import toast from "react-hot-toast";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import { Plus, X, ChevronLeft, ChevronRight, FileText, User, Building2, Truck, Trash2, Lock, WifiOff, AlertTriangle, ShieldOff } from "lucide-react";

const columnHelper = createColumnHelper();

// Copies DealQuickView.jsx / DealDetail.jsx's StatusBadge shape exactly (architecture doc §6) — a
// third independent copy of this pattern, deliberately not extracted into a shared component (see
// FORMS_IMPLEMENTATION.md's flagged-debt note). Dot + label, so status reads at a glance across a
// long list rather than as another line of plain text.
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

const MODULE_ICONS = { Contact: User, Company: Building2, Vendor: Truck };
const ModuleTag = ({ module }) => {
  const Icon = MODULE_ICONS[module] || FileText;
  return (
    <span className="inline-flex items-center gap-1.5 text-gray-700">
      <Icon className="w-3.5 h-3.5 text-gray-400" />
      {module}
    </span>
  );
};

// Small inline relative-time helper — no shared date util exists in this codebase (confirmed in
// the frontend audit), so this stays local rather than becoming a new shared abstraction.
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

const MODULE_OPTIONS = ["Contact", "Company", "Vendor"];

function CreateFormModal({ onClose, onCreated }) {
  const [title, setTitle] = useState("");
  const [module, setModule] = useState("Contact");
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await API.post("/forms", { title: title.trim(), module });
      toast.success("Form created");
      onCreated(res.data.form);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create form");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[10000] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <FileText className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">New Form</h2>
              <p className="text-xs text-gray-500">Set a title and module to get started</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Contact Us"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Module</label>
            <select
              value={module}
              onChange={(e) => setModule(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {MODULE_OPTIONS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            {/* Permanent-choice note per FORMS_FRONTEND_ARCHITECTURE.md §2.7 — module is immutable
                after creation (routing/schemaHash key off it), so this must be stated up front. */}
            <p className="text-xs text-gray-500 mt-1">Module can't be changed after creating this form.</p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
          >
            {submitting ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

const FormsList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  // Classified failure state — a bare "Access denied" string can't distinguish "you're out of
  // plan" from "you lack permission" from "server is down", and each of those needs a different
  // UI (upgrade card vs. contact-admin vs. retry). `type` drives which card renders; `message`/
  // `planName` carry the backend's actual text so we're not inventing copy it didn't send.
  const [error, setError] = useState(null); // { type: "module"|"permission"|"network"|"server", message, planName? } | null
  const [permission, setPermission] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null); // form object or null
  const [deleting, setDeleting] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState(searchParams.get("module") || "");
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 0,
    totalCount: 0,
    limit: 20,
    hasNextPage: false,
    hasPrevPage: false,
  });

  // Permission gating — copies Contacts.jsx's exact per-page pattern (architecture doc §2.6).
  useEffect(() => {
    const fetchPermission = async () => {
      try {
        const res = await API.get("/auth/me");
        const p = res.data.user?.permissions?.find((p) => p.name.toLowerCase() === "forms");
        setPermission(p?.permission || "no");
      } catch {
        console.error("Failed to fetch user permissions");
      }
    };
    fetchPermission();
  }, []);

  const fetchForms = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const params = { page, limit: pagination.limit };
      if (search.trim()) params.search = search.trim();
      if (moduleFilter) params.module = moduleFilter;

      const res = await API.get("/forms", { params });
      setForms(res.data.forms || []);
      setPagination((prev) => ({ ...prev, ...res.data.pagination }));
    } catch (err) {
      console.error("Error fetching forms:", err);
      // Distinct error state — a permission/network failure must never look identical to a
      // genuinely empty list, and the four failure modes below each need a different UI (only
      // "network"/"server" make Retry meaningful — retrying a plan/permission block just repeats
      // the same 403 forever).
      const status = err.response?.status;
      const code = err.response?.data?.code;
      let classified;
      if (!err.response) {
        classified = { type: "network", message: "Couldn't connect to the server." };
      } else if (status === 403 && code === "MODULE_NOT_AVAILABLE") {
        classified = { type: "module", message: err.response.data?.error, planName: err.response.data?.planName };
      } else if (status === 403) {
        classified = { type: "permission", message: err.response.data?.error || "You don't have permission to access Forms." };
      } else if (status >= 500) {
        classified = { type: "server", message: "Our server encountered an error." };
      } else {
        classified = { type: "server", message: err.response.data?.error || "Failed to load forms." };
      }
      setError(classified);
      toast.error(classified.message);
    } finally {
      setLoading(false);
    }
  }, [search, moduleFilter, pagination.limit]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await API.delete(`/forms/${deleteTarget._id}`);
      toast.success("Form deleted");
      setDeleteTarget(null);
      fetchForms(pagination.currentPage);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete form");
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    fetchForms(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, moduleFilter]);

  const handlePageChange = (page) => {
    if (page < 1 || page > pagination.totalPages) return;
    fetchForms(page);
  };

  const columns = [
    columnHelper.accessor("title", {
      header: "Title",
      // No inner click handler — the whole row is clickable (see tbody render below), matching
      // Companies.jsx-style rows being the primary way in, not a separate link inside a cell.
      cell: (info) => (
        <div className="flex flex-col">
          <span className="font-semibold text-gray-900">{info.getValue()}</span>
          {info.row.original.versionNumber != null && (
            <span className="text-xs text-gray-400">Version {info.row.original.versionNumber}</span>
          )}
        </div>
      ),
    }),
    columnHelper.accessor("module", {
      header: "Module",
      // Icon + label, not the Badge pattern — Module is a fixed, non-transitioning classification,
      // unlike Status below (architecture doc §2.2).
      cell: (info) => <ModuleTag module={info.getValue()} />,
    }),
    columnHelper.accessor("status", {
      header: "Status",
      cell: (info) => <FormStatusBadge status={info.getValue()} />,
    }),
    columnHelper.accessor("submissionCount", {
      header: "Submissions",
      cell: (info) => <span className="text-gray-700 font-medium">{info.getValue() ?? 0}</span>,
    }),
    columnHelper.accessor("updatedAt", {
      header: "Updated",
      cell: (info) => <span className="text-gray-500 text-sm">{timeAgo(info.getValue())}</span>,
    }),
    columnHelper.display({
      id: "actions",
      header: "",
      cell: (info) => (
        <div className="flex items-center gap-2 justify-end">
          {(info.row.original.status === "draft" || info.row.original.status === "archived") && (
            <button
              onClick={(e) => { e.stopPropagation(); setDeleteTarget(info.row.original); }}
              className="p-1.5 text-gray-300 hover:text-red-500 rounded"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </div>
      ),
    }),
  ];

  const table = useReactTable({
    data: forms,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search forms..."
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Modules</option>
          {MODULE_OPTIONS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <div className="flex-1" />
        {error?.type === "module" ? (
          <button
            disabled
            title={error.message}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-400 text-sm font-medium rounded-lg cursor-not-allowed"
          >
            <Lock className="w-4 h-4" />
            New Form
          </button>
        ) : permission !== "readonly" ? (
          // Matches Companies.jsx's "New Company" primary CTA exactly (#0C4FCD brand blue,
          // px-4 py-2.5) — this is the reason people come to this page, so it should carry the
          // same visual weight as the equivalent action on every other CRM module.
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0C4FCD] text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none cursor-pointer shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Form
          </button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="min-w-full border-collapse">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {loading && forms.length === 0 ? (
              <tr>
                <td colSpan={table.getAllColumns().length} className="px-6 py-12 text-center">
                  <p>Loading forms...</p>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={table.getAllColumns().length} className="px-6 py-12 text-center">
                  {error.type === "module" ? (
                    <div className="flex flex-col items-center gap-2 max-w-md mx-auto">
                      <Lock className="w-8 h-8 text-gray-300" />
                      <p className="font-semibold text-gray-900">Forms isn't included in your current plan</p>
                      <p className="text-sm text-gray-500">
                        Create lead capture forms, embed them on your website, and automatically send submissions to your CRM.
                      </p>
                      {error.planName && <p className="text-xs text-gray-400">Current plan: {error.planName}</p>}
                      <button
                        onClick={() => navigate("/subscription")}
                        className="mt-1 px-4 py-2 bg-[#0C4FCD] text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                      >
                        Upgrade Plan
                      </button>
                    </div>
                  ) : error.type === "permission" ? (
                    <div className="flex flex-col items-center gap-2">
                      <ShieldOff className="w-8 h-8 text-gray-300" />
                      <p className="font-semibold text-gray-900">You don't have permission to access Forms</p>
                      <p className="text-sm text-gray-500">Contact your administrator.</p>
                    </div>
                  ) : error.type === "network" ? (
                    <div className="flex flex-col items-center gap-2">
                      <WifiOff className="w-8 h-8 text-gray-300" />
                      <p className="font-semibold text-gray-900">Couldn't connect to the server</p>
                      <button
                        onClick={() => fetchForms(pagination.currentPage)}
                        className="mt-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <AlertTriangle className="w-8 h-8 text-gray-300" />
                      <p className="font-semibold text-gray-900">Something went wrong</p>
                      <p className="text-sm text-gray-500">{error.message}</p>
                      <button
                        onClick={() => fetchForms(pagination.currentPage)}
                        className="mt-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ) : forms.length === 0 ? (
              <tr>
                <td colSpan={table.getAllColumns().length} className="px-6 py-12 text-center text-gray-500">
                  <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="font-semibold text-gray-900">Website Forms</p>
                  <p className="text-sm text-gray-500 max-w-sm mx-auto mt-1">
                    Capture leads directly into your CRM. Forms let visitors submit enquiries, requests, and
                    registrations that automatically create CRM records.
                  </p>
                  {permission !== "readonly" && (
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="mt-3 px-4 py-2 bg-[#0C4FCD] text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                    >
                      Create your first form
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => navigate(`/forms/${row.original._id}`)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-500">
            Page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalCount} total)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(pagination.currentPage - 1)}
              disabled={!pagination.hasPrevPage}
              className="p-2 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => handlePageChange(pagination.currentPage + 1)}
              disabled={!pagination.hasNextPage}
              className="p-2 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {showCreateModal && (
        <CreateFormModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(form) => {
            setShowCreateModal(false);
            navigate(`/forms/${form._id}`);
          }}
        />
      )}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[10000] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Delete "{deleteTarget.title}"?</h2>
            <p className="text-sm text-gray-500 mb-4">This can't be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50">
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FormsList;
