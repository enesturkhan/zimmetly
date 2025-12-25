"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Loader2 } from "lucide-react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

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

  fromUser?: { id: string; fullName: string };
  toUser?: { id: string; fullName: string };

  fromUserId?: string;
  toUserId?: string;
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

function statusVariant(
  status?: string
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "ACCEPTED") return "default";
  if (status === "PENDING") return "secondary";
  if (status === "REJECTED" || status === "CANCELLED") return "destructive";
  return "outline";
}

/* ================= ENDPOINTS ================= */

const API = {
  mine: () => `${process.env.NEXT_PUBLIC_API_URL}/transactions/me`,
  accept: (id: string) =>
    `${process.env.NEXT_PUBLIC_API_URL}/transactions/${id}/accept`,
  reject: (id: string) =>
    `${process.env.NEXT_PUBLIC_API_URL}/transactions/${id}/reject`,
  returnTx: (id: string) =>
    `${process.env.NEXT_PUBLIC_API_URL}/transactions/${id}/return`,
  createTx: () => `${process.env.NEXT_PUBLIC_API_URL}/transactions`,
  users: () => `${process.env.NEXT_PUBLIC_API_URL}/users/assignable`,
};

/* ================= PAGE ================= */

export default function GecmisimPage() {
  const router = useRouter();
  const getToken = useAuthStore((s: any) => s.getToken);
  const logout = useAuthStore((s: any) => s.logout);

  const [me, setMe] = useState<Me | null>(null);
  const [items, setItems] = useState<TxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  /* ---- Modal state ---- */
  const [open, setOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<TxItem | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [toUserId, setToUserId] = useState("");
  const [userSearch, setUserSearch] = useState("");

  /* ================= AUTH ================= */

  useEffect(() => {
    const token = getToken();
    if (!token) return router.push("/login");

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setMe)
      .catch(() => {
        logout();
        router.push("/login");
      });
  }, [getToken, logout, router]);

  /* ================= DATA ================= */

  const fetchMine = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(API.mine(), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Veri yüklenemedi");
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message || "Sunucuya bağlanılamadı");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (me) fetchMine();
  }, [me]);

  /* ================= ACTIONS ================= */

  const runAction = async (tx: TxItem, type: "accept" | "reject" | "return") => {
    setActionLoading(tx.id);
    const url =
      type === "accept"
        ? API.accept(tx.id)
        : type === "reject"
        ? API.reject(tx.id)
        : API.returnTx(tx.id);

    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "İşlem başarısız");
        return;
      }

      await fetchMine();
    } catch {
      setError("Sunucuya bağlanılamadı");
    } finally {
      setActionLoading(null);
    }
  };

  /* ================= ZİMMET MODAL ================= */

  const openZimmetModal = async (tx: TxItem) => {
    setSelectedTx(tx);
    setOpen(true);
    setUserSearch("");
    setToUserId("");

    try {
      const res = await fetch(API.users(), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      
      // Kendine zimmet engeli: me.id'yi filtrele
      const filtered = Array.isArray(data)
        ? data.filter((u: UserOption) => u.id !== me?.id)
        : [];
      setUsers(filtered);
    } catch {
      setError("Kullanıcılar yüklenemedi");
    }
  };

  const sendZimmet = async () => {
    if (!selectedTx || !toUserId) {
      setError("Lütfen kullanıcı seçin");
      return;
    }

    // Kendine zimmet engeli (ekstra güvenlik)
    if (me?.id && toUserId === me.id) {
      setError("Kendinize zimmet oluşturamazsınız");
      return;
    }

    setError("");
    setActionLoading("zimmet");

    try {
      const res = await fetch(API.createTx(), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentNumber: selectedTx.documentNumber,
          toUserId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Zimmet oluşturulamadı");
        return;
      }

      setOpen(false);
      setToUserId("");
      setSelectedTx(null);
      setUserSearch("");
      await fetchMine();
    } catch {
      setError("Sunucuya bağlanılamadı");
    } finally {
      setActionLoading(null);
    }
  };

  // Filter users for search
  const filteredUsers = useMemo(() => {
    if (!userSearch) return users;
    const q = userSearch.toLowerCase();
    return users.filter(
      (u) =>
        u.fullName.toLowerCase().includes(q) ||
        (u.department || "").toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  if (!me) return <div className="p-6">Yükleniyor...</div>;

  /* ================= UI ================= */

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex justify-between">
        <h2 className="text-xl font-semibold">Geçmişim</h2>
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          Dashboard
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {!loading && items.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Henüz zimmet kaydı bulunmuyor.
          </CardContent>
        </Card>
      )}

      {items.map((tx) => {
        const isPending = tx.status === "PENDING";
        const isAccepted = tx.status === "ACCEPTED";
        const isLoading = actionLoading === tx.id;

        return (
          <Card key={tx.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between">
                <b>Evrak No: {tx.documentNumber}</b>
                <Badge variant={statusVariant(tx.status)}>
                  {statusLabelTR(tx.status)}
                </Badge>
              </div>

              <div className="text-sm text-muted-foreground">
                {formatDateTR(tx.createdAt)}
              </div>

              {(tx.fromUser || tx.fromUserId) && (
                <div className="text-sm">
                  <b>Kimden:</b> {tx.fromUser?.fullName || tx.fromUserId}
                </div>
              )}

              {(tx.toUser || tx.toUserId) && (
                <div className="text-sm">
                  <b>Kime:</b> {tx.toUser?.fullName || tx.toUserId}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                {isPending && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => runAction(tx, "accept")}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Kabul"
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => runAction(tx, "reject")}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Red"
                      )}
                    </Button>
                  </>
                )}

                {isAccepted && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => runAction(tx, "return")}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "İade Et"
                      )}
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => openZimmetModal(tx)}
                      disabled={isLoading}
                    >
                      Zimmet Yap
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* ================= MODAL ================= */}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zimmet Yap</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Kullanıcı Ara
              </label>
              <Input
                placeholder="İsim veya departman ara..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>

            <div className="space-y-2 max-h-60 overflow-auto border rounded-md p-2">
              {filteredUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Kullanıcı bulunamadı
                </p>
              ) : (
                filteredUsers.map((u) => (
                  <div
                    key={u.id}
                    className={`border rounded p-2 cursor-pointer hover:bg-muted transition-colors ${
                      toUserId === u.id ? "bg-blue-50 border-blue-300" : ""
                    }`}
                    onClick={() => setToUserId(u.id)}
                  >
                    <div className="font-medium">{u.fullName}</div>
                    {u.department && (
                      <div className="text-xs text-muted-foreground">
                        {u.department}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                setToUserId("");
                setUserSearch("");
              }}
            >
              İptal
            </Button>
            <Button
              onClick={sendZimmet}
              disabled={!toUserId || actionLoading === "zimmet"}
            >
              {actionLoading === "zimmet" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Zimmetleniyor...
                </>
              ) : (
                "Zimmetle"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
