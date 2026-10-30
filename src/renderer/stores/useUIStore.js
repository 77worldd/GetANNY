import { create } from "zustand";
let toastId = 0;
const useUIStore = create((set) => ({
  activeTab: "all",
  setActiveTab: (activeTab) => set({ activeTab }),
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
      mediaUrl: url,
      mediaRequest: state.mediaRequest + 1,
    })),
}));
export default useUIStore;
