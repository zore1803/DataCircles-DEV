import React, { useEffect, useState, useMemo, useCallback } from "react";
import ReactQuill from "react-quill-new";
import "react-quill/dist/quill.snow.css";
import API from "../../services/api";
import { useParams } from "react-router-dom";
import toast from 'react-hot-toast';
import { 
  StickyNote,
  Plus,
  Search,
  Edit3,
  Trash2,
  Clock,
  User,
  Save,
  X,
  Eye,
  Calendar,
  MoreVertical
} from "lucide-react";
import AppToaster from "../AppToaster";
import DataTable from "../common/DataTable";
import BulkActionBar from "../common/BulkActionBar";
import TablePaginationFooter from "../common/TablePaginationFooter";
import CompanyFilterPanel from "../company/CompanyFilterPanel";
import FilterIcon from "../common/FilterIcon";
import { useBulkSelection, useBulkStrip } from "../../hooks/useBulkSelection";
import { useTopLoadingSignal } from "../common/TopLoadingBar";

const NOTE_FILTER_COLUMNS = [{ key: "author", label: "Author" }];

const GridViewIcon = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="12 12 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M17.8331 28.6669V19.4794C17.8331 19.021 17.9997 18.6322 18.3331 18.3127C18.6664 17.9933 19.0622 17.8335 19.5206 17.8335H28.6664C29.1247 17.8335 29.5171 17.9967 29.8435 18.3231C30.1699 18.6495 30.3331 19.0419 30.3331 19.5002V26.1669L26.1664 30.3335H19.4997C19.0414 30.3335 18.649 30.1704 18.3226 29.844C17.9963 29.5176 17.8331 29.1252 17.8331 28.6669ZM13.6872 17.2085C13.6039 16.7502 13.6942 16.337 13.9581 15.969C14.2219 15.6009 14.5831 15.3752 15.0414 15.2919L24.0831 13.6877C24.5414 13.6044 24.9546 13.6947 25.3226 13.9585C25.6907 14.2224 25.9164 14.5835 25.9997 15.0419L26.2081 16.1669H24.4997L24.3539 15.3335L15.3331 16.9377L16.1664 21.646V27.4585C15.9442 27.3335 15.7532 27.1669 15.5935 26.9585C15.4338 26.7502 15.3331 26.5141 15.2914 26.2502L13.6872 17.2085ZM19.4997 19.5002V28.6669H25.3331V25.3335H28.6664V19.5002H19.4997Z" fill="currentColor" />
  </svg>
);

const ListViewIcon = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="56.5 14.9165 15 14.167" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M60.6667 15.3332H71.5V16.9998H60.6667V15.3332ZM56.5 14.9165H59V17.4165H56.5V14.9165ZM56.5 20.7498H59V23.2498H56.5V20.7498ZM56.5 26.5832H59V29.0832H56.5V26.5832ZM60.6667 21.1665H71.5V22.8332H60.6667V21.1665ZM60.6667 26.9998H71.5V28.6665H60.6667V26.9998Z" fill="currentColor" />
  </svg>
);
const getNoteFieldValue = (note, key) => {
  if (key === "author") return note.user?.name || note.user?.email;
  return note[key];
};

const stripHtml = (html) => String(html || "").replace(/<[^>]*>/g, "").trim();

const formatNoteDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—";

// Custom Quill modules and formats configuration
const quillModules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    ['link'],
    ['clean']
  ],
  clipboard: {
    matchVisual: false,
  }
};

const quillFormats = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'list', 'link'  // ✅ Remove 'bullet', keep only 'list'
];

// Note Viewer Modal
const NoteViewer = ({ isOpen, onClose, noteTitle, noteContent, vendorName, createdAt }) => {
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
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-lg border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {noteTitle || "Untitled Note"}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {vendorName} · {formatDate(createdAt)}
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Added ql-editor class */}
        <div className="p-4 overflow-y-auto max-h-[calc(85vh-120px)]">
          <div className="ql-editor prose prose-sm max-w-none">
            <div dangerouslySetInnerHTML={{ __html: noteContent }} />
          </div>
        </div>
      </div>
    </div>
  );
};

// Note Card Component
/* Card UI mirrors company/NoteSection.jsx's NoteCard exactly — same gradient
   header + document glyph, title/meta block, body preview, and author footer —
   so the Vendor Notes grid matches the Company Profile Notes tab. */
