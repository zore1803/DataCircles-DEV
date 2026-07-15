import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import FormElementRenderer from "../components/forms/FormElementRenderer";

// Deliberately NOT using the authenticated API instance — no auth token, no interceptor.
const PUBLIC_API_BASE = import.meta.env.VITE_APP_API_URL || "";

export default function PublicFormPage() {
  const { slug } = useParams();
  const [formData, setFormData] = useState(null);
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    axios.get(`${PUBLIC_API_BASE}/api/public/forms/${slug}`)
      .then((res) => setFormData(res.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  const fieldMetaById = new Map((formData?.resolvedFields || []).map((f) => [f.fieldId, f]));
  // Flatten across all sections, not just the first — a multi-section form must render fully here.
  const elements = (formData?.layout || []).flatMap((section) => section.elements || []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});
    try {
      await axios.post(`${PUBLIC_API_BASE}/api/public/forms/${slug}/submit`, { data: values });
      setSubmitted(true);
    } catch (err) {
      if (err.response?.status === 422) {
        const errMap = {};
        (err.response.data.validationErrors || []).forEach((v) => { errMap[v.fieldId] = v.message; });
        setErrors(errMap);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;
  if (notFound) return <div className="min-h-screen flex items-center justify-center text-gray-500">This form isn't available.</div>;
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-lg text-gray-700">Thank you for your submission.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center py-12 px-4" style={{ fontFamily: formData.theme?.fontFamily || undefined }}>
      <form onSubmit={handleSubmit} className="max-w-xl w-full bg-white rounded-xl border border-gray-200 shadow-sm p-8 flex flex-col gap-4">
        <h1 className="text-xl font-bold text-gray-900 mb-2">{formData.title}</h1>
        {elements.map((el) => (
          <div key={el.id}>
            <FormElementRenderer
              element={el}
              fieldMeta={el.fieldId ? fieldMetaById.get(el.fieldId) : undefined}
              value={values[el.fieldId]}
              onChange={(v) => setValues((prev) => ({ ...prev, [el.fieldId]: v }))}
              interactive
            />
            {errors[el.fieldId] && <p className="text-xs text-red-500 mt-1">{errors[el.fieldId]}</p>}
          </div>
        ))}
      </form>
    </div>
  );
}
