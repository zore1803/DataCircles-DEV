import React from "react";
import { ListChecks } from "lucide-react";
import GenericFieldSettings from "./GenericFieldSettings";

const TaskFieldSettings = () => (
  <GenericFieldSettings
    apiBase="/task-fields"
    moduleLabel="Task"
    icon={<ListChecks className="w-5 h-5 text-blue-600" />}
  />
);

export default TaskFieldSettings;
