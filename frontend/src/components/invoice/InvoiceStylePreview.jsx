import React, { useState } from 'react';
import { FileText } from 'lucide-react';

const InvoiceStylePreview = ({ style: initialStyle, isOpen, onClose }) => {
  if (!isOpen) return null;

  const [selectedStyle, setSelectedStyle] = useState(initialStyle || 'Classic');
  const styleImages = {
    Classic: '/classic.jpg',
    Modern: '/modern.jpg',
    Elegant: '/elegant.jpg',
    Minimal: '/minimal.jpg',
  };

  return (
    <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl p-6 w-full max-w-5xl shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            {selectedStyle} Invoice Preview
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-4">
          <select
            value={selectedStyle}
            onChange={(e) => setSelectedStyle(e.target.value)}
            className="w-full max-w-xs border-2 border-slate-200 rounded-xl p-3 bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
          >
            {Object.keys(styleImages).map((style) => (
              <option key={style} value={style}>
                {style}
              </option>
            ))}
          </select>
          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
            <img
              src={styleImages[selectedStyle]}
              alt={`${selectedStyle} Invoice Preview`}
              className="w-full h-auto max-w-full rounded-lg"
              onError={(e) => {
                e.target.src = 'https://getswipe.azureedge.net/getswipe/images/templates/temp-1.webp'; // Fallback to Classic if image fails
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceStylePreview;