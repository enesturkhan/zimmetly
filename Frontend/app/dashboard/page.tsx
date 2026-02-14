"use client";

import {
  useState,
  useEffect,
  useRef,
  KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useTransactionsStore } from "@/store/transactionsStore";
import { type AuthState } from "@/store/authStore";

import { Search, Send, History, FileText, Loader2, FileX } from "lucide-react";
import { cn } from "@/lib/utils";
import { toUserFriendlyError, getNetworkError } from "@/lib/errorMessages";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Timeline, type TimelineEvent } from "@/components/Timeline";
import { TimelineModal } from "@/components/TimelineModal";

/* ================= TYPES ================= */

type UserMe = {
  id: string;
  fullName: string;
  role: "ADMIN" | "USER";
};

type UserOption = {
  id: string;
  fullName: string;
  department: string | null;
};

type DocumentResponse = {
  number: string;
  status?: string;
  archivedAt?: string | null;
  archivedBy?: { id: string; fullName: string } | null;
  /** Mevcut sahip; evrak sorguda "En son kimde" buradan gelir (currentHolderId ile uyumlu). */
  lastHolder?: { id: string; fullName: string } | null;
};

type TimelineItem = {
  type: string;
  id?: string;
  status?: string;
  createdAt: string;
  fromUser?: { fullName: string };
  toUser?: { fullName: string };
  user?: { fullName: string };
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
      return status;
  }
}

function statusVariant(status?: string) {
  if (status === "ACCEPTED") return "default";
  if (status === "PENDING") return "secondary";
  if (status === "REJECTED" || status === "CANCELLED") return "destructive";
  return "outline";
}

/**
 * Geçmişim badge: HER ZAMAN DOM'da ve görünür.
 * loading → count geçişi SADECE 1 KEZ. Sonrasında loading tamamen ignore.
 */
function PendingCountBadgeOrLoader({
  count,
  isLoading,
}: {
  count: number;
  isLoading: boolean;
}) {
  const loadingOnceRef = useRef(false);
  if (isLoading === false) loadingOnceRef.current = true;

  const mode: "loading" | "count" | "idle" =
    isLoading && !loadingOnceRef.current ? "loading" : count > 0 ? "count" : "idle";

  const wasLoadingRef = useRef(true);
  const [countAnim, setCountAnim] = useState<"strong" | "remind" | "idle">("idle");
  const prevCountRef = useRef(count);

  useEffect(() => {
    if (mode !== "count") return;
    if (wasLoadingRef.current) {
      wasLoadingRef.current = false;
      setCountAnim("strong");
    } else if (count > prevCountRef.current) {
      setCountAnim("strong");
    }
    prevCountRef.current = count;
  }, [mode, count]);

  useEffect(() => {
    if (mode === "loading") wasLoadingRef.current = true;
  }, [mode]);

  useEffect(() => {
    if (mode !== "count" || countAnim === "idle") return;
    const t = setTimeout(() => setCountAnim("idle"), 600);
    return () => clearTimeout(t);
  }, [mode, countAnim]);

  useEffect(() => {
    if (mode !== "count") return;
    const id = setInterval(() => setCountAnim("remind"), 15000);
    return () => clearInterval(id);
  }, [mode]);

  // Wrapper scale: HER ZAMAN 1 veya animasyon. opacity-0 ve scale<1 YOK.
  const wrapperAnimClass =
    mode === "count" && countAnim === "strong"
      ? "animate-[badge-strong-pop_0.5s_ease-out]"
      : mode === "count" && countAnim === "remind"
        ? "animate-[badge-remind_0.4s_ease-out]"
        : "scale-100";

  return (
    <div
      className={cn(
        "absolute right-4 top-4 flex items-center justify-center",
        "min-w-[1.5rem] min-h-5 px-2 py-0.5 rounded-full",
        "transform-gpu will-change-transform",
        wrapperAnimClass,
        mode === "loading" && "bg-muted/50",
        mode === "count" && "bg-destructive text-white text-xs font-medium",
        mode === "idle" && "bg-muted/30"
      )}
    >
      {mode === "loading" && (
        <div
          className="w-2 h-2 rounded-full bg-muted-foreground/60 opacity-60 shrink-0 transform-gpu will-change-transform animate-[badge-pulse_1.2s_ease-in-out_infinite]"
          aria-hidden
        />
      )}
      {mode === "count" && <span>{count}</span>}
      {mode === "idle" && (
        <div
          className="w-2 h-2 rounded-full bg-muted-foreground/60 opacity-60 shrink-0"
          aria-hidden
        />
      )}
    </div>
  );
}

