"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const token = useAuthStore((s) => s.token);
  const getToken = useAuthStore((s) => s.getToken);

  useEffect(() => {
    const t = getToken();

    if (pathname === "/") {
      router.replace(t ? "/dashboard" : "/login");
      return;
    }

    if (pathname === "/login") {
      if (t) router.replace("/dashboard");
      return;
    }

    if (!t) {
      router.replace("/login");
    }
  }, [pathname, token, getToken, router]);

  return <>{children}</>;
}
