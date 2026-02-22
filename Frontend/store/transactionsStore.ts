import { create } from "zustand";
import { useAuthStore } from "@/store/authStore";

/** Tek kaynak: GET /transactions/me sonucu ve unread count'lar. */
export interface TransactionsState {
  /** Ham liste (Geçmişim sayfasında kullanılır). */
  transactionsMe: unknown[];
  /** Bana gelen bekleyen evrak sayısı: toUserId === meId && status === "PENDING" */
  pendingForMeCount: number;
  /** Backend'ten gelen okunmamış sayıları (kalıcı). */
  unreadIncomingCount: number;
  unreadReturnedCount: number;
  unreadRejectedCount: number;
  /** Mevcut kullanıcı ID (filtre için). */
  meId: string | null;
  /** İlk fetch / refresh devam ediyor mu. */
  loading: boolean;
  /** Badge için: pendingForMeCount yükleniyor mu. */
  isPendingCountLoading: boolean;
  /** Fetch hatası. */
  error: string;

  /** API yanıtından state güncelle. */
  setFromResponse: (
    data:
      | unknown[]
      | { transactions: unknown[]; unreadIncomingCount?: number; unreadReturnedCount?: number; unreadRejectedCount?: number },
    meId: string
  ) => void;

  /** GET /transactions/me çağrısı yap, sonucu güncelle. Tek fetch yeri. */
  refresh: (
    getToken: () => string | null,
    meId: string,
    source?: "polling" | "action"
  ) => Promise<void>;

  /** Arka planda sessiz yenileme - loading flag'leri değiştirmez. */
  refreshSilent: (getToken: () => string | null, meId: string) => Promise<void>;

  /** Logout / token yok. */
  clear: () => void;

  /** PATCH /transactions/mark-seen - Sekme açıldığında okundu işaretle. */
  markSeen: (getToken: () => string | null, tab: "INCOMING" | "IADE" | "RED") => Promise<void>;

  /** Lokal güncelleme: Kabul/Red/İade sonrası mevcut tx'i güncelle (update modeli). */
  acceptTransactionLocally: (txId: string) => void;
  rejectTransactionLocally: (txId: string) => void;
  returnTransactionLocally: (txId: string) => void;

  /** Lokal güncelleme: Arşivleme sonrası evrak document bilgisini güncelle. */
  archiveTransactionLocally: (documentNumber: string) => void;

  /** Lokal güncelleme: Yeni zimmet (assign) sonrası tx ekle. */
  addTransactionLocally: (tx: unknown) => void;
}

function computePendingForMe(data: unknown[], meId: string): number {
  if (!Array.isArray(data)) return 0;
  return data.filter((t: unknown) => {
    const x = t as { toUser?: { id?: string }; toUserId?: string; status?: string };
    return (x.toUser?.id === meId || x.toUserId === meId) && x.status === "PENDING";
  }).length;
}

