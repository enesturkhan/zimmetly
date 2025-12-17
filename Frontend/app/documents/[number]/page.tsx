"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, ArrowRight } from "lucide-react";

type HistoryItem = {
  fromUser?: string;
  toUser: string;
  createdAt: string;
};

type DocumentDetails = {
  documentNumber: string;
  currentHolder: {
    id: string;
    fullName: string;
    department: string;
  } | null;
  history: HistoryItem[];
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

      const history = Array.isArray(json?.history)
        ? json.history
        : Array.isArray(json?.transactions)
          ? json.transactions
          : Array.isArray(json?.movements)
            ? json.movements
            : [];

      setData({
        ...json,
        history,
      });
      setLoading(false);
    }

    loadDocument();
  }, [token, number]);

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
            <div className="p-4 border rounded-lg bg-blue-50">
              <p className="font-medium">Şu anda kimde:</p>
              <p className="mt-1 text-blue-700">
                {data.currentHolder
                  ? `${data.currentHolder.fullName} (${data.currentHolder.department})`
                  : "Bu evrak kimseye zimmetli değil."}
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Geçmiş Hareketler</h3>

              {(!data.history || data.history.length === 0) && (
                <p className="text-sm text-muted-foreground">
                  Bu evrak için henüz hareket bulunmuyor.
                </p>
              )}

              <div className="space-y-3">
                {(data.history || []).map((h, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50"
                  >
                    <span className="font-medium">
                      {h.fromUser ? h.fromUser : "İlk Kayıt"}
                    </span>

                    <ArrowRight className="text-gray-600" size={18} />

                    <span className="font-medium">{h.toUser}</span>

                    <span className="text-xs text-gray-500 ml-auto">
                      {new Date(h.createdAt).toLocaleString("tr-TR")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

