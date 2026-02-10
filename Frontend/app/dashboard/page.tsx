"use client";

import {
  useState,
  useEffect,
  useRef,
  KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { type AuthState } from "@/store/authStore";

import { Search, Send, History, FileText, Loader2, FileX } from "lucide-react";
import { cn } from "@/lib/utils";
import { toUserFriendlyError, getNetworkError } from "@/lib/errorMessages";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Timeline } from "@/components/Timeline";
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

/* ================= PAGE ================= */

export default function DashboardPage() {
  const router = useRouter();
  const getToken = useAuthStore((s: AuthState) => s.getToken);
  const logout = useAuthStore((s: AuthState) => s.logout);

  const [user, setUser] = useState<UserMe | null>(null);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const [pendingCount, setPendingCount] = useState(0);

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

  /* ================= AUTH ================= */

  useEffect(() => {
    const token = getToken();
    if (!token) return router.push("/login");

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setUser)
      .catch(() => {
        logout();
        router.push("/login");
      });
  }, [getToken, logout, router]);

  /* ================= PENDING COUNT ================= */

  useEffect(() => {
    if (!user?.id) return;

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/transactions/me`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        const count = data.filter(
          (t) =>
            (t.toUser?.id === user.id || t.toUserId === user.id) &&
            t.status === "PENDING"
        ).length;
        setPendingCount(count);
      });
  }, [user?.id, getToken]);

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
        return;
      }

      setSearchNotFound(false);
      setDocResult(docData);
      setZimmetNumber(docData.number); // bulunan evrak → zimmet numarasına yaz

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

  const [contentVisible, setContentVisible] = useState(false);
  useEffect(() => {
    if (user) setContentVisible(true);
  }, [user]);

  if (!user) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
        <p className="mt-4 text-sm text-muted-foreground">Yükleniyor…</p>
      </div>
    );
  }

  const lastAccepted = [...timeline]
    .filter((t) => t.type === "TRANSACTION")
    .reverse()
    .find((t) => t.status === "ACCEPTED");

  const scrollToEvrakSorgula = () => {
    document.getElementById("evrak-sorgula")?.scrollIntoView({ behavior: "smooth" });
    setTimeout(() => {
      const input = evrakInputRef.current?.querySelector("input");
      (input as HTMLInputElement | null)?.focus();
    }, 150);
  };

  return (
    <div className="min-h-screen bg-background">
      <div
        className={cn(
          "transition-all duration-300",
          contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        )}
      >
      {/* STICKY HEADER */}
      <header className="sticky top-0 z-10 h-16 border-b bg-background">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
          <h1 className="font-semibold tracking-tight text-xl text-foreground">
            Zimmetly
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              {user.fullName}
              {user.role === "ADMIN" && (
                <Badge
                  variant="outline"
                  className="text-xs font-normal text-muted-foreground border-muted"
                >
                  Admin
                </Badge>
              )}
            </span>
            {user.role === "ADMIN" && (
              <Button
                variant="ghost"
                size="sm"
                className="cursor-pointer text-sm"
                onClick={() => router.push("/admin/users")}
                aria-label="Kullanıcı Yönetimi"
              >
                Kullanıcı Yönetimi
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              disabled={logoutLoading}
              className="cursor-pointer"
              onClick={() => {
                setLogoutLoading(true);
                logout();
                router.push("/login");
              }}
            >
              {logoutLoading ? "Çıkılıyor..." : "Çıkış Yap"}
            </Button>
          </div>
        </div>
      </header>

      {/* ANA ALAN */}
      <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">
        {/* HIZLI AKSİYON KARTLARI */}
        <section className="grid gap-4 sm:grid-cols-3">
          <button
            type="button"
            onClick={scrollToEvrakSorgula}
            className="group flex cursor-pointer flex-col items-start rounded-xl border bg-card p-5 text-left shadow-sm transition-all hover:shadow-md hover:bg-muted/30"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Search className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Evrak Sorgula</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Bir evrağın kimde olduğunu anında öğren
            </p>
          </button>

          <button
            type="button"
            onClick={() => router.push("/zimmet")}
            className="group flex cursor-pointer flex-col items-start rounded-xl border bg-card p-5 text-left shadow-sm transition-all hover:shadow-md hover:bg-muted/30"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Send className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Zimmet Oluştur</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Yeni zimmet kaydı başlat
            </p>
          </button>

          <button
            type="button"
            onClick={() => router.push("/gecmisim")}
            className="group relative flex cursor-pointer flex-col items-start rounded-xl border bg-card p-5 text-left shadow-sm transition-all hover:shadow-md hover:bg-muted/30"
          >
            {pendingCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute right-4 top-4 px-2 py-0.5 text-xs"
              >
                {pendingCount}
              </Badge>
            )}
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <History className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Geçmişim</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Tüm işlem geçmişini görüntüle
            </p>
          </button>
        </section>

        {/* EVRAK SORGULAMA */}
        <Card id="evrak-sorgula" className="rounded-xl border shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Evrak Sorgulama</CardTitle>
            <p className="text-sm text-muted-foreground">
              Evrak numarası ile sorgulayın
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div ref={evrakInputRef} className="flex flex-wrap gap-2 sm:flex-nowrap">
              <Input
                placeholder="Evrak numarası"
                value={docNumber}
                onChange={(e) =>
                  setDocNumber(e.target.value.replace(/\D/g, ""))
                }
                onKeyDown={handleKeyDownSearch}
                className="rounded-lg transition-colors focus-visible:ring-2 flex-1 min-w-0"
              />
              <Button
                onClick={runSearch}
                disabled={isLoading}
                className="cursor-pointer shrink-0 rounded-lg transition-colors"
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
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-muted/20 py-10 text-center">
                <FileX className="h-12 w-12 text-muted-foreground" />
                <p className="text-base text-muted-foreground">
                  Bu numaraya ait evrak bulunamadı
                </p>
              </div>
            )}

            {docResult && (
              <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
                {docResult.status === "ARCHIVED" && (
                  <div className="rounded-lg border bg-amber-50 p-3 text-sm text-amber-800">
                    <p className="font-medium">Bu evrak arşivlenmiştir</p>
                    <p>Arşivleyen: {docResult.archivedBy?.fullName ?? "-"}</p>
                    <p>
                      Tarih:{" "}
                      {docResult.archivedAt
                        ? formatDateTR(docResult.archivedAt)
                        : "-"}
                    </p>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    Evrak No:{" "}
                    <button
                      type="button"
                      onClick={() => setOpenTimeline(true)}
                      className="cursor-pointer underline-offset-2 transition-colors hover:underline hover:bg-muted/50 rounded px-1 -mx-1"
                    >
                      {docResult.number}
                    </button>
                  </p>
                  {lastAccepted && docResult.status !== "ARCHIVED" && (
                    <Badge>
                      En son kimde: {lastAccepted.toUser?.fullName}
                      {lastAccepted.toUser?.id === user?.id ? " (sende)" : ""}
                    </Badge>
                  )}
                  {docResult.status === "ARCHIVED" && (
                    <Badge variant="secondary">Arşivlendi</Badge>
                  )}
                </div>

                <div className="pt-3 border-t">
                  <p className="mb-3 text-lg font-semibold">Zimmet Geçmişi</p>

                  {timelineLoading && (
                    <p className="text-sm text-muted-foreground">
                      Yükleniyor...
                    </p>
                  )}

                  {!timelineLoading && timeline.length === 0 && docResult.status !== "ARCHIVED" && (
                    <div className="flex flex-col items-center justify-center gap-2 py-6 text-center rounded-lg border border-dashed border-muted-foreground/30 bg-muted/10">
                      <FileText className="h-10 w-10 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">
                        Bu evrak için henüz bir işlem yapılmamış
                      </p>
                    </div>
                  )}

                  {!timelineLoading && timeline.length > 0 && (
                    <div className="rounded-xl bg-muted/30 p-4">
                      <Timeline items={timeline} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

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
      </div>

      {docResult && (
        <TimelineModal
          open={openTimeline}
          onOpenChange={setOpenTimeline}
          documentNumber={docResult.number}
          items={timeline}
          loading={timelineLoading}
        />
      )}
    </div>
  );
}
