"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Plus,
  Pencil,
  Trash2,
  Download,
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  Upload,
  Home,
} from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

interface Template {
  id: string;
  name: string;
  governanceType: string;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  filePath: string;
  uploadedBy: { id: string; fullName: string } | null;
  createdAt: string;
  updatedAt: string;
}

const governanceTypeColors: Record<string, string> = {
  Policy: "bg-primary-100 text-primary-700",
  Standard: "bg-info-light text-info-dark",
  Procedure: "bg-success-light text-success-dark",
};

export default function GovernanceTemplatesPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState("");

  const [formData, setFormData] = useState({
    governanceType: "",
    file: null as File | null,
  });

  const fetchTemplates = useCallback(async () => {
    try {
      const response = await fetch("/api/governance-templates");
      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file && !file.name.toLowerCase().endsWith(".docx")) {
      setFileError(t("Only .docx files are supported for governance templates"));
      e.target.value = "";
      return;
    }
    setFileError("");
    setFormData({ ...formData, file });
  };

  const handleFileDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleFileDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const file = files[0];
      if (!file.name.toLowerCase().endsWith(".docx")) {
        setFileError(t("Only .docx files are supported for governance templates"));
        return;
      }
      setFileError("");
      setFormData({ ...formData, file });
    }
  };

  const handleRemoveFile = () => {
    setFormData({ ...formData, file: null });
    setFileError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (editFileInputRef.current) {
      editFileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const handleCreate = async () => {
    if (!formData.file || !formData.governanceType) return;

    try {
      const form = new FormData();
      form.append("file", formData.file);
      form.append("governanceType", formData.governanceType);

      const response = await fetch("/api/governance-templates", {
        method: "POST",
        body: form,
      });

      if (response.ok) {
        setCreateDialogOpen(false);
        resetForm();
        fetchTemplates();
      }
    } catch (error) {
      console.error("Error creating template:", error);
    }
  };

  const handleEdit = async () => {
    if (!selectedTemplate || !formData.governanceType) return;

    try {
      const response = await fetch(`/api/governance-templates/${selectedTemplate.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ governanceType: formData.governanceType }),
      });

      if (response.ok) {
        setEditDialogOpen(false);
        setSelectedTemplate(null);
        resetForm();
        fetchTemplates();
      }
    } catch (error) {
      console.error("Error updating template:", error);
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplate) return;

    try {
      const response = await fetch(`/api/governance-templates/${selectedTemplate.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setDeleteDialogOpen(false);
        setSelectedTemplate(null);
        fetchTemplates();
      }
    } catch (error) {
      console.error("Error deleting template:", error);
    }
  };

  const openEditDialog = (template: Template) => {
    setSelectedTemplate(template);
    setFormData({
      governanceType: template.governanceType,
      file: null,
    });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (template: Template) => {
    setSelectedTemplate(template);
    setDeleteDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      governanceType: "",
      file: null,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (editFileInputRef.current) {
      editFileInputRef.current.value = "";
    }
  };

  const handleView = (template: Template) => {
    window.open(template.filePath, "_blank");
  };

  const handleExport = () => {
    const csv = [
      ["Template Name", "Governance Type", "Uploaded By", "Created At"],
      ...templates.map((t) => [
        t.name,
        t.governanceType,
        t.uploadedBy || "System",
        new Date(t.createdAt).toLocaleDateString(),
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "governance-templates.csv";
    a.click();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.governanceType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination calculations
  const totalPages = Math.ceil(filteredTemplates.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTemplates = filteredTemplates.slice(startIndex, startIndex + itemsPerPage);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  if (loading) {
    return (
      <div className="space-y-6">
        <nav className="flex items-center gap-1.5 text-sm">
          <Link href="" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
            <Home className="h-4 w-4" />
            <span>{t("Compliance")}</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-slate-500">{t("Master Data")}</span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-primary-700 font-medium">{t("Governance Templates")}</span>
        </nav>
        <h1 className="text-2xl font-bold text-slate-800">{t("Governance Templates")}</h1>
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
        <Link href="" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Compliance")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/compliance/master-data" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Master Data")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Governance Templates")}</span>
      </nav>

      {/* Header */}
      <h1 className="text-2xl font-bold text-slate-800">{t("Governance Templates")}</h1>

      {/* Action Buttons above card */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t("Export")}
        </Button>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("New Template")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
            <div className="flex-shrink-0 px-6 py-4 border-b border-slate-100">
              <DialogTitle className="text-base font-semibold text-slate-800">
                {t("Add Governance Template")}
              </DialogTitle>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">
                    {t("Governance Type")} <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.governanceType}
                    onValueChange={(value) =>
                      setFormData({ ...formData, governanceType: value })
                    }
                  >
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder={t("Select type")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      <SelectItem value="Policy">{t("Policy")}</SelectItem>
                      <SelectItem value="Standard">{t("Standard")}</SelectItem>
                      <SelectItem value="Procedure">{t("Procedure")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">
                    {t("Upload Template")} <span className="text-red-500">*</span>
                  </Label>

                  {/* Drag and Drop Zone */}
                  <div
                    className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
                      dragOver
                        ? "border-primary bg-primary/5"
                        : fileError
                          ? "border-red-400 bg-red-50"
                          : "border-slate-300 hover:border-slate-400"
                    }`}
                    onDragOver={handleFileDragOver}
                    onDragLeave={handleFileDragLeave}
                    onDrop={handleFileDrop}
                  >
                    {!formData.file ? (
                      <div className="flex flex-col items-center text-center">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                          <Upload className="h-5 w-5 text-slate-400" />
                        </div>
                        <p className="text-sm text-slate-600">
                          {t("Drag and Drop or")}{" "}
                          <label className="text-primary cursor-pointer hover:underline">
                            {t("Click to upload")}
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept=".docx"
                              className="hidden"
                              onChange={handleFileChange}
                            />
                          </label>
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {t("Supported format: DOCX only. Max Size: 25MB")}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {/* File Item */}
                        <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">
                              {formData.file.name}
                            </p>
                            <p className="text-xs text-slate-400">
                              {formatFileSize(formData.file.size)}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-slate-600"
                            onClick={handleRemoveFile}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  {fileError && (
                    <p className="text-sm text-red-500 mt-1">{fileError}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex-shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateDialogOpen(false);
                  resetForm();
                }}
              >
                {t("Cancel")}
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!formData.file || !formData.governanceType}
              >
                {t("Save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Search inside card */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={t("Search templates...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-[300px] ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
            />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ps-5">{t("Template Name")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Governance Type")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Uploaded By")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Created")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pe-5 w-[120px]">{t("Actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTemplates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-slate-500">{t("No templates found")}</p>
                    <p className="text-sm text-slate-400">
                      {searchTerm
                        ? t("Try adjusting your search")
                        : t("Add your first governance template")}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedTemplates.map((template) => (
                <TableRow key={template.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                  <TableCell className="py-3 text-sm ps-5">
                    <p className="font-medium text-slate-800">{template.name}</p>
                  </TableCell>
                  <TableCell className="py-3 text-sm">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        governanceTypeColors[template.governanceType] ||
                        "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {template.governanceType}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 text-sm text-slate-600">
                    {template.uploadedBy?.fullName || "System"}
                  </TableCell>
                  <TableCell className="py-3 text-sm text-slate-600">
                    {formatDate(template.createdAt)}
                  </TableCell>
                  <TableCell className="py-3 text-sm pe-5">
                    <div className="flex gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleView(template)}
                        className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(template)}
                        className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(template)}
                        className="h-7 w-7 text-slate-400 hover:text-semantic-error hover:bg-red-50"
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
            {filteredTemplates.length > 0
              ? `${startIndex + 1} ${t("to")} ${Math.min(startIndex + itemsPerPage, filteredTemplates.length)} ${t("of")} ${filteredTemplates.length}`
              : t("No templates")}
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

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
          <div className="flex-shrink-0 px-6 py-4 border-b border-slate-100">
            <DialogTitle className="text-base font-semibold text-slate-800">
              {t("Edit Governance Template")}
            </DialogTitle>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  {t("Governance Type")} <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.governanceType}
                  onValueChange={(value) =>
                    setFormData({ ...formData, governanceType: value })
                  }
                >
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder={t("Select type")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="Policy">{t("Policy")}</SelectItem>
                    <SelectItem value="Standard">{t("Standard")}</SelectItem>
                    <SelectItem value="Procedure">{t("Procedure")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  {t("Upload New Template (optional)")}
                </Label>

                {/* Drag and Drop Zone */}
                <div
                  className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
                    dragOver
                      ? "border-primary bg-primary/5"
                      : fileError
                        ? "border-red-400 bg-red-50"
                        : "border-slate-300 hover:border-slate-400"
                  }`}
                  onDragOver={handleFileDragOver}
                  onDragLeave={handleFileDragLeave}
                  onDrop={handleFileDrop}
                >
                  {!formData.file ? (
                    <div className="flex flex-col items-center text-center">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                        <Upload className="h-5 w-5 text-slate-400" />
                      </div>
                      <p className="text-sm text-slate-600">
                        {t("Drag and Drop or")}{" "}
                        <label className="text-primary cursor-pointer hover:underline">
                          {t("Click to upload")}
                          <input
                            ref={editFileInputRef}
                            type="file"
                            accept=".docx"
                            className="hidden"
                            onChange={handleFileChange}
                          />
                        </label>
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {t("Supported format: DOCX only. Max Size: 25MB")}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* File Item */}
                      <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">
                            {formData.file.name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {formatFileSize(formData.file.size)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-slate-600"
                          onClick={handleRemoveFile}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                {fileError && (
                  <p className="text-sm text-red-500 mt-1">{fileError}</p>
                )}
              </div>
              {selectedTemplate && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-600">
                    <span className="font-medium">{t("Current file")}:</span> {selectedTemplate.fileName}
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="flex-shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setSelectedTemplate(null);
                resetForm();
              }}
            >
              {t("Cancel")}
            </Button>
            <Button
              onClick={handleEdit}
              disabled={!formData.governanceType}
            >
              {t("Save Changes")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="p-0 gap-0 overflow-hidden">
          <AlertDialogHeader className="px-6 py-4">
            <AlertDialogTitle className="text-base font-semibold text-slate-800">
              {t("Delete Template")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500 mt-1">
              {t("Are you sure you want to delete")} &quot;{selectedTemplate?.name}&quot;? {t("This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="px-6 py-4 bg-slate-50/80 rounded-b-lg">
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
    </div>
  );
}
