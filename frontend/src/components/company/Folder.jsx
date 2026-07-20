import React, { useState, useEffect, useCallback } from "react";
import API from "../../services/api";
import { useParams } from "react-router-dom";
import toast from 'react-hot-toast';
import {
  Folder as FolderIcon,
  File,
  ChevronDown,
  ChevronRight,
  Upload,
  Plus,
  Edit2,
  Trash2,
  Download,
  Search,
  Filter,
  X,
  Link as LinkIcon,
  ExternalLink
} from "lucide-react";
import AppToaster from "../AppToaster";

const SlidersIcon = ({ size = 14, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M1.66667 2.91667C1.66667 2.22631 2.22631 1.66667 2.91667 1.66667C3.60702 1.66667 4.16667 2.22631 4.16667 2.91667C4.16667 3.60703 3.60702 4.16667 2.91667 4.16667C2.22631 4.16667 1.66667 3.60703 1.66667 2.91667ZM2.91667 0C1.30583 0 0 1.30583 0 2.91667C0 4.5275 1.30583 5.83333 2.91667 5.83333C4.5275 5.83333 5.83333 4.5275 5.83333 2.91667C5.83333 1.30583 4.5275 0 2.91667 0ZM7.5 3.75H14.1667V2.08333H7.5V3.75ZM10.8333 11.25C10.8333 10.5597 11.393 10 12.0833 10C12.7737 10 13.3333 10.5597 13.3333 11.25C13.3333 11.9403 12.7737 12.5 12.0833 12.5C11.393 12.5 10.8333 11.9403 10.8333 11.25ZM12.0833 8.33333C10.4725 8.33333 9.16667 9.63917 9.16667 11.25C9.16667 12.8608 10.4725 14.1667 12.0833 14.1667C13.6942 14.1667 15 12.8608 15 11.25C15 9.63917 13.6942 8.33333 12.0833 8.33333ZM0.833333 10.4167V12.0833H7.5V10.4167H0.833333Z" fill="#1F2937" />
  </svg>
);

const DragDropZone = ({ onFileDrop, isActive, children }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFileDrop(files);
    }
  }, [onFileDrop]);

  if (!isActive) {
    return <div>{children}</div>;
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`relative ${isDragOver ? 'bg-gray-50 border-gray-300' : ''}`}
    >
      {children}
      {isDragOver && (
        <div className="absolute inset-0 bg-gray-50 bg-opacity-95 border-2 border-dashed border-gray-400 rounded-lg flex items-center justify-center z-50">
          <div className="text-center p-6">
            <Upload className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-900 font-semibold text-sm">Drop files here</p>
            <p className="text-gray-600 text-xs mt-1">Release to upload</p>
          </div>
        </div>
      )}
    </div>
  );
};

