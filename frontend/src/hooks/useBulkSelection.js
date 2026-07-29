import { useState, useCallback, useEffect } from 'react';

// Duration of the slide-in/slide-out animations in index.css. Kept in sync by
// hand — if those change, change this too or the strip will unmount mid-exit.
const STRIP_ANIM_MS = 300;

/**
 * Keeps the bulk-action strip mounted for one animation beat after the
 * selection is cleared, so it can play its slide-out instead of disappearing
 * on the same frame.
 *
 * Render it as:
 *   const { visible, closing } = useBulkStrip(selectedItems.length);
 *   visible ? <BulkActionBar isClosing={closing} … /> : <normal toolbar />
 */
export const useBulkStrip = (selectedCount) => {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (selectedCount > 0) {
      setClosing(false);
      setVisible(true);
    } else if (visible) {
      setClosing(true);
      const t = setTimeout(() => {
        setVisible(false);
        setClosing(false);
      }, STRIP_ANIM_MS);
      return () => clearTimeout(t);
    }
  }, [selectedCount, visible]);

  return { visible, closing };
};

export const useBulkSelection = (options = {}) => {
  const { items = [], onDelete } = options;
  const [selectedItems, setSelectedItems] = useState([]);

  const toggleItem = useCallback((id) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedItems([]);
  }, []);

  const selectAll = useCallback((itemsList, idField = '_id') => {
    const ids = itemsList.map((item) => item[idField]);
    setSelectedItems(ids);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.target.isContentEditable) return;

      if (e.key === "Escape" && selectedItems.length > 0) {
        clearSelection();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        if (items && items.length > 0) {
          e.preventDefault();
          selectAll(items);
        }
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === "Delete" || e.key === "Backspace")) {
        if (selectedItems.length > 0 && onDelete) {
          e.preventDefault();
          onDelete();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [items, selectedItems, clearSelection, selectAll, onDelete]);

  return {
    selectedItems,
    setSelectedItems,
    toggleItem,
    clearSelection,
    selectAll,
  };
};
