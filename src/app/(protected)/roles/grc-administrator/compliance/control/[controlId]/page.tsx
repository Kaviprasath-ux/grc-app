"use client";

import { useEffect, useState, use, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
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
import { Edit, FileText, Shield, AlertTriangle, ClipboardCheck, Link2, Plus, X, Home, ChevronRight } from "lucide-react";
import { useTranslatedData, useTranslatedRecord, triggerTranslation } from "@/hooks/useTranslatedData";
import Link from "next/link";

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

export default function GRCAdminControlDetailPage({ params }: { params: Promise<{ controlId: string }> }) {
  const { controlId } = use(params);
  const router = useRouter();
  const { t } = useLanguage();
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

  // Dynamic data translation hooks
  const { data: translatedControl } = useTranslatedRecord(control, { modelName: 'Control' });
  const { data: translatedDepartments } = useTranslatedData(departments, { modelName: 'Department' });
  const { data: translatedDomains } = useTranslatedData(domains, { modelName: 'ControlDomain' });
  const { data: translatedUsers } = useTranslatedData(users, { modelName: 'User' });
  const { data: translatedAllRisks } = useTranslatedData(allRisks, { modelName: 'Risk' });
  const { data: translatedAllRequirements } = useTranslatedData(allRequirements, { modelName: 'Requirement' });

  // Translate nested arrays from control
  const requirementArray = useMemo(() => control?.requirements?.map(rc => rc.requirement) || [], [control?.requirements]);
  const { data: translatedRequirements } = useTranslatedData(requirementArray, { modelName: 'Requirement' });

  const policyArray = useMemo(() => control?.policyControls?.map(pc => pc.policy) || [], [control?.policyControls]);
  const { data: translatedPolicies } = useTranslatedData(policyArray, { modelName: 'Policy' });

  const evidenceArray = useMemo(() => control?.evidences || [], [control?.evidences]);
  const { data: translatedEvidences } = useTranslatedData(evidenceArray, { modelName: 'Evidence' });

  const exceptionArray = useMemo(() => control?.exceptions || [], [control?.exceptions]);
  const { data: translatedExceptions } = useTranslatedData(exceptionArray, { modelName: 'Exception' });

  const riskArray = useMemo(() => control?.controlRisks?.map(cr => cr.risk) || [], [control?.controlRisks]);
  const { data: translatedRisks } = useTranslatedData(riskArray, { modelName: 'Risk' });

  // Translate nested single objects
  const domainArray = useMemo(() => control?.domain ? [control.domain] : [], [control?.domain]);
  const { data: translatedDomainArr } = useTranslatedData(domainArray, { modelName: 'ControlDomain' });
  const translatedDomainName = translatedDomainArr[0]?.name || control?.domain?.name;

  const frameworkArray = useMemo(() => control?.framework ? [control.framework] : [], [control?.framework]);
  const { data: translatedFrameworkArr } = useTranslatedData(frameworkArray, { modelName: 'Framework' });
  const translatedFrameworkName = translatedFrameworkArr[0]?.name || control?.framework?.name;

  const ownerArray = useMemo(() => control?.owner ? [control.owner] : [], [control?.owner]);
  const { data: translatedOwnerArr } = useTranslatedData(ownerArray, { modelName: 'User' });
  const translatedOwnerName = translatedOwnerArr[0]?.fullName || control?.owner?.fullName;

  // Lookup helpers
  const tDept = useCallback((deptId: string | undefined, fallback: string) => {
    if (!deptId) return fallback;
    return translatedDepartments.find(d => d.id === deptId)?.name || fallback;
  }, [translatedDepartments]);

  const tUser = useCallback((userId: string | undefined, fallback: string) => {
    if (!userId) return fallback;
    return translatedUsers.find(u => u.id === userId)?.fullName || fallback;
  }, [translatedUsers]);

  const tReq = useCallback((reqId: string) => {
    return translatedRequirements.find(r => r.id === reqId)?.name || translatedAllRequirements.find(r => r.id === reqId)?.name;
  }, [translatedRequirements, translatedAllRequirements]);

  const tRisk = useCallback((riskId: string) => {
    return translatedRisks.find(r => r.id === riskId)?.name || translatedAllRisks.find(r => r.id === riskId)?.name;
  }, [translatedRisks, translatedAllRisks]);

  useEffect(() => {
    fetchControl();
    fetchFilterOptions();
  }, [controlId]);

  const fetchControl = async () => {
    try {
      const response = await fetch(`/api/controls/${controlId}`);
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
      const response = await fetch(`/api/controls/${controlId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });
      if (response.ok) {
        setIsEditDialogOpen(false);
        fetchControl();
        triggerTranslation('Control', controlId, {
          name: editData.name || '',
          description: editData.description || '',
          controlQuestion: editData.controlQuestion || '',
        });
      }
    } catch (error) {
      console.error("Error updating control:", error);
    }
  };

  const handleInlineDepartmentChange = async (departmentId: string) => {
    setInlineDepartmentId(departmentId);
    try {
      await fetch(`/api/controls/${controlId}`, {
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
      await fetch(`/api/controls/${controlId}`, {
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
      await fetch(`/api/controls/${controlId}`, {
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
      await fetch(`/api/controls/${controlId}`, {
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
      await fetch(`/api/controls/${controlId}`, {
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
    return <div className="p-6">{t("Loading...")}</div>;
  }

  if (!control) {
    return <div className="p-6">{t("Control not found")}</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs sm:text-sm overflow-x-auto whitespace-nowrap">
        <Link href="/grc" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("GRC")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-slate-500">{t("Compliance")}</span>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <Link href="/roles/grc-administrator/compliance/control" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Controls")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{control.controlCode}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{translatedControl?.name || control.name}</h1>
            <Badge className={getStatusBadgeColor(control.status)}>{control.status}</Badge>
          </div>
          <p className="text-sm text-slate-500">{control.controlCode}</p>
        </div>
        <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setIsEditDialogOpen(true)}>
          <Edit className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t("Edit Control")}
        </Button>
      </div>

      {/* Control Details Card with Inline Editable Fields */}
      <Card>
        <CardHeader>
          <CardTitle>{t("Control Details")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <Label className="text-muted-foreground">{t("Domain")}</Label>
              <p className="font-medium">{translatedDomainName || "-"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">{t("Framework")}</Label>
              <p className="font-medium">{translatedFrameworkName || "-"}</p>
            </div>
            {/* Inline Editable Department */}
            <div>
              <Label className="text-muted-foreground">{t("Department")}</Label>
              <Select value={inlineDepartmentId} onValueChange={handleInlineDepartmentChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={t("Select department")} />
                </SelectTrigger>
                <SelectContent>
                  {translatedDepartments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-muted-foreground">{t("Functional Grouping")}</Label>
              <p className="font-medium">{control.functionalGrouping || "-"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">{t("Owner")}</Label>
              <p className="font-medium">{translatedOwnerName || "-"}</p>
            </div>
            {/* Inline Editable Assignee */}
            <div>
              <Label className="text-muted-foreground">{t("Assigned To")}</Label>
              <Select value={inlineAssigneeId} onValueChange={handleInlineAssigneeChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={t("Select assignee")} />
                </SelectTrigger>
                <SelectContent>
                  {translatedUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-muted-foreground">{t("Entities")}</Label>
              <p className="font-medium">{control.entities || t("Organization Wide")}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">{t("Scope")}</Label>
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
            <Label htmlFor="notApplicable" className="cursor-pointer">{t("Not Applicable")}</Label>
          </div>

          {/* Risk Multi-Select with + Button */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-muted-foreground">{t("Risk")}</Label>
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
                  {cr.risk.riskId} - {tRisk(cr.risk.id) || cr.risk.name}
                  <button
                    onClick={() => handleRemoveRisk(cr.risk.id)}
                    className="ltr:ml-1 rtl:mr-1 hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {(!control.controlRisks || control.controlRisks.length === 0) && (
                <span className="text-muted-foreground text-sm">{t("No risks linked")}</span>
              )}
            </div>
          </div>

          {control.description && (
            <div className="mt-4">
              <Label className="text-muted-foreground">{t("Description")}</Label>
              <p className="mt-1">{translatedControl?.description || control.description}</p>
            </div>
          )}
          {control.controlQuestion && (
            <div className="mt-4">
              <Label className="text-muted-foreground">{t("Control Question")}</Label>
              <p className="mt-1">{translatedControl?.controlQuestion || control.controlQuestion}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs for related entities */}
      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 overflow-x-auto flex-nowrap">
            <TabsTrigger value="requirements" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <Link2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("Linked Requirement")} ({control.requirements?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="governance" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <FileText className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("Linked Governance")} ({control.policyControls?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="evidence" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <ClipboardCheck className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("Linked Evidence")} ({control.evidences?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="exceptions" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <AlertTriangle className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("Linked Exception")} ({control.exceptions?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="risks" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <Shield className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("Linked Risk")} ({control.controlRisks?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requirements" className="p-3 sm:p-4">
            <div className="overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Code")}</TableHead>
                  <TableHead>{t("Name")}</TableHead>
                  <TableHead>{t("Framework")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {control.requirements?.map((rc) => (
                  <TableRow key={rc.requirement.id}>
                    <TableCell>{rc.requirement.code}</TableCell>
                    <TableCell>{tReq(rc.requirement.id) || rc.requirement.name}</TableCell>
                    <TableCell>{rc.requirement.framework?.name || "-"}</TableCell>
                  </TableRow>
                ))}
                {(!control.requirements || control.requirements.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      {t("No linked requirements")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          </TabsContent>

          <TabsContent value="governance" className="p-3 sm:p-4">
            <div className="overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Code")}</TableHead>
                  <TableHead>{t("Name")}</TableHead>
                  <TableHead>{t("Type")}</TableHead>
                  <TableHead>{t("Status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {control.policyControls?.map((pc) => {
                  const translatedPolicy = translatedPolicies.find(p => p.id === pc.policy.id);
                  return (
                    <TableRow key={pc.policy.id}>
                      <TableCell>{pc.policy.code}</TableCell>
                      <TableCell>{translatedPolicy?.name || pc.policy.name}</TableCell>
                      <TableCell>{pc.policy.documentType}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{pc.policy.status}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(!control.policyControls || control.policyControls.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      {t("No linked policies")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          </TabsContent>

          <TabsContent value="evidence" className="p-3 sm:p-4">
            <div className="overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Evidence Code")}</TableHead>
                  <TableHead>{t("Name")}</TableHead>
                  <TableHead>{t("Status")}</TableHead>
                  <TableHead>{t("Assignee")}</TableHead>
                  <TableHead>{t("Due Date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {control.evidences?.map((e) => {
                  const translatedEvidence = translatedEvidences.find(ev => ev.id === e.id);
                  return (
                    <TableRow key={e.id}>
                      <TableCell>{e.evidenceCode}</TableCell>
                      <TableCell>{translatedEvidence?.name || e.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{e.status}</Badge>
                      </TableCell>
                      <TableCell>{e.assignee?.fullName || "-"}</TableCell>
                      <TableCell>{e.dueDate ? new Date(e.dueDate).toLocaleDateString() : "-"}</TableCell>
                    </TableRow>
                  );
                })}
                {(!control.evidences || control.evidences.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      {t("No linked evidences")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          </TabsContent>

          <TabsContent value="exceptions" className="p-3 sm:p-4">
            <div className="overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Exception Code")}</TableHead>
                  <TableHead>{t("Name")}</TableHead>
                  <TableHead>{t("Category")}</TableHead>
                  <TableHead>{t("Status")}</TableHead>
                  <TableHead>{t("End Date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {control.exceptions?.map((ex) => {
                  const translatedEx = translatedExceptions.find(e => e.id === ex.id);
                  return (
                    <TableRow key={ex.id}>
                      <TableCell>{ex.exceptionCode}</TableCell>
                      <TableCell>{translatedEx?.name || ex.name}</TableCell>
                      <TableCell>{ex.category}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{ex.status}</Badge>
                      </TableCell>
                      <TableCell>{ex.endDate ? new Date(ex.endDate).toLocaleDateString() : "-"}</TableCell>
                    </TableRow>
                  );
                })}
                {(!control.exceptions || control.exceptions.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      {t("No linked exceptions")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          </TabsContent>

          <TabsContent value="risks" className="p-3 sm:p-4">
            <div className="overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Risk ID")}</TableHead>
                  <TableHead>{t("Name")}</TableHead>
                  <TableHead>{t("Risk Rating")}</TableHead>
                  <TableHead>{t("Status")}</TableHead>
                  <TableHead>{t("Owner")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {control.controlRisks?.map((cr) => (
                  <TableRow key={cr.risk.id}>
                    <TableCell>{cr.risk.riskId}</TableCell>
                    <TableCell>{tRisk(cr.risk.id) || cr.risk.name}</TableCell>
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
                      {t("No linked risks")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Edit Dialog with All Fields */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("Edit Control")}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 py-4">
            {/* Control Name */}
            <div>
              <Label>{t("Control Name")} *</Label>
              <Input
                value={editData.name || ""}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
              />
            </div>

            {/* Control Code (Editable) */}
            <div>
              <Label>{t("Control Code")}</Label>
              <Input
                value={editData.controlCode || ""}
                onChange={(e) => setEditData({ ...editData, controlCode: e.target.value })}
              />
            </div>

            {/* Description */}
            <div className="col-span-2">
              <Label>{t("Description")}</Label>
              <Textarea
                value={editData.description || ""}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                rows={3}
              />
            </div>

            {/* Control Question */}
            <div className="col-span-2">
              <Label>{t("Control Question")}</Label>
              <Textarea
                value={editData.controlQuestion || ""}
                onChange={(e) => setEditData({ ...editData, controlQuestion: e.target.value })}
                rows={3}
              />
            </div>

            {/* Functional Grouping (Radio Buttons) */}
            <div className="col-span-2">
              <Label>{t("Functional Grouping")}</Label>
              <RadioGroup
                value={editData.functionalGrouping || ""}
                onValueChange={(v) => setEditData({ ...editData, functionalGrouping: v })}
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mt-2"
              >
                {FUNCTIONAL_GROUPINGS.map((g) => (
                  <div key={g} className="flex items-center space-x-2">
                    <RadioGroupItem value={g} id={`edit-fg-${g}`} />
                    <Label htmlFor={`edit-fg-${g}`} className="cursor-pointer text-sm">{t(g)}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Entities (Radio Buttons) */}
            <div>
              <Label>{t("Entities")}</Label>
              <RadioGroup
                value={editData.entities || "Organization Wide"}
                onValueChange={(v) => setEditData({ ...editData, entities: v })}
                className="mt-2"
              >
                {ENTITIES_OPTIONS.map((e) => (
                  <div key={e} className="flex items-center space-x-2">
                    <RadioGroupItem value={e} id={`edit-entity-${e}`} />
                    <Label htmlFor={`edit-entity-${e}`} className="cursor-pointer">{t(e)}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Status (Radio Buttons) */}
            <div>
              <Label>{t("Status")}</Label>
              <RadioGroup
                value={editData.status || ""}
                onValueChange={(v) => setEditData({ ...editData, status: v })}
                className="mt-2 space-y-1"
              >
                {STATUS_OPTIONS.map((s) => (
                  <div key={s} className="flex items-center space-x-2">
                    <RadioGroupItem value={s} id={`edit-status-${s}`} />
                    <Label htmlFor={`edit-status-${s}`} className="cursor-pointer text-sm">{t(s)}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Is Control List (Radio Buttons) */}
            <div>
              <Label>{t("Is Control List")}</Label>
              <RadioGroup
                value={editData.isControlList ? "yes" : "no"}
                onValueChange={(v) => setEditData({ ...editData, isControlList: v === "yes" })}
                className="flex gap-4 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="edit-isCL-yes" />
                  <Label htmlFor="edit-isCL-yes" className="cursor-pointer">{t("Yes")}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="edit-isCL-no" />
                  <Label htmlFor="edit-isCL-no" className="cursor-pointer">{t("No")}</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Relative Control Weighting */}
            <div>
              <Label>{t("Relative Control Weighting")}</Label>
              <Input
                type="number"
                value={editData.relativeControlWeighting || ""}
                onChange={(e) => setEditData({ ...editData, relativeControlWeighting: parseInt(e.target.value) || undefined })}
              />
            </div>

            {/* CMM Maturity Level Fields */}
            <div className="col-span-2">
              <h3 className="font-semibold mb-2 mt-4">{t("CMM Maturity Level Descriptions")}</h3>
            </div>
            <div className="col-span-2">
              <Label>{t("Level 0 - Not Performed")}</Label>
              <Textarea
                value={editData.notPerformed || ""}
                onChange={(e) => setEditData({ ...editData, notPerformed: e.target.value })}
                rows={2}
              />
            </div>
            <div className="col-span-2">
              <Label>{t("Level 1 - Performed Informally")}</Label>
              <Textarea
                value={editData.performedInformally || ""}
                onChange={(e) => setEditData({ ...editData, performedInformally: e.target.value })}
                rows={2}
              />
            </div>
            <div className="col-span-2">
              <Label>{t("Level 2 - Planned and Tracked")}</Label>
              <Textarea
                value={editData.plannedAndTracked || ""}
                onChange={(e) => setEditData({ ...editData, plannedAndTracked: e.target.value })}
                rows={2}
              />
            </div>
            <div className="col-span-2">
              <Label>{t("Level 3 - Well Defined")}</Label>
              <Textarea
                value={editData.wellDefined || ""}
                onChange={(e) => setEditData({ ...editData, wellDefined: e.target.value })}
                rows={2}
              />
            </div>
            <div className="col-span-2">
              <Label>{t("Level 4 - Quantitatively Controlled")}</Label>
              <Textarea
                value={editData.quantitativelyControlled || ""}
                onChange={(e) => setEditData({ ...editData, quantitativelyControlled: e.target.value })}
                rows={2}
              />
            </div>
            <div className="col-span-2">
              <Label>{t("Level 5 - Continuously Improving")}</Label>
              <Textarea
                value={editData.continuouslyImproving || ""}
                onChange={(e) => setEditData({ ...editData, continuouslyImproving: e.target.value })}
                rows={2}
              />
            </div>

            {/* Scope */}
            <div>
              <Label>{t("Scope")}</Label>
              <Select value={editData.scope || ""} onValueChange={(v) => setEditData({ ...editData, scope: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={t("Select scope")} />
                </SelectTrigger>
                <SelectContent>
                  {SCOPE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{t(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Domain */}
            <div>
              <Label>{t("Domain")}</Label>
              <Select
                value={editData.domainId || control.domain?.id || ""}
                onValueChange={(v) => setEditData({ ...editData, domainId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("Select domain")} />
                </SelectTrigger>
                <SelectContent>
                  {translatedDomains.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Requirement Multi-Select */}
            <div className="col-span-2">
              <Label>{t("Requirement")}</Label>
              <div className="border rounded-md p-2 mt-1 max-h-32 overflow-y-auto">
                {translatedAllRequirements.map((req) => (
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
                {translatedAllRequirements.length === 0 && (
                  <p className="text-muted-foreground text-sm">{t("No requirements available")}</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleUpdateControl}>
              {t("Save Changes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Risk Selection Dialog */}
      <Dialog open={isRiskDialogOpen} onOpenChange={setIsRiskDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Select Risks")}</DialogTitle>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto">
            {translatedAllRisks.length > 0 && (
              <div className="flex items-center space-x-2 py-2 border-b mb-1">
                <Checkbox
                  id="risk-select-all"
                  checked={translatedAllRisks.length > 0 && translatedAllRisks.every(r => selectedRiskIds.includes(r.id))}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedRiskIds([...new Set([...selectedRiskIds, ...translatedAllRisks.map(r => r.id)])]);
                    } else {
                      const allRiskIdSet = new Set(translatedAllRisks.map(r => r.id));
                      setSelectedRiskIds(selectedRiskIds.filter(id => !allRiskIdSet.has(id)));
                    }
                  }}
                />
                <Label htmlFor="risk-select-all" className="cursor-pointer font-medium">
                  {t("Select All")}
                </Label>
              </div>
            )}
            {translatedAllRisks.map((risk) => (
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
            {translatedAllRisks.length === 0 && (
              <p className="text-muted-foreground">{t("No risks available")}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRiskDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleAddRisks}>
              {t("Add Selected")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
