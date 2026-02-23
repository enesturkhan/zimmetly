"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FormattedDate } from "@/components/FormattedDate";
import { FileText, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type ReportRow = {
  documentNumber: string;
  fromUser: { fullName: string; department: string | null };
  toUser: { fullName: string; department: string | null };
  assignedAt: string;
  overdueMinutes: number | null;
};

type TabFilter = "ALL" | "OVERDUE";

export default function AdminActiveReportsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const getToken = useAuthStore((s: { getToken: () => string | null }) => s.getToken);
  const [user, setUser] = useState<{ id: string; role: string } | null>(null);
  const [activeTab, setActiveTab] = useState<TabFilter>(() =>
    searchParams.get("tab") === "OVERDUE" ? "OVERDUE" : "ALL"
  );

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "OVERDUE") setActiveTab("OVERDUE");
    else if (tab !== "ALL") setActiveTab("ALL");
  }, [searchParams]);
  const [items, setItems] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = (filter: TabFilter) => {
    const token = getToken();
    if (!token || !user) return;

    setLoading(true);
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/active-assignments?filter=${filter}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

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
      })
      .catch(() => {});
  }, [getToken, router]);

  useEffect(() => {
    if (!user || user.role !== "ADMIN") return;
    fetchData(activeTab);
  }, [user, activeTab]);

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

  const isOverdueTab = activeTab === "OVERDUE";

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <div>
          <h1 className="text-xl font-semibold">Zimmet Raporları</h1>
          <p className="text-sm text-muted-foreground">
            Aktif ve geciken zimmetler
          </p>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Rapor Listesi
              </CardTitle>
              <div className="flex gap-2 border-b">
                <button
                  type="button"
                  onClick={() => setActiveTab("ALL")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[1px]",
                    activeTab === "ALL"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Aktif Zimmetler
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("OVERDUE")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[1px]",
                    activeTab === "OVERDUE"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Clock className="h-3.5 w-3.5" />
                  Geciken Zimmetler
                </button>
              </div>
            </div>
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
                <p className="text-sm">
                  {isOverdueTab
                    ? "Geciken zimmet bulunmuyor"
                    : "Aktif zimmet bulunmuyor"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium">Evrak No</th>
                      <th className="px-4 py-3 text-left font-medium">Kimden</th>
                      <th className="px-4 py-3 text-left font-medium">Kime</th>
                      <th className="px-4 py-3 text-left font-medium">
                        {isOverdueTab ? "Gönderim Tarihi" : "Zimmet Tarihi"}
                      </th>
                      {isOverdueTab && (
                        <th className="px-4 py-3 text-left font-medium">Gecikme</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row, idx) => (
                      <tr
                        key={`${row.documentNumber}-${idx}`}
                        className={cn(
                          "border-b last:border-0",
                          isOverdueTab && "bg-red-50/50"
                        )}
                      >
                        <td className="px-4 py-3 font-medium">{row.documentNumber}</td>
                        <td className="px-4 py-3">
                          {row.fromUser.fullName}
                          {row.fromUser.department && (
                            <span className="text-muted-foreground ml-1">
                              ({row.fromUser.department})
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {row.toUser.fullName}
                          {row.toUser.department && (
                            <span className="text-muted-foreground ml-1">
                              ({row.toUser.department})
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <FormattedDate iso={row.assignedAt} />
                        </td>
                        {isOverdueTab && (
                          <td className="px-4 py-3">
                            {row.overdueMinutes != null && (
                              <span className="font-medium text-red-600">
                                {row.overdueMinutes} dk
                              </span>
                            )}
                          </td>
                        )}
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
