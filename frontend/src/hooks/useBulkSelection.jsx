import { useState, useCallback, useEffect } from 'react';
import { useSubscription } from '../contexts/SubscriptionContext';
import { hasMinPlan } from '../utils/subscriptionHelpers';
import UpgradeRequiredModal from '../components/subscription/UpgradeRequiredModal';

// Duration of the slide-in/slide-out animations in index.css. Kept in sync by
// hand — if those change, change this too or the strip will unmount mid-exit.
const STRIP_ANIM_MS = 300;

const BULK_SELECTION_MIN_PLAN = 'growth';

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
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Bulk row selection (and everything it unlocks — the BulkActionBar strip,
  // Ctrl+A select-all, Ctrl+Delete bulk delete) is gated to Growth+ plans.
  // Below that, every entry point here opens the upgrade modal instead of
  // actually selecting anything, rather than gating deep inside each of the
  // dozen+ tables that consume this hook.
  const { subscription } = useSubscription();
  const hasBulkAccess = hasMinPlan(subscription?.subscription?.planName, BULK_SELECTION_MIN_PLAN);

  const toggleItem = useCallback((id) => {
    if (!hasBulkAccess) {
      setShowUpgradeModal(true);
      return;
    }
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, [hasBulkAccess]);

  const clearSelection = useCallback(() => {
    setSelectedItems([]);
  }, []);

  const selectAll = useCallback((itemsList, idField = '_id') => {
    if (!hasBulkAccess) {
      setShowUpgradeModal(true);
      return;
    }
    const ids = itemsList.map((item) => item[idField]);
    setSelectedItems(ids);
  }, [hasBulkAccess]);

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

  const upgradeModal = (
    <UpgradeRequiredModal
      open={showUpgradeModal}
      onClose={() => setShowUpgradeModal(false)}
      minPlan={BULK_SELECTION_MIN_PLAN}
      feature="Selecting multiple rows"
    />
  );

  return {
    selectedItems,
    setSelectedItems,
    toggleItem,
    clearSelection,
    selectAll,
    upgradeModal,
  };
};
