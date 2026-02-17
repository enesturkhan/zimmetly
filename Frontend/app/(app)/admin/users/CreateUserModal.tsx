"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { toUserFriendlyError, getNetworkError } from "@/lib/errorMessages";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export default function CreateUserModal({
  open,
  onClose,
  onSuccess,
}: Props) {
  const getToken = useAuthStore((s: any) => s.getToken);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    department: "",
    role: "USER",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    setError("");

    if (!form.fullName || !form.email || !form.password) {
      setError("Zorunlu alanları doldurun");
      return;
    }

    setLoading(true);

    try {
      const token = getToken();

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/create-user`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(
          toUserFriendlyError(data?.message ?? "Kullanıcı oluşturulamadı")
        );
        return;
      }

      onSuccess();
      setForm({
        fullName: "",
        email: "",
        department: "",
        role: "USER",
        password: "",
      });
    } catch {
      setError(getNetworkError());
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni Kullanıcı Ekle</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            placeholder="Ad Soyad"
            value={form.fullName}
            onChange={(e) =>
              setForm({ ...form, fullName: e.target.value })
            }
          />

          <Input
            placeholder="Email"
            value={form.email}
            onChange={(e) =>
              setForm({ ...form, email: e.target.value })
            }
          />

          <Input
            placeholder="Departman"
            value={form.department}
            onChange={(e) =>
              setForm({ ...form, department: e.target.value })
            }
          />

          <select
            className="w-full border rounded p-2"
            value={form.role}
            onChange={(e) =>
              setForm({ ...form, role: e.target.value })
            }
          >
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>

          <Input
            type="password"
            placeholder="Şifre"
            value={form.password}
            onChange={(e) =>
              setForm({ ...form, password: e.target.value })
            }
          />

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            className="w-full"
            onClick={handleCreate}
            disabled={loading}
          >
            {loading ? "Oluşturuluyor..." : "Kullanıcı Oluştur"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
