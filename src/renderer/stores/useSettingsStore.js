import { create } from "zustand";
import { api } from "../api";
const useSettingsStore = create((set) => ({
  settings: {},
  setSettings: (settings) => set({ settings }),
  save: async (key, value) => {
    const settings = await api.invoke("settings:set", { key, value });
    set({ settings });
    return settings;
  },
}));
export default useSettingsStore;
