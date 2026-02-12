"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
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
  Search,
  Library,
  Layers,
  Shield,
  FileCheck,
  ClipboardList,
  LayoutGrid,
  Pencil,
  Trash2,
  ArrowUpDown,
  Eye,
  UserCheck,
  Server,
  CheckCircle,
  XCircle,
  Home,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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

interface ControlItem {
  id: string;
  controlCode: string;
  name: string;
  description: string | null;
  functionalGrouping: string | null;
  status: string;
  entities: string;
  domain: { id: string; name: string } | null;
  framework: { id: string; name: string } | null;
}

interface PolicyItem {
  id: string;
  code: string;
  name: string;
  documentType: string;
  status: string;
  version: string;
  department: { id: string; name: string } | null;
  assignee: { id: string; fullName: string } | null;
  approver: { id: string; fullName: string } | null;
}

interface EvidenceItem {
  id: string;
  evidenceCode: string;
  name: string;
  description: string | null;
  status: string;
  domain: string | null;
  framework: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  assignee: { id: string; fullName: string } | null;
}

interface DomainItem {
  id: string;
  name: string;
  _count: { controls: number };
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
  const { toast } = useToast();
  const { t } = useLanguage();
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

  // Control sub-tab state
  const [controlSubTab, setControlSubTab] = useState<"dashboard" | "all">("dashboard");
  const [controlSearchQuery, setControlSearchQuery] = useState("");
  const [controlDomainFilter, setControlDomainFilter] = useState<string>("all");
  const [controlFgFilter, setControlFgFilter] = useState<string>("all");
  const [controlSortField, setControlSortField] = useState<string>("name");
  const [controlSortAsc, setControlSortAsc] = useState(true);
  const [controlShowColumns, setControlShowColumns] = useState(true);
  const [selectedControlFrameworkId, setSelectedControlFrameworkId] = useState<string>("all");

  // Policy sub-tab state
  const [policySubTab, setPolicySubTab] = useState<"Dashboard" | "Policy" | "Standard" | "Procedure">("Dashboard");
  const [policySearchQuery, setPolicySearchQuery] = useState("");
  const [policyStatusFilter, setPolicyStatusFilter] = useState<string>("all");
  const [policyFrameworkFilter, setPolicyFrameworkFilter] = useState<string>("all");
  const [policySortField, setPolicySortField] = useState<string>("name");
  const [policySortAsc, setPolicySortAsc] = useState(true);

  // Evidence sub-tab state
  const [evidenceSubTab, setEvidenceSubTab] = useState<"Dashboard" | "AllEvidence">("Dashboard");
  const [evidenceSearchQuery, setEvidenceSearchQuery] = useState("");
  const [evidenceDeptFilter, setEvidenceDeptFilter] = useState<string>("all");
  const [evidenceFrameworkFilter, setEvidenceFrameworkFilter] = useState<string>("all");
  const [evidenceSortField, setEvidenceSortField] = useState<string>("evidenceCode");
  const [evidenceSortAsc, setEvidenceSortAsc] = useState(true);

  // Master data states
  const [masterDataView, setMasterDataView] = useState<string | null>(null);
  const [controls, setControls] = useState<ControlItem[]>([]);
  const [policies, setPolicies] = useState<PolicyItem[]>([]);
  const [evidences, setEvidences] = useState<EvidenceItem[]>([]);
  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [masterDataLoading, setMasterDataLoading] = useState(false);

