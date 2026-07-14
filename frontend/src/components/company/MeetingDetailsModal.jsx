import React from "react";
import { X, Calendar, Clock, Users, MapPin, FileText, Trash2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { ParticipantChip, MeetingTypeIcon, PriorityChip } from "./CompanyMeetingForm";

const MeetingDetailsModal = ({ open, meetingData, users, onDelete, onClose }) => {
  const [isSliding, setIsSliding] = React.useState(false);
  const [shouldRender, setShouldRender] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setShouldRender(true);
      setTimeout(() => setIsSliding(true), 10);
    } else {
      setIsSliding(false);
      setTimeout(() => setShouldRender(false), 300);
    }
  }, [open]);

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await onDelete(meetingData._id);
      toast.success("Meeting deleted successfully");
      onClose();
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Failed to delete meeting");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (!shouldRender) return null;

  const selectedUsersList = users.filter(user => meetingData.participants?.includes(user._id) || meetingData.contact?._id === user._id || meetingData.vendor?._id === user._id || meetingData.company?._id === user._id);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[10000] transition-all duration-300"
        style={{ opacity: isSliding ? 1 : 0 }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`fixed inset-y-0 right-0 w-full sm:w-[700px] lg:w-[800px] z-[10001] bg-white shadow-2xl transform transition-transform duration-300 ease-out ${
          isSliding ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-xl">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Meeting Details</h3>
                <p className="text-sm text-gray-600">View and manage meeting information</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-8">
              {/* Meeting Header */}
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <h2 className="text-2xl font-bold text-gray-900 leading-tight">{meetingData.title}</h2>
                  <div className="flex items-center gap-2">
                  <PriorityChip priority={meetingData.priority} />
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium border border-blue-200">
                    <MeetingTypeIcon type={meetingData.meetingType} />
                    <span className="capitalize">{meetingData.meetingType?.replace('-', ' ')}</span>
                  </div>
                  </div>
                </div>
                
                {meetingData.description && (
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex items-start gap-2 mb-2">
                      <FileText className="w-4 h-4 text-gray-500 mt-0.5" />
                      <span className="text-sm font-semibold text-gray-700">Description</span>
                    </div>
                    <p className="text-gray-700 whitespace-pre-line leading-relaxed">{meetingData.description}</p>
                  </div>
                )}
              </div>

              {/* Meeting Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-6">
                  <div className="p-4 bg-white border border-gray-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-semibold text-gray-700">Date & Time</span>
                    </div>
                    <p className="font-semibold text-gray-900">
                      {new Date(meetingData?.scheduledAt).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                    <p className="text-sm text-blue-600 font-medium">
                      {new Date(meetingData?.scheduledAt).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })} • {meetingData.duration} minutes
                    </p>
                  </div>

                  {meetingData.location && (
                    <div className="p-4 bg-white border border-gray-200 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-semibold text-gray-700">Location</span>
                      </div>
                      <p className="text-gray-900 font-medium">{meetingData.location}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="p-4 bg-white border border-gray-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-semibold text-gray-700">
                        Participants ({selectedUsersList.length})
                      </span>
                    </div>
                    {selectedUsersList.length > 0 ? (
                      <div className="space-y-2">
                        {selectedUsersList.map((user) => (
                          <ParticipantChip key={user._id} user={user} />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">No participants assigned</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {onDelete && (
                <div className="flex justify-end pt-6 border-t border-gray-200">
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors border ${
                      isDeleting
                        ? "bg-red-100 text-red-400 border-red-100 cursor-not-allowed"
                        : "text-red-700 bg-red-50 hover:bg-red-100 border-red-200"
                    }`}
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Delete Meeting
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MeetingDetailsModal;