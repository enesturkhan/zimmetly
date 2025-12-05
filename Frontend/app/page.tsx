"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

export default function Home() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    // localStorage'dan token kontrolü
    const stored = localStorage.getItem("access_token");
    
    if (stored && !token) {
      useAuthStore.getState().setToken(stored);
    }

    // Token varsa dashboard'a, yoksa login'e yönlendir
    const currentToken = stored || token;
    if (currentToken) {
      router.push("/dashboard");
    } else {
      router.push("/login");
    }
  }, [token, router]);

  // Yönlendirme yapılırken loading göster
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-900 mx-auto mb-4"></div>
        <p className="text-neutral-600">Yönlendiriliyor...</p>
      </div>
    </div>
  );
}
