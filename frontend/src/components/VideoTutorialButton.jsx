import React, { useState } from "react";
import { PlayCircle, HelpCircle } from "lucide-react";

const VideoTutorialButton = ({ onClick, variant = "default" }) => {
  const [isHovered, setIsHovered] = useState(false);

  if (variant === "minimal") {
    return (
      <button
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="relative group flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg font-medium font-sf text-sm hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 transition-all shadow-sm cursor-pointer w-20 h-10"
        aria-label="Watch tutorial video"
      >
        <PlayCircle className="w-4 h-4" />
        {/* <span className="hidden sm:inline">Tutorial</span> */}

        {/* Tooltip */}
        {isHovered && (
          <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-sm whitespace-nowrap shadow-lg animate-fadeIn z-[100002]">
            Watch how to use this module
            <div className="absolute top-full right-4 -mt-1 border-4 border-transparent border-t-gray-900"></div>
          </div>
        )}
      </button>
    );
  }

  if (variant === "icon") {
    return (
      <button
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="relative group flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-full hover:from-blue-600 hover:to-blue-700 transition-all shadow-md hover:shadow-lg hover:scale-105"
        aria-label="Watch tutorial video"
      >
        <PlayCircle className="w-5 h-5" />

        {/* Tooltip */}
        {isHovered && (
          <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap shadow-lg animate-fadeIn">
            Watch Tutorial
            <div className="absolute top-full right-3 -mt-1 border-4 border-transparent border-t-gray-900"></div>
          </div>
        )}
      </button>
    );
  }

  // Default variant with question mark
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative group flex items-center justify-center w-10 h-10 bg-white border-2 border-blue-500 text-blue-600 rounded-full hover:bg-blue-50 transition-all shadow-sm hover:shadow-md"
      aria-label="Watch tutorial video"
    >
      <HelpCircle className="w-5 h-5" />
      <PlayCircle className="w-3 h-3 absolute -bottom-0.5 -right-0.5 bg-white rounded-full" />

      {/* Tooltip */}
      {isHovered && (
        <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap shadow-lg animate-fadeIn">
          Watch Tutorial
          <div className="absolute top-full right-3 -mt-1 border-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </button>
  );
};

export default VideoTutorialButton;
