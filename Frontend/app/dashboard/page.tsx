"use client";

import {
  useState,
  useEffect,
  useRef,
  KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
};

export default function DashboardPage() {
  const router = useRouter();
  const getToken = useAuthStore((s: any) => s.getToken);
  const logout = useAuthStore((s: any) => s.logout);

  const [logoutLoading, setLogoutLoading] = useState(false);

  const [user, setUser] = useState<UserMe | null>(null);
  const [docNumber, setDocNumber] = useState("");
  const [docResult, setDocResult] = useState<DocumentResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // ---- ZİMMET FORMU ----
  const [zimmetNumber, setZimmetNumber] = useState("");
  const [zimmetError, setZimmetError] = useState("");
  const [zimmetMessage, setZimmetMessage] = useState("");
  const [isZimmetLoading, setIsZimmetLoading] = useState(false);

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

  // ---- USER LIST FETCH ----
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    async function fetchUsers() {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (Array.isArray(data)) {
        setUsers(data);
      }
    }

    fetchUsers();
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

  // ---- USER FİLTRE (ARAMA) ----
  const filteredUsers = users
    .filter((u) => u.id !== user?.id) // 👈 Login kullanıcıyı listeden kaldır
    .filter((u) => {
      const q = zimmetUserSearch.toLowerCase();
      return (
        u.fullName.toLowerCase().includes(q) ||
        (u.department || "").toLowerCase().includes(q)
      );
    });

  // ---- EVRAK ARAMA ----
  const runSearch = async () => {
    setErrorMsg("");
    setDocResult(null);

    const trimmed = docNumber.trim();

    if (!trimmed) {
      setErrorMsg("Evrak numarası giriniz.");
      return;
    }

    if (!/^[0-9]+$/.test(trimmed)) {
      setErrorMsg("Sadece rakam giriniz.");
      return;
    }

    setIsLoading(true);

    try {
      const token = getToken();

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/documents/${trimmed}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.message || "Evrak bulunamadı.");
        setZimmetNumber(trimmed);
        setDocNumber("");
        return;
      }

      setDocResult(data);
      setZimmetNumber(data.number);
      setDocNumber(""); // Arama inputunu temizle
    } catch {
      setErrorMsg("Bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  // ENTER ile arama
  const handleKeyDownSearch = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      runSearch();
    }
  };

  // ---- USER DROPDOWN KLAVYE NAVİGASYONU ----
  const handleUserDropdownKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isUserDropdownOpen) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) =>
        prev + 1 < filteredUsers.length ? prev + 1 : prev
      );
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) => (prev - 1 >= 0 ? prev - 1 : 0));
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const selected = filteredUsers[highlightIndex];
      if (selected) {
        setZimmetUserId(selected.id);
        setZimmetUserSearch(
          `${selected.fullName} — ${selected.department ?? ""}`
        );
      }
      setIsUserDropdownOpen(false);
    }

    if (e.key === "Escape") {
      setIsUserDropdownOpen(false);
    }
  };

  // ---- ZİMMETLEME ----
  const handleZimmet = async () => {
    setZimmetError("");
    setZimmetMessage("");

    if (!zimmetNumber || !zimmetUserId) {
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
            toUserId: zimmetUserId,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setZimmetError(data.message || "Zimmet işlemi başarısız.");
        return;
      }

      setZimmetMessage("Zimmet başarıyla oluşturuldu!");
      setZimmetUserId("");
      setZimmetUserSearch("");
    } finally {
      setIsZimmetLoading(false);
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

  return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto space-y-6">
      {/* NAVBAR */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Hoşgeldiniz, {user.fullName}</h2>

        <Button
          variant="destructive"
          disabled={logoutLoading}
          onClick={handleLogout}
        >
          {logoutLoading ? "Çıkış yapılıyor..." : "Çıkış Yap"}
        </Button>
      </div>

      {/* ÜST MENÜ */}
      <div className="flex gap-3">
        <Button onClick={() => router.push("/zimmet")}>Zimmet Yap (Detaylı)</Button>
        <Button onClick={() => router.push("/gecmisim")}>Benim Geçmişim</Button>

        {user.role === "ADMIN" && (
          <>
            <Button onClick={() => router.push("/admin/users")}>Kullanıcı Yönetimi</Button>
            <Button onClick={() => router.push("/admin/create-user")}>Yeni Kullanıcı</Button>
          </>
        )}
      </div>

      {/* --- EVRAK ARAMA --- */}
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
              onChange={(e) => setDocNumber(e.target.value)}
            />
            <Button onClick={runSearch} disabled={isLoading}>
              {isLoading ? "Aranıyor..." : "Ara"}
            </Button>
          </div>

          {errorMsg && (
            <Alert variant="destructive">
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          {docResult && (
            <div className="border rounded-md p-4">
              <p><b>Evrak No:</b> {docResult.number}</p>
              <p className="text-sm text-gray-500 mt-1">
                Zimmet geçmişi henüz bu ekrana bağlı değil.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* --- HIZLI ZİMMET FORMU --- */}
      <Card>
        <CardHeader>
          <CardTitle>Hızlı Zimmet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Evrak numarası */}
          <Input
            placeholder="Evrak numarası"
            value={zimmetNumber}
            onChange={(e) => setZimmetNumber(e.target.value)}
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
              onKeyDown={(e) => {
                setIsUserDropdownOpen(true);   // 👈 ÖNEMLİ! Dropdown açık değilse key event çalışmaz.
                handleUserDropdownKey(e);
              }}
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
            onClick={handleZimmet}
            disabled={isZimmetLoading}
            className="w-full"
          >
            {isZimmetLoading ? "Zimmetleniyor..." : "Zimmetle"}
          </Button>

          {zimmetError && (
            <Alert variant="destructive">
              <AlertDescription>{zimmetError}</AlertDescription>
            </Alert>
          )}

          {zimmetMessage && (
            <Alert>
              <AlertDescription>{zimmetMessage}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
