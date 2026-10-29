import { create } from "zustand";
const useDownloadStore = create((set) => ({
  downloads: [],
  setDownloads: (downloads) => set({ downloads }),
  update: (id, data) =>
    set((state) => ({
      downloads: state.downloads.map((item) =>
        item.id === id ? { ...item, ...data } : item,
      ),
    })),
}));
export default useDownloadStore;
