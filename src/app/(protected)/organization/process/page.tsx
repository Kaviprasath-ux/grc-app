"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Download, Upload, Search, Sparkles, FileText, Eye, BarChart3, ChevronLeft, Loader2, ChevronRight, Home } from "lucide-react";
import Link from "next/link";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { DataGrid } from "@/components/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { ColumnDef } from "@tanstack/react-table";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "next-auth/react";
import { useUserRoles } from "@/hooks/usePermissions";
import { useLanguage } from "@/contexts/LanguageContext";

interface Department {
  id: string;
  name: string;
}

interface User {
  id: string;
  fullName: string;
}

interface BIAData {
  ratings: BIARating[];
  rto: string;
  rpo: string;
  approver: string;
}

interface Process {
  id: string;
  processCode: string;
  name: string;
  description: string | null;
  processType: string;
  departmentId: string | null;
  department: Department | null;
  ownerId: string | null;
  owner: User | null;
  status: string;
  frequency?: string;
  natureOfImplementation?: string;
  assetDependency?: boolean;
  externalDependency?: boolean;
  location?: string;
  kpiMeasurementRequired?: boolean;
  piiCapture?: boolean;
  operationalComplexity?: string;
  lastAuditDate?: string;
  responsible?: string;
  accountable?: string;
  consulted?: string;
  informed?: string;
  biaCompleted?: boolean;
  processCriticality?: string;
  biaData?: BIAData;
}

interface BIARating {
  category: string;
  rating: "High" | "Medium" | "Low" | "";
  description: string;
}

interface ProcessBIAStatus {
  processId: string;
  status: string;
  impactRating?: number;
  processCriticality?: string;
}

const processTypes = ["Primary", "Management", "Supporting"];
const processFrequencies = ["Daily", "Weekly", "Monthly", "Quarterly", "Bi-annually", "Annually", "As needed"];
const natureOfImplementations = ["Manual", "Automated", "Manual + Automated"];
const operationalComplexities = ["Low", "Medium", "High"];
const locations = ["Head Office", "Branch Office", "Remote", "Data Center"];

const impactDescriptions = {
  High: "Major fines/legal action, Complete service outage, > $100K of loss",
  Medium: "Local media/social concern, Reportable incident, Partial service disruption, $10K – $100K",
  Low: "Limited visibility, Minor compliance delay, Workaround available",
};

