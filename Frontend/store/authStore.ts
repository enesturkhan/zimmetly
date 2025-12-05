import { create } from 'zustand';

interface AuthState {
  token: string | null;
  setToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,

  setToken: (token: string) => {
    set({ token });
    localStorage.setItem("access_token", token);
  },

  logout: () => {
    set({ token: null });
    localStorage.removeItem("access_token");
  }
}));
