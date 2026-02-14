"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useTransactionsStore } from "@/store/transactionsStore";
import { connectSocket, disconnectSocket } from "@/lib/socket";

/**
 * Tek yer: GET /transactions/me burada çağrılır.
 * Token + me varsa fetch yapar, store güncellenir.
 * WebSocket: push sinyal → refresh(polling) ile badge anında güncellenir.
 */
export function PendingCountProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const getToken = useAuthStore((s) => s.getToken);
  const logout = useAuthStore((s) => s.logout);
  const refresh = useTransactionsStore((s) => s.refresh);
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
          logout();
          router.replace("/login");
          return null;
        }
        return r.json();
      })
      .then((u) => (u && u?.id ? setMe({ id: u.id }) : setMe(null)))
      .catch(() => setMe(null));
  }, [token, getToken, clear, logout, router]);

  useEffect(() => {
    if (!token || !me?.id) return;

    refresh(getToken, me.id, "action");

    const socket = connectSocket(getToken() ?? "");
    const eventName = `user:${me.id}`;
    socket.on(eventName, () => {
      refresh(getToken, me.id, "polling");
    });

    const id = setInterval(() => refresh(getToken, me!.id, "polling"), 30000);

    return () => {
      socket.off(eventName);
      clearInterval(id);
    };
  }, [token, me?.id, getToken, refresh]);

  return <>{children}</>;
}
