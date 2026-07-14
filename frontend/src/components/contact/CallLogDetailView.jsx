import React from "react";
import { 
  X, 
  Phone, 
  Clock, 
  User, 
  MessageSquare, 
  Calendar,
  PhoneOutgoing,
  PhoneIncoming
} from "lucide-react";

const CallLogDetailView = ({ log, onClose }) => {
  if (!log) return null;

  const formatDuration = (seconds) => {
    if (!seconds) return "No duration";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins} min ${secs} sec` : `${secs} seconds`;
  };

  const formatFullDate = (date) => {
    return new Date(date).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Connected":
        return "bg-green-100 text-green-800 border-green-200";
      case "Missed":
        return "bg-red-100 text-red-800 border-red-200";
      case "Voicemail":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "No Answer":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const CallIcon = log.callType === "Outbound" ? PhoneOutgoing : PhoneIncoming;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-[100003] transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[100003] overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div 
            className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl transform transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-lg ${
                    log.callType === "Outbound" 
                      ? "bg-blue-100 text-blue-600" 
                      : "bg-green-100 text-green-600"
                  }`}>
                    <CallIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      {log.callType} Call
                    </h2>
                    <p className="text-sm text-gray-500">
                      Call Log Details
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6 space-y-6">
              {/* Status Badge */}
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg border ${getStatusColor(log.status)}`}>
                  {log.status}
                </span>
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {formatDuration(log.duration)}
                  </span>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Contact Info */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-gray-500" />
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Contact
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">
                    {log.contact?.name || "Unknown Contact"}
                  </p>
                  {log.contact?.email && (
                    <p className="text-xs text-gray-600 mt-1">
                      {log.contact.email}
                    </p>
                  )}
                  {log.contact?.phone && (
                    <p className="text-xs text-gray-600">
                      {log.contact.phone}
                    </p>
                  )}
                </div>

                {/* User Info */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-gray-500" />
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Logged By
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">
                    {log.user?.name || "Unknown User"}
                  </p>
                  {log.user?.email && (
                    <p className="text-xs text-gray-600 mt-1">
                      {log.user.email}
                    </p>
                  )}
                </div>

                {/* Date/Time */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Date & Time
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">
                    {formatFullDate(log.createdAt)}
                  </p>
                </div>

                {/* Call Type */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Phone className="w-4 h-4 text-gray-500" />
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Call Type
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">
                    {log.callType}
                  </p>
                </div>
              </div>

              {/* Notes Section - Added ql-editor class */}
              {log.notes && (
                <div className="bg-white rounded-lg border border-gray-200">
                  <div className="border-b border-gray-200 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-gray-500" />
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Call Notes
                      </span>
                    </div>
                  </div>
                  <div className="px-4 py-4">
                    <div 
                      className="ql-editor text-sm text-gray-700 prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: log.notes }}
                    />
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Created: {new Date(log.createdAt).toLocaleString()}</span>
                  {log.updatedAt && log.updatedAt !== log.createdAt && (
                    <span>Updated: {new Date(log.updatedAt).toLocaleString()}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-xl">
              <div className="flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        /* Quill content viewer styles */
        .ql-editor ol,
        .ql-editor[contenteditable="false"] ol {
          list-style-type: decimal;
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        
        .ql-editor ul,
        .ql-editor[contenteditable="false"] ul {
          list-style-type: disc;
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        
        .ql-editor li,
        .prose li {
          padding-left: 0.3em;
          margin-bottom: 0.25em;
        }

        .ql-editor ol ol,
        .ql-editor ul ul {
          margin-top: 0.25em;
          margin-bottom: 0.25em;
        }

        .ql-editor[contenteditable="false"] {
          padding: 0;
          min-height: auto;
        }

        .prose p {
          margin-bottom: 0.75em;
        }

        .prose strong {
          font-weight: 600;
        }

        .prose a {
          color: #2563eb;
          text-decoration: underline;
        }
      `}</style>
    </>
  );
};

export default CallLogDetailView;
