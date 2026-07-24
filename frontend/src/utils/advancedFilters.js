// Applies CompanyFilterPanel-style selections (columnKey -> array of allowed
// string values) to a list of items — an item passes a column's filter if its
// value for that column is one of the selected values (OR within a column),
// and it must pass every column that has an active selection (AND across columns).
export function applyColumnFilters(items, selected, getFieldValue) {
  const activeColumns = Object.keys(selected || {}).filter(
    (key) => selected[key] && selected[key].length > 0,
  );
  if (activeColumns.length === 0) return items;

  return items.filter((item) =>
    activeColumns.every((key) => {
      const value = String(getFieldValue(item, key) ?? "");
      return selected[key].includes(value);
    }),
  );
}

// Applies AdvancedFilterPanel-style filters (column/operator/value) to a list of items.
// getFieldValue(item, columnKey) resolves the raw value to test for a given item + column.
export function applyAdvancedFilters(items, filters, getFieldValue) {
  if (!filters || filters.length === 0) return items;

  return items.filter((item) =>
    filters.every((filter) => {
      const raw = getFieldValue(item, filter.column);
      const value = (raw ?? "").toString().toLowerCase();
      const target = (filter.value ?? "").toString().toLowerCase();

      switch (filter.operator) {
        case "contains":
          return value.includes(target);
        case "not_contains":
          return !value.includes(target);
        case "is":
          return value === target;
        case "is_not":
          return value !== target;
        case "in":
          return target
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean)
            .includes(value);
        case "not_in":
          return !target
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean)
            .includes(value);
        case "is_empty":
          return value === "";
        case "is_not_empty":
          return value !== "";
        default:
          return true;
      }
    }),
  );
}
