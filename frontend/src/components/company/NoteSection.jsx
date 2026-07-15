import React, { useEffect, useState, useMemo, useCallback } from "react";
import ReactQuill from "react-quill-new";
import "react-quill/dist/quill.snow.css";
import Select from "react-select";
import API from "../../services/api";
import { useParams } from "react-router-dom";
import toast from 'react-hot-toast';
import {
  StickyNote,
  Plus,
  Search,
  Edit3,
  Trash2,
  Users,
  X,
  Clock,
  Eye,
  Type,
  Flag,
  Share,
  CheckCircle,
  Link2,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Palette,
  Quote,
  Code,
  UserPlus
} from "lucide-react";
import AppToaster from "../AppToaster";


// Custom Quill modules and formats configuration
const QuillToolbar = () => (
  <div id="toolbar" className="flex flex-wrap gap-2 p-3 bg-white border-b border-gray-100">
    <div className="flex gap-1 pr-2 border-r border-gray-100">
      <button className="ql-header w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors" value="1">
        <Heading1 className="w-4 h-4" />
      </button>
      <button className="ql-header w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors" value="2">
        <Heading2 className="w-4 h-4" />
      </button>
      <button className="ql-header w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors" value="3">
        <Heading3 className="w-4 h-4" />
      </button>
      <button className="ql-header w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors" value="4">
        <Heading4 className="w-4 h-4" />
      </button>
    </div>

    <div className="flex gap-1 px-2 border-r border-gray-100">
      <button className="ql-bold w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors">
        <Bold className="w-4 h-4" />
      </button>
      <button className="ql-italic w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors">
        <Italic className="w-4 h-4" />
      </button>
      <button className="ql-underline w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors">
        <Underline className="w-4 h-4" />
      </button>
      <button className="ql-strike w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors">
        <Strikethrough className="w-4 h-4" />
      </button>
    </div>

    <div className="flex gap-1 px-2 border-r border-gray-100">
      <button className="ql-list w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors" value="ordered">
        <ListOrdered className="w-4 h-4" />
      </button>
      <button className="ql-list w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors" value="bullet">
        <List className="w-4 h-4" />
      </button>
      <button className="ql-indent w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors" value="-1">
        <AlignLeft className="w-4 h-4" />
      </button>
      <button className="ql-indent w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors" value="+1">
        <AlignRight className="w-4 h-4" />
      </button>
    </div>

    <div className="flex gap-1 px-2 border-r border-gray-100">
      <button className="ql-align w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors" value="">
        <AlignLeft className="w-4 h-4" />
      </button>
      <button className="ql-align w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors" value="center">
        <AlignCenter className="w-4 h-4" />
      </button>
      <button className="ql-align w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors" value="right">
        <AlignRight className="w-4 h-4" />
      </button>
      <button className="ql-align w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors" value="justify">
        <AlignJustify className="w-4 h-4" />
      </button>
    </div>

    <div className="flex gap-1 pl-2">
      <button className="ql-link w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors">
        <Link2 className="w-4 h-4" />
      </button>
      <button className="ql-blockquote w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors">
        <Quote className="w-4 h-4" />
      </button>
      <button className="ql-code-block w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors">
        <Code className="w-4 h-4" />
      </button>
      <button className="ql-clean w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors">
        <Type className="w-4 h-4" />
      </button>
    </div>
  </div>
);

// Custom Quill modules and formats configuration
const quillModules = {
  toolbar: {
    container: "#toolbar"
  },
  clipboard: {
    matchVisual: false,
  }
};

const quillFormats = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'list', 'indent', 'align', 'link', 'blockquote', 'code-block'
];


