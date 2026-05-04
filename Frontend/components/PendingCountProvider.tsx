"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useTransactionsStore } from "@/store/transactionsStore";
import { connectSocket, disconnectSocket } from "@/lib/socket";

/**
 * İlk yükleme: GET /transactions/me (tam liste + sayaçlar).
 * Arka plan: 30 sn'de bir GET /transactions/me/summary (sadece badge sayaçları), sekme gizliyken çalışmaz.
 * Socket: yalnızca NEXT_PUBLIC_ENABLE_SOCKET === "true" iken; sinyalde refreshSilent (tam liste).
 */
export function PendingCountProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const getToken = useAuthStore((s) => s.getToken);
  const refresh = useTransactionsStore((s) => s.refresh);
  const refreshSilent = useTransactionsStore((s) => s.refreshSilent);
  const refreshSummarySilent = useTransactionsStore((s) => s.refreshSummarySilent);
  const clear = useTransactionsStore((s) => s.clear);
  const [me, setMe] = useState<{ id: string } | null>(null);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      clear();
      setMe(null);
      disconnectSocket();
      return;
    }

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${t}` },
    })
      .then((r) => {
        if (r.status === 401) {
          router.replace("/login");
          return null;
        }
        return r.json();
      })
      .then((u) => (u && u?.id ? setMe({ id: u.id }) : setMe(null)))
      .catch(() => setMe(null));
  }, [token, getToken, clear, router]);

  useEffect(() => {
    if (!token || !me?.id) return;

    void refresh(getToken, me.id, "action");

    const socket = connectSocket(getToken() ?? "");
    const eventName = `user:${me.id}`;
    if (socket) {
      socket.on(eventName, () => {
        void refreshSilent(getToken, me.id);
      });
    }

    const intervalId = setInterval(() => {
      if (document.hidden) return;
      void refreshSummarySilent(getToken);
    }, 30000);

    return () => {
      if (socket) {
        socket.off(eventName);
      }
      disconnectSocket();
      clearInterval(intervalId);
    };
  }, [token, me?.id, getToken, refresh, refreshSilent, refreshSummarySilent]);

  return <>{children}</>;
}
