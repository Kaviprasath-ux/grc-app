"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, MoreVertical, Pencil, Trash2, Search, Upload, Download } from "lucide-react";
import { DataGrid, FilterBar } from "@/components/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useSession } from "next-auth/react";
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
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
}

// RBAC roles mapped by function
const rolesByFunction: Record<string, string[]> = {
  Business: ["DepartmentReviewer", "DepartmentContributor", "Contributor"],
  Security: ["Reviewer"],
  Audit: ["AuditHead", "AuditManager", "Auditor", "Auditee", "AuditUser"],
};

// All assignable roles for filtering (excludes GRCAdministrator)
const allUserRoles = [
  "CustomerAdministrator",
  "AuditHead",
  "AuditManager",
  "AuditUser",
  "Auditor",
  "Auditee",
  "Reviewer",
  "Contributor",
  "DepartmentReviewer",
  "DepartmentContributor",
];

export default function UsersPage() {
  const { toast } = useToast();
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState("account-overview");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [reportingManagers, setReportingManagers] = useState<ReportingManager[]>([]);
  const [loading, setLoading] = useState(true);

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
  const [editingUser, setEditingUser] = useState<User | null>(null);

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
      if (userRes.ok) setUsers(await userRes.json());
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

  // User CRUD
  const handleAddUser = async () => {
    if (!userForm.userName || !userForm.email || !userForm.password || !userForm.firstName || !userForm.lastName || !userForm.fullName || !userForm.function || !userForm.role) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    if (userForm.password !== userForm.confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }

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
        resetForm();
        setIsAddUserOpen(false);
      } else {
        const error = await res.json();
        toast({ title: "Error", description: error.error || "Failed to create user", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error adding user:", error);
    }
  };

  const handleEditUser = async () => {
    if (!editingUser) return;
    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingUser),
      });

      if (res.ok) {
        const updated = await res.json();
        setUsers(users.map((u) => (u.id === updated.id ? updated : u)));
        setIsEditUserOpen(false);
        setEditingUser(null);
      }
    } catch (error) {
      console.error("Error updating user:", error);
    }
  };

  const handleChangePassword = async () => {
    if (!editingUser) return;

    if (changePasswordForm.newPassword !== changePasswordForm.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (!changePasswordForm.newPassword) {
      toast({
        title: "Error",
        description: "Please enter a new password",
        variant: "destructive",
      });
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch(`/api/users/${editingUser.id}/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changePasswordForm),
      });

      if (res.ok) {
        toast({
          title: "Success",
          description: "Password changed successfully",
        });
        setIsChangePasswordOpen(false);
        setChangePasswordForm({ newPassword: "", confirmPassword: "" });
      } else {
        const error = await res.json();
        toast({
          title: "Error",
          description: error.error || "Failed to change password",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error changing password:", error);
      toast({
        title: "Error",
        description: "Failed to change password",
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
        setDeleteDialogOpen(false);
        setUserToDelete(null);
      }
    } catch (error) {
      console.error("Error deleting user:", error);
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
      ...users.map((u) => [
        u.id?.slice(0, 8) || "",
        u.userName,
        u.email,
        u.firstName,
        u.lastName,
        u.fullName,
        u.designation || "",
        u.function || "",
        u.role,
        u.department?.name || "",
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

      toast({ title: "Success", description: `Import completed: ${successCount} users imported, ${errorCount} errors` });
      setShowImportDialog(false);
      setImportFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      fetchData();
    } catch (error) {
      console.error("Error importing users:", error);
      toast({ title: "Error", description: "Failed to import users. Please check the file format.", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  // Group users by department for Account Overview
  const usersByDepartment = departments
    .filter((dept) =>
      dept.name.toLowerCase().includes(departmentSearchTerm.toLowerCase())
    )
    .map((dept) => ({
      ...dept,
      users: users.filter((user) => user.department?.name === dept.name),
    }));

  // User columns for User Management grid
  const userColumns: ColumnDef<User>[] = [
    {
      accessorKey: "userName",
      header: "User Name",
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("userName")}</span>
      ),
    },
    {
      accessorKey: "fullName",
      header: "Full Name",
    },
    {
      accessorKey: "department.name",
      header: "Department",
      cell: ({ row }) => row.original.department?.name || "-",
    },
    {
      accessorKey: "designation",
      header: "Designation",
    },
    {
      accessorKey: "isActive",
      header: "Status",
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
            {isActive ? "Active" : "Inactive"}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setEditingUser(row.original);
                if (row.original.function) {
                  fetchReportingManagers(row.original.function);
                }
                setIsEditUserOpen(true);
              }}
            >
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setEditingUser(row.original);
                if (row.original.function) {
                  fetchReportingManagers(row.original.function);
                }
                setIsEditUserOpen(true);
              }}
            >
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setEditingUser(row.original);
                setIsChangePasswordOpen(true);
              }}
            >
              Reset Password
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => handleDeactivateUser(row.original)}
            >
              Deactivate
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => openDeleteDialog(row.original)}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  // Filter users
  const filteredUsers = users.filter((user) => {
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesDepartment = departmentFilter === "all" || user.department?.name === departmentFilter;
    const matchesSearch = user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.userName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesRole && matchesDepartment && matchesSearch;
  });

  // Users filtered to current user's department (for DeptReviewer/DeptContributor)
  const departmentUsers = users.filter((user) =>
    user.departmentId === currentUserDepartmentId
  );

  // Get current user's department name
  const currentDepartment = departments.find((d) => d.id === currentUserDepartmentId);

  // Columns for department view (read-only, no actions)
  const departmentUserColumns: ColumnDef<User>[] = [
    {
      accessorKey: "fullName",
      header: "Full Name",
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("fullName")}</span>
      ),
    },
    {
      accessorKey: "designation",
      header: "Designation Name",
      cell: ({ row }) => row.original.designation || "-",
    },
    {
      id: "reportingManager",
      header: "Reporting Manager",
      cell: ({ row }) => row.original.reportingManager?.fullName || "-",
    },
    {
      accessorKey: "email",
      header: "Email ID",
    },
    {
      id: "lastLogin",
      header: "Last Login",
      cell: () => "-",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">Loading...</p>
      </div>
    );
  }

  // Simplified view for DeptReviewer/DeptContributor
  if (isDeptRole) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Account Overview</h1>
        </div>

        <div className="space-y-4">
          {currentDepartment && (
            <div className="text-lg font-semibold text-foreground">
              {currentDepartment.name} - {departmentUsers.length} users
            </div>
          )}
          <DataGrid
            columns={departmentUserColumns}
            data={departmentUsers}
            searchPlaceholder="Search users..."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Users</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="account-overview">Account Overview</TabsTrigger>
          <TabsTrigger value="user-management">User Management</TabsTrigger>
        </TabsList>

        {/* Account Overview Tab */}
        <TabsContent value="account-overview" className="mt-6 space-y-4">
          {/* Header with search and action buttons */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by Department Name"
                value={departmentSearchTerm}
                onChange={(e) => setDepartmentSearchTerm(e.target.value)}
                className="pl-10 bg-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
              <Button size="sm" onClick={() => setIsAddUserOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add New
              </Button>
            </div>
          </div>

          {/* Department Accordions */}
          <Accordion type="multiple" className="w-full space-y-2">
            {usersByDepartment.map((dept) => (
              <AccordionItem
                key={dept.id}
                value={dept.id}
                className="border rounded-lg px-4 bg-white"
              >
                <AccordionTrigger className="hover:no-underline py-4">
                  <span className="font-semibold text-foreground">
                    {dept.name} - {dept.users.length}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  {dept.users.length > 0 ? (
                    <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/50">
                            <th className="text-left py-4 pl-4 text-xs font-semibold text-slate-600">Full Name</th>
                            <th className="text-left py-4 text-xs font-semibold text-slate-600">Designation Name</th>
                            <th className="text-left py-4 text-xs font-semibold text-slate-600">Reporting Manager</th>
                            <th className="text-left py-4 text-xs font-semibold text-slate-600">Email ID</th>
                            <th className="text-left py-4 text-xs font-semibold text-slate-600">Last Login</th>
                            <th className="text-center py-4 text-xs font-semibold text-slate-600">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white">
                          {dept.users.map((user) => (
                            <tr key={user.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                              <td className="py-4 pl-4 text-sm text-slate-700">{user.fullName}</td>
                              <td className="py-4 text-sm text-slate-700">{user.designation || "-"}</td>
                              <td className="py-4 text-sm text-slate-700">{user.reportingManager?.fullName || "-"}</td>
                              <td className="py-4 text-sm text-slate-700">{user.email}</td>
                              <td className="py-4 text-sm text-slate-700">-</td>
                              <td className="py-4">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-400 hover:text-slate-600"
                                    onClick={() => {
                                      setEditingUser(user);
                                      if (user.function) {
                                        fetchReportingManagers(user.function);
                                      }
                                      setIsEditUserOpen(true);
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-400 hover:text-semantic-error"
                                    onClick={() => openDeleteDialog(user)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {/* Pagination */}
                      <div className="flex items-center justify-between p-4 border-t border-slate-100">
                        <div className="text-xs text-slate-500">
                          Showing 1 to {dept.users.length} of {dept.users.length}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl border border-slate-200 p-8">
                      <p className="text-slate-500 text-sm text-center">
                        No users in this department
                      </p>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </TabsContent>

        {/* User Management Tab */}
        <TabsContent value="user-management" className="mt-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <FilterBar
                searchPlaceholder="Search user..."
                searchValue={searchTerm}
                onSearchChange={setSearchTerm}
                filters={[
                  {
                    id: "role",
                    label: "Role",
                    options: [
                      { value: "all", label: "All Roles" },
                      ...allUserRoles.map((role) => ({ value: role, label: role })),
                    ],
                    value: roleFilter,
                    onChange: setRoleFilter,
                  },
                  {
                    id: "department",
                    label: "Department",
                    options: [
                      { value: "all", label: "All Departments" },
                      ...departments.map((d) => ({ value: d.name, label: d.name })),
                    ],
                    value: departmentFilter,
                    onChange: setDepartmentFilter,
                  },
                ]}
              />
            </div>
            <Button size="sm" onClick={() => setIsAddUserOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Account
            </Button>
          </div>
          <DataGrid
            columns={userColumns}
            data={filteredUsers}
            hideSearch={true}
          />
        </TabsContent>
      </Tabs>

      {/* Add User Dialog */}
      <Dialog open={isAddUserOpen} onOpenChange={(open) => {
        setIsAddUserOpen(open);
        if (!open) {
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
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">New Account</DialogTitle>
            </DialogHeader>
          </div>
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {/* Account Credentials Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">Account Credentials</h4>
              <div className="grid grid-cols-2 gap-4">
                {/* Username - full width */}
                <div className="col-span-2">
                  <Label htmlFor="userName" className="text-sm font-medium text-slate-700">Username *</Label>
                  <Input
                    id="userName"
                    value={userForm.userName}
                    onChange={(e) => setUserForm({ ...userForm, userName: e.target.value })}
                    placeholder="Enter username"
                    className="mt-1.5 bg-white"
                  />
                </div>
                {/* Email - full width */}
                <div className="col-span-2">
                  <Label htmlFor="email" className="text-sm font-medium text-slate-700">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    placeholder="Enter email"
                    className="mt-1.5 bg-white"
                  />
                </div>
                {/* Password and Confirm Password - side by side */}
                <div>
                  <Label htmlFor="password" className="text-sm font-medium text-slate-700">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    placeholder="Enter password"
                    autoComplete="new-password"
                    className="mt-1.5 bg-white"
                  />
                </div>
                <div>
                  <Label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">Confirm Password *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={userForm.confirmPassword}
                    onChange={(e) => setUserForm({ ...userForm, confirmPassword: e.target.value })}
                    placeholder="Confirm password"
                    autoComplete="new-password"
                    className="mt-1.5 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Personal Information Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">Personal Information</h4>
              <div className="grid grid-cols-2 gap-4">
                {/* First Name and Last Name - side by side */}
                <div>
                  <Label htmlFor="firstName" className="text-sm font-medium text-slate-700">First Name *</Label>
                  <Input
                    id="firstName"
                    value={userForm.firstName}
                    onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })}
                    placeholder="Enter first name"
                    className="mt-1.5 bg-white"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName" className="text-sm font-medium text-slate-700">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={userForm.lastName}
                    onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })}
                    placeholder="Enter last name"
                    className="mt-1.5 bg-white"
                  />
                </div>
                {/* Full Name - full width */}
                <div className="col-span-2">
                  <Label htmlFor="fullName" className="text-sm font-medium text-slate-700">Full Name *</Label>
                  <Input
                    id="fullName"
                    value={userForm.fullName}
                    onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
                    placeholder="Enter full name"
                    className="mt-1.5 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Organization & Role Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">Organization & Role</h4>
              <div className="grid grid-cols-2 gap-4">
                {/* Function - full width */}
                <div className="col-span-2">
                  <Label htmlFor="function" className="text-sm font-medium text-slate-700">Function *</Label>
                  <Select
                    value={userForm.function}
                    onValueChange={(value) => {
                      setUserForm({ ...userForm, function: value, role: "", reportingManagerId: "" });
                      fetchReportingManagers(value);
                    }}
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder="Select function" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="max-h-[200px]">
                      <SelectItem value="Business">Business</SelectItem>
                      <SelectItem value="Security">Security</SelectItem>
                      <SelectItem value="Audit">Audit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Role - full width */}
                <div className="col-span-2">
                  <Label htmlFor="role" className="text-sm font-medium text-slate-700">Role *</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Select
                            value={userForm.role}
                            onValueChange={(value) => setUserForm({ ...userForm, role: value })}
                            disabled={!userForm.function}
                          >
                            <SelectTrigger className={`mt-1.5 w-full bg-white ${!userForm.function ? "cursor-not-allowed opacity-50" : ""}`}>
                              <SelectValue placeholder={userForm.function ? "Select role" : "Select function first"} />
                            </SelectTrigger>
                            <SelectContent position="popper" sideOffset={4} className="max-h-[200px]">
                              {userForm.function && rolesByFunction[userForm.function]?.map((role) => (
                                <SelectItem key={role} value={role}>
                                  {role}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </TooltipTrigger>
                      {!userForm.function && (
                        <TooltipContent>
                          <p>Please select a function first</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </div>
                {/* Department and Designation - side by side */}
                <div>
                  <Label htmlFor="department" className="text-sm font-medium text-slate-700">Department</Label>
                  <Select
                    value={userForm.departmentId}
                    onValueChange={(value) => setUserForm({ ...userForm, departmentId: value })}
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="max-h-[200px]">
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="designation" className="text-sm font-medium text-slate-700">Designation</Label>
                  <Input
                    id="designation"
                    value={userForm.designation}
                    onChange={(e) => setUserForm({ ...userForm, designation: e.target.value })}
                    placeholder="Enter designation"
                    autoComplete="off"
                    className="mt-1.5 bg-white"
                  />
                </div>
                {/* Reporting Manager - full width */}
                <div className="col-span-2">
                  <Label htmlFor="reportingManager" className="text-sm font-medium text-slate-700">Reporting Manager</Label>
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
                              <SelectValue placeholder={userForm.function ? "Select reporting manager" : "Select function first"} />
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
                      </TooltipTrigger>
                      {!userForm.function && (
                        <TooltipContent>
                          <p>Please select a function first</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>

            {/* Preferences Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">Preferences</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="language" className="text-sm font-medium text-slate-700">Language</Label>
                  <Select
                    value={userForm.language}
                    onValueChange={(value) => setUserForm({ ...userForm, language: value })}
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="max-h-[200px]">
                      <SelectItem value="English">English</SelectItem>
                      <SelectItem value="Arabic">Arabic</SelectItem>
                      <SelectItem value="Hindi">Hindi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="timezone" className="text-sm font-medium text-slate-700">Time Zone</Label>
                  <Select
                    value={userForm.timezone}
                    onValueChange={(value) => setUserForm({ ...userForm, timezone: value })}
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder="Select timezone" />
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
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">Account Status</h4>
              <div className="flex gap-6">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="active"
                    checked={userForm.isActive}
                    onCheckedChange={(checked) =>
                      setUserForm({ ...userForm, isActive: checked as boolean })
                    }
                  />
                  <Label htmlFor="active" className="font-normal">
                    Active
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="blocked"
                    checked={userForm.isBlocked}
                    onCheckedChange={(checked) =>
                      setUserForm({ ...userForm, isBlocked: checked as boolean })
                    }
                  />
                  <Label htmlFor="blocked" className="font-normal">
                    Blocked
                  </Label>
                </div>
              </div>
            </div>
          </div>
          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => {
              setIsAddUserOpen(false);
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
              Cancel
            </Button>
            <Button onClick={handleAddUser}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">Edit Account</DialogTitle>
            </DialogHeader>
          </div>
          {/* Scrollable Content */}
          {editingUser && (
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
              {/* User ID - Read Only */}
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="text-right">User ID</Label>
                <span className="text-sm text-muted-foreground">{editingUser.id?.slice(0, 8) || "-"}</span>
              </div>

              {/* First Name */}
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label htmlFor="editFirstName" className="text-right">First name</Label>
                <Input
                  id="editFirstName"
                  value={editingUser.firstName}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, firstName: e.target.value })
                  }
                  className="bg-white"
                />
              </div>

              {/* Last Name */}
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label htmlFor="editLastName" className="text-right">Last name</Label>
                <Input
                  id="editLastName"
                  value={editingUser.lastName}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, lastName: e.target.value })
                  }
                  className="bg-white"
                />
              </div>

              {/* Full Name */}
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label htmlFor="editFullName" className="text-right">Full name</Label>
                <Input
                  id="editFullName"
                  value={editingUser.fullName}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, fullName: e.target.value })
                  }
                  className="bg-white"
                />
              </div>

              {/* Email */}
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label htmlFor="editEmail" className="text-right">Email</Label>
                <Input
                  id="editEmail"
                  type="email"
                  value={editingUser.email}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, email: e.target.value })
                  }
                  className="bg-white"
                />
              </div>

              {/* Is Local User */}
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="text-right">Is local user</Label>
                <div className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="localUserYes"
                      name="isLocalUser"
                      checked={true}
                      className="h-4 w-4"
                      readOnly
                    />
                    <Label htmlFor="localUserYes" className="font-normal">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="localUserNo"
                      name="isLocalUser"
                      checked={false}
                      className="h-4 w-4"
                      readOnly
                    />
                    <Label htmlFor="localUserNo" className="font-normal">No</Label>
                  </div>
                </div>
              </div>

              {/* Name (Username) */}
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label htmlFor="editUserName" className="text-right">Name</Label>
                <Input
                  id="editUserName"
                  value={editingUser.userName}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, userName: e.target.value })
                  }
                  className="bg-white"
                />
              </div>

              {/* Function */}
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label htmlFor="editFunction" className="text-right">Function</Label>
                <Select
                  value={editingUser.function || ""}
                  onValueChange={(value) => {
                    setEditingUser({ ...editingUser, function: value, reportingManagerId: "" });
                    fetchReportingManagers(value);
                  }}
                >
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder="Select function" />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="max-h-[200px]">
                    <SelectItem value="Business">Business</SelectItem>
                    <SelectItem value="Security">Security</SelectItem>
                    <SelectItem value="Audit">Audit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* User Role */}
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label htmlFor="editRole" className="text-right">User Role</Label>
                <Select
                  value={editingUser.role}
                  onValueChange={(value) =>
                    setEditingUser({ ...editingUser, role: value })
                  }
                >
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="max-h-[200px]">
                    {allUserRoles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Department */}
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label htmlFor="editDepartment" className="text-right">Department</Label>
                <Select
                  value={editingUser.departmentId || ""}
                  onValueChange={(value) =>
                    setEditingUser({ ...editingUser, departmentId: value })
                  }
                >
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="max-h-[200px]">
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Designation */}
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label htmlFor="editDesignation" className="text-right">Designation</Label>
                <Select
                  value={editingUser.designation || ""}
                  onValueChange={(value) =>
                    setEditingUser({ ...editingUser, designation: value })
                  }
                >
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder="Select Designation" />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="max-h-[200px]">
                    <SelectItem value="Analyst">Analyst</SelectItem>
                    <SelectItem value="Developer">Developer</SelectItem>
                    <SelectItem value="Financial Analyst">Financial Analyst</SelectItem>
                    <SelectItem value="HR Manager">HR Manager</SelectItem>
                    <SelectItem value="Manager">Manager</SelectItem>
                    <SelectItem value="Marketing Specialist">Marketing Specialist</SelectItem>
                    <SelectItem value="Operations Executive">Operations Executive</SelectItem>
                    <SelectItem value="Senior Manager">Senior Manager</SelectItem>
                    <SelectItem value="Software Engineer">Software Engineer</SelectItem>
                    <SelectItem value="Team Lead">Team Lead</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reporting Manager */}
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label htmlFor="editReportingManager" className="text-right">Reporting Manager</Label>
                <Select
                  value={editingUser.reportingManagerId || ""}
                  onValueChange={(value) =>
                    setEditingUser({ ...editingUser, reportingManagerId: value })
                  }
                >
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder="Select reporting manager" />
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
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label htmlFor="editLanguage" className="text-right">Language</Label>
                <Select
                  value={editingUser.language || "English"}
                  onValueChange={(value) =>
                    setEditingUser({ ...editingUser, language: value })
                  }
                >
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="max-h-[200px]">
                    <SelectItem value="English">English</SelectItem>
                    <SelectItem value="Arabic">Arabic</SelectItem>
                    <SelectItem value="Hindi">Hindi</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Blocked */}
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="text-right">Blocked</Label>
                <div className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="blockedYes"
                      name="isBlocked"
                      checked={editingUser.isBlocked}
                      onChange={() => setEditingUser({ ...editingUser, isBlocked: true })}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="blockedYes" className="font-normal">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="blockedNo"
                      name="isBlocked"
                      checked={!editingUser.isBlocked}
                      onChange={() => setEditingUser({ ...editingUser, isBlocked: false })}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="blockedNo" className="font-normal">No</Label>
                  </div>
                </div>
              </div>

              {/* Active */}
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="text-right">Active</Label>
                <div className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="activeYes"
                      name="isActive"
                      checked={editingUser.isActive}
                      onChange={() => setEditingUser({ ...editingUser, isActive: true })}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="activeYes" className="font-normal">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="activeNo"
                      name="isActive"
                      checked={!editingUser.isActive}
                      onChange={() => setEditingUser({ ...editingUser, isActive: false })}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="activeNo" className="font-normal">No</Label>
                  </div>
                </div>
              </div>

              {/* Change Password Button */}
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <div></div>
                <Button
                  variant="default"
                  className="w-fit"
                  onClick={() => setIsChangePasswordOpen(true)}
                >
                  Change password
                </Button>
              </div>
            </div>
          )}
          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => setIsEditUserOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditUser}>Save</Button>
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
        <DialogContent className="sm:max-w-[700px] p-0 gap-0">
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">Import Users</DialogTitle>
              <DialogDescription>
                Import users from a CSV file. The file should have columns: Username, Email, Password, First Name, Last Name, Full Name, Designation, Function, Role, Department, Language, Timezone.
              </DialogDescription>
            </DialogHeader>
          </div>
          {/* Content */}
          <div className="px-6 py-6 space-y-5">
            <div>
              <Label className="text-sm font-medium text-slate-700">File</Label>
              <div className="flex gap-2 mt-1.5">
                <Input
                  type="file"
                  accept=".csv"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="flex-1"
                />
              </div>
              {importFile && (
                <p className="text-sm text-slate-500 mt-1">
                  Selected: {importFile.name}
                </p>
              )}
            </div>
          </div>
          {/* Fixed Footer */}
          <div className="flex justify-between gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowImportDialog(false);
                  setImportFile(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={!importFile || importing}
              >
                {importing ? "Importing..." : "Import"}
              </Button>
            </div>
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
          }
        }}
      >
        <DialogContent className="sm:max-w-[700px] p-0 gap-0">
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">Change Password</DialogTitle>
              <DialogDescription>
                Enter a new password for {editingUser?.fullName || editingUser?.userName}
              </DialogDescription>
            </DialogHeader>
          </div>
          {/* Content */}
          <div className="px-6 py-6 space-y-5">
            <div>
              <Label htmlFor="newPassword" className="text-sm font-medium text-slate-700">New Password *</Label>
              <Input
                id="newPassword"
                type="password"
                value={changePasswordForm.newPassword}
                onChange={(e) =>
                  setChangePasswordForm({
                    ...changePasswordForm,
                    newPassword: e.target.value,
                  })
                }
                placeholder="Enter new password"
                autoComplete="new-password"
                className="mt-1.5 bg-white"
              />
            </div>
            <div>
              <Label htmlFor="confirmNewPassword" className="text-sm font-medium text-slate-700">Confirm Password *</Label>
              <Input
                id="confirmNewPassword"
                type="password"
                value={changePasswordForm.confirmPassword}
                onChange={(e) =>
                  setChangePasswordForm({
                    ...changePasswordForm,
                    confirmPassword: e.target.value,
                  })
                }
                placeholder="Confirm new password"
                autoComplete="new-password"
                className="mt-1.5 bg-white"
              />
            </div>
          </div>
          {/* Fixed Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button
              variant="outline"
              onClick={() => {
                setIsChangePasswordOpen(false);
                setChangePasswordForm({ newPassword: "", confirmPassword: "" });
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleChangePassword} disabled={changingPassword}>
              {changingPassword ? "Changing..." : "Change Password"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
