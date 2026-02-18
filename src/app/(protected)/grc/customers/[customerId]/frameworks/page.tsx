"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  X,
  Search,
  Library,
  Layers,
  Shield,
  FileCheck,
  ClipboardList,
  LayoutGrid,
  Home,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isValidName } from "@/lib/validations";
import Link from "next/link";

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

interface AvailableFramework {
  id: string;
  code?: string;
  name: string;
  description?: string;
  type: string;
  status: string;
}

interface Customer {
  id: string;
  customerCode: string;
  customerName: string;
  email: string;
  userName: string;
  customerAccountId?: string;
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
  "Requirement Code",
  "Requirement Name",
  "Description",
  "Category",
  "Control Mapping",
];

export default function CustomerFrameworkOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { t } = useLanguage();
  const customerId = params.customerId as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>(
    searchParams.get("tab") === "masterdata" ? "Master data" : "Framework"
  );
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


  // Subscription error dialog
  const [showSubscriptionErrorDialog, setShowSubscriptionErrorDialog] = useState(false);
  const [subscriptionErrorMessage, setSubscriptionErrorMessage] = useState("");

  // Framework Select dialog states
  const [isSelectDialogOpen, setIsSelectDialogOpen] = useState(false);
  const [availableFrameworks, setAvailableFrameworks] = useState<AvailableFramework[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [subscribingId, setSubscribingId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<NewFramework>({
    code: "",
    name: "",
    description: "",
    type: "",
    country: "",
    industry: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

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
      const response = await fetch(`/api/grc/customers/${customerId}/frameworks`);
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

  const handleMasterDataTileClick = (type: string) => {
    router.push(`/grc/customers/${customerId}/master-data/${type}`);
  };

  const fetchAvailableFrameworks = async () => {
    setLoadingAvailable(true);
    try {
      const response = await fetch(`/api/grc/customers/${customerId}/frameworks/available`);
      if (response.ok) {
        const data = await response.json();
        setAvailableFrameworks(data);
      }
    } catch (error) {
      console.error("Error fetching available frameworks:", error);
    } finally {
      setLoadingAvailable(false);
    }
  };

  const handleSubscribeFramework = async (frameworkId: string, action: "subscribe" | "suggest") => {
    // Check subscription status before subscribing
    try {
      const statusRes = await fetch(`/api/subscription-status?customerId=${customerId}`);
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (!statusData.allowed) {
          if (statusData.reason === "expired") {
            setSubscriptionErrorMessage(t("Subscription plan has expired, kindly contact VerifAI support"));
          } else {
            setSubscriptionErrorMessage(t("You don't have an active Subscription plan, kindly contact VerifAI support"));
          }
          setShowSubscriptionErrorDialog(true);
          return;
        }
        // Check max frameworks limit
        if (statusData.maxFrameworksAllowed !== undefined && statusData.frameworksUsed >= statusData.maxFrameworksAllowed) {
          setSubscriptionErrorMessage(t("Maximum frameworks limit reached. Your plan allows") + ` ${statusData.maxFrameworksAllowed} ` + t("frameworks") + `. ` + t("Kindly contact VerifAI support to upgrade your plan."));
          setShowSubscriptionErrorDialog(true);
          return;
        }
      }
    } catch (error) {
      console.error("Error checking subscription status:", error);
    }

    setSubscribingId(frameworkId);
    try {
      const response = await fetch(`/api/grc/customers/${customerId}/frameworks/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frameworkId, action }),
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: t("Success"),
          description: result.message,
        });
        fetchFrameworks();
        fetchAvailableFrameworks();
      } else {
        const error = await response.json();
        toast({
          title: t("Error"),
          description: error.error || t("Failed to process framework"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error subscribing framework:", error);
      toast({
        title: t("Error"),
        description: t("Failed to process framework"),
        variant: "destructive",
      });
    } finally {
      setSubscribingId(null);
    }
  };

  const openSelectDialog = () => {
    setSearchQuery("");
    setIsSelectDialogOpen(true);
    fetchAvailableFrameworks();
  };

  const filteredAvailableFrameworks = availableFrameworks.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      description: "",
      type: "",
      country: "",
      industry: "",
    });
    setFormErrors({});
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
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = t("Framework name is required");
    } else if (!isValidName(formData.name.trim())) {
      newErrors.name = t("Only letters, spaces, and hyphens are allowed");
    }
    if (!formData.code.trim()) {
      // code is optional, no error
    } else if (!isValidName(formData.code.trim())) {
      newErrors.code = t("Only letters, spaces, and hyphens are allowed");
    }
    if (Object.keys(newErrors).length > 0) {
      setFormErrors(newErrors);
      return;
    }
    setFormErrors({});
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
          title: t("Error"),
          description: error.error || t("Failed to create framework"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating framework:", error);
      toast({
        title: t("Error"),
        description: t("Failed to create framework"),
        variant: "destructive",
      });
    }
  };

  const handleFrameworkClick = (framework: Framework) => {
    router.push(`/grc/customers/${customerId}/controls?frameworkId=${framework.id}`);
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
          title: t("Invalid File"),
          description: t("Please upload an Excel file (.xlsx)"),
          variant: "destructive",
        });
      }
    }
  }, [toast, t]);

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
          title: t("Invalid File"),
          description: t("Please upload an Excel file (.xlsx)"),
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
        title: t("Template Downloaded"),
        description: t("Sample template has been downloaded successfully"),
      });
    } catch (error) {
      console.error("Error generating template:", error);
      toast({
        title: t("Error"),
        description: t("Failed to download template"),
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
          title: t("Import Successful"),
          description: result.message,
        });
        // Auto-close the dialog after successful import
        handleCloseImportDialog();
      } else {
        if (result.details) {
          setImportErrors(result.details);
        }
        toast({
          title: t("Import Failed"),
          description: result.error || t("Failed to import requirements"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error importing file:", error);
      toast({
        title: t("Error"),
        description: t("Failed to import requirements"),
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

  const tabs = ["Framework", "Master data"];

  if (loading) {
    return (
      <div className="space-y-6">
        <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
          <Link href="/grc" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
            <Home className="h-4 w-4" />
            <span>{t("GRC")}</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <Link href="/grc/customers" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Customers")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-primary-700 font-medium">{t("Customer")}</span>
        </nav>
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Customer")}</h1>
        </div>
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
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <Link href="/grc" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("GRC")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/grc/customers" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Customers")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{customer?.customerName || t("Customer")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
          {customer?.customerName || t("Customer")}
        </h1>
        {activeTab === "Framework" && (
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
            <Button
              onClick={openSelectDialog}
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none"
            >
              <Library className="h-4 w-4 me-2" />
              {t("Framework Select")}
            </Button>
            <Button
              onClick={openCreateDialog}
              size="sm"
              className="flex-1 sm:flex-none"
            >
              <Plus className="h-4 w-4 me-2" />
              {t("New Framework")}
            </Button>
          </div>
        )}
      </div>

      {/* Horizontal Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`px-5 py-2.5 rounded-t-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-primary-50 text-primary-700 border-b-2 border-primary-500"
                : "text-slate-600 hover:bg-slate-50"
            }`}
            onClick={() => {
              setActiveTab(tab);
            }}
          >
            {t(tab)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
          {activeTab === "Framework" && (
            <div>
              {frameworks.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                    <Layers className="h-6 w-6 text-primary-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-600">{t("No frameworks found")}</p>
                  <p className="text-xs text-slate-400 mt-1">{t("Subscribe or create a new framework to get started.")}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {frameworks.map((framework) => {
                    const typeBadge = framework.type === "Regulation" ? "bg-purple-50 text-purple-700 border-purple-200" : framework.type === "Standard" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-blue-50 text-blue-700 border-blue-200";
                    return (
                      <div
                        key={framework.id}
                        className={`rounded-xl border overflow-hidden ${framework.isCustom ? "border-slate-200 bg-slate-50/30" : "border-slate-200 bg-white"}`}
                      >
                        {/* Header: Name + Type */}
                        <div className="px-4 pt-4 pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h4
                                className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2 cursor-pointer hover:text-primary-600 transition-colors"
                                onClick={() => handleFrameworkClick(framework)}
                              >
                                {framework.name}
                              </h4>
                              {framework.type && (
                                <span className={`inline-flex mt-1.5 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${typeBadge}`}>
                                  {framework.type}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Navigable Rows */}
                        <div className="border-t border-slate-100">
                          {/* Controls Row */}
                          <div
                            className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors"
                            onClick={() => handleFrameworkClick(framework)}
                          >
                            <div className="relative w-10 h-10 flex-shrink-0">
                              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="40" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                                <circle
                                  cx="50" cy="50" r="40" fill="none" stroke="#22c55e" strokeWidth="10"
                                  strokeLinecap="round"
                                  strokeDasharray={`${framework.compliancePercentage * 2.51} 251`}
                                />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-[9px] font-bold text-slate-800">{framework.compliancePercentage.toFixed(0)}%</span>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-medium text-slate-700">{t("Controls")}</span>
                              <p className="text-[11px] text-slate-400">{t("Compliance")}</p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0 ltr:rotate-0 rtl:rotate-180" />
                          </div>

                          {/* Policies Row */}
                          <div
                            className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors"
                            onClick={() => router.push(`/grc/customers/${customerId}/policies?frameworkId=${framework.id}`)}
                          >
                            <div className="w-10 flex-shrink-0 flex items-center justify-center">
                              <span className="text-sm font-bold text-primary-600">{framework.policyPercentage.toFixed(0)}%</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-medium text-slate-700">{t("Policies")}</span>
                              <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary-500 rounded-full transition-all"
                                  style={{ width: `${framework.policyPercentage}%` }}
                                />
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0 ltr:rotate-0 rtl:rotate-180" />
                          </div>

                          {/* Evidence Row */}
                          <div
                            className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                            onClick={() => router.push(`/grc/customers/${customerId}/evidence?frameworkId=${framework.id}`)}
                          >
                            <div className="w-10 flex-shrink-0 flex items-center justify-center">
                              <span className="text-sm font-bold text-amber-600">{framework.evidencePercentage.toFixed(0)}%</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-medium text-slate-700">{t("Evidence")}</span>
                              <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-amber-500 rounded-full transition-all"
                                  style={{ width: `${framework.evidencePercentage}%` }}
                                />
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0 ltr:rotate-0 rtl:rotate-180" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "Master data" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {[
                { key: "framework", label: t("Framework"), desc: t("Manage compliance frameworks"), icon: Layers },
                { key: "controls", label: t("Controls"), desc: t("Manage control definitions"), icon: Shield },
                { key: "policies", label: t("Policies"), desc: t("Manage policy documents"), icon: FileCheck },
                { key: "evidences", label: t("Evidences"), desc: t("Manage evidence items"), icon: ClipboardList },
                { key: "domains", label: t("Domain"), desc: t("Manage control domains"), icon: LayoutGrid },
              ].map((tile) => (
                <button
                  key={tile.key}
                  className="bg-white rounded-xl border border-slate-200 p-3 sm:p-5 flex items-center gap-4 ltr:text-left rtl:text-right cursor-pointer"
                  onClick={() => handleMasterDataTileClick(tile.key)}
                >
                  <div className="p-3 bg-primary-50 rounded-xl flex-shrink-0">
                    <tile.icon className="h-5 w-5 text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-slate-800">{tile.label}</h4>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{tile.desc}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0 ltr:rotate-0 rtl:rotate-180" />
                </button>
              ))}
            </div>
          )}

      </div>

      {/* Framework Select Dialog */}
      <Dialog open={isSelectDialogOpen} onOpenChange={setIsSelectDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {t("Framework Select")}
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5 space-y-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder={t("Search By Framework Name")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ltr:pl-9 rtl:pr-9 bg-white border-slate-200 rounded-lg"
              />
            </div>

            {/* Available Frameworks List */}
            <div className="max-h-[50vh] overflow-y-auto space-y-3">
              {loadingAvailable ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
                </div>
              ) : filteredAvailableFrameworks.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-4">
                    <Shield className="h-6 w-6 text-primary-500" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-800 mb-1">
                    {searchQuery
                      ? t("No Frameworks Found")
                      : t("No Available Frameworks")}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {searchQuery
                      ? t("No frameworks match your search.")
                      : t("No available frameworks to subscribe.")}
                  </p>
                </div>
              ) : (
                filteredAvailableFrameworks.map((framework) => (
                  <div
                    key={framework.id}
                    className="border border-slate-200 rounded-xl p-4 hover:bg-slate-50 transition-colors"
                  >
                    <h4 className="text-sm font-semibold text-slate-800 mb-1">
                      {framework.name}
                    </h4>
                    {framework.description && (
                      <p className="text-sm text-slate-500 mb-3">
                        {framework.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        disabled={subscribingId === framework.id}
                        onClick={() => handleSubscribeFramework(framework.id, "subscribe")}
                      >
                        {subscribingId === framework.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent me-1" />
                        ) : null}
                        {t("Subscribe")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={subscribingId === framework.id}
                        onClick={() => handleSubscribeFramework(framework.id, "suggest")}
                      >
                        {t("Add to Suggestion")}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="flex justify-end px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button
              size="sm"
              onClick={() => setIsSelectDialogOpen(false)}
            >
              {t("Done")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Step 1: Create Framework Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Create Integrated Framework")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
            <p className="text-sm text-slate-500">
              {t("Note: Custom framework will be automatically added in grey color to differentiate between Subscribed Frameworks.")}
            </p>

            <div className="space-y-2">
              <Label htmlFor="code" className="text-sm font-medium text-slate-700">{t("Code")}</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => { setFormData({ ...formData, code: e.target.value }); setFormErrors((prev) => ({ ...prev, code: "" })); }}
                placeholder={t("Enter code")}
                className="bg-white border-slate-200 rounded-lg"
              />
              {formErrors.code && <p className="text-sm text-red-500">{formErrors.code}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-1 text-sm font-medium text-slate-700">
                {t("Integrated Framework Name")} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => { setFormData({ ...formData, name: e.target.value }); setFormErrors((prev) => ({ ...prev, name: "" })); }}
                placeholder={t("Enter framework name")}
                className="bg-white border-slate-200 rounded-lg"
              />
              {formErrors.name && <p className="text-sm text-red-500">{formErrors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium text-slate-700">{t("Description")}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t("Enter description")}
                rows={3}
                className="bg-white border-slate-200 rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type" className="flex items-center gap-1 text-sm font-medium text-slate-700">
                {t("Framework Type")} <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger className="bg-white border-slate-200 rounded-lg">
                  <SelectValue placeholder={t("Select type")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Framework">{t("Framework")}</SelectItem>
                  <SelectItem value="Standard">{t("Standard")}</SelectItem>
                  <SelectItem value="Regulation">{t("Regulation")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="country" className="flex items-center gap-1 text-sm font-medium text-slate-700">
                  {t("Country")} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder={t("Enter country")}
                  className="bg-white border-slate-200 rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry" className="flex items-center gap-1 text-sm font-medium text-slate-700">
                  {t("Industry")} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="industry"
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  placeholder={t("Enter industry")}
                  className="bg-white border-slate-200 rounded-lg"
                />
              </div>
            </div>

            {creationMode === "AI" && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">{t("Upload Support Document")}</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors border-slate-300 hover:border-slate-400 hover:bg-slate-50">
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <Upload className="h-8 w-8" />
                    <span className="text-sm">{t("Click here, or drop files here to upload.")}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" size="sm" onClick={() => setIsCreateDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!formData.name || !formData.type || !formData.country || !formData.industry}
            >
              {t("Create & Import")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Step 2: Import Requirements Dialog (same as GRC Admin) */}
      <Dialog open={isImportDialogOpen} onOpenChange={handleCloseImportDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary-500" />
                {t("Import Framework Requirements")}
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5 space-y-5 max-h-[65vh] overflow-y-auto">
            <p className="text-sm text-slate-500">
              {t("Upload an Excel file (.xlsx) containing your framework requirements. You can download the sample template to see the required format.")}
            </p>

            {/* Download Template Button */}
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                {t("Download Sample Template")}
              </Button>
              <span className="text-sm text-slate-500">
                {t("Use this template to ensure correct column headers")}
              </span>
            </div>

            {/* File Upload Area */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">{t("Upload Document")}</Label>
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDraggingImport
                    ? "border-primary-500 bg-primary-50"
                    : importFile
                    ? "border-primary-500 bg-primary-50"
                    : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
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
                    <FileSpreadsheet className="h-12 w-12 text-primary-500" />
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-primary-700">
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
                        className="h-6 w-6 p-0 text-slate-400 hover:text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <span className="text-xs text-slate-500">
                      {(importFile.size / 1024).toFixed(2)} KB
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-slate-500">
                    <Upload className="h-12 w-12" />
                    <div>
                      <span className="text-sm font-medium">
                        {t("Click to upload or drag and drop")}
                      </span>
                      <p className="text-xs mt-1">{t("Excel files only (.xlsx)")}</p>
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
                      {t("Some warnings occurred during import. See details below.")}
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
                    {importSuccess ? t("Warnings") : t("Validation Errors")}
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
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm font-medium text-slate-700 mb-2">{t("Required Column Headers:")}</p>
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_COLUMNS.map((col) => (
                  <span
                    key={col}
                    className="text-xs px-2 py-1 bg-white border border-slate-200 rounded-md text-slate-600"
                  >
                    {col}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" size="sm" onClick={handleCloseImportDialog}>
              {importSuccess ? t("Close") : t("Skip")}
            </Button>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={!importFile || isImporting}
            >
              {isImporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent me-2" />
                  {t("Importing...")}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 me-2" />
                  {t("Import")}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Subscription Error Dialog */}
      <Dialog open={showSubscriptionErrorDialog} onOpenChange={setShowSubscriptionErrorDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-red-600">{t("Error")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5">
            <p className="text-slate-600">{subscriptionErrorMessage}</p>
          </div>
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex justify-end">
            <Button size="sm" onClick={() => setShowSubscriptionErrorDialog(false)}>
              {t("OK")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
