"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  Search,
  Pencil,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";

// ==================== ROLE CONFIGURATION ====================
// Roles are conditional on Function selection (matches VerifAI reference)
const ROLES_BY_FUNCTION: Record<string, string[]> = {
  "TPRM Team": ["Account Manager", "Approver", "Assessor", "Auditor"],
  "Business": ["Business Owner", "Internal IT Team", "Relationship Manager"],
};

const ALL_ROLES = [
  ...ROLES_BY_FUNCTION["TPRM Team"],
  ...ROLES_BY_FUNCTION["Business"],
];

const FUNCTION_OPTIONS = ["TPRM Team", "Business"];

// ==================== TYPES ====================
interface TPRMUser {
  id: string;
  fullName: string;
  email: string;
  userName: string;
  isActive: boolean;
  tprmRole: string | null;
  tprmFunctionCategory: string | null;
  customerAccount?: { name: string };
  createdAt: string;
}

interface UserFormData {
  fullName: string;
  userName: string;
  email: string;
  tprmFunctionCategory: string;
  tprmRole: string;
  isActive: boolean;
  password: string;
  confirmPassword: string;
}

const emptyForm: UserFormData = {
  fullName: "",
  userName: "",
  email: "",
  tprmFunctionCategory: "",
  tprmRole: "",
  isActive: true,
  password: "",
  confirmPassword: "",
};

