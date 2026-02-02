"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ArrowLeft, Plus, Pencil, Trash2, Download, Upload, Check, Sparkles, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface Framework {
  id: string;
  name: string;
  description: string | null;
  version: string | null;
  type: string;
  status: string;
  country: string | null;
  industry: string | null;
  isCustom: boolean;
}

export default function FrameworkMasterDataPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedFramework, setSelectedFramework] = useState<Framework | null>(null);

  // Filter states
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Multi-step wizard state
  const [wizardStep, setWizardStep] = useState(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [useAIControls, setUseAIControls] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "Framework",
    status: "Subscribed",
    country: "",
    industry: "",
    isCustom: true,
  });

  const fetchFrameworks = useCallback(async () => {
    try {
      const response = await fetch("/api/frameworks");
      if (response.ok) {
        const data = await response.json();
        setFrameworks(data);
      }
    } catch (error) {
      console.error("Error fetching frameworks:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFrameworks();
  }, [fetchFrameworks]);

  const handleEdit = async () => {
    if (!selectedFramework) return;
    try {
      const response = await fetch(`/api/frameworks/${selectedFramework.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setEditDialogOpen(false);
        setSelectedFramework(null);
        resetForm();
        fetchFrameworks();
      }
    } catch (error) {
      console.error("Error updating framework:", error);
    }
  };

  const handleDelete = async () => {
    if (!selectedFramework) return;
    try {
      const response = await fetch(`/api/frameworks/${selectedFramework.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setDeleteDialogOpen(false);
        setSelectedFramework(null);
        fetchFrameworks();
      }
    } catch (error) {
      console.error("Error deleting framework:", error);
    }
  };

  const openEditDialog = (framework: Framework) => {
    setSelectedFramework(framework);
    setFormData({
      name: framework.name,
      description: framework.description || "",
      type: framework.type,
      status: framework.status,
      country: framework.country || "",
      industry: framework.industry || "",
      isCustom: framework.isCustom,
    });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (framework: Framework) => {
    setSelectedFramework(framework);
    setDeleteDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      type: "Framework",
      status: "Subscribed",
      country: "",
      industry: "",
      isCustom: true,
    });
    setWizardStep(1);
    setSelectedFile(null);
    setUseAIControls(false);
  };

  const handleNextStep = () => {
    setWizardStep(2);
  };

  const handlePreviousStep = () => {
    setWizardStep(1);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    try {
      // First create the framework
      const response = await fetch("/api/frameworks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const framework = await response.json();

        // If file is selected, upload requirements
        if (selectedFile) {
          const formDataUpload = new FormData();
          formDataUpload.append("file", selectedFile);
          formDataUpload.append("frameworkId", framework.id);
          formDataUpload.append("useAI", String(useAIControls));

          await fetch("/api/frameworks/import", {
            method: "POST",
            body: formDataUpload,
          });
        }

        setCreateDialogOpen(false);
        resetForm();
        fetchFrameworks();
      }
    } catch (error) {
      console.error("Error creating framework:", error);
    }
  };

  const handleDownloadTemplate = () => {
    // Download CSV template for requirement import
    const template = "Code,Name,Description,Requirement Type,Chapter Type,Level\n";
    const blob = new Blob([template], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "requirement_template.csv";
    a.click();
  };

  const handleExport = () => {
    const csv = [
      ["Name", "Version", "Type", "Status", "Country", "Industry"],
      ...frameworks.map((f) => [
        f.name,
        f.version || "",
        f.type,
        f.status,
        f.country || "",
        f.industry || "",
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "frameworks.csv";
    a.click();
  };

  const filteredFrameworks = frameworks.filter((f) => {
    const matchesSearch = f.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || f.type === typeFilter;
    const matchesStatus = statusFilter === "all" || f.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredFrameworks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedFrameworks = filteredFrameworks.slice(startIndex, startIndex + itemsPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, typeFilter, statusFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
            <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-sm text-slate-500 font-medium">{t("Loading frameworks...")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-slate-600"
            onClick={() => router.push("/compliance/master-data")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-slate-800">{t("Integrated Frameworks")}</h1>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <Input
          placeholder={t("Search frameworks...")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm bg-white"
        />
        <div className="flex items-center gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px] bg-white">
              <SelectValue placeholder={t("All Types")} />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4}>
              <SelectItem value="all">{t("All Types")}</SelectItem>
              <SelectItem value="Framework">{t("Framework")}</SelectItem>
              <SelectItem value="Standard">{t("Standard")}</SelectItem>
              <SelectItem value="Regulation">{t("Regulation")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] bg-white">
              <SelectValue placeholder={t("All Status")} />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4}>
              <SelectItem value="all">{t("All Status")}</SelectItem>
              <SelectItem value="Subscribed">{t("Subscribed")}</SelectItem>
              <SelectItem value="Active">{t("Active")}</SelectItem>
              <SelectItem value="Inactive">{t("Inactive")}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            {t("Export")}
          </Button>
          <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="bg-primary-50 hover:bg-primary-100 text-primary-700 border-primary-200">
                <Sparkles className="h-4 w-4 mr-2" />
                {t("New Framework (AI)")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
              <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
                <DialogTitle className="text-lg font-semibold text-slate-800">{t("AI Framework Generator")}</DialogTitle>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
                <p className="text-sm text-slate-600">
                  {t("This feature will use AI to help generate framework requirements based on your inputs.")}
                </p>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">{t("Framework Name")}</Label>
                  <Input
                    placeholder={t("Enter framework name")}
                    className="bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">{t("Industry")}</Label>
                  <Input
                    placeholder={t("e.g., Healthcare, Finance")}
                    className="bg-white"
                  />
                </div>
              </div>
              <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
                <Button variant="outline" size="sm" onClick={() => setAiDialogOpen(false)}>
                  {t("Cancel")}
                </Button>
                <Button size="sm">
                  <Sparkles className="h-4 w-4 mr-2" />
                  {t("Generate")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={createDialogOpen} onOpenChange={(open) => {
            setCreateDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                {t("New Framework")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
              <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
                <DialogTitle className="text-lg font-semibold text-slate-800">
                  {wizardStep === 1 ? t("Create Integrated Framework") : t("Import Requirement")}
                </DialogTitle>
              </div>

              {/* Stepper */}
              <div className="flex-shrink-0 flex items-center justify-center px-6 py-4 bg-slate-50/50 border-b border-slate-100">
                {[1, 2].map((step) => (
                  <div key={step} className="flex items-center">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 text-sm font-medium ${
                      step === wizardStep
                        ? "bg-primary text-primary-foreground border-primary"
                        : step < wizardStep
                          ? "bg-success text-white border-success"
                          : "bg-white border-slate-300 text-slate-500"
                    }`}>
                      {step < wizardStep ? <Check className="h-4 w-4" /> : step}
                    </div>
                    <span className={`ml-2 text-sm ${
                      step === wizardStep ? "text-slate-800 font-medium" : "text-slate-500"
                    }`}>
                      {step === 1 ? t("Framework Details") : t("Import Requirement")}
                    </span>
                    {step < 2 && <div className="w-12 h-0.5 bg-slate-200 mx-3" />}
                  </div>
                ))}
              </div>

              {/* Step 1: Framework Details */}
              {wizardStep === 1 && (
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
                  <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    {t("Note: Custom framework will be automatically added in grey color to differentiate between Subscribed Frameworks.")}
                  </p>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">{t("Integrated Framework Name")} *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder={t("Enter framework name")}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                    <Input
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      placeholder={t("Enter description")}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">{t("Framework Type")} *</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) =>
                        setFormData({ ...formData, type: value })
                      }
                    >
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        <SelectItem value="Framework">{t("Framework")}</SelectItem>
                        <SelectItem value="Standard">{t("Standard")}</SelectItem>
                        <SelectItem value="Regulation">{t("Regulation")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">{t("Country")} *</Label>
                      <Input
                        value={formData.country}
                        onChange={(e) =>
                          setFormData({ ...formData, country: e.target.value })
                        }
                        placeholder={t("Enter country")}
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">{t("Industry")} *</Label>
                      <Input
                        value={formData.industry}
                        onChange={(e) =>
                          setFormData({ ...formData, industry: e.target.value })
                        }
                        placeholder={t("Enter industry")}
                        className="bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Import Requirements */}
              {wizardStep === 2 && (
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">{t("File")}</Label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        value={selectedFile?.name || ""}
                        readOnly
                        placeholder={t("Choose a file...")}
                        className="flex-1 bg-white"
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
                      >
                        {t("Browse...")}
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="useAI"
                      checked={useAIControls}
                      onCheckedChange={(checked) => setUseAIControls(checked as boolean)}
                    />
                    <Label htmlFor="useAI" className="cursor-pointer text-sm text-slate-600">
                      {t("Do you want to get controls from our AI?")}
                    </Label>
                  </div>
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadTemplate}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {t("Download Template")}
                    </Button>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
                {wizardStep === 2 && (
                  <Button variant="outline" size="sm" onClick={handlePreviousStep}>
                    {t("Previous")}
                  </Button>
                )}
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
                {wizardStep === 1 ? (
                  <Button
                    size="sm"
                    onClick={handleNextStep}
                    disabled={!formData.name || !formData.country || !formData.industry}
                  >
                    {t("Next")}
                  </Button>
                ) : (
                  <Button size="sm" onClick={handleImport}>
                    <Upload className="h-4 w-4 mr-2" />
                    {t("Import")}
                  </Button>
                )}
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
              <TableHead className="text-xs font-semibold text-slate-600 h-12 pl-4">{t("Framework Name")}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12">{t("Type")}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12">{t("Status")}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12 pr-4 w-[100px]">{t("Action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedFrameworks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12">
                  <p className="text-slate-500">{t("No frameworks found")}</p>
                </TableCell>
              </TableRow>
            ) : (
              paginatedFrameworks.map((framework) => (
                <TableRow key={framework.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <TableCell className="py-3 text-sm font-medium text-slate-800 pl-4">
                    {framework.name}
                  </TableCell>
                  <TableCell className="py-3 text-sm text-slate-600">
                    {framework.type}
                  </TableCell>
                  <TableCell className="py-3 text-sm">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      framework.status === 'Subscribed'
                        ? 'bg-success-light text-success-dark'
                        : framework.status === 'Active'
                        ? 'bg-info-light text-info-dark'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {framework.status}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 text-sm pr-4">
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(framework)}
                        className="h-8 w-8 text-slate-400 hover:text-slate-600"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(framework)}
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
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
          <p className="text-sm text-slate-500">
            {t("Showing")} {filteredFrameworks.length === 0 ? 0 : startIndex + 1} {t("to")}{" "}
            {Math.min(startIndex + itemsPerPage, filteredFrameworks.length)} {t("of")}{" "}
            {filteredFrameworks.length}
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
            <DialogTitle className="text-lg font-semibold text-slate-800">{t("Edit Integrated Framework")}</DialogTitle>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">{t("Integrated Framework Name")} *</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
              <Input
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">{t("Framework Type")} *</Label>
              <Select
                value={formData.type}
                onValueChange={(value) =>
                  setFormData({ ...formData, type: value })
                }
              >
                <SelectTrigger className="w-full bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  <SelectItem value="Framework">{t("Framework")}</SelectItem>
                  <SelectItem value="Standard">{t("Standard")}</SelectItem>
                  <SelectItem value="Regulation">{t("Regulation")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">{t("Country")} *</Label>
                <Input
                  value={formData.country}
                  onChange={(e) =>
                    setFormData({ ...formData, country: e.target.value })
                  }
                  className="bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">{t("Industry")} *</Label>
                <Input
                  value={formData.industry}
                  onChange={(e) =>
                    setFormData({ ...formData, industry: e.target.value })
                  }
                  className="bg-white"
                />
              </div>
            </div>
          </div>
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditDialogOpen(false);
                setSelectedFramework(null);
                resetForm();
              }}
            >
              {t("Cancel")}
            </Button>
            <Button size="sm" onClick={handleEdit} disabled={!formData.name || !formData.country || !formData.industry}>
              {t("Save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="p-0 gap-0">
          <AlertDialogHeader className="px-6 py-5">
            <AlertDialogTitle className="text-lg font-semibold text-slate-800">{t("Delete Framework")}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500 mt-1">
              {t("Are you sure you want to delete")} &quot;{selectedFramework?.name}&quot;? {t("This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="px-6 py-4 bg-white rounded-b-lg">
            <AlertDialogCancel className="h-9">{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
