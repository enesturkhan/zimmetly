"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type UserMe = {
  id: string;
  fullName: string;
  role: "ADMIN" | "USER";
};

export function AppNavbar() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const getToken = useAuthStore((s) => s.getToken);
  const logout = useAuthStore((s) => s.logout);

  const [user, setUser] = useState<UserMe | null>(null);
  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      setUser(null);
      return;
    }

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${t}` },
    })
      .then((r) => r.json())
      .then((u) => (u?.id ? setUser({ id: u.id, fullName: u.fullName ?? "", role: u.role ?? "USER" }) : setUser(null)))
      .catch(() => setUser(null));
  }, [token, getToken]);

  const handleLogout = () => {
    setLogoutLoading(true);
    logout();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-10 h-16 border-b bg-background">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="flex cursor-pointer items-center gap-2 rounded-md -m-1 p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Dashboard"
        >
          <img src="/icon.svg" alt="Zimmetly" className="h-9 w-9 rounded-full" />
          <span className="font-semibold tracking-tight text-xl text-primary">Zimmetly</span>
        </button>

        <div className="flex items-center gap-3">
          {user && (
            <>
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                {user.fullName}
                {user.role === "ADMIN" && (
                  <Badge
                    variant="outline"
                    className="text-xs font-normal text-muted-foreground border-muted"
                  >
                    Admin
                  </Badge>
                )}
              </span>
              {user.role === "ADMIN" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="cursor-pointer text-sm underline-offset-2 hover:underline"
                  onClick={() => router.push("/admin/users")}
                  aria-label="Kullanıcı Yönetimi"
                >
                  Kullanıcı Yönetimi
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                disabled={logoutLoading}
                className="cursor-pointer min-w-[7rem]"
                onClick={handleLogout}
              >
                {logoutLoading ? "Çıkılıyor..." : "Çıkış Yap"}
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
