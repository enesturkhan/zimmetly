app/dashboard/page.tsx
Kanka ben sana bu dosyayı vereyim sen bana güncel tam halini ver. 

"use client";

import { useState, useEffect, useRef, KeyboardEvent, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

type Role = "ADMIN" | "USER";

type UserMe = {
  id: string;
  fullName: string;
  role: Role;
};

type UserOption = {
  id: string;
  fullName: string;
  department: string | null;
};

type DocumentResponse = {
  number: string;
};

type TxItem = {
  id?: string;
  documentNumber?: string;
  status?: string;
  createdAt?: string;

  // nested user objects (most common)
  fromUser?: { id?: string; fullName?: string; department?: string | null };
  toUser?: { id?: string; fullName?: string; department?: string | null };

  // fallback fields (in case backend sends different keys)
  fromUserId?: string;
  toUserId?: string;
};

function formatDateTR(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function statusBadgeVariant(status?: string): "default" | "secondary" | "destructive" | "outline" {
  const s = (status || "").toUpperCase();
  if (s.includes("ACCEPT") || s.includes("APPROV") || s === "DONE" || s === "COMPLETED") return "default";
  if (s.includes("PEND") || s.includes("WAIT") || s === "CREATED") return "secondary";
  if (s.includes("REJECT") || s.includes("CANCEL") || s.includes("FAIL")) return "destructive";
  return "outline";
}

function statusLabelTR(status?: string) {
  const s = (status || "").toUpperCase();
  if (s.includes("ACCEPT") || s.includes("APPROV")) return "Kabul Edildi";
  if (s.includes("PEND") || s.includes("WAIT")) return "Beklemede";
  if (s.includes("REJECT")) return "Reddedildi";
  if (s.includes("RETURN")) return "İade";
  if (!status) return "Bilinmiyor";
  return status; // fallback
}

export default function DashboardPage() {
  const router = useRouter();
  const getToken = useAuthStore((s: any) => s.getToken);
  const logout = useAuthStore((s: any) => s.logout);

  const [logoutLoading, setLogoutLoading] = useState(false);

  const [user, setUser] = useState<UserMe | null>(null);

  // --- Evrak arama ---
  const [docNumber, setDocNumber] = useState("");
  const [docResult, setDocResult] = useState<DocumentResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // --- Timeline ---
  const [timeline, setTimeline] = useState<TxItem[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState("");

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

  // ---- USER FETCH ----
  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    async function fetchUser() {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (!res.ok) {
        logout();
        router.push("/login");
        return;
      }

      setUser(data);
    }

    fetchUser();
  }, [getToken, logout, router]);

  // ---- USER LIST FETCH (assignable) ----
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    async function fetchUsers() {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/assignable`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (Array.isArray(data)) setUsers(data);
    }

    fetchUsers();
  }, [getToken]);

  // ---- DROPDOWN DIŞINA TIKLAYINCA KAPATMA ----
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
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
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [showSuccessMessage]);

  const filteredUsers = useMemo(() => {
    const q = zimmetUserSearch.toLowerCase();
    return users.filter((u) => {
      return (
        u.fullName.toLowerCase().includes(q) ||
        (u.department || "").toLowerCase().includes(q)
      );
    });
  }, [users, zimmetUserSearch]);

  // ---- EVRAK ARAMA ----
  const runSearch = async () => {
    setErrorMsg("");
    setDocResult(null);

    // timeline reset
    setTimeline([]);
    setTimelineError("");

    const trimmed = docNumber.trim();

    if (!trimmed) {
      setErrorMsg("Evrak numarası giriniz.");
      return;
    }

    if (!/^[0-9]+$/.test(trimmed)) {
      setErrorMsg("Sadece numara giriniz.");
      return;
    }

    setIsLoading(true);

    try {
      const token = getToken();

      // 1) Document fetch
      const docRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/documents/${trimmed}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const docData = await docRes.json();

      if (!docRes.ok) {
        setErrorMsg(docData.message || "Evrak bulunamadı.");
        setZimmetNumber(trimmed);
        setDocNumber("");
        return;
      }

      setDocResult(docData);
      setZimmetNumber(docData.number);
      setDocNumber("");

      // 2) Timeline fetch
      setTimelineLoading(true);
      const txRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/transactions/document/${trimmed}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const txData = await txRes.json();

      if (!txRes.ok) {
        setTimelineError(txData.message || "Timeline çekilemedi.");
        setTimeline([]);
      } else {
        setTimeline(Array.isArray(txData) ? txData : []);
      }
    } catch (e) {
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
  const handleZimmet = async () => {
    setZimmetError("");
    setZimmetMessage("");
    setShowSuccessMessage(false);

    if (!zimmetNumber || !zimmetUserId) {
      setZimmetError("Tüm zimmet bilgilerini doldurun.");
      return;
    }

    setIsZimmetLoading(true);

    try {
      const token = getToken();

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/transactions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentNumber: zimmetNumber,
          toUserId: zimmetUserId,
        }),
      });

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

      // (İsteğe bağlı) Eğer aranan evrak buyduysa, timeline'ı yenile:
      if (docResult?.number) {
        // hafif gecikmeyle backend yazsın
        setTimeout(() => runSearch(), 250);
      }
    } finally {
      setIsZimmetLoading(false);
    }
  };

  // ---- USER DROPDOWN KLAVYE NAVİGASYONU + 2x ENTER ----
  const handleUserInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsUserDropdownOpen(true);
      setHighlightIndex((prev) => (prev + 1 < filteredUsers.length ? prev + 1 : prev));
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

      // 1. Enter: dropdown açıksa seçim yap
      if (isUserDropdownOpen && filteredUsers.length > 0) {
        const selected = filteredUsers[highlightIndex];
        if (selected) {
          setZimmetUserId(selected.id);
          setZimmetUserSearch(`${selected.fullName} — ${selected.department ?? ""}`);
          setIsUserDropdownOpen(false);
        }
        return;
      }

      // 2. Enter: dropdown kapalıysa ve alanlar doluysa zimmetle
      if (zimmetNumber && zimmetUserId) handleZimmet();
    }
  };

  // ---- ÇIKIŞ YAP ----
  const handleLogout = () => {
    setLogoutLoading(true);
    setTimeout(() => {
      logout();
      router.push("/login");
    }, 500);
  };

  if (!user) return <p className="p-6">Yükleniyor...</p>;

  // ---- Özet: Şu an kimde / durum (timeline'dan hesap) ----
  const lastTx = timeline.length > 0 ? timeline[timeline.length - 1] : null;
  const currentStatus = lastTx?.status ? statusLabelTR(lastTx.status) : "-";
  const currentHolderName =
    lastTx?.toUser?.fullName ||
    (lastTx?.toUserId ? `User: ${lastTx.toUserId}` : "-");

  return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto space-y-6">
      {/* NAVBAR */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Hoşgeldiniz, {user.fullName}</h2>

        <Button variant="destructive" disabled={logoutLoading} onClick={handleLogout} className="cursor-pointer">
          {logoutLoading ? "Çıkış yapılıyor..." : "Çıkış Yap"}
        </Button>
      </div>

      {/* ÜST MENÜ */}
      <div className="flex gap-3">
        <Button onClick={() => router.push("/zimmet")} className="cursor-pointer">Zimmet Yap (Detaylı)</Button>
        <Button onClick={() => router.push("/gecmisim")} className="cursor-pointer">Geçmişim</Button>

        {user.role === "ADMIN" && (
          <>
            <Button onClick={() => router.push("/admin/users")} className="cursor-pointer">Kullanıcı Yönetimi</Button>
            <Button onClick={() => router.push("/admin/create-user")} className="cursor-pointer">Yeni Kullanıcı</Button>
          </>
        )}
      </div>

      {/* EVRAK ARAMA */}
      <Card>
        <CardHeader>
          <CardTitle>Evrak Sorgula</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Evrak numarası girin"
              value={docNumber}
              onKeyDown={handleKeyDownSearch}
              onChange={(e) => setDocNumber(e.target.value.replace(/[^0-9]/g, ""))}
            />
            <Button onClick={runSearch} disabled={isLoading} className="cursor-pointer">
              {isLoading ? "Aranıyor..." : "Ara"}
            </Button>
          </div>

          {errorMsg && (
            <Alert variant="destructive">
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          {/* Evrak özeti + timeline */}
          {docResult && (
            <div className="border rounded-md p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p>
                    <b>Evrak No:</b> {docResult.number}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="mr-2">Şu an:</span>
                    <b>{currentHolderName}</b>
                  </p>
                </div>

                <Badge variant={statusBadgeVariant(lastTx?.status)}>
                  {lastTx?.status ? statusLabelTR(lastTx.status) : "İşlem yok"}
                </Badge>
              </div>

              <div className="pt-2 border-t">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium">Zimmet Timeline</p>
                  {timelineLoading && (
                    <span className="text-xs text-muted-foreground">Yükleniyor...</span>
                  )}
                </div>

                {timelineError && (
                  <Alert variant="destructive">
                    <AlertDescription>{timelineError}</AlertDescription>
                  </Alert>
                )}

                {!timelineLoading && !timelineError && timeline.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Bu evrak için henüz bir zimmet kaydı yok.
                  </p>
                )}

                {!timelineLoading && timeline.length > 0 && (
                  <div className="space-y-3">
                    {timeline
                      .slice()
                      .reverse()
                      .map((tx, idx) => (
                        <div key={tx.id || idx} className="border rounded-md p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="text-sm">
                                <b>{tx.fromUser?.fullName || "?"}</b>
                                <span className="mx-2">→</span>
                                <b>{tx.toUser?.fullName || "?"}</b>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatDateTR(tx.createdAt)}
                              </div>
                            </div>

                            <Badge variant={statusBadgeVariant(tx.status)}>
                              {statusLabelTR(tx.status)}
                            </Badge>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* HIZLI ZİMMET */}
      <Card>
        <CardHeader>
          <CardTitle>Hızlı Zimmet</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <Input
            placeholder="Evrak numarası"
            value={zimmetNumber}
            onChange={(e) => setZimmetNumber(e.target.value.replace(/[^0-9]/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (zimmetNumber && zimmetUserId) handleZimmet();
              }
            }}
          />

          <div className="relative" ref={dropdownRef}>
            <Input
              placeholder="Kime zimmetlenecek? (İsim / Departman)"
              value={zimmetUserSearch}
              onChange={(e) => {
                setZimmetUserSearch(e.target.value);
                setIsUserDropdownOpen(true);
                setHighlightIndex(0);
              }}
              onClick={() => setIsUserDropdownOpen(true)}
              onKeyDown={handleUserInputKeyDown}
            />

            {isUserDropdownOpen && filteredUsers.length > 0 && (
              <div className="absolute z-10 bg-white border rounded-md mt-1 w-full max-h-60 overflow-y-auto shadow-md">
                {filteredUsers.map((u, index) => (
                  <div
                    key={u.id}
                    className={
                      "px-3 py-2 cursor-pointer " +
                      (index === highlightIndex ? "bg-blue-100" : "hover:bg-gray-100")
                    }
                    onMouseEnter={() => setHighlightIndex(index)}
                    onClick={() => {
                      setZimmetUserId(u.id);
                      setZimmetUserSearch(`${u.fullName} — ${u.department ?? ""}`);
                      setIsUserDropdownOpen(false);
                    }}
                  >
                    <div className="font-medium">{u.fullName}</div>
                    <div className="text-xs text-gray-500">{u.department || "Departman yok"}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button onClick={handleZimmet} disabled={isZimmetLoading} className="w-full cursor-pointer">
            {isZimmetLoading ? "Zimmetleniyor..." : "Zimmetle"}
          </Button>

          {zimmetError && (
            <Alert variant="destructive">
              <AlertDescription>{zimmetError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Başarı mesajı (kart dışı) */}
      <div
        className={`overflow-hidden transition-all duration-300 ${
          showSuccessMessage ? "max-h-20 opacity-100 mt-2" : "max-h-0 opacity-0 mt-0"
        }`}
      >
        {zimmetMessage && (
          <Alert className="bg-green-50 border-green-200 text-green-800">
            <AlertDescription className="flex items-center gap-2">
              <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {zimmetMessage}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
