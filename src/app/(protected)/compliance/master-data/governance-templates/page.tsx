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
  ArrowLeft,
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
} from "lucide-react";

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/compliance/master-data")}
            className="h-9 w-9"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Governance Templates</h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage policy, standard, and procedure templates
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary-600 hover:bg-primary-700">
                <Plus className="h-4 w-4 mr-2" />
                New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg flex flex-col max-h-[90vh]">
              <DialogHeader className="flex-shrink-0 pb-4">
                <DialogTitle className="text-lg font-semibold text-slate-800">
                  Add Governance Template
                </DialogTitle>
              </DialogHeader>
              <div className="overflow-y-auto flex-1 py-2">
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
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx"
                      onChange={handleFileChange}
                      className="w-full bg-white"
                    />
                    <p className="text-xs text-slate-500">
                      Supported formats: PDF, DOC, DOCX, XLS, XLSX
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex-shrink-0 pt-4 flex justify-end gap-2">
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
                  className="bg-primary-600 hover:bg-primary-700"
                >
                  Save
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
              <TableHead className="font-semibold text-slate-700">Template Name</TableHead>
              <TableHead className="font-semibold text-slate-700">Governance Type</TableHead>
              <TableHead className="font-semibold text-slate-700">Uploaded By</TableHead>
              <TableHead className="font-semibold text-slate-700">Created</TableHead>
              <TableHead className="font-semibold text-slate-700 w-[120px]">Actions</TableHead>
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
                <TableRow key={template.id} className="hover:bg-slate-50/50">
                  <TableCell>
                    <p className="font-medium text-slate-800">{template.name}</p>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        governanceTypeColors[template.governanceType] ||
                        "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {template.governanceType}
                    </span>
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {template.uploadedBy || "System"}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {formatDate(template.createdAt)}
                  </TableCell>
                  <TableCell>
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
        <div className="p-4 border-t border-slate-200 flex items-center justify-between">
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
        <DialogContent className="max-w-lg flex flex-col max-h-[90vh]">
          <DialogHeader className="flex-shrink-0 pb-4">
            <DialogTitle className="text-lg font-semibold text-slate-800">
              Edit Governance Template
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 py-2">
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
                <Input
                  ref={editFileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx"
                  onChange={handleFileChange}
                  className="w-full bg-white"
                />
                <p className="text-xs text-slate-500">
                  Supported formats: PDF, DOC, DOCX, XLS, XLSX
                </p>
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
          <div className="flex-shrink-0 pt-4 flex justify-end gap-2">
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
              className="bg-primary-600 hover:bg-primary-700"
            >
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-semibold text-slate-800">
              Delete Template
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600">
              Are you sure you want to delete &quot;{selectedTemplate?.name}&quot;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
