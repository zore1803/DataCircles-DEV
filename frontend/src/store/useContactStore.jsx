// src/store/useContactStore.js
import { create } from "zustand";

const useContactStore = create((set, get) => ({
  // 1. Filter & Pagination State
  searchTerm: "",
  activeTab: "All",
  statusFilter: "",
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
  currentContactIds: [],

  // 3. Actions
  setSearchTerm: (term) => set({ searchTerm: term }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setStatusFilter: (status) => set({ statusFilter: status }),
  setActiveFilters: (filters) => set({ activeFilters: filters }),
  setSortConfig: (config) => set({ sortConfig: config }),

  // Custom pagination updater
  setPagination: (updater) =>
    set((state) => ({
      pagination:
        typeof updater === "function" ? updater(state.pagination) : updater,
    })),

  setCurrentContactIds: (ids) => set({ currentContactIds: ids }),

  // Optional: A quick way to reset filters
  resetFilters: () =>
    set({
      searchTerm: "",
      activeTab: "All",
      statusFilter: "",
      activeFilters: [],
      pagination: { ...get().pagination, currentPage: 1 },
    }),
}));

export default useContactStore;
