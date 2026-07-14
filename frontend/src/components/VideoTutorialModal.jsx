import React, { useEffect, useRef } from "react";
import { X, PlayCircle } from "lucide-react";

const VideoTutorialModal = ({ isOpen, onClose, videoId, title }) => {
  const originalOverflowRef = useRef(null);

  // Close modal when clicking backdrop
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // ✅ MOVE useEffect BEFORE the early return
  // Handle scroll locking and keyboard events
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      // Store the original overflow value
      originalOverflowRef.current = window.getComputedStyle(document.body).overflow;
      
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", handleEscape);
    }

    // Cleanup function
    return () => {
      // Restore original overflow value
      document.body.style.overflow = originalOverflowRef.current || "";
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  // ✅ NOW check if modal should render
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-fadeIn"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <PlayCircle className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-white font-sf">
              {title || "Video Tutorial"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/90 hover:text-white hover:bg-white/20 p-2 rounded-lg transition-all"
            aria-label="Close video tutorial"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Container */}
        <div className="relative bg-black" style={{ paddingTop: "56.25%" }}>
          <iframe
            className="absolute top-0 left-0 w-full h-full"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
            title={title || "Tutorial Video"}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
      </div>
    </div>
  );
};

export default VideoTutorialModal;
