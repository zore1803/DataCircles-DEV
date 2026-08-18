import React from "react";
import { X, Phone, Clock, User, Calendar } from "lucide-react";

const CallLogDetailView = ({ log, isOpen, onClose }) => {
  if (!isOpen || !log) return null;

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
              <Phone className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Call Log Details</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900">{log.purpose}</h3>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500">
              <span className="flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded-md">
                <span className={`w-2 h-2 rounded-full ${
                  log.status === 'Connected' ? 'bg-green-500' :
                  log.status === 'Missed' ? 'bg-red-500' :
                  log.status === 'Voicemail' ? 'bg-yellow-500' : 'bg-gray-500'
                }`} />
                {log.status}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {new Date(log.timestamp || log.createdAt).toLocaleDateString()}
              </span>
              {(log.duration !== undefined && log.duration !== null && log.duration !== "") && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {log.duration} min
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 py-4 border-y border-gray-100">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Type</p>
              <p className="text-sm text-gray-900">{log.type}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Logged By</p>
              <p className="text-sm text-gray-900 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-gray-400" />
                {log.user?.name || "Unknown"}
              </p>
            </div>
          </div>

          {log.notes && (
            <div>
              <p className="text-sm font-medium text-gray-900 mb-2">Notes</p>
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {log.notes}
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallLogDetailView;
