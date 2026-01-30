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
import { ArrowLeft, Plus, Pencil, Trash2, ArrowUpDown, Search } from "lucide-react";
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

// For Audit function, show these audit roles (Auditor removed)
const AUDIT_ROLES = [
  "AuditHead",
  "AuditManager",
  "Auditee",
];

export default function UserManagementPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [searchTerm, setSearchTerm] = useState("");

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
      userName: "",
      email: "",
      designation: "",
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
      designation: user.designation || "",
      departmentId: user.departmentId || "",
      roles,
      password: "",
      confirmPassword: "",
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
      toast({ title: "Error", description: "Passwords do not match!", variant: "destructive" });
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
        toast({ title: "Success", description: "Password changed successfully!" });
      } else {
        toast({ title: "Error", description: "Failed to change password", variant: "destructive" });
      }
    } catch (error) {
      console.error("Failed to change password:", error);
      toast({ title: "Error", description: "Failed to change password", variant: "destructive" });
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
    if (!formData.firstName.trim() || !formData.email.trim()) return;
    if (!editItem && formData.password !== formData.confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // Use Internal Audit specific API
      const url = editItem ? `/api/internal-audit/users/${editItem.id}` : "/api/internal-audit/users";
      const method = editItem ? "PUT" : "POST";

      const generatedUserName = formData.userName || nextUserId;
      const body: any = {
        userId: generatedUserName, // API requires userId
        firstName: formData.firstName,
        lastName: formData.lastName,
        fullName: formData.fullName || `${formData.firstName} ${formData.lastName}`,
        userName: generatedUserName,
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
        toast({ title: "Success", description: "User saved successfully!" });
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast({
          title: "Error",
          description: errorData.error || "Failed to save user",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Failed to save:", error);
      toast({ title: "Error", description: "Failed to save user", variant: "destructive" });
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
        toast({ title: "Success", description: "User deleted successfully!" });
      } else {
        toast({ title: "Error", description: "Failed to delete user", variant: "destructive" });
      }
    } catch (error) {
      console.error("Failed to delete:", error);
      toast({ title: "Error", description: "Failed to delete user", variant: "destructive" });
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
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/internal-audit/settings")}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
        </div>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
              <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
            </div>
            <p className="text-sm text-slate-500 font-medium">Loading users...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/internal-audit/settings")}
          className="h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
      </div>

      {/* Search and Add Button Row */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-[300px] h-9 bg-white border-slate-200"
          />
        </div>
        <div className="flex-1" />
        <Button size="sm" onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-2" />
          New User
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-100 bg-slate-50/50">
              <TableHead className="text-xs font-semibold text-slate-600 h-12 pl-4">Full Name</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12">Email</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12">User Role</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12 pr-4 w-[100px]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <TableCell className="py-3 text-sm font-medium text-slate-800 pl-4">{user.fullName}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-600">{user.email}</TableCell>
                  <TableCell className="py-3">
                    <div className="flex flex-wrap gap-1">
                      {parseRoles(user.role).map((role, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="py-3 pr-4">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-slate-600"
                        onClick={() => openEditDialog(user)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-semantic-error"
                        onClick={() => openDeleteDialog(user)}
                        title="Delete"
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

        {/* Pagination info */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
          <span className="text-sm text-slate-500">
            Showing {filteredUsers.length} of {users.length} users
          </span>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0 max-h-[90vh] overflow-hidden flex flex-col">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{editItem ? "Edit User" : "New Account"}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-5">
              {/* Row 1: User ID & Username */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">User ID</Label>
                  <Input
                    value={editItem ? editItem.userName : nextUserId}
                    disabled
                    className="mt-1.5 w-full bg-slate-50"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Username <span className="text-red-500">*</span></Label>
                  <Input
                    value={formData.userName}
                    onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                    placeholder="Enter username"
                    className="mt-1.5 w-full bg-white"
                  />
                </div>
              </div>

              {/* Row 2: First Name & Last Name */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">First Name <span className="text-red-500">*</span></Label>
                  <Input
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    placeholder="Enter first name"
                    className="mt-1.5 w-full bg-white"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Last Name</Label>
                  <Input
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    placeholder="Enter last name"
                    className="mt-1.5 w-full bg-white"
                  />
                </div>
              </div>

              {/* Row 3: Full Name & Email */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Full Name</Label>
                  <Input
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="Enter full name"
                    className="mt-1.5 w-full bg-white"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Email <span className="text-red-500">*</span></Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Enter email"
                    className="mt-1.5 w-full bg-white"
                  />
                </div>
              </div>

              {/* Row 4: Designation & Function */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Designation</Label>
                  <Input
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    placeholder="Enter designation (optional)"
                    className="mt-1.5 w-full bg-white"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Function</Label>
                  <Input value="Audit" disabled className="mt-1.5 w-full bg-slate-50" />
                </div>
              </div>

              {/* Row 5: Department */}
              <div>
                <Label className="text-sm font-medium text-slate-700">Department</Label>
                <Select
                  value={formData.departmentId}
                  onValueChange={(value) => setFormData({ ...formData, departmentId: value })}
                >
                  <SelectTrigger className="mt-1.5 w-full bg-white border-slate-200">
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

              {/* User Role (multi-select with checkboxes) */}
              <div>
                <Label className="text-sm font-medium text-slate-700">User Role</Label>
                <div className="mt-1.5 grid grid-cols-2 gap-2 border border-slate-200 rounded-lg p-3 bg-white">
                  {AUDIT_ROLES.map((role) => (
                    <div key={role} className="flex items-center space-x-2">
                      <Checkbox
                        id={role}
                        checked={formData.roles.includes(role)}
                        onCheckedChange={(checked) => handleRoleChange(role, checked as boolean)}
                      />
                      <label htmlFor={role} className="text-sm cursor-pointer text-slate-700">
                        {role}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Password fields (only for new users) */}
              {!editItem && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Password <span className="text-red-500">*</span></Label>
                    <Input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Enter password"
                      className="mt-1.5 w-full bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Confirm Password <span className="text-red-500">*</span></Label>
                    <Input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      placeholder="Confirm password"
                      className="mt-1.5 w-full bg-white"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-between items-center px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <div>
              {editItem && (
                <Button
                  variant="outline"
                  onClick={openChangePasswordDialog}
                  type="button"
                >
                  Change Password
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || !formData.firstName.trim() || !formData.email.trim()}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={changePasswordDialogOpen} onOpenChange={setChangePasswordDialogOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 gap-0">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">Change Password</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-5">
            <div>
              <Label className="text-sm font-medium text-slate-700">New Password <span className="text-red-500">*</span></Label>
              <Input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                placeholder="Enter new password"
                className="mt-1.5 w-full bg-white"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">Confirm New Password <span className="text-red-500">*</span></Label>
              <Input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                placeholder="Confirm new password"
                className="mt-1.5 w-full bg-white"
              />
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => setChangePasswordDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={changingPassword || !passwordForm.newPassword || passwordForm.newPassword !== passwordForm.confirmPassword}
            >
              {changingPassword ? "Changing..." : "Change Password"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="sm:max-w-[400px] p-0 gap-0">
          <AlertDialogHeader className="px-6 py-5 border-b border-slate-100">
            <AlertDialogTitle className="text-lg font-semibold text-slate-800">Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500 mt-1">
              Are you sure you want to delete &quot;{itemToDelete?.fullName}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex justify-end gap-2 px-6 py-4">
            <AlertDialogCancel className="mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