// ==================== COMPONENT ====================
export default function UserManagementPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { data: session } = useSession();
  const { canCreate, canEdit, canDelete } = usePermissions("tprm.user-management");

  const [users, setUsers] = useState<TPRMUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<TPRMUser | null>(null);
  const [formData, setFormData] = useState<UserFormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  // Company name from session (read-only in form)
  const companyName = session?.user?.customerAccountName || "";

  // Available roles based on selected function
  const availableRoles = useMemo(() => {
    if (!formData.tprmFunctionCategory) return [];
    return ROLES_BY_FUNCTION[formData.tprmFunctionCategory] || [];
  }, [formData.tprmFunctionCategory]);

  // ==================== DATA FETCHING ====================
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (roleFilter && roleFilter !== "all") params.set("role", roleFilter);
      params.set("limit", "100");

      const res = await fetch(`/api/tprm/user-management?${params}`);
      if (res.ok) {
        const json = await res.json();
        setUsers(json.users);
        setTotal(json.total);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchUsers, 300);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  // ==================== FORM VALIDATION ====================
  const validateForm = (isEdit: boolean): string | null => {
    if (!formData.fullName.trim()) return t("Full Name is required");
    if (!formData.userName.trim() && !isEdit) return t("Username is required");
    if (!formData.email.trim()) return t("Email is required");
    if (!formData.tprmFunctionCategory) return t("Function is required");
    if (!formData.tprmRole) return t("User Role is required");
    if (!isEdit && !formData.password) return t("Password is required");
    if (formData.password && formData.password !== formData.confirmPassword) {
      return t("Passwords do not match");
    }
    return null;
  };

  // ==================== HANDLERS ====================
  const handleCreate = async () => {
    const error = validateForm(false);
    if (error) {
      toast({ title: t("Validation Error"), description: error, variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/tprm/user-management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formData.fullName,
          userName: formData.userName,
          email: formData.email,
          password: formData.password,
          tprmFunctionCategory: formData.tprmFunctionCategory,
          tprmRole: formData.tprmRole,
          isActive: formData.isActive,
        }),
      });

      if (res.ok) {
        toast({ title: t("User created successfully") });
        setShowCreateDialog(false);
        setFormData(emptyForm);
        fetchUsers();
      } else {
        const err = await res.json();
        toast({
          title: t("Error"),
          description: err.error || t("Failed to create user"),
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to create user"), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedUser) return;
    const error = validateForm(true);
    if (error) {
      toast({ title: t("Validation Error"), description: error, variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        id: selectedUser.id,
        fullName: formData.fullName,
        email: formData.email,
        tprmRole: formData.tprmRole,
        tprmFunctionCategory: formData.tprmFunctionCategory,
        isActive: formData.isActive,
      };
      if (formData.password) {
        payload.password = formData.password;
      }

      const res = await fetch("/api/tprm/user-management", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast({ title: t("User updated successfully") });
        setShowEditDialog(false);
        setSelectedUser(null);
        setFormData(emptyForm);
        fetchUsers();
      } else {
        const err = await res.json();
        toast({
          title: t("Error"),
          description: err.error || t("Failed to update user"),
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to update user"), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/tprm/user-management?id=${selectedUser.id}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        toast({ title: t("User deleted successfully") });
        setShowDeleteDialog(false);
        setSelectedUser(null);
        fetchUsers();
      } else {
        const err = await res.json();
        toast({
          title: t("Error"),
          description: err.error || t("Failed to delete user"),
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to delete user"), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = (user: TPRMUser) => {
    setSelectedUser(user);
    setFormData({
      fullName: user.fullName,
      userName: user.userName,
      email: user.email,
      tprmFunctionCategory: user.tprmFunctionCategory || "",
      tprmRole: user.tprmRole || "",
      isActive: user.isActive,
      password: "",
      confirmPassword: "",
    });
    setShowEditDialog(true);
  };

  const openDeleteDialog = (user: TPRMUser) => {
    setSelectedUser(user);
    setShowDeleteDialog(true);
  };

  // When function changes, reset role if current role is not in the new function's list
  const handleFunctionChange = (fn: string) => {
    const newRoles = ROLES_BY_FUNCTION[fn] || [];
    const roleStillValid = newRoles.includes(formData.tprmRole);
    setFormData({
      ...formData,
      tprmFunctionCategory: fn,
      tprmRole: roleStillValid ? formData.tprmRole : "",
    });
  };

  // Account Manager users cannot be deleted (matches reference app behavior)
  const canDeleteUser = (user: TPRMUser) =>
    canDelete && user.tprmRole !== "Account Manager";

  // ==================== FORM FIELDS (shared between Create & Edit) ====================
  const renderFormFields = (isEdit: boolean) => (
    <div className="space-y-4">
      <div>
        <Label>{t("Full Name")} *</Label>
        <Input
          placeholder={t("Enter the Full Name")}
          value={formData.fullName}
          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
        />
      </div>
      <div>
        <Label>{t("Username")} {!isEdit && "*"}</Label>
        <Input
          placeholder={t("Username")}
          value={formData.userName}
          disabled={isEdit}
          onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
        />
      </div>
      <div>
        <Label>{t("Email")} *</Label>
        <Input
          type="email"
          placeholder={t("Enter the Email address")}
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />
      </div>
      <div>
        <Label>{t("Function")} *</Label>
        <Select
          value={formData.tprmFunctionCategory}
          onValueChange={handleFunctionChange}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("Select Function")} />
          </SelectTrigger>
          <SelectContent>
            {FUNCTION_OPTIONS.map((fn) => (
              <SelectItem key={fn} value={fn}>
                {t(fn)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>{t("User Role")} *</Label>
        <Select
          value={formData.tprmRole}
          onValueChange={(v) => setFormData({ ...formData, tprmRole: v })}
          disabled={!formData.tprmFunctionCategory}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={
                formData.tprmFunctionCategory
                  ? t("Select Role")
                  : t("Select Function first")
              }
            />
          </SelectTrigger>
          <SelectContent>
            {availableRoles.map((role) => (
              <SelectItem key={role} value={role}>
                {t(role)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>{t("Company Name")}</Label>
        <Input value={companyName} disabled />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id={isEdit ? "editIsActive" : "createIsActive"}
          checked={formData.isActive}
          onCheckedChange={(checked) =>
            setFormData({ ...formData, isActive: !!checked })
          }
        />
        <Label htmlFor={isEdit ? "editIsActive" : "createIsActive"}>
          {t("Active")}
        </Label>
      </div>
      <div>
        <Label>
          {isEdit ? t("New password") : t("New password")} {!isEdit && "*"}
        </Label>
        <Input
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
        />
      </div>
      <div>
        <Label>
          {t("Confirm password")} {!isEdit && formData.password ? "*" : ""}
        </Label>
        <Input
          type="password"
          value={formData.confirmPassword}
          onChange={(e) =>
            setFormData({ ...formData, confirmPassword: e.target.value })
          }
        />
      </div>
    </div>
  );

  // ==================== RENDER ====================
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("User Management")}</h1>
        {canCreate && (
          <Button
            onClick={() => {
              setFormData(emptyForm);
              setShowCreateDialog(true);
            }}
          >
            {t("Add")}
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("Search by Name")}
                className="ltr:pl-9 rtl:pr-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t("All Roles")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All Roles")}</SelectItem>
                {ALL_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {t(role)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table — matches reference: Name, Email, Role, Action */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {t("No users found")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Name")}</TableHead>
                    <TableHead>{t("Email")}</TableHead>
                    <TableHead>{t("Role")}</TableHead>
                    <TableHead className="text-right">{t("Action")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium text-primary">
                        {user.fullName}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.tprmRole ? t(user.tprmRole) : "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {canEdit && (
                            <Button
                              variant="default"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditDialog(user)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDeleteUser(user) && (
                            <Button
                              variant="destructive"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openDeleteDialog(user)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog — "New Account" */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("New Account")}</DialogTitle>
          </DialogHeader>
          {renderFormFields(false)}
          <DialogFooter>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting && (
                <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />
              )}
              {t("Save")}
            </Button>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              {t("Cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("Edit Account")}</DialogTitle>
          </DialogHeader>
          {renderFormFields(true)}
          <DialogFooter>
            <Button onClick={handleEdit} disabled={submitting}>
              {submitting && (
                <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />
              )}
              {t("Save")}
            </Button>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              {t("Cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete User")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to delete")} {selectedUser?.fullName}?{" "}
              {t("This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting && (
                <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />
              )}
              {t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
