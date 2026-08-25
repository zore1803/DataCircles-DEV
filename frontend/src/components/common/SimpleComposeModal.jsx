import React, { useState } from "react";
import { X, Send } from "lucide-react";
import toast from "react-hot-toast";
import API from "../../services/api";

// Lightweight Email/SMS compose modal for modules that don't need Accounting's
// full rich-text compose drawer — posts to the same public share endpoints
// (/api/public/:apiPath/:docId/email|sms) so delivery behavior (PDF
// attachment via SendGrid, Fast2SMS relay) stays identical to Accounting.
export default function SimpleComposeModal({ mode, apiPath, docId, to, subject, body, onClose }) {
  const [toValue, setToValue] = useState(to || "");
  const [subjectValue, setSubjectValue] = useState(subject || "");
  const [bodyValue, setBodyValue] = useState(body || "");
  const [sending, setSending] = useState(false);

  const isEmail = mode === "email";

  const handleSend = async () => {
    if (!toValue || sending) return;
    setSending(true);
    try {
      if (isEmail) {
        await API.post(`/public/${apiPath}/${docId}/email`, {
          email: toValue,
          subject: subjectValue,
          body: bodyValue,
        });
      } else {
        await API.post(`/public/${apiPath}/${docId}/sms`, {
          phone: toValue,
          message: bodyValue,
        });
      }
      toast.success(isEmail ? "Email sent successfully" : "SMS sent successfully");
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || `Failed to send ${isEmail ? "email" : "SMS"}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[100011]" onClick={onClose} />
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[440px] bg-white rounded-2xl shadow-2xl z-[100012] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">{isEmail ? "Send Email" : "Send SMS"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              {isEmail ? "To (email)" : "To (phone number)"}
            </label>
            <input
              type={isEmail ? "email" : "tel"}
              value={toValue}
              onChange={(e) => setToValue(e.target.value)}
              placeholder={isEmail ? "recipient@example.com" : "10-digit mobile number"}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {isEmail && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>
              <input
                type="text"
                value={subjectValue}
                onChange={(e) => setSubjectValue(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Message</label>
            <textarea
              rows={isEmail ? 6 : 4}
              value={bodyValue}
              onChange={(e) => setBodyValue(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!toValue || sending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </>
  );
}