// NoteViewer component
export const NoteViewer = ({ isOpen, onClose, noteTitle, noteContent, taggedContacts, createdAt }) => {
  if (!isOpen) return null;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString([], {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[10001] p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl border border-gray-100 flex flex-col animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">View Note</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          <div className="space-y-4">
            <h1 className="text-3xl font-bold text-gray-900 leading-tight">
              {noteTitle || 'Untitled Note'}
            </h1>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-1.5 font-medium">
                <Clock className="w-4 h-4" />
                <span>{formatDate(createdAt)}</span>
              </div>
            </div>
          </div>

          <div className="ql-editor prose prose-sm max-w-none !p-0">
            <div dangerouslySetInnerHTML={{ __html: noteContent }} />
          </div>

          {taggedContacts?.length > 0 && (
            <div className="pt-6 border-t border-gray-100">
              <p className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                Tagged Contacts
              </p>
              <div className="flex flex-wrap gap-2">
                {taggedContacts.map((contact, idx) => (
                  <span
                    key={idx}
                    className="bg-gray-50 text-gray-700 px-3 py-1.5 rounded-xl text-xs font-medium border border-gray-100"
                  >
                    {contact.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


// NoteCard component
export const NoteCard = ({ note, onEdit, onDelete, onView }) => {
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.abs(now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getPreviewText = (html) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const text = tempDiv.textContent || tempDiv.innerText || '';
    return text.length > 120 ? text.substring(0, 120) + '...' : text;
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:border-blue-200 hover:shadow-md transition-all group relative">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-gray-900 truncate mb-1">
            {note.title || 'Untitled Note'}
          </h4>
          <div className="flex items-center gap-2 text-[10px] font-medium text-gray-400 uppercase tracking-wider">
            <Clock className="w-3 h-3" />
            <span>{formatDate(note.createdAt)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onView(note)}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
            title="View"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(note)}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
            title="Edit"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(note._id)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <p className="text-gray-600 text-xs leading-relaxed mb-3 line-clamp-3">
        {getPreviewText(note.note)}
      </p>

      {note.taggedContacts?.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {note.taggedContacts.slice(0, 3).map((contact, idx) => (
            <span
              key={idx}
              className="bg-gray-50 text-gray-500 border border-gray-100 px-2 py-0.5 rounded-lg text-[10px] font-medium"
            >
              {contact.name}
            </span>
          ))}
          {note.taggedContacts.length > 3 && (
            <span className="text-gray-400 text-[10px] font-medium">
              +{note.taggedContacts.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
};


// NoteEditor component
export const NoteEditor = ({
  isOpen,
  onClose,
  noteTitle,
  setNoteTitle,
  noteContent,
  setNoteContent,
  taggedContacts,
  setTaggedContacts,
  contacts,
  onSave,
  onDelete,
  loading,
  isEditing
}) => {
  const [isSliding, setIsSliding] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setTimeout(() => setIsSliding(true), 10);
    } else {
      setIsSliding(false);
      setTimeout(() => setShouldRender(false), 300);
    }
  }, [isOpen]);

  if (!shouldRender) return null;

  const contactOptions = contacts.map(contact => ({
    label: contact.name,
    value: contact._id
  }));

  const customSelectStyles = {
    control: (base) => ({
      ...base,
      border: 'none',
      boxShadow: 'none',
      background: 'transparent',
      minHeight: 'auto',
      '&:hover': { border: 'none' }
    }),
    valueContainer: (base) => ({
      ...base,
      padding: '0'
    }),
    input: (base) => ({
      ...base,
      margin: '0',
      padding: '0'
    })
  };

  return (
    <div className={`fixed inset-0 z-[10001] flex items-center justify-center p-4 transition-all duration-300 ${isSliding ? "opacity-100" : "opacity-0"}`}>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden relative z-10 flex flex-col transform transition-all duration-300 ${isSliding ? "scale-100 translate-y-0" : "scale-95 translate-y-4"}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="text-base font-semibold text-gray-700">
            {isEditing ? 'Edit Note' : 'Create New Note'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 px-2 hover:bg-gray-100 rounded-lg transition-colors border border-gray-100"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); onSave(); }} className="flex flex-col min-h-0 flex-1">
          {/* Main Body */}
          <div className="p-8 space-y-8 overflow-y-auto min-h-0 flex-1">
            {/* Note Title Input */}
            <input
              type="text"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="Note Title"
              className="w-full text-4xl font-bold border-none focus:outline-none placeholder-gray-300 text-gray-800"
              autoFocus
            />

            {/* Action Row */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                className="flex items-center gap-2 px-4 py-2 border border-gray-100 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all"
              >
                <Plus className="w-4 h-4" />
                Assign
              </button>

              <div className="flex items-center gap-2 px-4 py-2 border border-gray-100 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all min-w-[200px]">
                <Users className="w-4 h-4" />
                <Select
                  isMulti
                  options={contactOptions}
                  value={taggedContacts}
                  onChange={setTaggedContacts}
                  placeholder="Select Contact"
                  styles={customSelectStyles}
                  className="flex-1"
                  components={{
                    MultiValue: () => null, // Don't show chips here
                    IndicatorSeparator: () => null,
                    DropdownIndicator: () => null
                  }}
                />
              </div>

              <span className="text-xs text-gray-400 font-medium font-['Outfit']">
                Tagged Contacts will Receive Notifications About this Note
              </span>
            </div>

            {/* Editor Area */}
            <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
              <QuillToolbar />
              <ReactQuill
                value={noteContent}
                onChange={setNoteContent}
                modules={quillModules}
                formats={quillFormats}
                theme="snow"
                placeholder="Start writing your note..."
                className="min-h-[400px]"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-gray-100 bg-white flex items-center justify-end gap-3 flex-shrink-0">
            {isEditing && (
              <button
                type="button"
                onClick={onDelete}
                className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-all border border-gray-100 bg-white mr-auto"
                title="Delete Note"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}

            <button
              type="button"
              className="p-2.5 text-gray-500 hover:bg-gray-50 rounded-xl transition-all border border-gray-100 bg-white"
              title="Export/Share"
            >
              <Share className="w-5 h-5" />
            </button>

            <button
              type="button"
              className="p-2.5 text-gray-500 hover:bg-gray-50 rounded-xl transition-all border border-gray-100 bg-white"
              title="Edit Mode"
            >
              <Edit3 className="w-5 h-5" />
            </button>

            <button
              type="submit"
              disabled={loading || !noteContent.trim() || noteContent === '<p><br></p>'}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl hover:bg-emerald-100 transition-all text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-5 h-5" />
              {loading ? 'Saving...' : 'Save Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


// Main NoteSection component
const NoteSection = ({ companyId: propCompanyId }) => {
  const { id: paramCompanyId } = useParams();
  const companyId = propCompanyId || paramCompanyId;
  const [notes, setNotes] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [taggedContacts, setTaggedContacts] = useState([]);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [viewingNote, setViewingNote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await API.get(`/notes/company/${companyId}`);
      const sortedNotes = res.data.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      );
      setNotes(sortedNotes);
    } catch (err) {
      toast.error("Failed to load notes");
    }
  }, [companyId]);

  const fetchContacts = useCallback(async () => {
    try {
      const res = await API.get("/contacts");
      const companyContacts = res.data.filter(
        (c) => c.company?._id === companyId,
      );
      setContacts(companyContacts);
    } catch (err) {
      toast.error("Failed to load contacts");
    }
  }, [companyId]);

  useEffect(() => {
    fetchNotes();
    fetchContacts();
  }, [fetchNotes, fetchContacts]);

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
          company: companyId,
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
      note.taggedContacts.map((c) => ({
        label: c.name,
        value: c._id,
      })),
    );
    setIsEditorOpen(true);
  };

  const handleView = (note) => {
    setViewingNote(note);
    setIsViewerOpen(true);
  };

  const handleDelete = async (noteId) => {
    if (window.confirm("Delete this note?")) {
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
    }
  };

  const resetForm = () => {
    setEditingNoteId(null);
    setNoteTitle("");
    setNoteContent("");
    setTaggedContacts([]);
    setIsEditorOpen(false);
  };

  const closeViewer = () => {
    setViewingNote(null);
    setIsViewerOpen(false);
  };

  const filteredNotes = useMemo(() => {
    if (!searchTerm) return notes;
    return notes.filter((note) => {
      const content = note.note.replace(/<[^>]*>/g, "").toLowerCase();
      const taggedNames = note.taggedContacts
        .map((c) => c.name.toLowerCase())
        .join(" ");
      return (
        content.includes(searchTerm.toLowerCase()) ||
        taggedNames.includes(searchTerm.toLowerCase())
      );
    });
  }, [notes, searchTerm]);

  return (
    <div className="h-full">
      <AppToaster />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <StickyNote className="w-4 h-4" />
          <span>{filteredNotes.length} notes</span>
        </div>
        <button
          onClick={() => setIsEditorOpen(true)}
          className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-800 text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Note
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search notes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-gray-400"
        />
      </div>

      {filteredNotes.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <StickyNote className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600 mb-4">
            {searchTerm ? "No notes found" : "No notes yet"}
          </p>
          {!searchTerm && (
            <button
              onClick={() => setIsEditorOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-800 text-sm transition-colors"
            >
              Create Note
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
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
        noteContent={viewingNote?.note || ""}
        taggedContacts={viewingNote?.taggedContacts || []}
        createdAt={viewingNote?.createdAt}
      />

      <style jsx global>{`
        /* Premium Note Editor Styles */
        .ql-toolbar.ql-snow {
          border: none !important;
          padding: 0 !important;
        }

        .ql-container.ql-snow {
          border: none !important;
          font-family: inherit !important;
        }

        .ql-editor {
          padding: 2rem !important;
          min-height: 400px !important;
          font-size: 1rem !important;
          line-height: 1.8 !important;
          color: #374151 !important;
        }

        .ql-editor.ql-blank::before {
          left: 2rem !important;
          color: #9ca3af !important;
          font-style: normal !important;
          font-weight: 500 !important;
        }

        /* Toolbar Button Overrides */
        #toolbar button {
          border: 1px solid #f3f4f6 !important;
          color: #6b7280 !important;
          transition: all 0.2s !important;
          margin-bottom: 2px !important;
        }

        #toolbar button:hover {
          background-color: #f9fafb !important;
          color: #111827 !important;
          border-color: #e5e7eb !important;
        }

        #toolbar button.ql-active {
          background-color: #eff6ff !important;
          color: #2563eb !important;
          border-color: #bfdbfe !important;
        }

        #toolbar .ql-stroke {
          stroke: currentColor !important;
        }

        #toolbar .ql-fill {
          fill: currentColor !important;
        }

        /* Typography */
        .ql-editor h1 {
          font-size: 2.25rem !important;
          font-weight: 800 !important;
          margin-bottom: 1rem !important;
          border-bottom: none !important;
        }
        .ql-editor h2 {
          font-size: 1.875rem !important;
          font-weight: 700 !important;
          margin-bottom: 0.75rem !important;
          border-bottom: none !important;
        }
        .ql-editor h3 {
          font-size: 1.5rem !important;
          font-weight: 600 !important;
          margin-bottom: 0.5rem !important;
          border-bottom: none !important;
        }
        .ql-editor p {
          margin-bottom: 1.25rem !important;
        }

        /* List Styling */
        .ql-editor ol,
        .ql-editor ul {
          padding-left: 1.5rem !important;
          margin-bottom: 1.25rem !important;
        }

        .ql-editor li {
          margin-bottom: 0.5rem !important;
        }

        /* Prose styles for viewer */
        .prose h1 {
          font-size: 2rem;
          font-weight: 800;
          color: #111827;
          margin-bottom: 0.5rem;
        }
        .prose h2 {
          font-size: 1.5rem;
          font-weight: 700;
          color: #111827;
          margin-bottom: 0.5rem;
        }
        .prose p {
          line-height: 1.8;
          color: #374151;
          margin-bottom: 1rem;
        }
      `}</style>
    </div>
  );
};

export default NoteSection;
