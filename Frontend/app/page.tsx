"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

export default function HomePage() {
  const router = useRouter();
  const getToken = useAuthStore((s) => s.getToken);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
    } else {
      router.replace("/dashboard");
    }
  }, [getToken, router]);

  return null;
}
