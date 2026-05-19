import { create } from "zustand";
import { ApiClientError, isSupabaseConfigured, searchAItems } from "@/lib/api";
import { fetchMockSearch } from "@/lib/mockData";
import type { ReportItem, SearchFilters, SearchResponseData } from "@/lib/types";

interface SearchState {
  isSearching: boolean;
  hasSearched: boolean;
  query: string;
  filters: SearchFilters;
  response: SearchResponseData | null;
  // Epoch ms when `response` was last populated. Used by the settings page to
  // surface "N분 전" sync recency without a separate probe endpoint.
  lastSearchedAt: number | null;
  selectedItem: ReportItem | null;
  errorMessage: string | null;
  usedMock: boolean;

  setQuery: (query: string) => void;
  setFilters: (filters: SearchFilters) => void;
  performSearch: () => Promise<void>;
  setSelectedItem: (item: ReportItem | null) => void;
  resetSearch: () => void;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  isSearching: false,
  hasSearched: false,
  query: "",
  filters: {},
  response: null,
  lastSearchedAt: null,
  selectedItem: null,
  errorMessage: null,
  usedMock: false,

  setQuery: (query) => set({ query }),
  setFilters: (filters) => set({ filters }),

  performSearch: async () => {
    const { query, filters } = get();
    set({
      isSearching: true,
      hasSearched: true,
      selectedItem: null,
      errorMessage: null,
    });

    try {
      let response: SearchResponseData;
      let usedMock = false;

      if (!isSupabaseConfigured) {
        response = await fetchMockSearch(query);
        usedMock = true;
      } else {
        response = await searchAItems({ query: query.trim() || "추천", filters });
      }

      set({
        response,
        isSearching: false,
        usedMock,
        lastSearchedAt: Date.now(),
      });
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? `[${err.code}] ${err.message}`
          : err instanceof Error
            ? err.message
            : "알 수 없는 오류가 발생했습니다.";
      console.error("[performSearch]", err);
      set({
        isSearching: false,
        response: null,
        lastSearchedAt: null,
        errorMessage: message,
      });
    }
  },

  setSelectedItem: (item) => set({ selectedItem: item }),

  resetSearch: () =>
    set({
      isSearching: false,
      hasSearched: false,
      query: "",
      filters: {},
      response: null,
      lastSearchedAt: null,
      selectedItem: null,
      errorMessage: null,
      usedMock: false,
    }),
}));
