"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Search, ChevronRight, Home } from "lucide-react";
import { Pagination as PaginationUI } from "@/components/ui/pagination";
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
import { usePermissions } from "@/hooks/usePermissions";
import { isValidName } from "@/lib/validations";
import { useTranslatedData, triggerTranslation } from "@/hooks/useTranslatedData";

interface AuditCategory {
  id: string;
  name: string;
}

interface AuditSubCategory {
  id: string;
  name: string;
  categoryId: string;
  category: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export default function AuditSubCategoriesPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { toast } = useToast();
  const { canView: canViewDashboard } = usePermissions('audit.dashboard');
  const { canCreate, canEdit, canDelete } = usePermissions('audit.settings');
  const [subCategories, setSubCategories] = useState<AuditSubCategory[]>([]);
  const [categories, setCategories] = useState<AuditCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<AuditSubCategory | null>(null);
  const [formData, setFormData] = useState({ name: "", categoryId: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [categoryError, setCategoryError] = useState("");

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<AuditSubCategory | null>(null);

  useEffect(() => {
    fetchSubCategories();
    fetchCategories();
  }, []);

  const fetchSubCategories = async () => {
    try {
      const response = await fetch("/api/internal-audit/sub-categories");
      if (response.ok) {
        const data = await response.json();
        setSubCategories(data);
      }
    } catch (error) {
      console.error("Failed to fetch sub-categories:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/internal-audit/categories");
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    }
  };

  const openAddDialog = () => {
    setEditItem(null);
    setFormData({ name: "", categoryId: "" });
    setFormError("");
    setCategoryError("");
    setDialogOpen(true);
  };

  const openEditDialog = (item: AuditSubCategory) => {
    setEditItem(item);
    setFormData({ name: item.name, categoryId: item.categoryId });
    setFormError("");
    setCategoryError("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    let hasError = false;

    if (!formData.name.trim()) {
      setFormError(t("Sub-category name is required"));
      hasError = true;
    } else if (!isValidName(formData.name)) {
      setFormError(t("Only letters, spaces, and hyphens are allowed"));
      hasError = true;
    } else {
      setFormError("");
    }

    if (!formData.categoryId) {
      setCategoryError(t("Category is required"));
      hasError = true;
    } else {
      setCategoryError("");
    }

    if (hasError) return;

    setSaving(true);
    try {
      const url = editItem
        ? `/api/internal-audit/sub-categories/${editItem.id}`
        : "/api/internal-audit/sub-categories";
      const method = editItem ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formData.name, categoryId: formData.categoryId }),
      });

      if (response.ok) {
        const savedItem = await response.json().catch(() => null);
        const recordId = editItem ? editItem.id : savedItem?.id;
        if (recordId) {
          triggerTranslation('AuditSubCategory', recordId, { name: formData.name });
        }
        setDialogOpen(false);
        fetchSubCategories();
        toast({
          title: t("Success"),
          description: editItem ? t("Sub-category updated successfully") : t("Sub-category created successfully"),
        });
      } else {
        const data = await response.json();
        toast({
          variant: "destructive",
          title: t("Error"),
          description: data.error || t("Failed to save sub-category"),
        });
      }
    } catch (error) {
      console.error("Failed to save:", error);
      toast({
        variant: "destructive",
        title: t("Error"),
        description: t("Failed to save sub-category"),
      });
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDialog = (item: AuditSubCategory) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
      const response = await fetch(`/api/internal-audit/sub-categories/${itemToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchSubCategories();
        toast({
          title: t("Success"),
          description: t("Sub-category deleted successfully"),
        });
        setDeleteDialogOpen(false);
        setItemToDelete(null);
      } else {
        const data = await response.json();
        toast({
          variant: "destructive",
          title: t("Error"),
          description: data.error || t("Failed to delete sub-category"),
        });
        setDeleteDialogOpen(false);
        setItemToDelete(null);
      }
    } catch (error) {
      console.error("Failed to delete:", error);
      toast({
        variant: "destructive",
        title: t("Error"),
        description: t("Failed to delete sub-category"),
      });
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  // Dynamic data translation
  const { data: translatedSubCategories } = useTranslatedData(subCategories, { modelName: 'AuditSubCategory' });
  const { data: translatedCategories } = useTranslatedData(categories, { modelName: 'AuditCategory' });

  const filteredSubCategories = translatedSubCategories.filter((sc) =>
    sc.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination calculations
  const totalItems = filteredSubCategories.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedSubCategories = filteredSubCategories.slice(startIndex, endIndex);

  const getCategoryName = (categoryId: string) => {
    return translatedCategories.find(c => c.id === categoryId)?.name || "-";
  };

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
          <span className="text-primary-700 font-medium">{t("Risk Sub-Categories")}</span>
        </nav>

        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Risk Sub-Categories")}</h1>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
              <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
            </div>
            <p className="text-sm text-slate-500 font-medium">{t("Loading sub-categories...")}</p>
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
        <span className="text-primary-700 font-medium">{t("Risk Sub-Categories")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Risk Sub-Categories")}</h1>
        {canCreate && (
          <Button size="sm" onClick={openAddDialog}>
            <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("New Sub-Category")}
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Search */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder={t("Search sub-categories...")}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="ltr:pl-10 rtl:pr-10 w-full sm:w-[300px] h-9 bg-slate-50 border-slate-200"
            />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pl-5 rtl:pr-5">{t("Sub-Category Name")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Category")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pr-5 rtl:pl-5 w-[100px]">{t("Action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedSubCategories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center text-sm text-slate-500">
                  {t("No sub-categories found")}
                </TableCell>
              </TableRow>
            ) : (
              paginatedSubCategories.map((sc) => (
                <TableRow key={sc.id} className="border-b border-slate-100 last:border-0">
                  <TableCell className="py-3 text-sm font-medium text-slate-800 ltr:pl-5 rtl:pr-5">{sc.name}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-600">{getCategoryName(sc.categoryId)}</TableCell>
                  <TableCell className="py-3 ltr:pr-5 rtl:pl-5">
                    <div className="flex items-center gap-0.5">
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-slate-600"
                          onClick={() => openEditDialog(sc)}
                          title={t("Edit")}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-semantic-error"
                          onClick={() => openDeleteDialog(sc)}
                          title={t("Delete")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <PaginationUI
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          itemsPerPage={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {editItem ? t("Edit Risk Sub-Category") : t("Add Risk Sub-Category")}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-4 sm:px-6 py-6 space-y-4">
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Category")} <span className="text-red-500">*</span></Label>
              <Select
                value={formData.categoryId}
                onValueChange={(value) => {
                  setFormData({ ...formData, categoryId: value });
                  setCategoryError("");
                }}
              >
                <SelectTrigger className={`mt-1.5 w-full bg-white ${categoryError ? "border-red-500" : ""}`}>
                  <SelectValue placeholder={t("Select category")} />
                </SelectTrigger>
                <SelectContent className="bg-white" position="popper" sideOffset={4}>
                  {translatedCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {categoryError && <p className="text-sm text-red-500 mt-1">{categoryError}</p>}
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Sub-Category Name")} <span className="text-red-500">*</span></Label>
              <Input
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  setFormError("");
                }}
                placeholder={t("Enter sub-category name")}
                className={`mt-1.5 w-full bg-white ${formError ? "border-red-500" : ""}`}
              />
              {formError && <p className="text-sm text-red-500 mt-1">{formError}</p>}
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex ltr:justify-end rtl:justify-start gap-2 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            {(!editItem || canEdit) && (
              <Button onClick={handleSave} disabled={saving}>
                {saving ? t("Saving...") : t("Save")}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[95vw] sm:max-w-[400px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          <AlertDialogHeader className="px-4 sm:px-6 py-5 border-b border-slate-100">
            <AlertDialogTitle className="text-lg font-semibold text-slate-800">{t("Confirm Delete")}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500 mt-1">
              {t("Are you sure you want to delete")} &quot;{itemToDelete?.name}&quot;? {t("This action cannot be undone.")}
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
