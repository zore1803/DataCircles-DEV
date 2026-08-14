import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Play, Video, Film, Info } from "lucide-react";
import { MODULE_VIDEOS } from "../../config/moduleVideos";

export default function ModuleVideoModal({ isOpen, onClose, moduleKey = "deals" }) {
  const videoInfo = MODULE_VIDEOS[moduleKey] || {
    title: "Module Overview Guide",
    description: "Learn how to effectively use and navigate this module.",
    videoUrl: "",
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10005] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col animate-scaleUp z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 font-sf">
                {videoInfo.title}
              </h3>
              <p className="text-xs text-gray-500 font-inter">
                Module Tutorial & Walkthrough
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Close video guide"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Area */}
        <div className="relative w-full bg-slate-900 aspect-video flex items-center justify-center overflow-hidden">
          {videoInfo.videoUrl ? (
            <iframe
              src={videoInfo.videoUrl}
              title={videoInfo.title}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-center px-6 py-12 text-slate-300">
              <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center text-blue-400 mb-4 shadow-inner">
                <Play className="w-8 h-8 fill-blue-400 ml-1" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">
                Video Guide Coming Soon
              </h4>
              <p className="text-xs text-slate-400 max-w-md mb-4 leading-relaxed">
                {videoInfo.description}
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-[11px] text-slate-300">
                <Film className="w-3.5 h-3.5 text-blue-400" />
                <span>Connect your tutorial video URL in <code className="text-blue-300">moduleVideos.js</code></span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <span className="truncate">{videoInfo.description}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-semibold rounded-lg transition-colors flex-shrink-0"
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
