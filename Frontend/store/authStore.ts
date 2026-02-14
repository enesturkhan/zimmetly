import { create } from "zustand";

const TOKEN_KEY = "token";

// Auth state yapısı
export interface AuthState {
  token: string | null;

  /** token kaydetme - rememberMe: true → localStorage, false → sessionStorage */
  setToken: (token: string, rememberMe?: boolean) => void;

  /** token alma - önce localStorage, sonra sessionStorage */
  getToken: () => string | null;

  /** çıkış yapma - her iki depodan da siler */
  logout: () => void;

  /** uygulama açıldığında storage'dan token yükleme */
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,

  setToken: (token: string, rememberMe?: boolean) => {
    set({ token });
    // rememberMe undefined = sadece state güncelle (restore), storage'a dokunma
    if (typeof window === "undefined" || rememberMe === undefined) return;
    if (rememberMe) {
      localStorage.setItem(TOKEN_KEY, token);
      sessionStorage.removeItem(TOKEN_KEY);
    } else {
      sessionStorage.setItem(TOKEN_KEY, token);
      localStorage.removeItem(TOKEN_KEY);
    }
  },

  getToken: () => {
    const token = get().token;
    if (token) return token;

    if (typeof window !== "undefined") {
      const saved =
        localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
      if (saved) {
        set({ token: saved });
        return saved;
      }
    }

    return null;
  },

  logout: () => {
    set({ token: null });
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
    }
  },

  initialize: () => {
    if (typeof window !== "undefined") {
      const saved =
        localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
      if (saved) set({ token: saved });
    }
  },
}));
