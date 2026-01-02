"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Search,
  FileText,
  ClipboardList,
  BookOpen,
  Shield,
  ChevronLeft,
  ChevronRight,
  Download,
  LayoutDashboard,
  Lock,
} from "lucide-react";

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

interface User {
  id: string;
  fullName: string;
  departmentId?: string;
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

const STATUS_OPTIONS = ["Not Uploaded", "Draft", "Approved", "Needs Review", "Published", "Pending Approval"];
const DOCUMENT_TYPES = ["Policy", "Standard", "Procedure"];
const RECURRENCE_OPTIONS = ["Weekly", "Monthly", "Quarterly", "Yearly"];

export default function GovernancePage() {
  const router = useRouter();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("Dashboard");
  const [activeDocType, setActiveDocType] = useState<string>("Policy");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [frameworkFilter, setFrameworkFilter] = useState<string>("all");

  // Filter options
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);

  // Status counts for all document types
  const [statusCounts, setStatusCounts] = useState({
    total: 0,
    notUploaded: 0,
    draft: 0,
    approved: 0,
    published: 0,
    needsReview: 0,
  });

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

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    if (activeTab !== "Dashboard" && activeTab !== "Information Security Vault") {
      fetchPolicies();
    } else {
      fetchAllStatusCounts();
    }
  }, [activeTab, activeDocType, currentPage, statusFilter, frameworkFilter]);

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
      if (userRes.ok) setUsers(await userRes.json());
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

  const fetchAllStatusCounts = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/policies?limit=1000");
      if (response.ok) {
        const data = await response.json();
        const allPolicies = data.data || [];
        const counts = {
          total: allPolicies.length,
          notUploaded: allPolicies.filter((p: Policy) => p.status === "Not Uploaded").length,
          draft: allPolicies.filter((p: Policy) => p.status === "Draft").length,
          approved: allPolicies.filter((p: Policy) => p.status === "Approved").length,
          published: allPolicies.filter((p: Policy) => p.status === "Published").length,
          needsReview: allPolicies.filter((p: Policy) => p.status === "Needs Review").length,
        };
        setStatusCounts(counts);
      }
    } catch (error) {
      console.error("Error fetching status counts:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPolicies = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", currentPage.toString());
      params.set("limit", "20");
      params.set("documentType", activeDocType);
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (frameworkFilter && frameworkFilter !== "all") params.set("frameworkId", frameworkFilter);
      if (search) params.set("search", search);

      const response = await fetch(`/api/policies?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setPolicies(data.data || []);
        setTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);

        // Calculate status counts for current document type
        const counts = {
          total: data.pagination?.total || 0,
          notUploaded: 0,
          draft: 0,
          approved: 0,
          published: 0,
          needsReview: 0,
        };
        (data.data || []).forEach((p: Policy) => {
          if (p.status === "Not Uploaded") counts.notUploaded++;
          else if (p.status === "Draft") counts.draft++;
          else if (p.status === "Approved") counts.approved++;
          else if (p.status === "Published") counts.published++;
          else if (p.status === "Needs Review") counts.needsReview++;
        });
        setStatusCounts(counts);
      }
    } catch (error) {
      console.error("Error fetching policies:", error);
    } finally {
      setLoading(false);
    }
  }, [activeDocType, currentPage, statusFilter, frameworkFilter, search]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchPolicies();
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      params.set("documentType", activeDocType);
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (frameworkFilter && frameworkFilter !== "all") params.set("frameworkId", frameworkFilter);

      const response = await fetch(`/api/policies/export?${params.toString()}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${activeDocType.toLowerCase()}s-export.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Error exporting:", error);
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
      documentType: "Policy",
      recurrence: "",
      departmentId: "",
      assigneeId: "",
    });
    setSelectedControlIds([]);
    setControlSearch("");
    setControlDomainFilter("all");
    setControlStatusFilter("all");
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "Published": return "bg-green-100 text-green-800";
      case "Approved": return "bg-blue-100 text-blue-800";
      case "Draft": return "bg-yellow-100 text-yellow-800";
      case "Needs Review": return "bg-orange-100 text-orange-800";
      case "Not Uploaded": return "bg-gray-100 text-gray-800";
      case "Pending Approval": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getTabIcon = (type: string) => {
    switch (type) {
      case "Dashboard": return <LayoutDashboard className="h-4 w-4 mr-2" />;
      case "Policy": return <FileText className="h-4 w-4 mr-2" />;
      case "Standard": return <BookOpen className="h-4 w-4 mr-2" />;
      case "Procedure": return <ClipboardList className="h-4 w-4 mr-2" />;
      case "Information Security Vault": return <Lock className="h-4 w-4 mr-2" />;
      default: return <Shield className="h-4 w-4 mr-2" />;
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

  // Filter users by selected department
  const filteredUsers = newPolicy.departmentId
    ? users.filter((u) => u.departmentId === newPolicy.departmentId || !u.departmentId)
    : users;

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === "Policy" || tab === "Standard" || tab === "Procedure") {
      setActiveDocType(tab);
    }
    setCurrentPage(1);
    setStatusFilter("all");
  };

  const canProceedStep1 = newPolicy.name && newPolicy.departmentId && newPolicy.documentType && newPolicy.recurrence && newPolicy.assigneeId;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Governance</h1>
        </div>
        <div className="flex gap-2">
          {activeTab !== "Dashboard" && activeTab !== "Information Security Vault" && (
            <>
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button onClick={() => {
                setNewPolicy({ ...newPolicy, documentType: activeDocType });
                setIsCreateDialogOpen(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                New {activeDocType}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Integrated Framework Filter - Above tabs */}
      {activeTab !== "Dashboard" && activeTab !== "Information Security Vault" && (
        <div className="flex items-center gap-4">
          <Label className="text-sm font-medium">Integrated Framework:</Label>
          <Select value={frameworkFilter} onValueChange={setFrameworkFilter}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="All Frameworks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Frameworks</SelectItem>
              {frameworks.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="cursor-pointer hover:shadow-md" onClick={() => setStatusFilter("all")}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{statusCounts.total}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md border-l-4 border-l-gray-500" onClick={() => setStatusFilter("Not Uploaded")}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-gray-600">{statusCounts.notUploaded}</div>
            <div className="text-sm text-muted-foreground">Not Uploaded</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md border-l-4 border-l-yellow-500" onClick={() => setStatusFilter("Draft")}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">{statusCounts.draft}</div>
            <div className="text-sm text-muted-foreground">Draft</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md border-l-4 border-l-blue-500" onClick={() => setStatusFilter("Approved")}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{statusCounts.approved}</div>
            <div className="text-sm text-muted-foreground">Approved</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md border-l-4 border-l-green-500" onClick={() => setStatusFilter("Published")}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{statusCounts.published}</div>
            <div className="text-sm text-muted-foreground">Published</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md border-l-4 border-l-orange-500" onClick={() => setStatusFilter("Needs Review")}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">{statusCounts.needsReview}</div>
            <div className="text-sm text-muted-foreground">Needs Review</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="Dashboard">
            {getTabIcon("Dashboard")}
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="Policy">
            {getTabIcon("Policy")}
            Policy
          </TabsTrigger>
          <TabsTrigger value="Standard">
            {getTabIcon("Standard")}
            Standards
          </TabsTrigger>
          <TabsTrigger value="Procedure">
            {getTabIcon("Procedure")}
            Procedures
          </TabsTrigger>
          <TabsTrigger value="Information Security Vault">
            {getTabIcon("Information Security Vault")}
            Information Security Vault
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab Content */}
        <TabsContent value="Dashboard" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Status Distribution Card */}
            <Card>
              <CardHeader>
                <CardTitle>Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gray-500" />
                      <span>Not Uploaded</span>
                    </div>
                    <span className="font-bold">{statusCounts.notUploaded}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <span>Draft</span>
                    </div>
                    <span className="font-bold">{statusCounts.draft}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span>Approved</span>
                    </div>
                    <span className="font-bold">{statusCounts.approved}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span>Published</span>
                    </div>
                    <span className="font-bold">{statusCounts.published}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-orange-500" />
                      <span>Needs Review</span>
                    </div>
                    <span className="font-bold">{statusCounts.needsReview}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Document Types Card */}
            <Card>
              <CardHeader>
                <CardTitle>Document Types</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted cursor-pointer"
                    onClick={() => handleTabChange("Policy")}
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <span>Policies</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted cursor-pointer"
                    onClick={() => handleTabChange("Standard")}
                  >
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-green-600" />
                      <span>Standards</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted cursor-pointer"
                    onClick={() => handleTabChange("Procedure")}
                  >
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5 text-purple-600" />
                      <span>Procedures</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Policy/Standard/Procedure Tab Content */}
        {["Policy", "Standard", "Procedure"].map((docType) => (
          <TabsContent key={docType} value={docType} className="mt-4">
            {/* Filters */}
            <Card className="mb-4">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Search By Code, Name, Department, Assignee, Approver"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" onClick={handleSearch}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Table */}
            <Card>
              <CardContent className="p-4">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Assignee</TableHead>
                          <TableHead>Approver</TableHead>
                          <TableHead>Department Name</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {policies.map((policy) => (
                          <TableRow
                            key={policy.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => router.push(`/compliance/governance/${policy.id}`)}
                          >
                            <TableCell className="font-medium">{policy.code}</TableCell>
                            <TableCell>{policy.name}</TableCell>
                            <TableCell>
                              <Badge className={getStatusBadgeColor(policy.status)}>
                                {policy.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{policy.assignee?.fullName || "-"}</TableCell>
                            <TableCell>{policy.approver?.fullName || "-"}</TableCell>
                            <TableCell>{policy.department?.name || "-"}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/compliance/governance/${policy.id}`);
                                }}
                              >
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {policies.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              No {docType.toLowerCase()}s found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>

                    {/* Pagination */}
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-muted-foreground">
                        Showing {policies.length > 0 ? (currentPage - 1) * 20 + 1 : 0} to {Math.min(currentPage * 20, total)} of {total}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage((p) => p - 1)}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage >= totalPages}
                          onClick={() => setCurrentPage((p) => p + 1)}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}

        {/* Information Security Vault Tab Content */}
        <TabsContent value="Information Security Vault" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Information Security Vault</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Lock className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Secure Document Storage</p>
                <p className="text-sm mt-2">Store and manage sensitive security documents</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Dialog - 3 Steps */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        if (!open) resetCreateDialog();
        setIsCreateDialogOpen(open);
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              New Governance - Step {createStep} of 3
            </DialogTitle>
          </DialogHeader>

          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2 py-4">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === createStep
                    ? "bg-primary text-primary-foreground"
                    : step < createStep
                    ? "bg-green-500 text-white"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {step}
                </div>
                {step < 3 && (
                  <div className={`w-16 h-1 mx-2 ${step < createStep ? "bg-green-500" : "bg-muted"}`} />
                )}
              </div>
            ))}
          </div>

          <div className="py-4">
            {/* Step 1: Basic Information */}
            {createStep === 1 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Policy Name *</Label>
                  <Input
                    id="name"
                    value={newPolicy.name}
                    onChange={(e) => setNewPolicy({ ...newPolicy, name: e.target.value })}
                    placeholder="Enter policy name"
                  />
                </div>
                <div>
                  <Label htmlFor="departmentId">Department *</Label>
                  <Select value={newPolicy.departmentId} onValueChange={(v) => setNewPolicy({ ...newPolicy, departmentId: v, assigneeId: "" })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="documentType">Document Type *</Label>
                  <Select value={newPolicy.documentType} onValueChange={(v) => setNewPolicy({ ...newPolicy, documentType: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select document type" />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="recurrence">Recurrence *</Label>
                  <Select value={newPolicy.recurrence} onValueChange={(v) => setNewPolicy({ ...newPolicy, recurrence: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select recurrence" />
                    </SelectTrigger>
                    <SelectContent>
                      {RECURRENCE_OPTIONS.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="assigneeId">Assignee *</Label>
                  <Select value={newPolicy.assigneeId} onValueChange={(v) => setNewPolicy({ ...newPolicy, assigneeId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Step 2: Link Controls */}
            {createStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-lg font-medium">Select Controls to Link</Label>
                  <Badge variant="secondary">{selectedControlIds.length} selected</Badge>
                </div>

                {/* Control Filters */}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Search controls..."
                      value={controlSearch}
                      onChange={(e) => setControlSearch(e.target.value)}
                    />
                  </div>
                  <Select value={controlDomainFilter} onValueChange={setControlDomainFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Domain" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Domains</SelectItem>
                      {domains.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={controlStatusFilter} onValueChange={setControlStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="Compliant">Compliant</SelectItem>
                      <SelectItem value="Non Compliant">Non Compliant</SelectItem>
                      <SelectItem value="Not Applicable">Not Applicable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Controls Table */}
                <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>Control Code</TableHead>
                        <TableHead>Control Name</TableHead>
                        <TableHead>Domain</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredControls.map((control) => (
                        <TableRow key={control.id}>
                          <TableCell>
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
                          <TableCell className="font-medium">{control.controlCode}</TableCell>
                          <TableCell>{control.name}</TableCell>
                          <TableCell>{control.domain?.name || "-"}</TableCell>
                          <TableCell>
                            <Badge className={getStatusBadgeColor(control.status)}>
                              {control.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredControls.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No controls found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Step 3: Review */}
            {createStep === 3 && (
              <div className="space-y-6">
                <div className="text-lg font-medium">Review Information</div>

                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <Label className="text-muted-foreground text-sm">Policy Name</Label>
                    <p className="font-medium">{newPolicy.name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Document Type</Label>
                    <p className="font-medium">{newPolicy.documentType}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Recurrence</Label>
                    <p className="font-medium">{newPolicy.recurrence}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Department</Label>
                    <p className="font-medium">
                      {departments.find((d) => d.id === newPolicy.departmentId)?.name || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Assignee</Label>
                    <p className="font-medium">
                      {users.find((u) => u.id === newPolicy.assigneeId)?.fullName || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Linked Controls</Label>
                    <p className="font-medium">{selectedControlIds.length} controls</p>
                  </div>
                </div>

                {selectedControlIds.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground text-sm mb-2 block">Selected Controls:</Label>
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

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              if (createStep > 1) setCreateStep(createStep - 1);
              else {
                resetCreateDialog();
                setIsCreateDialogOpen(false);
              }
            }}>
              {createStep === 1 ? "Cancel" : "Previous"}
            </Button>
            <Button
              onClick={() => {
                if (createStep < 3) setCreateStep(createStep + 1);
                else handleCreatePolicy();
              }}
              disabled={createStep === 1 && !canProceedStep1}
            >
              {createStep === 3 ? `Create ${newPolicy.documentType}` : "Next"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
