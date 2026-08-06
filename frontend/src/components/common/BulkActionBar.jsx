import React from 'react';
import {
  CheckSquare,
  Download,
  Edit2,
  Square,
  Trash2,
  X,
} from 'lucide-react';

/**
 * Bulk-selection action strip, shared by every list that supports multi-select.
 *
 * Visual contract is taken from the Companies list (pages/Companies.jsx), which
 * is the reference implementation: action buttons on the left, selection count
 * and Select/Deselect All on the right, every button icon + label, `px-4 py-2`.
 * Keep the two in sync — if a button is added here, add it there too.
 *
 * Every action is optional; a button only renders when its handler is supplied,
 * so each list shows exactly the actions it actually supports.
 *
 * `isClosing` drives the exit animation. Pair it with `useBulkStrip()` from
 * hooks/useBulkSelection — the strip has to stay mounted for one animation beat
 * after the selection empties, or the slide-out never plays.
 */
const BulkActionBar = ({
  selectedCount,
  entityName = 'item',
  onSelectAll,
  onDeselectAll,
  onExport,
  onDelete,
  onUpdateStatus,
  onCancel,
  isDeleting = false,
  isClosing = false,
}) => {
  const buttonBase =
    'px-4 py-2 text-sm font-medium rounded-lg focus:outline-none transition-colors flex items-center gap-2';

  return (
    <div
      className={`${
        isClosing ? 'animate-slideOutRight' : 'animate-slideInLeft'
      } flex flex-wrap items-center justify-between gap-6 bg-blue-50 border border-blue-200 rounded-xl px-4 mb-4`}
      style={{ minHeight: 44 }}
    >
      <div className="flex flex-wrap items-center gap-3 py-2">
        {onExport && (
          <button
            onClick={onExport}
            className={`${buttonBase} bg-white border border-green-600 text-green-700 hover:bg-green-50`}
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        )}
        {onUpdateStatus && (
          <button
            onClick={onUpdateStatus}
            className={`${buttonBase} bg-blue-600 text-white hover:bg-blue-700`}
          >
            <Edit2 className="w-4 h-4" />
            Bulk Update
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className={`${buttonBase} bg-red-600 text-white hover:bg-red-700 disabled:opacity-50`}
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        )}
        {onCancel && (
          <button
            onClick={onCancel}
            className={`${buttonBase} bg-white border border-gray-300 text-gray-700 hover:bg-gray-50`}
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 py-2">
        <CheckSquare className="w-5 h-5 text-blue-600" />
        <span className="text-blue-800 font-semibold text-sm font-inter">
          {selectedCount} {entityName}
          {selectedCount !== 1 ? 's' : ''} selected
        </span>
        {onSelectAll && (
          <button
            onClick={onSelectAll}
            className={`${buttonBase} bg-white border border-gray-300 text-gray-700 hover:bg-gray-50`}
          >
            <CheckSquare className="w-4 h-4" />
            Select All
          </button>
        )}
        {onDeselectAll && (
          <button
            onClick={onDeselectAll}
            className={`${buttonBase} bg-white border border-gray-300 text-gray-700 hover:bg-gray-50`}
          >
            <Square className="w-4 h-4" />
            Deselect All
          </button>
        )}
      </div>
    </div>
  );
};

export default BulkActionBar;
