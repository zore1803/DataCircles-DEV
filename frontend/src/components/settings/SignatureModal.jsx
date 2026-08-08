import React, { useState, useRef, useEffect } from "react";
import SignatureCanvas from "react-signature-canvas";
import { X, Upload, Edit3, Type, Check, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

const FONT_FAMILIES = [
  { name: "Dancing Script", family: "'Dancing Script', cursive", url: "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600&display=swap" },
  { name: "Great Vibes", family: "'Great Vibes', cursive", url: "https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap" },
  { name: "Pacifico", family: "'Pacifico', cursive", url: "https://fonts.googleapis.com/css2?family=Pacifico&display=swap" },
  { name: "Sacramento", family: "'Sacramento', cursive", url: "https://fonts.googleapis.com/css2?family=Sacramento&display=swap" },
  { name: "Satisfy", family: "'Satisfy', cursive", url: "https://fonts.googleapis.com/css2?family=Satisfy&display=swap" },
];

export default function SignatureModal({ isOpen, onClose, onSave }) {
  const [activeTab, setActiveTab] = useState("upload"); // "upload" | "draw" | "type"
  const [sigName, setSigName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(false);

  // Upload state
  const [uploadedImage, setUploadedImage] = useState(null);

  // Draw state
  const sigCanvasRef = useRef(null);

  // Type state
  const [typedText, setTypedText] = useState("");
  const [selectedFont, setSelectedFont] = useState(FONT_FAMILIES[0]);

  // Dynamically load google fonts for signature previews
  useEffect(() => {
    FONT_FAMILIES.forEach((font) => {
      if (!document.querySelector(`link[href="${font.url}"]`)) {
        const link = document.createElement("link");
        link.href = font.url;
        link.rel = "stylesheet";
        document.head.appendChild(link);
      }
    });
  }, []);

  if (!isOpen) return null;

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (PNG, JPG, SVG)");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("File size should be less than 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleClearDraw = () => {
    if (sigCanvasRef.current) {
      sigCanvasRef.current.clear();
    }
  };

  // Convert typed text + chosen font to a Base64 PNG dataUrl via canvas
  const generateTypedDataUrl = () => {
    if (!typedText.trim()) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 180;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `60px ${selectedFont.family}`;
    ctx.fillStyle = "#1e293b";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(typedText, canvas.width / 2, canvas.height / 2);

    return canvas.toDataURL("image/png");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!sigName.trim()) {
      toast.error("Please enter a name/label for this signature");
      return;
    }

    let dataUrl = null;
    if (activeTab === "upload") {
      if (!uploadedImage) {
        toast.error("Please upload a signature image");
        return;
      }
      dataUrl = uploadedImage;
    } else if (activeTab === "draw") {
      if (!sigCanvasRef.current || sigCanvasRef.current.isEmpty()) {
        toast.error("Please draw a signature first");
        return;
      }
      dataUrl = sigCanvasRef.current.getTrimmedCanvas().toDataURL("image/png");
    } else if (activeTab === "type") {
      if (!typedText.trim()) {
        toast.error("Please enter text to generate signature");
        return;
      }
      dataUrl = generateTypedDataUrl();
    }

    if (!dataUrl) return;

    try {
      setLoading(true);
      await onSave({
        name: sigName.trim(),
        type: activeTab,
        dataUrl,
        isDefault,
      });
      onClose();
      // Reset form
      setSigName("");
      setUploadedImage(null);
      setTypedText("");
      setIsDefault(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl transition-all">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Add Digital Signature</h3>
            <p className="text-xs text-gray-500">Choose a method to add your authorized signature</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="mt-4 flex rounded-xl bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition ${
              activeTab === "upload" ? "bg-white text-sky-600 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Upload className="h-4 w-4" />
            Upload Image
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("draw")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition ${
              activeTab === "draw" ? "bg-white text-sky-600 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Edit3 className="h-4 w-4" />
            Draw Signature
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("type")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition ${
              activeTab === "type" ? "bg-white text-sky-600 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Type className="h-4 w-4" />
            Type Text
          </button>
        </div>

        {/* Tab Content */}
        <div className="mt-5 min-h-[220px]">
          {/* TAB 1: UPLOAD */}
          {activeTab === "upload" && (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 p-6 transition hover:border-sky-400">
              {uploadedImage ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="max-h-36 max-w-full overflow-hidden rounded-lg bg-gray-50 p-2 shadow-inner">
                    <img src={uploadedImage} alt="Uploaded signature" className="h-28 object-contain" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setUploadedImage(null)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:underline"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Change Image
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center text-center">
                  <div className="rounded-full bg-sky-50 p-3 text-sky-600">
                    <Upload className="h-6 w-6" />
                  </div>
                  <span className="mt-2 text-sm font-semibold text-gray-700">Click to upload signature</span>
                  <span className="mt-1 text-xs text-gray-400">PNG, JPG, or SVG (Max 2MB)</span>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              )}
            </div>
          )}

          {/* TAB 2: DRAW */}
          {activeTab === "draw" && (
            <div className="relative rounded-xl border border-gray-300 bg-slate-50 p-2">
              <SignatureCanvas
                ref={sigCanvasRef}
                canvasProps={{
                  className: "w-full h-40 rounded-lg bg-white cursor-crosshair shadow-inner",
                }}
                penColor="#0f172a"
              />
              <button
                type="button"
                onClick={handleClearDraw}
                className="absolute right-4 top-4 rounded-md bg-white/80 px-2.5 py-1 text-xs font-semibold text-gray-600 shadow-sm hover:bg-gray-100"
              >
                Clear Pad
              </button>
              <p className="mt-1 text-center text-xs text-gray-400">Draw your signature using mouse or touch</p>
            </div>
          )}

          {/* TAB 3: TYPE */}
          {activeTab === "type" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700">Enter Your Name or Initials</label>
                <input
                  type="text"
                  value={typedText}
                  onChange={(e) => setTypedText(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">Select Signature Style</label>
                <div className="mt-2 grid grid-cols-1 gap-2 max-h-36 overflow-y-auto pr-1">
                  {FONT_FAMILIES.map((font) => (
                    <button
                      key={font.name}
                      type="button"
                      onClick={() => setSelectedFont(font)}
                      className={`flex items-center justify-between rounded-xl border p-3 text-left transition ${
                        selectedFont.name === font.name
                          ? "border-sky-500 bg-sky-50/50 ring-1 ring-sky-500"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <span
                        style={{ fontFamily: font.family }}
                        className="text-2xl text-slate-800"
                      >
                        {typedText || font.name}
                      </span>
                      {selectedFont.name === font.name && (
                        <span className="rounded-full bg-sky-600 p-1 text-white">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Common Form Fields */}
        <form onSubmit={handleSubmit} className="mt-5 border-t border-gray-100 pt-4 space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-700">Signature Label / Owner Name *</label>
              <input
                type="text"
                value={sigName}
                onChange={(e) => setSigName(e.target.value)}
                placeholder="e.g. Authorized Signatory / CEO"
                className="mt-1 w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                required
              />
            </div>

            <div className="flex items-end pb-2">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                />
                Set as Default
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-sky-600 px-5 py-2 text-sm font-semibold text-white shadow-md hover:bg-sky-700 disabled:opacity-60"
            >
              {loading ? "Saving..." : "Save Signature"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