const FileCard = ({ file, onView, onDelete }) => {
  const isLink = file.isLink;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-2 hover:border-gray-300 transition-all group">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isLink ? (
            <LinkIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
          ) : (
            <File className="w-4 h-4 text-gray-400 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate" title={file.fileName}>
              {file.fileName}
            </p>
            <p className="text-xs text-gray-500">
              {isLink ? 'Link' : file.fileType?.split('/')[1]?.toUpperCase() || 'File'} • {new Date(file.uploadedAt || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
          <button
            onClick={() => onView(file)}
            className="p-1 text-gray-600 hover:text-gray-900 transition-colors"
            title={isLink ? "Open link" : "Download"}
          >
            {isLink ? <ExternalLink className="w-3 h-3" /> : <Download className="w-3 h-3" />}
          </button>
          <button
            onClick={() => onDelete(file)}
            className="p-1 text-red-600 hover:text-red-900 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

const FolderCard = ({ folder, expanded, onToggle, onEdit, onDelete, onSelect, onDeleteFile }) => (
  <div className="bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-all">
    <div className="p-3">
      <div className="flex items-center justify-between gap-2">
        <div
          className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
          onClick={() => onToggle(folder._id)}
        >
          {expanded ? (
            <ChevronDown className="w-3 h-3 text-gray-500 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-gray-500 flex-shrink-0" />
          )}
          <FolderIcon className="w-4 h-4 text-gray-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900 truncate">{folder.name}</h3>
            <p className="text-xs text-gray-500">
              {folder.files?.length || 0} {folder.files?.length === 1 ? 'item' : 'items'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onSelect(folder._id)}
            className="p-1 text-gray-600 hover:text-gray-900 rounded transition-colors"
            title="Add files/links"
          >
            <Plus className="w-3 h-3" />
          </button>
          <button
            onClick={() => onEdit(folder)}
            className="p-1 text-gray-600 hover:text-gray-900 rounded transition-colors"
            title="Rename"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          <button
            onClick={() => onDelete(folder._id)}
            className="p-1 text-gray-600 hover:text-gray-900 rounded transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
    {expanded && (
      <div className="border-t border-gray-200 p-3 bg-gray-50">
        {folder.files?.length > 0 ? (
          <div className="space-y-2">
            {folder.files.map((file, idx) => (
              <FileCard
                key={idx}
                file={file}
                onView={(file) => {
                  if (file.isLink) {
                    window.open(file.fileUrl, '_blank', 'noopener,noreferrer');
                  } else {
                    window.open(`${file.fileUrl}`, '_blank');
                  }
                }}
                onDelete={(file) => onDeleteFile(folder._id, file)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <File className="w-6 h-6 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-xs">No files yet</p>
          </div>
        )}
      </div>
    )}
  </div>
);

const CreateFolderModal = ({ isOpen, onClose, onSubmit, onDelete, initialName = "" }) => {
  const [name, setName] = useState(initialName);
  const [isSliding, setIsSliding] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setName(initialName);
      setTimeout(() => setIsSliding(true), 10);
    } else {
      setIsSliding(false);
      setTimeout(() => setShouldRender(false), 300);
    }
  }, [isOpen, initialName]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim());
      setName("");
      onClose();
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
      onClose();
    }
  };

  if (!shouldRender) return null;

  return (
    <div className={`fixed inset-0 z-[10001] flex items-center justify-center p-4 transition-all duration-300 ${isSliding ? "opacity-100" : "opacity-0"}`}>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden relative z-10 transform transition-all duration-300 ${isSliding ? "scale-100 translate-y-0" : "scale-95 translate-y-4"}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">
            {initialName ? 'Rename Folder' : 'Add New Folder'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Content */}
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Folder Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter Folder Name"
                className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50/50 focus:bg-white focus:border-blue-500 transition-all focus:outline-none text-sm text-gray-600"
                autoFocus
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-3">
            {initialName && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-all border border-gray-100 bg-white mr-auto"
                title="Delete Folder"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-semibold shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!name.trim()}
            >
              {initialName ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AddLinkModal = ({ isOpen, onClose, onSubmit }) => {
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (linkName.trim() && linkUrl.trim()) {
      onSubmit({ name: linkName.trim(), url: linkUrl.trim() });
      setLinkName("");
      setLinkUrl("");
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-4 w-full max-w-md border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900">Add Link</h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              placeholder="e.g., Project Documentation"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              URL
            </label>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com/document"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-800 text-sm transition-colors"
            >
              Add Link
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Folder = ({ companyId: propCompanyId }) => {
  const { id: paramCompanyId } = useParams();
  const companyId = propCompanyId || paramCompanyId;
  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [newFiles, setNewFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [refresh, setRefresh] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [uploadMode, setUploadMode] = useState("file"); // "file" or "link"
  const [modalState, setModalState] = useState({
    isOpen: false,
    editingId: null,
    initialName: "",
  });
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  useEffect(() => {
    fetchFolders();
  }, [companyId, refresh]);

  const fetchFolders = async () => {
    try {
      const res = await API.get("/folders", {
        params: { companyId },
      });
      setFolders(res.data || []);
    } catch (err) {
      toast.error("Failed to fetch folders");
    }
  };

  const handleModalSubmit = async (name) => {
    if (modalState.editingId) {
      await renameFolder(modalState.editingId, name);
    } else {
      await createFolder(name);
    }
  };

  const createFolder = async (name) => {
    try {
      await API.post("/folders", {
        name,
        company: companyId,
      });
      setRefresh(!refresh);
      toast.success("Folder created");
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Failed to create folder");
      }
    }
  };

  const renameFolder = async (folderId, name) => {
    try {
      await API.put(`/folders/${folderId}`, { name });
      setRefresh(!refresh);
      toast.success("Folder renamed");
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Failed to rename folder");
      }
    }
  };

  const deleteFolder = async (folderId) => {
    if (window.confirm("Delete this folder and all its contents?")) {
      try {
        await API.delete(`/folders/${folderId}`);
        setRefresh(!refresh);
        toast.success("Folder deleted");
      } catch (err) {
        if (err.response?.status === 402) {
          toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
        } else {
          toast.error(err.response?.data?.error || "Failed to delete folder");
        }
      }
    }
  };

  const deleteFile = async (folderId, file) => {
    if (window.confirm(`Delete "${file.fileName}"?`)) {
      try {
        await API.delete(`/folders/${folderId}/files`, {
          data: { fileName: file.fileName, fileUrl: file.fileUrl },
        });
        setRefresh(!refresh);
        toast.success("File deleted");
      } catch (err) {
        if (err.response?.status === 402) {
          toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
        } else {
          toast.error(err.response?.data?.error || "Failed to delete file");
        }
      }
    }
  };

  const handleFileDrop = useCallback(
    (files) => {
      if (!selectedFolderId) {
        toast.error("Select a folder first");
        return;
      }
      setNewFiles(files);
      handleUpload(files);
    },
    [selectedFolderId],
  );

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setNewFiles(files);
  };

  const handleUpload = async (files = newFiles) => {
    if (!selectedFolderId) {
      toast.error("Select a folder");
      return;
    }
    if (files.length === 0) {
      toast.error("Select files to upload");
      return;
    }

    const formData = new FormData();
    formData.append("folder", "company");
    formData.append("folderId", selectedFolderId);
    files.forEach((file) => formData.append("files", file));

    try {
      setUploading(true);
      await API.post("/folders/upload", formData);
      setNewFiles([]);
      setRefresh(!refresh);
      toast.success(`${files.length} file(s) uploaded`);
    } catch (err) {
      console.log(err);
      toast.error(err.response?.data?.error);
    } finally {
      setUploading(false);
    }
  };

  const handleAddLink = async ({ name, url }) => {
    if (!selectedFolderId) {
      toast.error("Select a folder");
      return;
    }

    try {
      await API.post("/folders/add-link", {
        folderId: selectedFolderId,
        fileName: name,
        fileUrl: url,
      });
      setRefresh(!refresh);
      toast.success("Link added");
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error(err.response?.data?.message || "An active subscription is required to make changes.");
      } else {
        toast.error(err.response?.data?.error || "Failed to add link");
      }
    }
  };

  const toggleFolder = (folderId) => {
    setExpandedFolders((prev) =>
      prev.includes(folderId)
        ? prev.filter((id) => id !== folderId)
        : [...prev, folderId],
    );
  };

  const filteredFolders = folders.filter((folder) =>
    folder.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const selectedFolder = folders.find((f) => f._id === selectedFolderId);

  return (
    <DragDropZone
      onFileDrop={handleFileDrop}
      isActive={!!selectedFolderId && uploadMode === "file"}
    >
      <div className="h-full">
        <AppToaster />

        {/* Search + Controls */}
        <div className="flex items-center gap-4 mb-4" style={{ height: "44px" }}>
          <div className="relative flex-1 h-full">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-900 opacity-50 w-5 h-5" />
            <input
              type="text"
              placeholder="Search folder by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-full pl-10 pr-3.5 border rounded-full text-sm focus:outline-none focus:border-blue-300"
              style={{ borderColor: "rgba(31, 41, 55, 0.1)" }}
            />
          </div>
          <button
            className="flex items-center justify-center gap-2 px-3 text-sm font-medium text-gray-800 bg-white border rounded-full hover:bg-gray-50 flex-shrink-0"
            style={{ height: "44px", borderColor: "#E1E4EA" }}
          >
            <SlidersIcon size={16} />
            Filter
          </button>
          <button
            onClick={() =>
              setModalState({ isOpen: true, editingId: null, initialName: "" })
            }
            className="flex items-center justify-center rounded-full border hover:bg-gray-50 flex-shrink-0"
            style={{ width: "44px", height: "44px", borderColor: "#E1E4EA" }}
            title="New Folder"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Upload Section */}
        {selectedFolderId && (
          <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Add to: {selectedFolder?.name}
                </p>
                <p className="text-xs text-gray-600">
                  Upload files or add links
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedFolderId("");
                  setNewFiles([]);
                  setUploadMode("file");
                }}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Toggle */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setUploadMode("file")}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  uploadMode === "file"
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <Upload className="w-4 h-4" />
                Upload Files
              </button>
              <button
                onClick={() => {
                  setUploadMode("link");
                  setLinkModalOpen(true);
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  uploadMode === "link"
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <LinkIcon className="w-4 h-4" />
                Add Link
              </button>
            </div>

            {uploadMode === "file" && (
              <div className="space-y-3">
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="block w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer"
                />

                {newFiles.length > 0 && (
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-xs font-medium text-gray-900 mb-1">
                      {newFiles.length} file(s) selected
                    </p>
                    {newFiles.slice(0, 2).map((file, idx) => (
                      <p key={idx} className="text-xs text-gray-600 truncate">
                        {file.name}
                      </p>
                    ))}
                    {newFiles.length > 2 && (
                      <p className="text-xs text-gray-500">
                        +{newFiles.length - 2} more
                      </p>
                    )}
                  </div>
                )}

                <button
                  onClick={() => handleUpload()}
                  disabled={uploading || newFiles.length === 0}
                  className="w-full px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Folders List */}
        {filteredFolders.length === 0 ? (
          <button
            onClick={() =>
              setModalState({
                isOpen: true,
                editingId: null,
                initialName: "",
              })
            }
            className="flex flex-col items-center justify-center w-full min-h-[300px] bg-gray-50 border border-gray-200 rounded-xl text-gray-500 hover:text-blue-600 hover:border-blue-200 transition-colors"
          >
            <FolderIcon className="w-7 h-7 mb-2" />
            <span className="text-sm font-medium">Create New Folder</span>
          </button>
        ) : (
          <div className="space-y-3">
            {filteredFolders.map((folder) => (
              <FolderCard
                key={folder._id}
                folder={folder}
                expanded={expandedFolders.includes(folder._id)}
                onToggle={toggleFolder}
                onEdit={(folder) =>
                  setModalState({
                    isOpen: true,
                    editingId: folder._id,
                    initialName: folder.name,
                  })
                }
                onDelete={deleteFolder}
                onSelect={setSelectedFolderId}
                onDeleteFile={deleteFile}
              />
            ))}
          </div>
        )}

        <CreateFolderModal
          isOpen={modalState.isOpen}
          onClose={() =>
            setModalState({ isOpen: false, editingId: null, initialName: "" })
          }
          onSubmit={handleModalSubmit}
          onDelete={() => deleteFolder(modalState.editingId)}
          initialName={modalState.initialName}
        />

        <AddLinkModal
          isOpen={linkModalOpen}
          onClose={() => setLinkModalOpen(false)}
          onSubmit={handleAddLink}
        />
      </div>
    </DragDropZone>
  );
};

export default Folder;
