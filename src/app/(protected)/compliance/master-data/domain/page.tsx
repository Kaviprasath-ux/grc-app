"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { ArrowLeft, Plus, Pencil, Trash2, Download, Upload, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Home } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

interface ControlDomain {
  id: string;
  code: string | null;
  name: string;
}

export default function DomainMasterDataPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [domains, setDomains] = useState<ControlDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<ControlDomain | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    code: "",
    name: "",
  });

  const fetchDomains = useCallback(async () => {
    try {
      const response = await fetch("/api/control-domains");
      if (response.ok) {
        const data = await response.json();
        setDomains(data);
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

  const handleCreate = async () => {
    try {
      const response = await fetch("/api/control-domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setCreateDialogOpen(false);
        resetForm();
        fetchDomains();
      }
    } catch (error) {
      console.error("Error creating domain:", error);
    }
  };

  const handleEdit = async () => {
    if (!selectedDomain) return;
    try {
      const response = await fetch(`/api/control-domains/${selectedDomain.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setEditDialogOpen(false);
        setSelectedDomain(null);
        resetForm();
        fetchDomains();
      }
    } catch (error) {
      console.error("Error updating domain:", error);
    }
  };

  const handleDelete = async () => {
    if (!selectedDomain) return;
    try {
      const response = await fetch(`/api/control-domains/${selectedDomain.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setDeleteDialogOpen(false);
        setSelectedDomain(null);
        fetchDomains();
      }
    } catch (error) {
      console.error("Error deleting domain:", error);
    }
  };

  const handleDeleteAll = () => {
    setDeleteAllDialogOpen(true);
  };

  const confirmDeleteAll = async () => {
    try {
      const response = await fetch("/api/control-domains/delete-all", {
        method: "DELETE",
      });

      if (response.ok) {
        fetchDomains();
      }
    } catch (error) {
      console.error("Error deleting all domains:", error);
    } finally {
      setDeleteAllDialogOpen(false);
    }
  };

  const openEditDialog = (domain: ControlDomain) => {
    setSelectedDomain(domain);
    setFormData({
      code: domain.code || "",
      name: domain.name,
    });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (domain: ControlDomain) => {
    setSelectedDomain(domain);
    setDeleteDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
    });
  };

  const handleExport = () => {
    const csv = [
      ["Domain Code", "Domain Name"],
      ...domains.map((d) => [d.code || "", d.name]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "domains.csv";
    a.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleDownloadTemplate = () => {
    const template = "Domain Code,Domain Name\n";
    const blob = new Blob([template], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "domain_template.csv";
    a.click();
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setImporting(true);
    try {
      const text = await selectedFile.text();
      const lines = text.split("\n").slice(1); // Skip header

      for (const line of lines) {
        const [code, name] = line.split(",").map((s) => s.replace(/"/g, "").trim());
        if (name) {
          await fetch("/api/control-domains", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, name }),
          });
        }
      }
      setImportDialogOpen(false);
      setSelectedFile(null);
      fetchDomains();
    } catch (error) {
      console.error("Error importing domains:", error);
    } finally {
      setImporting(false);
    }
  };

  const filteredDomains = domains.filter(
    (d) =>
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.code && d.code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Pagination calculations
  const totalPages = Math.ceil(filteredDomains.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedDomains = filteredDomains.slice(startIndex, startIndex + itemsPerPage);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 rounded-full border-4 border-primary/30"></div>
          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Compliance")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <Link href="/compliance/master-data" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Master Data")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Domain")}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800">{t("Domain")}</h1>
      </div>

      {/* Search and Actions - same row */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder={t("Search domains...")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-[300px] bg-white border-slate-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDeleteAll}>
            <Trash2 className="h-4 w-4 mr-2" />
            {t("Delete All")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            {t("Import")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            {t("Export")}
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                {t("New Domain")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
              <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
                <DialogTitle className="text-lg font-semibold text-slate-800">{t("Create New Domain")}</DialogTitle>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Domain Code")}</Label>
                  <Input
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value })
                    }
                    placeholder={t("e.g., GOV")}
                    className="mt-1.5 w-full bg-white"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    {t("Domain Name")} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder={t("e.g., Governance")}
                    className="mt-1.5 w-full bg-white"
                  />
                </div>
              </div>
              <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCreateDialogOpen(false);
                    resetForm();
                  }}
                >
                  {t("Cancel")}
                </Button>
                <Button size="sm" onClick={handleCreate} disabled={!formData.name}>
                  {t("Create")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-100 bg-slate-50/50">
              <TableHead className="text-xs font-semibold text-slate-600 h-12 pl-4">{t("Domain Code")}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12">{t("Domain Name")}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12 pr-4 w-[100px]">{t("Action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedDomains.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-12">
                  <p className="text-slate-500">{t("No domains found")}</p>
                </TableCell>
              </TableRow>
            ) : (
              paginatedDomains.map((domain) => (
                <TableRow key={domain.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <TableCell className="py-3 text-sm text-slate-600 pl-4">{domain.code || "-"}</TableCell>
                  <TableCell className="py-3 text-sm font-medium text-slate-800">{domain.name}</TableCell>
                  <TableCell className="py-3 text-sm pr-4">
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-slate-600"
                        onClick={() => openEditDialog(domain)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-semantic-error"
                        onClick={() => openDeleteDialog(domain)}
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
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
          <p className="text-sm text-slate-500">
            {t("Showing")} {filteredDomains.length === 0 ? 0 : startIndex + 1} {t("to")}{" "}
            {Math.min(startIndex + itemsPerPage, filteredDomains.length)} {t("of")}{" "}
            {filteredDomains.length}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-slate-600 px-2">
              {t("Page")} {currentPage} {t("of")} {totalPages || 1}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage >= totalPages}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogTitle className="text-lg font-semibold text-slate-800">{t("Edit Domain")}</DialogTitle>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Domain Code")}</Label>
              <Input
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value })
                }
                className="mt-1.5 w-full bg-white"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">
                {t("Domain Name")} <span className="text-red-500">*</span>
              </Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="mt-1.5 w-full bg-white"
              />
            </div>
          </div>
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditDialogOpen(false);
                setSelectedDomain(null);
                resetForm();
              }}
            >
              {t("Cancel")}
            </Button>
            <Button size="sm" onClick={handleEdit} disabled={!formData.name}>
              {t("Save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="p-0 gap-0">
          <AlertDialogHeader className="px-6 py-5">
            <AlertDialogTitle className="text-lg font-semibold text-slate-800">{t("Delete Domain")}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500 mt-1">
              {t("Are you sure you want to delete")} &quot;{selectedDomain?.name}&quot;? {t("This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="px-6 py-4 bg-white rounded-b-lg">
            <AlertDialogCancel className="h-9">{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 h-9"
            >
              {t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Confirmation */}
      <AlertDialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
        <AlertDialogContent className="p-0 gap-0">
          <AlertDialogHeader className="px-6 py-5">
            <AlertDialogTitle className="text-lg font-semibold text-slate-800">{t("Delete All Domains")}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500 mt-1">
              {t("Are you sure you want to delete all domains? This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="px-6 py-4 bg-white rounded-b-lg">
            <AlertDialogCancel className="h-9">{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteAll}
              className="bg-red-600 hover:bg-red-700 h-9"
            >
              {t("Delete All")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={(open) => {
        setImportDialogOpen(open);
        if (!open) setSelectedFile(null);
      }}>
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogTitle className="text-lg font-semibold text-slate-800">{t("Import Domain")}</DialogTitle>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("File")}</Label>
              <div className="flex gap-2 mt-1.5">
                <Input
                  type="text"
                  value={selectedFile?.name || ""}
                  readOnly
                  placeholder={t("Choose a file...")}
                  className="flex-1 bg-white min-w-0"
                />
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-shrink-0"
                >
                  {t("Browse...")}
                </Button>
              </div>
            </div>
          </div>
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
            >
              <Download className="h-4 w-4 mr-2" />
              {t("Download Template")}
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setImportDialogOpen(false);
                  setSelectedFile(null);
                }}
              >
                {t("Cancel")}
              </Button>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={!selectedFile || importing}
              >
                {importing ? (
                  <>
                    <div className="relative h-4 w-4 mr-2">
                      <div className="absolute inset-0 rounded-full border-2 border-white/30"></div>
                      <div className="absolute inset-0 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                    </div>
                    {t("Importing...")}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    {t("Import")}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
