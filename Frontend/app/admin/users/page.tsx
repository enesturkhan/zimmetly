"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { toUserFriendlyError, getNetworkError } from "@/lib/errorMessages";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

/* ================= UI COMPONENTS (same file) ================= */

function AdminHeader({
  onRefresh,
  refreshLoading,
}: {
  onRefresh: () => void;
  refreshLoading: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold">Kullanıcı Yönetimi</h1>
        <p className="text-sm text-muted-foreground">
          Sistemdeki kullanıcıları yönetin
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="cursor-pointer min-w-[5.5rem]"
        onClick={onRefresh}
        disabled={refreshLoading}
      >
        {refreshLoading ? "Yenileniyor…" : "Yenile"}
      </Button>
    </div>
  );
}

function UsersEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-muted-foreground/30 bg-muted/10 py-12 text-center">
      <Users className="h-10 w-10 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">Henüz kullanıcı bulunmuyor</p>
    </div>
  );
}

function UsersLoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-40 rounded-md" />
            <Skeleton className="h-4 w-56 rounded-md" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-16 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

function UserRow({
  u,
  isToggleLoading,
  isDeleteLoading,
  onToggle,
  onEdit,
  onDelete,
}: {
  u: UserRow;
  isToggleLoading: boolean;
  isDeleteLoading: boolean;
  onToggle: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const isActive = u.isActive ?? true;
  const rowDisabled = isToggleLoading || isDeleteLoading;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-all hover:bg-muted/40 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between",
        rowDisabled && "opacity-60 pointer-events-none"
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium break-words">{u.fullName}</p>
        <p className="text-sm text-muted-foreground break-words">
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
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-muted/20">
              <Switch
                id={`toggle-${u.id}`}
                checked={isActive}
                onCheckedChange={onToggle}
                disabled={rowDisabled}
                className="cursor-pointer data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
              />
              <Label
                htmlFor={`toggle-${u.id}`}
                className={cn(
                  "text-sm cursor-pointer",
                  rowDisabled && "cursor-not-allowed"
                )}
              >
                {isToggleLoading ? "Güncelleniyor…" : isActive ? "Aktif" : "Pasif"}
              </Label>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {isActive ? "Kullanıcıyı pasif hale getir" : "Aktif hale getir"}
          </TooltipContent>
        </Tooltip>
        <Button
          variant="outline"
          size="sm"
          className="cursor-pointer min-w-[5rem]"
          disabled={rowDisabled}
          onClick={onEdit}
        >
          Düzenle
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="cursor-pointer min-w-[4.5rem]"
          disabled={rowDisabled}
          onClick={onDelete}
        >
          {isDeleteLoading ? "Siliniyor…" : "Sil"}
        </Button>
      </div>
    </div>
  );
}

function UsersTable({
  query,
  setQuery,
  filtered,
  isUsersLoading,
  errorMsg,
  toggleLoadingId,
  deleteLoadingId,
  onOpenCreate,
  openEdit,
  handleToggleActive,
  handleDelete,
  onDashboard,
}: {
  query: string;
  setQuery: (v: string) => void;
  filtered: UserRow[];
  isUsersLoading: boolean;
  errorMsg: string;
  toggleLoadingId: string | null;
  deleteLoadingId: string | null;
  onOpenCreate: () => void;
  openEdit: (u: UserRow) => void;
  handleToggleActive: (u: UserRow) => void;
  handleDelete: (id: string) => void;
  onDashboard: () => void;
}) {
  return (
    <Card className="rounded-xl border shadow-sm">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="font-semibold">Kullanıcılar</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="w-full min-w-0 sm:w-[280px] rounded-lg focus-visible:ring-2 cursor-text"
            placeholder="Ara: isim / email / departman / rol"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button
            size="sm"
            className="cursor-pointer min-w-[7rem]"
            onClick={onOpenCreate}
          >
            Yeni Kullanıcı
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="cursor-pointer"
            onClick={onDashboard}
          >
            Dashboard
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {errorMsg && (
          <Alert variant="destructive" className="rounded-lg">
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        {isUsersLoading && <UsersLoadingSkeleton />}

        {!isUsersLoading && filtered.length === 0 && <UsersEmptyState />}

        {!isUsersLoading && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((u) => (
              <UserRow
                key={u.id}
                u={u}
                isToggleLoading={toggleLoadingId === u.id}
                isDeleteLoading={deleteLoadingId === u.id}
                onToggle={() => handleToggleActive(u)}
                onEdit={(e) => {
                  e.stopPropagation();
                  openEdit(u);
                }}
                onDelete={(e) => {
                  e.stopPropagation();
                  handleDelete(u.id);
                }}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ================= PAGE ================= */

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
        setErrorMsg(
          toUserFriendlyError(data?.message ?? "Kullanıcılar çekilemedi.")
        );
        return;
      }

      if (!Array.isArray(data)) {
        setErrorMsg("Beklenmeyen veri formatı (Array değil).");
        return;
      }

      setUsers(data);
    } catch (e) {
      setErrorMsg(getNetworkError());
    } finally {
      setIsUsersLoading(false);
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
        setErrorMsg(
          toUserFriendlyError(data?.message ?? "Silme/Pasif etme başarısız.")
        );
        return;
      }

      // UI'da listeden kaldır (backend pasif ediyorsa bile admin listesi sadece aktifleri çekiyorsa zaten kaybolacak)
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch {
      setErrorMsg(getNetworkError());
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
        setErrorMsg(
          toUserFriendlyError(data?.message ?? "Durum güncelleme başarısız.")
        );
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
      setErrorMsg(getNetworkError());
    } finally {
      setToggleLoadingId(null);
    }
  };

  if (!me) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">
          <AdminHeader onRefresh={() => {}} refreshLoading={true} />
          <Card className="rounded-xl border shadow-sm">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="font-semibold">Kullanıcılar</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  className="w-full min-w-0 sm:w-[280px] rounded-lg focus-visible:ring-2 cursor-text"
                  placeholder="Ara: isim / email / departman / rol"
                  disabled
                />
              </div>
            </CardHeader>
            <CardContent>
              <UsersLoadingSkeleton />
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">
        <AdminHeader onRefresh={fetchUsers} refreshLoading={isUsersLoading} />

        <UsersTable
          query={query}
          setQuery={setQuery}
          filtered={filtered}
          isUsersLoading={isUsersLoading}
          errorMsg={errorMsg}
          toggleLoadingId={toggleLoadingId}
          deleteLoadingId={deleteLoadingId}
          onOpenCreate={() => setOpenModal(true)}
          openEdit={openEdit}
          handleToggleActive={handleToggleActive}
          handleDelete={handleDelete}
          onDashboard={() => router.push("/dashboard")}
        />
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
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => setEditOpen(false)}
            >
              İptal
            </Button>
            <Button
              className="cursor-pointer min-w-[6.5rem]"
              onClick={handleSave}
              disabled={editLoading}
            >
              {editLoading ? "Kaydediliyor…" : "Kaydet"}
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