export const useTransactionsStore = create<TransactionsState>((set, get) => ({
  transactionsMe: [],
  pendingForMeCount: 0,
  unreadIncomingCount: 0,
  unreadReturnedCount: 0,
  unreadRejectedCount: 0,
  meId: null,
  loading: true,
  isPendingCountLoading: true,
  error: "",

  setFromResponse: (
    data: unknown[] | { transactions: unknown[]; unreadIncomingCount?: number; unreadReturnedCount?: number; unreadRejectedCount?: number },
    meId: string
  ) => {
    const isObject = data && typeof data === "object" && !Array.isArray(data) && "transactions" in data;
    const list = isObject ? (Array.isArray(data.transactions) ? data.transactions : []) : (Array.isArray(data) ? data : []);
    const pendingForMeCount = computePendingForMe(list, meId);
    const unreadIncomingCount = isObject && typeof (data as { unreadIncomingCount?: number }).unreadIncomingCount === "number"
      ? (data as { unreadIncomingCount: number }).unreadIncomingCount
      : 0;
    const unreadReturnedCount = isObject && typeof (data as { unreadReturnedCount?: number }).unreadReturnedCount === "number"
      ? (data as { unreadReturnedCount: number }).unreadReturnedCount
      : 0;
    const unreadRejectedCount = isObject && typeof (data as { unreadRejectedCount?: number }).unreadRejectedCount === "number"
      ? (data as { unreadRejectedCount: number }).unreadRejectedCount
      : 0;
    set({
      transactionsMe: list,
      pendingForMeCount,
      unreadIncomingCount,
      unreadReturnedCount,
      unreadRejectedCount,
      meId,
      loading: false,
      isPendingCountLoading: false,
      error: "",
    });
  },

  refresh: async (getToken, meId, source = "action") => {
    const token = getToken();
    if (!token) return;

    const isPolling = source === "polling";

    if (!isPolling) {
      set({ loading: true, isPendingCountLoading: true });
    }
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/transactions/me`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.status === 401) {
        useAuthStore.getState().logout();
        if (!isPolling) {
          set({ loading: false, isPendingCountLoading: false });
        }
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? "Hata");

      if (isPolling) {
        const list = data?.transactions ?? (Array.isArray(data) ? data : []);
        const pendingForMeCount = computePendingForMe(list, meId);
        set({
          transactionsMe: list,
          pendingForMeCount,
          unreadIncomingCount: data?.unreadIncomingCount ?? 0,
          unreadReturnedCount: data?.unreadReturnedCount ?? 0,
          unreadRejectedCount: data?.unreadRejectedCount ?? 0,
          isPendingCountLoading: false,
        });
      } else {
        get().setFromResponse(data, meId);
      }
    } catch {
      if (isPolling) {
        set({ isPendingCountLoading: false });
      } else {
        set({
          transactionsMe: [],
          pendingForMeCount: 0,
          unreadIncomingCount: 0,
          unreadReturnedCount: 0,
          unreadRejectedCount: 0,
          meId,
          loading: false,
          isPendingCountLoading: false,
          error: "Veriler yüklenemedi.",
        });
      }
    }
  },

  refreshSilent: async (getToken, meId) => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/transactions/me`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.status === 401) return;
      const data = await res.json();
      if (!res.ok) return;
      const isObject = data && typeof data === "object" && "transactions" in data;
      const list = isObject ? (data.transactions ?? []) : (Array.isArray(data) ? data : []);
      const pendingForMeCount = computePendingForMe(list, meId);
      const unreadIncomingCount = isObject && typeof data.unreadIncomingCount === "number" ? data.unreadIncomingCount : 0;
      const unreadReturnedCount = isObject && typeof data.unreadReturnedCount === "number" ? data.unreadReturnedCount : 0;
      const unreadRejectedCount = isObject && typeof data.unreadRejectedCount === "number" ? data.unreadRejectedCount : 0;
      set({
        transactionsMe: list,
        pendingForMeCount,
        unreadIncomingCount,
        unreadReturnedCount,
        unreadRejectedCount,
      });
    } catch {
      // silent fail
    }
  },

  clear: () => {
    set({
      transactionsMe: [],
      pendingForMeCount: 0,
      unreadIncomingCount: 0,
      unreadReturnedCount: 0,
      unreadRejectedCount: 0,
      meId: null,
      loading: false,
      isPendingCountLoading: false,
      error: "",
    });
  },

  /** PATCH /transactions/mark-seen - Sekme açıldığında backend'e bildir. */
  markSeen: async (
    getToken: () => string | null,
    tab: "INCOMING" | "IADE" | "RED"
  ) => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/transactions/mark-seen?tab=${tab}`,
        { method: "PATCH", headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return;
      if (tab === "INCOMING") set({ unreadIncomingCount: 0 });
      else if (tab === "IADE") set({ unreadReturnedCount: 0 });
      else if (tab === "RED") set({ unreadRejectedCount: 0 });
    } catch {
      // silent fail
    }
  },

  acceptTransactionLocally: (txId) => {
    const { transactionsMe, meId, unreadIncomingCount } = get();
    if (!Array.isArray(transactionsMe) || !meId) return;
    const list = transactionsMe.map((t: unknown) => {
      const x = t as { id?: string };
      if (x.id !== txId) return t;
      return Object.assign({}, t, { status: "ACCEPTED", isActiveForMe: true });
    });
    set({
      transactionsMe: list,
      pendingForMeCount: computePendingForMe(list, meId),
      unreadIncomingCount: Math.max(0, unreadIncomingCount - 1),
    });
  },

  rejectTransactionLocally: (txId) => {
    const { transactionsMe, meId, unreadIncomingCount } = get();
    if (!Array.isArray(transactionsMe) || !meId) return;
    const list = transactionsMe.map((t: unknown) => {
      const x = t as { id?: string };
      if (x.id !== txId) return t;
      return Object.assign({}, t, { status: "REJECTED" });
    });
    set({
      transactionsMe: list,
      pendingForMeCount: computePendingForMe(list, meId),
      unreadIncomingCount: Math.max(0, unreadIncomingCount - 1),
    });
  },

  returnTransactionLocally: (txId) => {
    const { transactionsMe } = get();
    if (!Array.isArray(transactionsMe)) return;
    const list = transactionsMe.map((t: unknown) => {
      const x = t as { id?: string };
      if (x.id !== txId) return t;
      return Object.assign({}, t, { status: "RETURNED", isActiveForMe: false });
    });
    set({ transactionsMe: list });
  },

  archiveTransactionLocally: (documentNumber: string) => {
    const { transactionsMe, meId } = get();
    if (!Array.isArray(transactionsMe)) return;
    const now = new Date().toISOString();
    const list = transactionsMe.map((t: unknown) => {
      const x = t as { documentNumber?: string; document?: Record<string, unknown> };
      if (x.documentNumber !== documentNumber) return t;
      return Object.assign({}, t, {
        document: Object.assign({}, x.document ?? {}, {
          status: "ARCHIVED",
          archivedAt: now,
          archivedByUserId: meId ?? undefined,
        }),
      });
    });
    set({ transactionsMe: list });
  },

  addTransactionLocally: (tx: unknown) => {
    const { transactionsMe, meId } = get();
    if (!Array.isArray(transactionsMe) || !tx || !meId) return;
    const list = [...transactionsMe, tx];
    const pendingForMeCount = computePendingForMe(list, meId);
    set({ transactionsMe: list, pendingForMeCount });
  },
}));
