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
  Calendar,
  MoreVertical,
  Type,
  Flag,
  Share,
  CheckCircle,
  Link2,
  Landmark,
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
export const NoteViewer = ({ isOpen, onClose, note, onEdit, onDelete }) => {
  if (!isOpen || !note) return null;

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleString([], {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const relativeTime = (dateString) => {
    if (!dateString) return "—";
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  };

  const noteId = `NOTE-${(note._id || "").slice(-5).toUpperCase()}`;
  const authorName = typeof note.user === "object" ? note.user?.name || "Unknown" : "Unknown";
  const authorRole = typeof note.user === "object" ? note.user?.role || "" : "";
  const primaryContact = note.taggedContacts?.[0];

  const handleSave = () => {
    onClose();
    onEdit?.(note);
  };

  const handleMarkComplete = () => {
    toast("Mark as complete isn't available yet");
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-end z-[10001] p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[26px] w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl border border-gray-100 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div
          className="flex flex-row justify-between items-center flex-shrink-0"
          style={{ padding: "23px 24px", gap: 10, height: 55 }}
        >
          <span style={{ fontFamily: "Inter", fontWeight: 400, fontSize: 14, lineHeight: "20px", color: "#78788D" }}>
            {noteId}
          </span>
          <div className="flex flex-row items-center justify-end" style={{ gap: 4 }}>
            <button
              onClick={handleSave}
              className="p-1 rounded-lg hover:bg-blue-50 transition-colors"
              title="Edit"
            >
              <Edit3 className="w-5 h-5" style={{ color: "#0085FF" }} />
            </button>
            <button
              onClick={() => onDelete?.(note._id)}
              className="p-1 rounded-lg hover:bg-red-50 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-5 h-5" style={{ color: "#F60000" }} />
            </button>
            <div style={{ width: 1, height: 18, backgroundColor: "rgba(28, 27, 31, 0.3)" }} />
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" style={{ color: "#1C1B1F" }} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-3">
          <div className="flex flex-col items-start" style={{ padding: 24, gap: 14 }}>
            <div className="flex flex-col items-start w-full" style={{ gap: 6 }}>
              <div className="flex flex-row items-center justify-between w-full" style={{ gap: 40 }}>
                <h1
                  style={{
                    fontFamily: "Inter",
                    fontWeight: 500,
                    fontSize: 16,
                    lineHeight: "120%",
                    letterSpacing: "-0.5px",
                    color: "#0E121B",
                  }}
                  className="truncate"
                >
                  {note.title || 'Untitled Note'}
                </h1>
                <span
                  className="flex-shrink-0 inline-flex items-center justify-center"
                  style={{
                    padding: "4px 8px",
                    borderRadius: 35,
                    backgroundColor: "#EEE7FD",
                    fontFamily: "Inter",
                    fontWeight: 500,
                    fontSize: 12,
                    lineHeight: "120%",
                    color: "#CB30E0",
                    whiteSpace: "nowrap",
                  }}
                >
                  Meeting Note
                </span>
              </div>
              <div className="flex flex-row items-center w-full" style={{ gap: 6 }}>
                <div
                  className="rounded-full bg-gray-200 flex items-center justify-center text-[8px] font-semibold text-gray-600 flex-shrink-0"
                  style={{ width: 16, height: 16 }}
                >
                  {authorName?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <span
                  className="truncate"
                  style={{ fontFamily: "Inter", fontWeight: 400, fontSize: 12, lineHeight: "120%", color: "#525866" }}
                >
                  Created by {authorName} on {formatDate(note.createdAt)} • Updated {relativeTime(note.updatedAt || note.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {/* Note Information */}
          <div className="flex flex-col items-start w-full" style={{ padding: "12px 24px", gap: 14 }}>
            <p style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 14, lineHeight: "120%", color: "#1F2937" }}>
              Note Information
            </p>
            <div
              className="flex flex-col items-start w-full"
              style={{ padding: 14, gap: 16, backgroundColor: "#F8FAFC", borderRadius: 14 }}
            >
              <div className="flex flex-row items-start w-full" style={{ gap: 16 }}>
                <div className="flex flex-col items-start flex-1" style={{ gap: 6 }}>
                  <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#6B7280" }}>
                    Meeting
                  </span>
                  <span
                    className="truncate"
                    style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 14, lineHeight: "120%", color: "#0085FF" }}
                  >
                    —
                  </span>
                </div>
                <div className="flex flex-col items-start flex-1" style={{ gap: 6 }}>
                  <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#6B7280" }}>
                    Deal
                  </span>
                  <span
                    className="truncate"
                    style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 14, lineHeight: "120%", color: "#0085FF" }}
                  >
                    {note.company?.name || "—"}
                  </span>
                </div>
              </div>
              <div className="flex flex-row items-start w-full" style={{ gap: 16 }}>
                <div className="flex flex-col items-start flex-1" style={{ gap: 6 }}>
                  <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#6B7280" }}>
                    Tasks
                  </span>
                  <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 14, lineHeight: "120%", color: "#1C1C1D" }}>
                    {note.tasks?.length || 0} Tasks
                  </span>
                </div>
                <div className="flex flex-col items-start flex-1" style={{ gap: 6 }}>
                  <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#6B7280" }}>
                    Invoices
                  </span>
                  <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 14, lineHeight: "120%", color: "#1F2937" }}>
                    {note.invoices?.length || 0} Invoices
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Details */}
          <div
            className="flex flex-row justify-between items-center w-full"
            style={{ padding: "12px 24px", gap: 14 }}
          >
            <p style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 14, lineHeight: "120%", color: "#1F2937" }}>
              Details
            </p>
            <button
              onClick={handleSave}
              className="flex items-center justify-center hover:bg-blue-50 rounded-md transition-all flex-shrink-0"
              style={{ width: 20, height: 20 }}
              title="Edit details"
            >
              <Edit3 className="w-4 h-4" style={{ color: "#0085FF" }} />
            </button>
          </div>

          <div
            className="box-border flex flex-col items-start w-full"
            style={{ padding: "16px 24px", gap: 16 }}
          >
            <div className="flex flex-row items-start w-full" style={{ gap: 16 }}>
              <div className="flex flex-col items-start flex-1" style={{ gap: 6 }}>
                <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#6B7280" }}>
                  Note Type
                </span>
                <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 14, lineHeight: "120%", color: "#0085FF" }}>
                  Meeting Note
                </span>
              </div>
              <div className="flex flex-col items-start flex-1" style={{ gap: 6 }}>
                <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#6B7280" }}>
                  Visibility
                </span>
                <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 14, lineHeight: "120%", color: "#0085FF" }}>
                  Team
                </span>
              </div>
            </div>
            <div className="flex flex-row items-start w-full" style={{ gap: 16 }}>
              <div className="flex flex-col items-start flex-1" style={{ gap: 6 }}>
                <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#6B7280" }}>
                  Author
                </span>
                <div className="flex flex-row items-center" style={{ gap: 12 }}>
                  <div
                    className="rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0"
                    style={{ width: 32, height: 32 }}
                  >
                    {authorName?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div className="flex flex-col items-start" style={{ gap: 4 }}>
                    <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 14, lineHeight: "120%", color: "#1F2937" }} className="truncate">
                      {authorName}
                    </span>
                    <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#6B7280" }} className="truncate">
                      {authorRole || "—"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-start flex-1" style={{ gap: 6 }}>
                <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 12, lineHeight: "120%", color: "#6B7280" }}>
                  Last Updated
                </span>
                <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 14, lineHeight: "120%", color: "#1F2937" }}>
                  {formatDate(note.updatedAt || note.createdAt)}
                </span>
              </div>
            </div>
          </div>

          <div style={{ margin: "0 24px", borderBottom: "1px solid #D9D9D9" }} />

          {/* Note content */}
          <div
            className="box-border flex flex-col items-start w-full"
            style={{ padding: "12px 24px" }}
          >
            <div
              className="flex flex-col items-start justify-center w-full"
              style={{ padding: 14, gap: 16, backgroundColor: "#F8FAFC", borderRadius: 14 }}
            >
              <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 14, lineHeight: "120%", color: "#1F2937" }}>
                Note
              </span>
              <div
                className="ql-editor prose prose-sm max-w-none w-full"
                style={{ fontFamily: "Inter", fontWeight: 400, fontSize: 12, lineHeight: "120%", color: "#1F2937", padding: 0 }}
              >
                <div dangerouslySetInnerHTML={{ __html: note.note }} />
              </div>
            </div>
          </div>

          {/* Linked Records */}
          <div className="box-border flex flex-col items-start w-full" style={{ padding: "12px 24px", gap: 14 }}>
            <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 14, lineHeight: "120%", color: "#1F2937" }}>
              Linked Records
            </span>
            <div
              className="flex flex-col items-start w-full"
              style={{ padding: 14, gap: 16, backgroundColor: "#F8FAFC", borderRadius: 14 }}
            >
              {/* Row 1: Contact / Deal */}
              <div className="flex flex-row justify-between items-center w-full" style={{ gap: 16 }}>
                <div className="flex flex-row items-center flex-1 min-w-0" style={{ gap: 12 }}>
                  <div
                    className="rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0"
                    style={{ width: 32, height: 32 }}
                  >
                    {primaryContact?.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div className="flex flex-col items-start min-w-0" style={{ gap: 4 }}>
                    <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 10, lineHeight: "120%", color: "#6B7280" }}>
                      Contact
                    </span>
                    <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 14, lineHeight: "120%", color: "#1F2937" }} className="truncate">
                      {primaryContact?.name || "—"}
                    </span>
                    <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 8, lineHeight: "120%", color: "#6B7280" }} className="truncate">
                      {primaryContact?.role || "—"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-row items-center flex-1 min-w-0" style={{ gap: 12 }}>
                  <div
                    className="rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ width: 32, height: 32, backgroundColor: "rgba(212, 170, 0, 0.1)" }}
                  >
                    <svg width="17" height="16" viewBox="0 0 17 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1.66667 15.8333C1.20833 15.8333 0.815972 15.6701 0.489583 15.3438C0.163194 15.0174 0 14.625 0 14.1667V5C0 4.54167 0.163194 4.14931 0.489583 3.82292C0.815972 3.49653 1.20833 3.33333 1.66667 3.33333H5V1.66667C5 1.20833 5.16319 0.815972 5.48958 0.489583C5.81597 0.163194 6.20833 0 6.66667 0H10C10.4583 0 10.8507 0.163194 11.1771 0.489583C11.5035 0.815972 11.6667 1.20833 11.6667 1.66667V3.33333H15C15.4583 3.33333 15.8507 3.49653 16.1771 3.82292C16.5035 4.14931 16.6667 4.54167 16.6667 5V14.1667C16.6667 14.625 16.5035 15.0174 16.1771 15.3438C15.8507 15.6701 15.4583 15.8333 15 15.8333H1.66667ZM1.66667 14.1667H15V5H1.66667V14.1667ZM6.66667 3.33333H10V1.66667H6.66667V3.33333Z" fill="#D4AA00"/>
                    </svg>
                  </div>
                  <div className="flex flex-col items-start min-w-0" style={{ gap: 4 }}>
                    <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 10, lineHeight: "120%", color: "#6B7280" }}>
                      Deal
                    </span>
                    <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 14, lineHeight: "120%", color: "#0085FF" }} className="truncate">
                      {note.company?.name || "—"}
                    </span>
                    <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 8, lineHeight: "120%", color: "#6B7280" }} className="truncate">
                      —
                    </span>
                  </div>
                </div>
              </div>

              {/* Row 2: Meeting / Invoice */}
              <div className="flex flex-row justify-between items-center w-full" style={{ gap: 16 }}>
                <div className="flex flex-row items-center flex-1 min-w-0" style={{ gap: 12 }}>
                  <div
                    className="rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ width: 32, height: 32, backgroundColor: "rgba(0, 133, 255, 0.1)" }}
                  >
                    <svg width="17" height="14" viewBox="0 0 17 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3.33333 10H10V9.54167C10 8.93056 9.69444 8.4375 9.08333 8.0625C8.47222 7.6875 7.66667 7.5 6.66667 7.5C5.66667 7.5 4.86111 7.6875 4.25 8.0625C3.63889 8.4375 3.33333 8.93056 3.33333 9.54167V10ZM6.66667 6.66667C7.125 6.66667 7.51736 6.50347 7.84375 6.17708C8.17014 5.85069 8.33333 5.45833 8.33333 5C8.33333 4.54167 8.17014 4.14931 7.84375 3.82292C7.51736 3.49653 7.125 3.33333 6.66667 3.33333C6.20833 3.33333 5.81597 3.49653 5.48958 3.82292C5.16319 4.14931 5 4.54167 5 5C5 5.45833 5.16319 5.85069 5.48958 6.17708C5.81597 6.50347 6.20833 6.66667 6.66667 6.66667ZM1.66667 13.3333C1.20833 13.3333 0.815972 13.1701 0.489583 12.8438C0.163194 12.5174 0 12.125 0 11.6667V1.66667C0 1.20833 0.163194 0.815972 0.489583 0.489583C0.815972 0.163194 1.20833 0 1.66667 0H11.6667C12.125 0 12.5174 0.163194 12.8438 0.489583C13.1701 0.815972 13.3333 1.20833 13.3333 1.66667V5.41667L16.6667 2.08333V11.25L13.3333 7.91667V11.6667C13.3333 12.125 13.1701 12.5174 12.8438 12.8438C12.5174 13.1701 12.125 13.3333 11.6667 13.3333H1.66667ZM1.66667 11.6667H11.6667V1.66667H1.66667V11.6667Z" fill="#0085FF"/>
                    </svg>
                  </div>
                  <div className="flex flex-col items-start min-w-0" style={{ gap: 4 }}>
                    <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 10, lineHeight: "120%", color: "#6B7280" }}>
                      Meeting
                    </span>
                    <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 14, lineHeight: "120%", color: "#0085FF" }} className="truncate">
                      —
                    </span>
                    <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 8, lineHeight: "120%", color: "#6B7280" }} className="truncate">
                      —
                    </span>
                  </div>
                </div>
                <div className="flex flex-row items-center flex-1 min-w-0" style={{ gap: 12 }}>
                  <div
                    className="rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ width: 32, height: 32, backgroundColor: "rgba(97, 85, 245, 0.1)" }}
                  >
                    <Landmark className="w-5 h-5" style={{ color: "#6155F5" }} />
                  </div>
                  <div className="flex flex-col items-start min-w-0" style={{ gap: 4 }}>
                    <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 10, lineHeight: "120%", color: "#6B7280" }}>
                      Invoice
                    </span>
                    <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 14, lineHeight: "120%", color: "#0085FF" }} className="truncate">
                      —
                    </span>
                    <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 10, lineHeight: "120%", color: "#6B7280" }} className="truncate">
                      —
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #E5E7EB" }} />
        <div style={{ borderTop: "1px solid #E5E7EB" }} />

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-4 flex-shrink-0">
          <button
            onClick={handleMarkComplete}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-green-200 text-green-600 text-xs font-medium hover:bg-green-50 transition-colors"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Mark As Complete
          </button>
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-full border border-red-200 text-red-500 text-xs font-medium hover:bg-red-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="ml-auto px-4 py-2 rounded-full bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};


