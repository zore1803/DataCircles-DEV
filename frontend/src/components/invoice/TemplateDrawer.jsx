import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Check, LayoutTemplate } from "lucide-react";
import toast from "react-hot-toast";
import API from "../../services/api";
import { DIM_CHROME_EVENT } from "../../hooks/useSearchOverlayOpen";
import {
  DOCUMENT_TEMPLATES,
  DEFAULT_TEMPLATE,
  buildDocumentHtml,
} from "../../../../shared/documentTemplates.js";

/*
 * Right-hand drawer for picking the template a document type is rendered with.
 * Each option shows a real, scaled-down render of the template built from the
 * same shared module the preview and the PDF use, so the thumbnail can't
 * misrepresent what you'll actually get.
 */

const TEMPLATE_BLURBS = {
  Classic: "Formal, fully ruled GST layout",
  Modern: "Colour header band with striped rows",
  Minimal: "Hairline rules and generous spacing",
  Elegant: "Serif type with a centred masthead",
  Compact: "Dense layout that fits long item lists",
  Corporate: "Dark masthead with navy table headings",
  Vibrant: "Emerald accents and rounded sections",
  Mono: "Typewriter face, pure black and white",
};

/* Small representative document so every thumbnail shows the same content. */
const SAMPLE_DOC = {
  invoiceNumber: "INV-024",
  date: new Date(),
  dueDate: new Date(Date.now() + 30 * 86400000),
  receiverGSTIN: "29AAACI5950L1Z6",
  placeOfSupply: "29-KARNATAKA",
  isTaxInvoice: true,
  isTaxQuotation: true,
  gstRate: 18,
  discount: { type: "percentage", value: 10 },
  items: [
    { name: "Consulting Retainer", rate: 25000, quantity: 1, hsn: "9983" },
    { name: "Implementation", rate: 8000, quantity: 2, hsn: "9983" },
  ],
};

const THUMB_W = 760; // the design width the templates are authored against
const PAGE_RATIO = 1.414; // A4 — keeps each thumbnail page-shaped

const TemplatePreviewCard = ({
  template,
  selected,
  onSelect,
  orgDetails,
  bankDetails,
  type,
}) => {
  // The sheet is authored at THUMB_W; scale it down to whatever width the card
  // gets so the thumbnail always fills its page, whatever the grid does.
  const frameRef = useRef(null);
  const [frameW, setFrameW] = useState(0);
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => setFrameW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = frameW ? frameW / THUMB_W : 0;

  const html = buildDocumentHtml(SAMPLE_DOC, {
    type,
    template,
    orgDetails,
    bankDetails,
    dealName: "Sample Customer",
  });

  return (
    <button
      type="button"
      onClick={() => onSelect(template)}
      className={`group w-full text-left rounded-xl border-2 transition-colors overflow-hidden ${
        selected
          ? "border-[#0085FF] bg-[#F5FAFF]"
          : "border-[#E1E4EA] hover:border-[#C9CFD8] bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-2 px-3 pt-2.5 pb-2">
        <div className="min-w-0">
          <span className="text-sm font-semibold text-[#1F2937] truncate block">
            {template}
          </span>
          <p className="text-[11px] text-[#99A0AE] truncate">
            {TEMPLATE_BLURBS[template]}
          </p>
        </div>
        {selected && (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-[#0085FF] bg-[#E3F1FF] px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5">
            <Check className="w-3 h-3" />
            In use
          </span>
        )}
      </div>

      {/* The whole document as one page-shaped sheet, scaled to the card's
          width. Pointer events are off so the card stays one click target. */}
      <div className="px-3 pb-3">
        <div
          ref={frameRef}
          style={{ height: (frameW || 0) * PAGE_RATIO }}
          className="bg-white border border-[#E1E4EA] shadow-sm overflow-hidden pointer-events-none select-none"
        >
          <div
            style={{
              width: THUMB_W,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </button>
  );
};

const TemplateDrawer = ({ isOpen, onClose, type = "tax", docLabel = "Invoice" }) => {
  const [templates, setTemplates] = useState(null);
  const [orgDetails, setOrgDetails] = useState(null);
  const [bankDetails, setBankDetails] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const [settings, branding, bank] = await Promise.allSettled([
        API.get("/document-templates"),
        API.get("/branding"),
        API.get("/bank-details"),
      ]);
      if (cancelled) return;

      if (settings.status === "fulfilled") {
        setTemplates(settings.value.data?.templates || {});
      } else {
        toast.error("Couldn't load your template choice");
        setTemplates({});
      }
      if (branding.status === "fulfilled") setOrgDetails(branding.value.data);
      if (bank.status === "fulfilled") setBankDetails(bank.value.data);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Close on Escape, like the other overlays on this page.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Dims the sidebar/navbar/page-footer chrome while this panel is open --
  // see useSearchOverlayOpen.js.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(DIM_CHROME_EVENT, { detail: { open: isOpen } }));
    return () => window.dispatchEvent(new CustomEvent(DIM_CHROME_EVENT, { detail: { open: false } }));
  }, [isOpen]);

  const selected = templates?.[type] || DEFAULT_TEMPLATE;

  const handleSelect = async (template) => {
    if (template === selected || saving) return;
    const previous = templates;
    // Optimistic: the choice is a single field, so show it immediately and
    // roll back if the save fails.
    setTemplates((prev) => ({ ...prev, [type]: template }));
    setSaving(true);
    try {
      const res = await API.put("/document-templates", {
        templates: { [type]: template },
      });
      setTemplates(res.data?.templates || { [type]: template });
      toast.success(`${template} applied to ${docLabel.toLowerCase()}s`);
    } catch (err) {
      setTemplates(previous);
      toast.error(
        err.response?.data?.error || "Failed to save your template choice"
      );
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100004]">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Same inset rounded-card geometry as the Companies/Contacts panels
          (dc-panel-card), but wider than their dc-panel-w third — the cards
          here are full document renders and need the room. */}
      <aside
        role="dialog"
        aria-label="Template"
        className="fixed dc-panel-card w-full lg:w-[70vw] bg-white shadow-2xl flex flex-col overflow-hidden animate-slideInRight"
      >
        <header className="flex-shrink-0 flex items-center justify-between gap-3 px-5 py-4 border-b border-[#E1E4EA]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#F0F6FF] flex items-center justify-center flex-shrink-0">
              <LayoutTemplate className="w-4.5 h-4.5 text-[#0085FF]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-[#1F2937] truncate">
                Template
              </h2>
              <p className="text-xs text-[#99A0AE] truncate">
                Choose how your {docLabel.toLowerCase()}s look
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Gallery grid: one card per row on a phone, two once the panel is a
            real panel, three on a wide screen. */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 content-start">
          {loading || !templates
            ? DOCUMENT_TEMPLATES.map((t) => (
                <div
                  key={t}
                  className="aspect-[1/1.55] rounded-xl bg-gray-100 animate-pulse"
                />
              ))
            : DOCUMENT_TEMPLATES.map((t) => (
                <TemplatePreviewCard
                  key={t}
                  template={t}
                  type={type}
                  selected={selected === t}
                  onSelect={handleSelect}
                  orgDetails={orgDetails}
                  bankDetails={bankDetails}
                />
              ))}
        </div>

        <footer className="flex-shrink-0 px-5 py-3 border-t border-[#E1E4EA] bg-[#FAFBFC]">
          <p className="text-[11px] text-[#99A0AE]">
            Applies to every {docLabel.toLowerCase()} — existing and new alike —
            across preview, download and email.
          </p>
        </footer>
      </aside>
    </div>,
    document.body
  );
};

export default TemplateDrawer;
