"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useHasRole } from "@/hooks/usePermissions";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
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
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Home,
  Search,
  Layers,
} from "lucide-react";
import Link from "next/link";

interface Domain {
  id: string;
  code?: string;
  name: string;
  description?: string;
}

export default function DomainPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const isGRCAdmin = useHasRole("GRCAdministrator");
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [nextCode, setNextCode] = useState<string>("");

  // Create/Edit dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState<Domain | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
  });

  // Delete dialog
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [domainToDelete, setDomainToDelete] = useState<Domain | null>(null);

  const fetchDomains = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/control-domains");
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setDomains(data);
        } else {
          setDomains(data.data || []);
        }
      }
    } catch (error) {
      console.error("Error fetching domains:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleOpenCreate = async () => {
    setEditingDomain(null);
    setFormData({ code: "", name: "", description: "" });
    try {
      const response = await fetch("/api/control-domains/next-code");
      if (response.ok) {
        const data = await response.json();
        setNextCode(data.nextCode);
      }
    } catch {
      const maxCode = domains.reduce((max, d) => {
        if (d.code) {
          const match = d.code.match(/^DOM-(\d+)$/);
          if (match) {
            const num = parseInt(match[1], 10);
            return num > max ? num : max;
          }
        }
        return max;
      }, 0);
      setNextCode("DOM-" + String(maxCode + 1).padStart(3, "0"));
    }
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (domain: Domain) => {
    setEditingDomain(domain);
    setFormData({
      code: domain.code || "",
      name: domain.name,
      description: domain.description || "",
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: t("Validation Error"),
        description: t("Domain Name is required"),
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingDomain) {
        const response = await fetch("/api/control-domains/" + editingDomain.id, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formData.name.trim(), description: formData.description }),
        });
        if (response.ok) {
          toast({ title: t("Success"), description: t("Domain updated successfully") });
          fetchDomains();
          setIsDialogOpen(false);
        } else {
          const errorData = await response.json();
          toast({ title: t("Error"), description: errorData.error || t("Failed to update domain"), variant: "destructive" });
        }
      } else {
        const response = await fetch("/api/control-domains", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formData.name.trim(), description: formData.description }),
        });
        if (response.ok) {
          toast({ title: t("Success"), description: t("Domain created successfully") });
          fetchDomains();
          setIsDialogOpen(false);
        } else {
          const errorData = await response.json();
          toast({ title: t("Error"), description: errorData.error || t("Failed to create domain"), variant: "destructive" });
        }
      }
    } catch (error) {
      console.error("Error saving domain:", error);
      toast({ title: t("Error"), description: t("An unexpected error occurred"), variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!domainToDelete) return;
    try {
      const response = await fetch("/api/control-domains/" + domainToDelete.id, {
        method: "DELETE",
      });
      if (response.ok) {
        toast({ title: t("Success"), description: t("Domain deleted successfully") });
        fetchDomains();
      } else {
        const errorData = await response.json();
        toast({ title: t("Error"), description: errorData.error || t("Failed to delete domain"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error deleting domain:", error);
      toast({ title: t("Error"), description: t("An unexpected error occurred"), variant: "destructive" });
    } finally {
      setIsDeleteDialogOpen(false);
      setDomainToDelete(null);
    }
  };

  // Filter and paginate
  const filteredDomains = domains.filter(
    (d) =>
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.code && d.code.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  const totalPages = Math.ceil(filteredDomains.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedDomains = filteredDomains.slice(startIndex, startIndex + itemsPerPage);

  if (loading) {
    return (
      <div className="space-y-6">
        <nav className="flex items-center gap-1.5 text-sm">
          {isGRCAdmin ? (
            <>
              <Link href="/grc" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
                <Home className="h-4 w-4" />
                <span>{t("GRC")}</span>
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
              <span className="text-slate-500">{t("Compliance")}</span>
            </>
          ) : (
            <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
              <Home className="h-4 w-4" />
              <span>{t("Compliance")}</span>
            </Link>
          )}
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-primary-700 font-medium">{t("Domain")}</span>
        </nav>
        <h1 className="text-2xl font-bold text-slate-800">{t("Domain")}</h1>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-center h-64">
            <div className="w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        {isGRCAdmin ? (
          <>
            <Link href="/grc" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
              <Home className="h-4 w-4" />
              <span>{t("GRC")}</span>
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
            <span className="text-slate-500">{t("Compliance")}</span>
          </>
        ) : (
          <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
            <Home className="h-4 w-4" />
            <span>{t("Compliance")}</span>
          </Link>
        )}
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Domain")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-800">{t("Domain")}</h1>

          {/* count badge */}
          {/* {filteredDomains.length > 0 && (
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {filteredDomains.length}
            </span>
          )} */}
        </div>
        <Button size="sm" onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t("New Domain")}
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Search */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={t("Search domains...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-[300px] ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
            />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ps-5">{t("Domain Code")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Domain Name")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Description")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pe-5 w-[100px]">{t("Actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedDomains.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-0">
                  <div className="py-16 text-center">
                    <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                      <Layers className="h-6 w-6 text-primary-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-600 mb-1">{t("No domains found")}</p>
                    <p className="text-xs text-slate-400">{t("Create a new domain to get started")}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedDomains.map((domain) => (
                <TableRow key={domain.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                  <TableCell className="py-3 ps-5 text-sm font-medium text-slate-800">{domain.code || "-"}</TableCell>
                  <TableCell className="py-3 text-sm font-medium text-slate-800">{domain.name}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-600 max-w-[300px] truncate">{domain.description || "-"}</TableCell>
                  <TableCell className="py-3 pe-5">
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                        onClick={() => handleOpenEdit(domain)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-semantic-error hover:bg-red-50"
                        onClick={() => {
                          setDomainToDelete(domain);
                          setIsDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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
            {filteredDomains.length > 0
              ? `${startIndex + 1} ${t("to")} ${Math.min(startIndex + itemsPerPage, filteredDomains.length)} ${t("of")} ${filteredDomains.length}`
              : t("No domains")}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400 hover:text-slate-600"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400 hover:text-slate-600"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <DialogTitle className="text-base font-semibold text-slate-800">
              {editingDomain ? t("Edit Domain") : t("Create New Domain")}
            </DialogTitle>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div>
              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Domain Code")}</Label>
              <Input
                value={editingDomain ? formData.code : nextCode}
                disabled
                className="mt-1.5 w-full bg-slate-50 cursor-not-allowed"
              />
              <p className="text-xs text-slate-400 mt-1">
                {editingDomain ? t("Auto-generated code cannot be changed") : t("Will be auto-generated on save")}
              </p>
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                {t("Domain Name")} <span className="text-red-500">*</span>
              </Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t("Enter domain name")}
                className="mt-1.5 w-full bg-white"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Description")}</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t("Enter description")}
                className="mt-1.5 w-full bg-white min-h-[100px]"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleSave} disabled={!formData.name}>
              {editingDomain ? t("Update") : t("Create")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="p-0 gap-0 overflow-hidden">
          <AlertDialogHeader className="px-6 py-4">
            <AlertDialogTitle className="text-base font-semibold text-slate-800">{t("Delete Domain")}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500 mt-1">
              {t("Are you sure you want to delete")} &quot;{domainToDelete?.name}&quot;? {t("This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <AlertDialogCancel onClick={() => setDomainToDelete(null)}>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              {t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
