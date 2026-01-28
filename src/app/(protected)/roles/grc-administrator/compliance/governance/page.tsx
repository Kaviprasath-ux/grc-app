"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { usePermissions, useHasRole } from "@/hooks/usePermissions";
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
  Search,
  Upload,
  Trash2,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
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

interface Framework {
  id: string;
  name: string;
  code: string;
}

interface Control {
  id: string;
  controlCode: string;
  name: string;
  description?: string;
  status: string;
  entities?: string;
  domain?: { id: string; name: string };
}

interface Domain {
  id: string;
  name: string;
}

const DOCUMENT_TYPES = ["Policy", "Standard", "Procedure"];
const RECURRENCE_OPTIONS = ["Weekly", "Monthly", "Quarterly", "Yearly"];
const ENTITIES_OPTIONS = ["Organization Wide"];

export default function GRCAdminGovernancePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { canView, canCreate, canEdit, canDelete, isLoading: permissionsLoading } = usePermissions('compliance.governance');
  const isGRCAdmin = useHasRole("GRCAdministrator");
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDocType, setActiveDocType] = useState<string>("Policy");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const itemsPerPage = 20;

  // Filters
  const [frameworkFilter, setFrameworkFilter] = useState<string>("all");

  // Filter options
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
    entities: "",
  });

  // Step 2 - Control linking
  const [selectedControlIds, setSelectedControlIds] = useState<string[]>([]);
  const [controlSearch, setControlSearch] = useState("");
  const [controlDomainFilter, setControlDomainFilter] = useState<string>("all");

  // Delete dialogs
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);
  const [policyToDelete, setPolicyToDelete] = useState<Policy | null>(null);

  // Import dialog
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    fetchFilterOptions();
  }, [session?.user?.id]);

  useEffect(() => {
    fetchPolicies();
  }, [activeDocType, currentPage, frameworkFilter]);

  const fetchFilterOptions = async () => {
    try {
      const [frameworkRes, controlRes, domainRes] = await Promise.all([
        fetch("/api/frameworks"),
        fetch("/api/controls"),
        fetch("/api/control-domains"),
      ]);
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

  const fetchPolicies = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", currentPage.toString());
      params.set("limit", itemsPerPage.toString());
      params.set("documentType", activeDocType);
      if (frameworkFilter && frameworkFilter !== "all") params.set("frameworkId", frameworkFilter);
      if (search) params.set("search", search);

      const response = await fetch(`/api/policies?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setPolicies(data.data || []);
        setTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error("Error fetching policies:", error);
    } finally {
      setLoading(false);
    }
  }, [activeDocType, currentPage, frameworkFilter, search]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchPolicies();
  };

  const handleCreatePolicy = async () => {
    try {
      const response = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPolicy.name,
          documentType: newPolicy.documentType,
          recurrence: newPolicy.recurrence,
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
      entities: "",
    });
    setSelectedControlIds([]);
    setControlSearch("");
    setControlDomainFilter("all");
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
      const params = new URLSearchParams();
      params.set("documentType", activeDocType);
      const response = await fetch(`/api/policies/delete-all?${params.toString()}`, {
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

  // Filter controls for Step 2
  const filteredControls = controls.filter((control) => {
    const matchesSearch = !controlSearch ||
      control.name.toLowerCase().includes(controlSearch.toLowerCase()) ||
      control.controlCode.toLowerCase().includes(controlSearch.toLowerCase());
    const matchesDomain = controlDomainFilter === "all" || control.domain?.id === controlDomainFilter;
    return matchesSearch && matchesDomain;
  });

  const handleTabChange = (tab: string) => {
    setActiveDocType(tab);
    setCurrentPage(1);
    setSearch("");
    setFrameworkFilter("all");
  };

  const canProceedStep1 = newPolicy.name && newPolicy.documentType && newPolicy.recurrence && newPolicy.entities;

  // Pagination helpers
  const startItem = total > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endItem = Math.min(currentPage * itemsPerPage, total);

  // Show loading while checking permissions
  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show unauthorized if user is not GRC Admin or cannot view
  if (!isGRCAdmin || !canView) {
    return <Unauthorized description="You don't have permission to access GRC Admin Governance." />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Governance</h1>
        </div>
        <div className="flex gap-2">
          <PermissionGate resource="compliance.governance" action="create">
            <Button onClick={() => {
              setNewPolicy({ ...newPolicy, documentType: activeDocType });
              setIsCreateDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              New Governance
            </Button>
          </PermissionGate>
          <PermissionGate resource="compliance.governance" action="create">
            <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
          </PermissionGate>
          <PermissionGate resource="compliance.governance" action="delete">
            <Button variant="outline" onClick={() => setIsDeleteAllDialogOpen(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete All
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeDocType} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="Policy">Policy</TabsTrigger>
          <TabsTrigger value="Standard">Standards</TabsTrigger>
          <TabsTrigger value="Procedure">Procedures</TabsTrigger>
        </TabsList>

        {/* Tab Content - Same structure for all tabs */}
        {["Policy", "Standard", "Procedure"].map((docType) => (
          <TabsContent key={docType} value={docType} className="mt-4 space-y-4">
            {/* Search and Filter Row */}
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Input
                  placeholder={` Search By ${docType} Name , ${docType} Code`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pr-10"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={handleSearch}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              <Select value={frameworkFilter} onValueChange={setFrameworkFilter}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Integrated Framework" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Integrated Framework</SelectItem>
                  {frameworks.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : (
              <>
                <div className="border rounded-lg">
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
                          onDoubleClick={() => router.push(`/roles/grc-administrator/compliance/governance/${policy.id}`)}
                        >
                          <TableCell className="font-medium">{policy.code}</TableCell>
                          <TableCell>{policy.name}</TableCell>
                          <TableCell>
                            <Badge className={getStatusBadgeColor(policy.status)}>
                              {policy.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{policy.assignee?.fullName || ""}</TableCell>
                          <TableCell>{policy.approver?.fullName || ""}</TableCell>
                          <TableCell>{policy.department?.name || ""}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <PermissionGate resource="compliance.governance" action="edit">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/roles/grc-administrator/compliance/governance/${policy.id}`);
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </PermissionGate>
                              <PermissionGate resource="compliance.governance" action="delete">
                                <Button
                                  variant="ghost"
                                  size="icon"
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
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No {docType.toLowerCase()}s found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(1)}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground px-4">
                    Currently showing {startItem} to {endItem} of {total}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Create Dialog - 3 Steps */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        if (!open) resetCreateDialog();
        setIsCreateDialogOpen(open);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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

          <div className="flex justify-center gap-16 text-sm text-muted-foreground mb-4">
            <span className={createStep === 1 ? "text-primary font-medium" : ""}>Policy Information</span>
            <span className={createStep === 2 ? "text-primary font-medium" : ""}>Assignments & Details</span>
            <span className={createStep === 3 ? "text-primary font-medium" : ""}>Review informations</span>
          </div>

          <div className="py-4">
            {/* Step 1: Policy Information — UAT exact fields */}
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
                  <Label htmlFor="documentType">Document type *</Label>
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
                  <Label htmlFor="entities">Entities *</Label>
                  <Select value={newPolicy.entities} onValueChange={(v) => setNewPolicy({ ...newPolicy, entities: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select entities" />
                    </SelectTrigger>
                    <SelectContent>
                      {ENTITIES_OPTIONS.map((e) => (
                        <SelectItem key={e} value={e}>{e}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Step 2: Assignments & Details — UAT exact: domain filter + search + control cards */}
            {createStep === 2 && (
              <div className="space-y-4">
                {/* Domain Filter */}
                <div className="flex justify-center">
                  <Select value={controlDomainFilter} onValueChange={setControlDomainFilter}>
                    <SelectTrigger className="w-[250px]">
                      <SelectValue placeholder="Clear Filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Clear Filter</SelectItem>
                      {domains.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Control Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search By Control Code , Name"
                    value={controlSearch}
                    onChange={(e) => setControlSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Controls List — Card style matching UAT */}
                <div className="max-h-[400px] overflow-y-auto space-y-3">
                  {filteredControls.map((control) => (
                    <div
                      key={control.id}
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                        selectedControlIds.includes(control.id)
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                      onClick={() => {
                        if (selectedControlIds.includes(control.id)) {
                          setSelectedControlIds(selectedControlIds.filter((id) => id !== control.id));
                        } else {
                          setSelectedControlIds([...selectedControlIds, control.id]);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedControlIds.includes(control.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedControlIds([...selectedControlIds, control.id]);
                              } else {
                                setSelectedControlIds(selectedControlIds.filter((id) => id !== control.id));
                              }
                            }}
                            className="mt-1"
                          />
                          <div>
                            <p className="font-medium">
                              {control.controlCode} : {control.name}
                            </p>
                            {control.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {control.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className="shrink-0">
                          {control.entities || "Organization Wide"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {filteredControls.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No controls found
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Review — UAT exact fields: Policy Name, Recurrence, Entity */}
            {createStep === 3 && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 p-4">
                  <div>
                    <Label className="text-primary font-medium">Policy Name</Label>
                    <p className="mt-1">{newPolicy.name}</p>
                  </div>
                  <div>
                    <Label className="text-primary font-medium">Recurrence</Label>
                    <p className="mt-1">{newPolicy.recurrence}</p>
                  </div>
                  <div>
                    <Label className="text-primary font-medium">Entity</Label>
                    <p className="mt-1">{newPolicy.entities}</p>
                  </div>
                </div>
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

      {/* Delete Single Policy Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {policyToDelete?.documentType || "Policy"}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{policyToDelete?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPolicyToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePolicy} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Dialog */}
      <AlertDialog open={isDeleteAllDialogOpen} onOpenChange={setIsDeleteAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All {activeDocType}s</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all {activeDocType.toLowerCase()}s? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll} className="bg-red-600 hover:bg-red-700">
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import {activeDocType}s</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center ${
                isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {importFile ? (
                <div className="space-y-2">
                  <p className="font-medium">{importFile.name}</p>
                  <Button variant="outline" size="sm" onClick={() => setImportFile(null)}>
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Drag and drop a file here, or click to browse
                  </p>
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
                  <Button variant="outline" onClick={() => document.getElementById("import-file")?.click()}>
                    Browse Files
                  </Button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsImportDialogOpen(false);
              setImportFile(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={!importFile}>
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
