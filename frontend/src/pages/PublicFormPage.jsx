import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import FormElementRenderer from "../components/forms/FormElementRenderer";
import { resolveTheme, themeCssVars, FORM_GRID_CLASS, columnSpanClass } from "../components/forms/formThemes";

// Deliberately NOT using the authenticated API instance — no auth token, no interceptor.
const PUBLIC_API_BASE = import.meta.env.VITE_APP_API_URL || "";

/**
 * Split a form's sections into pages of renderable items.
 * A page is a run of consecutive sections; `startsNewPage` marks where the next one begins. Each
 * section's title/description are re-emitted as a synthetic header item so they render alongside
 * the elements — they live on the section, not inside `elements`.
 */
function buildPages(layout) {
  const pages = [];
  let current = [];
  (layout || []).forEach((sec, i) => {
    if (sec.startsNewPage && current.length > 0) {
      pages.push(current);
      current = [];
    }
    if (sec.title || sec.description) {
      current.push({ id: `__sec-${i}`, type: "sectionBreak", title: sec.title, description: sec.description });
    }
    (sec.elements || []).forEach((e) => current.push(e));
  });
  if (current.length > 0) pages.push(current);
  return pages.length > 0 ? pages : [[]];
}

export default function PublicFormPage() {
  const { slug } = useParams();
  const [formData, setFormData] = useState(null);
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    axios.get(`${PUBLIC_API_BASE}/api/public/forms/${slug}`)
      .then((res) => setFormData(res.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  // Resolved (preset + overrides) tokens — the renderer reads plain token names, so it must not be
  // handed the raw theme document, which only carries explicit overrides.
  const resolvedTheme = resolveTheme(formData?.theme);
  const fieldMetaById = new Map((formData?.resolvedFields || []).map((f) => [f.fieldId, f]));
  // Pages are runs of consecutive sections; a section flagged startsNewPage begins the next one.
  // A section's title/description live on the SECTION, not among its elements, so they are turned
  // back into render items here — flattening `section.elements` alone dropped them entirely.
  const pages = buildPages(formData?.layout);
  const isMultiPage = pages.length > 1;
  const elements = pages[pageIndex] || [];
  const isLastPage = pageIndex >= pages.length - 1;

  const uploadFile = async (file) => {
    const body = new FormData();
    body.append("file", file);
    const res = await axios.post(`${PUBLIC_API_BASE}/api/public/forms/${slug}/upload`, body, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data.url;
  };

  // Client-side check before advancing a page. Purely UX — the server re-validates everything on
  // submit and remains the authority; this just avoids marching someone to page 4 before telling
  // them page 1 was incomplete.
  const missingOnPage = () => {
    const errs = {};
    elements.forEach((el) => {
      if (el.type !== "field") return;
      const meta = fieldMetaById.get(el.fieldId);
      const required = el.required || meta?.baseRequired;
      const v = values[el.fieldId];
      const blank = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
      if (required && blank) errs[el.fieldId] = `${meta?.label || "This field"} is required`;
    });
    return errs;
  };

  const goNext = () => {
    const errs = missingOnPage();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setPageIndex((i) => Math.min(i + 1, pages.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    setErrors({});
    setPageIndex((i) => Math.max(i - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // On a multi-page form the primary button advances rather than submits until the last page.
    if (!isLastPage) return goNext();
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
        // A server-side rejection may name a field the visitor can no longer see. Jump to the page
        // holding the first offending field, otherwise the form just refuses to submit with the
        // explanation hidden on another page.
        const firstBad = err.response.data.validationErrors?.[0]?.fieldId;
        if (firstBad) {
          const p = pages.findIndex((items) => items.some((el) => el.fieldId === firstBad));
          if (p >= 0 && p !== pageIndex) setPageIndex(p);
        }
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
    <div
      className="min-h-screen flex items-start justify-center py-12 px-4"
      style={{ background: resolveTheme(formData.theme).backgroundColor }}
    >
      <form
        onSubmit={handleSubmit}
        className="form-theme-scope w-full"
        style={{ ...themeCssVars(formData.theme), maxWidth: "var(--form-max-width)" }}
      >
        <h1 className="form-heading text-xl font-bold mb-1">{formData.title}</h1>

        {isMultiPage && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs form-help mb-1.5">
              <span>Step {pageIndex + 1} of {pages.length}</span>
              <span>{Math.round(((pageIndex + 1) / pages.length) * 100)}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--form-border)" }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${((pageIndex + 1) / pages.length) * 100}%`, background: "var(--form-primary)" }}
              />
            </div>
          </div>
        )}

        {/* Two-column grid; each element claims one or both columns via layoutWidth. On narrow
            screens the grid collapses to a single column (see .form-theme-scope media query). */}
        <div className={FORM_GRID_CLASS}>
        {elements.map((el, i) => (
          // The Submit button belongs to the final page only. On earlier pages the Continue control
          // below stands in for it, so a mid-form Submit can't short-circuit the remaining pages.
          el.type === "submitButton" && !isLastPage ? null : (
          <div
            key={el.id}
            // Section headers get a rule and space above them (except the very first), which is
            // what visually separates one group of fields from the next.
            className={`${columnSpanClass(el)} ${
              el.type === "sectionBreak" && i > 0 ? "mt-5 pt-4 border-t" : ""
            }`}
            style={el.type === "sectionBreak" && i > 0 ? { borderColor: "var(--form-border)" } : undefined}
          >
            <FormElementRenderer
              element={el}
              fieldMeta={el.fieldId ? fieldMetaById.get(el.fieldId) : undefined}
              value={values[el.fieldId]}
              onChange={(v) => setValues((prev) => ({ ...prev, [el.fieldId]: v }))}
              onUploadFile={uploadFile}
              theme={resolvedTheme}
              interactive
            />
            {errors[el.fieldId] && <p className="text-xs text-red-500 mt-1">{errors[el.fieldId]}</p>}
          </div>
          )
        ))}
        </div>

        {isMultiPage && (
          <div className="mt-5 flex items-center gap-3">
            {pageIndex > 0 && (
              <button
                type="button"
                onClick={goBack}
                className="px-4 py-2 text-sm font-medium rounded-lg border"
                style={{ borderColor: "var(--form-border)", color: "var(--form-text)" }}
              >
                ← Back
              </button>
            )}
            {!isLastPage && (
              // type="button": on a multi-page form Enter must not submit a half-finished form
              // from page 1. The final page keeps the real submit button from the layout.
              <button
                type="button"
                onClick={goNext}
                className="form-button text-sm ml-auto"
              >
                Continue →
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
