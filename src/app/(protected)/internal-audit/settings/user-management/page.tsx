"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, ArrowUpDown, Search, Home, ChevronRight } from "lucide-react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePermissions } from "@/hooks/usePermissions";
import { isAlphaWithSpaces } from "@/lib/validations";
import { validateEmail } from "@/lib/validations/email";

interface User {
  id: string;
  userName: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: string;
  departmentId: string | null;
  department?: { id: string; name: string } | null;
  function?: string;
  designation?: string;
}

interface Department {
  id: string;
  name: string;
}

// Role restrictions:
// - CustomerAdmin can ONLY create AuditHead users
// - AuditHead can create AuditHead, AuditManager and Auditee users
const CUSTOMER_ADMIN_ALLOWED_ROLES = ["AuditHead"];
const AUDIT_HEAD_ALLOWED_ROLES = ["AuditHead", "AuditManager", "Auditee"];

export default function UserManagementPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { canView: canViewDashboard } = usePermissions('audit.dashboard');
  const { data: session } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [searchTerm, setSearchTerm] = useState("");

  // Determine which roles the current user can assign
  const userRoles = session?.user?.roles || [];
  const isGRCAdmin = userRoles.includes("GRCAdministrator");
  const isCustomerAdmin = userRoles.includes("CustomerAdministrator");
  const isAuditHead = userRoles.includes("AuditHead");

  // Get allowed roles based on current user's role
  const getAllowedRoles = (): string[] => {
    if (isGRCAdmin) {
      // GRC Admin can create all audit roles
      return ["AuditHead", "AuditManager", "Auditee"];
    } else if (isCustomerAdmin) {
      // Customer Admin can ONLY create AuditHead
      return CUSTOMER_ADMIN_ALLOWED_ROLES;
    } else if (isAuditHead) {
      // Audit Head can create AuditHead, AuditManager and Auditee
      return AUDIT_HEAD_ALLOWED_ROLES;
    }
    return [];
  };

  const allowedRoles = getAllowedRoles();

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    fullName: "",
    userName: "",
    email: "",
    designation: "",
    departmentId: "",
    roles: [] as string[],
    password: "",
    confirmPassword: "",
  });
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({
    firstName: "",
    lastName: "",
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    roles: "",
  });

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<User | null>(null);

  // Change password dialog
  const [changePasswordDialogOpen, setChangePasswordDialogOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [changingPassword, setChangingPassword] = useState(false);

  // Auto-generated user ID
  const [nextUserId, setNextUserId] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Use Internal Audit specific API for users
      const [usersRes, departmentsRes] = await Promise.all([
        fetch("/api/internal-audit/users"),
        fetch("/api/departments"),
      ]);

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data);
        // Generate next user ID
        const maxId = data.reduce((max: number, user: User) => {
          const match = user.userName?.match(/BA(\d+)/);
          if (match) {
            return Math.max(max, parseInt(match[1]));
          }
          return max;
        }, 0);
        setNextUserId(`BA${String(maxId + 1).padStart(4, "0")}`);
      } else {
        console.error("Failed to fetch users:", await usersRes.text());
      }

      if (departmentsRes.ok) {
        setDepartments(await departmentsRes.json());
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = () => {
    const newOrder = sortOrder === "asc" ? "desc" : "asc";
    setSortOrder(newOrder);
    const sorted = [...users].sort((a, b) => {
      if (newOrder === "asc") {
        return a.fullName.localeCompare(b.fullName);
      }
      return b.fullName.localeCompare(a.fullName);
    });
    setUsers(sorted);
  };

  const openAddDialog = () => {
    setEditItem(null);
    setFormData({
      firstName: "",
      lastName: "",
      fullName: "",
      userName: nextUserId, // Auto-populate with generated ID
      email: "",
      designation: "",
      departmentId: "",
      roles: [],
      password: "",
      confirmPassword: "",
    });
    setFormErrors({
      firstName: "",
      lastName: "",
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      roles: "",
    });
    setDialogOpen(true);
  };

  const openEditDialog = (user: User) => {
    setEditItem(user);
    // Parse roles from the role string (comma-separated)
    const roles = user.role ? user.role.split(",").map((r) => r.trim()) : [];
    setFormData({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      fullName: user.fullName || "",
      userName: user.userName || "",
      email: user.email || "",
      designation: user.designation || "",
      departmentId: user.departmentId || "",
      roles,
      password: "",
      confirmPassword: "",
    });
    setFormErrors({
      firstName: "",
      lastName: "",
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      roles: "",
    });
    setDialogOpen(true);
  };

  const openChangePasswordDialog = () => {
    setPasswordForm({ newPassword: "", confirmPassword: "" });
    setChangePasswordDialogOpen(true);
  };

  const handleChangePassword = async () => {
    if (!editItem) return;
    if (!passwordForm.newPassword || passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({ title: t("Error"), description: t("Passwords do not match!"), variant: "destructive" });
      return;
    }

    setChangingPassword(true);
    try {
      // Use Internal Audit specific API
      const response = await fetch(`/api/internal-audit/users/${editItem.id}/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordForm.newPassword }),
      });

      if (response.ok) {
        setChangePasswordDialogOpen(false);
        toast({ title: t("Success"), description: t("Password changed successfully!") });
      } else {
        toast({ title: t("Error"), description: t("Failed to change password"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Failed to change password:", error);
      toast({ title: t("Error"), description: t("Failed to change password"), variant: "destructive" });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleRoleChange = (role: string, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      roles: checked
        ? [...prev.roles, role]
        : prev.roles.filter((r) => r !== role),
    }));
  };

  const handleSave = async () => {
    // Clear all errors first
    setFormErrors({
      firstName: "",
      lastName: "",
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      roles: "",
    });

    // Validate fields
    let hasError = false;
    const newErrors = {
      firstName: "",
      lastName: "",
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      roles: "",
    };

    if (!formData.firstName.trim()) {
      newErrors.firstName = t("First Name is required");
      hasError = true;
    } else if (!isAlphaWithSpaces(formData.firstName)) {
      newErrors.firstName = t("Only letters and spaces are allowed");
      hasError = true;
    }
    if (formData.lastName.trim() && !isAlphaWithSpaces(formData.lastName)) {
      newErrors.lastName = t("Only letters and spaces are allowed");
      hasError = true;
    }
    if (formData.fullName.trim() && !isAlphaWithSpaces(formData.fullName)) {
      newErrors.fullName = t("Only letters and spaces are allowed");
      hasError = true;
    }
    const emailError = validateEmail(formData.email);
    if (emailError) {
      newErrors.email = t(emailError);
      hasError = true;
    }
    if (!editItem && !formData.password.trim()) {
      newErrors.password = t("Password is required");
      hasError = true;
    }
    if (!editItem && formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t("Passwords do not match");
      hasError = true;
    }
    if (!formData.roles || formData.roles.length === 0) {
      newErrors.roles = t("At least one role must be selected");
      hasError = true;
    }

    if (hasError) {
      setFormErrors(newErrors);
      return;
    }

    setSaving(true);
    try {
      // Use Internal Audit specific API
      const url = editItem ? `/api/internal-audit/users/${editItem.id}` : "/api/internal-audit/users";
      const method = editItem ? "PUT" : "POST";

      // For new users, always use auto-generated ID. For edit, keep existing userName.
      const userIdToUse = editItem ? formData.userName : nextUserId;
      const body: any = {
        userId: userIdToUse, // API requires userId
        firstName: formData.firstName,
        lastName: formData.lastName,
        fullName: formData.fullName || `${formData.firstName} ${formData.lastName}`,
        userName: userIdToUse, // Use same value for userName
        email: formData.email,
        designation: formData.designation || null,
        departmentId: formData.departmentId || null,
        role: formData.roles.join(", "),
        function: "Audit",
      };

      if (!editItem && formData.password) {
        body.password = formData.password;
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setDialogOpen(false);
        fetchData();
        toast({ title: t("Success"), description: t("User saved successfully!") });
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast({
          title: t("Error"),
          description: errorData.error || t("Failed to save user"),
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Failed to save:", error);
      toast({ title: t("Error"), description: t("Failed to save user"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDialog = (user: User) => {
    setItemToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
      // Use Internal Audit specific API
      const response = await fetch(`/api/internal-audit/users/${itemToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchData();
        toast({ title: t("Success"), description: t("User deleted successfully!") });
      } else {
        toast({ title: t("Error"), description: t("Failed to delete user"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Failed to delete:", error);
      toast({ title: t("Error"), description: t("Failed to delete user"), variant: "destructive" });
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const parseRoles = (roleString: string): string[] => {
    return roleString ? roleString.split(",").map((r) => r.trim()).filter(Boolean) : [];
  };

  const filteredUsers = users.filter((user) =>
    user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Home className="h-4 w-4" />
            <span>{t("Internal Audit")}</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          {canViewDashboard && (
            <>
              <Link href="/internal-audit/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
                {t("Dashboard")}
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
            </>
          )}
          <Link href="/internal-audit/settings" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Settings")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-primary-700 font-medium">{t("User Management")}</span>
        </nav>

        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("User Management")}</h1>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
              <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
            </div>
            <p className="text-sm text-slate-500 font-medium">{t("Loading users...")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Internal Audit")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        {canViewDashboard && (
          <>
            <Link href="/internal-audit/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
              {t("Dashboard")}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          </>
        )}
        <Link href="/internal-audit/settings" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Settings")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("User Management")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("User Management")}</h1>
        <Button size="sm" onClick={openAddDialog}>
          <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t("New User")}
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Search */}
        <div className="flex flex-wrap items-center gap-3 px-3 sm:px-5 py-3 border-b border-slate-100">
          <div className="relative w-full sm:w-auto">
            <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder={t("Search users...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ltr:pl-10 rtl:pr-10 w-full sm:w-[300px] h-9 bg-slate-50 border-slate-200"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
        <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pl-5 rtl:pr-5">{t("Full Name")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Email")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("User Role")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pr-5 rtl:pl-5 w-[100px]">{t("Action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-sm text-slate-500">
                  {t("No users found")}
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id} className="border-b border-slate-100 last:border-0">
                  <TableCell className="py-3 text-sm font-medium text-slate-800 ltr:pl-5 rtl:pr-5">{user.fullName}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-600">{user.email}</TableCell>
                  <TableCell className="py-3">
                    <div className="flex flex-wrap gap-1">
                      {parseRoles(user.role).map((role, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {t(role)}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="py-3 ltr:pr-5 rtl:pl-5">
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-slate-600"
                        onClick={() => openEditDialog(user)}
                        title={t("Edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-semantic-error"
                        onClick={() => openDeleteDialog(user)}
                        title={t("Delete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>

        {/* Pagination info */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
          <span className="text-xs text-slate-500">
            {t("Showing")} {filteredUsers.length} {t("of")} {users.length} {t("users")}
          </span>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0 max-h-[90vh] overflow-hidden flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{editItem ? t("Edit User") : t("New Account")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6">
            <div className="space-y-5">
              {/* Row 1: User ID (System Generated) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("User ID")} <span className="text-xs text-slate-500">({t("Auto-generated")})</span></Label>
                  <Input
                    value={editItem ? editItem.userName : nextUserId}
                    disabled
                    className="mt-1.5 w-full bg-slate-50"
                  />
                </div>
              </div>

              {/* Row 2: First Name & Last Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("First Name")} <span className="text-red-500">*</span></Label>
                  <Input
                    value={formData.firstName}
                    onChange={(e) => {
                      setFormData({ ...formData, firstName: e.target.value });
                      setFormErrors({ ...formErrors, firstName: "" });
                    }}
                    placeholder={t("Enter first name")}
                    className={`mt-1.5 w-full bg-white ${formErrors.firstName ? "border-red-500" : ""}`}
                  />
                  {formErrors.firstName && <p className="text-sm text-red-500 mt-1">{formErrors.firstName}</p>}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Last Name")}</Label>
                  <Input
                    value={formData.lastName}
                    onChange={(e) => {
                      setFormData({ ...formData, lastName: e.target.value });
                      setFormErrors({ ...formErrors, lastName: "" });
                    }}
                    placeholder={t("Enter last name")}
                    className={`mt-1.5 w-full bg-white ${formErrors.lastName ? "border-red-500" : ""}`}
                  />
                  {formErrors.lastName && <p className="text-sm text-red-500 mt-1">{formErrors.lastName}</p>}
                </div>
              </div>

              {/* Row 3: Full Name & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Full Name")}</Label>
                  <Input
                    value={formData.fullName}
                    onChange={(e) => {
                      setFormData({ ...formData, fullName: e.target.value });
                      setFormErrors({ ...formErrors, fullName: "" });
                    }}
                    placeholder={t("Enter full name")}
                    className={`mt-1.5 w-full bg-white ${formErrors.fullName ? "border-red-500" : ""}`}
                  />
                  {formErrors.fullName && <p className="text-sm text-red-500 mt-1">{formErrors.fullName}</p>}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Email")} <span className="text-red-500">*</span></Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      setFormErrors({ ...formErrors, email: "" });
                    }}
                    placeholder={t("Enter email")}
                    className={`mt-1.5 w-full bg-white ${formErrors.email ? "border-red-500" : ""}`}
                  />
                  {formErrors.email && <p className="text-sm text-red-500 mt-1">{formErrors.email}</p>}
                </div>
              </div>

              {/* Row 4: Designation & Function */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Designation")}</Label>
                  <Input
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    placeholder={t("Enter designation (optional)")}
                    className="mt-1.5 w-full bg-white"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Function")}</Label>
                  <Input value={t("Audit")} disabled className="mt-1.5 w-full bg-slate-50" />
                </div>
              </div>

              {/* Row 5: Department */}
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Department")}</Label>
                <Select
                  value={formData.departmentId}
                  onValueChange={(value) => setFormData({ ...formData, departmentId: value })}
                >
                  <SelectTrigger className="mt-1.5 w-full bg-white border-slate-200">
                    <SelectValue placeholder={t("Select Department")} />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* User Role (multi-select with checkboxes) */}
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("User Role")} <span className="text-red-500">*</span></Label>
                <div className={`mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-2 border rounded-lg p-3 bg-white ${formErrors.roles ? "border-red-500" : "border-slate-200"}`}>
                  {allowedRoles.map((role) => (
                    <div key={role} className="flex items-center space-x-2">
                      <Checkbox
                        id={role}
                        checked={formData.roles.includes(role)}
                        onCheckedChange={(checked) => {
                          handleRoleChange(role, checked as boolean);
                          setFormErrors({ ...formErrors, roles: "" });
                        }}
                      />
                      <label htmlFor={role} className="text-sm cursor-pointer text-slate-700">
                        {t(role)}
                      </label>
                    </div>
                  ))}
                </div>
                {formErrors.roles && <p className="text-sm text-red-500 mt-1">{formErrors.roles}</p>}
                {allowedRoles.length === 1 && (
                  <p className="text-xs text-slate-500 mt-1">
                    {isCustomerAdmin ? t("As Customer Administrator, you can only create Audit Head users.") : ""}
                  </p>
                )}
              </div>

              {/* Password fields (only for new users) */}
              {!editItem && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Password")} <span className="text-red-500">*</span></Label>
                    <Input
                      type="password"
                      value={formData.password}
                      onChange={(e) => {
                        setFormData({ ...formData, password: e.target.value });
                        setFormErrors({ ...formErrors, password: "" });
                      }}
                      placeholder={t("Enter password")}
                      className={`mt-1.5 w-full bg-white ${formErrors.password ? "border-red-500" : ""}`}
                    />
                    {formErrors.password && <p className="text-sm text-red-500 mt-1">{formErrors.password}</p>}
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Confirm Password")} <span className="text-red-500">*</span></Label>
                    <Input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => {
                        setFormData({ ...formData, confirmPassword: e.target.value });
                        setFormErrors({ ...formErrors, confirmPassword: "" });
                      }}
                      placeholder={t("Confirm password")}
                      className={`mt-1.5 w-full bg-white ${formErrors.confirmPassword ? "border-red-500" : ""}`}
                    />
                    {formErrors.confirmPassword && <p className="text-sm text-red-500 mt-1">{formErrors.confirmPassword}</p>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Fixed Footer */}
          <div dir="ltr" className="flex-shrink-0 flex justify-end gap-2 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            {editItem && (
              <Button
                variant="outline"
                onClick={openChangePasswordDialog}
                type="button"
                className="mr-auto"
              >
                {t("Change Password")}
              </Button>
            )}
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t("Saving...") : t("Save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={changePasswordDialogOpen} onOpenChange={setChangePasswordDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Change Password")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-5">
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("New Password")} <span className="text-red-500">*</span></Label>
              <Input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                placeholder={t("Enter new password")}
                className="mt-1.5 w-full bg-white"
                
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Confirm New Password")} <span className="text-red-500">*</span></Label>
              <Input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                placeholder={t("Confirm new password")}
                className="mt-1.5 w-full bg-white"
              />
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex ltr:justify-end rtl:justify-start gap-2 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setChangePasswordDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={changingPassword || !passwordForm.newPassword || passwordForm.newPassword !== passwordForm.confirmPassword}
            >
              {changingPassword ? t("Changing...") : t("Change Password")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[95vw] sm:max-w-[400px] p-0 gap-0">
          <AlertDialogHeader className="px-6 py-5 border-b border-slate-100">
            <AlertDialogTitle className="text-lg font-semibold text-slate-800">{t("Confirm Delete")}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500 mt-1">
              {t("Are you sure you want to delete")} &quot;{itemToDelete?.fullName}&quot;? {t("This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex items-center ltr:justify-end rtl:justify-start gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              {t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
