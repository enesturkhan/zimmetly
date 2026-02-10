"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Loader2, Users } from "lucide-react";
import { cn } from "@/lib/utils";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import CreateUserModal from "./CreateUserModal";

type Role = "ADMIN" | "USER";

type UserRow = {
  id: string;
  fullName: string;
  email: string;
  department: string | null;
  role: Role;
  createdAt: string;
  isActive?: boolean; // backend dönüyorsa kullanır, dönmüyorsa sorun değil
};

type Me = {
  id: string;
  fullName: string;
  role: Role;
};

export default function AdminUsersPage() {
  const router = useRouter();
  const getToken = useAuthStore((s: any) => s.getToken);
  const logout = useAuthStore((s: any) => s.logout);

  const [me, setMe] = useState<Me | null>(null);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [query, setQuery] = useState("");

  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // --- Edit Dialog state ---
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  const [selected, setSelected] = useState<UserRow | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editRole, setEditRole] = useState<Role>("USER");
  const [openModal, setOpenModal] = useState(false);

  // --- Delete state ---
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);

  // --- Toggle Active state ---
  const [toggleLoadingId, setToggleLoadingId] = useState<string | null>(null);
  const [contentVisible, setContentVisible] = useState(false);

  // 1) Yetki kontrolü: /auth/me ile admin mi bak
  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    async function fetchMe() {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (!res.ok) {
        logout();
        router.push("/login");
        return;
      }

      // admin değilse dashboarda
      if (data.role !== "ADMIN") {
        router.push("/dashboard");
        return;
      }

      setMe(data);
    }

    fetchMe();
  }, [getToken, logout, router]);

  // 2) Admin users listesi çek
  const fetchUsers = async () => {
    setErrorMsg("");
    setIsUsersLoading(true);

    try {
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.message || "Kullanıcılar çekilemedi.");
        return;
      }

      if (!Array.isArray(data)) {
        setErrorMsg("Beklenmeyen veri formatı (Array değil).");
        return;
      }

      setUsers(data);
    } catch (e) {
      setErrorMsg("Sunucuya bağlanılamadı.");
    } finally {
      setIsUsersLoading(false);
    }
  };

  useEffect(() => {
    if (me?.role === "ADMIN") fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.role]);

  useEffect(() => {
    if (me) setContentVisible(true);
  }, [me]);

  // 3) Filtre
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;

    return users.filter((u) => {
      return (
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.department || "").toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    });
  }, [users, query]);

  // 4) Edit aç
  const openEdit = (u: UserRow) => {
    setSelected(u);
    setEditFullName(u.fullName || "");
    setEditDepartment(u.department || "");
    setEditRole(u.role);
    setEditError("");
    setEditOpen(true);
  };

  // 5) Patch (update)
  const handleSave = async () => {
    if (!selected) return;

    setEditError("");
    setEditLoading(true);

    try {
      const token = getToken();

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/${selected.id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fullName: editFullName.trim(),
            department: editDepartment.trim() || null,
            role: editRole,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setEditError(data.message || "Güncelleme başarısız.");
        return;
      }

      // Senin backend'in update dönüşü {message, data} şeklinde
      const updated: UserRow = data.data ?? data;

      setUsers((prev) =>
        prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x))
      );

      setEditOpen(false);
    } catch {
      setEditError("Sunucuya bağlanılamadı.");
    } finally {
      setEditLoading(false);
    }
  };

  // 6) Delete (pasif et/sil)
  const handleDelete = async (id: string) => {
    setErrorMsg("");
    setDeleteLoadingId(id);

    try {
      const token = getToken();

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.message || "Silme/Pasif etme başarısız.");
        return;
      }

      // UI'da listeden kaldır (backend pasif ediyorsa bile admin listesi sadece aktifleri çekiyorsa zaten kaybolacak)
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch {
      setErrorMsg("Sunucuya bağlanılamadı.");
    } finally {
      setDeleteLoadingId(null);
    }
  };

  // 7) Toggle Active/Pasif
  const handleToggleActive = async (user: UserRow) => {
    setErrorMsg("");
    setToggleLoadingId(user.id);

    try {
      const token = getToken();
      const newStatus = !(user.isActive ?? true); // Eğer undefined ise true kabul et

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/${user.id}/active`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ isActive: newStatus }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.message || "Durum güncelleme başarısız.");
        return;
      }

      // UI'da kullanıcı durumunu güncelle
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, isActive: newStatus }
            : u
        )
      );
    } catch {
      setErrorMsg("Sunucuya bağlanılamadı.");
    } finally {
      setToggleLoadingId(null);
    }
  };

  if (!me) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
        <p className="mt-4 text-sm text-muted-foreground">Yükleniyor…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main
        className={cn(
          "mx-auto max-w-7xl space-y-8 px-6 py-8 transition-all duration-300",
          contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold">Kullanıcı Yönetimi</h1>
            <p className="text-sm text-muted-foreground">Sistemdeki kullanıcıları yönetin</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={() => router.push("/dashboard")}
            >
              Dashboard
            </Button>
            <Button
              size="sm"
              className="cursor-pointer"
              onClick={() => setOpenModal(true)}
            >
              Yeni Kullanıcı
            </Button>
          </div>
        </div>

        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="font-semibold">Kullanıcılar</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Input
                className="w-full min-w-0 sm:w-[280px] rounded-lg"
                placeholder="Ara: isim / email / departman / rol"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <Button
                variant="secondary"
                size="sm"
                className="cursor-pointer shrink-0"
                onClick={fetchUsers}
                disabled={isUsersLoading}
              >
                {isUsersLoading ? "Yenileniyor…" : "Yenile"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {errorMsg && (
              <Alert variant="destructive" className="rounded-lg">
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}

            {isUsersLoading && (
              <div className="flex flex-col items-center justify-center gap-3 py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
                <p className="text-sm text-muted-foreground">Kullanıcılar yenileniyor…</p>
              </div>
            )}

            <div
              className={cn(
                "transition-opacity duration-300",
                isUsersLoading && "opacity-50 pointer-events-none"
              )}
            >
              {filtered.length === 0 && !isUsersLoading ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                  <Users className="h-10 w-10 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Kullanıcı bulunamadı</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map((u) => (
                    <div
                      key={u.id}
                      className="flex cursor-pointer flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{u.fullName}</p>
                        <p className="text-sm text-muted-foreground">
                          {u.email}
                          {u.department ? ` · ${u.department}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 sm:shrink-0">
                        <Badge
                          variant={u.role === "ADMIN" ? "default" : "secondary"}
                          className="rounded-full text-xs"
                        >
                          {u.role}
                        </Badge>
                        <div
                          className={cn(
                            "flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-muted/20",
                            (isUsersLoading || toggleLoadingId === u.id) && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <Switch
                            id={`toggle-${u.id}`}
                            checked={u.isActive ?? true}
                            onCheckedChange={() => handleToggleActive(u)}
                            disabled={isUsersLoading || toggleLoadingId === u.id}
                            className="cursor-pointer data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
                          />
                          <Label
                            htmlFor={`toggle-${u.id}`}
                            className={cn(
                              "text-sm",
                              isUsersLoading || toggleLoadingId === u.id ? "cursor-not-allowed" : "cursor-pointer"
                            )}
                          >
                            {toggleLoadingId === u.id
                              ? "Güncelleniyor…"
                              : u.isActive
                                ? "Aktif"
                                : "Pasif"}
                          </Label>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="cursor-pointer shrink-0"
                          disabled={isUsersLoading}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(u);
                          }}
                        >
                          Düzenle
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      {/* EDIT DIALOG */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kullanıcı Düzenle</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Ad Soyad</label>
              <Input value={editFullName} onChange={(e) => setEditFullName(e.target.value)} />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Departman</label>
              <Input value={editDepartment} onChange={(e) => setEditDepartment(e.target.value)} />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Rol</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={editRole === "USER" ? "default" : "outline"}
                  onClick={() => setEditRole("USER")}
                >
                  USER
                </Button>
                <Button
                  type="button"
                  variant={editRole === "ADMIN" ? "default" : "outline"}
                  onClick={() => setEditRole("ADMIN")}
                >
                  ADMIN
                </Button>
              </div>
            </div>

            {editError && (
              <Alert variant="destructive">
                <AlertDescription>{editError}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleSave} disabled={editLoading}>
              {editLoading ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL */}
      <CreateUserModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        onSuccess={() => {
          setOpenModal(false);
          fetchUsers(); // 👈 listeyi güncelle
        }}
      />
    </div>
  );
}
