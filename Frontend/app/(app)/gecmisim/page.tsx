"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useTransactionsStore } from "@/store/transactionsStore";
import { Loader2, Archive, FileText, ChevronDown, ChevronUp, Lock, Check, X, Inbox, Package, Send, RotateCcw, Ban, ArchiveIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toUserFriendlyError } from "@/lib/errorMessages";
import { FormattedDate } from "@/components/FormattedDate";
import { Timeline } from "@/components/Timeline";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { TimelineModal } from "@/components/TimelineModal";
import type { TimelineEvent } from "@/components/Timeline";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

/* ================= TYPES ================= */

type Role = "ADMIN" | "USER";

type Me = {
  id: string;
  fullName: string;
  role: Role;
};

type TxStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "RETURNED"
  | "CANCELLED"
  | string;

type TxItem = {
  id: string;
  documentNumber: string;
  status: TxStatus;
  kind?: "NORMAL" | "RETURN_REQUEST";
  createdAt: string;
  note?: string;
  fromUser?: { id: string; fullName: string };
  toUser?: { id: string; fullName: string };
  fromUserId?: string;
  toUserId?: string;
  document?: {
    status?: string;
    archivedAt?: string | null;
    archivedByUserId?: string | null;
  };
  isActiveForMe?: boolean;
};

/** Evrak bazlı tek kart: documentNumber, en son tx ve tüm geçmiş (ASC). */
type DocCard = {
  documentNumber: string;
  lastTx: TxItem;
  history: TxItem[];
};

type UserOption = {
  id: string;
  fullName: string;
  department?: string | null;
};

type TabKey = "incoming" | "accepted" | "sent" | "returned" | "rejected" | "archived";
type ReturnSubTab = "toMe" | "byMe";
type RejectSubTab = "toMe" | "byMe";

/* ================= HELPERS ================= */

function statusLabelTR(status?: string) {
  switch (status) {
    case "PENDING":
      return "Beklemede";
    case "ACCEPTED":
      return "Kabul Edildi";
    case "REJECTED":
      return "Reddedildi";
    case "RETURNED":
      return "İade";
    case "CANCELLED":
      return "İptal";
    default:
      return status || "-";
  }
}

function statusVariant(
  status?: string
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "ACCEPTED") return "default";
  if (status === "PENDING") return "secondary";
  if (status === "REJECTED" || status === "CANCELLED") return "destructive";
  return "outline";
}

/* ================= PAGE ================= */

const TAB_PARAM_MAP: Record<string, TabKey> = {
  INCOMING: "incoming",
  KABUL: "accepted",
  IADE: "returned",
  RED: "rejected",
  ACCEPTED: "accepted",
  RETURNED: "returned",
  REJECTED: "rejected",
  ARCHIVED: "archived",
  SENT: "sent",
};

