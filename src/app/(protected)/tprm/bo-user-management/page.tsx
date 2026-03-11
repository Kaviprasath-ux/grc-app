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
} from "@/components/ui/dialog";
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
  Home,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useTranslatedData, triggerTranslation } from "@/hooks/useTranslatedData";
import { isAlphaWithSpaces, isAlphanumeric } from "@/lib/validations";
import { validateEmail } from "@/lib/validations/email";

// ==================== TYPES ====================
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
  department?: { name: string } | null;
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

// ==================== COMPONENT ====================
export default function BOUserManagementPage() {
  const { t, isRTL } = useLanguage();
  const { toast } = useToast();
  const { data: session } = useSession();
  const { canCreate, canEdit, canDelete } = usePermissions("tprm.bo-user-management");

  const [users, setUsers] = useState<TPRMUser[]>([]);
  const { data: translatedUsers } = useTranslatedData(users, { modelName: 'User' });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<TPRMUser | null>(null);
  const [formData, setFormData] = useState<UserFormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  // Validation errors (field-level)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const addScrollRef = useRef<HTMLDivElement>(null);
  const editScrollRef = useRef<HTMLDivElement>(null);

  // Company name from session (read-only in form)
  const companyName = session?.user?.customerAccountName || "";

  // ==================== DATA FETCHING ====================
  // Always filter to Relationship Manager role only
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("role", "Relationship Manager");
      if (search) params.set("search", search);
      params.set("limit", "100");

      const res = await fetch(`/api/tprm/user-management?${params}`);
      if (res.ok) {
        const json = await res.json();
        setUsers(json.users);
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

  // ==================== FORM VALIDATION ====================
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

  // Clear a specific field error on change
  const clearError = (field: string) => {
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // ==================== HANDLERS ====================
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
          tprmFunctionCategory: "Business",
          tprmRole: "Relationship Manager",
          isActive: formData.isActive,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        if (created.id) {
          triggerTranslation('User', created.id, {
            fullName: formData.fullName,
            firstName: formData.firstName,
            lastName: formData.lastName,
          });
        }
        toast({ title: t("Relationship Manager created successfully") });
        setShowCreateDialog(false);
        setFormData(emptyForm);
        setFormErrors({});
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
        tprmRole: "Relationship Manager",
        tprmFunctionCategory: "Business",
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
        triggerTranslation('User', selectedUser.id, {
          fullName: formData.fullName,
          firstName: formData.firstName,
          lastName: formData.lastName,
        });
        toast({ title: t("Relationship Manager updated successfully") });
        setShowEditDialog(false);
        setSelectedUser(null);
        setFormData(emptyForm);
        setFormErrors({});
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
        toast({ title: t("Relationship Manager deleted successfully") });
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
    const firstName = user.firstName || user.fullName.split(" ")[0] || "";
    const lastName = user.lastName || user.fullName.split(" ").slice(1).join(" ") || "";
    setFormData({
      firstName,
      lastName,
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

  const openDeleteDialog = (user: TPRMUser) => {
    setSelectedUser(user);
    setShowDeleteDialog(true);
  };

  // ==================== FORM CONTENT ====================
  const renderFormContent = (isEdit: boolean) => (
    <div className="space-y-4 sm:space-y-6">
      {/* Account Credentials Section */}
      <div className="space-y-3 sm:space-y-4">
        <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">{t("Account Credentials")}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* Username - full width */}
          <div className="sm:col-span-2">
            <Label htmlFor="userName" className="text-sm font-medium text-slate-700">{t("Username")} {!isEdit && "*"}</Label>
            <Input
              id="userName"
              value={formData.userName}
              disabled={isEdit}
              onChange={(e) => { setFormData({ ...formData, userName: e.target.value }); clearError("userName"); }}
              placeholder={t("Enter username")}
              className={`mt-1.5 bg-white ${formErrors.userName ? "border-red-500 focus-visible:ring-red-500" : ""}`}
            />
            {formErrors.userName && (<div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2"><p className="text-sm text-red-600">{formErrors.userName}</p></div>)}
          </div>
          {/* Email - full width */}
          <div className="sm:col-span-2">
            <Label htmlFor="email" className="text-sm font-medium text-slate-700">{t("Email")} *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => { setFormData({ ...formData, email: e.target.value }); clearError("email"); }}
              placeholder={t("Enter email")}
              className={`mt-1.5 bg-white ${formErrors.email ? "border-red-500 focus-visible:ring-red-500" : ""}`}
            />
            {formErrors.email && (<div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2"><p className="text-sm text-red-600">{formErrors.email}</p></div>)}
          </div>
          {/* Password and Confirm Password - side by side */}
          {!isEdit && (
            <>
              <div>
                <Label htmlFor="password" className="text-sm font-medium text-slate-700">{t("Password")} *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => { setFormData({ ...formData, password: e.target.value }); clearError("password"); }}
                  placeholder={t("Enter password")}
                  autoComplete="new-password"
                  className={`mt-1.5 bg-white ${formErrors.password ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                />
                {formErrors.password && (<div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2"><p className="text-sm text-red-600">{formErrors.password}</p></div>)}
              </div>
              <div>
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">{t("Confirm Password")} *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => { setFormData({ ...formData, confirmPassword: e.target.value }); clearError("confirmPassword"); }}
                  placeholder={t("Confirm password")}
                  autoComplete="new-password"
                  className={`mt-1.5 bg-white ${formErrors.confirmPassword ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                />
                {formErrors.confirmPassword && (<div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2"><p className="text-sm text-red-600">{formErrors.confirmPassword}</p></div>)}
              </div>
            </>
          )}
          {/* Edit mode: optional password change */}
          {isEdit && (
            <>
              <div>
                <Label htmlFor="newPassword" className="text-sm font-medium text-slate-700">{t("New password")}</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={formData.password}
                  onChange={(e) => { setFormData({ ...formData, password: e.target.value }); clearError("password"); }}
                  placeholder={t("Leave blank to keep current")}
                  autoComplete="new-password"
                  className="mt-1.5 bg-white"
                />
              </div>
              <div>
                <Label htmlFor="confirmNewPassword" className="text-sm font-medium text-slate-700">{t("Confirm Password")}</Label>
                <Input
                  id="confirmNewPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => { setFormData({ ...formData, confirmPassword: e.target.value }); clearError("confirmPassword"); }}
                  placeholder={t("Confirm new password")}
                  autoComplete="new-password"
                  className={`mt-1.5 bg-white ${formErrors.confirmPassword ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                />
                {formErrors.confirmPassword && (<div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2"><p className="text-sm text-red-600">{formErrors.confirmPassword}</p></div>)}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Personal Information Section */}
      <div className="space-y-3 sm:space-y-4">
        <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">{t("Personal Information")}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* First Name and Last Name - side by side */}
          <div>
            <Label htmlFor="firstName" className="text-sm font-medium text-slate-700">{t("First Name")} *</Label>
            <Input
              id="firstName"
              value={formData.firstName}
              onChange={(e) => {
                const newFirst = e.target.value;
                const autoFull = `${newFirst} ${formData.lastName}`.trim();
                setFormData({ ...formData, firstName: newFirst, fullName: autoFull });
                clearError("firstName");
                clearError("fullName");
              }}
              placeholder={t("Enter first name")}
              className={`mt-1.5 bg-white ${formErrors.firstName ? "border-red-500 focus-visible:ring-red-500" : ""}`}
            />
            {formErrors.firstName && (<div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2"><p className="text-sm text-red-600">{formErrors.firstName}</p></div>)}
          </div>
          <div>
            <Label htmlFor="lastName" className="text-sm font-medium text-slate-700">{t("Last Name")} *</Label>
            <Input
              id="lastName"
              value={formData.lastName}
              onChange={(e) => {
                const newLast = e.target.value;
                const autoFull = `${formData.firstName} ${newLast}`.trim();
                setFormData({ ...formData, lastName: newLast, fullName: autoFull });
                clearError("lastName");
                clearError("fullName");
              }}
              placeholder={t("Enter last name")}
              className={`mt-1.5 bg-white ${formErrors.lastName ? "border-red-500 focus-visible:ring-red-500" : ""}`}
            />
            {formErrors.lastName && (<div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2"><p className="text-sm text-red-600">{formErrors.lastName}</p></div>)}
          </div>
          {/* Full Name - full width, auto-generated */}
          <div className="sm:col-span-2">
            <Label htmlFor="fullName" className="text-sm font-medium text-slate-700">{t("Full Name")} *</Label>
            <Input
              id="fullName"
              value={formData.fullName}
              onChange={(e) => { setFormData({ ...formData, fullName: e.target.value }); clearError("fullName"); }}
              placeholder={t("Enter full name")}
              className={`mt-1.5 bg-white ${formErrors.fullName ? "border-red-500 focus-visible:ring-red-500" : ""}`}
            />
            {formErrors.fullName && (<div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2"><p className="text-sm text-red-600">{formErrors.fullName}</p></div>)}
          </div>
        </div>
      </div>

      {/* Organization Info Section (read-only, no Function/Role dropdowns) */}
      <div className="space-y-3 sm:space-y-4">
        <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">{t("Organization & Role")}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* Function - read-only */}
          <div>
            <Label className="text-sm font-medium text-slate-700">{t("Function")}</Label>
            <Input value={t("Business")} disabled className="mt-1.5 bg-slate-50" />
          </div>
          {/* Role - read-only */}
          <div>
            <Label className="text-sm font-medium text-slate-700">{t("User Role")}</Label>
            <Input value={t("Relationship Manager")} disabled className="mt-1.5 bg-slate-50" />
          </div>
          {/* Company Name - read-only */}
          <div className="sm:col-span-2">
            <Label className="text-sm font-medium text-slate-700">{t("Company Name")}</Label>
            <Input value={companyName} disabled className="mt-1.5 bg-slate-50" />
          </div>
        </div>
      </div>

      {/* Account Status Section */}
      <div className="space-y-3 sm:space-y-4">
        <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">{t("Account Status")}</h4>
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
          <div className={`flex items-center ${isRTL ? "space-x-reverse space-x-2" : "space-x-2"}`}>
            <Checkbox
              id={isEdit ? "editIsActive" : "createIsActive"}
              checked={formData.isActive}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, isActive: !!checked })
              }
            />
            <Label htmlFor={isEdit ? "editIsActive" : "createIsActive"} className="font-normal">
              {t("Active")}
            </Label>
          </div>
        </div>
      </div>
    </div>
  );

  // ==================== RENDER ====================
  return (
    <div className="p-6 space-y-6">
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("User Management")}</span>
      </nav>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("Relationship Managers")}</h1>
        {canCreate && (
          <Button
            onClick={() => {
              setFormData(emptyForm);
              setFormErrors({});
              setShowCreateDialog(true);
            }}
          >
            {t("Onboard New Relationship Manager")}
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
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : translatedUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {t("No users found")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Full Name")}</TableHead>
                    <TableHead>{t("Username")}</TableHead>
                    <TableHead>{t("Function")}</TableHead>
                    <TableHead>{t("Department")}</TableHead>
                    <TableHead className="text-right">{t("Action")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {translatedUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium text-primary">
                        {user.fullName}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.tprmFunctionCategory ? t(user.tprmFunctionCategory) : "-"}</TableCell>
                      <TableCell>{user.department?.name || "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                              onClick={() => openEditDialog(user)}
                              title={t("Edit")}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-400 hover:text-semantic-error hover:bg-red-50"
                              onClick={() => openDeleteDialog(user)}
                              title={t("Delete")}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) { setFormErrors({}); setFormData(emptyForm); }
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" style={isRTL ? { direction: 'rtl' } : undefined} onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg font-semibold text-slate-800">{t("Onboard New Relationship Manager")}</DialogTitle>
            </DialogHeader>
          </div>
          {/* Scrollable Content */}
          <div ref={addScrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6">
            {renderFormContent(false)}
          </div>
          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex items-center ltr:justify-end rtl:justify-start gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); setFormErrors({}); setFormData(emptyForm); }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? t("Saving...") : t("Save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => {
        setShowEditDialog(open);
        if (!open) { setFormErrors({}); setSelectedUser(null); setFormData(emptyForm); }
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" style={isRTL ? { direction: 'rtl' } : undefined} onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg font-semibold text-slate-800">{t("Edit Relationship Manager")}</DialogTitle>
            </DialogHeader>
          </div>
          {/* Scrollable Content */}
          <div ref={editScrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6">
            {renderFormContent(true)}
          </div>
          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex items-center ltr:justify-end rtl:justify-start gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => { setShowEditDialog(false); setFormErrors({}); setSelectedUser(null); setFormData(emptyForm); }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleEdit} disabled={submitting}>
              {submitting ? t("Saving...") : t("Save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete Relationship Manager")}</AlertDialogTitle>
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
