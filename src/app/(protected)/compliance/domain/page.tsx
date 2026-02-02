"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Menu,
} from "lucide-react";

interface Domain {
  id: string;
  code?: string;
  name: string;
  description?: string;
}

export default function DomainPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const itemsPerPage = 20;
  const [nextCode, setNextCode] = useState<string>("");

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState({
    code: true,
    name: true,
  });

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
      const params = new URLSearchParams();
      params.append("page", currentPage.toString());
      params.append("limit", itemsPerPage.toString());

      const response = await fetch(`/api/control-domains?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        // Handle both array and paginated response formats
        if (Array.isArray(data)) {
          setDomains(data);
          setTotal(data.length);
          setTotalPages(Math.ceil(data.length / itemsPerPage));
        } else {
          setDomains(data.data || []);
          setTotal(data.pagination?.total || 0);
          setTotalPages(data.pagination?.totalPages || 1);
        }
      }
    } catch (error) {
      console.error("Error fetching domains:", error);
    } finally {
      setLoading(false);
    }
  }, [currentPage]);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  const handleOpenCreate = async () => {
    setEditingDomain(null);
    setFormData({ code: "", name: "", description: "" });
    // Fetch next code preview
    try {
      const response = await fetch("/api/control-domains/next-code");
      if (response.ok) {
        const data = await response.json();
        setNextCode(data.nextCode);
      }
    } catch {
      // Use fallback if API doesn't exist yet
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
    // Validate name is not empty
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
        // Update - only send name and description (code is read-only)
        const response = await fetch("/api/control-domains/" + editingDomain.id, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formData.name.trim(), description: formData.description }),
        });
        if (response.ok) {
          toast({
            title: t("Success"),
            description: t("Domain updated successfully"),
          });
          fetchDomains();
          setIsDialogOpen(false);
        } else {
          const errorData = await response.json();
          toast({
            title: t("Error"),
            description: errorData.error || t("Failed to update domain"),
            variant: "destructive",
          });
        }
      } else {
        // Create - code is auto-generated by API
        const response = await fetch("/api/control-domains", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formData.name.trim(), description: formData.description }),
        });
        if (response.ok) {
          toast({
            title: t("Success"),
            description: t("Domain created successfully"),
          });
          fetchDomains();
          setIsDialogOpen(false);
        } else {
          const errorData = await response.json();
          toast({
            title: t("Error"),
            description: errorData.error || t("Failed to create domain"),
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error("Error saving domain:", error);
      toast({
        title: t("Error"),
        description: t("An unexpected error occurred"),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!domainToDelete) return;
    try {
      const response = await fetch("/api/control-domains/" + domainToDelete.id, {
        method: "DELETE",
      });
      if (response.ok) {
        toast({
          title: t("Success"),
          description: t("Domain deleted successfully"),
        });
        fetchDomains();
      } else {
        const errorData = await response.json();
        toast({
          title: t("Error"),
          description: errorData.error || t("Failed to delete domain"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error deleting domain:", error);
      toast({
        title: t("Error"),
        description: t("An unexpected error occurred"),
        variant: "destructive",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setDomainToDelete(null);
    }
  };

  // Pagination helpers
  const startItem = total > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endItem = Math.min(currentPage * itemsPerPage, total);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("Domain")}</h1>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {t("New Domain")}
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      ) : (
        <>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  {visibleColumns.code && <TableHead>{t("Domain Code")}</TableHead>}
                  {visibleColumns.name && <TableHead>{t("Domain Name")}</TableHead>}
                  <TableHead>{t("Action")}</TableHead>
                  <TableHead className="w-[50px]">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Menu className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuCheckboxItem
                          checked={visibleColumns.code}
                          onCheckedChange={(checked) => setVisibleColumns({ ...visibleColumns, code: checked })}
                        >
                          {t("Domain Code")}
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                          checked={visibleColumns.name}
                          onCheckedChange={(checked) => setVisibleColumns({ ...visibleColumns, name: checked })}
                        >
                          {t("Domain Name")}
                        </DropdownMenuCheckboxItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {domains.map((domain) => (
                  <TableRow key={domain.id}>
                    {visibleColumns.code && <TableCell>{domain.code || ""}</TableCell>}
                    {visibleColumns.name && <TableCell>{domain.name}</TableCell>}
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(domain)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDomainToDelete(domain);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))}
                {domains.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      {t("No domains found")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(1)}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground px-4">
              {t("Currently showing")} {startItem} {t("to")} {endItem} {t("of")} {total}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDomain ? t("Edit Domain") : t("New Domain")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="code">{t("Domain Code")}</Label>
              <Input
                id="code"
                value={editingDomain ? formData.code : nextCode}
                disabled
                className="bg-gray-100 cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {editingDomain ? t("Auto-generated code cannot be changed") : t("Will be auto-generated on save")}
              </p>
            </div>
            <div>
              <Label htmlFor="name">{t("Domain Name")} *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t("Enter domain name")}
              />
            </div>
            <div>
              <Label htmlFor="description">{t("Description")}</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t("Enter description")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleSave} disabled={!formData.name}>
              {editingDomain ? t("Update") : t("Create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete Domain")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to delete")} &quot;{domainToDelete?.name}&quot;? {t("This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
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
