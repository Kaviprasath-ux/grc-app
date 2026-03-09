"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/usePermissions";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Search,
  Home,
  FileText,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useTranslatedData } from "@/hooks/useTranslatedData";
import { triggerTranslation } from "@/hooks/useTranslatedData";

interface Framework {
  id: string;
  code?: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  frameworkId: string;
}

interface Requirement {
  id: string;
  code: string;
  name: string;
  description: string | null;
  requirementType: string;
  chapterType: string | null;
  sortOrder: number;
  level: number;
  frameworkId: string;
  categoryId: string | null;
  applicability: string | null;
  justification: string | null;
  implementationStatus: string | null;
  controlCompliance: string | null;
  framework?: { id: string; name: string; code?: string };
  category?: { id: string; name: string } | null;
  _count?: {
    evidences: number;
    policies: number;
    exceptions: number;
    complianceExceptions: number;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const ITEMS_PER_PAGE = 20;

const requirementTypes = ["Mandatory", "Optional", "Recommended"];

const typeColors: Record<string, string> = {
  Mandatory: "bg-red-100 text-red-700",
  Optional: "bg-blue-100 text-blue-700",
  Recommended: "bg-amber-100 text-amber-700",
};

export default function QPostRequirementsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { toast } = useToast();
  const { canView, canCreate, canDelete, isLoading: permissionsLoading } = usePermissions("qpost-compliance.controls");

  // Data state
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: ITEMS_PER_PAGE,
    total: 0,
    totalPages: 0,
  });

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterFrameworkId, setFilterFrameworkId] = useState<string>("all");
  const [filterCategoryId, setFilterCategoryId] = useState<string>("all");
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Create dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    requirementType: "Mandatory",
    frameworkId: "",
    categoryId: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [requirementToDelete, setRequirementToDelete] = useState<Requirement | null>(null);

  // Translation
  const { data: translatedRequirements } = useTranslatedData(requirements, { modelName: "QPostRequirement" });
  const { data: translatedFrameworks } = useTranslatedData(frameworks, { modelName: "QPostFramework" });

  // Fetch frameworks for filter and create dialog
  const fetchFrameworks = useCallback(async () => {
    try {
      const res = await fetch("/api/qpost-compliance/frameworks");
      if (res.ok) {
        const data = await res.json();
        setFrameworks(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching frameworks:", error);
    }
  }, []);

  // Fetch categories for the selected framework
  const fetchCategories = useCallback(async (frameworkId: string) => {
    if (!frameworkId || frameworkId === "all") {
      setCategories([]);
      return;
    }
    try {
      const res = await fetch(`/api/qpost-compliance/frameworks/${frameworkId}`);
      if (res.ok) {
        const data = await res.json();
        setCategories(data.requirementCategories || []);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  }, []);

  // Fetch requirements with filters and pagination
  const fetchRequirements = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(ITEMS_PER_PAGE));
      if (searchTerm) params.set("search", searchTerm);
      if (filterFrameworkId && filterFrameworkId !== "all") params.set("frameworkId", filterFrameworkId);
      if (filterCategoryId && filterCategoryId !== "all") params.set("categoryId", filterCategoryId);

      const res = await fetch(`/api/qpost-compliance/requirements?${params.toString()}`);
      if (res.ok) {
        const result = await res.json();
        setRequirements(result.data || []);
        setPagination(result.pagination || { page: 1, limit: ITEMS_PER_PAGE, total: 0, totalPages: 0 });
      }
    } catch (error) {
      console.error("Error fetching requirements:", error);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, filterFrameworkId, filterCategoryId]);

  useEffect(() => {
    fetchFrameworks();
  }, [fetchFrameworks]);

  useEffect(() => {
    fetchRequirements(1);
  }, [fetchRequirements]);

  // Fetch categories when filter framework changes
  useEffect(() => {
    fetchCategories(filterFrameworkId);
    setFilterCategoryId("all");
  }, [filterFrameworkId, fetchCategories]);

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (searchTimeout) clearTimeout(searchTimeout);
    setSearchTimeout(
      setTimeout(() => {
        fetchRequirements(1);
      }, 400)
    );
  };

  // Pagination handlers
  const goToPage = (page: number) => {
    if (page >= 1 && page <= pagination.totalPages) {
      fetchRequirements(page);
    }
  };

  // Create dialog helpers
  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      description: "",
      requirementType: "Mandatory",
      frameworkId: "",
      categoryId: "",
    });
    setFormErrors({});
  };

  const openCreateDialog = () => {
    resetForm();
    setCreateDialogOpen(true);
  };

  // Categories for the create dialog based on selected framework
  const [dialogCategories, setDialogCategories] = useState<Category[]>([]);

  useEffect(() => {
    if (formData.frameworkId) {
      fetch(`/api/qpost-compliance/frameworks/${formData.frameworkId}`)
        .then((res) => res.json())
        .then((data) => setDialogCategories(data.requirementCategories || []))
        .catch(() => setDialogCategories([]));
    } else {
      setDialogCategories([]);
    }
  }, [formData.frameworkId]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.code.trim()) errors.code = t("Code is required");
    if (!formData.name.trim()) errors.name = t("Name is required");
    if (!formData.frameworkId) errors.frameworkId = t("Framework is required");
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/qpost-compliance/requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: formData.code.trim(),
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          requirementType: formData.requirementType,
          frameworkId: formData.frameworkId,
          categoryId: formData.categoryId || null,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        toast({ title: t("Success"), description: t("Requirement created successfully") });
        triggerTranslation("QPostRequirement", created.id, {
          name: created.name,
          description: created.description,
        });
        setCreateDialogOpen(false);
        resetForm();
        fetchRequirements(1);
      } else {
        const err = await res.json();
        if (res.status === 409) {
          setFormErrors({ code: t("Requirement with this code already exists") });
        } else {
          toast({ title: t("Error"), description: err.error || t("Failed to create requirement"), variant: "destructive" });
        }
      }
    } catch (error) {
      console.error("Error creating requirement:", error);
      toast({ title: t("Error"), description: t("Failed to create requirement"), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete handler
  const handleDelete = async () => {
    if (!requirementToDelete) return;
    try {
      const res = await fetch(`/api/qpost-compliance/requirements/${requirementToDelete.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast({ title: t("Success"), description: t("Requirement deleted successfully") });
        fetchRequirements(pagination.page);
      } else {
        toast({ title: t("Error"), description: t("Failed to delete requirement"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error deleting requirement:", error);
      toast({ title: t("Error"), description: t("Failed to delete requirement"), variant: "destructive" });
    } finally {
      setDeleteDialogOpen(false);
      setRequirementToDelete(null);
    }
  };

  // Framework name lookup helper
  const getFrameworkName = useCallback(
    (id: string) => translatedFrameworks.find((f) => f.id === id)?.name || "",
    [translatedFrameworks]
  );

  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">{t("You do not have permission to view this page")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          <Home className="h-4 w-4" />
        </Link>
        <span>/</span>
        <span>{t("QPost Compliance")}</span>
        <span>/</span>
        <span className="text-foreground font-medium">{t("Requirements")}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("Requirements")}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("Manage compliance requirements across frameworks")}
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("Add Requirement")}
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("Search requirements...")}
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="ltr:pl-9 rtl:pr-9"
          />
        </div>
        <Select value={filterFrameworkId} onValueChange={setFilterFrameworkId}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder={t("All Frameworks")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("All Frameworks")}</SelectItem>
            {translatedFrameworks.map((fw) => (
              <SelectItem key={fw.id} value={fw.id}>
                {fw.code ? `${fw.code} - ${fw.name}` : fw.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {categories.length > 0 && (
          <Select value={filterCategoryId} onValueChange={setFilterCategoryId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder={t("All Categories")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("All Categories")}</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">{t("Code")}</TableHead>
              <TableHead>{t("Name")}</TableHead>
              <TableHead>{t("Framework")}</TableHead>
              <TableHead>{t("Category")}</TableHead>
              <TableHead className="w-[120px]">{t("Type")}</TableHead>
              <TableHead className="w-[90px] text-center">{t("Evidences")}</TableHead>
              <TableHead className="w-[90px] text-center">{t("Policies")}</TableHead>
              <TableHead className="w-[90px] text-center">{t("Exceptions")}</TableHead>
              {canDelete && <TableHead className="w-[60px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={canDelete ? 9 : 8} className="text-center py-12">
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                    <span className="text-muted-foreground">{t("Loading...")}</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : translatedRequirements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canDelete ? 9 : 8} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <FileText className="h-8 w-8" />
                    <p>{t("No requirements found")}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              translatedRequirements.map((req) => (
                <TableRow
                  key={req.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/qpost-compliance/requirements/${req.id}`)}
                >
                  <TableCell className="font-mono text-sm">{req.code}</TableCell>
                  <TableCell className="font-medium max-w-[300px] truncate">
                    {req.name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {req.framework?.name || getFrameworkName(req.frameworkId) || "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {req.category?.name || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={typeColors[req.requirementType] || ""}>
                      {t(req.requirementType)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">{req._count?.evidences ?? 0}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">{req._count?.policies ?? 0}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">
                        {(req._count?.exceptions ?? 0) + (req._count?.complianceExceptions ?? 0)}
                      </span>
                    </div>
                  </TableCell>
                  {canDelete && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRequirementToDelete(req);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("Showing")} {(pagination.page - 1) * pagination.limit + 1}-
            {Math.min(pagination.page * pagination.limit, pagination.total)} {t("of")}{" "}
            {pagination.total} {t("requirements")}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={pagination.page <= 1}
              onClick={() => goToPage(pagination.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              {t("Page")} {pagination.page} {t("of")} {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => goToPage(pagination.page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Add Requirement")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Code */}
            <div className="space-y-1.5">
              <Label>{t("Code")} *</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder={t("e.g. REQ-001")}
              />
              {formErrors.code && <p className="text-sm text-destructive">{formErrors.code}</p>}
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label>{t("Name")} *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t("Requirement name")}
              />
              {formErrors.name && <p className="text-sm text-destructive">{formErrors.name}</p>}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>{t("Description")}</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t("Requirement description")}
                rows={3}
              />
            </div>

            {/* Requirement Type */}
            <div className="space-y-1.5">
              <Label>{t("Requirement Type")}</Label>
              <Select
                value={formData.requirementType}
                onValueChange={(v) => setFormData({ ...formData, requirementType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {requirementTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Framework */}
            <div className="space-y-1.5">
              <Label>{t("Framework")} *</Label>
              <Select
                value={formData.frameworkId}
                onValueChange={(v) => setFormData({ ...formData, frameworkId: v, categoryId: "" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("Select framework")} />
                </SelectTrigger>
                <SelectContent>
                  {translatedFrameworks.map((fw) => (
                    <SelectItem key={fw.id} value={fw.id}>
                      {fw.code ? `${fw.code} - ${fw.name}` : fw.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.frameworkId && (
                <p className="text-sm text-destructive">{formErrors.frameworkId}</p>
              )}
            </div>

            {/* Category */}
            {dialogCategories.length > 0 && (
              <div className="space-y-1.5">
                <Label>{t("Category")}</Label>
                <Select
                  value={formData.categoryId}
                  onValueChange={(v) => setFormData({ ...formData, categoryId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("Select category")} />
                  </SelectTrigger>
                  <SelectContent>
                    {dialogCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={isSaving}>
                {t("Cancel")}
              </Button>
              <Button onClick={handleCreate} disabled={isSaving}>
                {isSaving ? t("Saving...") : t("Create")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete Requirement")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to delete")} &quot;{requirementToDelete?.name}&quot;?{" "}
              {t("This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
