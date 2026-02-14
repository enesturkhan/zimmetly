"use client";

import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useTransactionsStore } from "@/store/transactionsStore";
import { toUserFriendlyError, getNetworkError } from "@/lib/errorMessages";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

type UserOption = {
  id: string;
  fullName: string;
  department: string | null;
};

export default function ZimmetDetailPage() {
  const router = useRouter();
  const getToken = useAuthStore((s) => s.getToken);
  const refresh = useTransactionsStore((s) => s.refresh);

  const firstInputRef = useRef<HTMLInputElement | null>(null);

  // ---- FORM STATE ----
  const [docNumber, setDocNumber] = useState("");
  const [zimmetNote, setZimmetNote] = useState("");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userId, setUserId] = useState("");

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [success, setSuccess] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // ---- INPUT FOCUS ON LOAD ----
  useEffect(() => {
    if (firstInputRef.current) firstInputRef.current.focus();
  }, []);

  // ---- FETCH USERS ----
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    async function load() {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/assignable`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) setUsers(data);
    }
    load();
  }, [getToken]);

  // ---- FETCH CURRENT USER (SELF) ----
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    async function loadMe() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data?.id) {
          setCurrentUserId(data.id);
        }
      } catch {
        // ignore
      }
    }

    loadMe();
  }, [getToken]);

  // ---- FILTER USERS ----
  const filteredUsers = users.filter((u) => {
    if (currentUserId && u.id === currentUserId) return false; // kendine zimmet engeli
    const q = userSearch.toLowerCase();
    return (
      u.fullName.toLowerCase().includes(q) ||
      (u.department || "").toLowerCase().includes(q)
    );
  });

  // ---- KLAVYE NAVİGASYONU ----
  const onUserKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsDropdownOpen(true);
      setHighlightIndex((p) =>
        p + 1 < filteredUsers.length ? p + 1 : p
      );
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setIsDropdownOpen(true);
      setHighlightIndex((p) => (p - 1 >= 0 ? p - 1 : 0));
      return;
    }

    if (e.key === "Escape") {
      setIsDropdownOpen(false);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      
      // Eğer dropdown açıksa önce seçimi yap
      if (isDropdownOpen && filteredUsers.length > 0) {
        const selected = filteredUsers[highlightIndex];
        if (selected) {
          setUserId(selected.id);
          setUserSearch(`${selected.fullName} — ${selected.department ?? ""}`);
          setIsDropdownOpen(false);
          
          // Seçimden sonra da zimmetle - seçilen ID'yi direkt geç
          if (docNumber && selected.id) {
            handleSubmit(selected.id);
          }
        }
      } else {
        // Dropdown kapalıysa, zimmet bilgileri dolu ise ENTER → zimmetle
        if (docNumber && userId) {
          handleSubmit();
        }
      }
    }
  };

  // ---- CLICK OUTSIDE TO CLOSE ----
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // ---- BAŞARI MESAJI OTOMATİK KAYBOLMA ----
  useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => {
        setShowSuccess(false);
        setSuccess("");
      }, 3000); // 3 saniye sonra kaybol

      return () => clearTimeout(timer);
    }
  }, [showSuccess]);

  // ---- ZİMMETLEME ----
  const handleSubmit = async (overrideUserId?: string) => {
    setErrorMsg("");
    setSuccess("");
    setShowSuccess(false);

    const finalUserId = overrideUserId || userId;

    if (!docNumber || !finalUserId) {
      setErrorMsg("Lütfen tüm alanları doldurun.");
      return;
    }

    // Kendi kendine zimmet engeli
    if (currentUserId && finalUserId === currentUserId) {
      setErrorMsg("Kendinize zimmet oluşturamazsınız.");
      return;
    }

    setIsLoading(true);

    try {
      const token = getToken();

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/transactions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          zimmetNote.trim()
            ? { documentNumber: docNumber, toUserId: finalUserId, note: zimmetNote.trim() }
            : { documentNumber: docNumber, toUserId: finalUserId },
        ),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(
          toUserFriendlyError(data?.message ?? "Zimmet oluşturulamadı.")
        );
        return;
      }

      setSuccess("Zimmet başarıyla oluşturuldu!");
      setShowSuccess(true);
      setUserId("");
      setUserSearch("");
      setDocNumber("");
      setZimmetNote("");
      if (currentUserId) refresh(getToken, currentUserId);
    } catch {
      setErrorMsg(getNetworkError());
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6 max-w-xl mx-auto space-y-6">

      {/* BAŞLIK + GERİ DÖN */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Ayrıntılı Zimmet</h2>
        <Button 
          variant="secondary" 
          onClick={() => {
            setDashboardLoading(true);
            router.push("/dashboard");
          }}
          disabled={dashboardLoading}
          className="cursor-pointer"
        >
          {dashboardLoading ? "Yönlendiriliyor..." : "← Dashboard"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Zimmet Formu</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* ----- EVRAK NUMARASI ----- */}
          <Input
            ref={firstInputRef}
            placeholder="Evrak numarası"
            value={docNumber}
            onChange={(e) => setDocNumber(e.target.value)}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter") {
                e.preventDefault();
                // Eğer hem evrak numarası hem de kullanıcı seçili ise zimmetle
                if (docNumber && userId) {
                  handleSubmit();
                }
              }
            }}
          />

          {/* ----- USER SEARCH ----- */}
          <div className="relative" ref={dropdownRef}>
            <Input
              placeholder="Kime zimmetlenecek? (İsim / Departman)"
              value={userSearch}
              onChange={(e) => {
                setUserSearch(e.target.value);
                setIsDropdownOpen(true);
                setHighlightIndex(0);
              }}
              onFocus={() => setIsDropdownOpen(true)}
              onKeyDown={onUserKey}
            />

            {isDropdownOpen && filteredUsers.length > 0 && (
              <div className="absolute bg-white border rounded-md w-full shadow-md max-h-60 overflow-y-auto z-10">
                {filteredUsers.map((u, index) => (
                  <div
                    key={u.id}
                    className={`px-3 py-2 cursor-pointer ${
                      index === highlightIndex
                        ? "bg-blue-100"
                        : "hover:bg-gray-100"
                    }`}
                    onClick={() => {
                      setUserId(u.id);
                      setUserSearch(`${u.fullName} — ${u.department ?? ""}`);
                      setIsDropdownOpen(false);
                    }}
                  >
                    <div className="font-medium">{u.fullName}</div>
                    <div className="text-xs text-gray-500">
                      {u.department ?? "Departman yok"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Zimmet Notu (opsiyonel)</label>
            <textarea
              value={zimmetNote}
              onChange={(e) => setZimmetNote(e.target.value)}
              placeholder="İsteğe bağlı açıklama"
              className="w-full min-h-[90px] resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isLoading}
            />
          </div>

          {/* ---- SUBMIT BUTTON ---- */}
          <Button
            onClick={() => handleSubmit()}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? "Zimmetleniyor..." : "Zimmetle"}
          </Button>

          {/* ---- ERROR MESSAGE ---- */}
          {errorMsg && (
            <Alert variant="destructive">
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* ---- BAŞARI MESAJI: FORM DIŞINDA, ANİMASYONLU ---- */}
      <div
        className={`overflow-hidden transition-all duration-500 ease-in-out ${
          showSuccess ? "max-h-20 opacity-100 mt-2" : "max-h-0 opacity-0 mt-0"
        }`}
      >
        {success && (
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
              {success}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
