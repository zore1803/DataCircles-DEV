import { useState, useEffect } from "react";

const STORAGE_PREFIX = "column_settings_";

export const useColumnSettings = (moduleName, defaultColumns) => {
  const storageKey = `${STORAGE_PREFIX}${moduleName}`;

  const [columns, setColumns] = useState(defaultColumns);

  // Update columns when defaultColumns change (e.g., when custom fields are loaded)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        
        // Create a map of saved columns for quick lookup
        const savedColumnsMap = new Map(
          parsed.map(col => [col.key, col])
        );
        
        // Merge saved settings with current default columns
        const mergedColumns = defaultColumns.map((defaultCol) => {
          const savedCol = savedColumnsMap.get(defaultCol.key);
          
          if (savedCol) {
            // Merge saved settings but keep icon and other non-serializable props from default
            return {
              ...defaultCol,
              visible: savedCol.visible,
              order: savedCol.order,
            };
          }
          
          // New column not in saved settings - use default
          return defaultCol;
        });

        // Sort by order
        setColumns(mergedColumns.sort((a, b) => a.order - b.order));
      } else {
        // No saved settings, use defaults
        setColumns(defaultColumns);
      }
    } catch (error) {
      console.error("Failed to load column settings:", error);
      setColumns(defaultColumns);
    }
  }, [defaultColumns, storageKey]);

  const saveColumns = (newColumns) => {
    try {
      // Only save serializable properties
      const columnsToSave = newColumns.map((col) => ({
        key: col.key,
        label: col.label,
        visible: col.visible,
        order: col.order,
        sortable: col.sortable,
        required: col.required,
        isCustomField: col.isCustomField,
        type: col.type,
        defaultVisible: col.defaultVisible,
      }));
      
      localStorage.setItem(storageKey, JSON.stringify(columnsToSave));
      setColumns(newColumns);
    } catch (error) {
      console.error("Failed to save column settings:", error);
      throw error;
    }
  };

  const resetColumns = () => {
    try {
      localStorage.removeItem(storageKey);
      setColumns(defaultColumns);
    } catch (error) {
      console.error("Failed to reset column settings:", error);
    }
  };

  const getVisibleColumns = () => {
    return columns
      .filter((col) => col.visible)
      .sort((a, b) => a.order - b.order);
  };

  return {
    columns,
    saveColumns,
    resetColumns,
    getVisibleColumns,
  };
};
