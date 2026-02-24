"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Pencil, Trash2, Search, Upload, Download, Home, ChevronRight, ChevronLeft, Eye, Users as UsersIcon } from "lucide-react";
import Link from "next/link";
import { DataGrid } from "@/components/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ColumnDef } from "@tanstack/react-table";
import { useToast } from "@/hooks/use-toast";
import { useTranslatedData, triggerTranslation } from "@/hooks/useTranslatedData";
import { isAlphaWithSpaces, isAlphanumeric } from "@/lib/validations";
import { validateEmail } from "@/lib/validations/email";
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

interface Department {
  id: string;
  name: string;
}

interface ReportingManager {
  id: string;
  fullName: string;
  designation?: string;
}

interface User {
  id: string;
  userName: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  designation: string;
  function?: string;
  role: string;
  language: string;
  timezone: string;
  isActive: boolean;
  isBlocked: boolean;
  departmentId?: string;
  department?: Department;
  reportingManagerId?: string;
  reportingManager?: ReportingManager;
  lastLogin?: string;
}

// RBAC roles mapped by function
// Note: For Audit function, roles are filtered based on who is creating the user
// Note: Contributor role is hidden/disabled - not available for selection
const rolesByFunction: Record<string, string[]> = {
  Business: ["DepartmentReviewer", "DepartmentContributor"],
  Security: ["Reviewer"],
  Audit: ["AuditHead", "AuditManager", "Auditor", "Auditee", "AuditUser"],
};

// CustomerAdmin can only create AuditHead when selecting Audit function
const customerAdminAuditRoles = ["AuditHead"];
// AuditHead can only create AuditManager and Auditee when selecting Audit function
const auditHeadAuditRoles = ["AuditManager", "Auditee"];

// All assignable roles for filtering (excludes GRCAdministrator)
// Note: Contributor role is hidden/disabled - not available for filtering
const allUserRoles = [
  "CustomerAdministrator",
  "AuditHead",
  "AuditManager",
  "AuditUser",
  "Auditor",
  "Auditee",
  "Reviewer",
  "DepartmentReviewer",
  "DepartmentContributor",
];

