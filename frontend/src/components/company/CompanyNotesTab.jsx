import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Search,
  Filter,
  Plus,
  StickyNote,
  FileText,
  Tag,
  Link2,
  Users,
  Calendar,
  Clock,
  Eye,
  Paperclip,
  MoreVertical,
  Pin,
  PinOff,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import toast from "react-hot-toast";
import API from "../../services/api";
import { NoteEditor, NoteViewer, NoteCard } from "./NoteSection";

const SlidersIcon = ({ size = 14, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M1.66667 2.91667C1.66667 2.22631 2.22631 1.66667 2.91667 1.66667C3.60702 1.66667 4.16667 2.22631 4.16667 2.91667C4.16667 3.60703 3.60702 4.16667 2.91667 4.16667C2.22631 4.16667 1.66667 3.60703 1.66667 2.91667ZM2.91667 0C1.30583 0 0 1.30583 0 2.91667C0 4.5275 1.30583 5.83333 2.91667 5.83333C4.5275 5.83333 5.83333 4.5275 5.83333 2.91667C5.83333 1.30583 4.5275 0 2.91667 0ZM7.5 3.75H14.1667V2.08333H7.5V3.75ZM10.8333 11.25C10.8333 10.5597 11.393 10 12.0833 10C12.7737 10 13.3333 10.5597 13.3333 11.25C13.3333 11.9403 12.7737 12.5 12.0833 12.5C11.393 12.5 10.8333 11.9403 10.8333 11.25ZM12.0833 8.33333C10.4725 8.33333 9.16667 9.63917 9.16667 11.25C9.16667 12.8608 10.4725 14.1667 12.0833 14.1667C13.6942 14.1667 15 12.8608 15 11.25C15 9.63917 13.6942 8.33333 12.0833 8.33333ZM0.833333 10.4167V12.0833H7.5V10.4167H0.833333Z" fill="#1F2937" />
  </svg>
);

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

const TotalNotesIcon = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="24 24 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M39.1202 39.0433C38.6042 38.5273 38.3462 37.9007 38.3462 37.1635C38.3462 36.4263 38.6042 35.7998 39.1202 35.2838C39.6362 34.7678 40.2628 34.5098 41 34.5098C41.7372 34.5098 42.3638 34.7678 42.8798 35.2838C43.3958 35.7998 43.6538 36.4263 43.6538 37.1635C43.6538 37.9007 43.3958 38.5273 42.8798 39.0433C42.3638 39.5592 41.7372 39.8173 41 39.8173C40.2628 39.8173 39.6362 39.5592 39.1202 39.0433ZM41.8182 37.9817C42.0419 37.7581 42.1538 37.4853 42.1538 37.1635C42.1538 36.8417 42.0419 36.5689 41.8182 36.3453C41.5946 36.1214 41.3218 36.0095 41 36.0095C40.6782 36.0095 40.4054 36.1214 40.1818 36.3453C39.9581 36.5689 39.8462 36.8417 39.8462 37.1635C39.8462 37.4853 39.9581 37.7581 40.1818 37.9817C40.4054 38.2054 40.6782 38.3173 41 38.3173C41.3218 38.3173 41.5946 38.2054 41.8182 37.9817ZM35.3463 46.2693V43.7153C35.3463 43.4257 35.4153 43.1535 35.5533 42.8985C35.6912 42.6435 35.8844 42.4402 36.1328 42.2885C36.6309 41.9913 37.1563 41.745 37.709 41.5495C38.2617 41.354 38.826 41.2093 39.402 41.1155L41 43.125L42.5885 41.1155C43.1677 41.2093 43.7312 41.354 44.279 41.5495C44.8267 41.745 45.351 41.9913 45.852 42.2885C46.1007 42.4397 46.2948 42.6423 46.4345 42.8962C46.5743 43.1501 46.6474 43.4199 46.6538 43.7057V46.2693H35.3463ZM36.8212 44.7693H40.3865L38.8348 42.7923C38.4814 42.8818 38.1379 42.998 37.8042 43.141C37.4706 43.2842 37.1429 43.4436 36.8212 43.6193V44.7693ZM41.6135 44.7693H45.1538V43.6193C44.8423 43.4333 44.5197 43.273 44.186 43.1385C43.8525 43.0038 43.5091 42.8917 43.1557 42.802L41.6135 44.7693ZM29.3123 44.5C28.8106 44.5 28.3831 44.323 28.0298 43.969C27.6766 43.615 27.5 43.1894 27.5 42.6923V29.3077C27.5 28.8106 27.677 28.385 28.031 28.031C28.385 27.677 28.8106 27.5 29.3077 27.5H42.6923C43.1894 27.5 43.615 27.677 43.969 28.031C44.323 28.385 44.5 28.8106 44.5 29.3077V33.6538C44.291 33.4166 44.0683 33.1945 43.8318 32.9875C43.5953 32.7805 43.318 32.6366 43 32.5557V29.3077C43 29.2179 42.9712 29.1442 42.9135 29.0865C42.8558 29.0288 42.7821 29 42.6923 29H29.3077C29.2179 29 29.1442 29.0288 29.0865 29.0865C29.0288 29.1442 29 29.2179 29 29.3077V42.6923C29 42.7821 29.0288 42.8558 29.0865 42.9135C29.1442 42.9712 29.2179 43 29.3077 43H33.0538C33.0231 43.1192 33 43.2384 32.9845 43.3577C32.9692 43.4769 32.9615 43.5961 32.9615 43.7153V44.5H29.3123ZM31.25 32.8652H38.4615C38.7987 32.6281 39.1631 32.4518 39.5548 32.3365C39.9464 32.2212 40.3448 32.1571 40.75 32.1443V31.3655H31.25V32.8652ZM31.25 36.75H36.0095C36.0223 36.4833 36.0583 36.2266 36.1173 35.9798C36.1763 35.7331 36.2532 35.4898 36.348 35.25H31.25V36.75ZM31.25 40.6345H34.373C34.55 40.491 34.7362 40.3593 34.9317 40.2395C35.1272 40.1195 35.3269 40.0127 35.5308 39.9192V39.1348H31.25V40.6345ZM29 43V29V32.5405V32.125V43Z" fill="#0085FF" />
  </svg>
);

