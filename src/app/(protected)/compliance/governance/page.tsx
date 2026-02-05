"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { usePermissions, useHasRole } from "@/hooks/usePermissions";
import { useLanguage } from "@/contexts/LanguageContext";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Unauthorized } from "@/components/ui/unauthorized";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  FileSpreadsheet,
  Trash2,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Upload,
  Home,
  User,
  FileText,
  CheckSquare,
  ArrowUpFromLine,
  Users,
  Link2,
  Download,
  X,
} from "lucide-react";
import Link from "next/link";

interface Policy {
  id: string;
  code: string;
  name: string;
  version: string;
  documentType: string;
  recurrence?: string;
  status: string;
  effectiveDate?: string;
  reviewDate?: string;
  aiReviewStatus?: string;
  aiReviewScore?: number;
  department?: { id: string; name: string };
  assignee?: { id: string; fullName: string };
  approver?: { id: string; fullName: string };
  _count?: { policyControls: number; attachments: number };
}

interface Department {
  id: string;
  name: string;
}

interface UserRole {
  role: {
    name: string;
  };
}

interface User {
  id: string;
  fullName: string;
  departmentId?: string;
  customerCode?: string;
  userRoles?: UserRole[];
}

interface CurrentUser {
  id: string;
  customerCode?: string;
}

interface Framework {
  id: string;
  name: string;
  code: string;
}

interface Control {
  id: string;
  controlCode: string;
  name: string;
  status: string;
  domain?: { id: string; name: string };
}

interface Domain {
  id: string;
  name: string;
}

interface VaultDocument {
  id: string;
  documentId: string;
  name: string;
  type: string;
  status: string;
  uploadedAt: string;
  linkedGovernanceIds: string[];
}

const DOCUMENT_TYPES = ["Policy", "Standard", "Procedure"];
const RECURRENCE_OPTIONS = ["Weekly", "Monthly", "Quarterly", "Yearly"];