const NoteCard = ({ note, onEdit, onDelete, onView }) => {
  const formatFullDate = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString([], {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const [isExpanded, setIsExpanded] = useState(false);

  const getPreviewText = (html, expand = false) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const text = tempDiv.textContent || tempDiv.innerText || '';
    if (expand) return text;
    return text.length > 150 ? text.substring(0, 150) + '...' : text;
  };

  const rawText = getPreviewText(note.note, true);
  const isLong = rawText.length > 150;

  return (
    <div
      className="bg-white hover:border-blue-200 transition-all group relative flex flex-col items-start overflow-hidden"
      style={{
        width: "100%",
        height: "100%",
        borderRadius: 12,
        border: "1px solid #F3F4F6",
        boxShadow: "0px 0px 6px rgba(0, 0, 0, 0.02), 0px 2px 4px rgba(0, 0, 0, 0.08)",
      }}
    >
      <div
        className="relative w-full flex-shrink-0"
        style={{
          height: 70,
          background: "linear-gradient(180deg, #C7E4FF 0%, #FFFFFF 100%)",
        }}
      >
        <svg width="61" height="61" viewBox="0 0 61 61" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", left: 7, top: 5 }}>
          <path d="M58.0872 23.5066L53.5122 28.0816V17.2H32.9247V28.6375H21.4872V53.8H53.5122V47.4934L58.0872 42.9184V56.1058C58.0866 56.7078 57.847 57.285 57.4211 57.7105C56.9951 58.136 56.4177 58.375 55.8157 58.375H19.1837C18.8833 58.3729 18.5862 58.3117 18.3095 58.1948C18.0327 58.0779 17.7817 57.9076 17.5708 57.6937C17.3599 57.4798 17.1932 57.2264 17.0801 56.9481C16.9671 56.6698 16.9101 56.3719 16.9122 56.0715V26.35L30.644 12.625H55.7951C57.0578 12.625 58.0872 13.6658 58.0872 14.8942V23.5066ZM59.8668 28.196L63.1014 31.4328L45.3092 49.225L42.0701 49.2204L42.0747 45.9905L59.8668 28.1983V28.196Z" fill="url(#vendorNoteCardIconGradient)" />
          <defs>
            <linearGradient id="vendorNoteCardIconGradient" x1="41.7768" y1="12.625" x2="41.7768" y2="58.375" gradientUnits="userSpaceOnUse">
              <stop stopColor="#0085FF" />
              <stop offset="0.95343" stopColor="white" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div
        className="flex flex-col items-start w-full flex-1"
        style={{ padding: "10px 16px 16px" }}
      >
        <div className="flex flex-col items-start w-full" style={{ gap: 14 }}>
          <div className="flex flex-col items-start w-full" style={{ gap: 12 }}>
            <div className="flex items-start justify-between gap-2 w-full">
              <h4
                className="line-clamp-2"
                style={{
                  fontFamily: "Inter",
                  fontWeight: 500,
                  fontSize: 14,
                  lineHeight: "120%",
                  color: "#0F141A",
                }}
              >
                {note.title || 'Untitled Note'}
              </h4>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
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

            <div className="flex items-center" style={{ gap: 12 }}>
              <div className="flex items-center" style={{ gap: 4 }}>
                <span style={{ fontFamily: "Inter", fontWeight: 400, fontSize: 12, lineHeight: "120%", color: "#0085FF" }}>
                  Document Note
                </span>
                <Calendar style={{ width: 12, height: 12, color: "#868C98" }} />
              </div>
              <span style={{ fontFamily: "Inter", fontWeight: 400, fontSize: 12, lineHeight: "120%", color: "#525866" }}>
                {formatFullDate(note.createdAt)}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-start w-full gap-2">
            <p
              className={`w-full ${isExpanded ? "" : "line-clamp-3"}`}
              style={{ fontFamily: "Inter", fontWeight: 400, fontSize: 12, lineHeight: "160%", color: "#525866" }}
            >
              {getPreviewText(note.note, isExpanded)}
            </p>
            {isLong && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-blue-600 hover:text-blue-800 text-xs font-semibold transition-colors mt-1"
              >
                {isExpanded ? "Show Less" : "Read More"}
              </button>
            )}
          </div>
        </div>

        <div
          className="flex items-center justify-between w-full mt-auto"
          style={{ paddingTop: 20 }}
        >
          <div className="flex items-center" style={{ gap: 12 }}>
            {(() => {
              const authorUser = typeof note.user === "object" ? note.user : null;
              const authorAvatar = authorUser?.profileUrl || authorUser?.userData?.mainData?.profilePic;
              return authorAvatar ? (
                <img
                  src={authorAvatar}
                  alt={authorUser?.name || "User"}
                  className="rounded-full object-cover flex-shrink-0"
                  style={{ width: 20, height: 20 }}
                />
              ) : (
                <div
                  className="rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-semibold text-gray-600 flex-shrink-0"
                  style={{ width: 20, height: 20 }}
                >
                  {authorUser?.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
              );
            })()}
            <div className="flex items-center" style={{ gap: 6 }}>
              <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 14, lineHeight: "120%", color: "#1F2937" }}>
                {typeof note.user === "object" ? note.user?.name || "Unknown" : "Unknown"}
              </span>
              <span
                className="inline-flex items-center justify-center rounded-full"
                style={{
                  padding: "4px 8px",
                  background: "rgba(28, 28, 29, 0.1)",
                  fontFamily: "Inter",
                  fontWeight: 500,
                  fontSize: 8,
                  lineHeight: "120%",
                  color: "#1C1C1D",
                }}
              >
                {note.createdAt ? new Date(note.createdAt).getFullYear() : ""}
              </span>
            </div>
          </div>
          <MoreVertical style={{ width: 20, height: 20, color: "#1C1B1F" }} />
        </div>
      </div>
    </div>
  );
};

