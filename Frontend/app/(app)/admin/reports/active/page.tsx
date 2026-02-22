"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FormattedDate } from "@/components/FormattedDate";
import { FileText } from "lucide-react";

type ActiveAssignment = {
  documentNumber: string;
  currentHolder: { fullName: string; department: string | null };
  assignedAt: string;
};

export default function AdminActiveReportsPage() {
  const router = useRouter();
  const getToken = useAuthStore((s: { getToken: () => string | null }) => s.getToken);
  const [user, setUser] = useState<{ id: string; role: string } | null>(null);
  const [items, setItems] = useState<ActiveAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((u) => {
        if (!u?.id) {
          router.replace("/login");
          return;
        }
        setUser(u);
        if (u.role !== "ADMIN") {
          router.replace("/dashboard");
          return;
        }
        return fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/active-assignments`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      })
      .then((res) => {
        if (res && res.ok) return res.json();
        return [];
      })
      .then((data) => {
        setItems(Array.isArray(data) ? data : []);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [getToken, router]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (user.role !== "ADMIN") {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <div>
          <h1 className="text-xl font-semibold">Aktif Zimmetler Raporu</h1>
          <p className="text-sm text-muted-foreground">
            Şu anda zimmetli evraklar
          </p>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Aktif Zimmet Listesi
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                <FileText className="h-10 w-10 opacity-50" />
                <p className="text-sm">Aktif zimmet bulunmuyor</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium">Evrak No</th>
                      <th className="px-4 py-3 text-left font-medium">Zimmetli Kişi</th>
                      <th className="px-4 py-3 text-left font-medium">Zimmet Tarihi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => (
                      <tr key={row.documentNumber} className="border-b last:border-0">
                        <td className="px-4 py-3 font-medium">{row.documentNumber}</td>
                        <td className="px-4 py-3">
                          {row.currentHolder.fullName}
                          {row.currentHolder.department && (
                            <span className="text-muted-foreground ml-1">
                              ({row.currentHolder.department})
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <FormattedDate iso={row.assignedAt} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
