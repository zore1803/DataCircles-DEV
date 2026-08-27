import React from "react";
import { CalendarClock, Type, AlignLeft, Clock, Timer, Video, ListTodo, MapPin, Link2 } from "lucide-react";
import GenericFieldSettings from "./GenericFieldSettings";

// Inferred from backend/models/Meeting.js — the fields the Meeting schema
// already defines, shown read-only above the custom-field builder. Secondary
// links (linkedContactId/linkedDealId/linkedInvoiceId, participants, notes,
// outcome, reminders) are left out, same curation level as Vendor's list.
const MEETING_BUILT_IN_FIELDS = [
  { name: "Title", typeLabel: "String (Single-line)", required: true, icon: <Type className="w-4 h-4" /> },
  { name: "Description", typeLabel: "Text (Multi-line)", required: false, icon: <AlignLeft className="w-4 h-4" /> },
  { name: "Scheduled At", typeLabel: "Date & Time", required: true, icon: <Clock className="w-4 h-4" /> },
  { name: "Duration", typeLabel: "Number (minutes)", required: false, icon: <Timer className="w-4 h-4" />, note: "Defaults to 60 minutes." },
  { name: "Meeting Type", typeLabel: "Dropdown (In-person / Video Call / Phone Call)", required: false, icon: <Video className="w-4 h-4" /> },
  { name: "Status", typeLabel: "Dropdown (Scheduled / Completed / Cancelled / No-show)", required: false, icon: <ListTodo className="w-4 h-4" /> },
  { name: "Location", typeLabel: "String (Single-line)", required: false, icon: <MapPin className="w-4 h-4" /> },
  {
    name: "Linked To",
    typeLabel: "Linked Record",
    required: true,
    icon: <Link2 className="w-4 h-4" />,
    note: "Contact, Company, or Vendor — exactly one is required per meeting.",
  },
];

const MeetingFieldSettings = () => (
  <GenericFieldSettings
    apiBase="/meeting-fields"
    moduleLabel="Meeting"
    icon={<CalendarClock className="w-5 h-5 text-amber-600" />}
    builtInFields={MEETING_BUILT_IN_FIELDS}
  />
);

export default MeetingFieldSettings;
