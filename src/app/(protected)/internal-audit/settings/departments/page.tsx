"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Home } from "lucide-react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

interface Department {
  id: string;
  name: string;
  description: string | null;
  headId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: string;
  fullName: string;
}

export default function DepartmentsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { toast } = useToast();
  const { canView: canViewDashboard } = usePermissions('audit.dashboard');
  const [items, setItems] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Department | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    headId: ""
  });
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Department | null>(null);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const [deptResponse, usersResponse] = await Promise.all([
        fetch("/api/departments"),
        fetch("/api/users")
      ]);

      if (deptResponse.ok) {
        const data = await deptResponse.json();
        setItems(data);
      }

      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setUsers(usersData);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = () => {
    setEditItem(null);
    setFormData({ name: "", description: "", headId: "" });
    setDialogOpen(true);
  };

  const openEditDialog = (item: Department) => {
    setEditItem(item);
    setFormData({
      name: item.name,
      description: item.description || "",
      headId: item.headId || ""
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: t("Error"),
        description: t("Department Name is required"),
      });
      return;
    }

    setSaving(true);
    try {
      const url = editItem
        ? `/api/departments/${editItem.id}`
        : "/api/departments";
      const method = editItem ? "PUT" : "POST";

      const body = {
        name: formData.name,
        description: formData.description || null,
        headId: formData.headId || null
      };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setDialogOpen(false);
        fetchItems();
      }
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDialog = (item: Department) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
      const response = await fetch(`/api/departments/${itemToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchItems();
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination calculations
  const totalItems = filteredItems.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedItems = filteredItems.slice(startIndex, endIndex);
  const startItem = totalItems > 0 ? startIndex + 1 : 0;
  const endItem = endIndex;

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Home className="h-4 w-4" />
            <span>{t("Internal Audit")}</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          {canViewDashboard && (
            <>
              <Link href="/internal-audit/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
                {t("Dashboard")}
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            </>
          )}
          <Link href="/internal-audit/settings" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Settings")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="text-primary-700 font-medium">{t("Department")}</span>
        </nav>

        <h1 className="text-2xl font-bold text-slate-800">{t("Department")}</h1>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
              <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
            </div>
            <p className="text-sm text-slate-500 font-medium">{t("Loading departments...")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Internal Audit")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        {canViewDashboard && (
          <>
            <Link href="/internal-audit/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
              {t("Dashboard")}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          </>
        )}
        <Link href="/internal-audit/settings" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Settings")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Department")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">{t("Department")}</h1>
        <Button size="sm" onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-2" />
          {t("New Department")}
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Search */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder={t("Search departments...")}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10 w-[300px] h-9 bg-white border-slate-200"
            />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pl-5">{t("Department Name")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-5 w-[100px]">{t("Action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="h-24 text-center text-sm text-slate-500">
                  {t("No departments found")}
                </TableCell>
              </TableRow>
            ) : (
              paginatedItems.map((item) => (
                <TableRow key={item.id} className="border-b border-slate-100 last:border-0">
                  <TableCell className="py-3 text-sm font-medium text-slate-800 pl-5">{item.name}</TableCell>
                  <TableCell className="py-3 pr-5">
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-slate-600"
                        onClick={() => openEditDialog(item)}
                        title={t("Edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-semantic-error"
                        onClick={() => openDeleteDialog(item)}
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

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
          <span className="text-xs text-slate-500">
            {totalItems > 0 ? `${startItem} ${t("to")} ${endItem} ${t("of")} ${totalItems}` : t("No departments")}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400 hover:text-slate-600"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400 hover:text-slate-600"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400 hover:text-slate-600"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400 hover:text-slate-600"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {editItem ? t("Edit Department") : t("Add Department")}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Department Name")} <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t("Enter department name")}
                  className="mt-1.5 w-full bg-white"
                  autoFocus
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Department Head")}</Label>
                <Select
                  value={formData.headId || "none"}
                  onValueChange={(value) => setFormData({ ...formData, headId: value === "none" ? "" : value })}
                >
                  <SelectTrigger className="mt-1.5 w-full bg-white border-slate-200">
                    <SelectValue placeholder={t("Select department head (optional)")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("None")}</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t("Enter department description (optional)")}
                className="mt-1.5 w-full bg-white"
                rows={3}
              />
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t("Saving...") : t("Save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="sm:max-w-[400px] p-0 gap-0">
          <AlertDialogHeader className="px-6 py-5 border-b border-slate-100">
            <AlertDialogTitle className="text-lg font-semibold text-slate-800">{t("Confirm Delete")}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500 mt-1">
              {t("Are you sure you want to delete")} &quot;{itemToDelete?.name}&quot;? {t("This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex justify-end gap-2 px-6 py-4 bg-slate-50/80 rounded-b-lg">
            <AlertDialogCancel className="mt-0">{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              {t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
