"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useTransactionsStore } from "@/store/transactionsStore";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { FileText, Archive } from "lucide-react";
import { toUserFriendlyError, getNetworkError } from "@/lib/errorMessages";
import { Timeline, type TimelineEvent } from "@/components/Timeline";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type TimelineItem = {
  type: string;
  id?: string;
  status?: string;
  createdAt: string;
  fromUser?: { fullName: string };
  toUser?: { fullName: string };
  user?: { fullName: string };
};

type DocumentDetails = {
  documentNumber: string;
  number?: string;
  status?: string;
  archivedAt?: string | null;
  archivedBy?: { id: string; fullName: string } | null;
  currentHolderId?: string | null;
  currentHolder: {
    id: string;
    fullName: string;
    department: string;
  } | null;
};

export default function DocumentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const number = params?.number as string | undefined;

  const getToken = useAuthStore((s) => s.getToken);
  const token = useAuthStore((s) => s.token);
  const refresh = useTransactionsStore((s) => s.refresh);

  const [data, setData] = useState<DocumentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [archiveNote, setArchiveNote] = useState("");
  const [archiveError, setArchiveError] = useState("");
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);

  // Giriş yapan kullanıcı bilgisi
  useEffect(() => {
    const stored = getToken();
    if (!stored) return;

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${stored}` },
    })
      .then((r) => {
        if (r.status === 401) {
          router.replace("/login");
          return null;
        }
        return r.json();
      })
      .then((u) => (u?.id && setCurrentUserId(u.id)))
      .catch(() => {});
  }, [token, getToken, router]);

  // Doküman detayını çek
  useEffect(() => {
    const stored = getToken();
    if (!stored || !number) return;

    async function loadDocument() {
      setLoading(true);
      setErrorMsg("");

      try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/documents/${number}`,
        {
          headers: { Authorization: `Bearer ${stored}` },
        }
      );

      if (res.status === 401) {
        router.replace("/login");
        setLoading(false);
        return;
      }

      const json = await res.json();

      if (!res.ok) {
        setErrorMsg(
          toUserFriendlyError(json?.message ?? "Evrak bulunamadı.")
        );
        setLoading(false);
        return;
      }

      const docNumber = json.number ?? number;
      setData({
        ...json,
        documentNumber: docNumber,
      });

      const txRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/transactions/document/${docNumber}`,
        { headers: { Authorization: `Bearer ${stored}` } }
      );
      if (txRes.status === 401) {
        router.replace("/login");
        return;
      }
      const txData = await txRes.json();
      setTimeline(Array.isArray(txData) ? txData : []);
    } catch {
      setErrorMsg(getNetworkError());
    } finally {
      setLoading(false);
    }
    }

    loadDocument();
  }, [token, getToken, number, router]);

  const handleArchiveConfirm = async () => {
    if (!number || !data || archiveLoading) return;
    const note = archiveNote.trim();
    if (!note) {
      setArchiveError("Arşivleme notu zorunludur.");
      return;
    }
    const stored = getToken();
    if (!stored) return;

    setArchiveError("");
    setArchiveLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/documents/${number}/archive`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${stored}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ note }),
        }
      );
      const jsonRes = await res.json();
      if (!res.ok) {
        setArchiveError(jsonRes.message || "Arşivleme başarısız.");
        return;
      }
      setData({ ...data, status: "ARCHIVED" });
      setShowArchiveDialog(false);
      setArchiveNote("");
      if (currentUserId) refresh(getToken, currentUserId);
    } catch {
      setArchiveError("Arşivleme sırasında hata oluştu.");
    } finally {
      setArchiveLoading(false);
    }
  };

  // Yükleniyor ekranı (token veya data için)
  if (loading && !data) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText size={20} />
          Evrak Detayı
        </h1>
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-2/3" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <FileText size={20} />
        Evrak Detayı
      </h1>

      {errorMsg && (
        <Alert variant="destructive">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {data && (
        <Card className="shadow border">
          <CardHeader>
            <CardTitle>{data.documentNumber} Numaralı Evrak</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {data.status === "ARCHIVED" && (
              <div className="p-4 border rounded-lg bg-amber-50 text-amber-800">
                <p className="font-medium">Bu evrak arşivlenmiştir</p>
                <p>Arşivleyen: {data.archivedBy?.fullName ?? "-"}</p>
                <p>
                  Tarih:{" "}
                  {data.archivedAt
                    ? new Date(data.archivedAt).toLocaleString("tr-TR")
                    : "-"}
                </p>
              </div>
            )}
            <div className="p-4 border rounded-lg bg-blue-50">
              <p className="font-medium">En son kimde:</p>
              <p className="mt-1 text-blue-700">
                {data.currentHolder
                  ? `${data.currentHolder.fullName}${data.currentHolder.department ? ` (${data.currentHolder.department})` : ""}${data.currentHolder.id === currentUserId ? " (sende)" : ""}`
                  : "Bu evrak kimseye zimmetli değil."}
              </p>
            </div>
            {data.status === "ACTIVE" &&
              (data.currentHolderId === currentUserId ||
                data.currentHolder?.id === currentUserId) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowArchiveDialog(true);
                    setArchiveNote("");
                    setArchiveError("");
                  }}
                  disabled={archiveLoading}
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Arşivle
                </Button>
              )}

            <div>
              <h3 className="font-semibold mb-3">Geçmiş Hareketler</h3>

              {timeline.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Bu evrak için henüz hareket bulunmuyor.
                </p>
              )}

              {timeline.length > 0 && <Timeline items={timeline as TimelineEvent[]} />}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={showArchiveDialog}
        onOpenChange={(open) => {
          if (!open && !archiveLoading) {
            setShowArchiveDialog(false);
            setArchiveNote("");
            setArchiveError("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Evrakı Arşivle</DialogTitle>
            <DialogDescription>
              Bu evrak arşivlenecek ve aktif zimmetlerden çıkarılacaktır.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Arşivleme Notu</label>
            <textarea
              value={archiveNote}
              onChange={(e) => setArchiveNote(e.target.value)}
              placeholder="Evrak neden arşivleniyor?"
              className="w-full min-h-[90px] resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={archiveLoading}
            />
            {archiveError && (
              <p className="text-sm text-destructive">{archiveError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowArchiveDialog(false);
                setArchiveNote("");
                setArchiveError("");
              }}
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
    </div>
  );
}

