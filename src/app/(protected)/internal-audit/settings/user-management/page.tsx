"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { ArrowLeft, Plus, Pencil, Trash2, ArrowUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

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
}

interface Department {
  id: string;
  name: string;
}

const AUDIT_ROLES = [
  "Auditor",
  "AuditHead",
  "AuditUser",
  "AuditManager",
  "DepartmentReviewer",
  "DepartmentContributor",
  "Auditee",
];

export default function UserManagementPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    fullName: "",
    userName: "",
    email: "",
    departmentId: "",
    roles: [] as string[],
    password: "",
    confirmPassword: "",
  });
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<User | null>(null);

  // Auto-generated user ID
  const [nextUserId, setNextUserId] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, departmentsRes] = await Promise.all([
        fetch("/api/users"),
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
      userName: "",
      email: "",
      departmentId: "",
      roles: [],
      password: "",
      confirmPassword: "",
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
      departmentId: user.departmentId || "",
      roles,
      password: "",
      confirmPassword: "",
    });
    setDialogOpen(true);
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
    if (!formData.firstName.trim() || !formData.email.trim()) return;
    if (!editItem && formData.password !== formData.confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    setSaving(true);
    try {
      const url = editItem ? `/api/users/${editItem.id}` : "/api/users";
      const method = editItem ? "PUT" : "POST";

      const body: any = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        fullName: formData.fullName || `${formData.firstName} ${formData.lastName}`,
        userName: formData.userName || nextUserId,
        email: formData.email,
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
      }
    } catch (error) {
      console.error("Failed to save:", error);
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
      const response = await fetch(`/api/users/${itemToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const parseRoles = (roleString: string): string[] => {
    return roleString ? roleString.split(",").map((r) => r.trim()).filter(Boolean) : [];
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <p className="text-sm text-muted-foreground">Internal Audit</p>
            <h1 className="text-2xl font-semibold">Audit Settings</h1>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/internal-audit/settings")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <p className="text-sm text-muted-foreground">Internal Audit</p>
          <h1 className="text-2xl font-semibold">Audit Settings</h1>
        </div>
      </div>

      {/* Content */}
      <div className="bg-card rounded-lg border p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">User Management</h2>
          <Button onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            New User
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button variant="ghost" onClick={handleSort} className="flex items-center gap-2 -ml-4">
                  Full Name
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>Email</TableHead>
              <TableHead>User Role</TableHead>
              <TableHead className="w-[100px]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.fullName}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {parseRoles(user.role).map((role, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {role}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(user)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(user)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No users found. Add your first user.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination info */}
        <div className="flex items-center justify-end mt-4 text-sm text-muted-foreground">
          Currently showing 1 to {users.length} of {users.length}
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit User" : "New Account"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* User ID (readonly) */}
            <div>
              <Label>User ID</Label>
              <Input
                value={editItem ? editItem.userName : nextUserId}
                disabled
                className="mt-2 bg-muted"
              />
            </div>

            {/* First Name */}
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="Enter first name"
                className="mt-2"
              />
            </div>

            {/* Last Name */}
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                placeholder="Enter last name"
                className="mt-2"
              />
            </div>

            {/* Full Name */}
            <div>
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="Enter full name"
                className="mt-2"
              />
            </div>

            {/* Username */}
            <div>
              <Label htmlFor="userName">Username</Label>
              <Input
                id="userName"
                value={formData.userName}
                onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                placeholder="Enter username"
                className="mt-2"
              />
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Enter email"
                className="mt-2"
              />
            </div>

            {/* Function (readonly) */}
            <div>
              <Label>Function</Label>
              <Input value="Audit" disabled className="mt-2 bg-muted" />
            </div>

            {/* User Role (multi-select with checkboxes) */}
            <div>
              <Label>User Role</Label>
              <div className="mt-2 space-y-2 border rounded-md p-3">
                {AUDIT_ROLES.map((role) => (
                  <div key={role} className="flex items-center space-x-2">
                    <Checkbox
                      id={role}
                      checked={formData.roles.includes(role)}
                      onCheckedChange={(checked) => handleRoleChange(role, checked as boolean)}
                    />
                    <label htmlFor={role} className="text-sm cursor-pointer">
                      {role}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Department */}
            <div>
              <Label>Department</Label>
              <Select
                value={formData.departmentId}
                onValueChange={(value) => setFormData({ ...formData, departmentId: value })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select Department" />
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

            {/* Password fields (only for new users) */}
            {!editItem && (
              <>
                <div>
                  <Label htmlFor="password">New Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Enter password"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="Confirm password"
                    className="mt-2"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !formData.firstName.trim() || !formData.email.trim()}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this user?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleDelete}>OK</AlertDialogAction>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
