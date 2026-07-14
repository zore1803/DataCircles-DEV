import React, { useEffect, useState } from "react";
import { ArrowUpRight, MoreHorizontal, ChevronDown, ListFilter, Calendar as CalendarIcon, Clock } from "lucide-react";

// Helper for 12th Nov style dates
const formatDueDay = (isoDate) => {
    const date = new Date(isoDate);
    const day = date.getDate();
    const month = date.toLocaleString("en-US", { month: "short" });

    const suffix = (d) => {
        if (d > 3 && d < 21) return "th";
        switch (d % 10) {
            case 1: return "st";
            case 2: return "nd";
            case 3: return "rd";
            default: return "th";
        }
    };

    return `${day}${suffix(day)} ${month}`;
};

const formatTime = (isoDate) => {
    const date = new Date(isoDate);
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
};

const MeetingsInformation = ({ meetings }) => {
    const [meetingData, setMeetingData] = useState([]);

    useEffect(() => {
        if (meetings?.length > 0) {
            const displayData = meetings.map(meeting => {
                // Handle client name from various possible fields
                const client = meeting.company?.name || meeting.contact?.name || meeting.vendor?.name || "DataCircles";

                return {
                    ...meeting,
                    clientName: client,
                    formattedDate: formatDueDay(meeting.scheduledAt),
                    formattedTime: formatTime(meeting.scheduledAt),
                };
            });
            setMeetingData(displayData.slice(0, 10)); // Limit for dashboard
        } else {
            setMeetingData([]);
        }
    }, [meetings]);

    return (
        <div className="bg-white rounded-[20px] border border-[#F2F2F7] shadow-sm font-inter overflow-hidden mt-8">
            {/* Top Header */}
            <div className="p-8 pb-4 flex justify-between items-center">
                <h2 className="text-[20px] font-bold text-[#111216]">Meetings</h2>
                <div className="flex items-center gap-2">
                    <button className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
                        <ArrowUpRight className="w-4 h-4 text-gray-500" />
                    </button>
                    <button className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
                        <MoreHorizontal className="w-4 h-4 text-gray-500" />
                    </button>
                </div>
            </div>

            {/* Table Section */}
            <div className="overflow-x-auto border-t border-[#F2F2F7]">
                <table className="min-w-full text-sm text-left border-collapse">
                    <thead>
                        <tr className="border-b border-[#F2F2F7]">
                            <th className="px-8 py-4 font-bold text-[#111216] text-[13px] border-r border-[#F2F2F7] min-w-[215px]">
                                <div className="flex items-center gap-2 cursor-pointer group">
                                    Meeting Title <ListFilter className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" />
                                </div>
                            </th>
                            <th className="px-6 py-4 font-bold text-[#111216] text-[13px] border-r border-[#F2F2F7] min-w-[215px]">Client</th>
                            <th className="px-6 py-4 font-bold text-[#111216] text-[13px] border-r border-[#F2F2F7] min-w-[215px]">Date</th>
                            <th className="px-6 py-4 font-bold text-[#111216] text-[13px] border-r border-[#F2F2F7] min-w-[215px]">Time</th>
                            <th className="px-6 py-4 font-bold text-[#111216] text-[13px] border-r border-[#F2F2F7] min-w-[215px]">Status</th>
                            <th className="px-6 py-4 font-bold text-[#111216] text-[13px] min-w-[215px]">Priority</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F2F2F7]">
                        {meetingData.map((meeting) => (
                            <tr key={meeting._id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-8 py-4 font-bold text-[#111216] border-r border-[#F2F2F7] min-w-[215px]">{meeting.title}</td>
                                <td className="px-6 py-4 border-r border-[#F2F2F7] min-w-[215px]">
                                    <div className="flex items-center gap-3">
                                        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center p-1 overflow-hidden shrink-0">
                                            <div className="w-full h-full bg-white rounded-[2px] opacity-80" />
                                        </div>
                                        <span className="font-bold text-[#111216]">{meeting.clientName}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 font-bold text-gray-500 border-r border-[#F2F2F7] min-w-[215px]">
                                    {meeting.formattedDate}
                                </td>
                                <td className="px-6 py-4 font-bold text-gray-500 border-r border-[#F2F2F7] min-w-[215px]">
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                                        {meeting.formattedTime}
                                    </div>
                                </td>
                                <td className="px-6 py-4 border-r border-[#F2F2F7] min-w-[215px]">
                                    <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${meeting.status === 'scheduled' ? 'bg-blue-50 text-blue-500' :
                                        meeting.status === 'completed' ? 'bg-green-50 text-green-500' :
                                            'bg-gray-50 text-gray-500'
                                        }`}>
                                        {meeting.status?.charAt(0).toUpperCase() + meeting.status?.slice(1)}
                                    </span>
                                </td>
                                <td className="px-6 py-4 min-w-[215px]">
                                    <div className="flex gap-2">
                                        <span className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${meeting.priority === 'high' ? 'bg-red-50 text-red-500' :
                                            meeting.priority === 'medium' ? 'bg-yellow-50 text-yellow-500' :
                                                'bg-green-50 text-green-500'
                                            }`}>
                                            {meeting.priority?.charAt(0).toUpperCase() + meeting.priority?.slice(1)} Priority
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Table Footer */}
            <div className="p-6 border-t border-[#F2F2F7] flex items-center justify-between text-[13px] text-gray-500 font-medium">
                <div className="flex items-center gap-3">
                    <span>Show</span>
                    <button className="flex items-center gap-2 px-2 py-1 bg-white border border-[#F2F2F7] rounded-md hover:bg-gray-50 transition-colors">
                        10 <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                </div>
                <div>
                    1 to {meetingData.length} of {meetings?.length || meetingData.length} results
                </div>
            </div>
        </div>
    );
};

export default MeetingsInformation;
