"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Plus,
  Download,
  Edit2,
  Link2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

interface Framework {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  compliancePercentage: number;
  policyPercentage: number;
  evidencePercentage: number;
  requirements: Requirement[];
  requirementCategories: RequirementCategory[];
}

interface RequirementCategory {
  id: string;
  name: string;
  code?: string;
  sortOrder: number;
}

interface Requirement {
  id: string;
  code: string;
  name: string;
  description?: string;
  requirementType: string;
  chapterType: string;
  level: number;
  parentId?: string;
  categoryId?: string;
  category?: RequirementCategory;
  applicability?: string;
  justification?: string;
  implementationStatus?: string;
  controlCompliance?: string;
  children?: Requirement[];
  controls?: RequirementControl[];
}

interface RequirementControl {
  id: string;
  controlId: string;
  control: Control;
}

interface Control {
  id: string;
  controlCode: string;
  name: string;
  status: string;
  domain?: { id: string; name: string };
  functionalGrouping?: string;
}

interface ControlDomain {
  id: string;
  name: string;
}

export default function FrameworkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [framework, setFramework] = useState<Framework | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("requirements");

  // Dialogs
  const [isAddRequirementOpen, setIsAddRequirementOpen] = useState(false);
  const [isLinkControlsOpen, setIsLinkControlsOpen] = useState(false);
  const [isAddExceptionOpen, setIsAddExceptionOpen] = useState(false);
  const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null);

  // New Requirement form
  const [newRequirement, setNewRequirement] = useState({
    name: "",
    category: "",
    code: "",
    description: "",
    requirementType: "Mandatory",
    chapterType: "Domain",
  });

  // Link Controls
  const [controls, setControls] = useState<Control[]>([]);
  const [controlDomains, setControlDomains] = useState<ControlDomain[]>([]);
  const [controlFilters, setControlFilters] = useState({
    domainId: "",
    functionalGrouping: "",
    frameworkId: "",
    search: "",
  });
  const [selectedControlIds, setSelectedControlIds] = useState<string[]>([]);

  // Exception form
  const [newException, setNewException] = useState({
    name: "",
    description: "",
    status: "Pending",
    endDate: "",
  });

  // SOA Pagination
  const [soaPage, setSoaPage] = useState(0);
  const SOA_PAGE_SIZE = 20;

  useEffect(() => {
    fetchFramework();
    fetchControls();
    fetchControlDomains();
  }, [id]);

  const fetchFramework = async () => {
    try {
      const response = await fetch(`/api/frameworks/${id}`);
      if (response.ok) {
        const data = await response.json();
        setFramework(data);
      }
    } catch (error) {
      console.error("Error fetching framework:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchControls = async () => {
    try {
      const response = await fetch("/api/controls");
      if (response.ok) {
        const result = await response.json();
        // API returns { data: [...], pagination: {...} }
        setControls(result.data || []);
      }
    } catch (error) {
      console.error("Error fetching controls:", error);
    }
  };

  const fetchControlDomains = async () => {
    try {
      const response = await fetch("/api/control-domains");
      if (response.ok) {
        const data = await response.json();
        setControlDomains(data);
      }
    } catch (error) {
      console.error("Error fetching control domains:", error);
    }
  };

  // Build requirement hierarchy
  const buildHierarchy = (requirements: Requirement[]): Requirement[] => {
    const map = new Map<string, Requirement>();
    const roots: Requirement[] = [];

    requirements.forEach((req) => {
      map.set(req.id, { ...req, children: [] });
    });

    requirements.forEach((req) => {
      const item = map.get(req.id)!;
      if (req.parentId && map.has(req.parentId)) {
        map.get(req.parentId)!.children!.push(item);
      } else {
        roots.push(item);
      }
    });

    return roots;
  };

  // Filter requirements by search
  const filterRequirements = (requirements: Requirement[]): Requirement[] => {
    if (!searchTerm) return requirements;

    const searchLower = searchTerm.toLowerCase();
    return requirements.filter((req) => {
      const matches =
        req.code.toLowerCase().includes(searchLower) ||
        req.name.toLowerCase().includes(searchLower) ||
        (req.description?.toLowerCase().includes(searchLower) ?? false);

      if (matches) return true;

      // Check children
      if (req.children && req.children.length > 0) {
        const filteredChildren = filterRequirements(req.children);
        return filteredChildren.length > 0;
      }

      return false;
    });
  };

  const handleAddRequirement = async () => {
    try {
      const response = await fetch("/api/requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newRequirement,
          frameworkId: id,
        }),
      });

      if (response.ok) {
        setIsAddRequirementOpen(false);
        setNewRequirement({
          name: "",
          category: "",
          code: "",
          description: "",
          requirementType: "Mandatory",
          chapterType: "Domain",
        });
        fetchFramework();
      }
    } catch (error) {
      console.error("Error adding requirement:", error);
    }
  };

  const handleLinkControls = async () => {
    if (!selectedRequirement || selectedControlIds.length === 0) return;

    try {
      const response = await fetch(
        `/api/requirements/${selectedRequirement.id}/controls`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ controlIds: selectedControlIds }),
        }
      );

      if (response.ok) {
        setIsLinkControlsOpen(false);
        setSelectedControlIds([]);
        fetchFramework();
      }
    } catch (error) {
      console.error("Error linking controls:", error);
    }
  };

  const handleUnlinkControl = async (requirementId: string, controlId: string) => {
    try {
      const response = await fetch(
        `/api/requirements/${requirementId}/controls?controlId=${controlId}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        fetchFramework();
      }
    } catch (error) {
      console.error("Error unlinking control:", error);
    }
  };

  const handleAddException = async () => {
    if (!selectedRequirement) return;

    try {
      // Generate exception code
      const response = await fetch("/api/exceptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newException.name,
          description: newException.description,
          exceptionType: "Compliance",
          status: newException.status,
          endDate: newException.endDate ? new Date(newException.endDate) : undefined,
        }),
      });

      if (response.ok) {
        setIsAddExceptionOpen(false);
        setNewException({
          name: "",
          description: "",
          status: "Pending",
          endDate: "",
        });
        setSelectedRequirement(null);
      }
    } catch (error) {
      console.error("Error adding exception:", error);
    }
  };

  const handleSOAUpdate = async (
    requirementId: string,
    field: string,
    value: string
  ) => {
    try {
      await fetch(`/api/requirements/${requirementId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      fetchFramework();
    } catch (error) {
      console.error("Error updating SOA:", error);
    }
  };

  // Filter controls for linking
  const filteredControls = controls.filter((control) => {
    if (
      controlFilters.domainId &&
      control.domain?.id !== controlFilters.domainId
    ) {
      return false;
    }
    if (
      controlFilters.functionalGrouping &&
      control.functionalGrouping !== controlFilters.functionalGrouping
    ) {
      return false;
    }
    if (controlFilters.search) {
      const searchLower = controlFilters.search.toLowerCase();
      return (
        control.controlCode.toLowerCase().includes(searchLower) ||
        control.name.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!framework) {
    return <div className="text-center py-12">Framework not found</div>;
  }

  const requirementHierarchy = buildHierarchy(framework.requirements || []);
  const filteredHierarchy = filterRequirements(requirementHierarchy);

  // SOA data
  const flatRequirements = framework.requirements || [];
  const soaTotalPages = Math.ceil(flatRequirements.length / SOA_PAGE_SIZE);
  const soaStartIndex = soaPage * SOA_PAGE_SIZE;
  const soaEndIndex = Math.min(soaStartIndex + SOA_PAGE_SIZE, flatRequirements.length);
  const soaRequirements = flatRequirements.slice(soaStartIndex, soaEndIndex);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.push("/compliance/framework")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-2xl font-semibold">Total Requirements</h1>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="requirements">All Requirements</TabsTrigger>
          <TabsTrigger value="soa">SOA</TabsTrigger>
          <TabsTrigger value="audit-logs">Audit Logs</TabsTrigger>
        </TabsList>

        {/* Requirements Tab */}
        <TabsContent value="requirements" className="space-y-4">
          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline">Update Requirement</Button>
              <Button onClick={() => setIsAddRequirementOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Requirements
              </Button>
            </div>
          </div>

          {/* Search */}
          <Input
            placeholder="Search By Requirement Code, Name, Control Code, Control Name"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-2xl"
          />

          {/* Requirements Accordion */}
          <div className="border rounded-lg">
            <Accordion type="multiple" className="w-full">
              {filteredHierarchy.map((category) => (
                <AccordionItem key={category.id} value={category.id}>
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{category.name}</span>
                      <span className="text-muted-foreground text-sm">
                        {category.children?.length || 0} items
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <Accordion type="multiple" className="w-full">
                      {category.children?.map((requirement) => (
                        <AccordionItem
                          key={requirement.id}
                          value={requirement.id}
                        >
                          <AccordionTrigger className="hover:no-underline">
                            <span>
                              {requirement.code} - {requirement.name}
                            </span>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-4">
                            {/* Requirement Description */}
                            <div className="flex items-start justify-between p-4 bg-muted/50 rounded-lg">
                              <p className="text-sm flex-1">
                                {requirement.description || "No description"}
                              </p>
                              <Button variant="ghost" size="icon">
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedRequirement(requirement);
                                  setIsAddExceptionOpen(true);
                                }}
                              >
                                <AlertTriangle className="h-4 w-4 mr-2" />
                                Add Exception
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedRequirement(requirement);
                                  setIsLinkControlsOpen(true);
                                }}
                              >
                                <Link2 className="h-4 w-4 mr-2" />
                                Link Controls
                              </Button>
                            </div>

                            {/* Linked Controls Table */}
                            {requirement.controls &&
                              requirement.controls.length > 0 && (
                                <div className="mt-4">
                                  <h4 className="font-medium mb-2">
                                    Linked Controls
                                  </h4>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Control Code</TableHead>
                                        <TableHead>Control Name</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Action</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {requirement.controls.map((rc) => (
                                        <TableRow key={rc.id}>
                                          <TableCell>
                                            {rc.control.controlCode}
                                          </TableCell>
                                          <TableCell>
                                            {rc.control.name}
                                          </TableCell>
                                          <TableCell>
                                            <span
                                              className={`px-2 py-1 rounded-full text-xs ${
                                                rc.control.status === "Compliant"
                                                  ? "bg-green-100 text-green-800"
                                                  : rc.control.status ===
                                                    "Partial Compliant"
                                                  ? "bg-yellow-100 text-yellow-800"
                                                  : "bg-red-100 text-red-800"
                                              }`}
                                            >
                                              {rc.control.status}
                                            </span>
                                          </TableCell>
                                          <TableCell>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() =>
                                                handleUnlinkControl(
                                                  requirement.id,
                                                  rc.control.id
                                                )
                                              }
                                            >
                                              Unlink
                                            </Button>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </TabsContent>

        {/* SOA Tab */}
        <TabsContent value="soa" className="space-y-4">
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Requirement</TableHead>
                  <TableHead>Applicability</TableHead>
                  <TableHead>Justification</TableHead>
                  <TableHead>Implementation Status</TableHead>
                  <TableHead>Control Compliance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {soaRequirements.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell>{req.code}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {req.name}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={req.applicability || ""}
                        onValueChange={(value) =>
                          handleSOAUpdate(req.id, "applicability", value)
                        }
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue placeholder="-" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        className="w-40"
                        value={req.justification || ""}
                        onChange={(e) =>
                          handleSOAUpdate(req.id, "justification", e.target.value)
                        }
                        placeholder="Enter justification"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={req.implementationStatus || ""}
                        onValueChange={(value) =>
                          handleSOAUpdate(req.id, "implementationStatus", value)
                        }
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue placeholder="-" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                          <SelectItem value="Ongoing">Ongoing</SelectItem>
                          <SelectItem value="N/A">N/A</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          req.controlCompliance === "Compliant"
                            ? "bg-green-100 text-green-800"
                            : req.controlCompliance === "Partial Compliant"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {req.controlCompliance || "Non Compliant"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* SOA Pagination */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {flatRequirements.length > 0
                ? `${soaStartIndex + 1} to ${soaEndIndex} of ${flatRequirements.length}`
                : "No requirements"}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSoaPage(0)}
                disabled={soaPage === 0}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSoaPage(soaPage - 1)}
                disabled={soaPage === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSoaPage(soaPage + 1)}
                disabled={soaPage >= soaTotalPages - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSoaPage(soaTotalPages - 1)}
                disabled={soaPage >= soaTotalPages - 1}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* SOA Actions */}
          <div className="flex items-center gap-2">
            <Button>Save</Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download Report
            </Button>
          </div>
        </TabsContent>

        {/* Audit Logs Tab */}
        <TabsContent value="audit-logs">
          <div className="text-center py-12 text-muted-foreground">
            Audit logs will be displayed here.
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Requirement Dialog */}
      <Dialog open={isAddRequirementOpen} onOpenChange={setIsAddRequirementOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Requirement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              To add a requirement to this framework, please accurately fill in
              the fields below.
            </p>

            <div className="space-y-2">
              <Label>Requirement Name</Label>
              <Input
                value={newRequirement.name}
                onChange={(e) =>
                  setNewRequirement({ ...newRequirement, name: e.target.value })
                }
                placeholder="Enter Name"
              />
            </div>

            <div className="space-y-2">
              <Label>Requirement Category</Label>
              <Input
                value={newRequirement.category}
                onChange={(e) =>
                  setNewRequirement({
                    ...newRequirement,
                    category: e.target.value,
                  })
                }
                placeholder="Enter Category"
              />
            </div>

            <div className="space-y-2">
              <Label>Requirement Code</Label>
              <Input
                value={newRequirement.code}
                onChange={(e) =>
                  setNewRequirement({ ...newRequirement, code: e.target.value })
                }
                placeholder="Enter Code"
              />
            </div>

            <div className="space-y-2">
              <Label>Requirement Description</Label>
              <Textarea
                value={newRequirement.description}
                onChange={(e) =>
                  setNewRequirement({
                    ...newRequirement,
                    description: e.target.value,
                  })
                }
                placeholder="Type here"
              />
            </div>

            <div className="space-y-2">
              <Label>Requirement Type</Label>
              <Select
                value={newRequirement.requirementType}
                onValueChange={(value) =>
                  setNewRequirement({ ...newRequirement, requirementType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mandatory">Mandatory</SelectItem>
                  <SelectItem value="Additional">Additional</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Chapter Type</Label>
              <Select
                value={newRequirement.chapterType}
                onValueChange={(value) =>
                  setNewRequirement({ ...newRequirement, chapterType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Domain">Domain</SelectItem>
                  <SelectItem value="Process Domain">Process Domain</SelectItem>
                  <SelectItem value="Technical Domain">Technical Domain</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsAddRequirementOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddRequirement}
                disabled={!newRequirement.name || !newRequirement.code}
              >
                Add Requirement
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Link Controls Dialog */}
      <Dialog open={isLinkControlsOpen} onOpenChange={setIsLinkControlsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Control Select</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Filters */}
            <div className="grid grid-cols-3 gap-4">
              <Select
                value={controlFilters.domainId || "all"}
                onValueChange={(value) =>
                  setControlFilters({ ...controlFilters, domainId: value === "all" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Domain" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Domains</SelectItem>
                  {controlDomains.map((domain) => (
                    <SelectItem key={domain.id} value={domain.id}>
                      {domain.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={controlFilters.functionalGrouping || "all"}
                onValueChange={(value) =>
                  setControlFilters({
                    ...controlFilters,
                    functionalGrouping: value === "all" ? "" : value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Function Grouping" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Functions</SelectItem>
                  <SelectItem value="Govern">Govern</SelectItem>
                  <SelectItem value="Identify">Identify</SelectItem>
                  <SelectItem value="Protect">Protect</SelectItem>
                  <SelectItem value="Detect">Detect</SelectItem>
                  <SelectItem value="Respond">Respond</SelectItem>
                  <SelectItem value="Recover">Recover</SelectItem>
                </SelectContent>
              </Select>

              <Input
                placeholder="Search By Control Code, Name"
                value={controlFilters.search}
                onChange={(e) =>
                  setControlFilters({ ...controlFilters, search: e.target.value })
                }
              />
            </div>

            {/* Controls List */}
            <div className="border rounded-lg max-h-64 overflow-y-auto">
              {filteredControls.map((control) => (
                <div
                  key={control.id}
                  className={`flex items-center gap-3 p-3 border-b last:border-b-0 cursor-pointer hover:bg-muted/50 ${
                    selectedControlIds.includes(control.id) ? "bg-primary/10" : ""
                  }`}
                  onClick={() => {
                    setSelectedControlIds((prev) =>
                      prev.includes(control.id)
                        ? prev.filter((id) => id !== control.id)
                        : [...prev, control.id]
                    );
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedControlIds.includes(control.id)}
                    readOnly
                    className="rounded"
                  />
                  <div>
                    <div className="font-medium">{control.controlCode}</div>
                    <div className="text-sm text-muted-foreground">
                      {control.name}
                    </div>
                  </div>
                </div>
              ))}
              {filteredControls.length === 0 && (
                <div className="p-4 text-center text-muted-foreground">
                  No controls found
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsLinkControlsOpen(false);
                  setSelectedControlIds([]);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleLinkControls}
                disabled={selectedControlIds.length === 0}
              >
                Link Controls ({selectedControlIds.length})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Exception Dialog */}
      <Dialog open={isAddExceptionOpen} onOpenChange={setIsAddExceptionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Exception Management</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Exception Code</Label>
                <Input disabled value="Auto-generated" />
              </div>
              <div className="space-y-2">
                <Label>Exception Name</Label>
                <Input
                  value={newException.name}
                  onChange={(e) =>
                    setNewException({ ...newException, name: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Input disabled value="Compliance" />
            </div>

            <div className="space-y-2">
              <Label>Framework</Label>
              <Input disabled value={framework.name} />
            </div>

            <div className="space-y-2">
              <Label>Requirement Code</Label>
              <Input disabled value={selectedRequirement?.code || ""} />
            </div>

            <div className="space-y-2">
              <Label>Description/Justification</Label>
              <Textarea
                value={newException.description}
                onChange={(e) =>
                  setNewException({
                    ...newException,
                    description: e.target.value,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={newException.status}
                onValueChange={(value) =>
                  setNewException({ ...newException, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Authorised">Authorised</SelectItem>
                  <SelectItem value="Submitted for Closure">
                    Submitted for Closure
                  </SelectItem>
                  <SelectItem value="Overdue">Overdue</SelectItem>
                  <SelectItem value="RiskAccepted">RiskAccepted</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={newException.endDate}
                onChange={(e) =>
                  setNewException({ ...newException, endDate: e.target.value })
                }
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddExceptionOpen(false);
                  setSelectedRequirement(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleAddException}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
