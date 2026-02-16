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
import { isValidName, isValidNumber } from "@/lib/validations";

interface Periodicity {
  id: string;
  interval: string;
  months: number;
  createdAt: string;
  updatedAt: string;
}

export default function PeriodicityPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { toast } = useToast();
  const { canView: canViewDashboard } = usePermissions('audit.dashboard');
  const [items, setItems] = useState<Periodicity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Periodicity | null>(null);
  const [formData, setFormData] = useState({ interval: "", months: 1 });
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({ interval: "", months: "" });

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Periodicity | null>(null);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await fetch("/api/internal-audit/periodicity");
      if (response.ok) {
        const data = await response.json();
        setItems(data);
      }
    } catch (error) {
      console.error("Failed to fetch periodicities:", error);
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = () => {
    setEditItem(null);
    setFormData({ interval: "", months: 1 });
    setFormErrors({ interval: "", months: "" });
    setDialogOpen(true);
  };

  const openEditDialog = (item: Periodicity) => {
    setEditItem(item);
    setFormData({ interval: item.interval, months: item.months });
    setFormErrors({ interval: "", months: "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    // Clear all errors first
    setFormErrors({ interval: "", months: "" });

    // Validate fields
    let hasError = false;
    const newErrors = { interval: "", months: "" };

    if (!formData.interval.trim()) {
      newErrors.interval = t("Interval is required");
      hasError = true;
    } else if (!isValidName(formData.interval)) {
      newErrors.interval = t("Only letters, numbers, spaces, and hyphens are allowed");
      hasError = true;
    }
    if (!formData.months || Number(formData.months) < 1) {
      newErrors.months = t("Months must be at least 1");
      hasError = true;
    } else if (!isValidNumber(String(formData.months))) {
      newErrors.months = t("Please enter a valid number");
      hasError = true;
    }

    if (hasError) {
      setFormErrors(newErrors);
      return;
    }

    setSaving(true);
    try {
      const url = editItem
        ? `/api/internal-audit/periodicity/${editItem.id}`
        : "/api/internal-audit/periodicity";
      const method = editItem ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interval: formData.interval,
          months: Number(formData.months) || 1
        }),
      });

      if (response.ok) {
        setDialogOpen(false);
        fetchItems();
        toast({
          title: t("Success"),
          description: editItem ? t("Periodicity updated successfully") : t("Periodicity created successfully"),
        });
      } else {
        toast({
          title: t("Error"),
          description: t("Failed to save periodicity"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to save:", error);
      toast({
        title: t("Error"),
        description: t("Failed to save periodicity"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDialog = (item: Periodicity) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
      const response = await fetch(`/api/internal-audit/periodicity/${itemToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchItems();
        toast({
          title: t("Success"),
          description: t("Periodicity deleted successfully"),
        });
      } else {
        toast({
          title: t("Error"),
          description: t("Failed to delete periodicity"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to delete:", error);
      toast({
        title: t("Error"),
        description: t("Failed to delete periodicity"),
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const filteredItems = items.filter((item) =>
    item.interval.toLowerCase().includes(searchTerm.toLowerCase())
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
      <div className="space-y-4 sm:space-y-6">
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
          <span className="text-primary-700 font-medium">{t("Periodicity")}</span>
        </nav>

        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Periodicity")}</h1>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
              <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
            </div>
            <p className="text-sm text-slate-500 font-medium">{t("Loading periodicities...")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
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
        <span className="text-primary-700 font-medium">{t("Periodicity")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Periodicity")}</h1>
        <Button size="sm" onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-2" />
          {t("New Periodicity")}
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Search */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder={t("Search periodicity...")}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10 w-full sm:w-[300px] h-9 bg-slate-50 border-slate-200"
            />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pl-5">{t("Interval")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Months")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-5 w-[100px]">{t("Action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center text-sm text-slate-500">
                  {t("No periodicity found")}
                </TableCell>
              </TableRow>
            ) : (
              paginatedItems.map((item) => (
                <TableRow key={item.id} className="border-b border-slate-100 last:border-0">
                  <TableCell className="py-3 text-sm font-medium text-slate-800 pl-5">{item.interval}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-600">{item.months}</TableCell>
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
                {editItem ? t("Edit Periodicity") : t("Add Periodicity")}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-4 sm:px-6 py-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Interval")} <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.interval}
                  onChange={(e) => {
                    setFormData({ ...formData, interval: e.target.value });
                    setFormErrors({ ...formErrors, interval: "" });
                  }}
                  placeholder={t("Enter interval (e.g., Monthly, Quarterly)")}
                  className={`mt-1.5 w-full bg-white ${formErrors.interval ? "border-red-500" : ""}`}
                  
                />
                {formErrors.interval && <p className="text-sm text-red-500 mt-1">{formErrors.interval}</p>}
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Months")} <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  min={1}
                  value={formData.months}
                  onChange={(e) => {
                    setFormData({ ...formData, months: parseInt(e.target.value) || 1 });
                    setFormErrors({ ...formErrors, months: "" });
                  }}
                  placeholder={t("Enter number of months")}
                  className={`mt-1.5 w-full bg-white ${formErrors.months ? "border-red-500" : ""}`}
                />
                {formErrors.months && <p className="text-sm text-red-500 mt-1">{formErrors.months}</p>}
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-end gap-2 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
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
        <AlertDialogContent className="max-w-[95vw] sm:max-w-[400px] p-0 gap-0">
          <AlertDialogHeader className="px-4 sm:px-6 py-5 border-b border-slate-100">
            <AlertDialogTitle className="text-lg font-semibold text-slate-800">{t("Confirm Delete")}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500 mt-1">
              {t("Are you sure you want to delete")} &quot;{itemToDelete?.interval}&quot;? {t("This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
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
