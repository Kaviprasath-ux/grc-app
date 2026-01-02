"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Edit, FileText, Shield, AlertTriangle, ClipboardCheck, Link2, Plus, X } from "lucide-react";

interface Control {
  id: string;
  controlCode: string;
  name: string;
  description?: string;
  controlQuestion?: string;
  functionalGrouping?: string;
  status: string;
  entities?: string;
  isControlList?: boolean;
  relativeControlWeighting?: number;
  scope?: string;
  notPerformed?: string;
  performedInformally?: string;
  plannedAndTracked?: string;
  wellDefined?: string;
  quantitativelyControlled?: string;
  continuouslyImproving?: string;
  domain?: { id: string; name: string; code?: string };
  framework?: { id: string; name: string };
  department?: { id: string; name: string };
  owner?: { id: string; fullName: string };
  assignee?: { id: string; fullName: string };
  evidences?: Evidence[];
  exceptions?: Exception[];
  requirements?: RequirementControl[];
  controlRisks?: ControlRisk[];
  policyControls?: PolicyControl[];
}

interface Evidence {
  id: string;
  evidenceCode: string;
  name: string;
  status: string;
  dueDate?: string;
  assignee?: { fullName: string };
  attachments?: { id: string; fileName: string }[];
}

interface Exception {
  id: string;
  exceptionCode: string;
  name: string;
  category: string;
  status: string;
  endDate?: string;
}

interface RequirementControl {
  requirement: {
    id: string;
    code: string;
    name: string;
    framework?: { name: string };
  };
}

interface ControlRisk {
  risk: {
    id: string;
    riskId: string;
    name: string;
    riskRating: string;
    status: string;
    owner?: { fullName: string };
  };
}

interface PolicyControl {
  policy: {
    id: string;
    code: string;
    name: string;
    status: string;
    documentType: string;
  };
}

interface Department {
  id: string;
  name: string;
}

interface ControlDomain {
  id: string;
  name: string;
}

interface User {
  id: string;
  fullName: string;
}

interface Risk {
  id: string;
  riskId: string;
  name: string;
  riskRating: string;
}

interface Requirement {
  id: string;
  code: string;
  name: string;
}

const STATUS_OPTIONS = ["Non Compliant", "Compliant", "Not Applicable", "Partial Compliant"];
const FUNCTIONAL_GROUPINGS = ["Govern", "Identify", "Protect", "Detect", "Respond", "Recover"];
const SCOPE_OPTIONS = ["In-Scope", "Not In-Scope"];
const ENTITIES_OPTIONS = ["Organization Wide"];