  // Master data edit/delete states
  const [editItem, setEditItem] = useState<{ id: string; name: string; type: string } | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [isEditItemDialogOpen, setIsEditItemDialogOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{ id: string; name: string; type: string } | null>(null);
  const [isDeleteItemDialogOpen, setIsDeleteItemDialogOpen] = useState(false);

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

  const fetchMasterData = async (type: string) => {
    setMasterDataLoading(true);
    try {
      const response = await fetch(`/api/grc/customers/${customerId}/${type}`);
      if (response.ok) {
        const data = await response.json();
        if (type === "controls") setControls(data);
        else if (type === "policies") setPolicies(data);
        else if (type === "evidences") setEvidences(data);
        else if (type === "domains") setDomains(data);
      }
    } catch (error) {
      console.error(`Error fetching customer ${type}:`, error);
    } finally {
      setMasterDataLoading(false);
    }
  };

  const handleMasterDataTileClick = (type: string) => {
    if (type === "framework") {
      router.push(`/grc/customers/${customerId}/master-data/framework`);
      return;
    }
    setMasterDataView(type);
    fetchMasterData(type);
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
      const statusRes = await fetch("/api/subscription-status");
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
    router.push(`/compliance/control?frameworkId=${framework.id}`);
  };

  const handleBack = () => {
    router.push("/grc/customers");
  };

  // Master data edit/delete handlers
  const getApiPath = (type: string) => {
    switch (type) {
      case "controls": return "controls";
      case "policies": return "policies";
      case "evidences": return "evidences";
      case "domains": return "control-domains";
      default: return type;
    }
  };

  const handleEditItem = (id: string, name: string, type: string) => {
    setEditItem({ id, name, type });
    setEditItemName(name);
    setIsEditItemDialogOpen(true);
  };

  const handleSaveEditItem = async () => {
    if (!editItem) return;
    try {
      const response = await fetch(`/api/${getApiPath(editItem.type)}/${editItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editItemName }),
      });
      if (response.ok) {
        toast({ title: t("Success"), description: t("Item updated successfully") });
        fetchMasterData(editItem.type);
        setIsEditItemDialogOpen(false);
      } else {
        const error = await response.json();
        toast({ title: t("Error"), description: error.error || t("Failed to update"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error updating item:", error);
      toast({ title: t("Error"), description: t("Failed to update"), variant: "destructive" });
    }
  };

  const handleDeleteItem = (id: string, name: string, type: string) => {
    setDeleteItem({ id, name, type });
    setIsDeleteItemDialogOpen(true);
  };

  const handleConfirmDeleteItem = async () => {
    if (!deleteItem) return;
    try {
      const response = await fetch(`/api/${getApiPath(deleteItem.type)}/${deleteItem.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        toast({ title: t("Success"), description: t("Item deleted successfully") });
        fetchMasterData(deleteItem.type);
        setIsDeleteItemDialogOpen(false);
      } else {
        const error = await response.json();
        toast({ title: t("Error"), description: error.error || t("Failed to delete"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error deleting item:", error);
      toast({ title: t("Error"), description: t("Failed to delete"), variant: "destructive" });
    }
  };

  // Functional grouping constants and donut chart data for Control Dashboard
  const FUNCTIONAL_GROUPINGS = ["Govern", "Identify", "Protect", "Detect", "Respond", "Recover"];
  const DONUT_COLORS = [
    "#3b82f6", // blue - Govern
    "#f97316", // orange - Identify
    "#22c55e", // green - Protect
    "#ef4444", // red - Detect
    "#a855f7", // purple - Respond
    "#78716c", // brown - Recover
  ];

  const fgData = useMemo(() => {
    const counts: Record<string, number> = {};
    controls.forEach((c) => {
      const fg = c.functionalGrouping || "Unknown";
      counts[fg] = (counts[fg] || 0) + 1;
    });
    const total = controls.length || 1;
    return FUNCTIONAL_GROUPINGS.filter((fg) => counts[fg]).map((fg, i) => ({
      label: fg,
      count: counts[fg] || 0,
      percentage: (((counts[fg] || 0) / total) * 100).toFixed(1),
      color: DONUT_COLORS[i],
    }));
  }, [controls]);

  const renderControlDonutChart = () => {
    if (fgData.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          {t("No control data available for chart.")}
        </div>
      );
    }

    const total = controls.length;
    const size = 280;
    const cx = size / 2;
    const cy = size / 2;
    const outerR = 120;
    const innerR = 70;

    let currentAngle = -90;

    const paths = fgData.map((item) => {
      const angle = (item.count / total) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;

      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      const x1Outer = cx + outerR * Math.cos(startRad);
      const y1Outer = cy + outerR * Math.sin(startRad);
      const x2Outer = cx + outerR * Math.cos(endRad);
      const y2Outer = cy + outerR * Math.sin(endRad);
      const x1Inner = cx + innerR * Math.cos(endRad);
      const y1Inner = cy + innerR * Math.sin(endRad);
      const x2Inner = cx + innerR * Math.cos(startRad);
      const y2Inner = cy + innerR * Math.sin(startRad);

      const largeArc = angle > 180 ? 1 : 0;

      const midAngle = ((startAngle + endAngle) / 2 * Math.PI) / 180;
      const labelR = (outerR + innerR) / 2;
      const labelX = cx + labelR * Math.cos(midAngle);
      const labelY = cy + labelR * Math.sin(midAngle);

      const d = [
        `M ${x1Outer} ${y1Outer}`,
        `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2Outer} ${y2Outer}`,
        `L ${x1Inner} ${y1Inner}`,
        `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2Inner} ${y2Inner}`,
        "Z",
      ].join(" ");

      return { d, color: item.color, label: `${item.percentage}%`, labelX, labelY, angle };
    });

    return (
      <div className="flex items-center gap-12">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {paths.map((p, i) => (
            <g key={i}>
              <path d={p.d} fill={p.color} stroke="white" strokeWidth="2" />
              {p.angle > 15 && (
                <text
                  x={p.labelX}
                  y={p.labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize="11"
                  fontWeight="600"
                >
                  {p.label}
                </text>
              )}
            </g>
          ))}
        </svg>

        <div className="space-y-2">
          {fgData.map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-sm"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm text-gray-700">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Control stats
  const controlStats = useMemo(() => {
    const total = controls.length;
    const nonCompliant = controls.filter((c) => c.status === "Non Compliant").length;
    const compliant = controls.filter((c) => c.status === "Compliant").length;
    const notApplicable = controls.filter((c) => c.status === "Not Applicable").length;
    return { total, nonCompliant, compliant, notApplicable };
  }, [controls]);

  // Unique domains for control filter
  const controlDomains = useMemo(() => {
    const domainMap = new Map<string, string>();
    controls.forEach((c) => {
      if (c.domain) domainMap.set(c.domain.id, c.domain.name);
    });
    return Array.from(domainMap.entries()).map(([id, name]) => ({ id, name }));
  }, [controls]);

  // Filtered and sorted controls
  const filteredSortedControls = useMemo(() => {
    let result = [...controls];

    if (controlSearchQuery) {
      const q = controlSearchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.controlCode.toLowerCase().includes(q)
      );
    }

    if (controlDomainFilter && controlDomainFilter !== "all") {
      result = result.filter((c) => c.domain?.id === controlDomainFilter);
    }

    if (controlFgFilter && controlFgFilter !== "all") {
      result = result.filter((c) => c.functionalGrouping === controlFgFilter);
    }

    result.sort((a, b) => {
      let valA = "";
      let valB = "";
      switch (controlSortField) {
        case "name": valA = a.name; valB = b.name; break;
        case "controlCode": valA = a.controlCode; valB = b.controlCode; break;
        case "functionalGrouping": valA = a.functionalGrouping || ""; valB = b.functionalGrouping || ""; break;
        case "status": valA = a.status; valB = b.status; break;
        case "domain": valA = a.domain?.name || ""; valB = b.domain?.name || ""; break;
        default: valA = a.name; valB = b.name;
      }
      return controlSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });

    return result;
  }, [controls, controlSearchQuery, controlDomainFilter, controlFgFilter, controlSortField, controlSortAsc]);

  const handleControlSort = (field: string) => {
    if (controlSortField === field) {
      setControlSortAsc(!controlSortAsc);
    } else {
      setControlSortField(field);
      setControlSortAsc(true);
    }
  };

  // Fetch controls filtered by framework
  const fetchControlsForFramework = async (frameworkId?: string) => {
    setMasterDataLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (frameworkId && frameworkId !== "all") {
        queryParams.set("frameworkId", frameworkId);
      }
      const response = await fetch(
        `/api/grc/customers/${customerId}/controls?${queryParams.toString()}`
      );
      if (response.ok) {
        const data = await response.json();
        setControls(data);
      }
    } catch (error) {
      console.error("Error fetching controls:", error);
    } finally {
      setMasterDataLoading(false);
    }
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

  const tabs = ["Framework", "Control", "Policy", "Evidence", "Master data"];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/grc" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("GRC")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <Link href="/grc/customers" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Customers")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-slate-500">{customer?.customerName || t("Customer")}</span>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Frameworks")}</span>
      </nav>

      {/* Header Section - only visible on Framework tab */}
      {activeTab === "Framework" && (
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-slate-800">{t("Frameworks")}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={openSelectDialog}
              variant="outline"
              size="sm"
            >
              <Library className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("Framework Select")}
            </Button>
            <Button
              onClick={openCreateDialog}
              size="sm"
            >
              <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("New Integrated Framework")}
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
      )}

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
              onClick={() => {
                setActiveTab(tab);
                setMasterDataView(null);
                if (tab === "Control") fetchMasterData("controls");
                else if (tab === "Policy") fetchMasterData("policies");
                else if (tab === "Evidence") fetchMasterData("evidences");
              }}
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
                  {t("No frameworks found.")}
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
                          <span className="text-xs text-gray-500">{t("Compliant")}</span>
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
                          <span className="text-xs text-gray-500 ml-1">{t("Policy")}</span>
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
                          <span className="text-xs text-gray-500 ml-1">{t("Evidence")}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "Control" && (
            <div className="space-y-6">
              {/* Header */}
              <div className="border-b pb-4">
                <h1 className="text-2xl font-bold text-blue-700">{t("Controls")}</h1>
                <p className="text-sm text-blue-800 font-medium bg-blue-100 px-2 py-0.5 rounded inline-block mt-1">
                  {customer?.customerName || t("Loading...")}
                </p>
              </div>

              {/* Sub-tabs + Framework Dropdown */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-0">
                  <button
                    className={`px-6 py-2.5 text-sm font-semibold transition-colors ${
                      controlSubTab === "dashboard"
                        ? "bg-blue-800 text-white"
                        : "bg-white text-blue-700 border border-blue-200 hover:bg-blue-50"
                    }`}
                    onClick={() => setControlSubTab("dashboard")}
                  >
                    {t("Dashboard")}
                  </button>
                  <button
                    className={`px-6 py-2.5 text-sm font-semibold transition-colors ${
                      controlSubTab === "all"
                        ? "bg-blue-800 text-white"
                        : "bg-white text-blue-700 border border-blue-200 hover:bg-blue-50"
                    }`}
                    onClick={() => setControlSubTab("all")}
                  >
                    {t("All Controls")}
                  </button>
                </div>

                <Select
                  value={selectedControlFrameworkId}
                  onValueChange={(val) => {
                    setSelectedControlFrameworkId(val);
                    fetchControlsForFramework(val);
                  }}
                >
                  <SelectTrigger className="w-[200px] border-gray-300">
                    <SelectValue placeholder={t("Framework")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("All Frameworks")}</SelectItem>
                    {frameworks.map((fw) => (
                      <SelectItem key={fw.id} value={fw.id}>
                        {fw.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Dashboard View */}
              {controlSubTab === "dashboard" && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-gray-800">
                    {t("Functional Grouping")}
                  </h2>
                  {masterDataLoading ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  ) : (
                    <div className="flex justify-center py-8">
                      {renderControlDonutChart()}
                    </div>
                  )}
                </div>
              )}

              {/* All Controls View */}
              {controlSubTab === "all" && (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-4 gap-4">
                    {[
                      {
                        label: t("Total Controls"),
                        value: controlStats.total,
                        icon: <UserCheck className="h-8 w-8 text-white/80" />,
                      },
                      {
                        label: t("Non Compliant"),
                        value: controlStats.nonCompliant,
                        icon: <Server className="h-8 w-8 text-white/80" />,
                      },
                      {
                        label: t("Compliant"),
                        value: controlStats.compliant,
                        icon: <CheckCircle className="h-8 w-8 text-white/80" />,
                      },
                      {
                        label: t("Not Applicable"),
                        value: controlStats.notApplicable,
                        icon: <XCircle className="h-8 w-8 text-white/80" />,
                      },
                    ].map((card) => (
                      <div
                        key={card.label}
                        className="rounded-xl p-6 text-white text-center"
                        style={{
                          background:
                            "linear-gradient(135deg, #0a0a5c 0%, #1a1a8c 50%, #2d1b69 100%)",
                        }}
                      >
                        <div className="flex justify-center mb-3">
                          <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/40 flex items-center justify-center">
                            {card.icon}
                          </div>
                        </div>
                        <div className="text-3xl font-bold mb-1">{card.value}</div>
                        <div className="text-sm text-white/80">{card.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Search and Filters */}
                  <div className="flex items-center gap-4">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder={t("Search By Control Code, Name")}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={controlSearchQuery}
                        onChange={(e) => setControlSearchQuery(e.target.value)}
                      />
                    </div>

                    <Select value={controlDomainFilter} onValueChange={setControlDomainFilter}>
                      <SelectTrigger className="w-[180px] border-gray-300">
                        <SelectValue placeholder={t("Domain")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("All Domains")}</SelectItem>
                        {controlDomains.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={controlFgFilter} onValueChange={setControlFgFilter}>
                      <SelectTrigger className="w-[200px] border-gray-300">
                        <SelectValue placeholder={t("Functional Grouping")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("All Groupings")}</SelectItem>
                        {FUNCTIONAL_GROUPINGS.map((fg) => (
                          <SelectItem key={fg} value={fg}>
                            {fg}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Controls Table */}
                  {masterDataLoading ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="w-full text-sm">
                        <thead>
                          <tr
                            style={{
                              background:
                                "linear-gradient(135deg, #0a0a5c 0%, #1a1a8c 50%, #0d0d6b 100%)",
                            }}
                          >
                            <th className="text-left p-4 text-white font-semibold">
                              <button
                                className="flex items-center gap-1 hover:text-white/80"
                                onClick={() => handleControlSort("name")}
                              >
                                {t("Control Name")}
                                <ArrowUpDown className="h-3 w-3" />
                              </button>
                            </th>
                            <th className="text-left p-4 text-white font-semibold">
                              <button
                                className="flex items-center gap-1 hover:text-white/80"
                                onClick={() => handleControlSort("controlCode")}
                              >
                                {t("Control Code")}
                                <ArrowUpDown className="h-3 w-3" />
                              </button>
                            </th>
                            <th className="text-left p-4 text-white font-semibold">
                              <button
                                className="flex items-center gap-1 hover:text-white/80"
                                onClick={() => handleControlSort("functionalGrouping")}
                              >
                                {t("Functional Grouping")}
                                <ArrowUpDown className="h-3 w-3" />
                              </button>
                            </th>
                            <th className="text-left p-4 text-white font-semibold">
                              <button
                                className="flex items-center gap-1 hover:text-white/80"
                                onClick={() => handleControlSort("status")}
                              >
                                {t("Status")}
                                <ArrowUpDown className="h-3 w-3" />
                              </button>
                            </th>
                            <th className="text-left p-4 text-white font-semibold">
                              {t("Assignee")}
                            </th>
                            <th className="text-left p-4 text-white font-semibold">
                              <button
                                className="flex items-center gap-1 hover:text-white/80"
                                onClick={() => handleControlSort("domain")}
                              >
                                {t("Domain Name")}
                                <ArrowUpDown className="h-3 w-3" />
                              </button>
                            </th>
                            <th className="text-center p-4 text-white font-semibold w-12">
                              <button
                                onClick={() => setControlShowColumns(!controlShowColumns)}
                                className="text-white/80 hover:text-white border border-white/40 rounded p-1"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredSortedControls.length === 0 ? (
                            <tr>
                              <td
                                colSpan={7}
                                className="text-center py-12 text-gray-500"
                              >
                                {t("No controls found.")}
                              </td>
                            </tr>
                          ) : (
                            filteredSortedControls.map((control, index) => (
                              <tr
                                key={control.id}
                                className={`border-b hover:bg-blue-50/50 ${
                                  index % 2 === 0 ? "bg-white" : "bg-blue-50/30"
                                }`}
                              >
                                <td className="p-4 text-gray-800" title={control.name}>
                                  {control.name.length > 25
                                    ? control.name.substring(0, 25) + "..."
                                    : control.name}
                                </td>
                                <td className="p-4 text-gray-700">
                                  {control.controlCode}
                                </td>
                                <td className="p-4 text-gray-700">
                                  {control.functionalGrouping || "-"}
                                </td>
                                <td className="p-4">
                                  <span
                                    className={`text-sm font-medium ${
                                      control.status === "Compliant"
                                        ? "text-green-600"
                                        : control.status === "Non Compliant"
                                        ? "text-red-600"
                                        : control.status === "Partial Compliant"
                                        ? "text-yellow-600"
                                        : "text-gray-500"
                                    }`}
                                  >
                                    {control.status}
                                  </span>
                                </td>
                                <td className="p-4 text-gray-700">
                                  {(control as any).assignee?.name || "-"}
                                </td>
                                <td
                                  className="p-4 text-gray-700"
                                  title={control.domain?.name || ""}
                                >
                                  {control.domain?.name
                                    ? control.domain.name.length > 22
                                      ? control.domain.name.substring(0, 22) + "..."
                                      : control.domain.name
                                    : "-"}
                                </td>
                                <td className="p-4 text-center">
                                  {controlShowColumns && (
                                    <span className="text-xs text-gray-500">
                                      {control.entities}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "Policy" && (() => {
            const POLICY_STATUSES = ["Not Uploaded", "Draft", "Approved", "Needs Review", "Published"] as const;

            // Filter policies by sub-tab document type
            const policySubTabType = policySubTab === "Policy" ? "Policy" : policySubTab === "Standard" ? "Standard" : policySubTab === "Procedure" ? "Procedure" : null;
            const filteredByType = policySubTabType ? policies.filter(p => p.documentType === policySubTabType) : policies;

            // Status counts
            const statusCounts = POLICY_STATUSES.reduce((acc, s) => {
              acc[s] = filteredByType.filter(p => p.status === s).length;
              return acc;
            }, {} as Record<string, number>);

            // Apply search, status filter, and sorting for list sub-tabs
            const listPolicies = filteredByType
              .filter(p => {
                if (policySearchQuery) {
                  const q = policySearchQuery.toLowerCase();
                  if (!p.name.toLowerCase().includes(q) && !p.code.toLowerCase().includes(q)) return false;
                }
                if (policyStatusFilter !== "all" && p.status !== policyStatusFilter) return false;
                return true;
              })
              .sort((a, b) => {
                let aVal = "";
                let bVal = "";
                if (policySortField === "name") { aVal = a.name; bVal = b.name; }
                else if (policySortField === "status") { aVal = a.status; bVal = b.status; }
                else if (policySortField === "assignee") { aVal = a.assignee?.fullName || ""; bVal = b.assignee?.fullName || ""; }
                else if (policySortField === "approver") { aVal = a.approver?.fullName || ""; bVal = b.approver?.fullName || ""; }
                else if (policySortField === "department") { aVal = a.department?.name || ""; bVal = b.department?.name || ""; }
                const cmp = aVal.localeCompare(bVal);
                return policySortAsc ? cmp : -cmp;
              });

            const handlePolicySortToggle = (field: string) => {
              if (policySortField === field) {
                setPolicySortAsc(!policySortAsc);
              } else {
                setPolicySortField(field);
                setPolicySortAsc(true);
              }
            };

            const statusCardData = [
              { label: "Not Uploaded", icon: (
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="16" stroke="white" strokeWidth="2" strokeDasharray="4 3"/><circle cx="18" cy="12" r="4" stroke="white" strokeWidth="1.5"/><path d="M10 28c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="white" strokeWidth="1.5"/></svg>
              )},
              { label: "Draft", icon: (
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="16" stroke="white" strokeWidth="2" strokeDasharray="4 3"/><rect x="12" y="10" width="12" height="16" rx="1" stroke="white" strokeWidth="1.5"/><line x1="15" y1="15" x2="21" y2="15" stroke="white" strokeWidth="1.2"/><line x1="15" y1="19" x2="21" y2="19" stroke="white" strokeWidth="1.2"/><line x1="15" y1="23" x2="19" y2="23" stroke="white" strokeWidth="1.2"/></svg>
              )},
              { label: "Approved", icon: (
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="16" stroke="white" strokeWidth="2" strokeDasharray="4 3"/><rect x="11" y="11" width="14" height="14" rx="2" stroke="white" strokeWidth="1.5"/><path d="M14 18l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              )},
              { label: "Needs Review", icon: (
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="16" stroke="white" strokeWidth="2" strokeDasharray="4 3"/><circle cx="18" cy="13" r="4" stroke="white" strokeWidth="1.5"/><path d="M10 28c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="white" strokeWidth="1.5"/><path d="M24 14l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              )},
              { label: "Published", icon: (
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="16" stroke="white" strokeWidth="2" strokeDasharray="4 3"/><path d="M18 24V12m0 0l-4 4m4-4l4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              )},
            ];

            return (
            <div className="space-y-4">
              {masterDataLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-xl font-bold text-blue-800">{t("Policies")}</h2>
                    {customer && (
                      <span className="px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full font-medium border border-blue-200">{customer.customerName}</span>
                    )}
                  </div>
                  <hr className="border-gray-200" />

                  {/* Sub-tabs */}
                  <div className="flex gap-2 mt-2">
                    {(["Dashboard", "Policy", "Standard", "Procedure"] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => { setPolicySubTab(tab); setPolicySearchQuery(""); setPolicyStatusFilter("all"); }}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          policySubTab === tab
                            ? "bg-[#1e2a4a] text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {tab === "Dashboard" ? t("Dashboard") : tab === "Policy" ? t("Policy") : tab === "Standard" ? t("Standards") : t("Procedures")}
                      </button>
                    ))}
                  </div>

                  {/* Status Cards */}
                  <div className="grid grid-cols-5 gap-3 mt-3">
                    {statusCardData.map(({ label, icon }) => (
                      <div key={label} className="rounded-xl p-4 flex flex-col items-center justify-center gap-2" style={{ background: "linear-gradient(135deg, #1e2a4a 0%, #2a4080 100%)" }}>
                        {icon}
                        <span className="text-2xl font-bold text-white">{statusCounts[label] || 0}</span>
                        <span className="text-xs text-white/80 text-center">{t(label)}</span>
                      </div>
                    ))}
                  </div>

                  {/* List view for Policy / Standard / Procedure sub-tabs */}
                  {policySubTab !== "Dashboard" && (
                    <>
                      {/* Search & Filters */}
                      <div className="flex items-center gap-3 mt-4">
                        <div className="relative flex-1 max-w-sm">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder={t("Search by name or code...")}
                            value={policySearchQuery}
                            onChange={(e) => setPolicySearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <select
                          value={policyStatusFilter}
                          onChange={(e) => setPolicyStatusFilter(e.target.value)}
                          className="px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="all">{t("All Status")}</option>
                          {POLICY_STATUSES.map(s => <option key={s} value={s}>{t(s)}</option>)}
                        </select>
                      </div>

                      {/* Table */}
                      {listPolicies.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">{t("No items found.")}</div>
                      ) : (
                        <div className="overflow-x-auto mt-2 rounded-lg border">
                          <table className="w-full text-sm border-collapse">
                            <thead>
                              <tr style={{ background: "linear-gradient(135deg, #1e2a4a 0%, #2a4080 100%)" }}>
                                {[
                                  { key: "name", label: t("Name") },
                                  { key: "status", label: t("Status") },
                                  { key: "assignee", label: t("Assignee") },
                                  { key: "approver", label: t("Approver") },
                                  { key: "department", label: t("Department Name") },
                                ].map(col => (
                                  <th
                                    key={col.key}
                                    className="text-left p-3 font-medium text-white cursor-pointer select-none"
                                    onClick={() => handlePolicySortToggle(col.key)}
                                  >
                                    <div className="flex items-center gap-1">
                                      {col.label}
                                      <div className="flex flex-col leading-none">
                                        <ArrowUpDown className="h-3.5 w-3.5 text-white/60" />
                                      </div>
                                    </div>
                                  </th>
                                ))}
                                <th className="p-3 text-center text-white">
                                  <Eye className="h-4 w-4 mx-auto" />
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {listPolicies.map((pol) => (
                                <tr key={pol.id} className="border-b hover:bg-gray-50">
                                  <td className="p-3 font-medium">{pol.name}</td>
                                  <td className="p-3">{pol.status}</td>
                                  <td className="p-3">{pol.assignee?.fullName || "-"}</td>
                                  <td className="p-3">{pol.approver?.fullName || "-"}</td>
                                  <td className="p-3">{pol.department?.name || "-"}</td>
                                  <td className="p-3 text-center">
                                    <div className="flex items-center justify-center gap-3">
                                      <button onClick={() => handleEditItem(pol.id, pol.name, "policies")} className="text-blue-600 hover:text-blue-800" title="Edit">
                                        <Pencil className="h-4 w-4" />
                                      </button>
                                      <button onClick={() => handleDeleteItem(pol.id, pol.name, "policies")} className="text-red-500 hover:text-red-700" title="Delete">
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
            );
          })()}

          {activeTab === "Evidence" && (() => {
            const EVIDENCE_STATUSES = ["Not Uploaded", "Draft", "Need Attention", "Published"] as const;

            // Status counts for cards
            const evStatusCounts: Record<string, number> = {
              "Total count": evidences.length,
              "Not Uploaded": evidences.filter(e => e.status === "Not Uploaded").length,
              "Draft": evidences.filter(e => e.status === "Draft").length,
              "Need Attention": evidences.filter(e => e.status === "Need Attention").length,
              "Published": evidences.filter(e => e.status === "Published").length,
            };

            // Unique frameworks for dropdown
            const evFrameworks = Array.from(new Set(evidences.filter(e => e.framework).map(e => e.framework!.name)));
            // Unique departments for dropdown
            const evDepartments = Array.from(new Set(evidences.filter(e => e.department).map(e => e.department!.name)));

            // Filtered & sorted evidences for list view
            const listEvidences = evidences
              .filter(ev => {
                if (evidenceSearchQuery) {
                  const q = evidenceSearchQuery.toLowerCase();
                  if (!ev.name.toLowerCase().includes(q) && !ev.evidenceCode.toLowerCase().includes(q)) return false;
                }
                if (evidenceDeptFilter !== "all" && ev.department?.name !== evidenceDeptFilter) return false;
                if (evidenceFrameworkFilter !== "all" && ev.framework?.name !== evidenceFrameworkFilter) return false;
                return true;
              })
              .sort((a, b) => {
                let aVal = "";
                let bVal = "";
                if (evidenceSortField === "evidenceCode") { aVal = a.evidenceCode; bVal = b.evidenceCode; }
                else if (evidenceSortField === "name") { aVal = a.name; bVal = b.name; }
                else if (evidenceSortField === "status") { aVal = a.status; bVal = b.status; }
                else if (evidenceSortField === "assignee") { aVal = a.assignee?.fullName || ""; bVal = b.assignee?.fullName || ""; }
                else if (evidenceSortField === "department") { aVal = a.department?.name || ""; bVal = b.department?.name || ""; }
                const cmp = aVal.localeCompare(bVal);
                return evidenceSortAsc ? cmp : -cmp;
              });

            const handleEvSortToggle = (field: string) => {
              if (evidenceSortField === field) {
                setEvidenceSortAsc(!evidenceSortAsc);
              } else {
                setEvidenceSortField(field);
                setEvidenceSortAsc(true);
              }
            };

            const evStatusCardData = [
              { label: "Total count", icon: (
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="16" stroke="white" strokeWidth="2" strokeDasharray="4 3"/><circle cx="18" cy="12" r="4" stroke="white" strokeWidth="1.5"/><path d="M10 28c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="white" strokeWidth="1.5"/></svg>
              )},
              { label: "Not Uploaded", icon: (
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="16" stroke="white" strokeWidth="2" strokeDasharray="4 3"/><circle cx="18" cy="12" r="4" stroke="white" strokeWidth="1.5"/><path d="M10 28c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="white" strokeWidth="1.5"/></svg>
              )},
              { label: "Draft", icon: (
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="16" stroke="white" strokeWidth="2" strokeDasharray="4 3"/><rect x="12" y="10" width="12" height="16" rx="1" stroke="white" strokeWidth="1.5"/><line x1="15" y1="15" x2="21" y2="15" stroke="white" strokeWidth="1.2"/><line x1="15" y1="19" x2="21" y2="19" stroke="white" strokeWidth="1.2"/><line x1="15" y1="23" x2="19" y2="23" stroke="white" strokeWidth="1.2"/></svg>
              )},
              { label: "Need Attention", icon: (
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="16" stroke="white" strokeWidth="2" strokeDasharray="4 3"/><circle cx="18" cy="18" r="7" stroke="white" strokeWidth="1.5"/><path d="M15 18l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              )},
              { label: "Published", icon: (
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="16" stroke="white" strokeWidth="2" strokeDasharray="4 3"/><path d="M18 24V12m0 0l-4 4m4-4l4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              )},
            ];

            return (
            <div className="space-y-4">
              {masterDataLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <>
                  {/* Sub-tabs */}
                  <div className="flex gap-2">
                    {(["Dashboard", "AllEvidence"] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => { setEvidenceSubTab(tab); setEvidenceSearchQuery(""); setEvidenceDeptFilter("all"); setEvidenceFrameworkFilter("all"); }}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          evidenceSubTab === tab
                            ? "bg-[#1e2a4a] text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {tab === "AllEvidence" ? t("All Evidence") : t("Dashboard")}
                      </button>
                    ))}
                  </div>

                  {/* Dashboard sub-tab */}
                  {evidenceSubTab === "Dashboard" && (
                    <div className="grid grid-cols-5 gap-3 mt-3">
                      {evStatusCardData.map(({ label, icon }) => (
                        <div key={label} className="rounded-xl p-4 flex flex-col items-center justify-center gap-2" style={{ background: "linear-gradient(135deg, #1e2a4a 0%, #2a4080 100%)" }}>
                          {icon}
                          <span className="text-2xl font-bold text-white">{evStatusCounts[label] || 0}</span>
                          <span className="text-xs text-white/80 text-center">{t(label)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* All Evidence sub-tab */}
                  {evidenceSubTab === "AllEvidence" && (
                    <>
                      {/* Framework dropdown */}
                      <div className="flex justify-end mt-2">
                        <select
                          value={evidenceFrameworkFilter}
                          onChange={(e) => setEvidenceFrameworkFilter(e.target.value)}
                          className="px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="all">{t("Framework")}</option>
                          {evFrameworks.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>

                      {/* Status Cards */}
                      <div className="grid grid-cols-5 gap-3 mt-2">
                        {evStatusCardData.map(({ label, icon }) => (
                          <div key={label} className="rounded-xl p-4 flex flex-col items-center justify-center gap-2" style={{ background: "linear-gradient(135deg, #1e2a4a 0%, #2a4080 100%)" }}>
                            {icon}
                            <span className="text-2xl font-bold text-white">{evStatusCounts[label] || 0}</span>
                            <span className="text-xs text-white/80 text-center">{t(label)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Search & Department filter */}
                      <div className="flex items-center gap-3 mt-4">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder={t("Search by name")}
                            value={evidenceSearchQuery}
                            onChange={(e) => setEvidenceSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <select
                          value={evidenceDeptFilter}
                          onChange={(e) => setEvidenceDeptFilter(e.target.value)}
                          className="px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="all">{t("Department")}</option>
                          {evDepartments.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>

                      {/* Table */}
                      {listEvidences.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">{t("No evidences found.")}</div>
                      ) : (
                        <div className="overflow-x-auto mt-2 rounded-lg border">
                          <table className="w-full text-sm border-collapse">
                            <thead>
                              <tr style={{ background: "linear-gradient(135deg, #1e2a4a 0%, #2a4080 100%)" }}>
                                {[
                                  { key: "evidenceCode", label: t("Evidence Code") },
                                  { key: "name", label: t("Evidence Name") },
                                  { key: "status", label: t("Status") },
                                  { key: "assignee", label: t("Assignee") },
                                  { key: "department", label: t("Department Name") },
                                ].map(col => (
                                  <th
                                    key={col.key}
                                    className="text-left p-3 font-medium text-white cursor-pointer select-none"
                                    onClick={() => handleEvSortToggle(col.key)}
                                  >
                                    <div className="flex items-center gap-1">
                                      {col.label}
                                      <ArrowUpDown className="h-3.5 w-3.5 text-white/60" />
                                    </div>
                                  </th>
                                ))}
                                <th className="p-3 text-center text-white">
                                  <Eye className="h-4 w-4 mx-auto" />
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {listEvidences.map((ev) => (
                                <tr key={ev.id} className="border-b hover:bg-gray-50">
                                  <td className="p-3 font-medium">{ev.evidenceCode}</td>
                                  <td className="p-3">{ev.name}</td>
                                  <td className="p-3">{ev.status}</td>
                                  <td className="p-3">{ev.assignee?.fullName || "-"}</td>
                                  <td className="p-3">{ev.department?.name || "-"}</td>
                                  <td className="p-3 text-center">
                                    <div className="flex items-center justify-center gap-3">
                                      <button onClick={() => handleEditItem(ev.id, ev.name, "evidences")} className="text-blue-600 hover:text-blue-800" title="Edit">
                                        <Pencil className="h-4 w-4" />
                                      </button>
                                      <button onClick={() => handleDeleteItem(ev.id, ev.name, "evidences")} className="text-red-500 hover:text-red-700" title="Delete">
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
            );
          })()}

          {activeTab === "Master data" && masterDataView === null && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-2xl font-bold text-blue-700">{t("Master Data")}</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  { key: "framework", label: t("Framework"), icon: Layers },
                  { key: "controls", label: t("Controls"), icon: Shield },
                  { key: "policies", label: t("Policies"), icon: FileCheck },
                  { key: "evidences", label: t("Evidences"), icon: ClipboardList },
                  { key: "domains", label: t("Domain"), icon: LayoutGrid },
                ].map((tile) => (
                  <div
                    key={tile.key}
                    className="cursor-pointer rounded-2xl overflow-hidden transition-transform hover:scale-105"
                    style={{
                      background: "linear-gradient(135deg, #0a0a5c 0%, #1a1a8c 50%, #0d0d6b 100%)",
                      border: "1px solid rgba(100, 100, 255, 0.3)",
                    }}
                    onClick={() => handleMasterDataTileClick(tile.key)}
                  >
                    <div className="flex flex-col items-center justify-center p-8 min-h-[200px]">
                      <tile.icon className="h-16 w-16 text-white mb-4" strokeWidth={1.2} />
                      <span className="text-white text-lg font-semibold">{tile.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "Master data" && masterDataView !== null && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <button
                  className="text-gray-600 hover:text-gray-800 flex items-center gap-1"
                  onClick={() => setMasterDataView(null)}
                >
                  <ChevronLeft className="h-5 w-5" />
                  {t("Back")}
                </button>
                <h2 className="text-2xl font-bold text-blue-700 capitalize">{t(masterDataView)}</h2>
              </div>

              {masterDataLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : masterDataView === "controls" ? (
                controls.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">{t("No controls found for this customer.")}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b">
                          <th className="text-left p-3 font-medium text-gray-700">{t("Control Code")}</th>
                          <th className="text-left p-3 font-medium text-gray-700">{t("Name")}</th>
                          <th className="text-left p-3 font-medium text-gray-700">{t("Domain")}</th>
                          <th className="text-left p-3 font-medium text-gray-700">{t("Framework")}</th>
                          <th className="text-left p-3 font-medium text-gray-700">{t("Grouping")}</th>
                          <th className="text-left p-3 font-medium text-gray-700">{t("Status")}</th>
                          <th className="text-center p-3 font-medium text-gray-700">{t("Action")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {controls.map((ctrl) => (
                          <tr key={ctrl.id} className="border-b hover:bg-gray-50">
                            <td className="p-3 font-medium">{ctrl.controlCode}</td>
                            <td className="p-3">{ctrl.name}</td>
                            <td className="p-3">{ctrl.domain?.name || "-"}</td>
                            <td className="p-3">{ctrl.framework?.name || "-"}</td>
                            <td className="p-3">{ctrl.functionalGrouping || "-"}</td>
                            <td className="p-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                ctrl.status === "Compliant" ? "bg-green-100 text-green-800" :
                                ctrl.status === "Non Compliant" ? "bg-red-100 text-red-800" :
                                ctrl.status === "Partial Compliant" ? "bg-yellow-100 text-yellow-800" :
                                "bg-gray-100 text-gray-800"
                              }`}>{ctrl.status}</span>
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-3">
                                <button onClick={() => handleEditItem(ctrl.id, ctrl.name, "controls")} className="text-blue-600 hover:text-blue-800" title="Edit">
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button onClick={() => handleDeleteItem(ctrl.id, ctrl.name, "controls")} className="text-red-500 hover:text-red-700" title="Delete">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : masterDataView === "policies" ? (
                policies.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">{t("No policies found for this customer.")}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b">
                          <th className="text-left p-3 font-medium text-gray-700">{t("Code")}</th>
                          <th className="text-left p-3 font-medium text-gray-700">{t("Name")}</th>
                          <th className="text-left p-3 font-medium text-gray-700">{t("Type")}</th>
                          <th className="text-left p-3 font-medium text-gray-700">{t("Version")}</th>
                          <th className="text-left p-3 font-medium text-gray-700">{t("Department")}</th>
                          <th className="text-left p-3 font-medium text-gray-700">{t("Status")}</th>
                          <th className="text-center p-3 font-medium text-gray-700">{t("Action")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {policies.map((pol) => (
                          <tr key={pol.id} className="border-b hover:bg-gray-50">
                            <td className="p-3 font-medium">{pol.code}</td>
                            <td className="p-3">{pol.name}</td>
                            <td className="p-3">{pol.documentType}</td>
                            <td className="p-3">{pol.version}</td>
                            <td className="p-3">{pol.department?.name || "-"}</td>
                            <td className="p-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                pol.status === "Published" || pol.status === "Approved" ? "bg-green-100 text-green-800" :
                                pol.status === "Draft" ? "bg-blue-100 text-blue-800" :
                                pol.status === "Not Uploaded" ? "bg-gray-100 text-gray-800" :
                                "bg-yellow-100 text-yellow-800"
                              }`}>{pol.status}</span>
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-3">
                                <button onClick={() => handleEditItem(pol.id, pol.name, "policies")} className="text-blue-600 hover:text-blue-800" title="Edit">
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button onClick={() => handleDeleteItem(pol.id, pol.name, "policies")} className="text-red-500 hover:text-red-700" title="Delete">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : masterDataView === "evidences" ? (
                evidences.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">{t("No evidences found for this customer.")}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b">
                          <th className="text-left p-3 font-medium text-gray-700">{t("Evidence Code")}</th>
                          <th className="text-left p-3 font-medium text-gray-700">{t("Name")}</th>
                          <th className="text-left p-3 font-medium text-gray-700">{t("Description")}</th>
                          <th className="text-left p-3 font-medium text-gray-700">{t("Framework")}</th>
                          <th className="text-left p-3 font-medium text-gray-700">{t("Status")}</th>
                          <th className="text-center p-3 font-medium text-gray-700">{t("Action")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {evidences.map((ev) => (
                          <tr key={ev.id} className="border-b hover:bg-gray-50">
                            <td className="p-3 font-medium">{ev.evidenceCode}</td>
                            <td className="p-3">{ev.name}</td>
                            <td className="p-3 max-w-[200px] truncate">{ev.description || "-"}</td>
                            <td className="p-3">{ev.framework?.name || "-"}</td>
                            <td className="p-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                ev.status === "Published" || ev.status === "Validated" ? "bg-green-100 text-green-800" :
                                ev.status === "Draft" ? "bg-blue-100 text-blue-800" :
                                ev.status === "Not Uploaded" ? "bg-gray-100 text-gray-800" :
                                "bg-yellow-100 text-yellow-800"
                              }`}>{ev.status}</span>
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-3">
                                <button onClick={() => handleEditItem(ev.id, ev.name, "evidences")} className="text-blue-600 hover:text-blue-800" title="Edit">
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button onClick={() => handleDeleteItem(ev.id, ev.name, "evidences")} className="text-red-500 hover:text-red-700" title="Delete">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : masterDataView === "domains" ? (
                domains.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">{t("No domains found.")}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b">
                          <th className="text-left p-3 font-medium text-gray-700">{t("Domain Name")}</th>
                          <th className="text-left p-3 font-medium text-gray-700">{t("Controls Count")}</th>
                          <th className="text-center p-3 font-medium text-gray-700">{t("Action")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {domains.map((dom) => (
                          <tr key={dom.id} className="border-b hover:bg-gray-50">
                            <td className="p-3 font-medium">{dom.name}</td>
                            <td className="p-3">{dom._count.controls}</td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-3">
                                <button onClick={() => handleEditItem(dom.id, dom.name, "domains")} className="text-blue-600 hover:text-blue-800" title="Edit">
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button onClick={() => handleDeleteItem(dom.id, dom.name, "domains")} className="text-red-500 hover:text-red-700" title="Delete">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Master Data Edit Dialog */}
      <Dialog open={isEditItemDialogOpen} onOpenChange={setIsEditItemDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-blue-700 capitalize">{t("Edit")} {editItem?.type.slice(0, -1)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-item-name">{t("Name")}</Label>
              <Input
                id="edit-item-name"
                value={editItemName}
                onChange={(e) => setEditItemName(e.target.value)}
                placeholder={t("Enter name")}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditItemDialogOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button
                onClick={handleSaveEditItem}
                disabled={!editItemName.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {t("Save")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Master Data Delete Dialog */}
      <Dialog open={isDeleteItemDialogOpen} onOpenChange={setIsDeleteItemDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 capitalize">{t("Delete")} {deleteItem?.type.slice(0, -1)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">
              {t("Are you sure you want to delete")} <strong>{deleteItem?.name}</strong>? {t("This action cannot be undone.")}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteItemDialogOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button
                onClick={handleConfirmDeleteItem}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {t("Delete")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Framework Select Dialog */}
      <Dialog open={isSelectDialogOpen} onOpenChange={setIsSelectDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-blue-700 text-xl">
              {t("Framework Select")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blue-400" />
              <Input
                placeholder={t("Search By Framework Name")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 border-2 border-dashed border-blue-400 focus:border-blue-600"
              />
            </div>

            {/* Available Frameworks List */}
            <div className="max-h-[50vh] overflow-y-auto space-y-3">
              {loadingAvailable ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : filteredAvailableFrameworks.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  {searchQuery
                    ? t("No frameworks match your search.")
                    : t("No available frameworks to subscribe.")}
                </div>
              ) : (
                filteredAvailableFrameworks.map((framework) => (
                  <div
                    key={framework.id}
                    className="border-2 border-dashed border-blue-300 rounded-lg p-4"
                  >
                    <h4 className="text-base font-bold text-blue-700 mb-1">
                      {framework.name}
                    </h4>
                    {framework.description && (
                      <p className="text-sm text-gray-600 mb-3">
                        {framework.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        disabled={subscribingId === framework.id}
                        onClick={() => handleSubscribeFramework(framework.id, "subscribe")}
                      >
                        {subscribingId === framework.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-1" />
                        ) : null}
                        {t("Subscribe")}
                      </Button>
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
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

            <DialogFooter className="pt-4 border-t">
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => setIsSelectDialogOpen(false)}
              >
                {t("Done")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Step 1: Create Framework Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("Create Integrated Framework")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-500">
              {t("Note: Custom framework will be automatically added in grey color to differentiate between Subscribed Frameworks.")}
            </p>

            <div className="space-y-2">
              <Label htmlFor="code">{t("Code")}</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder={t("Enter code")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-1">
                {t("Integrated Framework Name")} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t("Enter framework name")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t("Description")}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t("Enter description")}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type" className="flex items-center gap-1">
                {t("Framework Type")} <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
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
                <Label htmlFor="country" className="flex items-center gap-1">
                  {t("Country")} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder={t("Enter country")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry" className="flex items-center gap-1">
                  {t("Industry")} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="industry"
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  placeholder={t("Enter industry")}
                />
              </div>
            </div>

            {creationMode === "AI" && (
              <div className="space-y-2">
                <Label>{t("Upload Support Document")}</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors border-gray-300 hover:border-gray-400">
                  <div className="flex flex-col items-center gap-2 text-gray-500">
                    <Upload className="h-8 w-8" />
                    <span className="text-sm">{t("Click here, or drop files here to upload.")}</span>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="pt-4 border-t">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!formData.name || !formData.type || !formData.country || !formData.industry}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {t("Create & Import")}
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
              {t("Import Framework Requirements")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <p className="text-sm text-muted-foreground">
              {t("Upload an Excel file (.xlsx) containing your framework requirements. You can download the sample template to see the required format.")}
            </p>

            {/* Download Template Button */}
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={handleDownloadTemplate}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                {t("Download Sample Template")}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t("Use this template to ensure correct column headers")}
              </span>
            </div>

            {/* File Upload Area */}
            <div className="space-y-2">
              <Label>{t("Upload Document")}</Label>
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
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">{t("Required Column Headers:")}</p>
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
                {importSuccess ? t("Close") : t("Skip")}
              </Button>
              <Button
                onClick={handleImport}
                disabled={!importFile || isImporting}
                className="bg-green-600 hover:bg-green-700"
              >
                {isImporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                    {t("Importing...")}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    {t("Import")}
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Subscription Error Dialog */}
      <Dialog open={showSubscriptionErrorDialog} onOpenChange={setShowSubscriptionErrorDialog}>
        <DialogContent className="sm:max-w-[400px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
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
