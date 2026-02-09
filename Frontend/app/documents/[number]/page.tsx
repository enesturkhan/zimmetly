"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { FileText, ArrowRight, Archive } from "lucide-react";

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

  const token = useAuthStore((s) => s.token);
  const setToken = useAuthStore((s) => s.setToken);

  const [data, setData] = useState<DocumentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);

  // Token'ı localStorage'dan geri yükle
  useEffect(() => {
    if (!token) {
      const stored = localStorage.getItem("access_token");
      if (stored) {
        setToken(stored);
      }
    }
  }, [token, setToken]);

  // Token yoksa login'e yönlendir
  useEffect(() => {
    const stored = token || localStorage.getItem("access_token");
    if (!stored) {
      router.replace("/login");
    }
  }, [token, router]);

  // Giriş yapan kullanıcı bilgisi
  useEffect(() => {
    const stored = token || localStorage.getItem("access_token");
    if (!stored) return;

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${stored}` },
    })
      .then((r) => r.json())
      .then((u) => u?.id && setCurrentUserId(u.id))
      .catch(() => { });
  }, [token]);

  // Doküman detayını çek
  useEffect(() => {
    const stored = token || localStorage.getItem("access_token");
    if (!stored || !number) return;

    async function loadDocument() {
      setLoading(true);
      setErrorMsg("");

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/documents/${number}`,
        {
          headers: { Authorization: `Bearer ${stored}` },
        }
      );

      const json = await res.json();

      if (!res.ok) {
        setErrorMsg(json.message || "Evrak bulunamadı.");
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
      const txData = await txRes.json();
      setTimeline(Array.isArray(txData) ? txData : []);
      setLoading(false);
    }

    loadDocument();
  }, [token, number]);

  const handleArchive = async () => {
    if (!number || !data || archiveLoading) return;
    const stored = token || localStorage.getItem("access_token");
    if (!stored) return;

    setArchiveLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/documents/${number}/archive`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${stored}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );
      const jsonRes = await res.json();
      if (!res.ok) {
        setErrorMsg(jsonRes.message || "Arşivleme başarısız.");
        return;
      }
      setData({
        ...data,
        status: "ARCHIVED",
      });
    } catch {
      setErrorMsg("Arşivleme sırasında hata oluştu.");
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
                  onClick={handleArchive}
                  disabled={archiveLoading}
                >
                  <Archive className="mr-2 h-4 w-4" />
                  {archiveLoading ? "Arşivleniyor..." : "Arşivle"}
                </Button>
              )}

            <div>
              <h3 className="font-semibold mb-3">Geçmiş Hareketler</h3>

              {timeline.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Bu evrak için henüz hareket bulunmuyor.
                </p>
              )}

              <div className="space-y-3">
                {timeline.map((item, idx) => {
                  const formatDate = (iso?: string) =>
                    iso
                      ? new Date(iso).toLocaleString("tr-TR")
                      : "-";
                  if (item.type === "ARCHIVED") {
                    return (
                      <div
                        key={`archived-${item.createdAt}-${idx}`}
                        className="flex items-center gap-2 p-3 border rounded-lg bg-amber-50"
                      >
                        <span className="font-medium">—</span>
                        <ArrowRight className="text-gray-600" size={18} />
                        <span className="font-medium">
                          Evrak arşivlendi ({item.user?.fullName ?? "-"} tarafından)
                        </span>
                        <span className="text-xs text-gray-500 ml-auto">
                          {formatDate(item.createdAt)}
                        </span>
                      </div>
                    );
                  }
                  if (item.type === "UNARCHIVED") {
                    return (
                      <div
                        key={`unarchived-${item.createdAt}-${idx}`}
                        className="flex items-center gap-2 p-3 border rounded-lg bg-green-50"
                      >
                        <span className="font-medium">—</span>
                        <ArrowRight className="text-gray-600" size={18} />
                        <span className="font-medium">Evrak arşivden çıkarıldı</span>
                        <span className="text-xs text-gray-500 ml-auto">
                          {formatDate(item.createdAt)}
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={item.id ?? `tx-${idx}`}
                      className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50"
                    >
                      <span className="font-medium">
                        {item.fromUser?.fullName ?? "İlk Kayıt"}
                      </span>
                      <ArrowRight className="text-gray-600" size={18} />
                      <span className="font-medium">
                        {item.toUser?.fullName ?? "-"}
                      </span>
                      <span className="text-xs text-gray-500 ml-auto">
                        {formatDate(item.createdAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