export default function GovernancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromDashboard = searchParams.get("from") === "dashboard";
  const { data: session } = useSession();
  const { canView, canCreate, canEdit, canDelete, isLoading: permissionsLoading } = usePermissions('compliance.governance');
  const isCustomerAdmin = useHasRole("CustomerAdministrator");
  const { t } = useLanguage();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [allPolicies, setAllPolicies] = useState<Policy[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("Dashboard");
  const [activeDocType, setActiveDocType] = useState<string>("Policy");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const itemsPerPage = 20;

  // Status filter for cards
  const [statusFilter, setStatusFilter] = useState<string>("");

  // Filters
  const [frameworkFilter, setFrameworkFilter] = useState<string>("all");

  // Filter options
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);

  // Create dialog
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [newPolicy, setNewPolicy] = useState({
    name: "",
    documentType: "Policy",
    recurrence: "",
    departmentId: "",
    assigneeId: "",
  });

  // Step 2 - Control linking
  const [selectedControlIds, setSelectedControlIds] = useState<string[]>([]);
  const [controlSearch, setControlSearch] = useState("");
  const [controlDomainFilter, setControlDomainFilter] = useState<string>("all");
  const [controlStatusFilter, setControlStatusFilter] = useState<string>("all");

  // Delete dialogs
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);
  const [policyToDelete, setPolicyToDelete] = useState<Policy | null>(null);

  // Import dialog
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Edit dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [editData, setEditData] = useState({
    name: "",
    documentType: "",
    recurrence: "",
    departmentId: "",
    assigneeId: "",
  });

  // Vault documents
  const [vaultDocuments, setVaultDocuments] = useState<VaultDocument[]>([]);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultFile, setVaultFile] = useState<File | null>(null);
  const [isVaultDragging, setIsVaultDragging] = useState(false);

  // Link Governance Dialog
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [selectedVaultDoc, setSelectedVaultDoc] = useState<VaultDocument | null>(null);
  const [linkSearch, setLinkSearch] = useState("");
  const [linkDocTypeFilter, setLinkDocTypeFilter] = useState<string>("all");
  const [selectedGovernanceIds, setSelectedGovernanceIds] = useState<string[]>([]);

  // Status counts for dashboard
  const [statusCounts, setStatusCounts] = useState({
    notUploaded: 0,
    draft: 0,
    approved: 0,
    published: 0,
    needsReview: 0,
    total: 0,
  });

  useEffect(() => {
    fetchFilterOptions();
  }, [session?.user?.id]);

  useEffect(() => {
    if (activeTab === "Dashboard") {
      fetchAllPoliciesForDashboard();
    } else if (activeTab === "Information Security Vault") {
      fetchVaultDocuments();
    } else {
      fetchPolicies();
    }
  }, [activeTab, activeDocType, currentPage, frameworkFilter, statusFilter]);

  const fetchFilterOptions = async () => {
    try {
      const [deptRes, userRes, frameworkRes, controlRes, domainRes] = await Promise.all([
        fetch("/api/departments"),
        fetch("/api/users"),
        fetch("/api/frameworks"),
        fetch("/api/controls"),
        fetch("/api/control-domains"),
      ]);
      if (deptRes.ok) setDepartments(await deptRes.json());
      if (userRes.ok) {
        const userData = await userRes.json();
        setUsers(userData);

        if (session?.user?.id) {
          const currentUserData = userData.find((u: User) => u.id === session.user.id);
          if (currentUserData) {
            setCurrentUser({
              id: currentUserData.id,
              customerCode: currentUserData.customerCode,
            });
          }
        }
      }
      if (frameworkRes.ok) {
        const data = await frameworkRes.json();
        setFrameworks(Array.isArray(data) ? data : data.data || []);
      }
      if (controlRes.ok) {
        const data = await controlRes.json();
        setControls(Array.isArray(data) ? data : data.data || []);
      }
      if (domainRes.ok) {
        const data = await domainRes.json();
        setDomains(Array.isArray(data) ? data : data.data || []);
      }
    } catch (error) {
      console.error("Error fetching filter options:", error);
    }
  };

  const fetchAllPoliciesForDashboard = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/policies?limit=1000`);
      if (response.ok) {
        const data = await response.json();
        const all = data.data || [];
        setAllPolicies(all);

        // Calculate status counts
        const counts = {
          notUploaded: all.filter((p: Policy) => p.status === "Not Uploaded").length,
          draft: all.filter((p: Policy) => p.status === "Draft").length,
          approved: all.filter((p: Policy) => p.status === "Approved").length,
          published: all.filter((p: Policy) => p.status === "Published").length,
          needsReview: all.filter((p: Policy) => p.status === "Needs Review").length,
          total: all.length,
        };
        setStatusCounts(counts);
      }
    } catch (error) {
      console.error("Error fetching policies for dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPolicies = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", currentPage.toString());
      params.set("limit", itemsPerPage.toString());
      params.set("documentType", activeDocType);
      if (frameworkFilter && frameworkFilter !== "all") params.set("frameworkId", frameworkFilter);
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);

      const response = await fetch(`/api/policies?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setPolicies(data.data || []);
        setTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);

        // Also update counts for current doc type
        const allForType = await fetch(`/api/policies?documentType=${activeDocType}&limit=1000`);
        if (allForType.ok) {
          const allData = await allForType.json();
          const all = allData.data || [];
          setStatusCounts({
            notUploaded: all.filter((p: Policy) => p.status === "Not Uploaded").length,
            draft: all.filter((p: Policy) => p.status === "Draft").length,
            approved: all.filter((p: Policy) => p.status === "Approved").length,
            published: all.filter((p: Policy) => p.status === "Published").length,
            needsReview: all.filter((p: Policy) => p.status === "Needs Review").length,
            total: all.length,
          });
        }
      }
    } catch (error) {
      console.error("Error fetching policies:", error);
    } finally {
      setLoading(false);
    }
  }, [activeDocType, currentPage, frameworkFilter, search, statusFilter]);

  const fetchVaultDocuments = async () => {
    try {
      setVaultLoading(true);
      const response = await fetch("/api/governance-vault");
      if (response.ok) {
        const data = await response.json();
        setVaultDocuments(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching vault documents:", error);
    } finally {
      setVaultLoading(false);
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchPolicies();
  };

  const handleStatusCardClick = (status: string) => {
    if (statusFilter === status) {
      setStatusFilter("");
    } else {
      setStatusFilter(status);
    }
    setCurrentPage(1);
    // If on Dashboard tab, switch to Policy tab to show filtered results
    if (activeTab === "Dashboard") {
      setActiveTab("Policy");
      setActiveDocType("Policy");
    }
  };

  const handleCreatePolicy = async () => {
    try {
      const response = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newPolicy,
          controlIds: selectedControlIds,
        }),
      });
      if (response.ok) {
        setIsCreateDialogOpen(false);
        resetCreateDialog();
        fetchPolicies();
      }
    } catch (error) {
      console.error("Error creating policy:", error);
    }
  };

  const resetCreateDialog = () => {
    setCreateStep(1);
    setNewPolicy({
      name: "",
      documentType: activeDocType,
      recurrence: "",
      departmentId: "",
      assigneeId: "",
    });
    setSelectedControlIds([]);
    setControlSearch("");
    setControlDomainFilter("all");
    setControlStatusFilter("all");
  };

  const handleDeletePolicy = async () => {
    if (!policyToDelete) return;
    try {
      const response = await fetch(`/api/policies/${policyToDelete.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        fetchPolicies();
      }
    } catch (error) {
      console.error("Error deleting policy:", error);
    } finally {
      setIsDeleteDialogOpen(false);
      setPolicyToDelete(null);
    }
  };

  const handleDeleteAll = async () => {
    try {
      const response = await fetch(`/api/policies/delete-all?documentType=${activeDocType}`, {
        method: "DELETE",
      });
      if (response.ok) {
        fetchPolicies();
      }
    } catch (error) {
      console.error("Error deleting all policies:", error);
    } finally {
      setIsDeleteAllDialogOpen(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("documentType", activeDocType);

      const response = await fetch("/api/policies/import", {
        method: "POST",
        body: formData,
      });
      if (response.ok) {
        fetchPolicies();
        setIsImportDialogOpen(false);
        setImportFile(null);
      }
    } catch (error) {
      console.error("Error importing:", error);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setImportFile(files[0]);
    }
  };

  // Vault file handling
  const handleVaultDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsVaultDragging(true);
  };

  const handleVaultDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsVaultDragging(false);
  };

  const handleVaultDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsVaultDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await uploadVaultFile(files[0]);
    }
  };

  const uploadVaultFile = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/governance-vault", {
        method: "POST",
        body: formData,
      });
      if (response.ok) {
        fetchVaultDocuments();
      }
    } catch (error) {
      console.error("Error uploading vault file:", error);
    }
  };

  const handleDeleteVaultDoc = async (docId: string) => {
    try {
      const response = await fetch(`/api/governance-vault/${docId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        fetchVaultDocuments();
      }
    } catch (error) {
      console.error("Error deleting vault document:", error);
    }
  };

  const openLinkDialog = async (doc: VaultDocument) => {
    setSelectedVaultDoc(doc);
    setSelectedGovernanceIds(doc.linkedGovernanceIds || []);
    setLinkSearch("");
    setLinkDocTypeFilter("all");

    // Fetch all policies if not already loaded
    if (allPolicies.length === 0) {
      try {
        const response = await fetch(`/api/policies?limit=1000`);
        if (response.ok) {
          const data = await response.json();
          setAllPolicies(data.data || []);
        }
      } catch (error) {
        console.error("Error fetching policies for link dialog:", error);
      }
    }

    setIsLinkDialogOpen(true);
  };

  const handleLinkGovernance = async () => {
    if (!selectedVaultDoc) return;
    try {
      const response = await fetch(`/api/governance-vault/${selectedVaultDoc.id}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ governanceIds: selectedGovernanceIds }),
      });
      if (response.ok) {
        fetchVaultDocuments();
        setIsLinkDialogOpen(false);
        setSelectedVaultDoc(null);
      }
    } catch (error) {
      console.error("Error linking governance:", error);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "Published": return "bg-green-100 text-green-800";
      case "Approved": return "bg-blue-100 text-blue-800";
      case "Draft": return "bg-yellow-100 text-yellow-800";
      case "Needs Review": return "bg-orange-100 text-orange-800";
      case "Not Uploaded": return "bg-gray-100 text-gray-800";
      case "Pending Approval": return "bg-purple-100 text-purple-800";
      case "Active": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  // Filter controls for Step 2
  const filteredControls = controls.filter((control) => {
    const matchesSearch = !controlSearch ||
      control.name.toLowerCase().includes(controlSearch.toLowerCase()) ||
      control.controlCode.toLowerCase().includes(controlSearch.toLowerCase());
    const matchesDomain = controlDomainFilter === "all" || control.domain?.id === controlDomainFilter;
    const matchesStatus = controlStatusFilter === "all" || control.status === controlStatusFilter;
    return matchesSearch && matchesDomain && matchesStatus;
  });

  // Filter governance for link dialog
  const filteredGovernanceForLink = allPolicies.filter((p) => {
    const matchesSearch = !linkSearch ||
      p.name.toLowerCase().includes(linkSearch.toLowerCase()) ||
      p.code.toLowerCase().includes(linkSearch.toLowerCase());
    const matchesType = linkDocTypeFilter === "all" || p.documentType === linkDocTypeFilter;
    return matchesSearch && matchesType;
  });

  const getCustomerScopedUsers = () => users;
  const getCustomerScopedDepartments = () => departments;

  const filteredUsers = (() => {
    if (!newPolicy.departmentId) return [];
    return users.filter((u) => {
      if (u.departmentId !== newPolicy.departmentId) return false;
      return u.userRoles?.some((ur) =>
        ["DepartmentReviewer", "DepartmentContributor"].includes(ur.role?.name)
      );
    });
  })();

  const filteredEditUsers = (() => {
    if (!editData.departmentId) return [];
    return users.filter((u) => {
      if (u.departmentId !== editData.departmentId) return false;
      return u.userRoles?.some((ur) =>
        ["DepartmentReviewer", "DepartmentContributor"].includes(ur.role?.name)
      );
    });
  })();

  const openEditDialog = (policy: Policy) => {
    setEditingPolicy(policy);
    setEditData({
      name: policy.name,
      documentType: policy.documentType,
      recurrence: policy.recurrence || "",
      departmentId: policy.department?.id || "",
      assigneeId: policy.assignee?.id || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdatePolicy = async () => {
    if (!editingPolicy) return;
    try {
      const response = await fetch(`/api/policies/${editingPolicy.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });
      if (response.ok) {
        setIsEditDialogOpen(false);
        setEditingPolicy(null);
        fetchPolicies();
      }
    } catch (error) {
      console.error("Error updating policy:", error);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === "Policy" || tab === "Standard" || tab === "Procedure") {
      setActiveDocType(tab);
    }
    setCurrentPage(1);
    setSearch("");
    setFrameworkFilter("all");
    setStatusFilter("");
  };

  const canProceedStep1 = newPolicy.name && newPolicy.departmentId && newPolicy.documentType && newPolicy.recurrence && newPolicy.assigneeId;

  const startItem = total > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endItem = Math.min(currentPage * itemsPerPage, total);

  // Status card component - Simple white cards with blue icons (matching Evidence page)
  const StatusCard = ({ icon: Icon, count, label, status, secondaryCount, onClick, isSelected }: {
    icon: React.ElementType;
    count: number;
    label: string;
    status: string;
    secondaryCount?: number;
    onClick?: () => void;
    isSelected?: boolean;
  }) => {
    return (
      <div
        className={`bg-white rounded-xl p-4 shadow-sm cursor-pointer transition-all ${
          isSelected
            ? "border-2 border-primary-500"
            : "border border-slate-200 hover:border-slate-300"
        }`}
        onClick={onClick}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="text-3xl font-bold text-slate-800 mb-1">
          {secondaryCount !== undefined ? `${count}/${secondaryCount}` : count}
        </div>
        <div className="text-sm font-medium text-slate-500">{label}</div>
      </div>
    );
  };

  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
          <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!canView) {
    return <Unauthorized description={t("You don't have permission to access Governance.")} />;
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Home")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-slate-500">{t("Compliance")}</span>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Governance")}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800">{t("Governance")}</h1>
      </div>

      {/* Tabs - Only show for Customer Administrator */}
      {isCustomerAdmin ? (
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="Dashboard">{t("Dashboard")}</TabsTrigger>
            <TabsTrigger value="Policy">{t("Policy")}</TabsTrigger>
            <TabsTrigger value="Standard">{t("Standards")}</TabsTrigger>
            <TabsTrigger value="Procedure">{t("Procedures")}</TabsTrigger>
            <TabsTrigger value="Information Security Vault">{t("Information Security Vault")}</TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="Dashboard" className="mt-6 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="relative h-8 w-8">
                  <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-4">
                <StatusCard icon={User} count={statusCounts.notUploaded} label={t("Not Uploaded")} status="Not Uploaded" onClick={() => handleStatusCardClick("Not Uploaded")} isSelected={statusFilter === "Not Uploaded"} />
                <StatusCard icon={FileText} count={statusCounts.draft} label={t("Draft")} status="Draft" onClick={() => handleStatusCardClick("Draft")} isSelected={statusFilter === "Draft"} />
                <StatusCard icon={CheckSquare} count={statusCounts.approved} label={t("Approved")} status="Approved" onClick={() => handleStatusCardClick("Approved")} isSelected={statusFilter === "Approved"} />
                <StatusCard icon={ArrowUpFromLine} count={statusCounts.published} label={t("Published")} status="Published" onClick={() => handleStatusCardClick("Published")} isSelected={statusFilter === "Published"} />
                <StatusCard icon={Users} count={statusCounts.needsReview} label={t("Needs Review")} status="Needs Review" onClick={() => handleStatusCardClick("Needs Review")} isSelected={statusFilter === "Needs Review"} />
              </div>
            )}
          </TabsContent>

          {/* Policy, Standard, Procedure Tabs */}
          {["Policy", "Standard", "Procedure"].map((docType) => (
            <TabsContent key={docType} value={docType} className="mt-6 space-y-6">
              {/* Status Cards */}
              <div className="grid grid-cols-5 gap-4">
                <StatusCard icon={User} count={statusCounts.notUploaded} label={t("Not Uploaded")} status="Not Uploaded" onClick={() => handleStatusCardClick("Not Uploaded")} isSelected={statusFilter === "Not Uploaded"} />
                <StatusCard icon={FileText} count={statusCounts.draft} label={t("Draft")} status="Draft" onClick={() => handleStatusCardClick("Draft")} isSelected={statusFilter === "Draft"} />
                <StatusCard icon={CheckSquare} count={statusCounts.approved} label={t("Approved")} status="Approved" onClick={() => handleStatusCardClick("Approved")} isSelected={statusFilter === "Approved"} />
                <StatusCard
                  icon={ArrowUpFromLine}
                  count={statusCounts.published}
                  secondaryCount={statusCounts.total}
                  label={t("Published")}
                  status="Published"
                  onClick={() => handleStatusCardClick("Published")}
                  isSelected={statusFilter === "Published"}
                />
                <StatusCard icon={Users} count={statusCounts.needsReview} label={t("Needs Review")} status="Needs Review" onClick={() => handleStatusCardClick("Needs Review")} isSelected={statusFilter === "Needs Review"} />
              </div>

              {/* Search, Filter, and Action Buttons Row */}
              <div className="flex items-center gap-3">
                <Input
                  placeholder={t("Search by code, name, department, assignee, approver...")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="max-w-md bg-white"
                />
                <Select value={frameworkFilter} onValueChange={setFrameworkFilter}>
                  <SelectTrigger className="w-[200px] bg-white">
                    <SelectValue placeholder={t("Integrated Framework")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                    <SelectItem value="all">{t("Integrated Framework")}</SelectItem>
                    {frameworks.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-[160px] bg-white">
                    <SelectValue placeholder={t("Status")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="bg-white">
                    <SelectItem value="all">{t("All Statuses")}</SelectItem>
                    <SelectItem value="Not Uploaded">{t("Not Uploaded")}</SelectItem>
                    <SelectItem value="Draft">{t("Draft")}</SelectItem>
                    <SelectItem value="Approved">{t("Approved")}</SelectItem>
                    <SelectItem value="Published">{t("Published")}</SelectItem>
                    <SelectItem value="Needs Review">{t("Needs Review")}</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex-1" />
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t("Export")}
                </Button>
                <Button size="sm" onClick={() => {
                  setNewPolicy({ ...newPolicy, documentType: activeDocType });
                  setIsCreateDialogOpen(true);
                }}>
                  <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t("New Governance")}
                </Button>
              </div>

              {/* Table */}
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="relative h-8 w-8">
                    <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-slate-100 bg-slate-50/80">
                        <TableHead className="text-xs font-semibold text-slate-600 h-12 pl-4">{t("Code")}</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 h-12">{t("Name")}</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 h-12">{t("Status")}</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 h-12">{t("Assignee")}</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 h-12">{t("Approver")}</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 h-12">{t("Department")}</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 h-12 pr-4 w-[100px]">{t("Actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {policies.map((policy) => (
                        <TableRow
                          key={policy.id}
                          className="border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 transition-colors"
                          onDoubleClick={() => router.push(`/compliance/governance/${policy.id}`)}
                        >
                          <TableCell className="py-3.5 pl-4 text-sm font-medium text-slate-900">{policy.code}</TableCell>
                          <TableCell className="py-3.5 text-sm text-slate-700 max-w-[250px] truncate" title={policy.name}>{policy.name}</TableCell>
                          <TableCell className="py-3.5">
                            <Badge className={getStatusBadgeColor(policy.status)}>{t(policy.status)}</Badge>
                          </TableCell>
                          <TableCell className="py-3.5 text-sm text-slate-600">{policy.assignee?.fullName || "-"}</TableCell>
                          <TableCell className="py-3.5 text-sm text-slate-600">{policy.approver?.fullName || "-"}</TableCell>
                          <TableCell className="py-3.5 text-sm text-slate-600">{policy.department?.name || "-"}</TableCell>
                          <TableCell className="py-3.5 pr-4">
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditDialog(policy);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-semantic-error hover:bg-red-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPolicyToDelete(policy);
                                  setIsDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {policies.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="h-32 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <FileText className="h-8 w-8 text-slate-300" />
                              <p className="text-slate-500">{t(`No ${docType.toLowerCase()}s found`)}</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/30">
                    <span className="text-sm text-slate-500">
                      {total > 0 ? `${t("Showing")} ${startItem}-${endItem} ${t("of")} ${total}` : t(`No ${docType.toLowerCase()}s`)}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" disabled={currentPage === 1} onClick={() => setCurrentPage(1)} className="h-8 w-8 disabled:opacity-40">
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)} className="h-8 w-8 disabled:opacity-40">
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-slate-600 px-2">
                        {currentPage} / {totalPages || 1}
                      </span>
                      <Button variant="ghost" size="icon" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)} className="h-8 w-8 disabled:opacity-40">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)} className="h-8 w-8 disabled:opacity-40">
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          ))}

          {/* Information Security Vault Tab */}
          <TabsContent value="Information Security Vault" className="mt-6 space-y-6">
            {/* File Upload Area */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div
                className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                  isVaultDragging
                    ? "border-primary-400 bg-primary-50"
                    : "border-slate-200 hover:border-primary-300 hover:bg-slate-50"
                }`}
                onDragOver={handleVaultDragOver}
                onDragLeave={handleVaultDragLeave}
                onDrop={handleVaultDrop}
                onClick={() => document.getElementById("vault-file")?.click()}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-primary-50 flex items-center justify-center">
                    <Upload className="h-6 w-6 text-primary-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{t("Drag and drop files here")}</p>
                    <p className="text-xs text-slate-500 mt-1">{t("or click to browse from your computer")}</p>
                  </div>
                </div>
                <input
                  type="file"
                  className="hidden"
                  id="vault-file"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files && files.length > 0) {
                      uploadVaultFile(files[0]);
                    }
                  }}
                />
              </div>
            </div>

            {/* Vault Documents Table */}
            {vaultLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="relative h-8 w-8">
                  <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-slate-100 bg-slate-50/80">
                      <TableHead className="text-xs font-semibold text-slate-600 h-12 pl-4">{t("Document ID")}</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600 h-12">{t("Document Name")}</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600 h-12">{t("Type")}</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600 h-12">{t("Status")}</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600 h-12">{t("Uploaded")}</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600 h-12 pr-4 w-[120px]">{t("Actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vaultDocuments.map((doc) => (
                      <TableRow key={doc.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                        <TableCell className="py-3.5 pl-4 text-sm font-medium text-slate-900">{doc.documentId}</TableCell>
                        <TableCell className="py-3.5 text-sm text-slate-700 max-w-[250px] truncate" title={doc.name}>{doc.name}</TableCell>
                        <TableCell className="py-3.5">
                          <Badge variant="outline" className="text-xs">{doc.type}</Badge>
                        </TableCell>
                        <TableCell className="py-3.5">
                          <Badge className={getStatusBadgeColor(doc.status)}>{t(doc.status)}</Badge>
                        </TableCell>
                        <TableCell className="py-3.5 text-sm text-slate-600">
                          {new Date(doc.uploadedAt).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="py-3.5 pr-4">
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                              onClick={() => openLinkDialog(doc)}
                              title={t("Link Governance")}
                            >
                              <Link2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                              onClick={() => window.open(`/api/governance-vault/${doc.id}/download`, "_blank")}
                              title={t("Download")}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-semantic-error hover:bg-red-50"
                              onClick={() => handleDeleteVaultDoc(doc.id)}
                              title={t("Delete")}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {vaultDocuments.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <FileText className="h-8 w-8 text-slate-300" />
                            <p className="text-slate-500">{t("No documents found")}</p>
                            <p className="text-xs text-slate-400">{t("Upload documents to get started")}</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        // Non-Customer Admin view - original tabs
        <Tabs value={activeDocType} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="Policy">{t("Policy")}</TabsTrigger>
            <TabsTrigger value="Standard">{t("Standards")}</TabsTrigger>
            <TabsTrigger value="Procedure">{t("Procedures")}</TabsTrigger>
          </TabsList>

          {["Policy", "Standard", "Procedure"].map((docType) => (
            <TabsContent key={docType} value={docType} className="mt-6 space-y-4">
              {/* Search and Actions Bar */}
              <div className="flex items-center gap-3">
                <Input
                  placeholder={t(`Search by ${docType.toLowerCase()} name or code...`)}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="max-w-md bg-white"
                />
                <Select value={frameworkFilter} onValueChange={setFrameworkFilter}>
                  <SelectTrigger className="w-[200px] bg-white">
                    <SelectValue placeholder={t("Integrated Framework")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                    <SelectItem value="all">{t("Integrated Framework")}</SelectItem>
                    {frameworks.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex-1" />
                <PermissionGate resource="compliance.governance" action="delete">
                  <Button variant="outline" size="sm" className="text-semantic-error hover:text-semantic-error hover:bg-red-50" onClick={() => setIsDeleteAllDialogOpen(true)}>
                    <Trash2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    {t("Delete All")}
                  </Button>
                </PermissionGate>
                <PermissionGate resource="compliance.governance" action="create">
                  <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)}>
                    <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    {t("Import")}
                  </Button>
                </PermissionGate>
                <PermissionGate resource="compliance.governance" action="create">
                  <Button size="sm" onClick={() => {
                    setNewPolicy({ ...newPolicy, documentType: activeDocType });
                    setIsCreateDialogOpen(true);
                  }}>
                    <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    {t("New Governance")}
                  </Button>
                </PermissionGate>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="relative h-8 w-8">
                    <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-slate-100 bg-slate-50/80">
                        <TableHead className="text-xs font-semibold text-slate-600 h-12 pl-4">{t("Code")}</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 h-12">{t("Name")}</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 h-12">{t("Status")}</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 h-12">{t("Assignee")}</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 h-12">{t("Approver")}</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 h-12">{t("Department")}</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 h-12 pr-4 w-[100px]">{t("Actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {policies.map((policy) => (
                        <TableRow
                          key={policy.id}
                          className="border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 transition-colors"
                          onDoubleClick={() => router.push(`/compliance/governance/${policy.id}`)}
                        >
                          <TableCell className="py-3.5 pl-4 text-sm font-medium text-slate-900">{policy.code}</TableCell>
                          <TableCell className="py-3.5 text-sm text-slate-700 max-w-[250px] truncate" title={policy.name}>{policy.name}</TableCell>
                          <TableCell className="py-3.5">
                            <Badge className={getStatusBadgeColor(policy.status)}>{t(policy.status)}</Badge>
                          </TableCell>
                          <TableCell className="py-3.5 text-sm text-slate-600">{policy.assignee?.fullName || "-"}</TableCell>
                          <TableCell className="py-3.5 text-sm text-slate-600">{policy.approver?.fullName || "-"}</TableCell>
                          <TableCell className="py-3.5 text-sm text-slate-600">{policy.department?.name || "-"}</TableCell>
                          <TableCell className="py-3.5 pr-4">
                            <div className="flex gap-1">
                              <PermissionGate resource="compliance.governance" action="edit">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditDialog(policy);
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </PermissionGate>
                              <PermissionGate resource="compliance.governance" action="delete">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-400 hover:text-semantic-error hover:bg-red-50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPolicyToDelete(policy);
                                    setIsDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </PermissionGate>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {policies.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="h-32 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <FileText className="h-8 w-8 text-slate-300" />
                              <p className="text-slate-500">{t(`No ${docType.toLowerCase()}s found`)}</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>

                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/30">
                    <span className="text-sm text-slate-500">
                      {total > 0 ? `${t("Showing")} ${startItem}-${endItem} ${t("of")} ${total}` : t(`No ${docType.toLowerCase()}s`)}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" disabled={currentPage === 1} onClick={() => setCurrentPage(1)} className="h-8 w-8 disabled:opacity-40">
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)} className="h-8 w-8 disabled:opacity-40">
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-slate-600 px-2">
                        {currentPage} / {totalPages || 1}
                      </span>
                      <Button variant="ghost" size="icon" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)} className="h-8 w-8 disabled:opacity-40">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)} className="h-8 w-8 disabled:opacity-40">
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Link Governance Dialog */}
      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent className="sm:max-w-[600px] p-0 gap-0 max-h-[90vh] flex flex-col" showCloseButton={false}>
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
            <DialogTitle className="text-lg font-semibold text-slate-800">{t("Link Governance Documents")}</DialogTitle>
            <Button variant="ghost" size="icon" onClick={() => setIsLinkDialogOpen(false)} className="h-8 w-8 text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="overflow-y-auto flex-1 px-6 py-5">
            {/* Search and Filter */}
            <div className="flex gap-3 mb-4">
              <Input
                placeholder={t("Search by code or name...")}
                value={linkSearch}
                onChange={(e) => setLinkSearch(e.target.value)}
                className="flex-1 bg-slate-50 border-slate-200"
              />
              <Select value={linkDocTypeFilter} onValueChange={setLinkDocTypeFilter}>
                <SelectTrigger className="w-[160px] bg-slate-50 border-slate-200">
                  <SelectValue placeholder={t("All Types")} />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4} className="bg-white">
                  <SelectItem value="all">{t("All Types")}</SelectItem>
                  <SelectItem value="Policy">{t("Policy")}</SelectItem>
                  <SelectItem value="Standard">{t("Standard")}</SelectItem>
                  <SelectItem value="Procedure">{t("Procedure")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Selected count */}
            {selectedGovernanceIds.length > 0 && (
              <div className="mb-3 text-sm text-slate-500">
                {selectedGovernanceIds.length} {t("selected")}
              </div>
            )}

            {/* Governance List */}
            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
              {filteredGovernanceForLink.map((gov) => (
                <div
                  key={gov.id}
                  className={`flex items-center gap-3 p-3.5 rounded-lg border cursor-pointer transition-all ${
                    selectedGovernanceIds.includes(gov.id)
                      ? "border-primary-400 bg-primary-50 shadow-sm"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                  onClick={() => {
                    if (selectedGovernanceIds.includes(gov.id)) {
                      setSelectedGovernanceIds(selectedGovernanceIds.filter((id) => id !== gov.id));
                    } else {
                      setSelectedGovernanceIds([...selectedGovernanceIds, gov.id]);
                    }
                  }}
                >
                  <Checkbox
                    checked={selectedGovernanceIds.includes(gov.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedGovernanceIds([...selectedGovernanceIds, gov.id]);
                      } else {
                        setSelectedGovernanceIds(selectedGovernanceIds.filter((id) => id !== gov.id));
                      }
                    }}
                    className="border-slate-300 data-[state=checked]:border-primary-500"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-slate-800">{gov.code}</span>
                    <span className="text-slate-400 mx-2">·</span>
                    <span className="text-sm text-slate-600 truncate">{gov.name}</span>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">{gov.documentType}</Badge>
                </div>
              ))}
              {filteredGovernanceForLink.length === 0 && (
                <div className="text-center py-10">
                  <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">{t("No governance documents found")}</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/30 flex-shrink-0">
            <Button variant="outline" onClick={() => setIsLinkDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleLinkGovernance} disabled={selectedGovernanceIds.length === 0}>
              {t("Link Selected")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Dialog - 3 Steps */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        if (!open) resetCreateDialog();
        setIsCreateDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0 max-h-[90vh] flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("New Governance")} - {t("Step")} {createStep} {t("of")} 3</DialogTitle>
            </DialogHeader>
          </div>

          <div className="overflow-y-auto flex-1 px-6 py-5">
            <div className="flex items-center justify-center gap-2 pb-5">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step === createStep
                      ? "bg-primary text-primary-foreground"
                      : step < createStep
                      ? "bg-green-500 text-white"
                      : "bg-slate-100 text-slate-400"
                  }`}>
                    {step}
                  </div>
                  {step < 3 && (
                    <div className={`w-16 h-1 mx-2 ${step < createStep ? "bg-green-500" : "bg-slate-100"}`} />
                  )}
                </div>
              ))}
            </div>

            {createStep === 1 && (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Governance Name")} *</Label>
                  <Input
                    value={newPolicy.name}
                    onChange={(e) => setNewPolicy({ ...newPolicy, name: e.target.value })}
                    placeholder={t("Enter governance name")}
                    className="mt-1.5 w-full"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Department")} *</Label>
                  <Select value={newPolicy.departmentId} onValueChange={(v) => setNewPolicy({ ...newPolicy, departmentId: v, assigneeId: "" })}>
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder={t("Select department")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                      {getCustomerScopedDepartments().map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Document Type")} *</Label>
                  <Select value={newPolicy.documentType} onValueChange={(v) => setNewPolicy({ ...newPolicy, documentType: v })}>
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder={t("Select document type")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                      {DOCUMENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>{t(type)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Recurrence")} *</Label>
                  <Select value={newPolicy.recurrence} onValueChange={(v) => setNewPolicy({ ...newPolicy, recurrence: v })}>
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder={t("Select recurrence")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                      {RECURRENCE_OPTIONS.map((r) => (
                        <SelectItem key={r} value={r}>{t(r)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Assignee")} *</Label>
                  <Select
                    value={newPolicy.assigneeId}
                    onValueChange={(v) => setNewPolicy({ ...newPolicy, assigneeId: v })}
                    disabled={!newPolicy.departmentId}
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder={
                        !newPolicy.departmentId
                          ? t("Select department first")
                          : t("Select assignee")
                      } />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                      {filteredUsers.length > 0 ? (
                        filteredUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                        ))
                      ) : (
                        <div className="py-2 px-2 text-sm text-slate-500 text-center">
                          {t("No department reviewers found")}
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {createStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold text-slate-800">{t("Select Controls to Link")}</Label>
                  <Badge variant="secondary">{selectedControlIds.length} {t("selected")}</Badge>
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <Input
                      placeholder={t("Search controls...")}
                      value={controlSearch}
                      onChange={(e) => setControlSearch(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                  <Select value={controlDomainFilter} onValueChange={setControlDomainFilter}>
                    <SelectTrigger className="w-[180px] bg-white">
                      <SelectValue placeholder={t("Domain")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                      <SelectItem value="all">{t("All Domains")}</SelectItem>
                      {domains.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={controlStatusFilter} onValueChange={setControlStatusFilter}>
                    <SelectTrigger className="w-[180px] bg-white">
                      <SelectValue placeholder={t("Status")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                      <SelectItem value="all">{t("All Statuses")}</SelectItem>
                      <SelectItem value="Compliant">{t("Compliant")}</SelectItem>
                      <SelectItem value="Non Compliant">{t("Non Compliant")}</SelectItem>
                      <SelectItem value="Not Applicable">{t("Not Applicable")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-slate-100 bg-slate-50/50">
                        <TableHead className="w-[50px] py-4 pl-4"></TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 py-4">{t("Control Code")}</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 py-4">{t("Control Name")}</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 py-4">{t("Domain")}</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 py-4">{t("Status")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredControls.map((control) => (
                        <TableRow key={control.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                          <TableCell className="py-3 pl-4">
                            <Checkbox
                              checked={selectedControlIds.includes(control.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedControlIds([...selectedControlIds, control.id]);
                                } else {
                                  setSelectedControlIds(selectedControlIds.filter((id) => id !== control.id));
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell className="py-3 text-sm font-medium text-slate-900">{control.controlCode}</TableCell>
                          <TableCell className="py-3 text-sm text-slate-700">{control.name}</TableCell>
                          <TableCell className="py-3 text-sm text-slate-700">{control.domain?.name || "-"}</TableCell>
                          <TableCell className="py-3">
                            <Badge className={getStatusBadgeColor(control.status)}>
                              {t(control.status)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredControls.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                            {t("No controls found")}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {createStep === 3 && (
              <div className="space-y-6">
                <div className="text-lg font-medium text-slate-800">{t("Review Information")}</div>

                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <Label className="text-slate-500 text-sm">{t("Governance Name")}</Label>
                    <p className="font-medium text-slate-900">{newPolicy.name}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">{t("Document Type")}</Label>
                    <p className="font-medium text-slate-900">{t(newPolicy.documentType)}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">{t("Recurrence")}</Label>
                    <p className="font-medium text-slate-900">{t(newPolicy.recurrence)}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">{t("Department")}</Label>
                    <p className="font-medium text-slate-900">
                      {getCustomerScopedDepartments().find((d) => d.id === newPolicy.departmentId)?.name || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">{t("Assignee")}</Label>
                    <p className="font-medium text-slate-900">
                      {getCustomerScopedUsers().find((u) => u.id === newPolicy.assigneeId)?.fullName || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">{t("Linked Controls")}</Label>
                    <p className="font-medium text-slate-900">{selectedControlIds.length} {t("controls")}</p>
                  </div>
                </div>

                {selectedControlIds.length > 0 && (
                  <div>
                    <Label className="text-slate-500 text-sm mb-2 block">{t("Selected Controls")}:</Label>
                    <div className="flex flex-wrap gap-2">
                      {selectedControlIds.map((id) => {
                        const control = controls.find((c) => c.id === id);
                        return control ? (
                          <Badge key={id} variant="outline">
                            {control.controlCode}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg flex-shrink-0">
            <Button variant="outline" onClick={() => {
              if (createStep > 1) setCreateStep(createStep - 1);
              else {
                resetCreateDialog();
                setIsCreateDialogOpen(false);
              }
            }}>
              {createStep === 1 ? t("Cancel") : t("Previous")}
            </Button>
            <Button
              onClick={() => {
                if (createStep < 3) setCreateStep(createStep + 1);
                else handleCreatePolicy();
              }}
              disabled={createStep === 1 && !canProceedStep1}
            >
              {createStep === 3 ? `${t("Create")} ${t(newPolicy.documentType)}` : t("Next")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Single Policy Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete")} {t(policyToDelete?.documentType || "Policy")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to delete")} &quot;{policyToDelete?.name}&quot;? {t("This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPolicyToDelete(null)}>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePolicy} className="bg-red-600 hover:bg-red-700">
              {t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Dialog */}
      <AlertDialog open={isDeleteAllDialogOpen} onOpenChange={setIsDeleteAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete All")} {t(activeDocType)}s</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to delete all")} {t(activeDocType).toLowerCase()}s? {t("This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll} className="bg-red-600 hover:bg-red-700">
              {t("Delete All")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                <FileSpreadsheet className="h-5 w-5 text-green-600" />
                {t("Import")} {t(activeDocType)}s
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="px-6 py-6">
            <p className="text-sm text-slate-500 mb-4">
              {t("Upload a CSV or Excel file to import")} {t(activeDocType).toLowerCase()}s.
            </p>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragging ? "border-primary bg-primary-50" : "border-slate-200 hover:border-slate-300"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById("import-file")?.click()}
            >
              {importFile ? (
                <div className="space-y-3">
                  <FileSpreadsheet className="h-10 w-10 mx-auto text-green-600" />
                  <p className="font-medium text-slate-800">{importFile.name}</p>
                  <Button variant="outline" size="sm" onClick={(e) => {
                    e.stopPropagation();
                    setImportFile(null);
                  }}>
                    {t("Remove")}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <FileSpreadsheet className="h-10 w-10 mx-auto text-slate-300" />
                  <div>
                    <p className="text-sm text-slate-600">
                      {t("Drag and drop a file here, or click to browse")}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {t("Supported formats")}: CSV, XLSX, XLS
                    </p>
                  </div>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    id="import-file"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        setImportFile(files[0]);
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => {
              setIsImportDialogOpen(false);
              setImportFile(null);
            }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleImport} disabled={!importFile}>
              {t("Import")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setEditingPolicy(null);
        }
        setIsEditDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0 max-h-[90vh] flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Edit")} {t(editingPolicy?.documentType || "Governance")}</DialogTitle>
            </DialogHeader>
          </div>

          <div className="overflow-y-auto flex-1 px-6 py-5">
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Governance Name")} *</Label>
                <Input
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  placeholder={t("Enter governance name")}
                  className="mt-1.5 w-full"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Department")} *</Label>
                <Select value={editData.departmentId} onValueChange={(v) => setEditData({ ...editData, departmentId: v, assigneeId: "" })}>
                  <SelectTrigger className="mt-1.5 w-full bg-white">
                    <SelectValue placeholder={t("Select department")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                    {getCustomerScopedDepartments().map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Document Type")} *</Label>
                <Select value={editData.documentType} onValueChange={(v) => setEditData({ ...editData, documentType: v })}>
                  <SelectTrigger className="mt-1.5 w-full bg-white">
                    <SelectValue placeholder={t("Select document type")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{t(type)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Recurrence")} *</Label>
                <Select value={editData.recurrence} onValueChange={(v) => setEditData({ ...editData, recurrence: v })}>
                  <SelectTrigger className="mt-1.5 w-full bg-white">
                    <SelectValue placeholder={t("Select recurrence")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                    {RECURRENCE_OPTIONS.map((r) => (
                      <SelectItem key={r} value={r}>{t(r)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Assignee")} *</Label>
                <Select
                  value={editData.assigneeId}
                  onValueChange={(v) => setEditData({ ...editData, assigneeId: v })}
                  disabled={!editData.departmentId}
                >
                  <SelectTrigger className="mt-1.5 w-full bg-white">
                    <SelectValue placeholder={
                      !editData.departmentId
                        ? t("Select department first")
                        : t("Select assignee")
                    } />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                    {filteredEditUsers.length > 0 ? (
                      filteredEditUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                      ))
                    ) : (
                      <div className="py-2 px-2 text-sm text-slate-500 text-center">
                        {t("No department reviewers found")}
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg flex-shrink-0">
            <Button variant="outline" onClick={() => {
              setIsEditDialogOpen(false);
              setEditingPolicy(null);
            }}>
              {t("Cancel")}
            </Button>
            <Button
              onClick={handleUpdatePolicy}
              disabled={!editData.name || !editData.departmentId || !editData.documentType || !editData.recurrence}
            >
              {t("Save Changes")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