const RecentNotesIcon = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="363.5 25.75 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M366.808 43H380.192C380.282 43 380.356 42.9712 380.413 42.9135C380.471 42.8558 380.5 42.7821 380.5 42.6923V33.7193L375.781 29H366.808C366.718 29 366.644 29.0288 366.587 29.0865C366.529 29.1442 366.5 29.2179 366.5 29.3077V42.6923C366.5 42.7821 366.529 42.8558 366.587 42.9135C366.644 42.9712 366.718 43 366.808 43ZM366.808 44.5C366.309 44.5 365.883 44.3234 365.53 43.9703C365.177 43.6169 365 43.1909 365 42.6923V29.3077C365 28.8091 365.177 28.3831 365.53 28.0298C365.883 27.6766 366.309 27.5 366.808 27.5H376.394L382 33.1057V42.6923C382 43.1909 381.823 43.6169 381.47 43.9703C381.117 44.3234 380.691 44.5 380.192 44.5H366.808ZM368.75 40.5H378.25V39H368.75V40.5ZM368.75 36.75H378.25V35.25H368.75V36.75ZM368.75 33H375.115V31.5H368.75V33Z" fill="#0085FF" />
  </svg>
);

const TeamContributorsIcon = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="24 24 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M25.5098 43.6924V39.9424C25.5098 39.459 25.6735 39.0498 26.001 38.7146C26.3285 38.3793 26.7256 38.2052 27.1923 38.1924H30.275C30.5763 38.1924 30.8626 38.2661 31.1338 38.4136C31.4048 38.5611 31.6256 38.7669 31.7963 39.0309C32.2923 39.7129 32.9073 40.2436 33.6413 40.6231C34.3753 41.0026 35.1615 41.1924 36 41.1924C36.8487 41.1924 37.6416 41.0026 38.3788 40.6231C39.1161 40.2436 39.7277 39.7129 40.2135 39.0309C40.4045 38.7669 40.633 38.5611 40.899 38.4136C41.165 38.2661 41.4403 38.1924 41.725 38.1924H44.8078C45.2846 38.2052 45.6859 38.3793 46.0115 38.7146C46.3372 39.0498 46.5 39.459 46.5 39.9424V43.6924H40V41.3404C39.4295 41.7764 38.8052 42.1107 38.127 42.3434C37.4487 42.576 36.7397 42.6924 36 42.6924C35.277 42.6924 34.5754 42.575 33.8953 42.3404C33.2151 42.1059 32.5865 41.7706 32.0095 41.3346V43.6924H25.5098ZM36 39.8079C35.3987 39.8079 34.8291 39.6684 34.2913 39.3896C33.7536 39.1108 33.3027 38.7258 32.9385 38.2346C32.6808 37.8629 32.3668 37.5594 31.9963 37.3241C31.6258 37.0889 31.2225 36.9457 30.7865 36.8944C31.2108 36.3739 31.9522 35.9697 33.0105 35.6819C34.0688 35.394 35.0653 35.2501 36 35.2501C36.9347 35.2501 37.9312 35.394 38.9895 35.6819C40.0478 35.9697 40.7923 36.3739 41.223 36.8944C40.7973 36.9457 40.3968 37.0889 40.0213 37.3241C39.6456 37.5594 39.3289 37.8629 39.0713 38.2346C38.7238 38.7424 38.2795 39.1316 37.7385 39.4021C37.1975 39.6726 36.618 39.8079 36 39.8079ZM28.2885 36.8079C27.5322 36.8079 26.8848 36.5386 26.3463 36.0001C25.8078 35.4616 25.5385 34.8142 25.5385 34.0579C25.5385 33.2847 25.8078 32.6331 26.3463 32.1031C26.8848 31.5729 27.5322 31.3079 28.2885 31.3079C29.0615 31.3079 29.7131 31.5729 30.2433 32.1031C30.7734 32.6331 31.0385 33.2847 31.0385 34.0579C31.0385 34.8142 30.7734 35.4616 30.2433 36.0001C29.7131 36.5386 29.0615 36.8079 28.2885 36.8079ZM43.7115 36.8079C42.9552 36.8079 42.3078 36.5386 41.7693 36.0001C41.2308 35.4616 40.9615 34.8142 40.9615 34.0579C40.9615 33.2847 41.2308 32.6331 41.7693 32.1031C42.3078 31.5729 42.9552 31.3079 43.7115 31.3079C44.4845 31.3079 45.1361 31.5729 45.6663 32.1031C46.1964 32.6331 46.4615 33.2847 46.4615 34.0579C46.4615 34.8142 46.1964 35.4616 45.6663 36.0001C45.1361 36.5386 44.4845 36.8079 43.7115 36.8079ZM36 33.8079C35.2437 33.8079 34.5963 33.5386 34.0578 33.0001C33.5193 32.4616 33.25 31.8142 33.25 31.0579C33.25 30.2847 33.5193 29.6331 34.0578 29.1031C34.5963 28.5729 35.2437 28.3079 36 28.3079C36.773 28.3079 37.4246 28.5729 37.9548 29.1031C38.4849 29.6331 38.75 30.2847 38.75 31.0579C38.75 31.8142 38.4849 32.4616 37.9548 33.0001C37.4246 33.5386 36.773 33.8079 36 33.8079Z" fill="#0085FF" />
  </svg>
);

