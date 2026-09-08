import React, { useState, useRef, useEffect, useCallback } from "react";
import { X, RotateCw, Check, Crop as CropIcon } from "lucide-react";


// Dependency-free crop/rotate tool. Deliberately not a library: the app has no cropping dependency
// today, and this only needs drag-to-move / drag-corner-to-resize over a single <img>, which is a
// small amount of pointer math against the browser's own canvas API.
//
// `src` is ALWAYS a local blob: URL for a file the user just picked — never a remote one. Cropping
// reads pixels back out of a canvas (toBlob), which browsers block for a canvas "tainted" by a
// cross-origin image, so an already-uploaded CloudFront image cannot be cropped here. Rather than
// offer an action that fails, the Builder only opens this while choosing a file; re-cropping means
// re-picking the file. `onApply` hands back a File (not a URL) for the caller to upload.

const ASPECT_PRESETS = [
  { label: "Free", value: null },
  { label: "1:1", value: 1 },
  { label: "16:9", value: 16 / 9 },
  { label: "4:3", value: 4 / 3 },
  { label: "3:1", value: 3 },
];

const HANDLES = ["nw", "ne", "sw", "se"];
const MIN_CROP_PX = 24;

export default function ImageCropModal({ src, mimeType, onCancel, onApply }) {
  const imgRef = useRef(null);
  const [workingSrc, setWorkingSrc] = useState(src);
  const [rendered, setRendered] = useState(null); // displayed size of the <img>, in CSS px
  const [crop, setCrop] = useState(null); // {x,y,w,h} in displayed CSS px, relative to the image
  const [aspect, setAspect] = useState(null);
  const [drag, setDrag] = useState(null);
  const [error, setError] = useState(null);

  const outType = mimeType === "image/jpeg" ? "image/jpeg" : "image/png";

  // Fit `w x h` into the crop box while honoring the active aspect ratio, centered.
  const initialCrop = useCallback((w, h, ratio) => {
    if (!ratio) return { x: 0, y: 0, w, h };
    let cw = w;
    let ch = w / ratio;
    if (ch > h) {
      ch = h;
      cw = h * ratio;
    }
    return { x: (w - cw) / 2, y: (h - ch) / 2, w: cw, h: ch };
  }, []);

  const handleLoad = (e) => {
    const el = e.target;
    const w = el.clientWidth;
    const h = el.clientHeight;
    setRendered({ w, h });
    setCrop(initialCrop(w, h, aspect));
  };

  const applyAspect = (ratio) => {
    setAspect(ratio);
    if (rendered) setCrop(initialCrop(rendered.w, rendered.h, ratio));
  };

  useEffect(() => {
    if (!drag) return;

    const onMove = (ev) => {
      const { mode, startX, startY, startCrop } = drag;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const bounds = rendered;
      if (!bounds) return;

      setCrop(() => {
        if (mode === "move") {
          return {
            ...startCrop,
            x: Math.min(Math.max(0, startCrop.x + dx), bounds.w - startCrop.w),
            y: Math.min(Math.max(0, startCrop.y + dy), bounds.h - startCrop.h),
          };
        }

        // Resize from a corner: the opposite corner stays pinned.
        let { x, y, w, h } = startCrop;
        const right = startCrop.x + startCrop.w;
        const bottom = startCrop.y + startCrop.h;

        if (mode.includes("w")) {
          x = Math.min(Math.max(0, startCrop.x + dx), right - MIN_CROP_PX);
          w = right - x;
        }
        if (mode.includes("e")) {
          w = Math.min(Math.max(MIN_CROP_PX, startCrop.w + dx), bounds.w - startCrop.x);
        }
        if (mode.includes("n")) {
          y = Math.min(Math.max(0, startCrop.y + dy), bottom - MIN_CROP_PX);
          h = bottom - y;
        }
        if (mode.includes("s")) {
          h = Math.min(Math.max(MIN_CROP_PX, startCrop.h + dy), bounds.h - startCrop.y);
        }

        if (aspect) {
          // Height follows width, then clamp back if that pushed us outside the image.
          h = w / aspect;
          if (mode.includes("n")) y = bottom - h;
          if (y < 0) {
            y = 0;
            h = bottom;
            w = h * aspect;
            if (mode.includes("w")) x = right - w;
          }
          if (y + h > bounds.h) {
            h = bounds.h - y;
            w = h * aspect;
            if (mode.includes("w")) x = right - w;
          }
          if (x < 0) {
            x = 0;
            w = right;
            h = w / aspect;
          }
          if (x + w > bounds.w) {
            w = bounds.w - x;
            h = w / aspect;
          }
        }

        return { x, y, w, h };
      });
    };

    const onUp = () => setDrag(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, rendered, aspect]);

  const startDrag = (mode) => (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    setDrag({ mode, startX: ev.clientX, startY: ev.clientY, startCrop: crop });
  };

  const rotate = () => {
    const img = imgRef.current;
    if (!img) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalHeight;
      canvas.height = img.naturalWidth;
      const ctx = canvas.getContext("2d");
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      setWorkingSrc(canvas.toDataURL(outType));
      setRendered(null);
      setCrop(null);
    } catch {
      setError("Couldn't rotate this image.");
    }
  };

  const apply = () => {
    const img = imgRef.current;
    if (!img || !crop || !rendered) return;
    try {
      const scale = img.naturalWidth / rendered.w;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(crop.w * scale));
      canvas.height = Math.max(1, Math.round(crop.h * scale));
      const ctx = canvas.getContext("2d");
      ctx.drawImage(
        img,
        crop.x * scale, crop.y * scale, crop.w * scale, crop.h * scale,
        0, 0, canvas.width, canvas.height
      );
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setError("Couldn't process this image. Try a different file.");
            return;
          }
          onApply(new File([blob], `cropped.${outType === "image/jpeg" ? "jpg" : "png"}`, { type: outType }));
        },
        outType,
        0.92
      );
    } catch {
      setError("Couldn't process this image. Try a different file.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[10001] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <CropIcon className="w-4 h-4" /> Crop Image
          </h2>
          <button onClick={onCancel} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-gray-500 mr-1">Ratio</span>
          {ASPECT_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyAspect(p.value)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                aspect === p.value ? "bg-blue-50 border-blue-300 text-blue-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={rotate}
            title="Rotate 90°"
            className="ml-auto px-2.5 py-1 rounded-md text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1.5"
          >
            <RotateCw className="w-3.5 h-3.5" /> Rotate
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5 bg-gray-50 flex items-center justify-center">
          <div className="relative inline-block select-none">
            <img
              ref={imgRef}
              src={workingSrc}
              alt=""
              onLoad={handleLoad}
              onError={() => setError("Couldn't load this image. Try a different file.")}
              draggable={false}
              className="max-w-full max-h-[50vh] block"
            />
            {crop && rendered && (
              <>
                {/* Dim outside the crop as four rects rather than one clipped box-shadow: a shadow
                    would either bleed past the image or, once clipped, need to clip the resize
                    handles too. pointer-events-none so drags still reach the crop rect below. */}
                <div className="absolute pointer-events-none bg-black/45" style={{ left: 0, top: 0, width: rendered.w, height: crop.y }} />
                <div className="absolute pointer-events-none bg-black/45" style={{ left: 0, top: crop.y + crop.h, width: rendered.w, height: rendered.h - crop.y - crop.h }} />
                <div className="absolute pointer-events-none bg-black/45" style={{ left: 0, top: crop.y, width: crop.x, height: crop.h }} />
                <div className="absolute pointer-events-none bg-black/45" style={{ left: crop.x + crop.w, top: crop.y, width: rendered.w - crop.x - crop.w, height: crop.h }} />
                <div
                  onPointerDown={startDrag("move")}
                  className="absolute border-2 border-white cursor-move"
                  style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h }}
                >
                  {HANDLES.map((h) => (
                    <div
                      key={h}
                      onPointerDown={startDrag(h)}
                      className="absolute w-3 h-3 bg-white border border-gray-400 rounded-sm"
                      style={{
                        left: h.includes("w") ? -6 : undefined,
                        right: h.includes("e") ? -6 : undefined,
                        top: h.includes("n") ? -6 : undefined,
                        bottom: h.includes("s") ? -6 : undefined,
                        cursor: `${h}-resize`,
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {error && <p className="px-5 py-2 text-xs text-red-500 border-t border-gray-100">{error}</p>}

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">
            Cancel
          </button>
          <button
            onClick={apply}
            disabled={!crop}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" /> Apply Crop
          </button>
        </div>
      </div>
    </div>
  );
}
