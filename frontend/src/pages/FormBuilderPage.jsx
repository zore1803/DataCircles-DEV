// pages/FormBuilderPage.jsx
// Form Builder — dedicated full-width route, /forms/:id/builder, sibling to the tabbed
// FormDetailPage rather than a tab within it (explicit decision, post-dating
// FORMS_FRONTEND_ARCHITECTURE.md's original tab list — see that doc's §1.2 amendment).
// This is a routing-only shell for now: header, back link, loading/not-found handling. The real
// Builder UI (FieldsPanel/Canvas/PropertiesPanel) is separate, larger work, not designed here yet —
// matches the same "don't invent ahead of need" discipline the placeholder tabs used.
import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import API from "../services/api";
import toast from "react-hot-toast";
import { ArrowLeft } from "lucide-react";

const FormBuilderPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadForm = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get(`/forms/${id}`);
      setForm(res.data.form);
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
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
        <Link
          to={`/forms/${id}`}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 text-sm font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {form.title}
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-semibold text-gray-900">Builder</span>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500 font-medium">Builder — coming soon</p>
      </div>
    </div>
  );
};

export default FormBuilderPage;
