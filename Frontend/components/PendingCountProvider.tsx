"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { useTransactionsStore } from "@/store/transactionsStore";

/**
 * Tek yer: GET /transactions/me burada çağrılır.
 * Token + me varsa fetch yapar, store güncellenir.
 */
export function PendingCountProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = useAuthStore((s) => s.token);
  const getToken = useAuthStore((s) => s.getToken);
  const refresh = useTransactionsStore((s) => s.refresh);
  const clear = useTransactionsStore((s) => s.clear);
  const [me, setMe] = useState<{ id: string } | null>(null);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      clear();
      setMe(null);
      return;
    }

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${t}` },
    })
      .then((r) => r.json())
      .then((u) => (u?.id ? setMe({ id: u.id }) : setMe(null)))
      .catch(() => setMe(null));
  }, [token, getToken, clear]);

  useEffect(() => {
    if (!token || !me?.id) return;
    refresh(getToken, me.id, "action");
    const id = setInterval(() => refresh(getToken, me!.id, "polling"), 5000);
    return () => clearInterval(id);
  }, [token, me?.id, getToken, refresh]);

  return <>{children}</>;
}