/**
 * Geçmişim badge: iki seviyeli animasyon.
 * Count arttığında güçlü (scale 150→100), 15sn'de bir hafif hatırlatma (scale 110→100).
 */
function PendingCountBadge({ count }: { count: number }) {
  const [strongKey, setStrongKey] = useState(0);
  const [remindKey, setRemindKey] = useState(0);
  const prevCount = useRef(count);
  const [animType, setAnimType] = useState<"strong" | "remind" | "idle">("idle");

  useEffect(() => {
    if (count > prevCount.current) {
      setAnimType("strong");
      setStrongKey((k) => k + 1);
    }
    prevCount.current = count;
  }, [count]);

  useEffect(() => {
    if (count <= 0) return;
    const id = setInterval(() => {
      setAnimType("remind");
      setRemindKey((k) => k + 1);
    }, 15000);
    return () => clearInterval(id);
  }, [count]);

  useEffect(() => {
    if (animType === "idle") return;
    const t = setTimeout(() => setAnimType("idle"), 600);
    return () => clearTimeout(t);
  }, [animType, strongKey, remindKey]);

  const badgeKey = `s${strongKey}-r${remindKey}`;
  const animClass =
    animType === "strong"
      ? "animate-[strong-pop_0.5s_ease-out]"
      : animType === "remind"
        ? "animate-[remind-pop_0.4s_ease-out]"
        : "scale-100";

  return (
    <Badge
      key={badgeKey}
      variant="destructive"
      className={cn(
        "absolute right-4 top-4 px-2 py-0.5 text-xs",
        "transform-gpu will-change-transform",
        "transition-transform duration-500 ease-out",
        animClass
      )}
    >
      {count}
    </Badge>
  );
}

type QuickActionCardProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  badge?: React.ReactNode;
};

function QuickActionCard({
  icon,
  title,
  description,
  onClick,
  badge,
}: QuickActionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex cursor-pointer flex-col items-start rounded-xl border bg-card p-5 text-left shadow-sm transition-all hover:bg-muted/40 hover:shadow-sm"
    >
      {badge}
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </button>
  );
}

