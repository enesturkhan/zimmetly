import { create } from "zustand";

// Auth state yapısı
export interface AuthState {
  token: string | null;

  // token kaydetme
  setToken: (token: string) => void;

  // token alma
  getToken: () => string | null;

  // çıkış yapma
  logout: () => void;

  // uygulama açıldığında localStorage'dan token yükleme
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,

  // Login sonrası token kaydet
  setToken: (token: string) => {
    set({ token });
    if (typeof window !== "undefined") {
      localStorage.setItem("access_token", token);
    }
  },

  // Token getter
  getToken: () => {
    const token = get().token;
    if (token) return token;

    // Eğer RAM'de yoksa localStorage'dan çek
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("access_token");
      if (saved) {
        set({ token: saved });
        return saved;
      }
    }

    return null;
  },

  // Çıkış
  logout: () => {
    set({ token: null });
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
    }
  },

  // Uygulama açılırken token yükle
  initialize: () => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("access_token");
      if (saved) set({ token: saved });
    }
  },
}));