export default function UsersPage() {
  const { toast } = useToast();
  const { data: session } = useSession();
  const { t, isRTL } = useLanguage();
  const [activeTab, setActiveTab] = useState("account-overview");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [reportingManagers, setReportingManagers] = useState<ReportingManager[]>([]);
  const [loading, setLoading] = useState(true);

  const { data: translatedUsers } = useTranslatedData(users, { modelName: 'User' });
  const { data: translatedDepartments } = useTranslatedData(departments, { modelName: 'Department' });
  const { data: translatedManagers } = useTranslatedData(reportingManagers, { modelName: 'User' });
  const tDeptName = useCallback((id: string | undefined) => {
    if (!id) return undefined;
    return translatedDepartments.find(d => d.id === id)?.name;
  }, [translatedDepartments]);
  const tManagerName = useCallback((id: string | undefined) => {
    if (!id) return undefined;
    return translatedManagers.find(m => m.id === id)?.fullName;
  }, [translatedManagers]);

  // Check if user is DeptReviewer or DeptContributor (read-only department view)
  const userRoles = session?.user?.roles || [];
  const isDeptRole = userRoles.some((r: string) =>
    ["DepartmentReviewer", "DepartmentContributor"].includes(r)
  ) && !userRoles.some((r: string) =>
    ["Administrator", "CustomerAdministrator", "Reviewer", "Contributor"].includes(r)
  );
  const currentUserDepartmentId = session?.user?.departmentId;

  // Dialog states
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [isViewUserOpen, setIsViewUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [viewingUser, setViewingUser] = useState<User | null>(null);

  // Change password dialog states
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [changePasswordForm, setChangePasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [changingPassword, setChangingPassword] = useState(false);

  // Filter states
  const [roleFilter, setRoleFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentSearchTerm, setDepartmentSearchTerm] = useState("");

  // Import/Export states
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addUserScrollRef = useRef<HTMLDivElement>(null);
  const editUserScrollRef = useRef<HTMLDivElement>(null);

  // Subscription error dialog
  const [showSubscriptionErrorDialog, setShowSubscriptionErrorDialog] = useState(false);
  const [subscriptionErrorMessage, setSubscriptionErrorMessage] = useState("");

  // Saving states
  const [isSaving, setIsSaving] = useState(false);
  const [isEditSaving, setIsEditSaving] = useState(false);

  // Validation error states
  const [userFormErrors, setUserFormErrors] = useState<Record<string, string>>({});
  const [editUserFormErrors, setEditUserFormErrors] = useState<Record<string, string>>({});
  const [changePasswordErrors, setChangePasswordErrors] = useState<Record<string, string>>({});

  // Form state
  const [userForm, setUserForm] = useState({
    userName: "",
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    fullName: "",
    designation: "",
    function: "",
    role: "",
    language: "English",
    timezone: "UTC",
    isActive: true,
    isBlocked: false,
    departmentId: "",
    reportingManagerId: "",
  });

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [deptRes, userRes] = await Promise.all([
        fetch("/api/departments"),
        fetch("/api/users"),
      ]);

      if (deptRes.ok) setDepartments(await deptRes.json());
      if (userRes.ok) {
        const allUsers = await userRes.json();
        // Hide CustomerAdministrator from the users list
        setUsers(allUsers.filter((u: User) => u.role !== "CustomerAdministrator"));
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setLoading(false);
  };

  // Fetch reporting managers based on user's function
  const fetchReportingManagers = async (userFunction: string) => {
    try {
      const res = await fetch(`/api/users/reporting-managers?function=${userFunction}`);
      if (res.ok) {
        setReportingManagers(await res.json());
      }
    } catch (error) {
      console.error("Error fetching reporting managers:", error);
    }
  };

  // Check subscription before opening new user dialog
  const handleNewAccountClick = async () => {
    try {
      const res = await fetch("/api/subscription-status");
      if (res.ok) {
        const data = await res.json();
        if (!data.allowed) {
          if (data.reason === "expired") {
            setSubscriptionErrorMessage(t("Subscription plan has expired, kindly contact VerifAI support"));
          } else {
            setSubscriptionErrorMessage(t("You don't have an active Subscription plan, kindly contact VerifAI support"));
          }
          setShowSubscriptionErrorDialog(true);
          return;
        }
        // Check max accounts limit
        if (data.maxAccountsAllowed !== undefined && data.accountsUsed >= data.maxAccountsAllowed) {
          setSubscriptionErrorMessage(t("Maximum accounts limit reached. Your plan allows") + ` ${data.maxAccountsAllowed} ` + t("accounts") + `. ` + t("Kindly contact VerifAI support to upgrade your plan."));
          setShowSubscriptionErrorDialog(true);
          return;
        }
      }
    } catch (error) {
      console.error("Error checking subscription status:", error);
    }
    setIsAddUserOpen(true);
  };

  // User CRUD
  const handleAddUser = async () => {
    const errors: Record<string, string> = {};
    if (!userForm.firstName.trim()) {
      errors.firstName = t("Please Enter the First Name");
    } else if (!isAlphaWithSpaces(userForm.firstName.trim())) {
      errors.firstName = t("Only letters and spaces are allowed");
    }
    if (!userForm.lastName.trim()) {
      errors.lastName = t("Please Enter the Last Name");
    } else if (!isAlphaWithSpaces(userForm.lastName.trim())) {
      errors.lastName = t("Only letters and spaces are allowed");
    }
    if (!userForm.fullName.trim()) {
      errors.fullName = t("Please Enter the Name");
    } else if (!isAlphaWithSpaces(userForm.fullName.trim())) {
      errors.fullName = t("Only letters and spaces are allowed");
    }
    if (!userForm.userName.trim()) {
      errors.userName = t("Please Enter the UserName");
    } else if (!isAlphanumeric(userForm.userName.trim())) {
      errors.userName = t("Only letters, numbers, and underscores are allowed");
    }
    const emailError = validateEmail(userForm.email);
    if (emailError) errors.email = t(emailError);
    if (!userForm.function) errors.function = t("Please Select the Function");
    if (!userForm.role) errors.role = t("Please Select the Role");
    if (!userForm.departmentId) errors.departmentId = t("Please Select the Department");
    if (!userForm.password) errors.password = t("Password can not be empty");
    if (!userForm.confirmPassword) errors.confirmPassword = t("Password can not be empty");
    if (userForm.password && userForm.confirmPassword && userForm.password !== userForm.confirmPassword) {
      errors.confirmPassword = t("Passwords do not match");
    }
    if (Object.keys(errors).length > 0) {
      setUserFormErrors(errors);
      addUserScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setUserFormErrors({});
    setIsSaving(true);

    // Auto-generate User ID
    const userId = `USR-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          userName: userForm.userName,
          email: userForm.email,
          password: userForm.password,
          firstName: userForm.firstName,
          lastName: userForm.lastName,
          fullName: userForm.fullName,
          designation: userForm.designation,
          function: userForm.function,
          role: userForm.role,
          language: userForm.language,
          timezone: userForm.timezone,
          isActive: userForm.isActive,
          isBlocked: userForm.isBlocked,
          departmentId: userForm.departmentId || undefined,
          reportingManagerId: userForm.reportingManagerId || undefined,
        }),
      });

      if (res.ok) {
        const user = await res.json();
        setUsers([...users, user]);
        triggerTranslation('User', user.id, { fullName: user.fullName, firstName: user.firstName, lastName: user.lastName, designation: user.designation });
        resetForm();
        setIsAddUserOpen(false);
        toast({ title: t("Success"), description: t("User created successfully") });
      } else {
        const error = await res.json().catch(() => ({ error: `Server error (${res.status})` }));
        toast({ title: t("Error"), description: error.error || t("Failed to create user"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error adding user:", error);
      toast({ title: t("Error"), description: t("Failed to create user. Please try again."), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditUser = async () => {
    if (!editingUser) return;
    const errors: Record<string, string> = {};
    if (!editingUser.firstName.trim()) {
      errors.firstName = t("Please Enter the First Name");
    } else if (!isAlphaWithSpaces(editingUser.firstName.trim())) {
      errors.firstName = t("Only letters and spaces are allowed");
    }
    if (!editingUser.lastName.trim()) {
      errors.lastName = t("Please Enter the Last Name");
    } else if (!isAlphaWithSpaces(editingUser.lastName.trim())) {
      errors.lastName = t("Only letters and spaces are allowed");
    }
    if (!editingUser.fullName.trim()) {
      errors.fullName = t("Please Enter the Name");
    } else if (!isAlphaWithSpaces(editingUser.fullName.trim())) {
      errors.fullName = t("Only letters and spaces are allowed");
    }
    if (!editingUser.userName.trim()) {
      errors.userName = t("Please Enter the UserName");
    } else if (!isAlphanumeric(editingUser.userName.trim())) {
      errors.userName = t("Only letters, numbers, and underscores are allowed");
    }
    const editEmailError = validateEmail(editingUser.email);
    if (editEmailError) {
      errors.email = t(editEmailError);
    }
    if (Object.keys(errors).length > 0) {
      setEditUserFormErrors(errors);
      editUserScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setEditUserFormErrors({});
    setIsEditSaving(true);
    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingUser),
      });

      if (res.ok) {
        const updated = await res.json();
        setUsers(users.map((u) => (u.id === updated.id ? updated : u)));
        triggerTranslation('User', updated.id, { fullName: updated.fullName, firstName: updated.firstName, lastName: updated.lastName, designation: updated.designation });
        setIsEditUserOpen(false);
        setEditingUser(null);
        toast({ title: t("Success"), description: t("User updated successfully") });
      } else {
        const error = await res.json().catch(() => ({ error: "Failed to update user" }));
        toast({ title: t("Error"), description: error.error || t("Failed to update user"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error updating user:", error);
      toast({ title: t("Error"), description: t("Failed to update user"), variant: "destructive" });
    } finally {
      setIsEditSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!editingUser) return;

    const errors: Record<string, string> = {};
    if (!changePasswordForm.newPassword) errors.newPassword = t("Password can not be empty");
    if (!changePasswordForm.confirmPassword) errors.confirmPassword = t("Password can not be empty");
    if (changePasswordForm.newPassword && changePasswordForm.confirmPassword && changePasswordForm.newPassword !== changePasswordForm.confirmPassword) {
      errors.confirmPassword = t("Passwords do not match");
    }
    if (Object.keys(errors).length > 0) {
      setChangePasswordErrors(errors);
      return;
    }
    setChangePasswordErrors({});

    setChangingPassword(true);
    try {
      const res = await fetch(`/api/users/${editingUser.id}/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changePasswordForm),
      });

      if (res.ok) {
        toast({
          title: t("Success"),
          description: t("Password changed successfully"),
        });
        setIsChangePasswordOpen(false);
        setChangePasswordForm({ newPassword: "", confirmPassword: "" });
      } else {
        const error = await res.json();
        toast({
          title: t("Error"),
          description: error.error || t("Failed to change password"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error changing password:", error);
      toast({
        title: t("Error"),
        description: t("Failed to change password"),
        variant: "destructive",
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const openDeleteDialog = (user: User) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      const res = await fetch(`/api/users/${userToDelete.id}`, { method: "DELETE" });
      if (res.ok) {
        setUsers(users.filter((u) => u.id !== userToDelete.id));
        toast({ title: t("Success"), description: t("User deleted successfully") });
        setDeleteDialogOpen(false);
        setUserToDelete(null);
      } else {
        const data = await res.json();
        toast({ title: t("Error"), description: data.error || t("Failed to delete user"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({ title: t("Error"), description: t("Failed to delete user"), variant: "destructive" });
    }
  };

  const handleDeactivateUser = async (user: User) => {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...user, isActive: false }),
      });

      if (res.ok) {
        const updated = await res.json();
        setUsers(users.map((u) => (u.id === updated.id ? updated : u)));
      }
    } catch (error) {
      console.error("Error deactivating user:", error);
    }
  };

  const resetForm = () => {
    setUserForm({
      userName: "",
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      fullName: "",
      designation: "",
      function: "",
      role: "",
      language: "English",
      timezone: "UTC",
      isActive: true,
      isBlocked: false,
      departmentId: "",
      reportingManagerId: "",
    });
    setReportingManagers([]);
  };

  // Export users to CSV
  const handleExport = () => {
    const csv = [
      ["User ID", "Username", "Email", "First Name", "Last Name", "Full Name", "Designation", "Function", "Role", "Department", "Language", "Timezone", "Active", "Blocked"],
      ...translatedUsers.map((u) => [
        u.id?.slice(0, 8) || "",
        u.userName,
        u.email,
        u.firstName,
        u.lastName,
        u.fullName,
        u.designation || "",
        u.function || "",
        u.role,
        tDeptName(u.departmentId) || u.department?.name || "",
        u.language,
        u.timezone,
        u.isActive ? "Yes" : "No",
        u.isBlocked ? "Yes" : "No",
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users_export_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Download template for import
  const handleDownloadTemplate = () => {
    const templateCsv = [
      ["Username", "Email", "Password", "First Name", "Last Name", "Full Name", "Designation", "Function", "Role", "Department", "Language", "Timezone"],
      ["john.doe", "john.doe@example.com", "Password123", "John", "Doe", "John Doe", "Manager", "Business", "User", "IT Operations", "English", "UTC"],
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([templateCsv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "users_template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
    }
  };

  // Import users from CSV
  const handleImport = async () => {
    if (!importFile) return;

    setImporting(true);
    try {
      const text = await importFile.text();
      const lines = text.split("\n").filter((line) => line.trim());

      // Skip header row
      const dataLines = lines.slice(1);

      let successCount = 0;
      let errorCount = 0;

      for (const line of dataLines) {
        // Parse CSV line (handle quoted values)
        const matches = line.match(/("([^"]*)"|[^,]+)/g) || [];
        const values = matches.map((v) => v.replace(/^"|"$/g, "").trim());

        if (values.length >= 6) {
          const [userName, email, password, firstName, lastName, fullName, designation, func, role, departmentName, language, timezone] = values;

          // Find department by name
          const department = departments.find((d) => d.name.toLowerCase() === departmentName?.toLowerCase());

          try {
            const response = await fetch("/api/users", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId: `USR-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                userName,
                email,
                password: password || "DefaultPass123",
                firstName,
                lastName,
                fullName,
                designation: designation || null,
                function: func || null,
                role: role || "User",
                departmentId: department?.id || null,
                language: language || "English",
                timezone: timezone || "UTC",
                isActive: true,
                isBlocked: false,
              }),
            });

            if (response.ok) {
              successCount++;
            } else {
              errorCount++;
            }
          } catch {
            errorCount++;
          }
        }
      }

      toast({ title: t("Success"), description: `${t("Import completed")}: ${successCount} ${t("users imported")}, ${errorCount} ${t("errors")}` });
      setShowImportDialog(false);
      setImportFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      fetchData();
    } catch (error) {
      console.error("Error importing users:", error);
      toast({ title: t("Error"), description: t("Failed to import users. Please check the file format."), variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  // Group users by department for Account Overview
  const usersByDepartment = translatedDepartments
    .filter((dept) =>
      dept.name.toLowerCase().includes(departmentSearchTerm.toLowerCase())
    )
    .map((dept) => ({
      ...dept,
      users: translatedUsers.filter((user) => user.departmentId === dept.id),
    }));

  // User columns for User Management grid
  const userColumns: ColumnDef<User>[] = [
    {
      accessorKey: "userName",
      header: t("User Name"),
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("userName")}</span>
      ),
    },
    {
      accessorKey: "fullName",
      header: t("Full Name"),
    },
    {
      accessorKey: "department.name",
      header: t("Department"),
      cell: ({ row }) => tDeptName(row.original.departmentId) || row.original.department?.name || "-",
    },
    {
      accessorKey: "designation",
      header: t("Designation"),
    },
    {
      accessorKey: "role",
      header: t("User Role"),
      cell: ({ row }) => row.original.role || "-",
    },
    {
      accessorKey: "isActive",
      header: t("Status"),
      cell: ({ row }) => {
        const isActive = row.getValue("isActive") as boolean;
        return (
          <Badge
            variant="outline"
            className={isActive
              ? "border-transparent bg-success-light text-success-dark"
              : "border-transparent bg-slate-100 text-slate-600"
            }
          >
            {isActive ? t("Active") : t("Inactive")}
          </Badge>
        );
      },
    },
    {
      id: "lastLogin",
      header: t("Last Login"),
      cell: ({ row }) => {
        const lastLogin = row.original.lastLogin;
        if (!lastLogin) return "-";
        return new Date(lastLogin).toLocaleDateString();
      },
    },
    {
      id: "actions",
      header: t("Actions"),
      cell: ({ row }) => (
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
            onClick={() => {
              setViewingUser(row.original);
              setIsViewUserOpen(true);
            }}
            title={t("View Details")}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
            onClick={() => {
              setEditingUser(row.original);
              setEditUserFormErrors({});
              if (row.original.function) {
                fetchReportingManagers(row.original.function);
              }
              setIsEditUserOpen(true);
            }}
            title={t("Edit")}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-semantic-error hover:bg-red-50"
            onClick={() => openDeleteDialog(row.original)}
            title={t("Delete")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  // Filter users
  const filteredUsers = translatedUsers.filter((user) => {
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesDepartment = departmentFilter === "all" || user.departmentId === departmentFilter;
    const matchesSearch = user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.userName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesRole && matchesDepartment && matchesSearch;
  });

  // Users filtered to current user's department (for DeptReviewer/DeptContributor)
  const departmentUsers = translatedUsers.filter((user) =>
    user.departmentId === currentUserDepartmentId
  );

  // Get current user's department name
  const currentDepartment = translatedDepartments.find((d) => d.id === currentUserDepartmentId);

  // Columns for department view (read-only, no actions)
  const departmentUserColumns: ColumnDef<User>[] = [
    {
      accessorKey: "fullName",
      header: t("Full Name"),
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("fullName")}</span>
      ),
    },
    {
      accessorKey: "designation",
      header: t("Designation Name"),
      cell: ({ row }) => row.original.designation || "-",
    },
    {
      id: "reportingManager",
      header: t("Reporting Manager"),
      cell: ({ row }) => tManagerName(row.original.reportingManagerId) || row.original.reportingManager?.fullName || "-",
    },
    {
      accessorKey: "email",
      header: t("Email ID"),
    },
    {
      id: "lastLogin",
      header: t("Last Login"),
      cell: () => "-",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
            <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-sm text-slate-500 font-medium">{t("Loading users...")}</p>
        </div>
      </div>
    );
  }

  // Simplified view for DeptReviewer/DeptContributor
  if (isDeptRole) {
    return (
      <div className="space-y-4 sm:space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs sm:text-sm overflow-x-auto">
          <div className="flex items-center gap-1.5 text-slate-500 whitespace-nowrap">
            <Home className="h-4 w-4 flex-shrink-0" />
            <span>{t("Organization")}</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180 flex-shrink-0" />
          <Link href="/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors whitespace-nowrap">
            {t("Dashboard")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180 flex-shrink-0" />
          <span className="text-primary-700 font-medium whitespace-nowrap">{t("Users")}</span>
        </nav>

        {/* Page Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Account Overview")}</h1>
        </div>

        <div className="space-y-4">
          {currentDepartment && (
            <div className="text-base sm:text-lg font-semibold text-foreground">
              {currentDepartment.name} - {departmentUsers.length} {t("users")}
            </div>
          )}
          <DataGrid
            columns={departmentUserColumns}
            data={departmentUsers}
            searchPlaceholder={t("Search users...")}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className={`flex items-center gap-1.5 text-xs sm:text-sm overflow-x-auto whitespace-nowrap ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
        <div className={`flex items-center gap-1.5 text-slate-500 ${isRTL ? "flex-row-reverse" : ""}`}>
          <Home className="h-4 w-4 flex-shrink-0" />
          <span>{t("Organization")}</span>
        </div>
        <ChevronRight className={`h-3.5 w-3.5 text-slate-300 flex-shrink-0 ${isRTL ? "rotate-180" : ""}`} />
        <Link href="/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors whitespace-nowrap">
          {t("Dashboard")}
        </Link>
        <ChevronRight className={`h-3.5 w-3.5 text-slate-300 flex-shrink-0 ${isRTL ? "rotate-180" : ""}`} />
        <span className="text-primary-700 font-medium whitespace-nowrap">{t("Users")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Users")}</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className={`overflow-x-auto -mx-1 px-1 ${isRTL ? "flex justify-end" : ""}`}>
        <TabsList className={`w-full sm:w-auto inline-flex ${isRTL ? "flex-row-reverse" : ""}`}>
          <TabsTrigger value="account-overview" className="flex-1 sm:flex-none text-xs sm:text-sm">{t("Account Overview")}</TabsTrigger>
          <TabsTrigger value="user-management" className="flex-1 sm:flex-none text-xs sm:text-sm">{t("User Management")}</TabsTrigger>
        </TabsList>
        </div>

        {/* Account Overview Tab */}
        <TabsContent value="account-overview" className="mt-4 sm:mt-6">
          <div className="space-y-3 sm:space-y-5">
            {/* Action Buttons */}
            <div className="flex">
              <div className="ms-auto grid grid-cols-2 sm:flex sm:items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleExport} className={isRTL ? "flex-row-reverse" : ""}>
                  <Upload className="h-4 w-4 me-2" />
                  {t("Export")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)} className={isRTL ? "flex-row-reverse" : ""}>
                  <Download className="h-4 w-4 me-2" />
                  {t("Import")}
                </Button>
                <Button size="sm" className={`col-span-2 sm:col-span-1 ${isRTL ? "flex-row-reverse" : ""}`} onClick={handleNewAccountClick}>
                  <Plus className="h-4 w-4 me-2" />
                  {t("New User")}
                </Button>
              </div>
            </div>

            {/* Card Container */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" style={isRTL ? { direction: 'rtl' } : undefined}>
              {/* Search Toolbar */}
              <div className="flex items-center px-3 sm:px-5 py-3 border-b border-slate-100">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder={t("Search by Department Name")}
                    value={departmentSearchTerm}
                    onChange={(e) => setDepartmentSearchTerm(e.target.value)}
                    className="w-full ps-9 pe-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
                  />
                </div>
              </div>

              {/* Department Accordions */}
              <Accordion type="multiple" className="w-full">
                {usersByDepartment.map((dept) => (
                  <AccordionItem
                    key={dept.id}
                    value={dept.id}
                    className="border-b border-slate-100 last:border-0 px-2 sm:px-4"
                  >
                  <AccordionTrigger className="hover:no-underline py-3 sm:py-4 focus-visible:ring-0 focus-visible:border-transparent">
                    <div className={`flex items-center gap-2 sm:gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                      <span className="text-xs sm:text-sm font-semibold text-slate-800">{dept.name}</span>
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        {dept.users.length}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {dept.users.length > 0 ? (
                      <div className="overflow-x-auto rounded-lg border border-slate-200 mb-2">
                        <table className="w-full text-sm min-w-[700px]">
                          <thead>
                            <tr className="border-b border-slate-100 bg-slate-50">
                              <th className="text-start py-3 ps-5 text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Full Name")}</th>
                              <th className="text-start py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Designation")}</th>
                              <th className="text-start py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Reporting Manager")}</th>
                              <th className="text-start py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Email")}</th>
                              <th className="text-start py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Last Login")}</th>
                              <th className="text-end py-3 pe-5 text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Actions")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dept.users.map((user) => (
                              <tr key={user.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                                <td className="text-start py-3.5 ps-5 text-sm font-medium text-slate-800">{user.fullName}</td>
                                <td className="text-start py-3.5 text-sm text-slate-600">{user.designation || "-"}</td>
                                <td className="text-start py-3.5 text-sm text-slate-600">{tManagerName(user.reportingManagerId) || user.reportingManager?.fullName || "-"}</td>
                                <td className="text-start py-3.5 text-sm text-slate-600">{user.email}</td>
                                <td className="text-start py-3.5 text-sm text-slate-600">-</td>
                                <td className="text-end py-3.5 pe-5">
                                  <div className="flex items-center justify-end gap-0.5">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                                      onClick={() => {
                                        setViewingUser(user);
                                        setIsViewUserOpen(true);
                                      }}
                                      title={t("View Details")}
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                                      onClick={() => {
                                        setEditingUser(user);
                                        setEditUserFormErrors({});
                                        if (user.function) {
                                          fetchReportingManagers(user.function);
                                        }
                                        setIsEditUserOpen(true);
                                      }}
                                      title={t("Edit")}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-slate-400 hover:text-semantic-error hover:bg-red-50"
                                      onClick={() => openDeleteDialog(user)}
                                      title={t("Delete")}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {/* Pagination */}
                        <div className={`flex items-center justify-between px-3 sm:px-5 py-2 sm:py-3 border-t border-slate-100 bg-slate-50/50 ${isRTL ? "flex-row-reverse" : ""}`}>
                          <span className="text-xs text-slate-500">
                            1 {t("to")} {dept.users.length} {t("of")} {dept.users.length}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600" disabled>
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600" disabled>
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-12 text-center">
                        <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-4">
                          <UsersIcon className="h-6 w-6 text-primary-500" />
                        </div>
                        <h3 className="text-base font-semibold text-slate-800 mb-1">{t("No Users")}</h3>
                        <p className="text-sm text-slate-500">
                          {t("No users in this department")}
                        </p>
                      </div>
                    )}
                  </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </TabsContent>

        {/* User Management Tab */}
        <TabsContent value="user-management" className="mt-4 sm:mt-6">
          <div className="space-y-3 sm:space-y-5">
            {/* Action Buttons */}
            <div className="flex">
              <div className="ms-auto grid grid-cols-2 sm:flex sm:items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleExport} className={isRTL ? "flex-row-reverse" : ""}>
                  <Upload className="h-4 w-4 me-2" />
                  {t("Export")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)} className={isRTL ? "flex-row-reverse" : ""}>
                  <Download className="h-4 w-4 me-2" />
                  {t("Import")}
                </Button>
                <Button size="sm" className={`col-span-2 sm:col-span-1 ${isRTL ? "flex-row-reverse" : ""}`} onClick={handleNewAccountClick}>
                  <Plus className="h-4 w-4 me-2" />
                  {t("New User")}
                </Button>
              </div>
            </div>
            {/* Table Card with Integrated Filters */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" style={isRTL ? { direction: 'rtl' } : undefined}>
              {/* Search & Filters */}
              <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 px-3 sm:px-5 py-3 border-b border-slate-100">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder={t("Search user...")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
                  />
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto sm:ms-auto">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm bg-slate-50 border-slate-200">
                    <SelectValue placeholder={t("Role")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="all">{t("All Roles")}</SelectItem>
                    {allUserRoles.map((role) => (
                      <SelectItem key={role} value={role}>{role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm bg-slate-50 border-slate-200">
                    <SelectValue placeholder={t("Department")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="all">{t("All Departments")}</SelectItem>
                    {translatedDepartments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                </div>
              </div>
              {/* DataGrid */}
              <DataGrid
                columns={userColumns}
                data={filteredUsers}
                hideSearch={true}
                className="border-0 rounded-none"
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add User Dialog */}
      <Dialog open={isAddUserOpen} onOpenChange={(open) => {
        setIsAddUserOpen(open);
        if (!open) {
          setUserFormErrors({});
          setUserForm({
            userName: "",
            email: "",
            password: "",
            confirmPassword: "",
            firstName: "",
            lastName: "",
            fullName: "",
            designation: "",
            function: "",
            role: "",
            language: "English",
            timezone: "UTC",
            isActive: true,
            isBlocked: false,
            departmentId: "",
            reportingManagerId: "",
          });
        }
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" style={isRTL ? { direction: 'rtl' } : undefined} onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg font-semibold text-slate-800">{t("New User")}</DialogTitle>
            </DialogHeader>
          </div>
          {/* Scrollable Content */}
          <div ref={addUserScrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
            {/* Account Credentials Section */}
            <div className="space-y-3 sm:space-y-4">
              <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">{t("Account Credentials")}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {/* Username - full width */}
                <div className="sm:col-span-2">
                  <Label htmlFor="userName" className="text-sm font-medium text-slate-700">{t("Username")} *</Label>
                  <Input
                    id="userName"
                    value={userForm.userName}
                    onChange={(e) => { setUserForm({ ...userForm, userName: e.target.value }); if (userFormErrors.userName) setUserFormErrors((prev) => { const { userName, ...rest } = prev; return rest; }); }}
                    placeholder={t("Enter username")}
                    className={`mt-1.5 bg-white ${userFormErrors.userName ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                  />
                  {userFormErrors.userName && (<div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2"><p className="text-sm text-red-600">{userFormErrors.userName}</p></div>)}
                </div>
                {/* Email - full width */}
                <div className="sm:col-span-2">
                  <Label htmlFor="email" className="text-sm font-medium text-slate-700">{t("Email")} *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={userForm.email}
                    onChange={(e) => { setUserForm({ ...userForm, email: e.target.value }); if (userFormErrors.email) setUserFormErrors((prev) => { const { email, ...rest } = prev; return rest; }); }}
                    placeholder={t("Enter email")}
                    className={`mt-1.5 bg-white ${userFormErrors.email ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                  />
                  {userFormErrors.email && (<div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2"><p className="text-sm text-red-600">{userFormErrors.email}</p></div>)}
                </div>
                {/* Password and Confirm Password - side by side */}
                <div>
                  <Label htmlFor="password" className="text-sm font-medium text-slate-700">{t("Password")} *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={userForm.password}
                    onChange={(e) => { setUserForm({ ...userForm, password: e.target.value }); if (userFormErrors.password) setUserFormErrors((prev) => { const { password, ...rest } = prev; return rest; }); }}
                    placeholder={t("Enter password")}
                    autoComplete="new-password"
                    className={`mt-1.5 bg-white ${userFormErrors.password ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                  />
                  {userFormErrors.password && (<div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2"><p className="text-sm text-red-600">{userFormErrors.password}</p></div>)}
                </div>
                <div>
                  <Label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">{t("Confirm Password")} *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={userForm.confirmPassword}
                    onChange={(e) => { setUserForm({ ...userForm, confirmPassword: e.target.value }); if (userFormErrors.confirmPassword) setUserFormErrors((prev) => { const { confirmPassword, ...rest } = prev; return rest; }); }}
                    placeholder={t("Confirm password")}
                    autoComplete="new-password"
                    className={`mt-1.5 bg-white ${userFormErrors.confirmPassword ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                  />
                  {userFormErrors.confirmPassword && (<div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2"><p className="text-sm text-red-600">{userFormErrors.confirmPassword}</p></div>)}
                </div>
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
                    value={userForm.firstName}
                    onChange={(e) => {
                      const newFirstName = e.target.value;
                      const autoFullName = `${newFirstName} ${userForm.lastName}`.trim();
                      setUserForm({ ...userForm, firstName: newFirstName, fullName: autoFullName });
                      if (userFormErrors.firstName) setUserFormErrors((prev) => { const { firstName, fullName, ...rest } = prev; return rest; });
                    }}
                    placeholder={t("Enter first name")}
                    className={`mt-1.5 bg-white ${userFormErrors.firstName ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                  />
                  {userFormErrors.firstName && (<div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2"><p className="text-sm text-red-600">{userFormErrors.firstName}</p></div>)}
                </div>
                <div>
                  <Label htmlFor="lastName" className="text-sm font-medium text-slate-700">{t("Last Name")} *</Label>
                  <Input
                    id="lastName"
                    value={userForm.lastName}
                    onChange={(e) => {
                      const newLastName = e.target.value;
                      const autoFullName = `${userForm.firstName} ${newLastName}`.trim();
                      setUserForm({ ...userForm, lastName: newLastName, fullName: autoFullName });
                      if (userFormErrors.lastName) setUserFormErrors((prev) => { const { lastName, fullName, ...rest } = prev; return rest; });
                    }}
                    placeholder={t("Enter last name")}
                    className={`mt-1.5 bg-white ${userFormErrors.lastName ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                  />
                  {userFormErrors.lastName && (<div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2"><p className="text-sm text-red-600">{userFormErrors.lastName}</p></div>)}
                </div>
                {/* Full Name - full width */}
                <div className="sm:col-span-2">
                  <Label htmlFor="fullName" className="text-sm font-medium text-slate-700">{t("Full Name")} *</Label>
                  <Input
                    id="fullName"
                    value={userForm.fullName}
                    onChange={(e) => { setUserForm({ ...userForm, fullName: e.target.value }); if (userFormErrors.fullName) setUserFormErrors((prev) => { const { fullName, ...rest } = prev; return rest; }); }}
                    placeholder={t("Enter full name")}
                    className={`mt-1.5 bg-white ${userFormErrors.fullName ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                  />
                  {userFormErrors.fullName && (<div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2"><p className="text-sm text-red-600">{userFormErrors.fullName}</p></div>)}
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
                    value={userForm.function}
                    onValueChange={(value) => {
                      setUserForm({ ...userForm, function: value, role: "", reportingManagerId: "" });
                      fetchReportingManagers(value);
                      if (userFormErrors.function) setUserFormErrors((prev) => { const { function: _, ...rest } = prev; return rest; });
                    }}
                  >
                    <SelectTrigger className={`mt-1.5 w-full bg-white ${userFormErrors.function ? "border-red-500 focus-visible:ring-red-500" : ""}`}>
                      <SelectValue placeholder={t("Select function")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="max-h-[200px]">
                      <SelectItem value="Business">{t("Business")}</SelectItem>
                      <SelectItem value="Security">{t("Security")}</SelectItem>
                      <SelectItem value="Audit">{t("Audit")}</SelectItem>
                    </SelectContent>
                  </Select>
                  {userFormErrors.function && (<div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2"><p className="text-sm text-red-600">{userFormErrors.function}</p></div>)}
                </div>
                {/* Role - full width */}
                <div className="sm:col-span-2">
                  <Label htmlFor="role" className="text-sm font-medium text-slate-700">{t("Role")} *</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Select
                            value={userForm.role}
                            onValueChange={(value) => { setUserForm({ ...userForm, role: value }); if (userFormErrors.role) setUserFormErrors((prev) => { const { role, ...rest } = prev; return rest; }); }}
                            disabled={!userForm.function}
                          >
                            <SelectTrigger className={`mt-1.5 w-full bg-white ${!userForm.function ? "cursor-not-allowed opacity-50" : ""} ${userFormErrors.role ? "border-red-500 focus-visible:ring-red-500" : ""}`}>
                              <SelectValue placeholder={userForm.function ? t("Select role") : t("Select function first")} />
                            </SelectTrigger>
                            <SelectContent position="popper" sideOffset={4} className="max-h-[200px]">
                              {userForm.function && (
                                // For Audit function, CustomerAdmin can only assign AuditHead role
                                userForm.function === "Audit" && userRoles.includes("CustomerAdministrator") && !userRoles.includes("GRCAdministrator")
                                  ? customerAdminAuditRoles.map((role) => (
                                      <SelectItem key={role} value={role}>
                                        {role}
                                      </SelectItem>
                                    ))
                                  : rolesByFunction[userForm.function]?.map((role) => (
                                      <SelectItem key={role} value={role}>
                                        {role}
                                      </SelectItem>
                                    ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </TooltipTrigger>
                      {!userForm.function && (
                        <TooltipContent>
                          <p>{t("Please select a function first")}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                  {userFormErrors.role && (<div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2"><p className="text-sm text-red-600">{userFormErrors.role}</p></div>)}
                </div>
                {/* Department and Designation - side by side */}
                <div>
                  <Label htmlFor="department" className="text-sm font-medium text-slate-700">{t("Department")} *</Label>
                  <Select
                    value={userForm.departmentId}
                    onValueChange={(value) => { setUserForm({ ...userForm, departmentId: value }); if (userFormErrors.departmentId) setUserFormErrors((prev) => { const { departmentId, ...rest } = prev; return rest; }); }}
                  >
                    <SelectTrigger className={`mt-1.5 w-full bg-white ${userFormErrors.departmentId ? "border-red-500 focus-visible:ring-red-500" : ""}`}>
                      <SelectValue placeholder={t("Select department")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="max-h-[200px]">
                      {translatedDepartments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {userFormErrors.departmentId && (<div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2"><p className="text-sm text-red-600">{userFormErrors.departmentId}</p></div>)}
                </div>
                <div>
                  <Label htmlFor="designation" className="text-sm font-medium text-slate-700">{t("Designation")}</Label>
                  <Input
                    id="designation"
                    value={userForm.designation}
                    onChange={(e) => setUserForm({ ...userForm, designation: e.target.value })}
                    placeholder={t("Enter designation")}
                    autoComplete="off"
                    className="mt-1.5 bg-white"
                  />
                </div>
                {/* Reporting Manager - full width */}
                <div className="sm:col-span-2">
                  <Label htmlFor="reportingManager" className="text-sm font-medium text-slate-700">{t("Reporting Manager")}</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Select
                            value={userForm.reportingManagerId}
                            onValueChange={(value) => setUserForm({ ...userForm, reportingManagerId: value })}
                            disabled={!userForm.function}
                          >
                            <SelectTrigger className={`mt-1.5 w-full bg-white ${!userForm.function ? "cursor-not-allowed opacity-50" : ""}`}>
                              <SelectValue placeholder={userForm.function ? t("Select reporting manager") : t("Select function first")} />
                            </SelectTrigger>
                            <SelectContent position="popper" sideOffset={4} className="max-h-[200px]">
                              {translatedManagers.map((manager) => (
                                <SelectItem key={manager.id} value={manager.id}>
                                  {manager.fullName} {manager.designation ? `(${manager.designation})` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </TooltipTrigger>
                      {!userForm.function && (
                        <TooltipContent>
                          <p>{t("Please select a function first")}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>

            {/* Preferences Section */}
            <div className="space-y-3 sm:space-y-4">
              <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">{t("Preferences")}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label htmlFor="language" className="text-sm font-medium text-slate-700">{t("Language")}</Label>
                  <Select
                    value={userForm.language}
                    onValueChange={(value) => setUserForm({ ...userForm, language: value })}
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder={t("Select language")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="max-h-[200px]">
                      <SelectItem value="English">{t("English")}</SelectItem>
                      <SelectItem value="Arabic">{t("Arabic")}</SelectItem>
                      <SelectItem value="Hindi">{t("Hindi")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="timezone" className="text-sm font-medium text-slate-700">{t("Time Zone")}</Label>
                  <Select
                    value={userForm.timezone}
                    onValueChange={(value) => setUserForm({ ...userForm, timezone: value })}
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder={t("Select timezone")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="max-h-[300px]">
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="GMT-12:00">(GMT-12:00) International Date Line West</SelectItem>
                      <SelectItem value="GMT-11:00">(GMT-11:00) Midway Island, Samoa</SelectItem>
                      <SelectItem value="GMT-10:00">(GMT-10:00) Hawaii</SelectItem>
                      <SelectItem value="GMT-09:00">(GMT-09:00) Alaska</SelectItem>
                      <SelectItem value="GMT-08:00">(GMT-08:00) Pacific Time (US & Canada)</SelectItem>
                      <SelectItem value="GMT-07:00">(GMT-07:00) Mountain Time (US & Canada)</SelectItem>
                      <SelectItem value="GMT-06:00">(GMT-06:00) Central Time (US & Canada)</SelectItem>
                      <SelectItem value="GMT-05:00">(GMT-05:00) Eastern Time (US & Canada)</SelectItem>
                      <SelectItem value="GMT-04:00">(GMT-04:00) Atlantic Time (Canada)</SelectItem>
                      <SelectItem value="GMT-03:30">(GMT-03:30) Newfoundland</SelectItem>
                      <SelectItem value="GMT-03:00">(GMT-03:00) Buenos Aires, Brasilia</SelectItem>
                      <SelectItem value="GMT-02:00">(GMT-02:00) Mid-Atlantic</SelectItem>
                      <SelectItem value="GMT-01:00">(GMT-01:00) Azores, Cape Verde</SelectItem>
                      <SelectItem value="GMT+00:00">(GMT+00:00) London, Dublin, Lisbon</SelectItem>
                      <SelectItem value="GMT+01:00">(GMT+01:00) Berlin, Paris, Rome, Madrid</SelectItem>
                      <SelectItem value="GMT+02:00">(GMT+02:00) Cairo, Jerusalem, Athens</SelectItem>
                      <SelectItem value="GMT+03:00">(GMT+03:00) Qatar, Kuwait, Riyadh, Moscow</SelectItem>
                      <SelectItem value="GMT+03:30">(GMT+03:30) Tehran</SelectItem>
                      <SelectItem value="GMT+04:00">(GMT+04:00) Abu Dhabi, Dubai, Muscat</SelectItem>
                      <SelectItem value="GMT+04:30">(GMT+04:30) Kabul</SelectItem>
                      <SelectItem value="GMT+05:00">(GMT+05:00) Karachi, Tashkent</SelectItem>
                      <SelectItem value="GMT+05:30">(GMT+05:30) India, Sri Lanka</SelectItem>
                      <SelectItem value="GMT+05:45">(GMT+05:45) Kathmandu</SelectItem>
                      <SelectItem value="GMT+06:00">(GMT+06:00) Dhaka, Almaty</SelectItem>
                      <SelectItem value="GMT+06:30">(GMT+06:30) Yangon</SelectItem>
                      <SelectItem value="GMT+07:00">(GMT+07:00) Bangkok, Jakarta, Hanoi</SelectItem>
                      <SelectItem value="GMT+08:00">(GMT+08:00) Singapore, Hong Kong, Beijing</SelectItem>
                      <SelectItem value="GMT+09:00">(GMT+09:00) Tokyo, Seoul</SelectItem>
                      <SelectItem value="GMT+09:30">(GMT+09:30) Adelaide, Darwin</SelectItem>
                      <SelectItem value="GMT+10:00">(GMT+10:00) Sydney, Melbourne, Brisbane</SelectItem>
                      <SelectItem value="GMT+11:00">(GMT+11:00) Solomon Islands</SelectItem>
                      <SelectItem value="GMT+12:00">(GMT+12:00) Auckland, Fiji</SelectItem>
                      <SelectItem value="GMT+13:00">(GMT+13:00) Nuku'alofa, Samoa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Account Status Section */}
            <div className="space-y-3 sm:space-y-4">
              <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">{t("Account Status")}</h4>
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                <div className={`flex items-center ${isRTL ? "space-x-reverse space-x-2" : "space-x-2"}`}>
                  <Checkbox
                    id="active"
                    checked={userForm.isActive}
                    onCheckedChange={(checked) =>
                      setUserForm({ ...userForm, isActive: checked as boolean })
                    }
                  />
                  <Label htmlFor="active" className="font-normal">
                    {t("Active")}
                  </Label>
                </div>
                <div className={`flex items-center ${isRTL ? "space-x-reverse space-x-2" : "space-x-2"}`}>
                  <Checkbox
                    id="blocked"
                    checked={userForm.isBlocked}
                    onCheckedChange={(checked) =>
                      setUserForm({ ...userForm, isBlocked: checked as boolean })
                    }
                  />
                  <Label htmlFor="blocked" className="font-normal">
                    {t("Blocked")}
                  </Label>
                </div>
              </div>
            </div>
          </div>
          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex items-center justify-end gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg" style={{ direction: 'ltr' }}>
            <Button variant="outline" onClick={() => {
              setIsAddUserOpen(false);
              setUserFormErrors({});
              setUserForm({
                userName: "",
                email: "",
                password: "",
                confirmPassword: "",
                firstName: "",
                lastName: "",
                fullName: "",
                designation: "",
                function: "",
                role: "",
                language: "English",
                timezone: "UTC",
                isActive: true,
                isBlocked: false,
                departmentId: "",
                reportingManagerId: "",
              });
            }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleAddUser} disabled={isSaving}>{isSaving ? t("Saving...") : t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" style={isRTL ? { direction: 'rtl' } : undefined} onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg font-semibold text-slate-800">{t("Edit Account")}</DialogTitle>
            </DialogHeader>
          </div>
          {/* Scrollable Content */}
          {editingUser && (
            <div ref={editUserScrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4">
              {/* User ID - Read Only */}
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                <Label className="sm:text-end">{t("User ID")}</Label>
                <span className="text-sm text-muted-foreground">{editingUser.id?.slice(0, 8) || "-"}</span>
              </div>

              {/* First Name */}
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-start sm:items-start gap-1 sm:gap-4">
                <Label htmlFor="editFirstName" className="sm:text-end mt-2">{t("First Name")}</Label>
                <div>
                  <Input
                    id="editFirstName"
                    value={editingUser.firstName}
                    onChange={(e) => {
                      const newFirstName = e.target.value;
                      const autoFullName = `${newFirstName} ${editingUser.lastName}`.trim();
                      setEditingUser({ ...editingUser, firstName: newFirstName, fullName: autoFullName });
                      if (editUserFormErrors.firstName) setEditUserFormErrors((prev) => ({ ...prev, firstName: "" }));
                    }}
                    className={`bg-white ${editUserFormErrors.firstName ? "border-red-500" : ""}`}
                  />
                  {editUserFormErrors.firstName && <p className="text-sm text-red-500 mt-1">{editUserFormErrors.firstName}</p>}
                </div>
              </div>

              {/* Last Name */}
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-start sm:items-start gap-1 sm:gap-4">
                <Label htmlFor="editLastName" className="sm:text-end mt-2">{t("Last Name")}</Label>
                <div>
                  <Input
                    id="editLastName"
                    value={editingUser.lastName}
                    onChange={(e) => {
                      const newLastName = e.target.value;
                      const autoFullName = `${editingUser.firstName} ${newLastName}`.trim();
                      setEditingUser({ ...editingUser, lastName: newLastName, fullName: autoFullName });
                      if (editUserFormErrors.lastName) setEditUserFormErrors((prev) => ({ ...prev, lastName: "" }));
                    }}
                    className={`bg-white ${editUserFormErrors.lastName ? "border-red-500" : ""}`}
                  />
                  {editUserFormErrors.lastName && <p className="text-sm text-red-500 mt-1">{editUserFormErrors.lastName}</p>}
                </div>
              </div>

              {/* Full Name */}
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-start sm:items-start gap-1 sm:gap-4">
                <Label htmlFor="editFullName" className="sm:text-end mt-2">{t("Full Name")}</Label>
                <div>
                  <Input
                    id="editFullName"
                    value={editingUser.fullName}
                    onChange={(e) => {
                      setEditingUser({ ...editingUser, fullName: e.target.value });
                      if (editUserFormErrors.fullName) setEditUserFormErrors((prev) => ({ ...prev, fullName: "" }));
                    }}
                    className={`bg-white ${editUserFormErrors.fullName ? "border-red-500" : ""}`}
                  />
                  {editUserFormErrors.fullName && <p className="text-sm text-red-500 mt-1">{editUserFormErrors.fullName}</p>}
                </div>
              </div>

              {/* Email */}
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-start sm:items-start gap-1 sm:gap-4">
                <Label htmlFor="editEmail" className="sm:text-end mt-2">{t("Email")}</Label>
                <div>
                  <Input
                    id="editEmail"
                    type="email"
                    value={editingUser.email}
                    onChange={(e) => {
                      setEditingUser({ ...editingUser, email: e.target.value });
                      setEditUserFormErrors((prev) => ({ ...prev, email: "" }));
                    }}
                    className={`bg-white ${editUserFormErrors.email ? "border-red-500" : ""}`}
                  />
                  {editUserFormErrors.email && <p className="text-sm text-red-500 mt-1">{editUserFormErrors.email}</p>}
                </div>
              </div>

              {/* Is Local User */}
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                <Label className="sm:text-end">{t("Is local user")}</Label>
                <div className="flex gap-4">
                  <div className={`flex items-center ${isRTL ? "space-x-reverse space-x-2" : "space-x-2"}`}>
                    <input
                      type="radio"
                      id="localUserYes"
                      name="isLocalUser"
                      checked={true}
                      className="h-4 w-4"
                      readOnly
                    />
                    <Label htmlFor="localUserYes" className="font-normal">{t("Yes")}</Label>
                  </div>
                  <div className={`flex items-center ${isRTL ? "space-x-reverse space-x-2" : "space-x-2"}`}>
                    <input
                      type="radio"
                      id="localUserNo"
                      name="isLocalUser"
                      checked={false}
                      className="h-4 w-4"
                      readOnly
                    />
                    <Label htmlFor="localUserNo" className="font-normal">{t("No")}</Label>
                  </div>
                </div>
              </div>

              {/* Name (Username) */}
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-start sm:items-start gap-1 sm:gap-4">
                <Label htmlFor="editUserName" className="sm:text-end mt-2">{t("Name")}</Label>
                <div>
                  <Input
                    id="editUserName"
                    value={editingUser.userName}
                    onChange={(e) => {
                      setEditingUser({ ...editingUser, userName: e.target.value });
                      if (editUserFormErrors.userName) setEditUserFormErrors((prev) => ({ ...prev, userName: "" }));
                    }}
                    className={`bg-white ${editUserFormErrors.userName ? "border-red-500" : ""}`}
                  />
                  {editUserFormErrors.userName && <p className="text-sm text-red-500 mt-1">{editUserFormErrors.userName}</p>}
                </div>
              </div>

              {/* Function */}
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                <Label htmlFor="editFunction" className="sm:text-end">{t("Function")}</Label>
                <Select
                  value={editingUser.function || ""}
                  onValueChange={(value) => {
                    setEditingUser({ ...editingUser, function: value, role: "", reportingManagerId: "" });
                    fetchReportingManagers(value);
                  }}
                >
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder={t("Select function")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="max-h-[200px]">
                    <SelectItem value="Business">{t("Business")}</SelectItem>
                    <SelectItem value="Security">{t("Security")}</SelectItem>
                    <SelectItem value="Audit">{t("Audit")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* User Role */}
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                <Label htmlFor="editRole" className="sm:text-end">{t("User Role")}</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Select
                          value={editingUser.role}
                          onValueChange={(value) =>
                            setEditingUser({ ...editingUser, role: value })
                          }
                          disabled={!editingUser.function}
                        >
                          <SelectTrigger className={`w-full bg-white ${!editingUser.function ? "cursor-not-allowed opacity-50" : ""}`}>
                            <SelectValue placeholder={editingUser.function ? t("Select role") : t("Select function first")} />
                          </SelectTrigger>
                          <SelectContent position="popper" sideOffset={4} className="max-h-[200px]">
                            {editingUser.function && (
                              editingUser.function === "Audit" && userRoles.includes("CustomerAdministrator") && !userRoles.includes("GRCAdministrator")
                                ? customerAdminAuditRoles.map((role) => (
                                    <SelectItem key={role} value={role}>
                                      {role}
                                    </SelectItem>
                                  ))
                                : rolesByFunction[editingUser.function]?.map((role) => (
                                    <SelectItem key={role} value={role}>
                                      {role}
                                    </SelectItem>
                                  ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </TooltipTrigger>
                    {!editingUser.function && (
                      <TooltipContent>
                        <p>{t("Please select a function first")}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Department */}
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                <Label htmlFor="editDepartment" className="sm:text-end">{t("Department")}</Label>
                <Select
                  value={editingUser.departmentId || ""}
                  onValueChange={(value) =>
                    setEditingUser({ ...editingUser, departmentId: value })
                  }
                >
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder={t("Select department")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="max-h-[200px]">
                    {translatedDepartments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Designation */}
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                <Label htmlFor="editDesignation" className="sm:text-end">{t("Designation")}</Label>
                <Select
                  value={editingUser.designation || ""}
                  onValueChange={(value) =>
                    setEditingUser({ ...editingUser, designation: value })
                  }
                >
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder={t("Select Designation")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="max-h-[200px]">
                    <SelectItem value="Analyst">{t("Analyst")}</SelectItem>
                    <SelectItem value="Developer">{t("Developer")}</SelectItem>
                    <SelectItem value="Financial Analyst">{t("Financial Analyst")}</SelectItem>
                    <SelectItem value="HR Manager">{t("HR Manager")}</SelectItem>
                    <SelectItem value="Manager">{t("Manager")}</SelectItem>
                    <SelectItem value="Marketing Specialist">{t("Marketing Specialist")}</SelectItem>
                    <SelectItem value="Operations Executive">{t("Operations Executive")}</SelectItem>
                    <SelectItem value="Senior Manager">{t("Senior Manager")}</SelectItem>
                    <SelectItem value="Software Engineer">{t("Software Engineer")}</SelectItem>
                    <SelectItem value="Team Lead">{t("Team Lead")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reporting Manager */}
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                <Label htmlFor="editReportingManager" className="sm:text-end">{t("Reporting Manager")}</Label>
                <Select
                  value={editingUser.reportingManagerId || ""}
                  onValueChange={(value) =>
                    setEditingUser({ ...editingUser, reportingManagerId: value })
                  }
                >
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder={t("Select reporting manager")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="max-h-[200px]">
                    {reportingManagers.map((manager) => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {manager.fullName} {manager.designation ? `(${manager.designation})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Language */}
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                <Label htmlFor="editLanguage" className="sm:text-end">{t("Language")}</Label>
                <Select
                  value={editingUser.language || "English"}
                  onValueChange={(value) =>
                    setEditingUser({ ...editingUser, language: value })
                  }
                >
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder={t("Select language")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="max-h-[200px]">
                    <SelectItem value="English">{t("English")}</SelectItem>
                    <SelectItem value="Arabic">{t("Arabic")}</SelectItem>
                    <SelectItem value="Hindi">{t("Hindi")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Blocked */}
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                <Label className="sm:text-end">{t("Blocked")}</Label>
                <div className="flex gap-4">
                  <div className={`flex items-center ${isRTL ? "space-x-reverse space-x-2" : "space-x-2"}`}>
                    <input
                      type="radio"
                      id="blockedYes"
                      name="isBlocked"
                      checked={editingUser.isBlocked}
                      onChange={() => setEditingUser({ ...editingUser, isBlocked: true })}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="blockedYes" className="font-normal">{t("Yes")}</Label>
                  </div>
                  <div className={`flex items-center ${isRTL ? "space-x-reverse space-x-2" : "space-x-2"}`}>
                    <input
                      type="radio"
                      id="blockedNo"
                      name="isBlocked"
                      checked={!editingUser.isBlocked}
                      onChange={() => setEditingUser({ ...editingUser, isBlocked: false })}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="blockedNo" className="font-normal">{t("No")}</Label>
                  </div>
                </div>
              </div>

              {/* Active */}
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                <Label className="sm:text-end">{t("Active")}</Label>
                <div className="flex gap-4">
                  <div className={`flex items-center ${isRTL ? "space-x-reverse space-x-2" : "space-x-2"}`}>
                    <input
                      type="radio"
                      id="activeYes"
                      name="isActive"
                      checked={editingUser.isActive}
                      onChange={() => setEditingUser({ ...editingUser, isActive: true })}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="activeYes" className="font-normal">{t("Yes")}</Label>
                  </div>
                  <div className={`flex items-center ${isRTL ? "space-x-reverse space-x-2" : "space-x-2"}`}>
                    <input
                      type="radio"
                      id="activeNo"
                      name="isActive"
                      checked={!editingUser.isActive}
                      onChange={() => setEditingUser({ ...editingUser, isActive: false })}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="activeNo" className="font-normal">{t("No")}</Label>
                  </div>
                </div>
              </div>

              {/* Change Password Button */}
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                <div></div>
                <Button
                  variant="default"
                  className="w-fit"
                  onClick={() => setIsChangePasswordOpen(true)}
                >
                  {t("Change Password")}
                </Button>
              </div>
            </div>
          )}
          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex items-center justify-end gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg" style={{ direction: 'ltr' }}>
            <Button variant="outline" onClick={() => setIsEditUserOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleEditUser} disabled={isEditSaving}>{isEditSaving ? t("Saving...") : t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Users Dialog */}
      <Dialog open={showImportDialog} onOpenChange={(open) => {
        setShowImportDialog(open);
        if (!open) {
          setImportFile(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0" style={isRTL ? { direction: 'rtl' } : undefined} onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg font-semibold text-slate-800">{t("Import Users")}</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                {t("Import users from a CSV file. The file should have columns: Username, Email, Password, First Name, Last Name, Full Name, Designation, Function, Role, Department, Language, Timezone.")}
              </DialogDescription>
            </DialogHeader>
          </div>
          {/* Content */}
          <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-5">
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("File")}</Label>
              <div className="flex items-center gap-3 mt-1.5">
                <input
                  type="file"
                  accept=".csv"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  {t("Choose File")}
                </Button>
                <span className="text-sm text-slate-500">
                  {importFile ? importFile.name : t("No file chosen")}
                </span>
              </div>
            </div>
          </div>
          {/* Fixed Footer */}
          <div className="flex flex-row items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" className="w-full sm:w-auto" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 me-2" />
              {t("Download Template")}
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 sm:flex-none"
                onClick={() => {
                  setShowImportDialog(false);
                  setImportFile(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
              >
                {t("Cancel")}
              </Button>
              <Button
                className="flex-1 sm:flex-none"
                onClick={handleImport}
                disabled={!importFile || importing}
              >
                {importing ? t("Importing...") : t("Import")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View User Details Dialog (Read-Only) */}
      <Dialog open={isViewUserOpen} onOpenChange={(open) => {
        setIsViewUserOpen(open);
        if (!open) setViewingUser(null);
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" style={isRTL ? { direction: 'rtl' } : undefined} onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg font-semibold text-slate-800">{t("User Details")}</DialogTitle>
            </DialogHeader>
          </div>
          {/* Scrollable Content */}
          {viewingUser && (
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4">
              {/* User ID */}
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                <Label className="sm:text-end text-slate-500">{t("User ID")}</Label>
                <span className="text-sm text-slate-800">{viewingUser.id?.slice(0, 8) || "-"}</span>
              </div>

              {/* First Name */}
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                <Label className="sm:text-end text-slate-500">{t("First Name")}</Label>
                <span className="text-sm text-slate-800">{viewingUser.firstName || "-"}</span>
              </div>

              {/* Last Name */}
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                <Label className="sm:text-end text-slate-500">{t("Last Name")}</Label>
                <span className="text-sm text-slate-800">{viewingUser.lastName || "-"}</span>
              </div>

              {/* Full Name */}
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                <Label className="sm:text-end text-slate-500">{t("Full Name")}</Label>
                <span className="text-sm text-slate-800">{viewingUser.fullName || "-"}</span>
              </div>

              {/* Email */}
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                <Label className="sm:text-end text-slate-500">{t("Email")}</Label>
                <span className="text-sm text-slate-800">{viewingUser.email || "-"}</span>
              </div>

              {/* Username */}
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                <Label className="sm:text-end text-slate-500">{t("Username")}</Label>
                <span className="text-sm text-slate-800">{viewingUser.userName || "-"}</span>
              </div>

              {/* Function */}
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                <Label className="sm:text-end text-slate-500">{t("Function")}</Label>
                <span className="text-sm text-slate-800">{viewingUser.function || "-"}</span>
              </div>

              {/* Role */}
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                <Label className="sm:text-end text-slate-500">{t("User Role")}</Label>
                <span className="text-sm text-slate-800">{viewingUser.role || "-"}</span>
              </div>

              {/* Department */}
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                <Label className="sm:text-end text-slate-500">{t("Department")}</Label>
                <span className="text-sm text-slate-800">{tDeptName(viewingUser.departmentId) || viewingUser.department?.name || "-"}</span>
              </div>

              {/* Designation */}
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                <Label className="sm:text-end text-slate-500">{t("Designation")}</Label>
                <span className="text-sm text-slate-800">{viewingUser.designation || "-"}</span>
              </div>

              {/* Reporting Manager */}
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                <Label className="sm:text-end text-slate-500">{t("Reporting Manager")}</Label>
                <span className="text-sm text-slate-800">{tManagerName(viewingUser.reportingManagerId) || viewingUser.reportingManager?.fullName || "-"}</span>
              </div>

              {/* Language */}
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                <Label className="sm:text-end text-slate-500">{t("Language")}</Label>
                <span className="text-sm text-slate-800">{viewingUser.language || "-"}</span>
              </div>

              {/* Timezone */}
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                <Label className="sm:text-end text-slate-500">{t("Timezone")}</Label>
                <span className="text-sm text-slate-800">{viewingUser.timezone || "-"}</span>
              </div>

              {/* Blocked */}
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                <Label className="sm:text-end text-slate-500">{t("Blocked")}</Label>
                <span className="text-sm text-slate-800">{viewingUser.isBlocked ? t("Yes") : t("No")}</span>
              </div>

              {/* Active */}
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] items-start sm:items-center gap-1 sm:gap-4">
                <Label className="sm:text-end text-slate-500">{t("Active")}</Label>
                <Badge
                  variant="outline"
                  className={viewingUser.isActive
                    ? "border-transparent bg-success-light text-success-dark w-fit"
                    : "border-transparent bg-slate-100 text-slate-600 w-fit"
                  }
                >
                  {viewingUser.isActive ? t("Active") : t("Inactive")}
                </Badge>
              </div>
            </div>
          )}
          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex items-center justify-end gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg" style={{ direction: 'ltr' }}>
            <Button variant="outline" onClick={() => setIsViewUserOpen(false)}>
              {t("Close")}
            </Button>
            <Button onClick={() => {
              setIsViewUserOpen(false);
              setEditingUser(viewingUser);
              setEditUserFormErrors({});
              if (viewingUser?.function) {
                fetchReportingManagers(viewingUser.function);
              }
              setIsEditUserOpen(true);
            }}>
              <Pencil className="h-4 w-4 me-1.5" />
              {t("Edit")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog
        open={isChangePasswordOpen}
        onOpenChange={(open) => {
          setIsChangePasswordOpen(open);
          if (!open) {
            setChangePasswordForm({ newPassword: "", confirmPassword: "" });
            setChangePasswordErrors({});
          }
        }}
      >
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0" style={isRTL ? { direction: 'rtl' } : undefined} onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg font-semibold text-slate-800">{t("Change Password")}</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                {t("Enter a new password for")} {editingUser?.fullName || editingUser?.userName}
              </DialogDescription>
            </DialogHeader>
          </div>
          {/* Content */}
          <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-5">
            <div>
              <Label htmlFor="newPassword" className="text-sm font-medium text-slate-700">{t("New Password")} *</Label>
              <Input
                id="newPassword"
                type="password"
                value={changePasswordForm.newPassword}
                onChange={(e) => {
                  setChangePasswordForm({ ...changePasswordForm, newPassword: e.target.value });
                  if (changePasswordErrors.newPassword) setChangePasswordErrors((prev) => { const { newPassword, ...rest } = prev; return rest; });
                }}
                placeholder={t("Enter new password")}
                autoComplete="new-password"
                className={`mt-1.5 bg-white ${changePasswordErrors.newPassword ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
              {changePasswordErrors.newPassword && (<div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2"><p className="text-sm text-red-600">{changePasswordErrors.newPassword}</p></div>)}
            </div>
            <div>
              <Label htmlFor="confirmNewPassword" className="text-sm font-medium text-slate-700">{t("Confirm Password")} *</Label>
              <Input
                id="confirmNewPassword"
                type="password"
                value={changePasswordForm.confirmPassword}
                onChange={(e) => {
                  setChangePasswordForm({ ...changePasswordForm, confirmPassword: e.target.value });
                  if (changePasswordErrors.confirmPassword) setChangePasswordErrors((prev) => { const { confirmPassword, ...rest } = prev; return rest; });
                }}
                placeholder={t("Confirm new password")}
                autoComplete="new-password"
                className={`mt-1.5 bg-white ${changePasswordErrors.confirmPassword ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
              {changePasswordErrors.confirmPassword && (<div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2"><p className="text-sm text-red-600">{changePasswordErrors.confirmPassword}</p></div>)}
            </div>
          </div>
          {/* Fixed Footer */}
          <div className="flex items-center justify-end gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg" style={{ direction: 'ltr' }}>
            <Button
              variant="outline"
              onClick={() => {
                setIsChangePasswordOpen(false);
                setChangePasswordForm({ newPassword: "", confirmPassword: "" });
                setChangePasswordErrors({});
              }}
            >
              {t("Cancel")}
            </Button>
            <Button onClick={handleChangePassword} disabled={changingPassword}>
              {changingPassword ? t("Changing...") : t("Change Password")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent style={isRTL ? { direction: 'rtl' } : undefined}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete User")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to delete")} <strong>{userToDelete?.fullName}</strong>? {t("This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteDialogOpen(false); setUserToDelete(null); }}>
              {t("Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDeleteUser}
            >
              {t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Subscription Error Dialog */}
      <Dialog open={showSubscriptionErrorDialog} onOpenChange={setShowSubscriptionErrorDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[400px] p-0 gap-0 overflow-hidden" style={isRTL ? { direction: 'rtl' } : undefined} onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg font-semibold text-red-600">{t("Error")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-4 sm:px-6 py-4 sm:py-5">
            <p className="text-sm sm:text-base text-slate-600">{subscriptionErrorMessage}</p>
          </div>

          {/* Fixed Footer */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex justify-end" style={{ direction: 'ltr' }}>
            <Button size="sm" onClick={() => setShowSubscriptionErrorDialog(false)}>
              {t("OK")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
