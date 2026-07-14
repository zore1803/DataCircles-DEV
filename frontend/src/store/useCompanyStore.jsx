// src/store/useCompanyStore.js
import { create } from "zustand";

const useCompanyStore = create((set, get) => ({
  // 1. Filter & Pagination State
  searchTerm: "",
  filterIndustry: "",
  activeFilters: [],
  sortConfig: { key: "name", direction: "asc" },
  pagination: {
    currentPage: 1,
    totalPages: 0,
    totalCount: 0,
    limit: 10,
    hasNextPage: false,
    hasPrevPage: false,
  },

  // 2. Navigation State (Stores the IDs of the filtered results)
  currentCompanyIds: [],

  // 3. Actions
  setSearchTerm: (term) => set({ searchTerm: term }),
  setFilterIndustry: (industry) => set({ filterIndustry: industry }),
  setActiveFilters: (filters) => set({ activeFilters: filters }),
  setSortConfig: (config) => set({ sortConfig: config }),

  // Custom pagination updater to handle previous state logic easily
  setPagination: (updater) =>
    set((state) => ({
      pagination:
        typeof updater === "function" ? updater(state.pagination) : updater,
    })),

  setCurrentCompanyIds: (ids) => set({ currentCompanyIds: ids }),

  // Optional: A quick way to reset filters
  resetFilters: () =>
    set({
      searchTerm: "",
      filterIndustry: "",
      activeFilters: [],
      pagination: { ...get().pagination, currentPage: 1 },
    }),
}));

export default useCompanyStore;
