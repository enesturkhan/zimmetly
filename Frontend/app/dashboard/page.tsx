"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";

export default function DashboardPage() {
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    async function fetchRole() {
      const storedToken = token || localStorage.getItem("access_token");

      if (!storedToken) {
        window.location.href = "/login";
        return;
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/me`,
        {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        }
      );

      const data = await res.json();

      if (data.role === "admin") {
        window.location.href = "/dashboard/admin";
      } else {
        window.location.href = "/dashboard/user";
      }
    }

    fetchRole();
  }, [token]);

  return (
    <div className="flex h-screen items-center justify-center">
      Yönlendiriliyor...
    </div>
  );
}
