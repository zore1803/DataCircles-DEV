import React, { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { ChevronDown, GripVertical, X, FileText, Plus, Trash2, Save } from 'lucide-react';
import API from '../../services/api';
import { TOKEN_DEFINITIONS, buildFilename } from '../../utils/pdfFilename';

// Purchase/Purchase Order are intentionally excluded for now — only these
// four document types' downloads actually read pdfFilenameFormats
// (PurchasePage.jsx/PurchaseOrderPage.jsx use a fixed filename instead), so
// exposing them here would let a user configure a format that's silently
// ignored.
const DOCUMENT_TYPES = [
  { id: 'tax', label: 'Invoice' },
  { id: 'quotation', label: 'Quotation' },
  { id: 'performa', label: 'Pro Forma Invoice' },
  { id: 'deliveryChallan', label: 'Delivery Challan' },
];

const PdfFileNameSettings = ({ value = {}, onChange }) => {
  const [activeType, setActiveType] = useState('tax');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // The current ordered list of tokens for the active document type
  const currentTokens = value[activeType] || [];
  
  // Definition for this specific document type
  const definitions = TOKEN_DEFINITIONS[activeType] || [];

  // Drag and drop state
  const [draggedIdx, setDraggedIdx] = useState(null);
  const dragNode = useRef();

  // This section has no other save trigger of its own — the only "Save
  // Settings" button lives in the unrelated Document Numbering form further
  // up the page. Persist directly here so edits aren't silently lost if the
  // user never scrolls up to that button (previously: added fields survived
  // only in local state and reverted to the saved default on refresh).
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await API.put('/document-settings', { pdfFilenameFormats: value });
      toast.success('PDF file name settings saved');
    } catch (err) {
      console.error('Failed to save PDF file name settings', err);
      toast.error(err.response?.data?.error || 'Failed to save PDF file name settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDragStart = (e, index) => {
    setDraggedIdx(index);
    dragNode.current = e.target;
    e.dataTransfer.effectAllowed = 'move';
    // Firefox requires data to be set
    e.dataTransfer.setData('text/html', e.target.parentNode);
    // Slight delay to allow styling the dragged element
    setTimeout(() => {
      dragNode.current.style.opacity = '0.5';
    }, 0);
  };

  const handleDragEnter = (e, targetIdx) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIdx) return;
    
    const newTokens = [...currentTokens];
    const draggedItem = newTokens.splice(draggedIdx, 1)[0];
    newTokens.splice(targetIdx, 0, draggedItem);
    
    setDraggedIdx(targetIdx);
    updateTokens(newTokens);
  };

  const handleDragEnd = () => {
    if (dragNode.current) dragNode.current.style.opacity = '1';
    setDraggedIdx(null);
    dragNode.current = null;
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // necessary to allow dropping
  };

  const updateTokens = (newTokens) => {
    onChange({
      ...value,
      [activeType]: newTokens
    });
  };

  const removeToken = (indexToRemove) => {
    const newTokens = currentTokens.filter((_, idx) => idx !== indexToRemove);
    updateTokens(newTokens);
  };

  const addToken = (tokenKey) => {
    if (currentTokens.includes(tokenKey)) return;
    updateTokens([...currentTokens, tokenKey]);
    setIsDropdownOpen(false);
  };

  // Find definitions for currently active tokens
  const activeDefinitions = currentTokens.map(key => 
    definitions.find(d => d.key === key)
  ).filter(Boolean);

  // Find available definitions (not yet used)
  const availableDefinitions = definitions.filter(d => !currentTokens.includes(d.key));

  // Build a dummy data object for the preview based on the definitions
  const previewData = {};
  definitions.forEach(d => {
    previewData[d.key] = d.example;
  });

  const preview = buildFilename(currentTokens, previewData);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mt-6 shadow-sm">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">PDF File Name</h3>
          <p className="text-xs text-gray-500 mt-1">Choose the information you want to include in downloaded PDF file names.</p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60 flex-shrink-0"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div className="p-6">
        {/* Document Type Selector */}
        <div className="mb-6 max-w-sm">
          <label className="block text-xs font-medium text-gray-700 mb-2">Document Type</label>
          <div className="relative">
            <select
              value={activeType}
              onChange={(e) => setActiveType(e.target.value)}
              className="w-full appearance-none px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow cursor-pointer"
            >
              {DOCUMENT_TYPES.map(type => (
                <option key={type.id} value={type.id}>{type.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Builder Area */}
        <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
          <label className="block text-sm font-medium text-gray-900 mb-4">
            How should your <span className="text-blue-600">{DOCUMENT_TYPES.find(t => t.id === activeType)?.label}</span> PDF be named?
          </label>
          
          <div className="flex flex-col gap-2 mb-4">
            {activeDefinitions.length === 0 ? (
              <div className="text-sm text-gray-500 italic py-2">No information selected. Defaulting to "Document.pdf"</div>
            ) : (
              activeDefinitions.map((def, idx) => (
                <div 
                  key={def.key}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragEnter={(e) => handleDragEnter(e, idx)}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-2.5 shadow-sm cursor-grab active:cursor-grabbing hover:border-blue-300 transition-colors group"
                >
                  <GripVertical className="w-4 h-4 text-gray-400 group-hover:text-blue-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-700 flex-grow select-none">{def.label}</span>
                  <button 
                    onClick={() => removeToken(idx)}
                    className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Add Information Button/Dropdown */}
          {availableDefinitions.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add information
              </button>
              
              {isDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} />
                  <div className="absolute left-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden py-1">
                    <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/50">
                      <span className="text-xs font-semibold text-gray-500">AVAILABLE INFORMATION</span>
                    </div>
                    {availableDefinitions.map(def => (
                      <button
                        key={def.key}
                        type="button"
                        onClick={() => addToken(def.key)}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                        {def.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Live Preview */}
          <div className="mt-8">
            <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Preview</label>
            <div className="flex items-center gap-2.5 px-4 py-3 bg-white border border-gray-200 rounded-lg shadow-sm">
              <FileText className="w-5 h-5 text-red-500 flex-shrink-0" />
              <span className="text-sm font-semibold text-gray-900 truncate">
                {preview}.pdf
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PdfFileNameSettings;
