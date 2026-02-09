"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Loader2, Archive } from "lucide-react";

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
  document?: {
    status?: string;
    archivedAt?: string | null;
    archivedByUserId?: string | null;
  };
  isActiveForMe?: boolean;
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

  const [me, setMe] = useState<Me | null>(null);
  const [items, setItems] = useState<TxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [archiveTx, setArchiveTx] = useState<TxItem | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [assignTx, setAssignTx] = useState<TxItem | null>(null);
  const [assignUsers, setAssignUsers] = useState<UserOption[]>([]);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState("");

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
  }, []);

  /* ================= DATA ================= */

  const fetchMine = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/transactions/me`,
        {
          headers: { Authorization: `Bearer ${getToken()}` },
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setItems(data || []);
    } catch (e: any) {
      setError(e.message || "Veri alınamadı");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (me) fetchMine();
  }, [me]);

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

  /* ================= GROUPING ================= */

  const incomingPending = useMemo(
    () =>
      items.filter(
        (t) => t.toUserId === me?.id && t.status === "PENDING"
      ),
    [items, me]
  );

  const acceptedByMe = useMemo(
    () =>
      items.filter(
        (t) =>
          t.toUserId === me?.id &&
          t.status === "ACCEPTED" &&
          (t.isActiveForMe ?? (t.document?.status ?? "ACTIVE") === "ACTIVE")
      ),
    [items, me]
  );

  const sentByMe = useMemo(
    () => items.filter((t) => t.fromUserId === me?.id),
    [items, me]
  );

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
      fetchMine();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  /* ================= UI ================= */

  if (!me) return <div className="p-6">Yükleniyor...</div>;

  const canManageTx = (tx: TxItem) =>
    tx.status === "ACCEPTED" &&
    tx.toUserId === me?.id &&
    (tx.isActiveForMe ?? (tx.document?.status ?? "ACTIVE") === "ACTIVE");

  const archiveBadgeText = (tx: TxItem) =>
    tx.document?.status === "ARCHIVED"
      ? "Arşivlendi"
      : statusLabelTR(tx.status);

  const archiveBadgeVariant = (tx: TxItem) =>
    tx.document?.status === "ARCHIVED"
      ? "secondary"
      : statusVariant(tx.status);

  const handleArchiveConfirm = async () => {
    if (!archiveTx) return;
    const token = getToken();
    if (!token) return;

    setArchiveLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/documents/${archiveTx.documentNumber}/archive`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setItems((prev) =>
        prev.map((item) =>
          item.id === archiveTx.id
            ? {
              ...item,
              document: { ...(item.document ?? {}), status: "ARCHIVED" },
            }
            : item
        )
      );
      setArchiveTx(null);
    } catch (e: any) {
      setError(e.message || "Arşivleme başarısız");
    } finally {
      setArchiveLoading(false);
    }
  };

  const Section = ({
    title,
    items,
    children,
  }: {
    title: string;
    items: TxItem[];
    children?: (tx: TxItem) => React.ReactNode;
  }) => (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">Kayıt yok</p>
        )}
        {items.map((tx) => (
          <div
            key={tx.id}
            className="border rounded p-3 space-y-1"
          >
            <div className="flex justify-between">
              <b>Evrak No: {tx.documentNumber}</b>
              <Badge variant={archiveBadgeVariant(tx)}>
                {archiveBadgeText(tx)}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {formatDateTR(tx.createdAt)}
            </div>
            <div className="text-sm">
              <b>Kimden:</b> {tx.fromUser?.fullName}
            </div>
            <div className="text-sm">
              <b>Kime:</b> {tx.toUser?.fullName}
            </div>
            {children && <div className="pt-2">{children(tx)}</div>}
          </div>
        ))}
      </CardContent>
    </Card>
  );

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Geçmişim</h2>
          <p className="text-sm text-muted-foreground">{me.fullName}</p>
        </div>
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
        <div className="flex justify-center">
          <Loader2 className="animate-spin" />
        </div>
      )}

      <Section title="📥 Bana Gelen (Beklemede)" items={incomingPending}>
        {(tx) => (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => runAction(tx, "accept")}>
              Kabul
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => runAction(tx, "reject")}
            >
              Red
            </Button>
          </div>
        )}
      </Section>

      <Section title="📂 Kabul Ettiklerim (Bende)" items={acceptedByMe}>
        {(tx) => {
          const isArchived = tx.document?.status === "ARCHIVED";
          const canArchive = canManageTx(tx);

          if (isArchived) {
            return (
              <Button
                size="sm"
                onClick={() => {
                  setAssignTx(tx);
                  setAssignUserId("");
                  setAssignError("");
                }}
              >
                Başkasına Zimmetle
              </Button>
            );
          }

          return (
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => runAction(tx, "return")}
                disabled={actionLoading === tx.id}
              >
                {actionLoading === tx.id ? "İade Ediliyor..." : "İade Et"}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setAssignTx(tx);
                  setAssignUserId("");
                  setAssignError("");
                }}
              >
                Başkasına Zimmetle
              </Button>
              {canArchive && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setArchiveTx(tx)}
                  disabled={archiveLoading}
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Arşivle
                </Button>
              )}
            </div>
          );
        }}
      </Section>

      <Section title="📤 Gönderdiklerim" items={sentByMe} />

      <Dialog
        open={!!archiveTx}
        onOpenChange={(open) => {
          if (!open && !archiveLoading) setArchiveTx(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Evrakı Arşivle</DialogTitle>
            <DialogDescription>
              Bu evrak arşivlenecek ve aktif zimmetlerden çıkarılacaktır.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setArchiveTx(null)}
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
        open={!!assignTx}
        onOpenChange={(open) => {
          if (!open && !assignLoading) {
            setAssignTx(null);
            setAssignUserId("");
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
                  const res = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL}/transactions`,
                    {
                      method: "POST",
                      headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        documentNumber: assignTx.documentNumber,
                        toUserId: assignUserId,
                      }),
                    }
                  );
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.message);
                  setAssignTx(null);
                  fetchMine();
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