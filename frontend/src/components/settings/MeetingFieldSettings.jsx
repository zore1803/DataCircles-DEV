import React from "react";
import { CalendarClock } from "lucide-react";
import GenericFieldSettings from "./GenericFieldSettings";

const MeetingFieldSettings = () => (
  <GenericFieldSettings
    apiBase="/meeting-fields"
    moduleLabel="Meeting"
    icon={<CalendarClock className="w-5 h-5 text-blue-600" />}
  />
);

export default MeetingFieldSettings;