export default function ControlDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [control, setControl] = useState<Control | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("requirements");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editData, setEditData] = useState<Partial<Control> & {
  requirementIds?: string[];
  domainId?: string;
  departmentId?: string;
  ownerId?: string;
  assigneeId?: string;
}>({});

  // Inline editable states
  const [inlineDepartmentId, setInlineDepartmentId] = useState<string>("");
  const [inlineAssigneeId, setInlineAssigneeId] = useState<string>("");
  const [inlineNotApplicable, setInlineNotApplicable] = useState<boolean>(false);
  const [selectedRiskIds, setSelectedRiskIds] = useState<string[]>([]);
  const [isRiskDialogOpen, setIsRiskDialogOpen] = useState(false);

  // Filter options for edit
  const [departments, setDepartments] = useState<Department[]>([]);
  const [domains, setDomains] = useState<ControlDomain[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [allRisks, setAllRisks] = useState<Risk[]>([]);
  const [allRequirements, setAllRequirements] = useState<Requirement[]>([]);

  useEffect(() => {
    fetchControl();
    fetchFilterOptions();
  }, [id]);

  const fetchControl = async () => {
    try {
      const response = await fetch(`/api/controls/${id}`);
      if (response.ok) {
        const data = await response.json();
        setControl(data);
        setEditData({
          ...data,
          domainId: data.domain?.id,
          departmentId: data.department?.id,
          ownerId: data.owner?.id,
          assigneeId: data.assignee?.id,
          requirementIds: data.requirements?.map((r: RequirementControl) => r.requirement.id) || [],
        });
        setInlineDepartmentId(data.department?.id || "");
        setInlineAssigneeId(data.assignee?.id || "");
        setInlineNotApplicable(data.status === "Not Applicable");
        setSelectedRiskIds(data.controlRisks?.map((cr: ControlRisk) => cr.risk.id) || []);
      }
    } catch (error) {
      console.error("Error fetching control:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const [deptRes, domainRes, userRes, riskRes, reqRes] = await Promise.all([
        fetch("/api/departments"),
        fetch("/api/control-domains"),
        fetch("/api/users"),
        fetch("/api/risks"),
        fetch("/api/requirements"),
      ]);
      if (deptRes.ok) setDepartments(await deptRes.json());
      if (domainRes.ok) setDomains(await domainRes.json());
      if (userRes.ok) setUsers(await userRes.json());
      if (riskRes.ok) {
        const riskData = await riskRes.json();
        setAllRisks(riskData.data || riskData || []);
      }
      if (reqRes.ok) {
        const reqData = await reqRes.json();
        setAllRequirements(reqData.data || reqData || []);
      }
    } catch (error) {
      console.error("Error fetching filter options:", error);
    }
  };

  const handleUpdateControl = async () => {
    try {
      const response = await fetch(`/api/controls/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });
      if (response.ok) {
        setIsEditDialogOpen(false);
        fetchControl();
      }
    } catch (error) {
      console.error("Error updating control:", error);
    }
  };

  const handleInlineDepartmentChange = async (departmentId: string) => {
    setInlineDepartmentId(departmentId);
    try {
      await fetch(`/api/controls/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departmentId }),
      });
      fetchControl();
    } catch (error) {
      console.error("Error updating department:", error);
    }
  };

  const handleInlineAssigneeChange = async (assigneeId: string) => {
    setInlineAssigneeId(assigneeId);
    try {
      await fetch(`/api/controls/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId }),
      });
      fetchControl();
    } catch (error) {
      console.error("Error updating assignee:", error);
    }
  };

  const handleNotApplicableChange = async (checked: boolean) => {
    setInlineNotApplicable(checked);
    try {
      await fetch(`/api/controls/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: checked ? "Not Applicable" : "Non Compliant" }),
      });
      fetchControl();
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleAddRisks = async () => {
    try {
      await fetch(`/api/controls/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riskIds: selectedRiskIds }),
      });
      setIsRiskDialogOpen(false);
      fetchControl();
    } catch (error) {
      console.error("Error updating risks:", error);
    }
  };

  const handleRemoveRisk = async (riskId: string) => {
    const newRiskIds = selectedRiskIds.filter(id => id !== riskId);
    setSelectedRiskIds(newRiskIds);
    try {
      await fetch(`/api/controls/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riskIds: newRiskIds }),
      });
      fetchControl();
    } catch (error) {
      console.error("Error removing risk:", error);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "Compliant": return "bg-green-100 text-green-800";
      case "Non Compliant": return "bg-red-100 text-red-800";
      case "Not Applicable": return "bg-gray-100 text-gray-800";
      case "Partial Compliant": return "bg-yellow-100 text-yellow-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getRiskRatingColor = (rating: string) => {
    switch (rating) {
      case "Catastrophic": return "bg-purple-100 text-purple-800";
      case "Very High": return "bg-red-100 text-red-800";
      case "High": return "bg-orange-100 text-orange-800";
      case "Medium": return "bg-yellow-100 text-yellow-800";
      case "Low": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!control) {
    return <div className="p-6">Control not found</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header with Back Link */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/compliance/control")}
            className="text-primary hover:underline text-sm"
          >
            &lt;&lt; Control
          </button>
        </div>
        <Button variant="outline" onClick={() => setIsEditDialogOpen(true)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit Control
        </Button>
      </div>

      {/* Control Title */}
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold">{control.name}</h1>
        <Badge className={getStatusBadgeColor(control.status)}>{control.status}</Badge>
      </div>
      <p className="text-muted-foreground">{control.controlCode}</p>

      {/* Control Details Card with Inline Editable Fields */}
      <Card>
        <CardHeader>
          <CardTitle>Control Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-muted-foreground">Domain</Label>
              <p className="font-medium">{control.domain?.name || "-"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Framework</Label>
              <p className="font-medium">{control.framework?.name || "-"}</p>
            </div>
            {/* Inline Editable Department */}
            <div>
              <Label className="text-muted-foreground">Department</Label>
              <Select value={inlineDepartmentId} onValueChange={handleInlineDepartmentChange}>
                <SelectTrigger className="mt-1">
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
              <Label className="text-muted-foreground">Functional Grouping</Label>
              <p className="font-medium">{control.functionalGrouping || "-"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Owner</Label>
              <p className="font-medium">{control.owner?.fullName || "-"}</p>
            </div>
            {/* Inline Editable Assignee */}
            <div>
              <Label className="text-muted-foreground">Assigned To</Label>
              <Select value={inlineAssigneeId} onValueChange={handleInlineAssigneeChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select assignee" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-muted-foreground">Entities</Label>
              <p className="font-medium">{control.entities || "Organization Wide"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Scope</Label>
              <p className="font-medium">{control.scope || "-"}</p>
            </div>
          </div>

          {/* Not Applicable Checkbox */}
          <div className="mt-4 flex items-center space-x-2">
            <Checkbox
              id="notApplicable"
              checked={inlineNotApplicable}
              onCheckedChange={(checked) => handleNotApplicableChange(checked as boolean)}
            />
            <Label htmlFor="notApplicable" className="cursor-pointer">Not Applicable</Label>
          </div>

          {/* Risk Multi-Select with + Button */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-muted-foreground">Risk</Label>
              <Button variant="outline" size="sm" onClick={() => setIsRiskDialogOpen(true)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {control.controlRisks?.map((cr) => (
                <Badge
                  key={cr.risk.id}
                  variant="outline"
                  className="flex items-center gap-1"
                >
                  {cr.risk.riskId} - {cr.risk.name}
                  <button
                    onClick={() => handleRemoveRisk(cr.risk.id)}
                    className="ml-1 hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {(!control.controlRisks || control.controlRisks.length === 0) && (
                <span className="text-muted-foreground text-sm">No risks linked</span>
              )}
            </div>
          </div>

          {control.description && (
            <div className="mt-4">
              <Label className="text-muted-foreground">Description</Label>
              <p className="mt-1">{control.description}</p>
            </div>
          )}
          {control.controlQuestion && (
            <div className="mt-4">
              <Label className="text-muted-foreground">Control Question</Label>
              <p className="mt-1">{control.controlQuestion}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs for related entities */}
      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start border-b rounded-none h-auto p-0">
            <TabsTrigger value="requirements" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <Link2 className="h-4 w-4 mr-2" />
              Linked Requirement ({control.requirements?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="governance" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <FileText className="h-4 w-4 mr-2" />
              Governance ({control.policyControls?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="evidence" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <ClipboardCheck className="h-4 w-4 mr-2" />
              Evidence ({control.evidences?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="exceptions" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Exception ({control.exceptions?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="risks" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <Shield className="h-4 w-4 mr-2" />
              Risk ({control.controlRisks?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requirements" className="p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Framework</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {control.requirements?.map((rc) => (
                  <TableRow key={rc.requirement.id}>
                    <TableCell>{rc.requirement.code}</TableCell>
                    <TableCell>{rc.requirement.name}</TableCell>
                    <TableCell>{rc.requirement.framework?.name || "-"}</TableCell>
                  </TableRow>
                ))}
                {(!control.requirements || control.requirements.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No linked requirements
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="governance" className="p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {control.policyControls?.map((pc) => (
                  <TableRow key={pc.policy.id}>
                    <TableCell>{pc.policy.code}</TableCell>
                    <TableCell>{pc.policy.name}</TableCell>
                    <TableCell>{pc.policy.documentType}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{pc.policy.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {(!control.policyControls || control.policyControls.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No linked policies
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="evidence" className="p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evidence Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Due Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {control.evidences?.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.evidenceCode}</TableCell>
                    <TableCell>{e.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{e.status}</Badge>
                    </TableCell>
                    <TableCell>{e.assignee?.fullName || "-"}</TableCell>
                    <TableCell>{e.dueDate ? new Date(e.dueDate).toLocaleDateString() : "-"}</TableCell>
                  </TableRow>
                ))}
                {(!control.evidences || control.evidences.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No linked evidences
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="exceptions" className="p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exception Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>End Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {control.exceptions?.map((ex) => (
                  <TableRow key={ex.id}>
                    <TableCell>{ex.exceptionCode}</TableCell>
                    <TableCell>{ex.name}</TableCell>
                    <TableCell>{ex.category}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{ex.status}</Badge>
                    </TableCell>
                    <TableCell>{ex.endDate ? new Date(ex.endDate).toLocaleDateString() : "-"}</TableCell>
                  </TableRow>
                ))}
                {(!control.exceptions || control.exceptions.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No linked exceptions
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="risks" className="p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Risk ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Risk Rating</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Owner</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {control.controlRisks?.map((cr) => (
                  <TableRow key={cr.risk.id}>
                    <TableCell>{cr.risk.riskId}</TableCell>
                    <TableCell>{cr.risk.name}</TableCell>
                    <TableCell>
                      <Badge className={getRiskRatingColor(cr.risk.riskRating)}>
                        {cr.risk.riskRating}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{cr.risk.status}</Badge>
                    </TableCell>
                    <TableCell>{cr.risk.owner?.fullName || "-"}</TableCell>
                  </TableRow>
                ))}
                {(!control.controlRisks || control.controlRisks.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No linked risks
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Edit Dialog with All Fields */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Control</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            {/* Control Name */}
            <div>
              <Label>Control Name *</Label>
              <Input
                value={editData.name || ""}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
              />
            </div>

            {/* Control Code (Editable) */}
            <div>
              <Label>Control Code</Label>
              <Input
                value={editData.controlCode || ""}
                onChange={(e) => setEditData({ ...editData, controlCode: e.target.value })}
              />
            </div>

            {/* Description */}
            <div className="col-span-2">
              <Label>Description</Label>
              <Textarea
                value={editData.description || ""}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                rows={3}
              />
            </div>

            {/* Control Question */}
            <div className="col-span-2">
              <Label>Control Question</Label>
              <Textarea
                value={editData.controlQuestion || ""}
                onChange={(e) => setEditData({ ...editData, controlQuestion: e.target.value })}
                rows={3}
              />
            </div>

            {/* Functional Grouping (Radio Buttons) */}
            <div className="col-span-2">
              <Label>Functional Grouping</Label>
              <RadioGroup
                value={editData.functionalGrouping || ""}
                onValueChange={(v) => setEditData({ ...editData, functionalGrouping: v })}
                className="grid grid-cols-6 gap-2 mt-2"
              >
                {FUNCTIONAL_GROUPINGS.map((g) => (
                  <div key={g} className="flex items-center space-x-2">
                    <RadioGroupItem value={g} id={`edit-fg-${g}`} />
                    <Label htmlFor={`edit-fg-${g}`} className="cursor-pointer text-sm">{g}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Entities (Radio Buttons) */}
            <div>
              <Label>Entities</Label>
              <RadioGroup
                value={editData.entities || "Organization Wide"}
                onValueChange={(v) => setEditData({ ...editData, entities: v })}
                className="mt-2"
              >
                {ENTITIES_OPTIONS.map((e) => (
                  <div key={e} className="flex items-center space-x-2">
                    <RadioGroupItem value={e} id={`edit-entity-${e}`} />
                    <Label htmlFor={`edit-entity-${e}`} className="cursor-pointer">{e}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Status (Radio Buttons) */}
            <div>
              <Label>Status</Label>
              <RadioGroup
                value={editData.status || ""}
                onValueChange={(v) => setEditData({ ...editData, status: v })}
                className="mt-2 space-y-1"
              >
                {STATUS_OPTIONS.map((s) => (
                  <div key={s} className="flex items-center space-x-2">
                    <RadioGroupItem value={s} id={`edit-status-${s}`} />
                    <Label htmlFor={`edit-status-${s}`} className="cursor-pointer text-sm">{s}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Is Control List (Radio Buttons) */}
            <div>
              <Label>Is Control List</Label>
              <RadioGroup
                value={editData.isControlList ? "yes" : "no"}
                onValueChange={(v) => setEditData({ ...editData, isControlList: v === "yes" })}
                className="flex gap-4 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="edit-isCL-yes" />
                  <Label htmlFor="edit-isCL-yes" className="cursor-pointer">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="edit-isCL-no" />
                  <Label htmlFor="edit-isCL-no" className="cursor-pointer">No</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Relative Control Weighting */}
            <div>
              <Label>Relative Control Weighting</Label>
              <Input
                type="number"
                value={editData.relativeControlWeighting || ""}
                onChange={(e) => setEditData({ ...editData, relativeControlWeighting: parseInt(e.target.value) || undefined })}
              />
            </div>

            {/* CMM Maturity Level Fields */}
            <div className="col-span-2">
              <h3 className="font-semibold mb-2 mt-4">CMM Maturity Level Descriptions</h3>
            </div>
            <div className="col-span-2">
              <Label>Level 0 - Not Performed</Label>
              <Textarea
                value={editData.notPerformed || ""}
                onChange={(e) => setEditData({ ...editData, notPerformed: e.target.value })}
                rows={2}
              />
            </div>
            <div className="col-span-2">
              <Label>Level 1 - Performed Informally</Label>
              <Textarea
                value={editData.performedInformally || ""}
                onChange={(e) => setEditData({ ...editData, performedInformally: e.target.value })}
                rows={2}
              />
            </div>
            <div className="col-span-2">
              <Label>Level 2 - Planned and Tracked</Label>
              <Textarea
                value={editData.plannedAndTracked || ""}
                onChange={(e) => setEditData({ ...editData, plannedAndTracked: e.target.value })}
                rows={2}
              />
            </div>
            <div className="col-span-2">
              <Label>Level 3 - Well Defined</Label>
              <Textarea
                value={editData.wellDefined || ""}
                onChange={(e) => setEditData({ ...editData, wellDefined: e.target.value })}
                rows={2}
              />
            </div>
            <div className="col-span-2">
              <Label>Level 4 - Quantitatively Controlled</Label>
              <Textarea
                value={editData.quantitativelyControlled || ""}
                onChange={(e) => setEditData({ ...editData, quantitativelyControlled: e.target.value })}
                rows={2}
              />
            </div>
            <div className="col-span-2">
              <Label>Level 5 - Continuously Improving</Label>
              <Textarea
                value={editData.continuouslyImproving || ""}
                onChange={(e) => setEditData({ ...editData, continuouslyImproving: e.target.value })}
                rows={2}
              />
            </div>

            {/* Scope */}
            <div>
              <Label>Scope</Label>
              <Select value={editData.scope || ""} onValueChange={(v) => setEditData({ ...editData, scope: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select scope" />
                </SelectTrigger>
                <SelectContent>
                  {SCOPE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Domain */}
            <div>
              <Label>Domain</Label>
              <Select
                value={editData.domainId || control.domain?.id || ""}
                onValueChange={(v) => setEditData({ ...editData, domainId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select domain" />
                </SelectTrigger>
                <SelectContent>
                  {domains.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Requirement Multi-Select */}
            <div className="col-span-2">
              <Label>Requirement</Label>
              <div className="border rounded-md p-2 mt-1 max-h-32 overflow-y-auto">
                {allRequirements.map((req) => (
                  <div key={req.id} className="flex items-center space-x-2 py-1">
                    <Checkbox
                      id={`req-${req.id}`}
                      checked={editData.requirementIds?.includes(req.id) || false}
                      onCheckedChange={(checked) => {
                        const currentIds = editData.requirementIds || [];
                        if (checked) {
                          setEditData({ ...editData, requirementIds: [...currentIds, req.id] });
                        } else {
                          setEditData({ ...editData, requirementIds: currentIds.filter(id => id !== req.id) });
                        }
                      }}
                    />
                    <Label htmlFor={`req-${req.id}`} className="cursor-pointer text-sm">
                      {req.code} - {req.name}
                    </Label>
                  </div>
                ))}
                {allRequirements.length === 0 && (
                  <p className="text-muted-foreground text-sm">No requirements available</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateControl}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Risk Selection Dialog */}
      <Dialog open={isRiskDialogOpen} onOpenChange={setIsRiskDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Risks</DialogTitle>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto">
            {allRisks.map((risk) => (
              <div key={risk.id} className="flex items-center space-x-2 py-2">
                <Checkbox
                  id={`risk-${risk.id}`}
                  checked={selectedRiskIds.includes(risk.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedRiskIds([...selectedRiskIds, risk.id]);
                    } else {
                      setSelectedRiskIds(selectedRiskIds.filter(id => id !== risk.id));
                    }
                  }}
                />
                <Label htmlFor={`risk-${risk.id}`} className="cursor-pointer">
                  {risk.riskId} - {risk.name}
                </Label>
              </div>
            ))}
            {allRisks.length === 0 && (
              <p className="text-muted-foreground">No risks available</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRiskDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddRisks}>
              Add Selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
