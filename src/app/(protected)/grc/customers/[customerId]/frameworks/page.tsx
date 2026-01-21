"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronLeft,
  Plus,
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Framework {
  id: string;
  code?: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  country?: string;
  industry?: string;
  isCustom: boolean;
  compliancePercentage: number;
  policyPercentage: number;
  evidencePercentage: number;
}

interface Customer {
  id: string;
  customerCode: string;
  customerName: string;
  email: string;
  userName: string;
}

interface NewFramework {
  code: string;
  name: string;
  description: string;
  type: string;
  country: string;
  industry: string;
}

interface ImportError {
  row: number;
  column: string;
  message: string;
}

// Template columns for framework requirements (same as GRC Admin)
const TEMPLATE_COLUMNS = [
  "Requirement Category",
  "Requirement code",
  "Requirement",
  "Description",
  "Control mapping",
  "Requirement type",
  "Chapter type",
];

export default function CustomerFrameworkOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const customerId = params.customerId as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("Framework");
  const [creationMode, setCreationMode] = useState<string>("Manual");

  // Dialog states - Step 1 (Basic Info)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Dialog states - Step 2 (Excel Import)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [newlyCreatedFrameworkId, setNewlyCreatedFrameworkId] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<ImportError[]>([]);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [isDraggingImport, setIsDraggingImport] = useState(false);

  // Form state
  const [formData, setFormData] = useState<NewFramework>({
    code: "",
    name: "",
    description: "",
    type: "",
    country: "",
    industry: "",
  });

  useEffect(() => {
    fetchCustomer();
    fetchFrameworks();
  }, [customerId]);

  const fetchCustomer = async () => {
    try {
      const response = await fetch("/api/grc/customers");
      if (response.ok) {
        const data = await response.json();
        const foundCustomer = data.find((c: Customer) => c.id === customerId);
        setCustomer(foundCustomer || null);
      }
    } catch (error) {
      console.error("Error fetching customer:", error);
    }
  };

  const fetchFrameworks = async () => {
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
  };

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      description: "",
      type: "",
      country: "",
      industry: "",
    });
  };

  const resetImportState = () => {
    setImportFile(null);
    setImportErrors([]);
    setImportSuccess(null);
    setIsImporting(false);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsCreateDialogOpen(true);
  };

  const handleCreate = async () => {
    try {
      const response = await fetch("/api/frameworks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          isCustom: true,
          status: "Subscribed",
        }),
      });

      if (response.ok) {
        const newFramework = await response.json();
        setIsCreateDialogOpen(false);
        resetForm();
        fetchFrameworks();

        // Open the import dialog for the newly created framework
        setNewlyCreatedFrameworkId(newFramework.id);
        resetImportState();
        setIsImportDialogOpen(true);
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to create framework",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating framework:", error);
      toast({
        title: "Error",
        description: "Failed to create framework",
        variant: "destructive",
      });
    }
  };

  const handleFrameworkClick = (framework: Framework) => {
    router.push(`/compliance/control?frameworkId=${framework.id}`);
  };

  const handleBack = () => {
    router.push("/grc/customers");
  };

  // Import dialog file handlers
  const handleImportDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingImport(true);
  }, []);

  const handleImportDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingImport(false);
  }, []);

  const handleImportDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingImport(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        setImportFile(file);
        setImportErrors([]);
        setImportSuccess(null);
      } else {
        toast({
          title: "Invalid File",
          description: "Please upload an Excel file (.xlsx)",
          variant: "destructive",
        });
      }
    }
  }, [toast]);

  const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        setImportFile(file);
        setImportErrors([]);
        setImportSuccess(null);
      } else {
        toast({
          title: "Invalid File",
          description: "Please upload an Excel file (.xlsx)",
          variant: "destructive",
        });
      }
    }
  };

  // Download sample template (same as GRC Admin)
  const handleDownloadTemplate = async () => {
    try {
      // Dynamically import xlsx for client-side template generation
      const XLSX = await import("xlsx");

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheetData = [TEMPLATE_COLUMNS];
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

      // Set column widths
      const colWidths = TEMPLATE_COLUMNS.map((col) => ({ wch: Math.max(col.length + 5, 20) }));
      worksheet["!cols"] = colWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, "Requirements");

      // Generate and download
      XLSX.writeFile(workbook, "framework_requirements_template.xlsx");

      toast({
        title: "Template Downloaded",
        description: "Sample template has been downloaded successfully",
      });
    } catch (error) {
      console.error("Error generating template:", error);
      toast({
        title: "Error",
        description: "Failed to download template",
        variant: "destructive",
      });
    }
  };

  // Import Excel file (same as GRC Admin - API already handles customer scoping)
  const handleImport = async () => {
    if (!importFile || !newlyCreatedFrameworkId) return;

    setIsImporting(true);
    setImportErrors([]);
    setImportSuccess(null);

    try {
      const formData = new FormData();
      formData.append("file", importFile);

      const response = await fetch(`/api/frameworks/${newlyCreatedFrameworkId}/import`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setImportSuccess(result.message);
        fetchFrameworks();
        toast({
          title: "Import Successful",
          description: result.message,
        });
        // Auto-close the dialog after successful import
        handleCloseImportDialog();
      } else {
        if (result.details) {
          setImportErrors(result.details);
        }
        toast({
          title: "Import Failed",
          description: result.error || "Failed to import requirements",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error importing file:", error);
      toast({
        title: "Error",
        description: "Failed to import requirements",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleCloseImportDialog = () => {
    setIsImportDialogOpen(false);
    resetImportState();
    setNewlyCreatedFrameworkId(null);
  };

  const tabs = ["Framework", "Control", "Policy", "Evidence", "Master data"];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header Section */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            className="text-gray-600 hover:text-gray-800 p-0 h-auto"
            onClick={handleBack}
          >
            <ChevronLeft className="h-5 w-5 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-blue-700">Frameworks</h1>
            <p className="text-sm text-blue-600 bg-blue-100 px-2 py-1 mt-1 inline-block">
              {customer?.customerName || "Loading..."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={openCreateDialog}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Integrated Framework
          </Button>
          <Select value={creationMode} onValueChange={setCreationMode}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Manual">Manual</SelectItem>
              <SelectItem value="AI">AI</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs and Content */}
      <div className="flex gap-6">
        {/* Sidebar Tabs */}
        <div className="w-40 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={`w-full text-left px-4 py-3 rounded-sm transition-colors ${
                activeTab === tab
                  ? "bg-blue-50 text-blue-700 font-medium border-l-2 border-blue-600"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Framework Cards Grid */}
        <div className="flex-1">
          {activeTab === "Framework" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {frameworks.length === 0 ? (
                <div className="col-span-full text-center py-12 text-gray-500">
                  No frameworks found.
                </div>
              ) : (
                frameworks.map((framework) => (
                  <div
                    key={framework.id}
                    className={`bg-white rounded-lg shadow-sm border p-4 cursor-pointer hover:shadow-md transition-shadow ${
                      framework.isCustom ? "border-l-4 border-l-gray-400" : ""
                    }`}
                    onClick={() => handleFrameworkClick(framework)}
                  >
                    {/* Framework Name */}
                    <h4 className="text-base font-semibold text-blue-800 mb-4 truncate">
                      {framework.name}
                    </h4>

                    {/* Compliance Circle */}
                    <div className="flex justify-center mb-4">
                      <div className="relative w-28 h-28">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                          {/* Background circle */}
                          <circle
                            cx="50"
                            cy="50"
                            r="40"
                            fill="none"
                            stroke="#e5e7eb"
                            strokeWidth="8"
                          />
                          {/* Progress circle */}
                          <circle
                            cx="50"
                            cy="50"
                            r="40"
                            fill="none"
                            stroke="#22c55e"
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={`${framework.compliancePercentage * 2.51} 251`}
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-lg font-bold text-gray-800">
                            {framework.compliancePercentage.toFixed(1)}%
                          </span>
                          <span className="text-xs text-gray-500">Compliant</span>
                        </div>
                      </div>
                    </div>

                    {/* Policy and Evidence Progress Bars */}
                    <div className="space-y-3">
                      {/* Policy */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${framework.policyPercentage}%` }}
                          />
                        </div>
                        <div className="text-right min-w-[80px]">
                          <span className="text-sm font-medium">{framework.policyPercentage.toFixed(1)}%</span>
                          <span className="text-xs text-gray-500 ml-1">Policy</span>
                        </div>
                      </div>

                      {/* Evidence */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${framework.evidencePercentage}%` }}
                          />
                        </div>
                        <div className="text-right min-w-[80px]">
                          <span className="text-sm font-medium">{framework.evidencePercentage.toFixed(1)}%</span>
                          <span className="text-xs text-gray-500 ml-1">Evidence</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab !== "Framework" && (
            <div className="text-center py-12 text-gray-500">
              {activeTab} tab content
            </div>
          )}
        </div>
      </div>

      {/* Step 1: Create Framework Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Integrated Framework</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-500">
              Note: Custom framework will be automatically added in grey color to
              differentiate between Subscribed Frameworks.
            </p>

            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="Enter code"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-1">
                Integrated Framework Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter framework name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter description"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type" className="flex items-center gap-1">
                Framework Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Framework">Framework</SelectItem>
                  <SelectItem value="Standard">Standard</SelectItem>
                  <SelectItem value="Regulation">Regulation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="country" className="flex items-center gap-1">
                  Country <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="Enter country"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry" className="flex items-center gap-1">
                  Industry <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="industry"
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  placeholder="Enter industry"
                />
              </div>
            </div>

            {creationMode === "AI" && (
              <div className="space-y-2">
                <Label>Upload Support Document</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors border-gray-300 hover:border-gray-400">
                  <div className="flex flex-col items-center gap-2 text-gray-500">
                    <Upload className="h-8 w-8" />
                    <span className="text-sm">Click here, or drop files here to upload.</span>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="pt-4 border-t">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!formData.name || !formData.type || !formData.country || !formData.industry}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Create & Import
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Step 2: Import Requirements Dialog (same as GRC Admin) */}
      <Dialog open={isImportDialogOpen} onOpenChange={handleCloseImportDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
              Import Framework Requirements
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <p className="text-sm text-muted-foreground">
              Upload an Excel file (.xlsx) containing your framework requirements.
              You can download the sample template to see the required format.
            </p>

            {/* Download Template Button */}
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={handleDownloadTemplate}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download Sample Template
              </Button>
              <span className="text-sm text-muted-foreground">
                Use this template to ensure correct column headers
              </span>
            </div>

            {/* File Upload Area */}
            <div className="space-y-2">
              <Label>Upload Document</Label>
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDraggingImport
                    ? "border-green-500 bg-green-50"
                    : importFile
                    ? "border-green-500 bg-green-50"
                    : "border-gray-300 hover:border-gray-400"
                }`}
                onDragOver={handleImportDragOver}
                onDragLeave={handleImportDragLeave}
                onDrop={handleImportDrop}
                onClick={() => document.getElementById("import-file-upload")?.click()}
              >
                <input
                  id="import-file-upload"
                  type="file"
                  className="hidden"
                  onChange={handleImportFileSelect}
                  accept=".xlsx,.xls"
                />
                {importFile ? (
                  <div className="flex flex-col items-center gap-3">
                    <FileSpreadsheet className="h-12 w-12 text-green-500" />
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-green-600">
                        {importFile.name}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setImportFile(null);
                          setImportErrors([]);
                          setImportSuccess(null);
                        }}
                        className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {(importFile.size / 1024).toFixed(2)} KB
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Upload className="h-12 w-12" />
                    <div>
                      <span className="text-sm font-medium">
                        Click to upload or drag and drop
                      </span>
                      <p className="text-xs mt-1">Excel files only (.xlsx)</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Success Message */}
            {importSuccess && (
              <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-800">{importSuccess}</p>
                  {importErrors.length > 0 && (
                    <p className="text-xs text-green-600 mt-1">
                      Some warnings occurred during import. See details below.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Error Messages */}
            {importErrors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {importSuccess ? "Warnings" : "Validation Errors"}
                  </span>
                </div>
                <div className="max-h-40 overflow-y-auto border border-red-200 rounded-lg bg-red-50">
                  {importErrors.map((error, index) => (
                    <div
                      key={index}
                      className="px-3 py-2 text-sm text-red-700 border-b border-red-100 last:border-b-0"
                    >
                      {error.row > 0 && <span className="font-medium">Row {error.row}: </span>}
                      {error.column && <span className="font-medium">{error.column} - </span>}
                      {error.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Required Columns Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Required Column Headers:</p>
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_COLUMNS.map((col) => (
                  <span
                    key={col}
                    className="text-xs px-2 py-1 bg-white border rounded-md text-gray-600"
                  >
                    {col}
                  </span>
                ))}
              </div>
            </div>

            <DialogFooter className="pt-4 border-t">
              <Button variant="outline" onClick={handleCloseImportDialog}>
                {importSuccess ? "Close" : "Skip"}
              </Button>
              <Button
                onClick={handleImport}
                disabled={!importFile || isImporting}
                className="bg-green-600 hover:bg-green-700"
              >
                {isImporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
