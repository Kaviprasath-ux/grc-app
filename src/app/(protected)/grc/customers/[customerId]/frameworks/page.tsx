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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
    setSelectedControlFrameworkId(framework.id);
    setActiveTab("Control");
    setControlSubTab("all");
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
        <div className="text-center py-12 text-slate-500">
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
              <span className="text-sm text-slate-700">{item.label}</span>
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
      <div className="space-y-6">
        <nav className="flex items-center gap-1.5 text-sm">
          <Link href="/grc" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
            <Home className="h-4 w-4" />
            <span>{t("GRC")}</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <Link href="/grc/customers" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Customers")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-slate-500">{t("Customer")}</span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-primary-700 font-medium">{t("Frameworks")}</span>
        </nav>
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Frameworks")}</h1>
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
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/grc" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("GRC")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/grc/customers" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Customers")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-slate-500">{customer?.customerName || t("Customer")}</span>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Frameworks")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
          {customer?.customerName || t("Customer")} — {t("Frameworks")}
        </h1>
        {activeTab === "Framework" && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
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

      {/* Tabs and Content */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        {/* Sidebar Tabs */}
        <div className="w-full md:w-44 shrink-0 flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={`w-full text-sm ltr:text-left rtl:text-right px-4 py-2.5 rounded-lg transition-colors ${
                activeTab === tab
                  ? "bg-primary-50 text-primary-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
              onClick={() => {
                setActiveTab(tab);
                setMasterDataView(null);
                if (tab === "Control") fetchMasterData("controls");
                else if (tab === "Policy") fetchMasterData("policies");
                else if (tab === "Evidence") fetchMasterData("evidences");
              }}
            >
              {t(tab)}
            </button>
          ))}
        </div>

        {/* Framework Cards Grid */}
        <div className="flex-1">
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
                            onClick={() => handleFrameworkClick(framework)}
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
                            onClick={() => handleFrameworkClick(framework)}
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

          {activeTab === "Control" && (
            <div className="space-y-5">
              {/* Sub-tabs + Framework Dropdown */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {(["dashboard", "all"] as const).map((tab) => (
                    <button
                      key={tab}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        controlSubTab === tab
                          ? "bg-primary-50 text-primary-700"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                      onClick={() => setControlSubTab(tab)}
                    >
                      {tab === "dashboard" ? t("Dashboard") : t("All Controls")}
                    </button>
                  ))}
                </div>

                <Select
                  value={selectedControlFrameworkId}
                  onValueChange={(val) => {
                    setSelectedControlFrameworkId(val);
                    fetchControlsForFramework(val);
                  }}
                >
                  <SelectTrigger className="w-[200px] h-9 text-sm bg-slate-50 border-slate-200">
                    <SelectValue placeholder={t("Framework")} />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
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
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100">
                    <h2 className="text-sm font-semibold text-slate-800">{t("Functional Grouping")}</h2>
                  </div>
                  {masterDataLoading ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="w-10 h-10 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
                    </div>
                  ) : (
                    <div className="flex justify-center py-8 px-5">
                      {renderControlDonutChart()}
                    </div>
                  )}
                </div>
              )}

              {/* All Controls View */}
              {controlSubTab === "all" && (
                <div className="space-y-5">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-4 gap-4">
                    {[
                      { label: t("Total Controls"), value: controlStats.total, color: "bg-primary-50 text-primary-600" },
                      { label: t("Non Compliant"), value: controlStats.nonCompliant, color: "bg-red-50 text-red-600" },
                      { label: t("Compliant"), value: controlStats.compliant, color: "bg-green-50 text-green-600" },
                      { label: t("Not Applicable"), value: controlStats.notApplicable, color: "bg-slate-50 text-slate-600" },
                    ].map((card) => (
                      <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-5">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{card.label}</p>
                        <p className={`text-2xl font-bold mt-1 ${card.color.split(" ")[1]}`}>{card.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Table Container */}
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    {/* Search and Filters */}
                    <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-slate-100">
                      <div className="relative max-w-xs">
                        <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder={t("Search controls...")}
                          className="w-full ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
                          value={controlSearchQuery}
                          onChange={(e) => setControlSearchQuery(e.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-3 ms-auto">
                        <Select value={controlDomainFilter} onValueChange={setControlDomainFilter}>
                          <SelectTrigger className="w-[160px] h-9 text-sm bg-slate-50 border-slate-200">
                            <SelectValue placeholder={t("Domain")} />
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            <SelectItem value="all">{t("All Domains")}</SelectItem>
                            {controlDomains.map((d) => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select value={controlFgFilter} onValueChange={setControlFgFilter}>
                          <SelectTrigger className="w-[180px] h-9 text-sm bg-slate-50 border-slate-200">
                            <SelectValue placeholder={t("Functional Grouping")} />
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            <SelectItem value="all">{t("All Groupings")}</SelectItem>
                        {FUNCTIONAL_GROUPINGS.map((fg) => (
                          <SelectItem key={fg} value={fg}>
                            {fg}
                          </SelectItem>
                        ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Controls Table */}
                    {masterDataLoading ? (
                      <div className="flex items-center justify-center h-64">
                        <div className="w-10 h-10 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                      <Table className="min-w-[700px]">
                        <TableHeader>
                          <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                            <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pl-5 cursor-pointer" onClick={() => handleControlSort("name")}>
                              <span className="flex items-center gap-1">{t("Control Name")} <ArrowUpDown className="h-3 w-3" /></span>
                            </TableHead>
                            <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 cursor-pointer" onClick={() => handleControlSort("controlCode")}>
                              <span className="flex items-center gap-1">{t("Code")} <ArrowUpDown className="h-3 w-3" /></span>
                            </TableHead>
                            <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 cursor-pointer" onClick={() => handleControlSort("functionalGrouping")}>
                              <span className="flex items-center gap-1">{t("Grouping")} <ArrowUpDown className="h-3 w-3" /></span>
                            </TableHead>
                            <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 cursor-pointer" onClick={() => handleControlSort("status")}>
                              <span className="flex items-center gap-1">{t("Status")} <ArrowUpDown className="h-3 w-3" /></span>
                            </TableHead>
                            <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Assignee")}</TableHead>
                            <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 cursor-pointer" onClick={() => handleControlSort("domain")}>
                              <span className="flex items-center gap-1">{t("Domain")} <ArrowUpDown className="h-3 w-3" /></span>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredSortedControls.length === 0 ? (
                            <TableRow className="hover:bg-transparent">
                              <TableCell colSpan={6}>
                                <div className="py-16 text-center">
                                  <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-4">
                                    <Shield className="h-6 w-6 text-primary-500" />
                                  </div>
                                  <h3 className="text-base font-semibold text-slate-800 mb-1">{t("No Controls Found")}</h3>
                                  <p className="text-sm text-slate-500">{t("Try adjusting your search or filters.")}</p>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredSortedControls.map((control) => (
                              <TableRow key={control.id} className="border-b border-slate-100 last:border-0">
                                <TableCell className="py-4 pl-5 text-sm font-medium text-slate-800 max-w-[200px] truncate" title={control.name}>
                                  {control.name}
                                </TableCell>
                                <TableCell className="py-4 text-sm text-slate-700">{control.controlCode}</TableCell>
                                <TableCell className="py-4 text-sm text-slate-700">{control.functionalGrouping || "-"}</TableCell>
                                <TableCell className="py-4">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    control.status === "Compliant" ? "bg-green-50 text-green-700" :
                                    control.status === "Non Compliant" ? "bg-red-50 text-red-700" :
                                    control.status === "Partial Compliant" ? "bg-amber-50 text-amber-700" :
                                    "bg-slate-100 text-slate-700"
                                  }`}>{control.status}</span>
                                </TableCell>
                                <TableCell className="py-4 text-sm text-slate-700">{(control as any).assignee?.name || "-"}</TableCell>
                                <TableCell className="py-4 text-sm text-slate-700 max-w-[180px] truncate" title={control.domain?.name || ""}>
                                  {control.domain?.name || "-"}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                      </div>
                    )}
                  </div>
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
            <div className="space-y-5">
              {masterDataLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="w-10 h-10 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
                </div>
              ) : (
                <>
                  {/* Sub-tabs */}
                  <div className="flex items-center gap-1">
                    {(["Dashboard", "Policy", "Standard", "Procedure"] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => { setPolicySubTab(tab); setPolicySearchQuery(""); setPolicyStatusFilter("all"); }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          policySubTab === tab
                            ? "bg-primary-50 text-primary-700"
                            : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {tab === "Dashboard" ? t("Dashboard") : tab === "Policy" ? t("Policy") : tab === "Standard" ? t("Standards") : t("Procedures")}
                      </button>
                    ))}
                  </div>

                  {/* Status Cards */}
                  <div className="grid grid-cols-5 gap-3">
                    {statusCardData.map(({ label }) => (
                      <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                        <p className="text-2xl font-bold text-slate-800">{statusCounts[label] || 0}</p>
                        <p className="text-xs font-medium text-slate-500 mt-1">{t(label)}</p>
                      </div>
                    ))}
                  </div>

                  {/* List view for Policy / Standard / Procedure sub-tabs */}
                  {policySubTab !== "Dashboard" && (
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      {/* Search & Filters */}
                      <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-slate-100">
                        <div className="relative max-w-xs">
                          <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <input
                            type="text"
                            placeholder={t("Search by name or code...")}
                            value={policySearchQuery}
                            onChange={(e) => setPolicySearchQuery(e.target.value)}
                            className="w-full ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
                          />
                        </div>
                        <div className="ms-auto">
                          <Select value={policyStatusFilter} onValueChange={setPolicyStatusFilter}>
                            <SelectTrigger className="w-[150px] h-9 text-sm bg-slate-50 border-slate-200">
                              <SelectValue placeholder={t("All Status")} />
                            </SelectTrigger>
                            <SelectContent className="bg-white">
                              <SelectItem value="all">{t("All Status")}</SelectItem>
                              {POLICY_STATUSES.map(s => <SelectItem key={s} value={s}>{t(s)}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Table */}
                      <Table>
                        <TableHeader>
                          <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                            {[
                              { key: "name", label: t("Name") },
                              { key: "status", label: t("Status") },
                              { key: "assignee", label: t("Assignee") },
                              { key: "approver", label: t("Approver") },
                              { key: "department", label: t("Department") },
                            ].map((col, i) => (
                              <TableHead key={col.key} className={`text-xs font-medium text-slate-500 uppercase tracking-wider py-3 cursor-pointer ${i === 0 ? "pl-5" : ""}`} onClick={() => handlePolicySortToggle(col.key)}>
                                <span className="flex items-center gap-1">{col.label} <ArrowUpDown className="h-3 w-3" /></span>
                              </TableHead>
                            ))}
                            <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-5">{t("Actions")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {listPolicies.length === 0 ? (
                            <TableRow className="hover:bg-transparent">
                              <TableCell colSpan={6}>
                                <div className="py-16 text-center">
                                  <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-4">
                                    <FileCheck className="h-6 w-6 text-primary-500" />
                                  </div>
                                  <h3 className="text-base font-semibold text-slate-800 mb-1">{t("No Items Found")}</h3>
                                  <p className="text-sm text-slate-500">{t("Try adjusting your search or filters.")}</p>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : (
                            listPolicies.map((pol) => (
                              <TableRow key={pol.id} className="border-b border-slate-100 last:border-0">
                                <TableCell className="py-4 pl-5 text-sm font-medium text-slate-800">{pol.name}</TableCell>
                                <TableCell className="py-4">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    pol.status === "Published" || pol.status === "Approved" ? "bg-green-50 text-green-700" :
                                    pol.status === "Draft" ? "bg-blue-50 text-blue-700" :
                                    pol.status === "Not Uploaded" ? "bg-slate-100 text-slate-700" :
                                    "bg-amber-50 text-amber-700"
                                  }`}>{pol.status}</span>
                                </TableCell>
                                <TableCell className="py-4 text-sm text-slate-700">{pol.assignee?.fullName || "-"}</TableCell>
                                <TableCell className="py-4 text-sm text-slate-700">{pol.approver?.fullName || "-"}</TableCell>
                                <TableCell className="py-4 text-sm text-slate-700">{pol.department?.name || "-"}</TableCell>
                                <TableCell className="py-4 pr-5">
                                  <div className="flex items-center justify-end gap-0.5">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => handleEditItem(pol.id, pol.name, "policies")} title={t("Edit")}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-semantic-error" onClick={() => handleDeleteItem(pol.id, pol.name, "policies")} title={t("Delete")}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
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
            <div className="space-y-5">
              {masterDataLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="w-10 h-10 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
                </div>
              ) : (
                <>
                  {/* Sub-tabs */}
                  <div className="flex items-center gap-1">
                    {(["Dashboard", "AllEvidence"] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => { setEvidenceSubTab(tab); setEvidenceSearchQuery(""); setEvidenceDeptFilter("all"); setEvidenceFrameworkFilter("all"); }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          evidenceSubTab === tab
                            ? "bg-primary-50 text-primary-700"
                            : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {tab === "AllEvidence" ? t("All Evidence") : t("Dashboard")}
                      </button>
                    ))}
                  </div>

                  {/* Dashboard sub-tab */}
                  {evidenceSubTab === "Dashboard" && (
                    <div className="grid grid-cols-5 gap-3">
                      {evStatusCardData.map(({ label }) => (
                        <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                          <p className="text-2xl font-bold text-slate-800">{evStatusCounts[label] || 0}</p>
                          <p className="text-xs font-medium text-slate-500 mt-1">{t(label)}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* All Evidence sub-tab */}
                  {evidenceSubTab === "AllEvidence" && (
                    <>
                      {/* Status Cards */}
                      <div className="grid grid-cols-5 gap-3">
                        {evStatusCardData.map(({ label }) => (
                          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                            <p className="text-2xl font-bold text-slate-800">{evStatusCounts[label] || 0}</p>
                            <p className="text-xs font-medium text-slate-500 mt-1">{t(label)}</p>
                          </div>
                        ))}
                      </div>

                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        {/* Search & Filters */}
                        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-slate-100">
                          <div className="relative max-w-xs">
                            <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                              type="text"
                              placeholder={t("Search by name...")}
                              value={evidenceSearchQuery}
                              onChange={(e) => setEvidenceSearchQuery(e.target.value)}
                              className="w-full ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
                            />
                          </div>
                          <div className="flex items-center gap-3 ms-auto">
                            <Select value={evidenceFrameworkFilter} onValueChange={setEvidenceFrameworkFilter}>
                              <SelectTrigger className="w-[160px] h-9 text-sm bg-slate-50 border-slate-200">
                                <SelectValue placeholder={t("Framework")} />
                              </SelectTrigger>
                              <SelectContent className="bg-white">
                                <SelectItem value="all">{t("All Frameworks")}</SelectItem>
                                {evFrameworks.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Select value={evidenceDeptFilter} onValueChange={setEvidenceDeptFilter}>
                              <SelectTrigger className="w-[160px] h-9 text-sm bg-slate-50 border-slate-200">
                                <SelectValue placeholder={t("Department")} />
                              </SelectTrigger>
                              <SelectContent className="bg-white">
                                <SelectItem value="all">{t("All Departments")}</SelectItem>
                                {evDepartments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Table */}
                        <Table>
                          <TableHeader>
                            <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                              {[
                                { key: "evidenceCode", label: t("Code") },
                                { key: "name", label: t("Name") },
                                { key: "status", label: t("Status") },
                                { key: "assignee", label: t("Assignee") },
                                { key: "department", label: t("Department") },
                              ].map((col, i) => (
                                <TableHead key={col.key} className={`text-xs font-medium text-slate-500 uppercase tracking-wider py-3 cursor-pointer ${i === 0 ? "pl-5" : ""}`} onClick={() => handleEvSortToggle(col.key)}>
                                  <span className="flex items-center gap-1">{col.label} <ArrowUpDown className="h-3 w-3" /></span>
                                </TableHead>
                              ))}
                              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-5">{t("Actions")}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {listEvidences.length === 0 ? (
                              <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={6}>
                                  <div className="py-16 text-center">
                                    <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-4">
                                      <ClipboardList className="h-6 w-6 text-primary-500" />
                                    </div>
                                    <h3 className="text-base font-semibold text-slate-800 mb-1">{t("No Evidence Found")}</h3>
                                    <p className="text-sm text-slate-500">{t("Try adjusting your search or filters.")}</p>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ) : (
                              listEvidences.map((ev) => (
                                <TableRow key={ev.id} className="border-b border-slate-100 last:border-0">
                                  <TableCell className="py-4 pl-5 text-sm font-medium text-slate-800">{ev.evidenceCode}</TableCell>
                                  <TableCell className="py-4 text-sm text-slate-700">{ev.name}</TableCell>
                                  <TableCell className="py-4">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                      ev.status === "Published" || ev.status === "Validated" ? "bg-green-50 text-green-700" :
                                      ev.status === "Draft" ? "bg-blue-50 text-blue-700" :
                                      ev.status === "Not Uploaded" ? "bg-slate-100 text-slate-700" :
                                      "bg-amber-50 text-amber-700"
                                    }`}>{ev.status}</span>
                                  </TableCell>
                                  <TableCell className="py-4 text-sm text-slate-700">{ev.assignee?.fullName || "-"}</TableCell>
                                  <TableCell className="py-4 text-sm text-slate-700">{ev.department?.name || "-"}</TableCell>
                                  <TableCell className="py-4 pr-5">
                                    <div className="flex items-center justify-end gap-0.5">
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => handleEditItem(ev.id, ev.name, "evidences")} title={t("Edit")}>
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-semantic-error" onClick={() => handleDeleteItem(ev.id, ev.name, "evidences")} title={t("Delete")}>
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
            );
          })()}

          {activeTab === "Master data" && masterDataView === null && (
            <div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {[
                  { key: "framework", label: t("Framework"), icon: Layers },
                  { key: "controls", label: t("Controls"), icon: Shield },
                  { key: "policies", label: t("Policies"), icon: FileCheck },
                  { key: "evidences", label: t("Evidences"), icon: ClipboardList },
                  { key: "domains", label: t("Domain"), icon: LayoutGrid },
                ].map((tile) => (
                  <div
                    key={tile.key}
                    className="cursor-pointer rounded-xl border border-slate-200 bg-white p-6 text-center hover:border-primary-300 hover:shadow-sm transition-all"
                    onClick={() => handleMasterDataTileClick(tile.key)}
                  >
                    <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                      <tile.icon className="h-6 w-6 text-primary-500" />
                    </div>
                    <span className="text-sm font-semibold text-slate-800">{tile.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "Master data" && masterDataView !== null && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <button
                  className="text-slate-500 hover:text-slate-700 flex items-center gap-1 text-sm"
                  onClick={() => setMasterDataView(null)}
                >
                  <ChevronLeft className="h-4 w-4 ltr:rotate-0 rtl:rotate-180" />
                  {t("Back")}
                </button>
                <h2 className="text-lg font-semibold text-slate-800 capitalize">{t(masterDataView)}</h2>
              </div>

              {masterDataLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="w-10 h-10 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
                  {masterDataView === "controls" && (
                    <Table className="min-w-[600px]">
                      <TableHeader>
                        <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                          <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pl-5">{t("Code")}</TableHead>
                          <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Name")}</TableHead>
                          <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Domain")}</TableHead>
                          <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Framework")}</TableHead>
                          <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Grouping")}</TableHead>
                          <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Status")}</TableHead>
                          <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-5">{t("Actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {controls.length === 0 ? (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={7}>
                              <div className="py-16 text-center">
                                <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-4"><Shield className="h-6 w-6 text-primary-500" /></div>
                                <h3 className="text-base font-semibold text-slate-800 mb-1">{t("No Controls Found")}</h3>
                                <p className="text-sm text-slate-500">{t("No controls found for this customer.")}</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : controls.map((ctrl) => (
                          <TableRow key={ctrl.id} className="border-b border-slate-100 last:border-0">
                            <TableCell className="py-4 pl-5 text-sm font-medium text-slate-800">{ctrl.controlCode}</TableCell>
                            <TableCell className="py-4 text-sm text-slate-700">{ctrl.name}</TableCell>
                            <TableCell className="py-4 text-sm text-slate-700">{ctrl.domain?.name || "-"}</TableCell>
                            <TableCell className="py-4 text-sm text-slate-700">{ctrl.framework?.name || "-"}</TableCell>
                            <TableCell className="py-4 text-sm text-slate-700">{ctrl.functionalGrouping || "-"}</TableCell>
                            <TableCell className="py-4"><span className={`px-2 py-1 rounded text-xs font-medium ${ctrl.status === "Compliant" ? "bg-green-50 text-green-700" : ctrl.status === "Non Compliant" ? "bg-red-50 text-red-700" : ctrl.status === "Partial Compliant" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700"}`}>{ctrl.status}</span></TableCell>
                            <TableCell className="py-4 pr-5">
                              <div className="flex items-center justify-end gap-0.5">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => handleEditItem(ctrl.id, ctrl.name, "controls")} title={t("Edit")}><Pencil className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-semantic-error" onClick={() => handleDeleteItem(ctrl.id, ctrl.name, "controls")} title={t("Delete")}><Trash2 className="h-4 w-4" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  {masterDataView === "policies" && (
                    <Table>
                      <TableHeader>
                        <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                          <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pl-5">{t("Code")}</TableHead>
                          <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Name")}</TableHead>
                          <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Type")}</TableHead>
                          <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Version")}</TableHead>
                          <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Department")}</TableHead>
                          <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Status")}</TableHead>
                          <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-5">{t("Actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {policies.length === 0 ? (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={7}>
                              <div className="py-16 text-center">
                                <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-4"><FileCheck className="h-6 w-6 text-primary-500" /></div>
                                <h3 className="text-base font-semibold text-slate-800 mb-1">{t("No Policies Found")}</h3>
                                <p className="text-sm text-slate-500">{t("No policies found for this customer.")}</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : policies.map((pol) => (
                          <TableRow key={pol.id} className="border-b border-slate-100 last:border-0">
                            <TableCell className="py-4 pl-5 text-sm font-medium text-slate-800">{pol.code}</TableCell>
                            <TableCell className="py-4 text-sm text-slate-700">{pol.name}</TableCell>
                            <TableCell className="py-4 text-sm text-slate-700">{pol.documentType}</TableCell>
                            <TableCell className="py-4 text-sm text-slate-700">{pol.version}</TableCell>
                            <TableCell className="py-4 text-sm text-slate-700">{pol.department?.name || "-"}</TableCell>
                            <TableCell className="py-4"><span className={`px-2 py-1 rounded text-xs font-medium ${pol.status === "Published" || pol.status === "Approved" ? "bg-green-50 text-green-700" : pol.status === "Draft" ? "bg-blue-50 text-blue-700" : pol.status === "Not Uploaded" ? "bg-slate-100 text-slate-700" : "bg-amber-50 text-amber-700"}`}>{pol.status}</span></TableCell>
                            <TableCell className="py-4 pr-5">
                              <div className="flex items-center justify-end gap-0.5">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => handleEditItem(pol.id, pol.name, "policies")} title={t("Edit")}><Pencil className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-semantic-error" onClick={() => handleDeleteItem(pol.id, pol.name, "policies")} title={t("Delete")}><Trash2 className="h-4 w-4" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  {masterDataView === "evidences" && (
                    <Table>
                      <TableHeader>
                        <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                          <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pl-5">{t("Code")}</TableHead>
                          <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Name")}</TableHead>
                          <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Description")}</TableHead>
                          <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Framework")}</TableHead>
                          <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Status")}</TableHead>
                          <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-5">{t("Actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {evidences.length === 0 ? (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={6}>
                              <div className="py-16 text-center">
                                <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-4"><ClipboardList className="h-6 w-6 text-primary-500" /></div>
                                <h3 className="text-base font-semibold text-slate-800 mb-1">{t("No Evidence Found")}</h3>
                                <p className="text-sm text-slate-500">{t("No evidences found for this customer.")}</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : evidences.map((ev) => (
                          <TableRow key={ev.id} className="border-b border-slate-100 last:border-0">
                            <TableCell className="py-4 pl-5 text-sm font-medium text-slate-800">{ev.evidenceCode}</TableCell>
                            <TableCell className="py-4 text-sm text-slate-700">{ev.name}</TableCell>
                            <TableCell className="py-4 text-sm text-slate-700 max-w-[200px] truncate">{ev.description || "-"}</TableCell>
                            <TableCell className="py-4 text-sm text-slate-700">{ev.framework?.name || "-"}</TableCell>
                            <TableCell className="py-4"><span className={`px-2 py-1 rounded text-xs font-medium ${ev.status === "Published" || ev.status === "Validated" ? "bg-green-50 text-green-700" : ev.status === "Draft" ? "bg-blue-50 text-blue-700" : ev.status === "Not Uploaded" ? "bg-slate-100 text-slate-700" : "bg-amber-50 text-amber-700"}`}>{ev.status}</span></TableCell>
                            <TableCell className="py-4 pr-5">
                              <div className="flex items-center justify-end gap-0.5">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => handleEditItem(ev.id, ev.name, "evidences")} title={t("Edit")}><Pencil className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-semantic-error" onClick={() => handleDeleteItem(ev.id, ev.name, "evidences")} title={t("Delete")}><Trash2 className="h-4 w-4" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  {masterDataView === "domains" && (
                    <Table>
                      <TableHeader>
                        <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                          <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pl-5">{t("Domain Name")}</TableHead>
                          <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Controls Count")}</TableHead>
                          <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-5">{t("Actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {domains.length === 0 ? (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={3}>
                              <div className="py-16 text-center">
                                <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-4"><LayoutGrid className="h-6 w-6 text-primary-500" /></div>
                                <h3 className="text-base font-semibold text-slate-800 mb-1">{t("No Domains Found")}</h3>
                                <p className="text-sm text-slate-500">{t("No domains found.")}</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : domains.map((dom) => (
                          <TableRow key={dom.id} className="border-b border-slate-100 last:border-0">
                            <TableCell className="py-4 pl-5 text-sm font-medium text-slate-800">{dom.name}</TableCell>
                            <TableCell className="py-4 text-sm text-slate-700">{dom._count.controls}</TableCell>
                            <TableCell className="py-4 pr-5">
                              <div className="flex items-center justify-end gap-0.5">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => handleEditItem(dom.id, dom.name, "domains")} title={t("Edit")}><Pencil className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-semantic-error" onClick={() => handleDeleteItem(dom.id, dom.name, "domains")} title={t("Delete")}><Trash2 className="h-4 w-4" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Master Data Edit Dialog */}
      <Dialog open={isEditItemDialogOpen} onOpenChange={setIsEditItemDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[400px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800 capitalize">{t("Edit")} {editItem?.type.slice(0, -1)}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="edit-item-name" className="text-sm font-medium text-slate-700">{t("Name")}</Label>
              <Input
                id="edit-item-name"
                value={editItemName}
                onChange={(e) => setEditItemName(e.target.value)}
                placeholder={t("Enter name")}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" size="sm" onClick={() => setIsEditItemDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button size="sm" onClick={handleSaveEditItem} disabled={!editItemName.trim()}>
              {t("Save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Master Data Delete Dialog */}
      <Dialog open={isDeleteItemDialogOpen} onOpenChange={setIsDeleteItemDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[400px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Confirm Delete")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5">
            <p className="text-sm text-slate-600">
              {t("Are you sure you want to delete")} <strong>{deleteItem?.name}</strong>? {t("This action cannot be undone.")}
            </p>
          </div>
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" size="sm" onClick={() => setIsDeleteItemDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button variant="destructive" size="sm" onClick={handleConfirmDeleteItem}>
              {t("Delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Framework Select Dialog */}
      <Dialog open={isSelectDialogOpen} onOpenChange={setIsSelectDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
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
                className="ltr:pl-9 rtl:pr-9 bg-slate-50 border-slate-200 rounded-lg"
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
        <DialogContent className="max-w-[95vw] sm:max-w-lg p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
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
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder={t("Enter code")}
                className="bg-slate-50 border-slate-200 rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-1 text-sm font-medium text-slate-700">
                {t("Integrated Framework Name")} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t("Enter framework name")}
                className="bg-slate-50 border-slate-200 rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium text-slate-700">{t("Description")}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t("Enter description")}
                rows={3}
                className="bg-slate-50 border-slate-200 rounded-lg"
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
                <SelectTrigger className="bg-slate-50 border-slate-200 rounded-lg">
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
                  className="bg-slate-50 border-slate-200 rounded-lg"
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
                  className="bg-slate-50 border-slate-200 rounded-lg"
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
        <DialogContent className="max-w-[95vw] sm:max-w-2xl p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
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
        <DialogContent className="max-w-[95vw] sm:max-w-[400px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
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
