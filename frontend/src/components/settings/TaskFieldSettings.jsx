import React from "react";
import { ListChecks, Type, AlignLeft, Link2, Users, ListTodo, Flag, Calendar } from "lucide-react";
import GenericFieldSettings from "./GenericFieldSettings";

// Inferred from backend/models/Task.js — the fields the Task schema already
// defines, shown read-only above the custom-field builder (same "Built-in
// Mandatory Fields" concept as VendorFieldSettings.jsx). System bookkeeping
// fields (createdBy, organization, starredBy) are left out, same as Vendor's
// list excludes its own audit fields.
const TASK_BUILT_IN_FIELDS = [
  { name: "Title", typeLabel: "String (Single-line)", required: true, icon: <Type className="w-4 h-4" /> },
  { name: "Description", typeLabel: "Text (Multi-line)", required: false, icon: <AlignLeft className="w-4 h-4" /> },
  {
    name: "Related To",
    typeLabel: "Linked Record",
    required: true,
    icon: <Link2 className="w-4 h-4" />,
    note: "Company, Contact, Deal, or Vendor — at least one is required per task.",
  },
  { name: "Assigned Users", typeLabel: "Multi-select (Users)", required: false, icon: <Users className="w-4 h-4" /> },
  { name: "Status", typeLabel: "Dropdown", required: true, icon: <ListTodo className="w-4 h-4" /> },
  { name: "Priority", typeLabel: "Dropdown (Low / Medium / High)", required: false, icon: <Flag className="w-4 h-4" /> },
  { name: "Due Date", typeLabel: "Date Picker", required: false, icon: <Calendar className="w-4 h-4" /> },
];

const TaskFieldSettings = () => (
  <GenericFieldSettings
    apiBase="/task-fields"
    moduleLabel="Task"
    icon={<ListChecks className="w-5 h-5 text-amber-600" />}
    builtInFields={TASK_BUILT_IN_FIELDS}
  />
);

export default TaskFieldSettings;
