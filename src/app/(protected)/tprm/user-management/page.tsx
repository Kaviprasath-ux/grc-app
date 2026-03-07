"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { isAlphaWithSpaces, isAlphanumeric } from "@/lib/validations";
import { validateEmail } from "@/lib/validations/email";

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
  tprmFunctionCategory: string;
  tprmRole: string;
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
  tprmFunctionCategory: "",
  tprmRole: "",
  isActive: true,
  password: "",
  confirmPassword: "",
};

// ==================== COMPONENT ====================
export default function UserManagementPage() {
  const { t, isRTL } = useLanguage();
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

  // Validation errors (field-level)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const addScrollRef = useRef<HTMLDivElement>(null);
  const editScrollRef = useRef<HTMLDivElement>(null);

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
    if (!formData.tprmFunctionCategory) errors.tprmFunctionCategory = t("Please Select the Function");
    if (!formData.tprmRole) errors.tprmRole = t("Please Select the Role");
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
          tprmFunctionCategory: formData.tprmFunctionCategory,
          tprmRole: formData.tprmRole,
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
    const firstName = user.firstName || user.fullName.split(" ")[0] || "";
    const lastName = user.lastName || user.fullName.split(" ").slice(1).join(" ") || "";
    setFormData({
      firstName,
      lastName,
      fullName: user.fullName,
      userName: user.userName,
      email: user.email,
      tprmFunctionCategory: user.tprmFunctionCategory || "",
      tprmRole: user.tprmRole || "",
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

  // When function changes, reset role if current role is not in the new function's list
  const handleFunctionChange = (fn: string) => {
    const newRoles = ROLES_BY_FUNCTION[fn] || [];
    const roleStillValid = newRoles.includes(formData.tprmRole);
    setFormData({
      ...formData,
      tprmFunctionCategory: fn,
      tprmRole: roleStillValid ? formData.tprmRole : "",
    });
    clearError("tprmFunctionCategory");
  };

  // Account Manager users cannot be deleted (matches reference app behavior)
  const canDeleteUser = (user: TPRMUser) =>
    canDelete && user.tprmRole !== "Account Manager";

  // ==================== FORM CONTENT (shared between Create & Edit) ====================
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

      {/* Organization & Role Section */}
      <div className="space-y-3 sm:space-y-4">
        <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">{t("Organization & Role")}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* Function - full width */}
          <div className="sm:col-span-2">
            <Label htmlFor="function" className="text-sm font-medium text-slate-700">{t("Function")} *</Label>
            <Select
              value={formData.tprmFunctionCategory}
              onValueChange={handleFunctionChange}
            >
              <SelectTrigger className={`mt-1.5 w-full bg-white ${formErrors.tprmFunctionCategory ? "border-red-500 focus-visible:ring-red-500" : ""}`}>
                <SelectValue placeholder={t("Select Function")} />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4} className="max-h-[200px]">
                {FUNCTION_OPTIONS.map((fn) => (
                  <SelectItem key={fn} value={fn}>
                    {t(fn)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formErrors.tprmFunctionCategory && (<div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2"><p className="text-sm text-red-600">{formErrors.tprmFunctionCategory}</p></div>)}
          </div>
          {/* Role - full width */}
          <div className="sm:col-span-2">
            <Label htmlFor="role" className="text-sm font-medium text-slate-700">{t("User Role")} *</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Select
                      value={formData.tprmRole}
                      onValueChange={(v) => { setFormData({ ...formData, tprmRole: v }); clearError("tprmRole"); }}
                      disabled={!formData.tprmFunctionCategory}
                    >
                      <SelectTrigger className={`mt-1.5 w-full bg-white ${!formData.tprmFunctionCategory ? "cursor-not-allowed opacity-50" : ""} ${formErrors.tprmRole ? "border-red-500 focus-visible:ring-red-500" : ""}`}>
                        <SelectValue
                          placeholder={
                            formData.tprmFunctionCategory
                              ? t("Select Role")
                              : t("Select Function first")
                          }
                        />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4} className="max-h-[200px]">
                        {availableRoles.map((role) => (
                          <SelectItem key={role} value={role}>
                            {t(role)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TooltipTrigger>
                {!formData.tprmFunctionCategory && (
                  <TooltipContent>
                    <p>{t("Please select a function first")}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
            {formErrors.tprmRole && (<div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2"><p className="text-sm text-red-600">{formErrors.tprmRole}</p></div>)}
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
    <div className="p-4 lg:p-6 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("User Management")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("User Management")}</h1>
          <p className="text-sm text-slate-500">{t("Manage TPRM users and their roles")}</p>
        </div>
        {canCreate && (
          <Button
            className="gap-2"
            onClick={() => {
              setFormData(emptyForm);
              setFormErrors({});
              setShowCreateDialog(true);
            }}
          >
            <Users className="h-4 w-4" />
            {t("Add")}
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
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

      {/* Users Table */}
      {loading ? (
        <div className="flex items-center justify-center h-[40vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
              <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
            </div>
            <p className="text-sm text-slate-500 font-medium">{t("Loading...")}</p>
          </div>
        </div>
      ) : users.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center">
          <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
            <Users className="h-6 w-6 text-primary-400" />
          </div>
          <p className="text-sm font-medium text-slate-600 mb-1">{t("No users found")}</p>
          <p className="text-xs text-slate-400">{t("Try adjusting your search or filters")}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider ps-5">{t("Name")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Email")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Role")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider text-right pe-5">{t("Action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                    <TableCell className="ps-5 py-3 font-medium text-primary">
                      {user.fullName}
                    </TableCell>
                    <TableCell className="py-3 text-sm text-slate-600">{user.email}</TableCell>
                    <TableCell className="py-3 text-sm text-slate-600">{user.tprmRole ? t(user.tprmRole) : "-"}</TableCell>
                    <TableCell className="pe-5 py-3 text-right">
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
          {/* Pagination Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
            <span className="text-xs text-slate-500">{users.length} {t("of")} {total} {t("users")}</span>
          </div>
        </div>
      )}

      {/* Create User Dialog — matches Organization Users layout */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) { setFormErrors({}); setFormData(emptyForm); }
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" style={isRTL ? { direction: 'rtl' } : undefined} onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg font-semibold text-slate-800">{t("New Account")}</DialogTitle>
            </DialogHeader>
          </div>
          {/* Scrollable Content */}
          <div ref={addScrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6">
            {renderFormContent(false)}
          </div>
          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex items-center justify-end gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg" style={{ direction: 'ltr' }}>
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
              <DialogTitle className="text-base sm:text-lg font-semibold text-slate-800">{t("Edit Account")}</DialogTitle>
            </DialogHeader>
          </div>
          {/* Scrollable Content */}
          <div ref={editScrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6">
            {renderFormContent(true)}
          </div>
          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex items-center justify-end gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg" style={{ direction: 'ltr' }}>
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
