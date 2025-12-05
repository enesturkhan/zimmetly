"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function Sidebar() {
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const stored = token || localStorage.getItem("access_token");

    async function fetchRole() {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${stored}`,
        },
      });

      const data = await res.json();
      setRole(data.role);
    }

    fetchRole();
  }, [token]);

  return (
    <div className="w-64 bg-white border-r p-6 flex flex-col justify-between">
      <div>
        <h2 className="text-xl font-bold mb-6">Zimmetly</h2>

        {/* COMMON LINKS */}
        <nav className="space-y-2">
          <Link href="/dashboard">
            <p className="hover:bg-gray-100 p-2 rounded">Ana Panel</p>
          </Link>

          {role === "user" && (
            <>
              <Link href="/zimmet">
                <p className="hover:bg-gray-100 p-2 rounded">Zimmetle</p>
              </Link>
              <Link href="/gecmisim">
                <p className="hover:bg-gray-100 p-2 rounded">Benim Zimmetlerim</p>
              </Link>
              <Link href="/evrak-arama">
                <p className="hover:bg-gray-100 p-2 rounded">Evrak Geçmişi</p>
              </Link>
            </>
          )}

          {role === "admin" && (
            <>
              <Link href="/admin/create-user">
                <p className="hover:bg-gray-100 p-2 rounded">Kullanıcı Oluştur</p>
              </Link>

              <Link href="/admin/users">
                <p className="hover:bg-gray-100 p-2 rounded">Kullanıcı Listesi</p>
              </Link>

              <Link href="/admin/zimmetler">
                <p className="hover:bg-gray-100 p-2 rounded">Tüm Zimmetler</p>
              </Link>

              <Link href="/admin/raporlar">
                <p className="hover:bg-gray-100 p-2 rounded">Raporlar</p>
              </Link>
            </>
          )}
        </nav>
      </div>

      <div>
        <Separator className="my-4" />
        <Button
          variant="destructive"
          className="w-full"
          onClick={() => {
            logout();
            window.location.href = "/login";
          }}
        >
          Çıkış Yap
        </Button>
      </div>
    </div>
  );
}
