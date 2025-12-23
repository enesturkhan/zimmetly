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
  fromUser?: { id?: string; fullName?: string; department?: string | null };
  toUser?: { id?: string; fullName?: string; department?: string | null };
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

function statusBadgeVariant(
  status?: string
): "default" | "secondary" | "destructive" | "outline" {
  const s = (status || "").toUpperCase();
  if (s === "ACCEPTED") return "default";
  if (s === "PENDING") return "secondary";
  if (s === "REJECTED" || s === "CANCELLED") return "destructive";
  return "outline";
}

function statusLabelTR(status?: string) {
  switch ((status || "").toUpperCase()) {
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

export default function DashboardPage() {
  const router = useRouter();
  const getToken = useAuthStore((s: any) => s.getToken);
  const logout = useAuthStore((s: any) => s.logout);

  const [user, setUser] = useState<UserMe | null>(null);
  const [logoutLoading, setLogoutLoading] = useState(false);

  // Evrak arama
  const [docNumber, setDocNumber] = useState("");
  const [docResult, setDocResult] = useState<DocumentResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Timeline
  const [timeline, setTimeline] = useState<TxItem[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState("");

  // Zimmet
  const [zimmetNumber, setZimmetNumber] = useState("");
  const [zimmetUserId, setZimmetUserId] = useState("");
  const [zimmetUserSearch, setZimmetUserSearch] = useState("");
  const [zimmetError, setZimmetError] = useState("");
  const [zimmetMessage, setZimmetMessage] = useState("");
  const [isZimmetLoading, setIsZimmetLoading] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  // User dropdown
  const [users, setUsers] = useState<UserOption[]>([]);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // ---------------- AUTH ----------------
  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setUser(d))
      .catch(() => {
        logout();
        router.push("/login");
      });
  }, []);

  // ---------------- USERS ----------------
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/assignable`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setUsers(d));
  }, []);

  const filteredUsers = useMemo(() => {
    const q = zimmetUserSearch.toLowerCase();
    return users.filter(
      (u) =>
        u.fullName.toLowerCase().includes(q) ||
        (u.department || "").toLowerCase().includes(q)
    );
  }, [users, zimmetUserSearch]);

  // ---------------- SEARCH ----------------
  const runSearch = async () => {
    setErrorMsg("");
    setDocResult(null);
    setTimeline([]);
    setTimelineError("");

    const trimmed = docNumber.trim();
    if (!trimmed) {
      setErrorMsg("Evrak numarası giriniz.");
      return;
    }

    setIsLoading(true);
    try {
      const token = getToken();

      const docRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/documents/${trimmed}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const doc = await docRes.json();
      if (!docRes.ok) throw new Error(doc.message);

      setDocResult(doc);
      setZimmetNumber(doc.number);
      setDocNumber("");

      setTimelineLoading(true);
      const txRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/transactions/document/${doc.number}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const tx = await txRes.json();
      setTimeline(Array.isArray(tx) ? tx : []);
    } catch (e: any) {
      setErrorMsg(e.message || "Evrak bulunamadı");
    } finally {
      setIsLoading(false);
      setTimelineLoading(false);
    }
  };

  // ---------------- ZİMMET ----------------
  const handleZimmet = async () => {
    setZimmetError("");
    setZimmetMessage("");
    setShowSuccessMessage(false);

    if (!zimmetNumber || !zimmetUserId) {
      setZimmetError("Evrak ve kullanıcı seçilmelidir");
      return;
    }

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
      if (!res.ok) throw new Error(data.message);

      setZimmetMessage("Zimmet başarıyla oluşturuldu");
      setShowSuccessMessage(true);
      setZimmetNumber("");
      setZimmetUserId("");
      setZimmetUserSearch("");

      if (docResult?.number) setTimeout(runSearch, 300);
    } catch (e: any) {
      setZimmetError(e.message);
    }
  };

  if (!user) return <div className="p-6">Yükleniyor...</div>;

  const lastTx = timeline[timeline.length - 1];

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Hoşgeldin, {user.fullName}</h2>
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
      <div className="flex gap-2">
        <Button onClick={() => router.push("/gecmisim")}>Geçmişim</Button>
        {user.role === "ADMIN" && (
          <Button onClick={() => router.push("/admin/users")}>
            Kullanıcı Yönetimi
          </Button>
        )}
      </div>

      {/* EVRAK SORGULA */}
      <Card>
        <CardHeader>
          <CardTitle>Evrak Sorgula</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Evrak numarası"
              value={docNumber}
              onChange={(e) => setDocNumber(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
            />
            <Button onClick={runSearch} disabled={isLoading}>
              Ara
            </Button>
          </div>

          {errorMsg && (
            <Alert variant="destructive">
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          {docResult && (
            <div className="border rounded p-3 space-y-2">
              <div className="flex justify-between">
                <b>Evrak No: {docResult.number}</b>
                <Badge variant={statusBadgeVariant(lastTx?.status)}>
                  {statusLabelTR(lastTx?.status)}
                </Badge>
              </div>

              {timeline.map((t) => (
                <div key={t.id} className="text-sm border-t pt-2">
                  {t.fromUser?.fullName} → {t.toUser?.fullName} |{" "}
                  {statusLabelTR(t.status)} | {formatDateTR(t.createdAt)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* HIZLI ZİMMET */}
      <Card>
        <CardHeader>
          <CardTitle>Hızlı Zimmet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Evrak numarası"
            value={zimmetNumber}
            onChange={(e) => setZimmetNumber(e.target.value.replace(/\D/g, ""))}
          />

          <div className="relative" ref={dropdownRef}>
            <Input
              placeholder="Kime zimmetlenecek"
              value={zimmetUserSearch}
              onChange={(e) => {
                setZimmetUserSearch(e.target.value);
                setIsUserDropdownOpen(true);
              }}
            />

            {isUserDropdownOpen && filteredUsers.length > 0 && (
              <div className="absolute bg-white border w-full mt-1 rounded shadow">
                {filteredUsers.map((u) => (
                  <div
                    key={u.id}
                    className="px-3 py-2 cursor-pointer hover:bg-blue-100"
                    onClick={() => {
                      setZimmetUserId(u.id);
                      setZimmetUserSearch(u.fullName);
                      setIsUserDropdownOpen(false);
                    }}
                  >
                    {u.fullName} — {u.department}
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button onClick={handleZimmet} disabled={isZimmetLoading}>
            Zimmetle
          </Button>

          {zimmetError && (
            <Alert variant="destructive">
              <AlertDescription>{zimmetError}</AlertDescription>
            </Alert>
          )}

          {showSuccessMessage && (
            <Alert className="bg-green-50">
              <AlertDescription>{zimmetMessage}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
