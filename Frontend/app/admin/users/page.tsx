"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

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

  const [loading, setLoading] = useState(false);
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
    setLoading(true);

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
      setLoading(false);
    }
  };

  useEffect(() => {
    if (me?.role === "ADMIN") fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.role]);

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
    return <div className="p-6">Yükleniyor...</div>;
  }

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Kullanıcı Yönetimi</h2>
          <p className="text-sm text-muted-foreground">
            Admin: {me.fullName}
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            Dashboard
          </Button>
          <Button onClick={() => setOpenModal(true)}>
            Yeni Kullanıcı
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Kullanıcılar</CardTitle>

          <div className="flex gap-2">
            <Input
              className="w-[320px]"
              placeholder="Ara: isim / email / departman / rol"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button variant="secondary" onClick={fetchUsers} disabled={loading}>
              {loading ? "Yükleniyor..." : "Yenile"}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {errorMsg && (
            <Alert variant="destructive">
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad Soyad</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Departman</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.fullName}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.department || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          u.isActive
                            ? "bg-green-500 hover:bg-green-600 text-white"
                            : "bg-red-500 hover:bg-red-600 text-white"
                        }
                      >
                        {u.isActive ? "AKTİF" : "PASİF"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(u)}
                        >
                          Düzenle
                        </Button>

                        <div className="flex items-center space-x-2">
                          <Switch
                            id={`toggle-${u.id}`}
                            checked={u.isActive ?? true}
                            onCheckedChange={() => handleToggleActive(u)}
                            disabled={toggleLoadingId === u.id}
                            className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
                          />
                          <Label
                            htmlFor={`toggle-${u.id}`}
                            className="text-sm cursor-pointer"
                          >
                            {u.isActive ? "Aktif" : "Pasif"}
                          </Label>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                      Kayıt bulunamadı.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          
        </CardContent>
      </Card>

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