export default function GecmisimPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const getToken = useAuthStore((s: any) => s.getToken);
  const transactionsMe = useTransactionsStore((s) => s.transactionsMe);
  const loading = useTransactionsStore((s) => s.loading);
  const storeError = useTransactionsStore((s) => s.error);
  const acceptTransactionLocally = useTransactionsStore((s) => s.acceptTransactionLocally);
  const rejectTransactionLocally = useTransactionsStore((s) => s.rejectTransactionLocally);
  const returnTransactionLocally = useTransactionsStore((s) => s.returnTransactionLocally);
  const archiveTransactionLocally = useTransactionsStore((s) => s.archiveTransactionLocally);
  const addTransactionLocally = useTransactionsStore((s) => s.addTransactionLocally);
  const refresh = useTransactionsStore((s) => s.refresh);
  const markSeen = useTransactionsStore((s) => s.markSeen);
  const unreadIncomingCount = useTransactionsStore((s) => s.unreadIncomingCount);
  const unreadReturnedCount = useTransactionsStore((s) => s.unreadReturnedCount);
  const unreadRejectedCount = useTransactionsStore((s) => s.unreadRejectedCount);

  const [me, setMe] = useState<Me | null>(null);
  // Local state for instant UI updates (synced with store)
  const [localTransactions, setLocalTransactions] = useState<TxItem[]>([]);
  
  // Sync localTransactions with store - yeni işlem geldiğinde anında UI'ya düşer
  useEffect(() => {
    const storeItems = (Array.isArray(transactionsMe) ? transactionsMe : []) as TxItem[];
    setLocalTransactions(storeItems);
  }, [transactionsMe]);

  const items = localTransactions;
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [archiveTx, setArchiveTx] = useState<TxItem | null>(null);
  const [archiveNote, setArchiveNote] = useState("");
  const [archiveError, setArchiveError] = useState("");
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [returnTx, setReturnTx] = useState<TxItem | null>(null);
  const [returnNote, setReturnNote] = useState("");
  const [returnError, setReturnError] = useState("");
  const [returnLoading, setReturnLoading] = useState(false);
  const [assignTx, setAssignTx] = useState<TxItem | null>(null);
  const [assignUsers, setAssignUsers] = useState<UserOption[]>([]);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignNote, setAssignNote] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState("");
  const [openTimeline, setOpenTimeline] = useState(false);
  const [selectedDocumentNumber, setSelectedDocumentNumber] = useState<string | null>(null);
  const [selectedTimeline, setSelectedTimeline] = useState<TimelineEvent[]>([]);
  const [timelineModalLoading, setTimelineModalLoading] = useState(false);
  const [expandedDocNumber, setExpandedDocNumber] = useState<string | null>(null);
  const [timelineByDoc, setTimelineByDoc] = useState<Record<string, TimelineEvent[]>>({});
  const [loadingTimelineDoc, setLoadingTimelineDoc] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("incoming");
  const [activeReturnSubTab, setActiveReturnSubTab] = useState<ReturnSubTab>("toMe");
  const [activeRejectSubTab, setActiveRejectSubTab] = useState<RejectSubTab>("toMe");

  // URL ?tab=... → ilgili sekme ilk yüklemede aktif
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (!tabParam) return;
    const mapped = TAB_PARAM_MAP[tabParam.toUpperCase()];
    if (mapped) setActiveTab(mapped);
  }, [searchParams]);

  // Sekmeye girildiğinde backend'e okundu işaretle
  useEffect(() => {
    if (activeTab === "incoming") markSeen(getToken, "INCOMING");
    else if (activeTab === "returned") markSeen(getToken, "IADE");
    else if (activeTab === "rejected") markSeen(getToken, "RED");
  }, [activeTab, getToken, markSeen]);

  /* ================= FLIP + FEEDBACK ================= */
  const pendingFlipRef = useRef<Record<string, number> | null>(null);
  const [feedbackCard, setFeedbackCard] = useState<{ docNumber: string; type: "accept" | "reject" | "archive" | "return" } | null>(null);

  const capturePositions = () => {
    const els = document.querySelectorAll("[data-doc-card]");
    const positions: Record<string, number> = {};
    els.forEach((el) => {
      const id = el.getAttribute("data-doc-card");
      if (id) positions[id] = el.getBoundingClientRect().top;
    });
    pendingFlipRef.current = positions;
  };

  useLayoutEffect(() => {
    const prev = pendingFlipRef.current;
    if (!prev) return;
    pendingFlipRef.current = null;
    const els = document.querySelectorAll("[data-doc-card]");
    const toAnimate: { el: Element; deltaY: number }[] = [];
    els.forEach((el) => {
      const id = el.getAttribute("data-doc-card");
      if (!id || prev[id] === undefined) return;
      const newTop = el.getBoundingClientRect().top;
      const deltaY = prev[id] - newTop;
      if (Math.abs(deltaY) > 2) toAnimate.push({ el, deltaY });
    });
    toAnimate.forEach(({ el, deltaY }) => {
      const htmlEl = el as HTMLElement;
      htmlEl.style.transform = `translateY(${deltaY}px)`;
      htmlEl.style.transition = "none";
    });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toAnimate.forEach(({ el }) => {
          const htmlEl = el as HTMLElement;
          htmlEl.style.transition = "transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
          htmlEl.style.transform = "translateY(0)";
          const onEnd = () => {
            htmlEl.style.transition = "";
            htmlEl.style.transform = "";
            htmlEl.removeEventListener("transitionend", onEnd);
          };
          htmlEl.addEventListener("transitionend", onEnd);
        });
      });
    });
  });

  useEffect(() => {
    if (!feedbackCard) return;
    const t = setTimeout(() => setFeedbackCard(null), 380);
    return () => clearTimeout(t);
  }, [feedbackCard]);

  /* ================= AUTH ================= */

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (r.status === 401) {
          router.replace("/login");
          return null;
        }
        return r.json();
      })
      .then((u) => (u && setMe(u)))
      .catch(() => {});
  }, [getToken, router]);

  /* ================= DATA ================= */

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/assignable`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setAssignUsers(data))
      .catch(() => { });
  }, [getToken, me]);

  /* ================= GROUPING (evrak bazlı tek kart) ================= */

  const byDocumentNumber = useMemo(() => {
    const map = new Map<string, TxItem[]>();
    for (const tx of items) {
      const list = map.get(tx.documentNumber) ?? [];
      list.push(tx);
      map.set(tx.documentNumber, list);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    }
    return map;
  }, [items]);

  const allDocCards = useMemo(() => {
    return Array.from(byDocumentNumber.entries()).map(
      ([documentNumber, history]) => {
        const lastTx = history[history.length - 1]!;
        return { documentNumber, lastTx, history };
      }
    );
  }, [byDocumentNumber]);

  /* ================= FILTERS (6 sekme için) ================= */

  // 1️⃣ Bana Gelen (Bekleyen - normal zimmet, iade talebi DEĞİL)
  const incomingPendingDocs = useMemo(
    () =>
      allDocCards.filter(
        (d) =>
          d.lastTx.toUserId === me?.id &&
          d.lastTx.status === "PENDING" &&
          d.lastTx.kind !== "RETURN_REQUEST"
      ),
    [allDocCards, me]
  );

  // 2️⃣ Kabul Ettiklerim (status === ACCEPTED && toUserId === me)
  const acceptedByMeDocs = useMemo(
    () =>
      allDocCards.filter(
        (d) =>
          d.lastTx.status === "ACCEPTED" && d.lastTx.toUserId === me?.id
      ),
    [allDocCards, me]
  );

  // 3️⃣ Gönderdiklerim (SADECE benim gönderip karşı tarafça kabul edilmiş evraklar)
  const sentByMeDocs = useMemo(
    () =>
      allDocCards.filter(
        (d) => d.lastTx.fromUserId === me?.id && d.lastTx.status === "ACCEPTED"
      ),
    [allDocCards, me]
  );

  // 4️⃣ İade: "Bana İade Edilenler" = returnBack ile oluşan PENDING iade talepleri (kind=RETURN_REQUEST)
  const returnedToMeDocs = useMemo(
    () =>
      allDocCards.filter(
        (d) =>
          d.lastTx.status === "PENDING" &&
          d.lastTx.toUserId === me?.id &&
          d.lastTx.kind === "RETURN_REQUEST"
      ),
    [allDocCards, me]
  );
  
  // İade Ettiklerim: history'de RETURNED tx var ve fromUserId=me (ben iade ettim)
  const returnedByMeDocs = useMemo(
    () =>
      allDocCards.filter((d) =>
        d.history.some(
          (tx) => tx.status === "RETURNED" && tx.fromUserId === me?.id
        )
      ),
    [allDocCards, me]
  );
  
  // Combined for tab display
  const allReturnedDocs = useMemo(
    () => [...returnedToMeDocs, ...returnedByMeDocs],
    [returnedToMeDocs, returnedByMeDocs]
  );

  // 5️⃣ Red: REJECTED tx'de from=gönderen, to=reddeden. Fatih→Ali, Ali red → from=Fatih, to=Ali
  // Bana Red Edilenler: history'de REJECTED var ve fromUserId=me
  // Reddettiklerim: history'de REJECTED var ve toUserId=me
  const rejectedToMeDocs = useMemo(
    () =>
      allDocCards.filter((d) =>
        d.history.some(
          (tx) => tx.status === "REJECTED" && tx.fromUserId === me?.id
        )
      ),
    [allDocCards, me]
  );

  const rejectedByMeDocs = useMemo(
    () =>
      allDocCards.filter((d) =>
        d.history.some(
          (tx) => tx.status === "REJECTED" && tx.toUserId === me?.id
        )
      ),
    [allDocCards, me]
  );

  const allRejectedDocs = useMemo(
    () => [...rejectedToMeDocs, ...rejectedByMeDocs],
    [rejectedToMeDocs, rejectedByMeDocs]
  );

  // 6️⃣ Arşivlediklerim (tüm arşivlenmiş evraklar - eski + yeni)
  const archivedDocs = useMemo(
    () =>
      allDocCards.filter(
        (d) => d.lastTx.document?.status === "ARCHIVED"
      ),
    [allDocCards]
  );

  const tabData: Record<TabKey, { label: string; docs: DocCard[]; icon: React.ReactNode; emptyMessage: string; emptyIcon: React.ReactNode }> = {
    incoming: {
      label: "Bana Gelen",
      docs: incomingPendingDocs,
      icon: <Inbox className="h-4 w-4" />,
      emptyMessage: "Şu anda sana gönderilmiş bir evrak yok",
      emptyIcon: <Inbox className="h-12 w-12 text-muted-foreground/50" />,
    },
    accepted: {
      label: "Kabul Ettiklerim",
      docs: acceptedByMeDocs,
      icon: <Package className="h-4 w-4" />,
      emptyMessage: "Henüz kabul ettiğin bir evrak yok",
      emptyIcon: <Package className="h-12 w-12 text-muted-foreground/50" />,
    },
    sent: {
      label: "Gönderdiklerim",
      docs: sentByMeDocs,
      icon: <Send className="h-4 w-4" />,
      emptyMessage: "Henüz karşı tarafça kabul edilmiş gönderdiğin bir evrak yok",
      emptyIcon: <Send className="h-12 w-12 text-muted-foreground/50" />,
    },
    returned: {
      label: "İade",
      docs: allReturnedDocs,
      icon: <RotateCcw className="h-4 w-4" />,
      emptyMessage: "Henüz iade ile ilgili bir evrak yok",
      emptyIcon: <RotateCcw className="h-12 w-12 text-muted-foreground/50" />,
    },
    rejected: {
      label: "Red",
      docs: allRejectedDocs,
      icon: <Ban className="h-4 w-4" />,
      emptyMessage: "Henüz red ile ilgili bir evrak yok",
      emptyIcon: <Ban className="h-12 w-12 text-muted-foreground/50" />,
    },
    archived: {
      label: "Arşiv",
      docs: archivedDocs,
      icon: <ArchiveIcon className="h-4 w-4" />,
      emptyMessage: "Henüz arşivlediğin bir evrak yok",
      emptyIcon: <ArchiveIcon className="h-12 w-12 text-muted-foreground/50" />,
    },
  };

  const currentTabData = tabData[activeTab];

  useEffect(() => {
    if (!expandedDocNumber) return;
    if (timelineByDoc[expandedDocNumber]) return;

    let cancelled = false;
    setLoadingTimelineDoc(expandedDocNumber);
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/transactions/document/${expandedDocNumber}`,
      { headers: { Authorization: `Bearer ${getToken()}` } }
    )
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled)
          setTimelineByDoc((prev) => ({
            ...prev,
            [expandedDocNumber]: Array.isArray(data) ? data : [],
          }));
      })
      .finally(() => {
        if (!cancelled) setLoadingTimelineDoc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [expandedDocNumber, getToken]);

  /* ================= ACTION ================= */

  const runAction = async (tx: TxItem, type: "accept" | "reject" | "return") => {
    setActionLoading(tx.id);
    const url = `${process.env.NEXT_PUBLIC_API_URL}/transactions/${tx.id}/${type}`;

    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      
      capturePositions();
      
      // Store'a yeni tx ekle (zincir modeli - her aksiyon ayrı kayıt)
      if (type === "accept") acceptTransactionLocally(tx);
      else if (type === "reject") rejectTransactionLocally(tx);
      else returnTransactionLocally(tx, data?.data);
      
      setFeedbackCard({ docNumber: tx.documentNumber, type: type === "return" ? "return" : type });
      if (me?.id) refresh(getToken, me.id, "action");
    } catch (e: any) {
      setError(toUserFriendlyError(e?.message));
    } finally {
      setActionLoading(null);
    }
  };

  /* ================= UI ================= */

  if (!me) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
        <p className="mt-4 text-sm text-muted-foreground">Yükleniyor…</p>
      </div>
    );
  }

  const canManageTx = (tx: TxItem) =>
    tx.status === "ACCEPTED" &&
    tx.toUserId === me?.id &&
    tx.isActiveForMe === true;

  const archiveBadgeText = (tx: TxItem) =>
    tx.document?.status === "ARCHIVED"
      ? "Arşivli"
      : statusLabelTR(tx.status);

  const archiveBadgeVariant = (tx: TxItem) =>
    tx.document?.status === "ARCHIVED"
      ? "secondary"
      : statusVariant(tx.status);

  const isArchivedCard = (tx: TxItem) => tx.document?.status === "ARCHIVED";

  const openTimelineModal = async (docNumber: string) => {
    setSelectedDocumentNumber(docNumber);
    setSelectedTimeline([]);
    setOpenTimeline(true);
    setTimelineModalLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/transactions/document/${docNumber}`,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      const data = await res.json();
      setSelectedTimeline(Array.isArray(data) ? data : []);
    } catch {
      setSelectedTimeline([]);
    } finally {
      setTimelineModalLoading(false);
    }
  };

  const handleArchiveConfirm = async () => {
    if (!archiveTx) return;
    const note = archiveNote.trim();
    if (!note) {
      setArchiveError("Arşivleme notu zorunludur.");
      return;
    }
    const token = getToken();
    if (!token) return;

    setArchiveError("");
    setArchiveLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/documents/${archiveTx.documentNumber}/archive`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ note }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      capturePositions();
      
      // Update store (for background sync)
      archiveTransactionLocally(archiveTx.documentNumber);
      
      // INSTANT UI UPDATE: Arşiv sonrası evrak anında Arşiv sekmesine düşer
      const now = new Date().toISOString();
      setLocalTransactions((prev) => {
        return prev.map((item) => {
          if (item.documentNumber === archiveTx.documentNumber) {
            return {
              ...item,
              document: {
                ...item.document,
                status: "ARCHIVED",
                archivedAt: now,
                archivedByUserId: me?.id || null,
              },
            } as TxItem;
          }
          return item;
        });
      });
      
      setFeedbackCard({ docNumber: archiveTx.documentNumber, type: "archive" });
      setArchiveTx(null);
      setArchiveNote("");
    } catch (e: any) {
      setArchiveError(e.message || "Arşivleme başarısız");
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleReturnConfirm = async () => {
    if (!returnTx) return;
    const note = returnNote.trim();
    if (!note) {
      setReturnError("İade notu zorunludur.");
      return;
    }
    const token = getToken();
    if (!token) return;

    setReturnError("");
    setReturnLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/transactions/${returnTx.id}/return`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ note }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      
      capturePositions();
      
      // Store'a RETURNED + RETURN_REQUEST ekle (zincir modeli)
      returnTransactionLocally(returnTx, data?.data);
      
      setFeedbackCard({ docNumber: returnTx.documentNumber, type: "return" });
      if (me?.id) refresh(getToken, me.id, "action");
      setReturnTx(null);
      setReturnNote("");
    } catch (e: any) {
      setReturnError(e.message || "İade işlemi başarısız");
    } finally {
      setReturnLoading(false);
    }
  };

  /* ================= COMPONENTS ================= */

  const DocumentCard = ({ docCard, renderActions }: { docCard: DocCard; renderActions?: () => React.ReactNode }) => {
    const tx = docCard.lastTx;
    const isExpanded = expandedDocNumber === docCard.documentNumber;
    const timeline = timelineByDoc[docCard.documentNumber];
    const loadingTimeline = loadingTimelineDoc === docCard.documentNumber;
    const isArchived = isArchivedCard(tx);
    const showFeedback = feedbackCard?.docNumber === docCard.documentNumber;

    return (
      <div
        key={docCard.documentNumber}
        data-doc-card={docCard.documentNumber}
        className={cn(
          "relative rounded-lg border overflow-hidden transition-all hover:bg-muted/40 hover:shadow-sm transform-gpu",
          isArchived && "bg-amber-50/40 border-amber-200/50"
        )}
      >
        {showFeedback && (
          <div
            className={cn(
              "absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/90 animate-[card-feedback_0.38s_ease-out_forwards] pointer-events-none",
              feedbackCard.type === "accept" && "text-green-600",
              feedbackCard.type === "reject" && "text-destructive",
              feedbackCard.type === "archive" && "text-amber-600",
              feedbackCard.type === "return" && "text-muted-foreground"
            )}
          >
            <div className="flex flex-col items-center gap-1">
              {feedbackCard.type === "accept" && (
                <>
                  <Check className="h-10 w-10" strokeWidth={2.5} />
                  <span className="text-sm font-medium">Kabul edildi</span>
                </>
              )}
              {feedbackCard.type === "reject" && (
                <>
                  <X className="h-10 w-10" strokeWidth={2.5} />
                  <span className="text-sm font-medium">Reddedildi</span>
                </>
              )}
              {feedbackCard.type === "archive" && (
                <>
                  <Lock className="h-10 w-10" strokeWidth={2} />
                  <span className="text-sm font-medium">Arşivlendi</span>
                </>
              )}
              {feedbackCard.type === "return" && (
                <>
                  <Archive className="h-10 w-10" strokeWidth={2} />
                  <span className="text-sm font-medium">İade edildi</span>
                </>
              )}
            </div>
          </div>
        )}
        <div
          role="button"
          tabIndex={0}
          onClick={() =>
            setExpandedDocNumber((prev) =>
              prev === docCard.documentNumber ? null : docCard.documentNumber
            )
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setExpandedDocNumber((prev) =>
                prev === docCard.documentNumber ? null : docCard.documentNumber
              );
            }
          }}
          className="cursor-pointer p-4 space-y-2"
        >
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1">
              <p className="font-medium flex items-center gap-1.5 mb-1">
                {isArchived && (
                  <Lock className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                )}
                <span>
                  Evrak No:{" "}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      openTimelineModal(docCard.documentNumber);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        openTimelineModal(docCard.documentNumber);
                      }
                    }}
                    className="cursor-pointer underline-offset-2 transition-colors hover:underline text-left text-primary"
                  >
                    {docCard.documentNumber}
                  </span>
                </span>
              </p>
              <div className="text-xs text-muted-foreground mb-2">
                <FormattedDate iso={tx.createdAt} />
              </div>
              <div className="text-sm space-y-1">
                <div>
                  <span className="text-muted-foreground">Kimden:</span>{" "}
                  <span className="font-medium">{tx.fromUser?.fullName || "-"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Kime:</span>{" "}
                  <span className="font-medium">{tx.toUser?.fullName || "-"}</span>
                </div>
                {tx.note?.trim() && (
                  <div className="mt-2 text-sm italic text-muted-foreground">
                    Not: {tx.note}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge
                variant={archiveBadgeVariant(tx)}
                className={cn(
                  "cursor-pointer transition-colors",
                  isArchived &&
                    "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100"
                )}
              >
                {archiveBadgeText(tx)}
              </Badge>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
          {renderActions && (
            <div className="pt-2 border-t mt-2" onClick={(e) => e.stopPropagation()}>
              {renderActions()}
            </div>
          )}
        </div>

        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
            isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="overflow-hidden">
            <div className="border-t bg-muted/20 px-4 py-3">
              {loadingTimeline && <Timeline items={[]} loading className="text-sm" />}
              {!loadingTimeline && timeline && timeline.length > 0 && (
                <Timeline items={timeline as TimelineEvent[]} className="text-sm" />
              )}
              {!loadingTimeline && timeline && timeline.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Bu evrak için hareket kaydı yok.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const EmptyState = ({ message, icon }: { message: string; icon: React.ReactNode }) => (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center rounded-lg border border-dashed border-muted-foreground/30 bg-muted/10">
      {icon}
      <p className="text-sm text-muted-foreground font-medium">{message}</p>
    </div>
  );

  const renderActionButtons = (docCard: DocCard) => {
    const tx = docCard.lastTx;
    const archived = isArchivedCard(tx);

    // Arşiv sekmesinde aksiyon butonu yok
    if (activeTab === "archived") return null;

    // Bana Gelen sekmesi
    if (activeTab === "incoming") {
      if (archived) return null;
      const loading = actionLoading === tx.id;
      return (
        <div className="flex gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            className="cursor-pointer min-w-[7.5rem]"
            onClick={() => runAction(tx, "accept")}
            disabled={loading}
            tabIndex={loading ? -1 : 0}
            aria-label="Kabul et"
          >
            {loading ? "Kabul ediliyor…" : "Kabul"}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="cursor-pointer min-w-[5rem]"
            onClick={() => runAction(tx, "reject")}
            disabled={loading}
            tabIndex={loading ? -1 : 0}
            aria-label="Reddet"
          >
            {loading ? "Reddediliyor…" : "Red"}
          </Button>
        </div>
      );
    }

    // Kabul Ettiklerim sekmesi
    if (activeTab === "accepted") {
      const canArchive = canManageTx(tx);
      if (archived) {
        return (
          <div className="flex gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              className="cursor-pointer"
              onClick={() => {
                setAssignTx(tx);
                setAssignUserId("");
                setAssignNote("");
                setAssignError("");
              }}
              aria-label="Başkasına zimmetle"
            >
              Başkasına Zimmetle
            </Button>
          </div>
        );
      }

      return (
        <div className="flex flex-wrap gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            className="cursor-pointer min-w-[8rem]"
            onClick={() => {
              setReturnTx(tx);
              setReturnNote("");
              setReturnError("");
            }}
            disabled={returnLoading}
            tabIndex={returnLoading ? -1 : 0}
            aria-label="İade et"
          >
            {returnLoading ? "İade ediliyor…" : "İade Et"}
          </Button>
          <Button
            size="sm"
            className="cursor-pointer min-w-[10rem]"
            onClick={() => {
              setAssignTx(tx);
              setAssignUserId("");
              setAssignNote("");
              setAssignError("");
            }}
            aria-label="Başkasına zimmetle"
          >
            Başkasına Zimmetle
          </Button>
          {canArchive && (
            <Button
              size="sm"
              variant="secondary"
              className="cursor-pointer min-w-[8.5rem]"
              onClick={() => {
                setArchiveTx(tx);
                setArchiveNote("");
                setArchiveError("");
              }}
              disabled={archiveLoading}
              tabIndex={archiveLoading ? -1 : 0}
              aria-label="Arşivle"
            >
              <Archive className="mr-2 h-4 w-4" aria-hidden />
              {archiveLoading ? "Arşivleniyor…" : "Arşivle"}
            </Button>
          )}
        </div>
      );
    }

    // Bana İade Edilenler: PENDING return talepleri → Kabul / Red (Bana Gelen ile aynı)
    if (activeTab === "returned" && activeReturnSubTab === "toMe") {
      if (tx.status === "PENDING" && tx.kind === "RETURN_REQUEST") {
        const loading = actionLoading === tx.id;
        return (
          <div className="flex gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              className="cursor-pointer min-w-[7.5rem]"
              onClick={() => runAction(tx, "accept")}
              disabled={loading}
              tabIndex={loading ? -1 : 0}
              aria-label="İade talebini kabul et"
            >
              {loading ? "Kabul ediliyor…" : "Kabul"}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="cursor-pointer min-w-[5rem]"
              onClick={() => runAction(tx, "reject")}
              disabled={loading}
              tabIndex={loading ? -1 : 0}
              aria-label="İade talebini reddet"
            >
              {loading ? "Reddediliyor…" : "Red"}
            </Button>
          </div>
        );
      }
    }

    // Red sekmelerinde evrak kullanıcıdaysa: Modal ile Zimmetle + Arşivle
    if (activeTab === "rejected" && activeRejectSubTab === "toMe") {
      if (archived) {
        return (
          <div className="flex gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer"
              onClick={() => {
                setAssignTx(tx);
                setAssignUserId("");
                setAssignNote("");
                setAssignError("");
              }}
              aria-label="Başkasına zimmetle"
            >
              <Send className="mr-2 h-4 w-4" aria-hidden />
              Başkasına Zimmetle
            </Button>
          </div>
        );
      }
      return (
        <div className="flex flex-wrap gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            className="cursor-pointer min-w-[10rem]"
            onClick={() => {
              setAssignTx(tx);
              setAssignUserId("");
              setAssignNote("");
              setAssignError("");
            }}
            aria-label="Başkasına zimmetle"
          >
            <Send className="mr-2 h-4 w-4" aria-hidden />
            Başkasına Zimmetle
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="cursor-pointer min-w-[8.5rem]"
            onClick={() => {
              setArchiveTx(tx);
              setArchiveNote("");
              setArchiveError("");
            }}
            disabled={archiveLoading}
            tabIndex={archiveLoading ? -1 : 0}
            aria-label="Arşivle"
          >
            <Archive className="mr-2 h-4 w-4" aria-hidden />
            {archiveLoading ? "Arşivleniyor…" : "Arşivle"}
          </Button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            {loading ? (
              <>
                <Skeleton className="h-7 w-32 rounded-md" />
                <Skeleton className="mt-1 h-4 w-48 rounded-md" />
              </>
            ) : (
              <>
                <h1 className="text-2xl font-semibold">Geçmişim</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Tüm zimmet hareketlerin
                </p>
              </>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => router.push("/dashboard")}
            aria-label="Dashboard sayfasına git"
            disabled={loading}
          >
            Dashboard
          </Button>
        </div>

        {/* Error */}
        {(error || storeError) && (
          <Alert variant="destructive" className="rounded-lg mb-6">
            <AlertDescription>{error || storeError}</AlertDescription>
          </Alert>
        )}

        {/* Loading - Card skeletons matching new design */}
        {loading && (
          <>
            {/* Sticky Tabs Skeleton */}
            <div className="sticky top-16 z-20 bg-background border-b mb-6 -mx-6 px-6">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-12 w-24 rounded-t-md" />
                ))}
              </div>
            </div>
            {/* Card Skeletons */}
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-24 rounded-lg border bg-muted/30 animate-pulse"
                />
              ))}
            </div>
          </>
        )}

        {/* Empty State - No transactions */}
        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center rounded-xl border border-border bg-muted/20">
            <FileText className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-base text-muted-foreground font-medium">
              Henüz sana ait bir evrak işlemi yok
            </p>
          </div>
        )}

        {/* Tabs + Content */}
        {!loading && items.length > 0 && (
          <>
            {/* Sticky Tabs */}
            <div className="sticky top-16 z-20 bg-background border-b mb-6 -mx-6 px-6">
              <div className="flex gap-2 min-w-max">
                {(Object.keys(tabData) as TabKey[]).map((tabKey) => {
                  const tab = tabData[tabKey];
                  const isActive = activeTab === tabKey;
                  const unreadCount =
                    tabKey === "incoming"
                      ? unreadIncomingCount
                      : tabKey === "returned"
                        ? unreadReturnedCount
                        : tabKey === "rejected"
                          ? unreadRejectedCount
                          : 0;
                  const hasUnread = unreadCount > 0;
                  return (
                    <button
                      key={tabKey}
                      type="button"
                      onClick={() => setActiveTab(tabKey)}
                      className={cn(
                        "flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-[1px] whitespace-nowrap shrink-0",
                        isActive
                          ? "border-primary text-primary"
                          : hasUnread
                            ? "border-transparent text-destructive hover:text-destructive"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {tab.icon}
                      <span>{tab.label}</span>
                      {tab.docs.length > 0 && (
                        hasUnread ? (
                          <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full border-0 bg-destructive px-1.5 text-[10px] font-medium text-white animate-pulse">
                            {tab.docs.length}
                          </span>
                        ) : (
                          <Badge variant="secondary" className="ml-1 text-xs">
                            {tab.docs.length}
                          </Badge>
                        )
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tab Content */}
            <div className="space-y-4">
              {currentTabData.docs.length === 0 ? (
                <EmptyState
                  message={currentTabData.emptyMessage}
                  icon={currentTabData.emptyIcon}
                />
              ) : activeTab === "returned" ? (
                // İade sekmesi: Alt sekmeler (tıklamayla tek liste - Bana Gelenler/Kabul Ettiklerim modeli)
                <>
                  <div className="flex gap-2 border-b pb-2 -mx-1">
                    <button
                      type="button"
                      onClick={() => setActiveReturnSubTab("toMe")}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors",
                        activeReturnSubTab === "toMe"
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"
                      )}
                    >
                      Bana İade Edilenler
                      {returnedToMeDocs.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {returnedToMeDocs.length}
                        </Badge>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveReturnSubTab("byMe")}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors",
                        activeReturnSubTab === "byMe"
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"
                      )}
                    >
                      İade Ettiklerim
                      {returnedByMeDocs.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {returnedByMeDocs.length}
                        </Badge>
                      )}
                    </button>
                  </div>
                  {activeReturnSubTab === "toMe" ? (
                    returnedToMeDocs.length > 0 ? (
                      <div className="space-y-4">
                        {returnedToMeDocs.map((docCard) => (
                          <DocumentCard
                            key={docCard.documentNumber}
                            docCard={docCard}
                            renderActions={() => renderActionButtons(docCard)}
                          />
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        message="Henüz sana iade edilen bir evrak yok."
                        icon={<RotateCcw className="h-10 w-10 text-muted-foreground/50" />}
                      />
                    )
                  ) : returnedByMeDocs.length > 0 ? (
                    <div className="space-y-4">
                      {returnedByMeDocs.map((docCard) => (
                        <DocumentCard
                          key={docCard.documentNumber}
                          docCard={docCard}
                          renderActions={() => renderActionButtons(docCard)}
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      message="Henüz iade ettiğin bir evrak yok."
                      icon={<RotateCcw className="h-10 w-10 text-muted-foreground/50" />}
                    />
                  )}
                </>
              ) : activeTab === "rejected" ? (
                // Red sekmesi: Alt sekmeler (tıklamayla tek liste - Bana Gelenler/Kabul Ettiklerim modeli)
                <>
                  <div className="flex gap-2 border-b pb-2 -mx-1">
                    <button
                      type="button"
                      onClick={() => setActiveRejectSubTab("toMe")}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors",
                        activeRejectSubTab === "toMe"
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"
                      )}
                    >
                      Bana Red Edilenler
                      {rejectedToMeDocs.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {rejectedToMeDocs.length}
                        </Badge>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveRejectSubTab("byMe")}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors",
                        activeRejectSubTab === "byMe"
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"
                      )}
                    >
                      Red Ettiklerim
                      {rejectedByMeDocs.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {rejectedByMeDocs.length}
                        </Badge>
                      )}
                    </button>
                  </div>
                  {activeRejectSubTab === "toMe" ? (
                    rejectedToMeDocs.length > 0 ? (
                      <div className="space-y-4">
                        {rejectedToMeDocs.map((docCard) => (
                          <DocumentCard
                            key={docCard.documentNumber}
                            docCard={docCard}
                            renderActions={() => renderActionButtons(docCard)}
                          />
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        message="Henüz sana red edilen bir evrak yok."
                        icon={<Ban className="h-10 w-10 text-muted-foreground/50" />}
                      />
                    )
                  ) : rejectedByMeDocs.length > 0 ? (
                    <div className="space-y-4">
                      {rejectedByMeDocs.map((docCard) => (
                        <DocumentCard
                          key={docCard.documentNumber}
                          docCard={docCard}
                          renderActions={() => renderActionButtons(docCard)}
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      message="Henüz reddettiğin bir evrak yok."
                      icon={<Ban className="h-10 w-10 text-muted-foreground/50" />}
                    />
                  )}
                </>
              ) : (
                currentTabData.docs.map((docCard) => (
                  <DocumentCard
                    key={docCard.documentNumber}
                    docCard={docCard}
                    renderActions={() => renderActionButtons(docCard)}
                  />
                ))
              )}
            </div>
          </>
        )}
      </main>

      {/* Modals */}
      <Dialog
        open={!!archiveTx}
        onOpenChange={(open) => {
          if (!open && !archiveLoading) {
            setArchiveTx(null);
            setArchiveNote("");
            setArchiveError("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Evrakı Arşivle</DialogTitle>
            <DialogDescription>
              Bu evrak arşivlenecek ve aktif zimmetlerden çıkarılacaktır.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Arşivleme Notu</label>
            <textarea
              value={archiveNote}
              onChange={(e) => setArchiveNote(e.target.value)}
              placeholder="Evrak neden arşivleniyor?"
              className="w-full min-h-[90px] resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={archiveLoading}
            />
            {archiveError && (
              <p className="text-sm text-destructive">{archiveError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setArchiveTx(null);
                setArchiveNote("");
                setArchiveError("");
              }}
              disabled={archiveLoading}
            >
              İptal
            </Button>
            <Button
              variant="destructive"
              onClick={handleArchiveConfirm}
              disabled={archiveLoading}
            >
              {archiveLoading ? "Arşivleniyor..." : "Arşivle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!returnTx}
        onOpenChange={(open) => {
          if (!open && !returnLoading) {
            setReturnTx(null);
            setReturnNote("");
            setReturnError("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Evrakı İade Et</DialogTitle>
            <DialogDescription>
              Bu evrak önceki zimmet sahibine iade edilecektir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">İade Notu</label>
            <textarea
              value={returnNote}
              onChange={(e) => setReturnNote(e.target.value)}
              placeholder="Evrak neden iade ediliyor?"
              className="w-full min-h-[90px] resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={returnLoading}
            />
            {returnError && (
              <p className="text-sm text-destructive">{returnError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReturnTx(null);
                setReturnNote("");
                setReturnError("");
              }}
              disabled={returnLoading}
            >
              İptal
            </Button>
            <Button onClick={handleReturnConfirm} disabled={returnLoading}>
              {returnLoading ? "İade ediliyor..." : "İade Et"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TimelineModal
        open={openTimeline}
        onOpenChange={(open) => {
          setOpenTimeline(open);
          if (!open) setSelectedDocumentNumber(null);
        }}
        documentNumber={selectedDocumentNumber ?? ""}
        items={selectedTimeline}
        loading={timelineModalLoading}
      />

      <Dialog
        open={!!assignTx}
        onOpenChange={(open) => {
          if (!open && !assignLoading) {
            setAssignTx(null);
            setAssignUserId("");
            setAssignNote("");
            setAssignError("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Başkasına Zimmetle</DialogTitle>
            <DialogDescription>
              Evrak numarası: {assignTx?.documentNumber}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Kime zimmetlenecek?</label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={assignUserId}
                onChange={(e) => setAssignUserId(e.target.value)}
              >
                <option value="">Kullanıcı seçin</option>
                {assignUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                    {u.department ? ` — ${u.department}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Zimmet Notu (opsiyonel)</label>
              <textarea
                value={assignNote}
                onChange={(e) => setAssignNote(e.target.value)}
                placeholder="İsteğe bağlı açıklama"
                className="w-full min-h-[90px] resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={assignLoading}
              />
            </div>
            {assignError && (
              <p className="text-sm text-red-600">{assignError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignTx(null)}
              disabled={assignLoading}
            >
              İptal
            </Button>
            <Button
              onClick={async () => {
                if (!assignTx || !assignUserId) {
                  setAssignError("Lütfen kullanıcı seçin.");
                  return;
                }
                const token = getToken();
                if (!token) return;
                setAssignLoading(true);
                setAssignError("");
                try {
                  const body: { documentNumber: string; toUserId: string; note?: string } = {
                    documentNumber: assignTx.documentNumber,
                    toUserId: assignUserId,
                  };
                  if (assignNote.trim()) body.note = assignNote.trim();
                  const res = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL}/transactions`,
                    {
                      method: "POST",
                      headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify(body),
                    }
                  );
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.message);
                  const createdTx = data?.transaction ?? data;
                  if (createdTx) {
                    capturePositions();
                    addTransactionLocally(createdTx);
                    setLocalTransactions((prev) => [...prev, createdTx as TxItem]);
                  }
                  setAssignTx(null);
                  setAssignNote("");
                } catch (e: any) {
                  setAssignError(e.message || "Zimmet işlemi başarısız.");
                } finally {
                  setAssignLoading(false);
                }
              }}
              disabled={assignLoading}
            >
              {assignLoading ? "Zimmetleniyor..." : "Zimmetle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
