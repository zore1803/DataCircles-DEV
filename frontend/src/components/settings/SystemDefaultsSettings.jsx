import React, { useState, useEffect } from "react";
import { Plus, Trash2, Lock, Loader2, Timer, FileText, Settings2, Edit3, X, Check } from "lucide-react";
import API from "../../services/api";
import toast from "react-hot-toast";

const DEFAULT_TASK_STATUSES = ["Pending", "In Progress", "Completed"];
const DEFAULT_NOTE_TYPES = ["General Note", "Meeting Note", "Call Note", "Follow-up Note"];

function SystemDefaultsSettings() {
  const [taskStatuses, setTaskStatuses] = useState([]);
  const [noteTypes, setNoteTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // New items state
  const [newTaskStatus, setNewTaskStatus] = useState("");
  const [newNoteType, setNewNoteType] = useState("");

  // Edit states
  const [editingTaskIndex, setEditingTaskIndex] = useState(null);
  const [editTaskValue, setEditTaskValue] = useState("");
  const [editingNoteIndex, setEditingNoteIndex] = useState(null);
  const [editNoteValue, setEditNoteValue] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await API.get("/system-settings");
      // ensure defaults are present
      const fetchedStatuses = res.data?.taskStatuses || DEFAULT_TASK_STATUSES;
      const fetchedNotes = res.data?.noteTypes || DEFAULT_NOTE_TYPES;
      
      setTaskStatuses(fetchedStatuses);
      setNoteTypes(fetchedNotes);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load system settings");
    } finally {
      setLoading(false);
    }
  };

  const updateTaskStatuses = async (newStatuses) => {
    try {
      setIsSaving(true);
      const res = await API.put("/system-settings/task-statuses", { statuses: newStatuses });
      setTaskStatuses(res.data.taskStatuses);
      toast.success("Task statuses updated");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update task statuses");
      fetchSettings(); // revert
    } finally {
      setIsSaving(false);
    }
  };

  const updateNoteTypes = async (newTypes) => {
    try {
      setIsSaving(true);
      const res = await API.put("/system-settings/note-types", { noteTypes: newTypes });
      setNoteTypes(res.data.noteTypes);
      toast.success("Note types updated");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update note types");
      fetchSettings(); // revert
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTaskStatus = (e) => {
    e.preventDefault();
    if (!newTaskStatus.trim()) return;
    if (taskStatuses.includes(newTaskStatus.trim())) {
      toast.error("Status already exists");
      return;
    }
    const updated = [...taskStatuses, newTaskStatus.trim()];
    setNewTaskStatus("");
    updateTaskStatuses(updated);
  };

  const handleRemoveTaskStatus = (status) => {
    if (DEFAULT_TASK_STATUSES.includes(status)) return; // double check
    const updated = taskStatuses.filter(s => s !== status);
    updateTaskStatuses(updated);
  };

  const handleAddNoteType = (e) => {
    e.preventDefault();
    if (!newNoteType.trim()) return;
    if (noteTypes.includes(newNoteType.trim())) {
      toast.error("Note type already exists");
      return;
    }
    const updated = [...noteTypes, newNoteType.trim()];
    setNewNoteType("");
    updateNoteTypes(updated);
  };

  const handleRemoveNoteType = (type) => {
    if (DEFAULT_NOTE_TYPES.includes(type)) return;
    const updated = noteTypes.filter(t => t !== type);
    updateNoteTypes(updated);
  };

  const handleEditTaskSave = (index) => {
    if (!editTaskValue.trim()) return;
    if (taskStatuses.includes(editTaskValue.trim()) && editTaskValue.trim() !== taskStatuses[index]) {
      toast.error("Status already exists");
      return;
    }
    const updated = [...taskStatuses];
    updated[index] = editTaskValue.trim();
    updateTaskStatuses(updated);
    setEditingTaskIndex(null);
  };

  const handleEditNoteSave = (index) => {
    if (!editNoteValue.trim()) return;
    if (noteTypes.includes(editNoteValue.trim()) && editNoteValue.trim() !== noteTypes[index]) {
      toast.error("Note type already exists");
      return;
    }
    const updated = [...noteTypes];
    updated[index] = editNoteValue.trim();
    updateNoteTypes(updated);
    setEditingNoteIndex(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
        <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Settings2 className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900">System Defaults</h3>
            <p className="text-sm text-gray-500 mt-1">Customize the dropdown options available when creating Tasks and Notes.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Task Statuses Card */}
        <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-lg p-4 sm:p-6 h-fit">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
            <div className="bg-indigo-100 p-2 rounded-lg">
              <Timer className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900">Task Statuses</h3>
            </div>
            <span className="bg-indigo-100 text-indigo-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-indigo-200">
              {taskStatuses.length} Total
            </span>
          </div>

          <form onSubmit={handleAddTaskStatus} className="flex gap-2 mb-6">
            <input
              type="text"
              value={newTaskStatus}
              onChange={(e) => setNewTaskStatus(e.target.value)}
              placeholder="Add custom status (e.g. Under Review)"
              className="flex-1 px-4 py-2 text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              disabled={isSaving}
            />
            <button
              type="submit"
              disabled={isSaving || !newTaskStatus.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </form>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {taskStatuses.map((status, index) => {
              const isDefault = DEFAULT_TASK_STATUSES.includes(status);
              const isEditing = editingTaskIndex === index;
              return (
                <div key={index} className="border-2 border-gray-200 rounded-xl p-4 bg-gray-50 hover:border-indigo-300 transition-all">
                  {isEditing ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editTaskValue}
                        onChange={(e) => setEditTaskValue(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        autoFocus
                      />
                      <button
                        onClick={() => handleEditTaskSave(index)}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" /> Save
                      </button>
                      <button
                        onClick={() => setEditingTaskIndex(null)}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                      >
                        <X className="w-3 h-3" /> Cancel
                      </button>
                    </div>
                  ) : (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <span className="font-bold text-gray-900">{status}</span>
                        {isDefault ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-gray-200 text-gray-700 text-xs font-semibold rounded-full border border-gray-300">
                            <Lock className="w-3 h-3" /> System Default
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-200">
                            Custom Status
                          </span>
                        )}
                      </div>
                    </div>
                    {!isDefault && (
                      <div className="flex flex-wrap gap-2 mt-2 sm:mt-0">
                        <button
                          type="button"
                          onClick={() => { setEditingTaskIndex(index); setEditTaskValue(status); }}
                          disabled={isSaving}
                          className="flex items-center gap-1 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg font-semibold text-xs border border-blue-200 transition-colors disabled:opacity-50"
                        >
                          <Edit3 className="w-3 h-3" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveTaskStatus(status)}
                          disabled={isSaving}
                          className="flex items-center gap-1 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg font-semibold text-xs border border-red-200 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Note Types Card */}
        <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-lg p-4 sm:p-6 h-fit">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
            <div className="bg-purple-100 p-2 rounded-lg">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900">Note Types</h3>
            </div>
            <span className="bg-purple-100 text-purple-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-purple-200">
              {noteTypes.length} Total
            </span>
          </div>

          <form onSubmit={handleAddNoteType} className="flex gap-2 mb-6">
            <input
              type="text"
              value={newNoteType}
              onChange={(e) => setNewNoteType(e.target.value)}
              placeholder="Add custom note type (e.g. Customer Feedback)"
              className="flex-1 px-4 py-2 text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              disabled={isSaving}
            />
            <button
              type="submit"
              disabled={isSaving || !newNoteType.trim()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </form>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {noteTypes.map((type, index) => {
              const isDefault = DEFAULT_NOTE_TYPES.includes(type);
              const isEditing = editingNoteIndex === index;
              return (
                <div key={index} className="border-2 border-gray-200 rounded-xl p-4 bg-gray-50 hover:border-purple-300 transition-all">
                  {isEditing ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editNoteValue}
                        onChange={(e) => setEditNoteValue(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        autoFocus
                      />
                      <button
                        onClick={() => handleEditNoteSave(index)}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" /> Save
                      </button>
                      <button
                        onClick={() => setEditingNoteIndex(null)}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                      >
                        <X className="w-3 h-3" /> Cancel
                      </button>
                    </div>
                  ) : (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <span className="font-bold text-gray-900">{type}</span>
                        {isDefault ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-gray-200 text-gray-700 text-xs font-semibold rounded-full border border-gray-300">
                            <Lock className="w-3 h-3" /> System Default
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full border border-purple-200">
                            Custom Type
                          </span>
                        )}
                      </div>
                    </div>
                    {!isDefault && (
                      <div className="flex flex-wrap gap-2 mt-2 sm:mt-0">
                        <button
                          type="button"
                          onClick={() => { setEditingNoteIndex(index); setEditNoteValue(type); }}
                          disabled={isSaving}
                          className="flex items-center gap-1 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg font-semibold text-xs border border-blue-200 transition-colors disabled:opacity-50"
                        >
                          <Edit3 className="w-3 h-3" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveNoteType(type)}
                          disabled={isSaving}
                          className="flex items-center gap-1 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg font-semibold text-xs border border-red-200 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}

export default SystemDefaultsSettings;