// NoteCard component
export const NoteCard = ({ note, onEdit, onDelete, onView }) => {
  const formatFullDate = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString([], {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

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
    <div
      className="bg-white hover:border-blue-200 transition-all group relative flex flex-col items-start overflow-hidden"
      style={{
        width: "100%",
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
          <path d="M58.0872 23.5066L53.5122 28.0816V17.2H32.9247V28.6375H21.4872V53.8H53.5122V47.4934L58.0872 42.9184V56.1058C58.0866 56.7078 57.847 57.285 57.4211 57.7105C56.9951 58.136 56.4177 58.375 55.8157 58.375H19.1837C18.8833 58.3729 18.5862 58.3117 18.3095 58.1948C18.0327 58.0779 17.7817 57.9076 17.5708 57.6937C17.3599 57.4798 17.1932 57.2264 17.0801 56.9481C16.9671 56.6698 16.9101 56.3719 16.9122 56.0715V26.35L30.644 12.625H55.7951C57.0578 12.625 58.0872 13.6658 58.0872 14.8942V23.5066ZM59.8668 28.196L63.1014 31.4328L45.3092 49.225L42.0701 49.2204L42.0747 45.9905L59.8668 28.1983V28.196Z" fill="url(#noteCardIconGradient)" />
          <defs>
            <linearGradient id="noteCardIconGradient" x1="41.7768" y1="12.625" x2="41.7768" y2="58.375" gradientUnits="userSpaceOnUse">
              <stop stopColor="#0085FF" />
              <stop offset="0.95343" stopColor="white" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div
        className="flex flex-col items-start w-full"
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

          <p
            className="line-clamp-3 w-full"
            style={{ fontFamily: "Inter", fontWeight: 400, fontSize: 12, lineHeight: "120%", color: "#525866" }}
          >
            {getPreviewText(note.note)}
          </p>
        </div>

        <div
          className="flex items-center justify-between w-full"
          style={{ marginTop: 20 }}
        >
          <div className="flex items-center" style={{ gap: 12 }}>
            <div
              className="rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-semibold text-gray-600 flex-shrink-0"
              style={{ width: 20, height: 20 }}
            >
              {(typeof note.user === "object" ? note.user?.name : null)?.charAt(0)?.toUpperCase() || "?"}
            </div>
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
        note={viewingNote}
        onEdit={handleEdit}
        onDelete={handleDelete}
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
