import { create } from "zustand";

/** Tek kaynak: GET /transactions/me sonucu ve pendingForMeCount. */
export interface TransactionsState {
  /** Ham liste (Geçmişim sayfasında kullanılır). */
  transactionsMe: unknown[];
  /** Bana gelen bekleyen evrak sayısı: toUserId === meId && status === "PENDING" */
  pendingForMeCount: number;
  /** Mevcut kullanıcı ID (filtre için). */
  meId: string | null;
  /** İlk fetch / refresh devam ediyor mu. */
  loading: boolean;
  /** Badge için: pendingForMeCount yükleniyor mu. */
  isPendingCountLoading: boolean;
  /** Fetch hatası. */
  error: string;

  /** API yanıtından state güncelle. */
  setFromResponse: (data: unknown[], meId: string) => void;

  /** GET /transactions/me çağrısı yap, sonucu güncelle. Tek fetch yeri. */
  refresh: (
    getToken: () => string | null,
    meId: string,
    source?: "polling" | "action"
  ) => Promise<void>;

  /** Logout / token yok. */
  clear: () => void;

  /** Lokal güncelleme: Kabul işlemi sonrası tx güncelle, pendingForMeCount düşür. */
  acceptTransactionLocally: (txId: string) => void;

  /** Lokal güncelleme: Red işlemi sonrası tx güncelle, pendingForMeCount düşür. */
  rejectTransactionLocally: (txId: string) => void;

  /** Lokal güncelleme: İade işlemi sonrası tx güncelle. */
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
  meId: null,
  loading: true,
  isPendingCountLoading: true,
  error: "",

  setFromResponse: (data: unknown[], meId: string) => {
    const list = Array.isArray(data) ? data : [];
    const pendingForMeCount = computePendingForMe(list, meId);
    set({
      transactionsMe: list,
      pendingForMeCount,
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
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? "Hata");
      const list = Array.isArray(data) ? data : [];

      if (isPolling) {
        const pendingForMeCount = computePendingForMe(list, meId);
        set({ pendingForMeCount, isPendingCountLoading: false });
      } else {
        get().setFromResponse(list, meId);
      }
    } catch {
      if (isPolling) {
        set({ isPendingCountLoading: false });
      } else {
        set({
          transactionsMe: [],
          pendingForMeCount: 0,
          meId,
          loading: false,
          isPendingCountLoading: false,
          error: "Veriler yüklenemedi.",
        });
      }
    }
  },

  clear: () => {
    set({
      transactionsMe: [],
      pendingForMeCount: 0,
      meId: null,
      loading: false,
      isPendingCountLoading: false,
      error: "",
    });
  },

  acceptTransactionLocally: (txId: string) => {
    const { transactionsMe, meId } = get();
    if (!Array.isArray(transactionsMe) || !meId) return;
    const list = transactionsMe.map((t: unknown) => {
      const x = t as { id?: string };
      if (x.id !== txId) return t;
      return Object.assign({}, t, { status: "ACCEPTED", isActiveForMe: true });
    });
    const pendingForMeCount = computePendingForMe(list, meId);
    set({ transactionsMe: list, pendingForMeCount });
  },

  rejectTransactionLocally: (txId: string) => {
    const { transactionsMe, meId } = get();
    if (!Array.isArray(transactionsMe) || !meId) return;
    const list = transactionsMe.map((t: unknown) => {
      const x = t as { id?: string };
      if (x.id !== txId) return t;
      return Object.assign({}, t, { status: "REJECTED" });
    });
    const pendingForMeCount = computePendingForMe(list, meId);
    set({ transactionsMe: list, pendingForMeCount });
  },

  returnTransactionLocally: (txId: string) => {
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
