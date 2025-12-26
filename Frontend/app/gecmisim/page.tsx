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

  /* ---- Modal ---- */
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
      if (!res.ok) throw new Error(data.message);
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message || "Veri alınamadı");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (me) fetchMine();
  }, [me]);

  /* ================= ACTION ================= */

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
      if (!res.ok) throw new Error(data.message);
      await fetchMine();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  /* ================= UI ================= */

  if (!me) return <div className="p-6">Yükleniyor...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Geçmişim</h2>
          <p className="text-sm text-muted-foreground">
            {me.fullName}
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            Dashboard
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              logout();
              router.push("/login");
            }}
          >
            Çıkış Yap
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="flex justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {items.map((tx) => {
        const isIncoming = tx.toUserId === me.id;
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

              <div className="text-sm">
                <b>Kimden:</b> {tx.fromUser?.fullName}
              </div>
              <div className="text-sm">
                <b>Kime:</b> {tx.toUser?.fullName}
              </div>

              {/* 🔒 BUTONLAR SADECE GELEN ZİMMETTE */}
              {isIncoming && (
                <div className="flex gap-2 pt-2">
                  {isPending && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => runAction(tx, "accept")}
                        disabled={isLoading}
                      >
                        Kabul
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => runAction(tx, "reject")}
                        disabled={isLoading}
                      >
                        Red
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
                        İade Et
                      </Button>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