export default function ProcessPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { data: session } = useSession();
  const userRoles = useUserRoles();
  const { t } = useLanguage();

  // Check if user is DepartmentReviewer (needs to see assigned processes and approve)
  const isDepartmentReviewer = userRoles.some((role) => role === "DepartmentReviewer");
  // Check if user is DepartmentContributor (can add processes with their department pre-selected)
  const isDepartmentContributor = userRoles.some((role) => role === "DepartmentContributor");
  // Check if user is Reviewer (hide Actions and AI Risk columns)
  const isReviewer = userRoles.some((role) => role === "Reviewer");
  // Check if user has roles that can add new processes
  const isCustomerAdministrator = userRoles.some((role) => role === "CustomerAdministrator");
  const isContributor = userRoles.some((role) => role === "Contributor");
  // Only these roles can add new processes
  const canAddProcess = isCustomerAdministrator || isContributor || isDepartmentContributor;
  const userDepartmentId = session?.user?.departmentId;

  const [activeTab, setActiveTab] = useState("repository");
  const [processes, setProcesses] = useState<Process[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [processBIAStatuses, setProcessBIAStatuses] = useState<ProcessBIAStatus[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [frequencyFilter, setFrequencyFilter] = useState("all");
  const [kpiDepartmentFilter, setKpiDepartmentFilter] = useState("all");

  // Dialog states
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingProcessId, setDeletingProcessId] = useState<string | null>(null);
  const [isAIEvaluationOpen, setIsAIEvaluationOpen] = useState(false);
  const [evaluatingProcess, setEvaluatingProcess] = useState<Process | null>(null);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiRisks, setAiRisks] = useState<any[]>([]);
  const [isBIAFormOpen, setIsBIAFormOpen] = useState(false);
  const [biaProcess, setBiaProcess] = useState<Process | null>(null);
  const [biaRatings, setBiaRatings] = useState<BIARating[]>([
    { category: "Financial", rating: "", description: "" },
    { category: "Reputational Impact", rating: "", description: "" },
    { category: "Regulatory", rating: "", description: "" },
    { category: "Safety", rating: "", description: "" },
    { category: "Operational", rating: "", description: "" },
  ]);
  const [biaApprover, setBiaApprover] = useState("");
  const [rto, setRto] = useState("0");
  const [rpo, setRpo] = useState("0");

  // Add/Edit Process Dialog states
  const [isAddProcessOpen, setIsAddProcessOpen] = useState(false);
  const [isEditProcessOpen, setIsEditProcessOpen] = useState(false);
  const [editingProcess, setEditingProcess] = useState<Process | null>(null);

  const handleEvaluateAI = async (process: Process) => {
    setEvaluatingProcess(process);
    setIsAiGenerating(true);
    setAiRisks([]);
    setIsAIEvaluationOpen(true);

    try {
      const response = await fetch("/api/ai/risk-evaluation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processId: process.id }),
      });

      const result = await response.json();
      if (response.ok) {
        setAiRisks(result.risks || []);
        toast({
          title: t("AI Risks Generated"),
          description: `${t("Successfully")} ${result.source === "AI" ? t("generated") : t("retrieved")} ${result.risks.length} ${t("risks")}.`,
        });
        // Refresh process list to reflect new risks if needed
        fetchData();
      } else {
        toast({
          title: t("AI Generation Failed"),
          description: result.error || t("Please try again later."),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t("Error"),
        description: t("Communication with AI service failed."),
        variant: "destructive",
      });
    } finally {
      setIsAiGenerating(false);
    }
  };
  const [saving, setSaving] = useState(false);

  // KPI Modal states
  const [isKPIModalOpen, setIsKPIModalOpen] = useState(false);
  const [selectedKPIProcess, setSelectedKPIProcess] = useState<Process | null>(null);
  const [kpiSearchTerm, setKpiSearchTerm] = useState("");
  const [selectedKPIYear, setSelectedKPIYear] = useState("2026");

  // Process Form state
  const [processForm, setProcessForm] = useState({
    name: "",
    description: "",
    processType: "",
    departmentId: "",
    ownerId: "",
    frequency: "",
    natureOfImplementation: "",
    assetDependency: false,
    externalDependency: false,
    location: "",
    kpiMeasurementRequired: false,
    piiCapture: false,
    operationalComplexity: "",
    responsible: "",
    accountable: "",
    consulted: "",
    informed: "",
  });

  const resetProcessForm = () => {
    setProcessForm({
      name: "",
      description: "",
      processType: "",
      departmentId: "",
      ownerId: "",
      frequency: "",
      natureOfImplementation: "",
      assetDependency: false,
      externalDependency: false,
      location: "",
      kpiMeasurementRequired: false,
      piiCapture: false,
      operationalComplexity: "",
      responsible: "",
      accountable: "",
      consulted: "",
      informed: "",
    });
  };

  const kpiYears = ["2029", "2028", "2027", "2026", "2025", "2024", "2023"];
  const kpiMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [processRes, deptRes, userRes, biaRes] = await Promise.all([
        fetch("/api/processes"),
        fetch("/api/departments"),
        fetch("/api/users"),
        fetch("/api/process-bia"),
      ]);

      if (processRes.ok) setProcesses(await processRes.json());
      if (deptRes.ok) setDepartments(await deptRes.json());
      if (userRes.ok) setUsers(await userRes.json());
      if (biaRes.ok) {
        const biaData = await biaRes.json();
        setProcessBIAStatuses(biaData.map((bia: { processId: string; status: string; impactRating?: number; processCriticality?: string }) => ({
          processId: bia.processId,
          status: bia.status,
          impactRating: bia.impactRating,
          processCriticality: bia.processCriticality,
        })));
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setLoading(false);
  };

  // Filter processes - DepartmentReviewer and DepartmentContributor can only see processes in their department
  const departmentFilteredProcesses = (isDepartmentReviewer || isDepartmentContributor) && userDepartmentId
    ? processes.filter((p) => p.departmentId === userDepartmentId)
    : processes;

  const filteredProcesses = departmentFilteredProcesses.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.processCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = departmentFilter === "all" || p.departmentId === departmentFilter;
    const matchesOwner = ownerFilter === "all" || p.ownerId === ownerFilter;
    return matchesSearch && matchesDepartment && matchesOwner;
  });

  // Process CRUD
  const handleDeleteProcess = async () => {
    if (!deletingProcessId) return;
    try {
      const res = await fetch(`/api/processes/${deletingProcessId}`, { method: "DELETE" });
      if (res.ok) {
        setProcesses(processes.filter((p) => p.id !== deletingProcessId));
      }
    } catch (error) {
      console.error("Error deleting process:", error);
    }
    setIsDeleteDialogOpen(false);
    setDeletingProcessId(null);
  };

  // BIA functions
  const handleBiaRatingChange = (index: number, rating: "High" | "Medium" | "Low" | "") => {
    const newRatings = [...biaRatings];
    newRatings[index] = {
      ...newRatings[index],
      rating,
      description: rating ? impactDescriptions[rating] : "",
    };
    setBiaRatings(newRatings);
  };

  const calculateImpactRating = () => {
    const ratingValues = { High: 100, Medium: 50, Low: 25, "": 0 };
    const maxRating = Math.max(...biaRatings.map((r) => ratingValues[r.rating]));
    return maxRating;
  };

  const getProcessCriticality = () => {
    const rating = calculateImpactRating();
    if (rating >= 100) return "High";
    if (rating >= 50) return "Medium";
    if (rating >= 25) return "Low";
    return "";
  };

  const handleOpenBIAForm = (process: Process) => {
    setBiaProcess(process);

    // Load existing BIA data if available
    if (process.biaCompleted && process.biaData) {
      setBiaRatings(process.biaData.ratings);
      setBiaApprover(process.biaData.approver);
      setRto(process.biaData.rto);
      setRpo(process.biaData.rpo);
    } else {
      // Reset to empty for new BIA
      setBiaRatings([
        { category: "Financial", rating: "", description: "" },
        { category: "Reputational Impact", rating: "", description: "" },
        { category: "Regulatory", rating: "", description: "" },
        { category: "Safety", rating: "", description: "" },
        { category: "Operational", rating: "", description: "" },
      ]);
      setBiaApprover("");
      setRto("0");
      setRpo("0");
    }
    setIsBIAFormOpen(true);
  };

  const handleSaveBIA = () => {
    if (!biaProcess) return;
    const criticality = getProcessCriticality();

    // Store BIA data in the process
    const biaData: BIAData = {
      ratings: biaRatings,
      rto,
      rpo,
      approver: biaApprover,
    };

    setProcesses(processes.map((p) =>
      p.id === biaProcess.id
        ? { ...p, biaCompleted: true, processCriticality: criticality, biaData }
        : p
    ));
    setIsBIAFormOpen(false);
    setBiaProcess(null);
  };

  // Helper function to get BIA status for a process
  const getBIAStatus = (processId: string) => {
    return processBIAStatuses.find((b) => b.processId === processId);
  };

  // Handle Add Process
  const handleAddProcess = async () => {
    if (!processForm.name || !processForm.processType) {
      toast({
        title: t("Error"),
        description: t("Please fill in required fields (Name and Process Type)"),
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/processes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(processForm),
      });

      if (res.ok) {
        const newProcess = await res.json();
        setProcesses([...processes, newProcess]);
        resetProcessForm();
        setIsAddProcessOpen(false);
        toast({
          title: t("Success"),
          description: t("Process created successfully"),
        });
      } else {
        const error = await res.json();
        toast({
          title: t("Error"),
          description: error.error || t("Failed to create process"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error adding process:", error);
      toast({
        title: t("Error"),
        description: t("Failed to create process"),
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  // Handle Edit Process
  const handleEditProcess = async () => {
    if (!editingProcess) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/processes/${editingProcess.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingProcess),
      });

      if (res.ok) {
        const updated = await res.json();
        setProcesses(processes.map((p) => (p.id === updated.id ? updated : p)));
        setIsEditProcessOpen(false);
        setEditingProcess(null);
        toast({
          title: t("Success"),
          description: t("Process updated successfully"),
        });
      } else {
        const error = await res.json();
        toast({
          title: t("Error"),
          description: error.error || t("Failed to update process"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error updating process:", error);
      toast({
        title: t("Error"),
        description: t("Failed to update process"),
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  // Generate KPI chart data
  const generateKPIChartData = () => {
    return kpiMonths.map((month) => ({
      month,
      achievedValue: null,
      expectedValue: 80,
    }));
  };

  // Open Edit Process modal
  const openEditProcess = (process: Process) => {
    setEditingProcess(process);
    setIsEditProcessOpen(true);
  };

  // Open KPI Modal
  const openKPIModal = (process: Process) => {
    setSelectedKPIProcess(process);
    setIsKPIModalOpen(true);
  };

  // BIA columns
  const biaColumns: ColumnDef<Process>[] = [
    {
      accessorKey: "processCode",
      header: t("Reference ID"),
      cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("processCode")}</span>,
    },
    {
      accessorKey: "name",
      header: t("Name"),
      cell: ({ row }) => <span className="font-medium">{row.getValue("name")}</span>,
    },
    {
      accessorKey: "department.name",
      header: t("Department"),
      cell: ({ row }) => row.original.department?.name || "-",
    },
    {
      accessorKey: "owner.fullName",
      header: t("Process Owner"),
      cell: ({ row }) => row.original.owner?.fullName || "-",
    },
    {
      accessorKey: "processCriticality",
      header: t("Process Criticality"),
      cell: ({ row }) => {
        const biaStatus = getBIAStatus(row.original.id);
        const criticality = biaStatus?.processCriticality || row.original.processCriticality;
        if (!criticality) return "-";
        return (
          <Badge variant={criticality === "High" || criticality === "Critical" ? "destructive" : criticality === "Medium" ? "secondary" : "outline"}>
            {criticality}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => {
        const biaStatus = getBIAStatus(row.original.id);
        const status = biaStatus?.status || "Open";
        const isPendingApproval = status === "Pending Approval";
        const isApproved = status === "Approved";
        const isSentBack = status === "Sent Back";
        const hasComments = biaStatus && (isPendingApproval || isApproved || isSentBack);

        // DepartmentReviewer sees "View" button for all BIAs (they review pending ones)
        // Note: Reviewer role has Perform BIA access same as CustomerAdmin (not DepartmentReviewer behavior)
        if (isDepartmentReviewer && !isReviewer) {
          return (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/organization/process/bia/${row.original.id}`)}
            >
              <Eye className="h-4 w-4 mr-1" />
              {t("View")}
            </Button>
          );
        }

        // CustomerAdmin/Contributor view
        // If approved or pending approval - show View button
        if (isApproved || isPendingApproval) {
          return (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/organization/process/bia/${row.original.id}`)}
            >
              <Eye className="h-4 w-4 mr-1" />
              {t("View")}
            </Button>
          );
        }

        // If sent back - show Respond button (to re-submit)
        if (isSentBack) {
          return (
            <Button
              variant="default"
              size="sm"
              onClick={() => router.push(`/organization/process/bia/${row.original.id}`)}
            >
              {t("Respond")}
            </Button>
          );
        }

        // Open/New - show Perform BIA button
        return (
          <div className="flex gap-2 items-center">
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                setBiaProcess(row.original);
                setIsBIAFormOpen(true);
              }}
            >
              {t("Perform BIA")}
            </Button>
          </div>
        );
      },
    },
  ];

  // Process columns
  const processColumns: ColumnDef<Process>[] = [
    {
      accessorKey: "processCode",
      header: t("Reference ID"),
      cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("processCode")}</span>,
    },
    {
      accessorKey: "name",
      header: t("Name"),
      cell: ({ row }) => <span className="font-medium">{row.getValue("name")}</span>,
    },
    {
      accessorKey: "description",
      header: t("Description"),
      cell: ({ row }) => {
        const desc = row.getValue("description") as string;
        return <span className="text-sm text-slate-400 truncate max-w-[180px] block">{desc || "-"}</span>;
      },
    },
    {
      accessorKey: "department.name",
      header: t("Department"),
      cell: ({ row }) => row.original.department?.name || "-",
    },
    {
      accessorKey: "owner.fullName",
      header: t("Process Owner"),
      cell: ({ row }) => row.original.owner?.fullName || "-",
    },
    {
      accessorKey: "frequency",
      header: t("Process Frequency"),
      cell: ({ row }) => row.original.frequency || "-",
    },
    {
      accessorKey: "natureOfImplementation",
      header: t("Nature Of Implementation"),
      cell: ({ row }) => row.original.natureOfImplementation || "-",
    },
    // Hide AI Risk column for Reviewer role
    ...(!isReviewer ? [{
      id: "aiRisk",
      header: t("AI Risk"),
      cell: ({ row }: { row: { original: Process } }) => (
        <Button
          variant="outline"
          size="sm"
          className="text-primary-600 border-primary-200"
          onClick={() => handleEvaluateAI(row.original)}
          disabled={isAiGenerating && evaluatingProcess?.id === row.original.id}
        >
          {isAiGenerating && evaluatingProcess?.id === row.original.id ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-1" />
          )}
          {t("AI Risk Evaluation")}
        </Button>
      ),
    }] : []),
    // Hide actions column for Reviewer and DepartmentContributor roles
    ...(!isDepartmentContributor && !isReviewer ? [{
      id: "actions",
      header: t("Actions"),
      cell: ({ row }: { row: { original: Process } }) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-slate-600"
            onClick={() => openEditProcess(row.original)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-semantic-error"
            onClick={() => {
              setDeletingProcessId(row.original.id);
              setIsDeleteDialogOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    }] : []),
  ];

  // Performance Dashboard columns - matching UAT structure (Process Name, Department Name, Action)
  const performanceColumns: ColumnDef<Process>[] = [
    {
      accessorKey: "name",
      header: t("Process Name"),
      cell: ({ row }) => <span className="font-medium">{row.getValue("name")}</span>,
    },
    {
      accessorKey: "department.name",
      header: t("Department Name"),
      cell: ({ row }) => row.original.department?.name || "-",
    },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => openKPIModal(row.original)}
          title={t("View KPI Details")}
        >
          <BarChart3 className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">{t("Loading...")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>Organization</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">Process</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800">{t("Process")}</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="repository">{t("Repository")}</TabsTrigger>
          <TabsTrigger value="bia">{t("Business Impact Analysis")}</TabsTrigger>
          <TabsTrigger value="performance">{t("Performance Dashboard")}</TabsTrigger>
        </TabsList>

        {/* Repository Tab */}
        <TabsContent value="repository" className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={t("Search processes...")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-[250px] bg-white"
                />
              </div>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-[180px] bg-white">
                  <SelectValue placeholder={t("Department")} />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  <SelectItem value="all">{t("All Departments")}</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                <SelectTrigger className="w-[180px] bg-white">
                  <SelectValue placeholder={t("Process Owner")} />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  <SelectItem value="all">{t("All Owners")}</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={frequencyFilter} onValueChange={setFrequencyFilter}>
                <SelectTrigger className="w-[150px] bg-white">
                  <SelectValue placeholder={t("Frequency")} />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  <SelectItem value="all">{t("All Frequencies")}</SelectItem>
                  {processFrequencies.map((freq) => (
                    <SelectItem key={freq} value={freq}>
                      {freq}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                {t("Export")}
              </Button>
              {!isDepartmentContributor && (
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  {t("Import")}
                </Button>
              )}
              {canAddProcess && (
                <Button onClick={() => setIsAddProcessOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t("Add New")}
                </Button>
              )}
            </div>
          </div>

          <DataGrid
            columns={processColumns}
            data={filteredProcesses}
            hideSearch={true}
          />
        </TabsContent>

        {/* Business Impact Analysis Tab */}
        <TabsContent value="bia" className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={t("Search By Process ID, Name")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-[250px] bg-white"
                />
              </div>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-[180px] bg-white">
                  <SelectValue placeholder={t("Department")} />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  <SelectItem value="all">{t("All Departments")}</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                <SelectTrigger className="w-[180px] bg-white">
                  <SelectValue placeholder={t("Process Owner")} />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  <SelectItem value="all">{t("All Owners")}</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              {t("Export")}
            </Button>
          </div>

          <DataGrid
            columns={biaColumns}
            data={filteredProcesses}
            hideSearch={true}
          />
        </TabsContent>

        {/* Performance Dashboard Tab - Matching UAT structure */}
        <TabsContent value="performance" className="mt-6 space-y-6">
          {/* Two Donut Charts Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Status Chart */}
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="text-base font-semibold text-slate-800">{t("Status")}</h3>
              </div>
              <div className="p-6">
                {(() => {
                  const kpiProcesses = departmentFilteredProcesses.filter((p) => p.kpiMeasurementRequired);
                  const total = kpiProcesses.length || 1;
                  // For now, show all as "Achieved" since we don't have KPI status tracking yet
                  const statusData = [
                    { name: t("Scheduled"), value: 0, color: "#3b82f6" },
                    { name: t("Missed"), value: 0, color: "#f59e0b" },
                    { name: t("Overdue"), value: 0, color: "#22c55e" },
                    { name: t("Achieved"), value: kpiProcesses.length, color: "#1e3a5f" },
                  ];
                  const hasData = statusData.some(d => d.value > 0);

                  return (
                    <div className="flex flex-col items-center">
                      <div className="h-[200px] w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={hasData ? statusData.filter(d => d.value > 0) : [{ name: t("No Data"), value: 1, color: "#e5e7eb" }]}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={80}
                              paddingAngle={2}
                              dataKey="value"
                              label={({ percent }) => hasData && percent ? `${(percent * 100).toFixed(0)}%` : ""}
                              labelLine={false}
                            >
                              {(hasData ? statusData.filter(d => d.value > 0) : [{ name: t("No Data"), value: 1, color: "#e5e7eb" }]).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <RechartsTooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-wrap justify-center gap-4 mt-4">
                        {statusData.map((item, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
                            <span className="text-sm text-slate-600">{item.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Department Chart */}
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="text-base font-semibold text-slate-800">{t("Department")}</h3>
              </div>
              <div className="p-6">
                {(() => {
                  const kpiProcesses = departmentFilteredProcesses.filter((p) => p.kpiMeasurementRequired);
                  // Group by department
                  const deptCounts: Record<string, number> = {};
                  kpiProcesses.forEach((p) => {
                    const deptName = p.department?.name || t("Unassigned");
                    deptCounts[deptName] = (deptCounts[deptName] || 0) + 1;
                  });
                  const colors = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];
                  const deptData = Object.entries(deptCounts).map(([name, value], idx) => ({
                    name,
                    value,
                    color: colors[idx % colors.length],
                  }));
                  const hasData = deptData.length > 0;
                  const total = kpiProcesses.length || 1;

                  return (
                    <div className="flex flex-col items-center">
                      <div className="h-[200px] w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={hasData ? deptData : [{ name: t("No Data"), value: 1, color: "#e5e7eb" }]}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={80}
                              paddingAngle={2}
                              dataKey="value"
                              label={({ percent }) => hasData && percent ? `${(percent * 100).toFixed(0)}%` : ""}
                              labelLine={false}
                            >
                              {(hasData ? deptData : [{ name: t("No Data"), value: 1, color: "#e5e7eb" }]).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <RechartsTooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-wrap justify-center gap-4 mt-4">
                        {(hasData ? deptData : []).map((item, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
                            <span className="text-sm text-slate-600">{item.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Search and Department Filter */}
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder={t("Search processes...")}
                value={kpiSearchTerm}
                onChange={(e) => setKpiSearchTerm(e.target.value)}
                className="pl-10 w-full bg-white"
              />
            </div>
            <Select value={kpiDepartmentFilter} onValueChange={setKpiDepartmentFilter}>
              <SelectTrigger className="w-[200px] bg-white">
                <SelectValue placeholder={t("Department")} />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4}>
                <SelectItem value="all">{t("All Departments")}</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* KPI Processes Table */}
          {(() => {
            const kpiProcesses = departmentFilteredProcesses.filter((p) => p.kpiMeasurementRequired);
            const filteredKpiProcesses = kpiProcesses.filter((p) => {
              const matchesSearch = p.name.toLowerCase().includes(kpiSearchTerm.toLowerCase());
              const matchesDepartment = kpiDepartmentFilter === "all" || p.departmentId === kpiDepartmentFilter;
              return matchesSearch && matchesDepartment;
            });

            return filteredKpiProcesses.length > 0 ? (
              <DataGrid
                columns={performanceColumns}
                data={filteredKpiProcesses}
                hideSearch={true}
              />
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-12">
                <div className="flex flex-col items-center justify-center text-center">
                  <FileText className="h-12 w-12 text-slate-400 mb-4" />
                  <h3 className="text-base font-semibold text-slate-800 mb-1">{t("No KPI Data")}</h3>
                  <p className="text-sm text-slate-500">
                    {t("No processes have KPI measurement enabled. Enable KPI Measurement Required when adding a process to see it here.")}
                  </p>
                </div>
              </div>
            );
          })()}
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Confirm Delete")}</DialogTitle>
            <DialogDescription>
              {t("Are you sure you want to delete this process? This action cannot be undone.")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDeleteProcess}>
              {t("Delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Risk Evaluation Dialog */}
      <Dialog open={isAIEvaluationOpen} onOpenChange={setIsAIEvaluationOpen}>
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                <Sparkles className="h-5 w-5 text-primary-600" />
                {t("AI Risk Evaluation")}
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-700">{t("Process")}: {evaluatingProcess?.name}</p>
              <p className="text-xs text-slate-500 line-clamp-2">{evaluatingProcess?.description}</p>
            </div>

            {isAiGenerating ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="h-12 w-12 text-primary-600 animate-spin" />
                <p className="text-sm text-slate-600 font-medium">{t("AI is identifying potential risks...")}</p>
                <p className="text-xs text-slate-400">{t("This may take up to 30 seconds")}</p>
              </div>
            ) : aiRisks.length > 0 ? (
              <div className="space-y-6">
                <div className="p-4 bg-primary-50 rounded-lg border border-primary-200">
                  <h4 className="font-medium text-primary-900 mb-2">{t("Detected Risks")} ({aiRisks.length})</h4>
                  <p className="text-sm text-primary-700">
                    {t("The AI has identified the following risks, threats, and suggested controls. These are now persisted in your Risk Register.")}
                  </p>
                </div>
                <div className="space-y-4">
                  {aiRisks.map((risk, idx) => (
                    <div key={idx} className="border border-slate-200 rounded-lg p-4 space-y-3 bg-white shadow-sm">
                      <div className="flex justify-between items-start">
                        <h5 className="font-semibold text-slate-900">{risk.name}</h5>
                        <Badge className={
                          risk.riskRating === "High" ? "bg-error-light text-error-dark" :
                            risk.riskRating === "Medium" ? "bg-warning-light text-warning-dark" :
                              "bg-success-light text-success-dark"
                        }>
                          {risk.riskRating}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600">{risk.description}</p>

                      {risk.threats?.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-400 uppercase">{t("Threats")}</p>
                          <div className="flex flex-wrap gap-2">
                            {risk.threats.map((tm: any, tIdx: number) => (
                              <Badge key={tIdx} variant="outline" className="text-[10px] py-0">
                                {tm.threat?.name || tm.threatId}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {risk.controlRisks?.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-400 uppercase">{t("Suggested Controls")}</p>
                          <div className="space-y-1">
                            {risk.controlRisks.map((cr: any, cIdx: number) => (
                              <div key={cIdx} className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-1.5 rounded">
                                <span className="font-mono text-[10px] bg-slate-200 px-1 rounded">{cr.control.functionalGrouping}</span>
                                <span className="flex-1">{cr.control.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Sparkles className="h-12 w-12 mb-4 opacity-20" />
                <p>{t("No risks generated yet.")}</p>
              </div>
            )}
          </div>
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => setIsAIEvaluationOpen(false)}>
              {t("Close")}
            </Button>
            <Button onClick={() => router.push("/risks/register")}>
              {t("Go to Risk Register")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* BIA Form Dialog */}
      <Dialog open={isBIAFormOpen} onOpenChange={setIsBIAFormOpen}>
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Business Impact Analysis")} - {biaProcess?.name}</DialogTitle>
            </DialogHeader>
          </div>
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {/* Status and Controls Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Status & Approval")}</h4>
                <Badge variant="outline" className="bg-info-light text-info-dark border-info">{t("Open")}</Badge>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label className="text-sm font-medium text-slate-700">{t("Approver")}</Label>
                  <Select value={biaApprover} onValueChange={setBiaApprover}>
                    <SelectTrigger className="w-full mt-1.5 bg-white">
                      <SelectValue placeholder={t("Select Approver")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="pt-6">
                  <Button variant="outline" size="sm" disabled={!biaApprover}>
                    {t("Submit For Approval")}
                  </Button>
                </div>
              </div>
            </div>

            {/* Impact Assessment Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Impact Assessment")}</h4>

              {/* Category Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-3 bg-slate-800 text-white">
                  <div className="px-4 py-3 text-sm font-medium">{t("Category")}</div>
                  <div className="px-4 py-3 text-sm font-medium text-center">{t("BIA Rating")}</div>
                  <div className="px-4 py-3 text-sm font-medium">{t("Description")}</div>
                </div>

                {/* Table Rows */}
                {biaRatings.map((item, index) => (
                  <div key={item.category} className="grid grid-cols-3 border-b border-slate-100 last:border-b-0">
                    <div className="px-4 py-3 text-sm font-medium text-slate-700">{t(item.category)}</div>
                    <div className="px-4 py-3 flex justify-center">
                      <Select
                        value={item.rating}
                        onValueChange={(value) => handleBiaRatingChange(index, value as "High" | "Medium" | "Low" | "")}
                      >
                        <SelectTrigger className="w-[120px] bg-white">
                          <SelectValue placeholder={t("Select")} />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
                          <SelectItem value="High">{t("High")}</SelectItem>
                          <SelectItem value="Medium">{t("Medium")}</SelectItem>
                          <SelectItem value="Low">{t("Low")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="px-4 py-3 text-sm text-slate-500">
                      {item.description || "-"}
                    </div>
                  </div>
                ))}
              </div>

              {/* Impact Rating Box */}
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-slate-800">{t("Impact Rating")} = {calculateImpactRating()}</span>
                    <p className="text-xs text-slate-500 mt-1">{t("Note: The highest rating will be taken")}</p>
                  </div>
                  <Badge
                    className={
                      getProcessCriticality() === "High"
                        ? "bg-error-light text-error-dark border-error"
                        : getProcessCriticality() === "Medium"
                          ? "bg-warning-light text-warning-dark border-warning"
                          : "bg-success-light text-success-dark border-success"
                    }
                  >
                    {getProcessCriticality() || t("N/A")}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Recovery Metrics Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Recovery Metrics")}</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("RTO (Recovery Time Objective) - Hours")}</Label>
                  <Input
                    type="number"
                    value={rto}
                    onChange={(e) => setRto(e.target.value)}
                    min="0"
                    className="mt-1.5 bg-white"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("RPO (Recovery Point Objective) - Hours")}</Label>
                  <Input
                    type="number"
                    value={rpo}
                    onChange={(e) => setRpo(e.target.value)}
                    min="0"
                    className="mt-1.5 bg-white"
                  />
                </div>
              </div>
            </div>
          </div>
          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => setIsBIAFormOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleSaveBIA}>
              {t("Save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Process Dialog */}
      <Dialog open={isAddProcessOpen} onOpenChange={(open) => {
        setIsAddProcessOpen(open);
        if (!open) resetProcessForm();
      }}>
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add New Process")}</DialogTitle>
            </DialogHeader>
          </div>
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {/* Basic Information Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Basic Information")}</h4>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-sm font-medium text-slate-700">{t("Process Name")} <span className="text-error">*</span></Label>
                  <Input
                    id="name"
                    value={processForm.name}
                    onChange={(e) => setProcessForm({ ...processForm, name: e.target.value })}
                    placeholder={t("Enter process name")}
                    className="mt-1.5 bg-white"
                  />
                </div>
                <div>
                  <Label htmlFor="description" className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                  <Textarea
                    id="description"
                    value={processForm.description}
                    onChange={(e) => setProcessForm({ ...processForm, description: e.target.value })}
                    placeholder={t("Enter process description")}
                    className="mt-1.5 bg-white"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Process Type")} <span className="text-error">*</span></Label>
                    <Select value={processForm.processType} onValueChange={(value) => setProcessForm({ ...processForm, processType: value })}>
                      <SelectTrigger className="w-full mt-1.5 bg-white">
                        <SelectValue placeholder={t("Select type")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {processTypes.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Department")}</Label>
                    <Select value={processForm.departmentId} onValueChange={(value) => setProcessForm({ ...processForm, departmentId: value })}>
                      <SelectTrigger className="w-full mt-1.5 bg-white">
                        <SelectValue placeholder={t("Select department")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Process Details Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Process Details")}</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Process Owner")}</Label>
                  <Select value={processForm.ownerId} onValueChange={(value) => setProcessForm({ ...processForm, ownerId: value })}>
                    <SelectTrigger className="w-full mt-1.5 bg-white">
                      <SelectValue placeholder={t("Select owner")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>{user.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Frequency")}</Label>
                  <Select value={processForm.frequency} onValueChange={(value) => setProcessForm({ ...processForm, frequency: value })}>
                    <SelectTrigger className="w-full mt-1.5 bg-white">
                      <SelectValue placeholder={t("Select frequency")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {processFrequencies.map((freq) => (
                        <SelectItem key={freq} value={freq}>{freq}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Nature of Implementation")}</Label>
                  <Select value={processForm.natureOfImplementation} onValueChange={(value) => setProcessForm({ ...processForm, natureOfImplementation: value })}>
                    <SelectTrigger className="w-full mt-1.5 bg-white">
                      <SelectValue placeholder={t("Select implementation")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {natureOfImplementations.map((nature) => (
                        <SelectItem key={nature} value={nature}>{nature}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Location")}</Label>
                  <Select value={processForm.location} onValueChange={(value) => setProcessForm({ ...processForm, location: value })}>
                    <SelectTrigger className="w-full mt-1.5 bg-white">
                      <SelectValue placeholder={t("Select location")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {locations.map((loc) => (
                        <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-sm font-medium text-slate-700">{t("Operational Complexity")}</Label>
                  <Select value={processForm.operationalComplexity} onValueChange={(value) => setProcessForm({ ...processForm, operationalComplexity: value })}>
                    <SelectTrigger className="w-full mt-1.5 bg-white">
                      <SelectValue placeholder={t("Select complexity")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {operationalComplexities.map((complexity) => (
                        <SelectItem key={complexity} value={complexity}>{complexity}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Dependencies & Options Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Dependencies & Options")}</h4>
              <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="assetDependency"
                    checked={processForm.assetDependency}
                    onCheckedChange={(checked) => setProcessForm({ ...processForm, assetDependency: checked as boolean })}
                  />
                  <Label htmlFor="assetDependency" className="text-sm text-slate-700 font-normal">{t("Asset Dependency")}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="externalDependency"
                    checked={processForm.externalDependency}
                    onCheckedChange={(checked) => setProcessForm({ ...processForm, externalDependency: checked as boolean })}
                  />
                  <Label htmlFor="externalDependency" className="text-sm text-slate-700 font-normal">{t("External Dependency")}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="kpiMeasurementRequired"
                    checked={processForm.kpiMeasurementRequired}
                    onCheckedChange={(checked) => setProcessForm({ ...processForm, kpiMeasurementRequired: checked as boolean })}
                  />
                  <Label htmlFor="kpiMeasurementRequired" className="text-sm text-slate-700 font-normal">{t("KPI Measurement Required")}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="piiCapture"
                    checked={processForm.piiCapture}
                    onCheckedChange={(checked) => setProcessForm({ ...processForm, piiCapture: checked as boolean })}
                  />
                  <Label htmlFor="piiCapture" className="text-sm text-slate-700 font-normal">{t("PII Capture")}</Label>
                </div>
              </div>
            </div>

            {/* RACI Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("RACI Matrix")}</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="responsible" className="text-sm font-medium text-slate-700">{t("Responsible")}</Label>
                  <Input
                    id="responsible"
                    value={processForm.responsible}
                    onChange={(e) => setProcessForm({ ...processForm, responsible: e.target.value })}
                    placeholder={t("Enter responsible party")}
                    className="mt-1.5 bg-white"
                  />
                </div>
                <div>
                  <Label htmlFor="accountable" className="text-sm font-medium text-slate-700">{t("Accountable")}</Label>
                  <Input
                    id="accountable"
                    value={processForm.accountable}
                    onChange={(e) => setProcessForm({ ...processForm, accountable: e.target.value })}
                    placeholder={t("Enter accountable party")}
                    className="mt-1.5 bg-white"
                  />
                </div>
                <div>
                  <Label htmlFor="consulted" className="text-sm font-medium text-slate-700">{t("Consulted")}</Label>
                  <Input
                    id="consulted"
                    value={processForm.consulted}
                    onChange={(e) => setProcessForm({ ...processForm, consulted: e.target.value })}
                    placeholder={t("Enter consulted parties")}
                    className="mt-1.5 bg-white"
                  />
                </div>
                <div>
                  <Label htmlFor="informed" className="text-sm font-medium text-slate-700">{t("Informed")}</Label>
                  <Input
                    id="informed"
                    value={processForm.informed}
                    onChange={(e) => setProcessForm({ ...processForm, informed: e.target.value })}
                    placeholder={t("Enter informed parties")}
                    className="mt-1.5 bg-white"
                  />
                </div>
              </div>
            </div>
          </div>
          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => setIsAddProcessOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleAddProcess} disabled={saving}>
              {saving ? t("Saving...") : t("Add Process")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Process Dialog */}
      <Dialog open={isEditProcessOpen} onOpenChange={(open) => {
        setIsEditProcessOpen(open);
        if (!open) setEditingProcess(null);
      }}>
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Edit Process")}</DialogTitle>
            </DialogHeader>
          </div>
          {editingProcess && (
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              {/* Basic Information Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Basic Information")}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Process Code")}</Label>
                    <Input
                      value={editingProcess.processCode}
                      disabled
                      className="mt-1.5 bg-slate-50"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Status")}</Label>
                    <Input
                      value={editingProcess.status}
                      disabled
                      className="mt-1.5 bg-slate-50"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="editName" className="text-sm font-medium text-slate-700">{t("Process Name")} <span className="text-error">*</span></Label>
                  <Input
                    id="editName"
                    value={editingProcess.name}
                    onChange={(e) => setEditingProcess({ ...editingProcess, name: e.target.value })}
                    placeholder={t("Enter process name")}
                    className="mt-1.5 bg-white"
                  />
                </div>
                <div>
                  <Label htmlFor="editDescription" className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                  <Textarea
                    id="editDescription"
                    value={editingProcess.description || ""}
                    onChange={(e) => setEditingProcess({ ...editingProcess, description: e.target.value })}
                    placeholder={t("Enter process description")}
                    className="mt-1.5 bg-white"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Process Type")} <span className="text-error">*</span></Label>
                    <Select value={editingProcess.processType} onValueChange={(value) => setEditingProcess({ ...editingProcess, processType: value })}>
                      <SelectTrigger className="w-full mt-1.5 bg-white">
                        <SelectValue placeholder={t("Select type")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {processTypes.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Department")}</Label>
                    <Select value={editingProcess.departmentId || ""} onValueChange={(value) => setEditingProcess({ ...editingProcess, departmentId: value })}>
                      <SelectTrigger className="w-full mt-1.5 bg-white">
                        <SelectValue placeholder={t("Select department")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Process Details Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Process Details")}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Process Owner")}</Label>
                    <Select value={editingProcess.ownerId || ""} onValueChange={(value) => setEditingProcess({ ...editingProcess, ownerId: value })}>
                      <SelectTrigger className="w-full mt-1.5 bg-white">
                        <SelectValue placeholder={t("Select owner")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>{user.fullName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Frequency")}</Label>
                    <Select value={editingProcess.frequency || ""} onValueChange={(value) => setEditingProcess({ ...editingProcess, frequency: value })}>
                      <SelectTrigger className="w-full mt-1.5 bg-white">
                        <SelectValue placeholder={t("Select frequency")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {processFrequencies.map((freq) => (
                          <SelectItem key={freq} value={freq}>{freq}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Nature of Implementation")}</Label>
                    <Select value={editingProcess.natureOfImplementation || ""} onValueChange={(value) => setEditingProcess({ ...editingProcess, natureOfImplementation: value })}>
                      <SelectTrigger className="w-full mt-1.5 bg-white">
                        <SelectValue placeholder={t("Select implementation")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {natureOfImplementations.map((nature) => (
                          <SelectItem key={nature} value={nature}>{nature}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Location")}</Label>
                    <Select value={editingProcess.location || ""} onValueChange={(value) => setEditingProcess({ ...editingProcess, location: value })}>
                      <SelectTrigger className="w-full mt-1.5 bg-white">
                        <SelectValue placeholder={t("Select location")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {locations.map((loc) => (
                          <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-sm font-medium text-slate-700">{t("Operational Complexity")}</Label>
                    <Select value={editingProcess.operationalComplexity || ""} onValueChange={(value) => setEditingProcess({ ...editingProcess, operationalComplexity: value })}>
                      <SelectTrigger className="w-full mt-1.5 bg-white">
                        <SelectValue placeholder={t("Select complexity")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {operationalComplexities.map((complexity) => (
                          <SelectItem key={complexity} value={complexity}>{complexity}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Dependencies & Options Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Dependencies & Options")}</h4>
                <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="editAssetDependency"
                      checked={editingProcess.assetDependency || false}
                      onCheckedChange={(checked) => setEditingProcess({ ...editingProcess, assetDependency: checked as boolean })}
                    />
                    <Label htmlFor="editAssetDependency" className="text-sm text-slate-700 font-normal">{t("Asset Dependency")}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="editExternalDependency"
                      checked={editingProcess.externalDependency || false}
                      onCheckedChange={(checked) => setEditingProcess({ ...editingProcess, externalDependency: checked as boolean })}
                    />
                    <Label htmlFor="editExternalDependency" className="text-sm text-slate-700 font-normal">{t("External Dependency")}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="editKpiMeasurementRequired"
                      checked={editingProcess.kpiMeasurementRequired || false}
                      onCheckedChange={(checked) => setEditingProcess({ ...editingProcess, kpiMeasurementRequired: checked as boolean })}
                    />
                    <Label htmlFor="editKpiMeasurementRequired" className="text-sm text-slate-700 font-normal">{t("KPI Measurement Required")}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="editPiiCapture"
                      checked={editingProcess.piiCapture || false}
                      onCheckedChange={(checked) => setEditingProcess({ ...editingProcess, piiCapture: checked as boolean })}
                    />
                    <Label htmlFor="editPiiCapture" className="text-sm text-slate-700 font-normal">{t("PII Capture")}</Label>
                  </div>
                </div>
              </div>

              {/* RACI Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("RACI Matrix")}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="editResponsible" className="text-sm font-medium text-slate-700">{t("Responsible")}</Label>
                    <Input
                      id="editResponsible"
                      value={editingProcess.responsible || ""}
                      onChange={(e) => setEditingProcess({ ...editingProcess, responsible: e.target.value })}
                      placeholder={t("Enter responsible party")}
                      className="mt-1.5 bg-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="editAccountable" className="text-sm font-medium text-slate-700">{t("Accountable")}</Label>
                    <Input
                      id="editAccountable"
                      value={editingProcess.accountable || ""}
                      onChange={(e) => setEditingProcess({ ...editingProcess, accountable: e.target.value })}
                      placeholder={t("Enter accountable party")}
                      className="mt-1.5 bg-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="editConsulted" className="text-sm font-medium text-slate-700">{t("Consulted")}</Label>
                    <Input
                      id="editConsulted"
                      value={editingProcess.consulted || ""}
                      onChange={(e) => setEditingProcess({ ...editingProcess, consulted: e.target.value })}
                      placeholder={t("Enter consulted parties")}
                      className="mt-1.5 bg-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="editInformed" className="text-sm font-medium text-slate-700">{t("Informed")}</Label>
                    <Input
                      id="editInformed"
                      value={editingProcess.informed || ""}
                      onChange={(e) => setEditingProcess({ ...editingProcess, informed: e.target.value })}
                      placeholder={t("Enter informed parties")}
                      className="mt-1.5 bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => setIsEditProcessOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleEditProcess} disabled={saving}>
              {saving ? t("Saving...") : t("Save Changes")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* KPI Details Modal */}
      <Dialog open={isKPIModalOpen} onOpenChange={(open) => {
        setIsKPIModalOpen(open);
        if (!open) setSelectedKPIProcess(null);
      }}>
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("KPI Details")} - {selectedKPIProcess?.name}</DialogTitle>
            </DialogHeader>
          </div>
          {selectedKPIProcess && (
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              {/* KPI Chart Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Performance Chart")}</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-400">{t("Year")}</span>
                    <Select value={selectedKPIYear} onValueChange={setSelectedKPIYear}>
                      <SelectTrigger className="w-[100px] bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {kpiYears.map((year) => (
                          <SelectItem key={year} value={year}>{year}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => setSelectedKPIYear("2026")}
                    >
                      ✕
                    </Button>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <div>
                    {/* Line Chart */}
                    <div className="h-[250px] mb-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={generateKPIChartData()}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis domain={[0, 100]} />
                          <RechartsTooltip />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="achievedValue"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dot={{ fill: "#3b82f6", r: 4 }}
                            name={t("Achieved Value")}
                            connectNulls={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="expectedValue"
                            stroke="#f59e0b"
                            strokeWidth={2}
                            name={t("Expected Value")}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Legend */}
                    <div className="flex justify-end gap-6">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-1 bg-blue-500" />
                        <span className="text-sm text-slate-600">{t("Achieved Value")}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-1 bg-amber-500" />
                        <span className="text-sm text-slate-600">{t("Expected Value")}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* KPI Configuration Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("KPI Configuration")}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("KPI Objective")}</Label>
                    <Input placeholder={t("Enter Objective")} className="mt-1.5 bg-white" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("KPI Description")}</Label>
                    <Input placeholder={t("Enter Description")} className="mt-1.5 bg-white" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("KPI Data Source")}</Label>
                    <Input placeholder={t("Enter Data Source")} className="mt-1.5 bg-white" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("KPI Measurement Formula")}</Label>
                    <Input placeholder={t("Enter the KPI Calculation Formula")} className="mt-1.5 bg-white" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Expected Value")}</Label>
                    <Input type="number" defaultValue={80} className="mt-1.5 bg-white" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Targeted Achieved Value")}</Label>
                    <Input type="number" defaultValue={100} className="mt-1.5 bg-white" />
                  </div>
                </div>
              </div>

              {/* KPI Records Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("KPI Records")}</h4>
                <div className="border border-slate-200 rounded-lg p-8 bg-slate-50">
                  <div className="flex flex-col items-center justify-center text-center">
                    <p className="text-slate-400">{t("No KPI records yet")}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => setIsKPIModalOpen(false)}>
              {t("Close")}
            </Button>
            <Button>
              {t("Save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
