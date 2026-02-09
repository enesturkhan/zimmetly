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

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

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

  const [errorMsg, setErrorMsg] = useState("");
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
        setErrorMsg(docData.message || "Evrak bulunamadı.");
        return;
      }

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
    } catch {
      setErrorMsg("Bir hata oluştu.");
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
        setZimmetError(data.message || "Zimmet işlemi başarısız.");
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

  if (!user) return <p className="p-6">Yükleniyor...</p>;

  const lastAccepted = [...timeline]
    .filter((t) => t.type === "TRANSACTION")
    .reverse()
    .find((t) => t.status === "ACCEPTED");

  return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">
          Hoşgeldiniz, {user.fullName}
        </h2>
        <Button
          variant="destructive"
          disabled={logoutLoading}
          onClick={() => {
            setLogoutLoading(true);
            logout();
            router.push("/login");
          }}
        >
          Çıkış Yap
        </Button>
      </div>

      {/* MENU */}
      <div className="flex gap-3 items-center">
        <Button onClick={() => router.push("/zimmet")}>
          Zimmet Yap (Detaylı)
        </Button>

        <Button onClick={() => router.push("/gecmisim")} className="relative">
          Benim Geçmişim
          {pendingCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 px-2 py-0.5 text-xs"
            >
              {pendingCount}
            </Badge>
          )}
        </Button>

        {user.role === "ADMIN" && (
          <>
            <Button onClick={() => router.push("/admin/users")}>
              Kullanıcı Yönetimi
            </Button>
            <Button onClick={() => router.push("/admin/create-user")}>
              Yeni Kullanıcı
            </Button>
          </>
        )}
      </div>

      {/* EVRAK SORGULA */}
      <Card>
        <CardHeader>
          <CardTitle>Evrak Sorgula</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Evrak numarası"
              value={docNumber}
              onChange={(e) =>
                setDocNumber(e.target.value.replace(/\D/g, ""))
              }
              onKeyDown={handleKeyDownSearch}
            />
            <Button onClick={runSearch} 
            disabled={isLoading}
            className="cursor-pointer" >
              {isLoading ? "Aranıyor..." : "Ara"}
            </Button>
          </div>

          {errorMsg && (
            <Alert variant="destructive">
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          {docResult && (
            <div className="border rounded-md p-4 space-y-3">
              {docResult.status === "ARCHIVED" && (
                <div className="p-3 border rounded-md bg-amber-50 text-amber-800 text-sm">
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
              <div className="flex justify-between">
                <b>Evrak No: {docResult.number}</b>
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

              <div className="pt-2 border-t">
                <p className="font-medium mb-2">Zimmet Geçmişi</p>

                {timelineLoading && (
                  <p className="text-sm text-muted-foreground">
                    Yükleniyor...
                  </p>
                )}

                {!timelineLoading && timeline.length === 0 && docResult.status !== "ARCHIVED" && (
                  <p className="text-sm text-muted-foreground">
                    Zimmet kaydı yok.
                  </p>
                )}

                {timeline.map((item, idx) => {
                    if (item.type === "ARCHIVED") {
                      return (
                        <div
                          key={`archived-${item.createdAt}-${idx}`}
                          className="border rounded p-2 mb-2 text-sm bg-amber-50"
                        >
                          <div>
                            Evrak arşivlendi ({item.user?.fullName ?? "-"} tarafından)
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDateTR(item.createdAt)}
                          </div>
                          <Badge variant="secondary" className="mt-1">
                            Arşivlendi
                          </Badge>
                        </div>
                      );
                    }
                    if (item.type === "UNARCHIVED") {
                      return (
                        <div
                          key={`unarchived-${item.createdAt}-${idx}`}
                          className="border rounded p-2 mb-2 text-sm bg-green-50"
                        >
                          <div>Evrak arşivden çıkarıldı</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDateTR(item.createdAt)}
                          </div>
                          <Badge variant="outline" className="mt-1">
                            Arşivden çıkarıldı
                          </Badge>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={item.id ?? `tx-${idx}`}
                        className="border rounded p-2 mb-2 text-sm"
                      >
                        <div>
                          <b>{item.fromUser?.fullName}</b> →{" "}
                          <b>{item.toUser?.fullName}</b>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDateTR(item.createdAt)}
                        </div>
                        <Badge
                          variant={statusVariant(item.status)}
                          className="mt-1"
                        >
                          {statusLabelTR(item.status)}
                        </Badge>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* HIZLI ZİMMET FORMU */}
      <Card>
        <CardHeader>
          <CardTitle>Hızlı Zimmet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Evrak numarası */}
          <Input
            placeholder="Evrak numarası"
            value={zimmetNumber}
            onChange={(e) => {
              // Sadece rakamları kabul et
              const value = e.target.value.replace(/[^0-9]/g, "");
              setZimmetNumber(value);
            }}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter") {
                e.preventDefault();
                // Eğer hem evrak numarası hem de kullanıcı seçili ise zimmetle
                if (zimmetNumber && zimmetUserId) {
                  handleZimmet();
                }
              }
            }}
          />

          {/* Kullanıcı arama + dropdown */}
          <div className="relative" ref={dropdownRef}>
            <Input
              placeholder="Kime zimmetlenecek? (İsim / Departman)"
              value={zimmetUserSearch}
              onChange={(e) => {
                setZimmetUserSearch(e.target.value);
                setIsUserDropdownOpen(true);
                setHighlightIndex(0);
              }}
              onFocus={() => setIsUserDropdownOpen(true)}
              onKeyDown={handleUserInputKeyDown}
            />

            {isUserDropdownOpen && filteredUsers.length > 0 && (
              <div className="absolute z-10 bg-white border rounded-md mt-1 w-full max-h-60 overflow-y-auto shadow-md">
                {filteredUsers.map((u, index) => (
                  <div
                    key={u.id}
                    className={
                      "px-3 py-2 cursor-pointer " +
                      (index === highlightIndex
                        ? "bg-blue-100"
                        : "hover:bg-gray-100")
                    }
                    onClick={() => {
                      setZimmetUserId(u.id);
                      setZimmetUserSearch(
                        `${u.fullName} — ${u.department ?? ""}`
                      );
                      setIsUserDropdownOpen(false);
                    }}
                  >
                    <div className="font-medium">{u.fullName}</div>
                    <div className="text-xs text-gray-500">
                      {u.department || "Departman yok"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ZİMMETLE BUTTON */}
          <Button
            onClick={() => handleZimmet()}
            disabled={isZimmetLoading}
            className="w-full cursor-pointer"
          >
            {isZimmetLoading ? "Zimmetleniyor..." : "Zimmetle"}
          </Button>

          {zimmetError && (
            <Alert variant="destructive">
              <AlertDescription>{zimmetError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* BAŞARI MESAJI: ZİMMET BUTONUNUN ALTINDA, KARTIN DIŞINDA */}
      <div
        className={`overflow-hidden transition-all duration-300 ${
          showSuccessMessage ? "max-h-20 opacity-100 mt-2" : "max-h-0 opacity-0 mt-0"
        }`}
      >
        {zimmetMessage && (
          <Alert className="bg-green-50 border-green-200 text-green-800">
            <AlertDescription className="flex items-center gap-2">
              <svg
                className="h-5 w-5 text-green-600"
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
    </div>
  );
}
