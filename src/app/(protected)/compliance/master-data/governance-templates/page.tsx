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
  ChevronsLeft,
  ChevronsRight,
  Upload,
  Home,
} from "lucide-react";
import Link from "next/link";

interface Template {
  id: string;
  name: string;
  governanceType: string;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  filePath: string;
  uploadedBy: string | null;
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
      const validTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];
      const validExtensions = [".pdf", ".doc", ".docx", ".xls", ".xlsx"];
      const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));

      if (validTypes.includes(file.type) || validExtensions.includes(fileExtension)) {
        setFormData({ ...formData, file });
      }
    }
  };

  const handleRemoveFile = () => {
    setFormData({ ...formData, file: null });
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
      <div className="flex items-center justify-center h-64">
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-full border-2 border-primary-200"></div>
          <div className="absolute inset-0 rounded-full border-2 border-primary-600 border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>Compliance</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <Link href="/compliance/master-data" className="text-slate-500 hover:text-primary-600 transition-colors">
          Master Data
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">Governance Templates</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800">Governance Templates</h1>
      </div>

      {/* Search and Actions - same row */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-[300px] bg-white border-slate-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
              <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
                <DialogTitle className="text-lg font-semibold text-slate-800">
                  Add Governance Template
                </DialogTitle>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">
                      Governance Type <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData.governanceType}
                      onValueChange={(value) =>
                        setFormData({ ...formData, governanceType: value })
                      }
                    >
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        <SelectItem value="Policy">Policy</SelectItem>
                        <SelectItem value="Standard">Standard</SelectItem>
                        <SelectItem value="Procedure">Procedure</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">
                      Upload Template <span className="text-red-500">*</span>
                    </Label>

                    {/* Drag and Drop Zone */}
                    <div
                      className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
                        dragOver
                          ? "border-primary bg-primary/5"
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
                            Drag and Drop or{" "}
                            <label className="text-primary cursor-pointer hover:underline">
                              Click to upload
                              <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.doc,.docx,.xls,.xlsx"
                                className="hidden"
                                onChange={handleFileChange}
                              />
                            </label>
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            Supported formats: PDF, DOC, DOCX, XLS, XLSX. Max Size: 25MB
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
                  </div>
                </div>
              </div>
              <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCreateDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!formData.file || !formData.governanceType}
                >
                  Save
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
              <TableHead className="text-xs font-semibold text-slate-600 h-12 pl-4">Template Name</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12">Governance Type</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12">Uploaded By</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12">Created</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12 pr-4 w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTemplates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-slate-500">No templates found</p>
                    <p className="text-sm text-slate-400">
                      {searchTerm
                        ? "Try adjusting your search"
                        : "Add your first governance template"}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedTemplates.map((template) => (
                <TableRow key={template.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <TableCell className="py-3 text-sm pl-4">
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
                    {template.uploadedBy || "System"}
                  </TableCell>
                  <TableCell className="py-3 text-sm text-slate-600">
                    {formatDate(template.createdAt)}
                  </TableCell>
                  <TableCell className="py-3 text-sm pr-4">
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleView(template)}
                        className="h-8 w-8 text-slate-400 hover:text-slate-600"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(template)}
                        className="h-8 w-8 text-slate-400 hover:text-slate-600"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(template)}
                        className="h-8 w-8 text-slate-400 hover:text-semantic-error"
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
            Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredTemplates.length)} of{" "}
            {filteredTemplates.length}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="h-8 w-8"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-slate-600 px-2">
              Page {currentPage} of {totalPages || 1}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages || totalPages === 0}
              className="h-8 w-8"
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
            <DialogTitle className="text-lg font-semibold text-slate-800">
              Edit Governance Template
            </DialogTitle>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  Governance Type <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.governanceType}
                  onValueChange={(value) =>
                    setFormData({ ...formData, governanceType: value })
                  }
                >
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="Policy">Policy</SelectItem>
                    <SelectItem value="Standard">Standard</SelectItem>
                    <SelectItem value="Procedure">Procedure</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  Upload New Template (optional)
                </Label>

                {/* Drag and Drop Zone */}
                <div
                  className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
                    dragOver
                      ? "border-primary bg-primary/5"
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
                        Drag and Drop or{" "}
                        <label className="text-primary cursor-pointer hover:underline">
                          Click to upload
                          <input
                            ref={editFileInputRef}
                            type="file"
                            accept=".pdf,.doc,.docx,.xls,.xlsx"
                            className="hidden"
                            onChange={handleFileChange}
                          />
                        </label>
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Supported formats: PDF, DOC, DOCX, XLS, XLSX. Max Size: 25MB
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
              </div>
              {selectedTemplate && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-600">
                    <span className="font-medium">Current file:</span> {selectedTemplate.fileName}
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setSelectedTemplate(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={!formData.governanceType}
            >
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="p-0 gap-0">
          <AlertDialogHeader className="px-6 py-5">
            <AlertDialogTitle className="text-lg font-semibold text-slate-800">
              Delete Template
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500 mt-1">
              Are you sure you want to delete &quot;{selectedTemplate?.name}&quot;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="px-6 py-4 bg-white rounded-b-lg">
            <AlertDialogCancel className="h-9">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 h-9"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
