import { useState, useEffect } from "react";
import API from "../services/api";

const DEFAULT_TASK_STATUSES = ["Pending", "In Progress", "Completed"];
const DEFAULT_NOTE_TYPES = ["General Note", "Meeting Note", "Call Note", "Follow-up Note"];
const DEFAULT_MEETING_TYPES = ["General Meeting", "Client Call", "Demo", "Follow-up"];

export function useSystemSettings() {
  const [taskStatuses, setTaskStatuses] = useState(DEFAULT_TASK_STATUSES);
  const [noteTypes, setNoteTypes] = useState(DEFAULT_NOTE_TYPES);
  const [meetingTypes, setMeetingTypes] = useState(DEFAULT_MEETING_TYPES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    API.get("/system-settings")
      .then((res) => {
        if (isMounted && res.data) {
          if (res.data.taskStatuses?.length > 0) {
            setTaskStatuses(res.data.taskStatuses);
          }
          if (res.data.noteTypes?.length > 0) {
            setNoteTypes(res.data.noteTypes);
          }
          if (res.data.meetingTypes?.length > 0) {
            setMeetingTypes(res.data.meetingTypes);
          }
        }
      })
      .catch((err) => console.error("Failed to fetch system settings", err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, []);

  return { taskStatuses, noteTypes, meetingTypes, loading };
}