const LastUpdatedIcon = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="363.48 26 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M373.51 44.5C372.33 44.5 371.225 44.2769 370.194 43.8307C369.163 43.3846 368.265 42.7782 367.498 42.0115C366.731 41.2448 366.125 40.3461 365.679 39.3152C365.233 38.2846 365.01 37.1795 365.01 36C365.01 34.8205 365.233 33.7154 365.679 32.6848C366.125 31.6539 366.731 30.7552 367.498 29.9885C368.265 29.2218 369.163 28.6154 370.194 28.1693C371.225 27.7231 372.33 27.5 373.51 27.5C374.767 27.5 375.962 27.7644 377.094 28.2932C378.226 28.8221 379.198 29.5653 380.01 30.523V28.1538H381.51V33.2307H376.433V31.7307H379.048C378.358 30.8807 377.536 30.2132 376.581 29.728C375.626 29.2427 374.602 29 373.51 29C371.56 29 369.905 29.6792 368.547 31.0375C367.189 32.3958 366.51 34.05 366.51 36C366.51 37.95 367.189 39.6042 368.547 40.9625C369.905 42.3208 371.56 43 373.51 43C375.26 43 376.786 42.4318 378.088 41.2952C379.39 40.1587 380.167 38.727 380.419 37H381.95C381.706 39.1487 380.78 40.9358 379.171 42.3615C377.562 43.7872 375.675 44.5 373.51 44.5ZM376.483 40.027L372.76 36.3038V31H374.26V35.6962L377.537 38.973L376.483 40.027Z" fill="#0085FF" />
  </svg>
);

