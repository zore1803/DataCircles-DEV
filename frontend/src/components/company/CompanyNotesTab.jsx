import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { NotebookPen, FileText, Users, History, Search, Filter, Plus, StickyNote } from "lucide-react";
import toast from "react-hot-toast";
import API from "../../services/api";
import { NoteEditor, NoteViewer, NoteCard } from "./NoteSection";

export default function CompanyNotesTab() {
  const { id } = useParams();
  const [notes, setNotes] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [taggedContacts, setTaggedContacts] = useState([]);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [viewingNote, setViewingNote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await API.get(`/notes/company/${id}`);
      const sorted = res.data.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      );
      setNotes(sorted);
    } catch (err) {
      toast.error("Failed to load notes");
    }
  }, [id]);

  const fetchContacts = useCallback(async () => {
    try {
      const res = await API.get("/contacts");
      setContacts(res.data.filter((c) => c.company?._id === id));
    } catch (err) {
      toast.error("Failed to load contacts");
    }
  }, [id]);

  useEffect(() => {
    fetchNotes();
    fetchContacts();
  }, [fetchNotes, fetchContacts]);

  const resetForm = () => {
    setEditingNoteId(null);
    setNoteTitle("");
    setNoteContent("");
    setTaggedContacts([]);
    setIsEditorOpen(false);
  };

  const handleAddOrUpdateNote = async () => {
    if (!noteContent.trim() || noteContent === "<p><br></p>") {
      toast.error("Note content is required");
      return;
    }
    try {
      setLoading(true);
      if (editingNoteId) {
        await API.put(`/notes/${editingNoteId}`, {
          title: noteTitle,
          note: noteContent,
          taggedContacts: taggedContacts.map((c) => c.value),
        });
        toast.success("Note updated");
      } else {
        await API.post("/notes", {
          title: noteTitle,
          note: noteContent,
          company: id,
          taggedContacts: taggedContacts.map((c) => c.value),
        });
        toast.success("Note created");
      }
      resetForm();
      fetchNotes();
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Failed to save note");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (note) => {
    setEditingNoteId(note._id);
    setNoteTitle(note.title || "");
    setNoteContent(note.note);
    setTaggedContacts(
      note.taggedContacts.map((c) => ({ label: c.name, value: c._id })),
    );
    setIsEditorOpen(true);
  };

  const handleView = (note) => {
    setViewingNote(note);
    setIsViewerOpen(true);
  };

  const handleDelete = async (noteId) => {
    if (!window.confirm("Delete this note?")) return;
    try {
      await API.delete(`/notes/${noteId}`);
      fetchNotes();
      toast.success("Note deleted");
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Failed to delete note");
      }
    }
  };

  const closeViewer = () => {
    setViewingNote(null);
    setIsViewerOpen(false);
  };

  const filteredNotes = useMemo(() => {
    if (!searchTerm.trim()) return notes;
    const q = searchTerm.toLowerCase();
    return notes.filter((note) => {
      const content = note.note.replace(/<[^>]*>/g, "").toLowerCase();
      const taggedNames = note.taggedContacts.map((c) => c.name.toLowerCase()).join(" ");
      return (
        (note.title || "").toLowerCase().includes(q) ||
        content.includes(q) ||
        taggedNames.includes(q)
      );
    });
  }, [notes, searchTerm]);

  // KPI stats
  const sorted = [...notes].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const latest = sorted[0];
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentCount = notes.filter((n) => new Date(n.createdAt) >= sevenDaysAgo).length;
  const contributors = new Set(
    notes.map((n) => (typeof n.user === "object" ? n.user?._id : n.user)),
  );
  contributors.delete(undefined);
  contributors.delete(null);

  const relativeDays = (date) => {
    if (!date) return "—";
    const diff = Math.floor((Date.now() - new Date(date)) / (1000 * 60 * 60 * 24));
    if (diff <= 0) return "today";
    if (diff === 1) return "1 day ago";
    return `${diff} days ago`;
  };

  const latestUpdatedLabel = (() => {
    if (!latest) return "—";
    const diff = Math.floor((Date.now() - new Date(latest.createdAt)) / (1000 * 60 * 60 * 24));
    return diff <= 0 ? "Today" : relativeDays(latest.createdAt);
  })();

  const latestSubtitle = latest
    ? `${typeof latest.user === "object" ? latest.user?.name || "Unknown" : "Unknown"} · ${new Date(
      latest.createdAt,
    ).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
    : null;

  const kpiTiles = [
    { label: "Total Notes", value: notes.length, icon: NotebookPen },
    {
      label: "Recent Notes",
      value: recentCount,
      icon: FileText,
      subtitle: latest ? `Latest update ${relativeDays(latest.createdAt)}` : null,
      subtitleClass: "text-gray-400",
    },
    { label: "Team Contributors", value: contributors.size, icon: Users },
    {
      label: "Last Updated",
      value: latestUpdatedLabel,
      icon: History,
      subtitle: latestSubtitle,
      subtitleClass: "text-gray-400",
    },
  ];

  return (
    <div>
      {/* KPI Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {kpiTiles.map((tile) => (
          <div
            key={tile.label}
            className="h-[72px] flex items-center gap-3 px-3 bg-white border border-gray-200 rounded-xl"
          >
            <div className="w-10 h-10 text-blue-600 border border-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
              <tile.icon size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-gray-500 truncate">{tile.label}</p>
              <div className="flex items-baseline gap-2 flex-wrap">
                <p className="text-base font-semibold text-gray-900">{tile.value}</p>
                {tile.subtitle && (
                  <span className={`text-[11px] ${tile.subtitleClass}`}>{tile.subtitle}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Controls */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by note by name, deal..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-full text-sm focus:outline-none focus:border-blue-300"
          />
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50">
          <Filter size={14} />
          Filter
        </button>
        <button
          onClick={() => setIsEditorOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50"
          title="Add Note"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Notes list or empty state */}
      {filteredNotes.length === 0 ? (
        <button
          onClick={() => setIsEditorOpen(true)}
          className="flex flex-col items-center justify-center w-full min-h-[300px] bg-gray-50 border border-gray-200 rounded-xl text-gray-500 hover:text-blue-600 hover:border-blue-200 transition-colors"
        >
          <StickyNote size={28} className="mb-2" />
          <span className="text-sm font-medium">Add New Note</span>
        </button>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredNotes.map((note) => (
            <NoteCard
              key={note._id}
              note={note}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onView={handleView}
            />
          ))}
        </div>
      )}

      <NoteEditor
        isOpen={isEditorOpen}
        onClose={resetForm}
        noteTitle={noteTitle}
        setNoteTitle={setNoteTitle}
        noteContent={noteContent}
        setNoteContent={setNoteContent}
        taggedContacts={taggedContacts}
        setTaggedContacts={setTaggedContacts}
        contacts={contacts}
        onSave={handleAddOrUpdateNote}
        onDelete={() => handleDelete(editingNoteId)}
        loading={loading}
        isEditing={!!editingNoteId}
      />

      <NoteViewer
        isOpen={isViewerOpen}
        onClose={closeViewer}
        noteTitle={viewingNote?.title}
        noteContent={viewingNote?.note}
        taggedContacts={viewingNote?.taggedContacts}
        createdAt={viewingNote?.createdAt}
      />
    </div>
  );
}