// Note Editor Modal
const NoteEditor = ({
  isOpen,
  onClose,
  noteTitle,
  setNoteTitle,
  noteContent,
  setNoteContent,
  onSave,
  loading,
  isEditing,
  vendorName
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-lg border border-gray-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {isEditing ? 'Edit Note' : 'New Note'}
            </h2>
            <p className="text-xs text-gray-600 mt-1">
              {isEditing ? 'Update your note' : `Note for ${vendorName}`}
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(85vh-140px)]">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title
              </label>
              <input
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Enter note title..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Note
              </label>
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <ReactQuill
                  value={noteContent}
                  onChange={setNoteContent}
                  modules={quillModules}
                  formats={quillFormats}
                  theme="snow"
                  placeholder="Write your note..."
                  style={{ minHeight: '180px' }}
                />
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <User className="w-4 h-4" />
                <span>Tagged: {vendorName}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={loading || !noteContent.trim()}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isEditing ? 'Update' : 'Save'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Main NoteSection Component
const NoteSection = () => {
  const { id: vendorId } = useParams();
  const [notes, setNotes] = useState([]);
  const [vendor, setVendor] = useState(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [viewingNote, setViewingNote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({});
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [columnSizing, setColumnSizing] = useState({});
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await API.get(`/vendor-notes/vendor/${vendorId}`);
      const sortedNotes = res.data.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      setNotes(sortedNotes);
    } catch {
      toast.error('Failed to load notes');
    }
  }, [vendorId]);

  const fetchVendor = useCallback(async () => {
    try {
      const res = await API.get(`/vendors/${vendorId}`);
      setVendor(res.data);
    } catch {
      toast.error('Failed to load vendor');
    }
  }, [vendorId]);

  useEffect(() => {
    fetchNotes();
    fetchVendor();
  }, [fetchNotes, fetchVendor]);

  const handleAddOrUpdateNote = async () => {
    if (!noteContent.trim() || noteContent === '<p><br></p>') {
      toast.error('Note content required');
      return;
    }

    try {
      setLoading(true);
      if (editingNoteId) {
        await API.put(`/vendor-notes/${editingNoteId}`, {
          title: noteTitle,
          note: noteContent,
        });
        toast.success('Note updated');
      } else {
        await API.post("/vendor-notes", {
          title: noteTitle,
          note: noteContent,
          vendor: vendorId,
        });
        toast.success('Note added');
      }

      resetForm();
      fetchNotes();
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || 'Failed to save note');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (note) => {
    setEditingNoteId(note._id);
    setNoteTitle(note.title || "");
    setNoteContent(note.note);
    setIsEditorOpen(true);
  };

  const handleView = (note) => {
    setViewingNote(note);
    setIsViewerOpen(true);
  };

  const handleDelete = async (noteId) => {
    if (window.confirm('Delete this note?')) {
      try {
        await API.delete(`/vendor-notes/${noteId}`);
        fetchNotes();
        toast.success('Note deleted');
      } catch (err) {
        if (err.response?.status === 402) {
          toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
        } else {
          toast.error(err.response?.data?.error || 'Failed to delete note');
        }
      }
    }
  };

  const resetForm = () => {
    setEditingNoteId(null);
    setNoteTitle("");
    setNoteContent("");
    setIsEditorOpen(false);
  };

  const closeViewer = () => {
    setViewingNote(null);
    setIsViewerOpen(false);
  };

  const filteredNotes = useMemo(() => {
    let rows = notes;

    const term = searchTerm.trim().toLowerCase();
    if (term) {
      rows = rows.filter((note) => {
        const title = String(note.title || "").toLowerCase();
        const content = stripHtml(note.note).toLowerCase();
        const author = String(getNoteFieldValue(note, "author") || "").toLowerCase();
        return title.includes(term) || content.includes(term) || author.includes(term);
      });
    }

    Object.entries(selectedFilters).forEach(([key, values]) => {
      if (!values?.length) return;
      rows = rows.filter((note) => values.includes(String(getNoteFieldValue(note, key) ?? "")));
    });

    return rows;
  }, [notes, searchTerm, selectedFilters]);

  const activeFilterCount = Object.values(selectedFilters).reduce(
    (n, arr) => n + (arr?.length || 0),
    0,
  );

  /* ── Pagination — same client-side "first ... current ... last" pattern
     CompanyNotesTab uses. Search/filters reset back to page 1. */
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);
  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedFilters]);
  const totalPages = Math.max(1, Math.ceil(filteredNotes.length / limit));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  // Brief top-edge progress flash on page change — same visual language as
  // Companies.jsx's server-paginated list, even though this data is already
  // in memory (client-side slice) rather than a fresh network round trip.
  const [isPaging, setIsPaging] = useState(false);
  useTopLoadingSignal(isPaging);
  const goToPage = (n) => {
    if (n === page) return;
    setIsPaging(true);
    setPage(n);
    setTimeout(() => setIsPaging(false), 220);
  };
  const paginatedNotes = useMemo(
    () => filteredNotes.slice((page - 1) * limit, page * limit),
    [filteredNotes, page, limit],
  );

  const { selectedItems, toggleItem, clearSelection, selectAll } = useBulkSelection({
    items: filteredNotes,
  });
  const { visible: stripVisible, closing: stripClosing } = useBulkStrip(selectedItems.length);

  const handleBulkDelete = async () => {
    if (!selectedItems.length) return;
    if (!window.confirm(`Delete ${selectedItems.length} note(s)? This cannot be undone.`)) return;
    setIsDeleting(true);
    try {
      await Promise.all(selectedItems.map((nid) => API.delete(`/vendor-notes/${nid}`)));
      await fetchNotes();
      clearSelection();
      toast.success("Notes deleted");
    } catch (err) {
      console.error("Bulk delete failed:", err);
      toast.error(err.response?.data?.error || "Failed to delete some notes.");
    } finally {
      setIsDeleting(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        id: "selection",
        size: 44,
        enableResizing: false,
        header: () => (
          <div className="flex justify-center items-center w-full">
            <input
              type="checkbox"
              checked={
                paginatedNotes.length > 0 &&
                paginatedNotes.every((n) => selectedItems.includes(n._id))
              }
              onChange={(e) => (e.target.checked ? selectAll(paginatedNotes) : clearSelection())}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex justify-center items-center w-full">
            <input
              type="checkbox"
              checked={selectedItems.includes(row.original._id)}
              onChange={() => toggleItem(row.original._id)}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
          </div>
        ),
      },
      {
        id: "title",
        size: 220,
        header: "Title",
        cell: ({ row }) => (
          <span
            className="text-gray-900 truncate block"
            title={row.original.title || "Untitled Note"}
          >
            {row.original.title || "Untitled Note"}
          </span>
        ),
      },
      {
        id: "note",
        size: 420,
        header: "Note",
        cell: ({ row }) => {
          const text = stripHtml(row.original.note);
          return (
            <span className="text-gray-900 truncate block" title={text}>
              {text || "—"}
            </span>
          );
        },
      },
      {
        id: "author",
        size: 160,
        header: "Author",
        cell: ({ row }) => (
          <span className="text-gray-700 truncate block">
            {row.original.user?.name || row.original.user?.email || "—"}
          </span>
        ),
      },
      {
        id: "createdAt",
        size: 150,
        header: "Created",
        cell: ({ row }) => (
          <span className="text-gray-700">{formatNoteDate(row.original.createdAt)}</span>
        ),
      },
      {
        id: "updatedAt",
        size: 150,
        header: "Last Updated",
        cell: ({ row }) => (
          <span className="text-gray-700">{formatNoteDate(row.original.updatedAt)}</span>
        ),
      },
      {
        id: "actions",
        size: 120,
        enableResizing: false,
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); handleView(row.original); }}
              className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
              title="View"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleEdit(row.original); }}
              className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
              title="Edit"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(row.original._id); }}
              className="p-1 text-gray-500 hover:text-red-600 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ),
      },
    ],
    [paginatedNotes, selectedItems, selectAll, clearSelection, toggleItem],
  );

  return (
    <div className="h-full mt-2">
      <AppToaster />

      {/* Action Buttons (Portaled to Tab Header) removed */}

      {stripVisible ? (
        <BulkActionBar
          selectedCount={selectedItems.length}
          entityName="note"
          isClosing={stripClosing}
          onSelectAll={() => selectAll(filteredNotes)}
          onDeselectAll={clearSelection}
          onDelete={handleBulkDelete}
          isDeleting={isDeleting}
        />
      ) : (
        <div className="flex items-center gap-4 mb-4" style={{ height: "44px" }}>
          <div className="relative flex-1 h-full">
            <Search size={20} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-900 opacity-50" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search notes..."
              className="w-full h-full pl-10 pr-3.5 border rounded-full text-sm focus:outline-none focus:border-blue-300"
              style={{ borderColor: "rgba(31, 41, 55, 0.1)" }}
            />
          </div>
          <div className="relative flex items-center gap-1.5 p-1 bg-[#E9EAEB] rounded-full flex-shrink-0 overflow-hidden" style={{ height: "44px" }}>
            <span
              className="absolute top-1 w-9 h-9 rounded-full bg-white shadow-[0px_4px_4px_rgba(0,0,0,0.1)] transition-all duration-300 ease-out pointer-events-none"
              style={{ left: viewMode === "list" ? 46 : 4 }}
            />
            <button
              onClick={() => setViewMode("grid")}
              title="Grid view"
              className={`relative z-10 w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
                viewMode === "grid"
                  ? "text-[#0085FF]"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <GridViewIcon size={20} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              title="List view"
              className={`relative z-10 w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
                viewMode === "list"
                  ? "text-[#0085FF]"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <ListViewIcon size={15} />
            </button>
          </div>
          <button
            onClick={() => setShowFilterPanel(true)}
            className="relative flex items-center justify-center gap-2 px-3 text-sm font-medium text-gray-800 bg-white border rounded-full hover:bg-gray-50 flex-shrink-0"
            style={{
              height: "44px",
              borderColor: activeFilterCount > 0 ? "#0085FF" : "#E1E4EA",
            }}
          >
            <FilterIcon size={16} />
            Filter
            {activeFilterCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full ring-2 ring-white">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setIsEditorOpen(true)}
            className="flex items-center justify-center rounded-full border hover:bg-gray-50 flex-shrink-0"
            style={{ width: "44px", height: "44px", borderColor: "rgba(31, 41, 55, 0.1)" }}
          >
            <Plus size={20} className="text-gray-700" />
          </button>
        </div>
      )}

      {viewMode === "grid" ? (
        <>
          {paginatedNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-gray-200">
            <StickyNote className="w-10 h-10 text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">
              {searchTerm || activeFilterCount ? "No notes match your search" : "No notes yet"}
            </p>
            {!searchTerm && !activeFilterCount && (
              <button
                onClick={() => setIsEditorOpen(true)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-800 text-sm transition-colors"
              >
                Create Note
              </button>
            )}
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(311px, 1fr))",
              gap: 24,
            }}
          >
            {paginatedNotes.map((note) => (
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
        </>
      ) : (
        <div className="bg-white border border-[#E1E4EA] rounded-xl shadow-[0px_2px_4px_rgba(28,27,31,0.04)] overflow-hidden">
          <DataTable
            data={paginatedNotes}
            columns={columns}
            columnSizing={columnSizing}
            onColumnSizingChange={setColumnSizing}
            variant="card"
            rowClassName={(n) => (selectedItems.includes(n._id) ? "!bg-blue-50" : "")}
            emptyContent={
              <div className="flex flex-col items-center gap-2">
                <StickyNote className="w-10 h-10 text-gray-400" />
                <p className="text-sm text-gray-600">
                  {searchTerm || activeFilterCount ? "No notes match your search" : "No notes yet"}
                </p>
                {!searchTerm && !activeFilterCount && (
                  <button
                    onClick={() => setIsEditorOpen(true)}
                    className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-800 text-sm transition-colors"
                  >
                    Create Note
                  </button>
                )}
              </div>
            }
          />
          <div className="border-t border-[#E1E4EA] px-5">
            <TablePaginationFooter
              currentPage={page}
              totalPages={totalPages}
              totalCount={filteredNotes.length}
              limit={limit}
              onPageChange={goToPage}
              onLimitChange={(n) => {
                setLimit(n);
                setPage(1);
              }}
            />
          </div>
        </div>
      )}

      {viewMode === "grid" && (
        <TablePaginationFooter
          currentPage={page}
          totalPages={totalPages}
          totalCount={filteredNotes.length}
          limit={limit}
          onPageChange={goToPage}
          onLimitChange={(n) => {
            setLimit(n);
            setPage(1);
          }}
        />
      )}

      <CompanyFilterPanel
        isOpen={showFilterPanel}
        onClose={() => setShowFilterPanel(false)}
        columns={NOTE_FILTER_COLUMNS}
        data={notes}
        getFieldValue={getNoteFieldValue}
        selected={selectedFilters}
        onApply={setSelectedFilters}
      />

      <NoteEditor
        isOpen={isEditorOpen}
        onClose={resetForm}
        noteTitle={noteTitle}
        setNoteTitle={setNoteTitle}
        noteContent={noteContent}
        setNoteContent={setNoteContent}
        onSave={handleAddOrUpdateNote}
        loading={loading}
        isEditing={!!editingNoteId}
        vendorName={vendor?.name || 'this vendor'}
      />

      <NoteViewer
        isOpen={isViewerOpen}
        onClose={closeViewer}
        noteTitle={viewingNote?.title || ''}
        noteContent={viewingNote?.note || ''}
        vendorName={vendor?.name || 'Vendor'}
        createdAt={viewingNote?.createdAt}
      />

      <style jsx global>{`
  /* Quill Editor Styles */
  .ql-editor ol,
  .prose ol,
  .ql-editor[contenteditable="false"] ol {
    list-style-type: decimal;
    padding-left: 1.5em;
    margin: 0.5em 0;
  }
  
  .ql-editor ul,
  .prose ul,
  .ql-editor[contenteditable="false"] ul {
    list-style-type: disc;
    padding-left: 1.5em;
    margin: 0.5em 0;
  }
  
  .ql-editor li,
  .prose li {
    padding-left: 0.3em;
    margin-bottom: 0.25em;
  }

  /* Nested lists */
  .ql-editor ol ol,
  .ql-editor ul ul,
  .prose ol ol,
  .prose ul ul {
    margin-top: 0.25em;
    margin-bottom: 0.25em;
  }
  
  .ql-toolbar {
    border: none;
    border-bottom: 1px solid #e5e7eb;
    padding: 8px 12px;
    background: #f9fafb;
  }
  
  .ql-container {
    border: none;
    font-family: inherit;
  }
  
  .ql-editor {
    padding: 12px;
    min-height: 180px;
    font-size: 14px;
    line-height: 1.6;
  }

  /* Viewer specific styles */
  .ql-editor[contenteditable="false"] {
    padding: 0;
    min-height: auto;
  }
  
  .prose {
    color: #374151;
  }

  .prose p {
    margin-bottom: 0.75em;
  }

  .prose strong {
    font-weight: 600;
  }

  .prose a {
    color: #2563eb;
    text-decoration: underline;
  }

  /* Headers in content */
  .prose h1, .ql-editor h1 {
    font-size: 1.5em;
    font-weight: 600;
    margin-top: 0.5em;
    margin-bottom: 0.5em;
  }

  .prose h2, .ql-editor h2 {
    font-size: 1.25em;
    font-weight: 600;
    margin-top: 0.5em;
    margin-bottom: 0.5em;
  }

  .prose h3, .ql-editor h3 {
    font-size: 1.1em;
    font-weight: 600;
    margin-top: 0.5em;
    margin-bottom: 0.5em;
  }
`}</style>
    </div>
  );
};

export default NoteSection;
