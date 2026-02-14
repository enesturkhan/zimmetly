"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useTransactionsStore } from "@/store/transactionsStore";
import { Loader2, Archive, FileText, ChevronDown, ChevronUp, Lock, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toUserFriendlyError, getNetworkError } from "@/lib/errorMessages";
import { Timeline } from "@/components/Timeline";

import {
  Card,
  CardHeader,
  CardTitle,
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

/* ================= HELPERS ================= */

function formatDateTR(iso?: string) {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

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

export default function GecmisimPage() {
  const router = useRouter();
  const getToken = useAuthStore((s: any) => s.getToken);
  const logout = useAuthStore((s: any) => s.logout);
  const transactionsMe = useTransactionsStore((s) => s.transactionsMe);
  const loading = useTransactionsStore((s) => s.loading);
  const storeError = useTransactionsStore((s) => s.error);
  const acceptTransactionLocally = useTransactionsStore((s) => s.acceptTransactionLocally);
  const rejectTransactionLocally = useTransactionsStore((s) => s.rejectTransactionLocally);
  const returnTransactionLocally = useTransactionsStore((s) => s.returnTransactionLocally);
  const archiveTransactionLocally = useTransactionsStore((s) => s.archiveTransactionLocally);
  const addTransactionLocally = useTransactionsStore((s) => s.addTransactionLocally);

  const [me, setMe] = useState<Me | null>(null);
  const items = (Array.isArray(transactionsMe) ? transactionsMe : []) as TxItem[];
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
          logout();
          router.replace("/login");
          return null;
        }
        return r.json();
      })
      .then((u) => (u && setMe(u)))
      .catch(() => {});
  }, [getToken, logout, router]);

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

  const incomingPendingDocs = useMemo(
    () =>
      allDocCards.filter(
        (d) =>
          d.lastTx.toUserId === me?.id && d.lastTx.status === "PENDING"
      ),
    [allDocCards, me]
  );

  const acceptedByMeDocs = useMemo(
    () =>
      allDocCards.filter(
        (d) =>
          d.lastTx.toUserId === me?.id &&
          d.lastTx.status === "ACCEPTED" &&
          d.lastTx.isActiveForMe === true
      ),
    [allDocCards, me]
  );

  const sentByMeDocs = useMemo(
    () => allDocCards.filter((d) => d.lastTx.fromUserId === me?.id),
    [allDocCards, me]
  );

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
  }, [expandedDocNumber]);

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
      if (type === "accept") acceptTransactionLocally(tx.id);
      else if (type === "reject") rejectTransactionLocally(tx.id);
      else returnTransactionLocally(tx.id);
      setFeedbackCard({ docNumber: tx.documentNumber, type: type === "return" ? "return" : type });
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
      archiveTransactionLocally(archiveTx.documentNumber);
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
      returnTransactionLocally(returnTx.id);
      setFeedbackCard({ docNumber: returnTx.documentNumber, type: "return" });
      setReturnTx(null);
      setReturnNote("");
    } catch (e: any) {
      setReturnError(e.message || "İade işlemi başarısız");
    } finally {
      setReturnLoading(false);
    }
  };

  const Section = ({
    title,
    docCards,
    children,
    feedbackCard,
  }: {
    title: string;
    docCards: DocCard[];
    children?: (docCard: DocCard) => React.ReactNode;
    feedbackCard: { docNumber: string; type: "accept" | "reject" | "archive" | "return" } | null;
  }) => {
    const SectionEmpty = () => (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center rounded-lg border border-dashed border-muted-foreground/30 bg-muted/10">
        <FileText className="h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">Bu alanda kayıt yok</p>
        <p className="text-xs text-muted-foreground">
          Bu bölümde henüz kayıt bulunmuyor
        </p>
      </div>
    );

    const DocumentMeta = ({ tx }: { tx: TxItem }) => (
      <>
        <div className="text-xs text-muted-foreground">{formatDateTR(tx.createdAt)}</div>
        <div className="text-sm">
          <b>Kimden:</b> {tx.fromUser?.fullName}
        </div>
        <div className="text-sm">
          <b>Kime:</b> {tx.toUser?.fullName}
        </div>
        {tx.note?.trim() && (
          <div className="mt-1 text-sm italic text-muted-foreground">Not: {tx.note}</div>
        )}
      </>
    );

    const DocumentCard = ({ docCard }: { docCard: DocCard }) => {
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
            className="cursor-pointer p-3 space-y-1"
          >
            <div className="flex justify-between items-start gap-2">
              <p className="font-medium flex items-center gap-1.5">
                {isArchived && (
                  <Lock className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                )}
                <span>
                  Evrak No:{" "}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openTimelineModal(docCard.documentNumber);
                    }}
                    className="cursor-pointer underline-offset-2 transition-colors hover:underline text-left"
                  >
                    {docCard.documentNumber}
                  </button>
                </span>
              </p>
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

            <DocumentMeta tx={tx} />

            {children && (
              <div className="pt-2" onClick={(e) => e.stopPropagation()}>
                {children(docCard)}
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
              <div className="border-t bg-muted/20 px-3 py-3 sm:px-4">
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

    return (
      <Card className="rounded-xl border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="font-semibold">{title}</CardTitle>
          <Badge variant="secondary" className="shrink-0">
            {docCards.length}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {docCards.length === 0 && <SectionEmpty />}
          {docCards.map((docCard) => (
            <DocumentCard key={docCard.documentNumber} docCard={docCard} />
          ))}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <main
        className={cn(
          "mx-auto max-w-7xl space-y-8 px-6 py-8 transition-all duration-300 opacity-100 translate-y-0"
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            {loading ? (
              <>
                <Skeleton className="h-7 w-32 rounded-md" />
                <Skeleton className="mt-1 h-4 w-48 rounded-md" />
              </>
            ) : (
              <>
                <h1 className="text-xl font-semibold">Geçmişim</h1>
                <p className="text-sm text-muted-foreground">Tüm zimmet hareketlerin</p>
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

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-[7.5rem] rounded-xl border skeleton-shimmer"
              />
            ))}
          </div>
        )}

        {(error || storeError) && (
          <Alert variant="destructive" className="rounded-lg">
            <AlertDescription>{error || storeError}</AlertDescription>
          </Alert>
        )}

        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center rounded-xl border border-border bg-muted/20">
            <FileText className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-base text-muted-foreground">
              Henüz sana ait bir evrak işlemi yok
            </p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <>
            <Section title="Bana Gelen (Beklemede)" docCards={incomingPendingDocs} feedbackCard={feedbackCard}>
              {(docCard) => {
                const tx = docCard.lastTx;
                const archived = isArchivedCard(tx);
                if (archived) return null;
                const loading = actionLoading === tx.id;
                const acceptBtn = (
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
                );
                const rejectBtn = (
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
                );
                return (
                  <div className="flex gap-2">
                    {loading ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">{acceptBtn}</span>
                        </TooltipTrigger>
                        <TooltipContent>İşlem devam ediyor</TooltipContent>
                      </Tooltip>
                    ) : (
                      acceptBtn
                    )}
                    {loading ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">{rejectBtn}</span>
                        </TooltipTrigger>
                        <TooltipContent>İşlem devam ediyor</TooltipContent>
                      </Tooltip>
                    ) : (
                      rejectBtn
                    )}
                  </div>
                );
              }}
            </Section>

            <Section title="Kabul Ettiklerim (Bende)" docCards={acceptedByMeDocs} feedbackCard={feedbackCard}>
              {(docCard) => {
                const tx = docCard.lastTx;
                const isArchived = tx.document?.status === "ARCHIVED";
                const canArchive = canManageTx(tx);

                if (isArchived) {
                  return (
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
                  );
                }

                const returnBtn = (
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
                );
                const assignBtn = (
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
                );
                const archiveBtn = canArchive && (
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
                );

                return (
                  <div className="flex flex-wrap gap-2">
                    {returnLoading ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">{returnBtn}</span>
                        </TooltipTrigger>
                        <TooltipContent>İşlem devam ediyor</TooltipContent>
                      </Tooltip>
                    ) : (
                      returnBtn
                    )}
                    {assignBtn}
                    {archiveBtn &&
                      (archiveLoading ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex">{archiveBtn}</span>
                          </TooltipTrigger>
                          <TooltipContent>İşlem devam ediyor</TooltipContent>
                        </Tooltip>
                      ) : (
                        archiveBtn
                      ))}
                  </div>
                );
              }}
            </Section>

            <Section title="Gönderdiklerim" docCards={sentByMeDocs} feedbackCard={feedbackCard} />
          </>
        )}
      </main>

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
            <Button
              onClick={handleReturnConfirm}
              disabled={returnLoading}
            >
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