export default function CompanyNotesTab({ showStats = true }) {
  const { id } = useParams();
  const [notes, setNotes] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [taggedContacts, setTaggedContacts] = useState([]);
  const [noteType, setNoteType] = useState("General Note");
  const [visibility, setVisibility] = useState("Team");
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [viewingNote, setViewingNote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewMode, setViewMode] = useState("grid");
  const [pinnedColumn, setPinnedColumn] = useState(null);
  const [colWidths, setColWidths] = useState({
    title: 212,
    type: 160,
    description: 227,
    contacts: 144,
    company: 205,
    date: 117,
    year: 93,
    createdBy: 179,
  });
  const [resizingCol, setResizingCol] = useState(null);
  const resizingRef = React.useRef(null);
  const totalTableWidth = useMemo(
    () => Object.values(colWidths).reduce((sum, w) => sum + w, 0),
    [colWidths],
  );

  const togglePinColumn = (colId) => {
    setPinnedColumn((prev) => (prev === colId ? null : colId));
  };

  const startResize = (e, colId) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = { colId, startX: e.clientX, startWidth: colWidths[colId] };
    setResizingCol(colId);

    const onMouseMove = (moveEvent) => {
      if (!resizingRef.current) return;
      const { colId: id, startX, startWidth } = resizingRef.current;
      const newWidth = Math.max(60, startWidth + (moveEvent.clientX - startX));
      setColWidths((prev) => ({ ...prev, [id]: newWidth }));
    };

    const onMouseUp = () => {
      resizingRef.current = null;
      setResizingCol(null);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

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
    setNoteType("General Note");
    setVisibility("Team");
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
          noteType,
          visibility,
        });
        toast.success("Note updated");
      } else {
        await API.post("/notes", {
          title: noteTitle,
          note: noteContent,
          company: id,
          taggedContacts: taggedContacts.map((c) => c.value),
          noteType,
          visibility,
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
    setNoteType(note.noteType || "General Note");
    setVisibility(note.visibility || "Team");
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

  const [listPage, setListPage] = useState(1);
  const [listLimit, setListLimit] = useState(10);

  const listTotalCount = filteredNotes.length;
  const listTotalPages = Math.max(1, Math.ceil(listTotalCount / listLimit));
  const listStartItem = listTotalCount === 0 ? 0 : (listPage - 1) * listLimit + 1;
  const listEndItem = Math.min(listPage * listLimit, listTotalCount);
  const hasListPrevPage = listPage > 1;
  const hasListNextPage = listPage < listTotalPages;

  const handleListPageChange = (page) => {
    if (page < 1 || page > listTotalPages) return;
    setListPage(page);
  };

  const handleListLimitChange = (newLimit) => {
    setListLimit(newLimit);
    setListPage(1);
  };

  const getListPageNumbers = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    for (let i = Math.max(2, listPage - delta); i <= Math.min(listTotalPages - 1, listPage + delta); i++) {
      range.push(i);
    }
    if (listPage - delta > 2) rangeWithDots.push(1, "...");
    else rangeWithDots.push(1);
    rangeWithDots.push(...range);
    if (listPage + delta < listTotalPages - 1) rangeWithDots.push("...", listTotalPages);
    else if (listTotalPages > 1) rangeWithDots.push(listTotalPages);
    return rangeWithDots.filter((item, index, arr) => index === 0 || arr[index - 1] !== item);
  };

  const paginatedNotes = useMemo(
    () => filteredNotes.slice((listPage - 1) * listLimit, listPage * listLimit),
    [filteredNotes, listPage, listLimit],
  );

  const getNotePreviewText = (html) => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html || "";
    const text = tempDiv.textContent || tempDiv.innerText || "";
    return text.length > 60 ? text.substring(0, 60) + "..." : text;
  };

  const formatNoteDate = (dateString) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString([], {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatNoteTime = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  };

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
    { label: "Total Notes", value: notes.length, icon: TotalNotesIcon },
    {
      label: "Recent Notes",
      value: recentCount,
      icon: RecentNotesIcon,
      subtitle: latest ? `Latest update ${relativeDays(latest.createdAt)}` : null,
      subtitleClass: "text-gray-400",
    },
    { label: "Team Contributors", value: contributors.size, icon: TeamContributorsIcon },
    {
      label: "Last Updated",
      value: latestUpdatedLabel,
      icon: LastUpdatedIcon,
      subtitle: latestSubtitle,
      subtitleClass: "text-gray-400",
    },
  ];

  return (
    <div>
      {/* KPI Tiles */}
      {showStats && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {kpiTiles.map((tile) => (
              <div
                key={tile.label}
                className="h-[72px] flex items-center gap-3 px-3 bg-white border border-gray-200 rounded-xl"
              >
                <div className="w-10 h-10 text-blue-600 border border-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                  <tile.icon size={20} />
                </div>
                <div className="min-w-0 flex-1 flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] text-gray-500 truncate">{tile.label}</p>
                    <p className="text-base font-semibold text-gray-900">{tile.value}</p>
                  </div>
                  {tile.subtitle && (
                    <span className={`text-[11px] flex-shrink-0 whitespace-nowrap ${tile.subtitleClass}`}>{tile.subtitle}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="-mx-6" style={{ marginTop: 24, paddingBottom: 24, borderTop: "1px solid #E1E4EA" }} />
        </>
      )}

      {/* Search + Controls */}
      <div className="flex items-center gap-4 mb-4" style={{ height: "44px" }}>
        <div className="relative flex-1 h-full">
          <Search size={20} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-900 opacity-50" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by note by name, deal..."
            className="w-full h-full pl-10 pr-3.5 border rounded-full text-sm focus:outline-none focus:border-blue-300"
            style={{ borderColor: "rgba(31, 41, 55, 0.1)" }}
          />
        </div>
        <div className="flex items-center gap-1.5 p-1 bg-[#E9EAEB] rounded-full flex-shrink-0" style={{ height: "44px" }}>
          <button
            onClick={() => setViewMode("grid")}
            title="Grid view"
            className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
              viewMode === "grid"
                ? "bg-white text-[#0085FF] shadow-[0px_4px_4px_rgba(0,0,0,0.1)]"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <GridViewIcon size={20} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            title="List view"
            className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
              viewMode === "list"
                ? "bg-white text-[#0085FF] shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <ListViewIcon size={15} />
          </button>
        </div>
        <button
          className="flex items-center justify-center gap-2 px-3 text-sm font-medium text-gray-800 bg-white border rounded-full hover:bg-gray-50 flex-shrink-0"
          style={{ height: "44px", borderColor: "#E1E4EA" }}
        >
          <SlidersIcon size={16} />
          Filter
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
      ) : viewMode === "grid" ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(311px, 1fr))",
            gap: 24,
          }}
        >
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
      ) : (
        <div
          className="box-border flex flex-col items-start w-full bg-white overflow-x-auto"
          style={{
            border: "1px solid #E1E4EA",
            borderRadius: 8,
          }}
        >
          <table
            className="text-sm text-left border-collapse"
            style={{ tableLayout: "fixed", width: "100%", minWidth: totalTableWidth, maxWidth: "100%" }}
          >
            <thead className="bg-[#F5F7FA] border-b border-[#E1E4EA]">
              <tr>
                {[
                  { id: "title", label: "Task Title", width: 212, icon: FileText, pinnable: true },
                  { id: "type", label: "Type", width: 160, icon: Tag, pinnable: true },
                  { id: "description", label: "Linked To", width: 227, icon: Link2, pinnable: true },
                  { id: "contacts", label: "Author", width: 144, icon: Users, pinnable: true },
                  { id: "company", label: "Tags", width: 205, icon: Tag, pinnable: true },
                  { id: "date", label: "Last Updated", width: 117, icon: Clock, pinnable: true },
                  { id: "year", label: "Visibility To", width: 93, icon: Eye, pinnable: true },
                  { id: "createdBy", label: "Attachments", width: 179, icon: Paperclip, pinnable: true },
                ].map((col) => {
                  const isPinned = pinnedColumn === col.id;
                  return (
                    <th
                      key={col.id}
                      style={{ width: colWidths[col.id], height: 56, position: "relative" }}
                      className={`px-3 py-2.5 font-medium text-[#525252] text-xs ${col.id === "actions" ? "" : "border-r border-[#E1E4EA]"
                        }`}
                    >
                      {col.pinnable ? (
                        <div
                          className="relative flex items-center justify-start w-full group cursor-pointer select-none"
                          onDoubleClick={() => togglePinColumn(col.id)}
                        >
                          <div className="flex items-center gap-1.5 flex-1 overflow-hidden">
                            <col.icon className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{col.label}</span>
                          </div>
                          <button
                            onClick={() => togglePinColumn(col.id)}
                            className={`ml-2 p-1 rounded hover:bg-gray-200 transition-opacity flex-shrink-0 ${isPinned ? "opacity-100 text-blue-600" : "opacity-0 group-hover:opacity-100 text-gray-400"
                              }`}
                            title={isPinned ? "Unpin Column" : "Pin Column"}
                          >
                            {isPinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                          {col.icon && <col.icon className="w-3.5 h-3.5 flex-shrink-0" />}
                          <span>{col.label}</span>
                        </div>
                      )}

                      {col.id !== "actions" && (
                        <div
                          onMouseDown={(e) => startResize(e, col.id)}
                          className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none hover:bg-blue-400 z-10 ${resizingCol === col.id ? "bg-blue-500" : "bg-transparent"
                            }`}
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E4EA] bg-white">
              {paginatedNotes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500 font-medium">
                    No notes found.
                  </td>
                </tr>
              ) : (
                paginatedNotes.map((note) => (
                  <tr key={note._id} className="hover:bg-gray-50 transition-colors group">
                    <td style={{ height: 64 }} className="px-3 text-left truncate">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {note.title || "Untitled Note"}
                      </span>
                    </td>
                    <td style={{ height: 64 }} className="px-3 text-left truncate">
                      <span
                        className="inline-flex items-center justify-center text-xs font-medium"
                        style={{ padding: "4px 10px", borderRadius: 53, backgroundColor: "rgba(0, 133, 255, 0.1)", color: "#0085FF" }}
                      >
                        Meeting Note
                      </span>
                    </td>
                    <td style={{ height: 64 }} className="px-3 text-left truncate">
                      <span className="text-xs text-gray-500 truncate">{note.company?.name || "{Deal Name/Activity/Invoice}"}</span>
                    </td>
                    <td style={{ height: 64 }} className="px-3">
                      <div className="flex items-center justify-start gap-1.5">
                        <div
                          className="rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-semibold text-gray-600 flex-shrink-0"
                          style={{ width: 18, height: 18 }}
                        >
                          {(typeof note.user === "object" ? note.user?.name : null)?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <span className="text-xs font-medium text-gray-700 truncate">
                          {typeof note.user === "object" ? note.user?.name || "Unknown" : "Unknown"}
                        </span>
                      </div>
                    </td>
                    <td style={{ height: 64 }} className="px-3 text-left truncate">
                      <div className="flex items-center justify-start gap-1 flex-wrap">
                        {note.taggedContacts?.length ? (
                          note.taggedContacts.slice(0, 3).map((c) => (
                            <span
                              key={c._id}
                              className="inline-flex items-center justify-center text-[10px] font-medium"
                              style={{ padding: "3px 8px", borderRadius: 53, backgroundColor: "rgba(0, 133, 255, 0.1)", color: "#0085FF" }}
                            >
                              {c.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                    <td style={{ height: 64 }} className="px-3 text-left truncate">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-gray-700 leading-tight">
                          {formatNoteDate(note.createdAt)}
                        </span>
                        <span className="text-[11px] text-gray-400 leading-tight">
                          {formatNoteTime(note.createdAt)}
                        </span>
                      </div>
                    </td>
                    <td style={{ height: 64 }} className="px-3 text-left truncate">
                      <span className="text-xs text-gray-500">Team</span>
                    </td>
                    <td style={{ height: 64 }} className="px-3">
                      <div className="relative flex items-center justify-start gap-1">
                        <Paperclip className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs text-gray-500">{note.attachments?.length || 0}</span>
                        <button
                          onClick={() => handleView(note)}
                          className="absolute right-0 p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="More options"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {viewMode === "list" && listTotalCount > 0 && (
        <div className="w-full bg-white px-4 py-3 flex items-center justify-between sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => handleListPageChange(listPage - 1)}
              disabled={!hasListPrevPage}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => handleListPageChange(listPage + 1)}
              disabled={!hasListNextPage}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>

          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div className="flex items-center space-x-2">
              <p className="text-sm text-gray-700 font-inter">
                Showing <span className="font-semibold">{listStartItem}</span> to{" "}
                <span className="font-semibold">{listEndItem}</span> of{" "}
                <span className="font-semibold">{listTotalCount}</span> results
              </p>
              <select
                value={listLimit}
                onChange={(e) => handleListLimitChange(parseInt(e.target.value))}
                className="ml-2 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-inter"
              >
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleListPageChange(listPage - 1)}
                disabled={!hasListPrevPage}
                className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {listTotalPages > 0 &&
                getListPageNumbers().map((pageNum, index) =>
                  pageNum === "..." ? (
                    <span
                      key={`dots-${index}`}
                      className="flex items-center justify-center w-8 h-8 text-sm font-medium text-gray-500"
                    >
                      ...
                    </span>
                  ) : (
                    <button
                      key={`page-${pageNum}`}
                      onClick={() => handleListPageChange(pageNum)}
                      className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${pageNum === listPage
                        ? "bg-blue-600 text-white"
                        : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                        }`}
                    >
                      {pageNum}
                    </button>
                  ),
                )}

              <button
                onClick={() => handleListPageChange(listPage + 1)}
                disabled={!hasListNextPage}
                className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
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
        noteType={noteType}
        setNoteType={setNoteType}
        visibility={visibility}
        setVisibility={setVisibility}
        onSave={handleAddOrUpdateNote}
        onDelete={() => handleDelete(editingNoteId)}
        loading={loading}
        isEditing={!!editingNoteId}
      />

      <NoteViewer
        isOpen={isViewerOpen}
        onClose={closeViewer}
        note={viewingNote}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
}
