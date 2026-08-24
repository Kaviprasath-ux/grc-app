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
import { Plus, Pencil, Trash2, Download, Upload, Check, Sparkles, Search, ChevronLeft, ChevronRight, Home, BookOpen } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedData, triggerTranslation } from "@/hooks/useTranslatedData";

import { FileInput } from "@/components/shared/file-input";
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
  const { data: translatedFrameworks } = useTranslatedData(frameworks, { modelName: 'Framework' });
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
    type: "",
    status: "Subscribed",
    country: "",
    industry: "",
    isCustom: true,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

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
        // Trigger dynamic translation for the edited framework
        triggerTranslation('Framework', selectedFramework.id, {
          name: formData.name,
          description: formData.description,
          country: formData.country,
          industry: formData.industry,
        });

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
    setFormErrors({});
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
      type: "",
      status: "Subscribed",
      country: "",
      industry: "",
      isCustom: true,
    });
    setFormErrors({});
    setWizardStep(1);
    setSelectedFile(null);
    setUseAIControls(false);
  };

  const validateFrameworkForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.name?.trim()) {
      errors.name = t("Please enter name");
    }
    if (!formData.type) {
      errors.type = t("Please Select Framework Type");
    }
    if (!formData.country?.trim()) {
      errors.country = t("Please enter Country");
    }
    if (!formData.industry?.trim()) {
      errors.industry = t("Please enter Industry");
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFrameworkFieldChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    if (formErrors[field]) {
      setFormErrors({ ...formErrors, [field]: "" });
    }
  };

  const handleNextStep = () => {
    if (!validateFrameworkForm()) {
      return;
    }
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

        // Trigger dynamic translation for the new framework
        triggerTranslation('Framework', framework.id, {
          name: framework.name,
          description: framework.description,
          country: framework.country,
          industry: framework.industry,
        });

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

  const handleDownloadTemplate = async () => {
    try {
      const XLSX = await import("xlsx");
      const columns = [
        "Requirement Category",
        "Requirement code",
        "Requirement",
        "Description",
        "Control mapping",
        "Requirement type",
        "Chapter type",
      ];
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet([columns]);
      worksheet["!cols"] = columns.map((col) => ({ wch: Math.max(col.length + 5, 20) }));
      XLSX.utils.book_append_sheet(workbook, worksheet, "Requirements");
      XLSX.writeFile(workbook, "framework_requirements_template.xlsx");
    } catch (error) {
      console.error("Error generating template:", error);
    }
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

  const filteredFrameworks = translatedFrameworks.filter((f) => {
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
      <div className="space-y-4 sm:space-y-6">
        <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
          <Link href="" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
            <Home className="h-4 w-4" />
            <span>{t("Compliance")}</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-slate-500">{t("Compliance Settings")}</span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-primary-700 font-medium">{t("Framework")}</span>
        </nav>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Integrated Frameworks")}</h1>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-center h-64">
            <div className="w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
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
          <span>{t("Compliance")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/compliance/master-data" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Compliance Settings")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Framework")}</span>
      </nav>

      {/* Page Header */}
      <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Integrated Frameworks")}</h1>

      {/* Action Buttons - Above Card */}
      <div className="grid grid-cols-2 sm:flex sm:items-center ltr:sm:justify-end rtl:sm:justify-start gap-2">
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t("Export")}
        </Button>
        <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="bg-primary-50 hover:bg-primary-100 text-primary-700 border-primary-200">
              <Sparkles className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("New Framework (AI)")}
            </Button>
          </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
              <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-b border-slate-100">
                <DialogTitle className="text-base font-semibold text-slate-800">{t("AI Framework Generator")}</DialogTitle>
              </div>
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
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
              <div className="flex items-center ltr:justify-end rtl:justify-start gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
                <Button variant="outline" onClick={() => setAiDialogOpen(false)}>
                  {t("Cancel")}
                </Button>
                <Button>
                  <Sparkles className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
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
            <Button size="sm" className="col-span-2 sm:col-span-1">
              <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("New Framework")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
            <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-b border-slate-100">
              <DialogTitle className="text-base font-semibold text-slate-800">
                  {wizardStep === 1 ? t("Create Integrated Framework") : t("Import Requirement")}
                </DialogTitle>
              </div>

              {/* Stepper */}
              <div className="flex-shrink-0 flex items-center justify-center px-4 sm:px-6 py-4 bg-slate-50/50 border-b border-slate-100">
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
                    <span className={`hidden sm:inline ltr:ml-2 rtl:mr-2 text-sm ${
                      step === wizardStep ? "text-slate-800 font-medium" : "text-slate-500"
                    }`}>
                      {step === 1 ? t("Framework Details") : t("Import Requirement")}
                    </span>
                    {step < 2 && <div className="w-6 sm:w-12 h-0.5 bg-slate-200 mx-1.5 sm:mx-3" />}
                  </div>
                ))}
              </div>

              {/* Step 1: Framework Details */}
              {wizardStep === 1 && (
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-4">
                  <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    {t("Note: Custom framework will be automatically added in grey color to differentiate between Subscribed Frameworks.")}
                  </p>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">{t("Integrated Framework Name")} <span className="text-red-500">*</span></Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => handleFrameworkFieldChange("name", e.target.value)}
                      placeholder={t("Enter framework name")}
                      className={`bg-white ${formErrors.name ? "border-red-400 bg-red-50 focus-visible:ring-red-300" : ""}`}
                    />
                    {formErrors.name && (
                      <p className="text-sm text-red-500 bg-red-50 px-3 py-1.5 rounded">{formErrors.name}</p>
                    )}
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
                    <Label className="text-sm font-medium text-slate-700">{t("Framework Type")} <span className="text-red-500">*</span></Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) => handleFrameworkFieldChange("type", value)}
                    >
                      <SelectTrigger className={`w-full bg-white ${formErrors.type ? "border-red-400 bg-red-50" : ""}`}>
                        <SelectValue placeholder={t("Select Framework Type")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        <SelectItem value="Framework">{t("Framework")}</SelectItem>
                        <SelectItem value="Standard">{t("Standard")}</SelectItem>
                        <SelectItem value="Regulation">{t("Regulation")}</SelectItem>
                      </SelectContent>
                    </Select>
                    {formErrors.type && (
                      <p className="text-sm text-red-500 bg-red-50 px-3 py-1.5 rounded">{formErrors.type}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">{t("Country")} <span className="text-red-500">*</span></Label>
                      <Input
                        value={formData.country}
                        onChange={(e) => handleFrameworkFieldChange("country", e.target.value)}
                        placeholder={t("Enter country")}
                        className={`bg-white ${formErrors.country ? "border-red-400 bg-red-50 focus-visible:ring-red-300" : ""}`}
                      />
                      {formErrors.country && (
                        <p className="text-sm text-red-500 bg-red-50 px-3 py-1.5 rounded">{formErrors.country}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">{t("Industry")} <span className="text-red-500">*</span></Label>
                      <Input
                        value={formData.industry}
                        onChange={(e) => handleFrameworkFieldChange("industry", e.target.value)}
                        placeholder={t("Enter industry")}
                        className={`bg-white ${formErrors.industry ? "border-red-400 bg-red-50 focus-visible:ring-red-300" : ""}`}
                      />
                      {formErrors.industry && (
                        <p className="text-sm text-red-500 bg-red-50 px-3 py-1.5 rounded">{formErrors.industry}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Import Requirements */}
              {wizardStep === 2 && (
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-4">
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
                      <FileInput
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
                      <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                      {t("Download Template")}
                    </Button>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center ltr:justify-end rtl:justify-start gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
                {wizardStep === 2 && (
                  <Button variant="outline" onClick={handlePreviousStep}>
                    {t("Previous")}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    setCreateDialogOpen(false);
                    resetForm();
                  }}
                >
                  {t("Cancel")}
                </Button>
                {wizardStep === 1 ? (
                  <Button onClick={handleNextStep}>
                    {t("Next")}
                  </Button>
                ) : (
                  <Button onClick={handleImport}>
                    <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    {t("Import")}
                  </Button>
                )}
              </div>
            </DialogContent>
          </Dialog>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Search Toolbar */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 px-3 sm:px-5 py-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={t("Search frameworks...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-[300px] ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
            />
          </div>
          <div className="ltr:ml-auto rtl:mr-auto flex items-center gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm bg-slate-50 border-slate-200">
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
              <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm bg-slate-50 border-slate-200">
                <SelectValue placeholder={t("All Status")} />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4}>
                <SelectItem value="all">{t("All Status")}</SelectItem>
                <SelectItem value="Subscribed">{t("Subscribed")}</SelectItem>
                <SelectItem value="Active">{t("Active")}</SelectItem>
                <SelectItem value="Inactive">{t("Inactive")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="overflow-x-auto">
        <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow className="border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ps-5">{t("Framework Name")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Type")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Status")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pe-5 w-[100px]">{t("Action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedFrameworks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-0">
                  <div className="py-16 text-center">
                    <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                      <BookOpen className="h-6 w-6 text-primary-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-600 mb-1">{t("No frameworks found")}</p>
                    <p className="text-xs text-slate-400">
                      {searchTerm ? t("Try adjusting your search") : t("Create a new framework to get started")}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedFrameworks.map((framework) => (
                <TableRow key={framework.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                  <TableCell className="py-3 text-sm font-medium text-slate-800 ps-5">
                    {framework.name}
                  </TableCell>
                  <TableCell className="py-3 text-sm text-slate-600">
                    {t(framework.type)}
                  </TableCell>
                  <TableCell className="py-3 text-sm">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      framework.status === 'Subscribed'
                        ? 'bg-success-light text-success-dark'
                        : framework.status === 'Active'
                        ? 'bg-info-light text-info-dark'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {t(framework.status)}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 text-sm pe-5">
                    <div className="flex gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(framework)}
                        className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(framework)}
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
        </div>
        <div className="flex items-center justify-between px-3 sm:px-5 py-3 border-t border-slate-100 bg-slate-50/50">
          <p className="text-xs text-slate-500">
            {filteredFrameworks.length === 0 ? 0 : startIndex + 1} {t("to")}{" "}
            {Math.min(startIndex + itemsPerPage, filteredFrameworks.length)} {t("of")}{" "}
            {filteredFrameworks.length}
          </p>
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
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-b border-slate-100">
            <DialogTitle className="text-base font-semibold text-slate-800">{t("Edit Integrated Framework")}</DialogTitle>
          </div>
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">{t("Integrated Framework Name")} <span className="text-red-500">*</span></Label>
              <Input
                value={formData.name}
                onChange={(e) => handleFrameworkFieldChange("name", e.target.value)}
                className={`w-full bg-white ${formErrors.name ? "border-red-400 bg-red-50 focus-visible:ring-red-300" : ""}`}
              />
              {formErrors.name && (
                <p className="text-sm text-red-500 bg-red-50 px-3 py-1.5 rounded">{formErrors.name}</p>
              )}
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
              <Label className="text-sm font-medium text-slate-700">{t("Framework Type")} <span className="text-red-500">*</span></Label>
              <Select
                value={formData.type}
                onValueChange={(value) => handleFrameworkFieldChange("type", value)}
              >
                <SelectTrigger className={`w-full bg-white ${formErrors.type ? "border-red-400 bg-red-50" : ""}`}>
                  <SelectValue placeholder={t("Select Framework Type")} />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  <SelectItem value="Framework">{t("Framework")}</SelectItem>
                  <SelectItem value="Standard">{t("Standard")}</SelectItem>
                  <SelectItem value="Regulation">{t("Regulation")}</SelectItem>
                </SelectContent>
              </Select>
              {formErrors.type && (
                <p className="text-sm text-red-500 bg-red-50 px-3 py-1.5 rounded">{formErrors.type}</p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">{t("Country")} <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.country}
                  onChange={(e) => handleFrameworkFieldChange("country", e.target.value)}
                  className={`bg-white ${formErrors.country ? "border-red-400 bg-red-50 focus-visible:ring-red-300" : ""}`}
                />
                {formErrors.country && (
                  <p className="text-sm text-red-500 bg-red-50 px-3 py-1.5 rounded">{formErrors.country}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">{t("Industry")} <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.industry}
                  onChange={(e) => handleFrameworkFieldChange("industry", e.target.value)}
                  className={`bg-white ${formErrors.industry ? "border-red-400 bg-red-50 focus-visible:ring-red-300" : ""}`}
                />
                {formErrors.industry && (
                  <p className="text-sm text-red-500 bg-red-50 px-3 py-1.5 rounded">{formErrors.industry}</p>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center ltr:justify-end rtl:justify-start gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setSelectedFramework(null);
                resetForm();
              }}
            >
              {t("Cancel")}
            </Button>
            <Button onClick={() => { if (validateFrameworkForm()) handleEdit(); }}>
              {t("Save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="p-0 gap-0 overflow-hidden">
          <AlertDialogHeader className="px-4 sm:px-6 py-4 sm:py-5">
            <AlertDialogTitle className="text-base font-semibold text-slate-800">{t("Delete Framework")}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500 mt-1">
              {t("Are you sure you want to delete")} &quot;{selectedFramework?.name}&quot;? {t("This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex items-center ltr:justify-end rtl:justify-start gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
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
