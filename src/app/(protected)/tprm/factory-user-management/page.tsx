"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Search, Pencil, Trash2, Home, ChevronRight, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { isAlphaWithSpaces, isAlphanumeric } from "@/lib/validations";
import { validateEmail } from "@/lib/validations/email";

// Factory Admin can only create FactoryAssessor users
const FIXED_ROLE = "Factory Assessor";
const FIXED_FUNCTION = "Factory";

interface TPRMUser {
  id: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  email: string;
  userName: string;
  isActive: boolean;
  tprmRole: string | null;
  tprmFunctionCategory: string | null;
  customerAccount?: { name: string };
  createdAt: string;
}

interface UserFormData {
  firstName: string;
  lastName: string;
  fullName: string;
  userName: string;
  email: string;
  isActive: boolean;
  password: string;
  confirmPassword: string;
}

const emptyForm: UserFormData = {
  firstName: "",
  lastName: "",
  fullName: "",
  userName: "",
  email: "",
  isActive: true,
  password: "",
  confirmPassword: "",
};

export default function FactoryUserManagementPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { data: session } = useSession();
  const { canCreate, canEdit, canDelete } = usePermissions("tprm.factory-user-management");

  const [users, setUsers] = useState<TPRMUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<TPRMUser | null>(null);
  const [formData, setFormData] = useState<UserFormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const addScrollRef = useRef<HTMLDivElement>(null);
  const editScrollRef = useRef<HTMLDivElement>(null);

  const companyName = session?.user?.customerAccountName || "";

  // Fetch only FactoryAssessor users
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("role", FIXED_ROLE);
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
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(fetchUsers, 300);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const validateForm = (isEdit: boolean): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!formData.firstName.trim()) {
      errors.firstName = t("Please Enter the First Name");
    } else if (!isAlphaWithSpaces(formData.firstName.trim())) {
      errors.firstName = t("Only letters and spaces are allowed");
    }
    if (!formData.lastName.trim()) {
      errors.lastName = t("Please Enter the Last Name");
    } else if (!isAlphaWithSpaces(formData.lastName.trim())) {
      errors.lastName = t("Only letters and spaces are allowed");
    }
    if (!formData.fullName.trim()) {
      errors.fullName = t("Please Enter the Name");
    }
    if (!isEdit) {
      if (!formData.userName.trim()) {
        errors.userName = t("Please Enter the UserName");
      } else if (!isAlphanumeric(formData.userName.trim())) {
        errors.userName = t("Only letters, numbers, and underscores are allowed");
      }
    }
    const emailError = validateEmail(formData.email);
    if (emailError) errors.email = t(emailError);
    if (!isEdit) {
      if (!formData.password) errors.password = t("Password can not be empty");
      if (!formData.confirmPassword) errors.confirmPassword = t("Password can not be empty");
    }
    if (formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword) {
      errors.confirmPassword = t("Passwords do not match");
    }
    return errors;
  };

  const clearError = (field: string) => {
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleCreate = async () => {
    const errors = validateForm(false);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      addScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setFormErrors({});
    setSubmitting(true);
    try {
      const res = await fetch("/api/tprm/user-management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          fullName: formData.fullName,
          userName: formData.userName,
          email: formData.email,
          password: formData.password,
          tprmFunctionCategory: FIXED_FUNCTION,
          tprmRole: FIXED_ROLE,
          isActive: formData.isActive,
        }),
      });

      if (res.ok) {
        toast({ title: t("User created successfully") });
        setShowCreateDialog(false);
        setFormData(emptyForm);
        setFormErrors({});
        fetchUsers();
      } else {
        const err = await res.json();
        toast({ title: t("Error"), description: err.error || t("Failed to create user"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to create user"), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedUser) return;
    const errors = validateForm(true);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      editScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setFormErrors({});
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        id: selectedUser.id,
        firstName: formData.firstName,
        lastName: formData.lastName,
        fullName: formData.fullName,
        email: formData.email,
        tprmRole: FIXED_ROLE,
        tprmFunctionCategory: FIXED_FUNCTION,
        isActive: formData.isActive,
      };
      if (formData.password) payload.password = formData.password;

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
        setFormErrors({});
        fetchUsers();
      } else {
        const err = await res.json();
        toast({ title: t("Error"), description: err.error || t("Failed to update user"), variant: "destructive" });
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
      const res = await fetch(`/api/tprm/user-management?id=${selectedUser.id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: t("User deleted successfully") });
        setShowDeleteDialog(false);
        setSelectedUser(null);
        fetchUsers();
      } else {
        const err = await res.json();
        toast({ title: t("Error"), description: err.error || t("Failed to delete user"), variant: "destructive" });
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
      firstName: user.firstName || user.fullName.split(" ")[0] || "",
      lastName: user.lastName || user.fullName.split(" ").slice(1).join(" ") || "",
      fullName: user.fullName,
      userName: user.userName,
      email: user.email,
      isActive: user.isActive,
      password: "",
      confirmPassword: "",
    });
    setFormErrors({});
    setShowEditDialog(true);
  };

  const renderFormContent = (isEdit: boolean) => (
    <div className="space-y-4">
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">{t("Account Credentials")}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label className="text-sm font-medium text-slate-700">{t("Username")} {!isEdit && "*"}</Label>
            <Input
              value={formData.userName}
              onChange={(e) => { setFormData({ ...formData, userName: e.target.value }); clearError("userName"); }}
              disabled={isEdit}
              className={formErrors.userName ? "border-red-400" : ""}
            />
            {formErrors.userName && <p className="text-xs text-red-500 mt-1">{formErrors.userName}</p>}
          </div>
          {!isEdit && (
            <>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Password")} *</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => { setFormData({ ...formData, password: e.target.value }); clearError("password"); }}
                  className={formErrors.password ? "border-red-400" : ""}
                />
                {formErrors.password && <p className="text-xs text-red-500 mt-1">{formErrors.password}</p>}
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Confirm Password")} *</Label>
                <Input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => { setFormData({ ...formData, confirmPassword: e.target.value }); clearError("confirmPassword"); }}
                  className={formErrors.confirmPassword ? "border-red-400" : ""}
                />
                {formErrors.confirmPassword && <p className="text-xs text-red-500 mt-1">{formErrors.confirmPassword}</p>}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">{t("Personal Information")}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-sm font-medium text-slate-700">{t("First Name")} *</Label>
            <Input
              value={formData.firstName}
              onChange={(e) => {
                const fn = e.target.value;
                setFormData({ ...formData, firstName: fn, fullName: `${fn} ${formData.lastName}`.trim() });
                clearError("firstName");
              }}
              className={formErrors.firstName ? "border-red-400" : ""}
            />
            {formErrors.firstName && <p className="text-xs text-red-500 mt-1">{formErrors.firstName}</p>}
          </div>
          <div>
            <Label className="text-sm font-medium text-slate-700">{t("Last Name")} *</Label>
            <Input
              value={formData.lastName}
              onChange={(e) => {
                const ln = e.target.value;
                setFormData({ ...formData, lastName: ln, fullName: `${formData.firstName} ${ln}`.trim() });
                clearError("lastName");
              }}
              className={formErrors.lastName ? "border-red-400" : ""}
            />
            {formErrors.lastName && <p className="text-xs text-red-500 mt-1">{formErrors.lastName}</p>}
          </div>
          <div>
            <Label className="text-sm font-medium text-slate-700">{t("Full Name")}</Label>
            <Input value={formData.fullName} disabled className="bg-muted/30" />
          </div>
          <div>
            <Label className="text-sm font-medium text-slate-700">{t("Email")} *</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => { setFormData({ ...formData, email: e.target.value }); clearError("email"); }}
              className={formErrors.email ? "border-red-400" : ""}
            />
            {formErrors.email && <p className="text-xs text-red-500 mt-1">{formErrors.email}</p>}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">{t("Organization & Role")}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-sm font-medium text-slate-700">{t("Role")}</Label>
            <Input value={t(FIXED_ROLE)} disabled className="bg-muted/30" />
          </div>
          <div>
            <Label className="text-sm font-medium text-slate-700">{t("Company Name")}</Label>
            <Input value={companyName} disabled className="bg-muted/30" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Checkbox
          checked={formData.isActive}
          onCheckedChange={(c) => setFormData({ ...formData, isActive: !!c })}
        />
        <Label className="text-sm">{t("Active")}</Label>
      </div>

      {isEdit && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">{t("Change Password")}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("New Password")}</Label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Confirm Password")}</Label>
              <Input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => { setFormData({ ...formData, confirmPassword: e.target.value }); clearError("confirmPassword"); }}
                className={formErrors.confirmPassword ? "border-red-400" : ""}
              />
              {formErrors.confirmPassword && <p className="text-xs text-red-500 mt-1">{formErrors.confirmPassword}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Assessment Factory")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("User Management")}</span>
      </nav>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("User Management")}</h1>
        {canCreate && (
          <Button onClick={() => { setFormData(emptyForm); setFormErrors({}); setShowCreateDialog(true); }}>
            <Users className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5" /> {t("Add User")}
          </Button>
        )}
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("Search users...")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <span className="text-sm text-muted-foreground">{total} {t("users")}</span>
          </div>
        </CardContent>
      </Card>

      {/* Users table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Name")}</TableHead>
                <TableHead>{t("Username")}</TableHead>
                <TableHead>{t("Email")}</TableHead>
                <TableHead>{t("Role")}</TableHead>
                <TableHead>{t("Status")}</TableHead>
                <TableHead className="text-right">{t("Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {t("No users found")}
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.fullName}</TableCell>
                    <TableCell>{user.userName}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{t(user.tprmRole || "-")}</TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${user.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                        {user.isActive ? t("Active") : t("Inactive")}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <TooltipProvider>
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(user)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t("Edit")}</TooltipContent>
                            </Tooltip>
                          )}
                          {canDelete && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setSelectedUser(user); setShowDeleteDialog(true); }}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t("Delete")}</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="!max-w-lg max-h-[85vh] overflow-y-auto" ref={addScrollRef}>
          <DialogHeader>
            <DialogTitle>{t("Add Factory Assessor")}</DialogTitle>
          </DialogHeader>
          {renderFormContent(false)}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>{t("Cancel")}</Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 ltr:mr-1 rtl:ml-1 animate-spin" />}
              {t("Create")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="!max-w-lg max-h-[85vh] overflow-y-auto" ref={editScrollRef}>
          <DialogHeader>
            <DialogTitle>{t("Edit User")}</DialogTitle>
          </DialogHeader>
          {renderFormContent(true)}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>{t("Cancel")}</Button>
            <Button onClick={handleEdit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 ltr:mr-1 rtl:ml-1 animate-spin" />}
              {t("Save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete User")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to delete")} <strong>{selectedUser?.fullName}</strong>? {t("This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={submitting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
