"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Home, Search, Plus, Edit, Trash2, Loader2,
} from "lucide-react";

interface SME {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  email: string;
  userName: string;
  isActive: boolean;
  tprmFunctionCategory: string | null;
  customerAccount: { name: string } | null;
  createdAt: string;
}

interface FormData {
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  userName: string;
  password: string;
  confirmPassword: string;
  tprmFunctionCategory: string;
  isActive: boolean;
}

const EMPTY_FORM: FormData = {
  firstName: "",
  lastName: "",
  fullName: "",
  email: "",
  userName: "",
  password: "",
  confirmPassword: "",
  tprmFunctionCategory: "Vendor SME",
  isActive: true,
};

export default function AMSmeManagementPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { data: session } = useSession();
  const { canCreate, canEdit, canDelete } = usePermissions("tprm.am-sme-management");

  const [smes, setSmes] = useState<SME[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSme, setEditingSme] = useState<SME | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSme, setDeletingSme] = useState<SME | null>(null);

  const fetchSmes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ search });
      const res = await fetch(`/api/tprm/am-sme-management?${params}`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setSmes(json.data || []);
    } catch {
      toast({ title: t("Error"), description: t("Failed to load SMEs"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [search, toast, t]);

  useEffect(() => {
    fetchSmes();
  }, [fetchSmes]);

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.fullName.trim()) e.fullName = t("Full name is required");
    if (!form.email.trim()) e.email = t("Email is required");
    if (!form.userName.trim()) e.userName = t("Username is required");
    if (!editingSme && !form.password) e.password = t("Password is required");
    if (form.password && form.password !== form.confirmPassword) e.confirmPassword = t("Passwords do not match");
    if (form.password && form.password.length < 1) e.password = t("Password is required");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        fullName: form.fullName,
        firstName: form.firstName || form.fullName.split(" ")[0],
        lastName: form.lastName || form.fullName.split(" ").slice(1).join(" ") || "-",
        email: form.email,
        tprmFunctionCategory: form.tprmFunctionCategory,
        isActive: form.isActive,
      };

      if (editingSme) {
        body.id = editingSme.id;
        if (form.password) body.password = form.password;
        const res = await fetch("/api/tprm/am-sme-management", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error || "Failed");
        }
        toast({ title: t("Success"), description: t("SME updated successfully") });
      } else {
        body.userName = form.userName;
        body.password = form.password;
        const res = await fetch("/api/tprm/am-sme-management", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error || "Failed");
        }
        toast({ title: t("Success"), description: t("SME created successfully") });
      }
      setDialogOpen(false);
      fetchSmes();
    } catch (err) {
      toast({ title: t("Error"), description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingSme) return;
    try {
      const res = await fetch(`/api/tprm/am-sme-management?id=${deletingSme.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast({ title: t("Success"), description: t("SME deleted successfully") });
      setDeleteDialogOpen(false);
      setDeletingSme(null);
      fetchSmes();
    } catch {
      toast({ title: t("Error"), description: t("Failed to delete SME"), variant: "destructive" });
    }
  };

  const openCreate = () => {
    setEditingSme(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setDialogOpen(true);
  };

  const openEdit = (sme: SME) => {
    setEditingSme(sme);
    setForm({
      firstName: sme.firstName || "",
      lastName: sme.lastName || "",
      fullName: sme.fullName,
      email: sme.email,
      userName: sme.userName,
      password: "",
      confirmPassword: "",
      tprmFunctionCategory: sme.tprmFunctionCategory || "Vendor SME",
      isActive: sme.isActive,
    });
    setErrors({});
    setDialogOpen(true);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString();

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Home className="h-4 w-4" />
        <span>/</span>
        <span>{t("TPRM")}</span>
        <span>/</span>
        <span className="text-foreground font-medium">{t("SME Management")}</span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("SME Management")}</h1>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
            {t("Add SME")}
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("Search SMEs...")}
          className="ltr:pl-9 rtl:pr-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : smes.length === 0 ? (
            <div className="text-center p-12 text-muted-foreground">
              {t("No SMEs found. Click Add SME to create one.")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Full Name")}</TableHead>
                  <TableHead>{t("Email")}</TableHead>
                  <TableHead>{t("Username")}</TableHead>
                  <TableHead>{t("Expertise")}</TableHead>
                  <TableHead>{t("Created Date")}</TableHead>
                  <TableHead>{t("Active")}</TableHead>
                  <TableHead>{t("Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {smes.map(sme => (
                  <TableRow key={sme.id}>
                    <TableCell className="font-medium">{sme.fullName}</TableCell>
                    <TableCell>{sme.email}</TableCell>
                    <TableCell>{sme.userName}</TableCell>
                    <TableCell>{sme.tprmFunctionCategory || "-"}</TableCell>
                    <TableCell>{formatDate(sme.createdAt)}</TableCell>
                    <TableCell>
                      <Badge className={sme.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}>
                        {sme.isActive ? t("Active") : t("Inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {canEdit && (
                          <Button variant="ghost" size="icon" onClick={() => openEdit(sme)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="icon" onClick={() => { setDeletingSme(sme); setDeleteDialogOpen(true); }}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSme ? t("Edit SME") : t("Add SME")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto ltr:pr-2 rtl:pl-2">
            <div>
              <Label>{t("Full Name")} *</Label>
              <Input
                value={form.fullName}
                onChange={e => {
                  setForm(p => ({ ...p, fullName: e.target.value }));
                  setErrors(p => ({ ...p, fullName: undefined }));
                }}
              />
              {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
            </div>
            <div>
              <Label>{t("Email")} *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={e => {
                  setForm(p => ({ ...p, email: e.target.value }));
                  setErrors(p => ({ ...p, email: undefined }));
                }}
              />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>
            <div>
              <Label>{t("Username")} {!editingSme && "*"}</Label>
              <Input
                value={form.userName}
                onChange={e => {
                  setForm(p => ({ ...p, userName: e.target.value }));
                  setErrors(p => ({ ...p, userName: undefined }));
                }}
                disabled={!!editingSme}
              />
              {errors.userName && <p className="text-xs text-red-500 mt-1">{errors.userName}</p>}
            </div>
            <div>
              <Label>{t("Expertise / Function")}</Label>
              <Input
                value={form.tprmFunctionCategory}
                onChange={e => setForm(p => ({ ...p, tprmFunctionCategory: e.target.value }))}
                placeholder={t("e.g., Network Security, Cloud Infrastructure")}
              />
            </div>
            <div>
              <Label>{editingSme ? t("New Password (optional)") : t("Password")} {!editingSme && "*"}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={e => {
                  setForm(p => ({ ...p, password: e.target.value }));
                  setErrors(p => ({ ...p, password: undefined }));
                }}
              />
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
            </div>
            {(form.password || !editingSme) && (
              <div>
                <Label>{t("Confirm Password")} {!editingSme && "*"}</Label>
                <Input
                  type="password"
                  value={form.confirmPassword}
                  onChange={e => {
                    setForm(p => ({ ...p, confirmPassword: e.target.value }));
                    setErrors(p => ({ ...p, confirmPassword: undefined }));
                  }}
                />
                {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>}
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label>{t("Active")}</Label>
              <Switch checked={form.isActive} onCheckedChange={v => setForm(p => ({ ...p, isActive: v }))} />
            </div>
            {(() => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const companyName = String((session?.user as any)?.customerAccountName || "");
              return companyName ? (
                <div>
                  <Label>{t("Company")}</Label>
                  <Input value={companyName} disabled />
                </div>
              ) : null;
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("Cancel")}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />}
              {editingSme ? t("Update") : t("Create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Delete SME")}</DialogTitle>
            <DialogDescription>
              {t("Are you sure you want to delete")} <strong>{deletingSme?.fullName}</strong>? {t("This action cannot be undone.")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>{t("Cancel")}</Button>
            <Button variant="destructive" onClick={handleDelete}>{t("Delete")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
