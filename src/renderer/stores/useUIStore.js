import { create } from "zustand";
let toastId = 0;
const useUIStore = create((set) => ({
  activeTab: "all",
  tabHistory: [],
  setActiveTab: (activeTab) =>
    set((state) =>
      state.activeTab === activeTab
        ? { activeTab }
        : {
            activeTab,
            tabHistory: [...state.tabHistory, state.activeTab].slice(-20),
          },
    ),
  goBack: () =>
    set((state) => {
      const previous = state.tabHistory[state.tabHistory.length - 1];
      if (!previous) return {};
      return {
        activeTab: previous,
        tabHistory: state.tabHistory.slice(0, -1),
      };
    }),
  addModal: null,
  setAddModal: (addModal) => set({ addModal }),
  details: null,
  setDetails: (details) => set({ details }),
  toasts: [],
  notify: (message, type = "success") => {
    const id = ++toastId;
    set((state) => ({
      toasts: [...state.toasts.slice(-1), { id, message, type }],
    }));
    setTimeout(
      () =>
        set((state) => ({
          toasts: state.toasts.filter((toast) => toast.id !== id),
        })),
      type === "error" ? 7000 : 3500,
    );
  },
  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
  browserRequests: [],
  addRequest: (request) =>
    set((state) => ({
      browserRequests: state.browserRequests.some(
        (item) => item.id === request.id,
      )
        ? state.browserRequests
        : [...state.browserRequests, request],
    })),
  removeRequest: (id) =>
    set((state) => ({
      browserRequests: state.browserRequests.filter((item) => item.id !== id),
    })),
  mediaUrl: "",
  mediaRequest: 0,
  setMediaUrl: (mediaUrl) => set({ mediaUrl }),
  openMedia: (url) =>
    set((state) => ({
      activeTab: "media",
      tabHistory:
        state.activeTab === "media"
          ? state.tabHistory
          : [...state.tabHistory, state.activeTab].slice(-20),
      mediaUrl: url,
      mediaRequest: state.mediaRequest + 1,
    })),
}));
export default useUIStore;