function DashboardEmptyState({
  icon,
  message,
}: {
  icon: React.ReactNode;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-muted-foreground/30 bg-muted/10 py-10 text-center">
      {icon}
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

type EvrakSonucCardProps = {
  docResult: DocumentResponse;
  timeline: TimelineItem[];
  timelineLoading: boolean;
  userId?: string;
  onOpenTimeline: () => void;
};

function EvrakSonucCard({
  docResult,
  timeline,
  timelineLoading,
  userId,
  onOpenTimeline,
}: EvrakSonucCardProps) {
  return (
    <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
      {docResult.status === "ARCHIVED" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-medium">Bu evrak arşivlenmiştir</p>
          <p>Arşivleyen: {docResult.archivedBy?.fullName ?? "-"}</p>
          <p>Tarih: {docResult.archivedAt ? formatDateTR(docResult.archivedAt) : "-"}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">
          Evrak No:{" "}
          <button
            type="button"
            onClick={onOpenTimeline}
            className="cursor-pointer underline-offset-2 transition-colors hover:underline hover:bg-muted/50 rounded px-1 -mx-1"
          >
            {docResult.number}
          </button>
        </p>
        {docResult.lastHolder && docResult.status !== "ARCHIVED" && (
          <Badge>
            En son kimde: {docResult.lastHolder.fullName}
            {docResult.lastHolder.id === userId ? " (sende)" : ""}
          </Badge>
        )}
        {docResult.status === "ARCHIVED" && (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">
            Arşivli
          </Badge>
        )}
      </div>

      <div className="pt-3 border-t">
        <p className="mb-3 text-lg font-semibold">Zimmet Geçmişi</p>

        {timelineLoading && <Timeline items={[]} loading className="pb-2" />}

        {!timelineLoading && timeline.length === 0 && docResult.status !== "ARCHIVED" && (
          <DashboardEmptyState
            icon={<FileText className="h-10 w-10 text-muted-foreground/50" />}
            message="Bu evrak için henüz işlem yapılmamış"
          />
        )}

        {!timelineLoading && timeline.length > 0 && (
          <div className="rounded-xl border bg-background/60 p-4">
            <Timeline items={timeline as TimelineEvent[]} />
          </div>
        )}
      </div>
    </div>
  );
}

type EvrakSorguCardProps = {
  docNumber: string;
  setDocNumber: (v: string) => void;
  runSearch: () => void;
  isLoading: boolean;
  errorMsg: string;
  searchNotFound: boolean;
  docResult: DocumentResponse | null;
  timeline: TimelineItem[];
  timelineLoading: boolean;
  userId?: string;
  onOpenTimeline: () => void;
  onKeyDownSearch: (e: KeyboardEvent<HTMLInputElement>) => void;
  evrakInputRef: React.RefObject<HTMLDivElement | null>;
};

function EvrakSorguCard({
  docNumber,
  setDocNumber,
  runSearch,
  isLoading,
  errorMsg,
  searchNotFound,
  docResult,
  timeline,
  timelineLoading,
  userId,
  onOpenTimeline,
  onKeyDownSearch,
  evrakInputRef,
}: EvrakSorguCardProps) {
  return (
    <Card id="evrak-sorgula" className="rounded-xl border shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Evrak Sorgulama</CardTitle>
        <p className="text-sm text-muted-foreground">Evrak numarası ile sorgulayın</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div ref={evrakInputRef} className="flex flex-wrap gap-2 sm:flex-nowrap">
          <Input
            placeholder="Evrak numarası"
            value={docNumber}
            onChange={(e) => setDocNumber(e.target.value.replace(/\D/g, ""))}
            onKeyDown={onKeyDownSearch}
            className="rounded-lg transition-colors focus-visible:ring-2 flex-1 min-w-0"
          />
          <Button
            onClick={runSearch}
            disabled={isLoading}
            className="cursor-pointer shrink-0 rounded-lg min-w-[8rem]"
          >
            {isLoading ? "Aranıyor..." : "Sorgula"}
          </Button>
        </div>

        {errorMsg && !searchNotFound && (
          <Alert variant="destructive" className="rounded-lg">
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        {searchNotFound && (
          <DashboardEmptyState
            icon={<FileX className="h-12 w-12 text-muted-foreground" />}
            message="Bu numaraya ait evrak bulunamadı"
          />
        )}

        {docResult && (
          <EvrakSonucCard
            docResult={docResult}
            timeline={timeline}
            timelineLoading={timelineLoading}
            userId={userId}
            onOpenTimeline={onOpenTimeline}
          />
        )}
      </CardContent>
    </Card>
  );
}

/* ================= PAGE ================= */

export default function DashboardPage() {
  const router = useRouter();
  const getToken = useAuthStore((s: AuthState) => s.getToken);
  const logout = useAuthStore((s: AuthState) => s.logout);
  const pendingForMeCount = useTransactionsStore((s) => s.pendingForMeCount);
  const isPendingCountLoading = useTransactionsStore((s) => s.isPendingCountLoading);
  const refresh = useTransactionsStore((s) => s.refresh);

  const [user, setUser] = useState<UserMe | null>(null);

  const [docNumber, setDocNumber] = useState("");
  const [docResult, setDocResult] = useState<DocumentResponse | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [openTimeline, setOpenTimeline] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");
  const [searchNotFound, setSearchNotFound] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // ---- ZİMMET FORMU ----
  const [zimmetNumber, setZimmetNumber] = useState("");
  const [zimmetError, setZimmetError] = useState("");
  const [zimmetMessage, setZimmetMessage] = useState("");
  const [isZimmetLoading, setIsZimmetLoading] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  // ---- USER DROPDOWN ----
  const [users, setUsers] = useState<UserOption[]>([]);
  const [zimmetUserId, setZimmetUserId] = useState("");
  const [zimmetUserSearch, setZimmetUserSearch] = useState("");
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const evrakInputRef = useRef<HTMLDivElement | null>(null);
  const zimmetInputRef = useRef<HTMLInputElement | null>(null);

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
      .then((u) => (u && setUser(u)))
      .catch(() => {});
  }, [getToken, logout, router]);

  /* ================= USERS ================= */

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/assignable`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setUsers(d));
  }, [getToken]);

  // ---- DROPDOWN DIŞINA TIKLAYINCA KAPATMA ----
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsUserDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ---- BAŞARI MESAJI OTOMATİK KAYBOLMA ----
  useEffect(() => {
    if (showSuccessMessage) {
      const timer = setTimeout(() => {
        setShowSuccessMessage(false);
        setZimmetMessage("");
      }, 3000); // 3sn sonra kaybol

      return () => clearTimeout(timer);
    }
  }, [showSuccessMessage]);

  // ---- EVRAK BULUNAMAYINCA → Hızlı Zimmet'e focus ----
  useEffect(() => {
    if (searchNotFound && docNumber) {
      const t = setTimeout(() => {
        zimmetInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(t);
    }
  }, [searchNotFound, docNumber]);

  // ---- USER FİLTRE (ARAMA) ----
  const filteredUsers = users
    .filter((u) => u.id !== user?.id) // Login kullanıcıyı listeden çıkar
    .filter((u) => {
      const q = zimmetUserSearch.toLowerCase();
      return (
        u.fullName.toLowerCase().includes(q) ||
        (u.department || "").toLowerCase().includes(q)
      );
    });

  /* ================= EVRAK ARAMA ================= */

  const runSearch = async () => {
    setErrorMsg("");
    setDocResult(null);
    setTimeline([]);
    setErrorMsg("");
    setSearchNotFound(false);

    if (!docNumber) {
      setErrorMsg("Evrak numarası giriniz.");
      return;
    }

    setIsLoading(true);

    try {
      const token = getToken();

      const docRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/documents/${docNumber}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const docData = await docRes.json();

      if (!docRes.ok) {
        setSearchNotFound(true);
        setErrorMsg(
          toUserFriendlyError(docData?.message ?? "Evrak bulunamadı.")
        );
        setZimmetNumber(docNumber); // Evrak yoksa → Hızlı Zimmet'e yaz, kullanıcı direkt zimmet oluştursun
        return;
      }

      setSearchNotFound(false);
      setDocResult(docData);
      // Evrak VAR: Hızlı zimmet'e otomatik yazma, focus verme (kullanıcı isterse manuel kullanır)

      /* 🔹 TIMELINE */
      setTimelineLoading(true);
      const txRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/transactions/document/${docData.number}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const txData = await txRes.json();
      setTimeline(Array.isArray(txData) ? txData : []);
    } catch (e) {
      setSearchNotFound(false);
      setErrorMsg(getNetworkError());
    } finally {
      setIsLoading(false);
      setTimelineLoading(false);
    }
  };

  const handleKeyDownSearch = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") runSearch();
  };

  // ---- ZİMMETLEME ----
  const handleZimmet = async (overrideUserId?: string) => {
    setZimmetError("");
    setZimmetMessage("");
    setShowSuccessMessage(false);

    const finalUserId = overrideUserId || zimmetUserId;

    if (!zimmetNumber || !finalUserId) {
      setZimmetError("Tüm zimmet bilgilerini doldurun.");
      return;
    }

    setIsZimmetLoading(true);

    try {
      const token = getToken();

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/transactions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            documentNumber: zimmetNumber,
            toUserId: finalUserId,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setZimmetError(
          toUserFriendlyError(data?.message ?? "Zimmet işlemi başarısız.")
        );
        return;
      }

      setZimmetMessage("Zimmet başarıyla oluşturuldu!");
      setShowSuccessMessage(true);
      setZimmetUserId("");
      setZimmetUserSearch("");
      setZimmetNumber("");

      if (user?.id) refresh(getToken, user.id);

      // Timeline'ı yenile
      if (docResult) {
        const txRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/transactions/document/${docResult.number}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const txData = await txRes.json();
        setTimeline(Array.isArray(txData) ? txData : []);
      }
    } catch {
      setZimmetError(getNetworkError());
    } finally {
      setIsZimmetLoading(false);
    }
  };

  // ---- USER DROPDOWN KLAVYE NAVİGASYONU + ENTER İLE ZİMMET ----
  const handleUserInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsUserDropdownOpen(true);
      setHighlightIndex((prev) =>
        prev + 1 < filteredUsers.length ? prev + 1 : prev
      );
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setIsUserDropdownOpen(true);
      setHighlightIndex((prev) => (prev - 1 >= 0 ? prev - 1 : 0));
      return;
    }

    if (e.key === "Escape") {
      setIsUserDropdownOpen(false);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();

      // Eğer dropdown açıksa sadece seçimi yap (zimmetleme yapma)
      if (isUserDropdownOpen && filteredUsers.length > 0) {
        const selected = filteredUsers[highlightIndex];
        if (selected) {
          setZimmetUserId(selected.id);
          setZimmetUserSearch(
            `${selected.fullName} — ${selected.department ?? ""}`
          );
          setIsUserDropdownOpen(false);
        }
        return; // İlk Enter'da sadece seçim yap, zimmetleme yapma
      }

      // Dropdown kapalıysa, zimmet bilgileri dolu ise ENTER → zimmetle (2. Enter)
      if (zimmetNumber && zimmetUserId) {
        handleZimmet();
      }
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">
          <div className="space-y-2">
            <div className="h-7 w-56 rounded-md bg-muted animate-pulse" />
          </div>
          <div className="h-40 rounded-xl bg-muted/80 animate-pulse" />
          <div className="h-56 rounded-xl bg-muted/80 animate-pulse" />
        </main>
      </div>
    );
  }

  const scrollToEvrakSorgula = () => {
    document.getElementById("evrak-sorgula")?.scrollIntoView({ behavior: "smooth" });
    setTimeout(() => {
      const input = evrakInputRef.current?.querySelector("input");
      (input as HTMLInputElement | null)?.focus();
    }, 150);
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">
        <section className="grid gap-4 md:grid-cols-3">
          <QuickActionCard
            icon={<Search className="h-5 w-5" />}
            title="Evrak Sorgula"
            description="Bir evrağın kimde olduğunu anında öğren"
            onClick={scrollToEvrakSorgula}
          />
          <QuickActionCard
            icon={<Send className="h-5 w-5" />}
            title="Zimmet Oluştur"
            description="Yeni zimmet kaydı başlat"
            onClick={() => router.push("/zimmet")}
          />
          <QuickActionCard
            icon={<History className="h-5 w-5" />}
            title="Geçmişim"
            description="Tüm işlem geçmişini görüntüle"
            onClick={() => router.push("/gecmisim")}
            badge={
              isPendingCountLoading || pendingForMeCount > 0 ? (
                <PendingCountBadgeOrLoader
                  count={pendingForMeCount}
                  isLoading={isPendingCountLoading}
                />
              ) : undefined
            }
          />
        </section>

        <EvrakSorguCard
          docNumber={docNumber}
          setDocNumber={setDocNumber}
          runSearch={runSearch}
          isLoading={isLoading}
          errorMsg={errorMsg}
          searchNotFound={searchNotFound}
          docResult={docResult}
          timeline={timeline}
          timelineLoading={timelineLoading}
          userId={user.id}
          onOpenTimeline={() => setOpenTimeline(true)}
          onKeyDownSearch={handleKeyDownSearch}
          evrakInputRef={evrakInputRef}
        />

        {/* HIZLI ZİMMET FORMU */}
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-semibold">Hızlı Zimmet</CardTitle>
            <p className="text-sm text-muted-foreground">
              Evrak numarası ve kime zimmetleneceğini seçin
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Evrak numarası</label>
              <Input
                ref={zimmetInputRef}
                placeholder="Evrak numarası"
                value={zimmetNumber}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, "");
                  setZimmetNumber(value);
                }}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (zimmetNumber && zimmetUserId) handleZimmet();
                  }
                }}
                className="rounded-lg transition-colors focus-visible:ring-2 cursor-pointer"
              />
            </div>

            <div className="relative space-y-1.5" ref={dropdownRef}>
              <label className="text-sm font-medium">Kime zimmetlenecek?</label>
              <Input
                placeholder="İsim veya departman ile ara"
                value={zimmetUserSearch}
                onChange={(e) => {
                  setZimmetUserSearch(e.target.value);
                  setIsUserDropdownOpen(true);
                  setHighlightIndex(0);
                }}
                onFocus={() => setIsUserDropdownOpen(true)}
                onKeyDown={handleUserInputKeyDown}
                className="rounded-lg transition-colors focus-visible:ring-2 cursor-pointer"
              />
              {isUserDropdownOpen && filteredUsers.length > 0 && (
                <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border bg-card shadow-md">
                  {filteredUsers.map((u, index) => (
                    <div
                      key={u.id}
                      className={cn(
                        "cursor-pointer px-3 py-2 transition-colors",
                        index === highlightIndex ? "bg-primary/10" : "hover:bg-muted/50"
                      )}
                      onClick={() => {
                        setZimmetUserId(u.id);
                        setZimmetUserSearch(
                          `${u.fullName} — ${u.department ?? ""}`
                        );
                        setIsUserDropdownOpen(false);
                      }}
                    >
                      <div className="font-medium">{u.fullName}</div>
                      <div className="text-xs text-muted-foreground">
                        {u.department || "Departman yok"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button
              onClick={() => handleZimmet()}
              disabled={isZimmetLoading}
              className="w-full cursor-pointer rounded-lg transition-colors"
            >
              {isZimmetLoading ? "Zimmetleniyor..." : "Zimmetle"}
            </Button>

            {zimmetError && (
              <Alert variant="destructive" className="rounded-lg">
                <AlertDescription>{zimmetError}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* BAŞARI MESAJI */}
        <div
          className={cn(
            "overflow-hidden transition-all duration-300",
            showSuccessMessage ? "max-h-20 opacity-100" : "max-h-0 opacity-0"
          )}
        >
          {zimmetMessage && (
            <Alert className="rounded-lg bg-green-50 border-green-200 text-green-800">
              <AlertDescription className="flex items-center gap-2">
                <svg
                  className="h-5 w-5 text-green-600 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {zimmetMessage}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </main>

      {docResult && (
        <TimelineModal
          open={openTimeline}
          onOpenChange={setOpenTimeline}
          documentNumber={docResult.number}
          items={timeline as TimelineEvent[]}
          loading={timelineLoading}
        />
      )}
    </div>
  );
}
