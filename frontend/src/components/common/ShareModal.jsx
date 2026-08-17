import React, { useState } from "react";
import { X, MessageCircle, Mail, MessageSquare, Copy, Check } from "lucide-react";

const ShareModal = ({ isOpen, onClose, documentLink, documentType, documentNumber }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const message = `${documentType}${documentNumber ? ` #${documentNumber}` : ""}: ${documentLink}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(documentLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const el = document.createElement("textarea");
      el.value = documentLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const options = [
    {
      label: "WhatsApp",
      icon: <MessageCircle className="w-5 h-5" />,
      color: "bg-green-50 text-green-700 hover:bg-green-100",
      onClick: () => window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank"),
    },
    {
      label: "Email",
      icon: <Mail className="w-5 h-5" />,
      color: "bg-blue-50 text-blue-700 hover:bg-blue-100",
      onClick: () =>
        window.open(
          `mailto:?subject=${encodeURIComponent(`${documentType} ${documentNumber || ""}`)}&body=${encodeURIComponent(message)}`,
          "_blank"
        ),
    },
    {
      label: "SMS",
      icon: <MessageSquare className="w-5 h-5" />,
      color: "bg-purple-50 text-purple-700 hover:bg-purple-100",
      onClick: () => window.open(`sms:?body=${encodeURIComponent(message)}`, "_blank"),
    },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100010]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Share Document</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4 truncate">{documentLink}</p>

        <div className="flex gap-3 mb-4">
          {options.map((opt) => (
            <button
              key={opt.label}
              onClick={opt.onClick}
              className={`flex-1 flex flex-col items-center gap-2 py-3 rounded-lg text-xs font-medium transition-colors ${opt.color}`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleCopy}
          className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-green-600" />
              <span className="text-green-600">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copy Link
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ShareModal;
