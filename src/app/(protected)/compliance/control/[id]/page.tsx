"use client";

import { useEffect, useState, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogTitle,
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
import { Edit, FileText, Shield, AlertTriangle, ClipboardCheck, Link2, Plus, X, Home, ChevronRight, Search, Eye } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSession } from "next-auth/react";
import { DatePicker } from "@/components/ui/date-picker";

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
  evidenceControls?: EvidenceControl[];
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

interface EvidenceControl {
  id: string;
  evidence: {
    id: string;
    evidenceCode: string;
    name: string;
    status: string;
    dueDate?: string;
    assignee?: { fullName: string };
    attachments?: { id: string; fileName: string }[];
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
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const { data: session } = useSession();

  // Context from framework navigation
  const fromFramework = searchParams.get("from") === "framework";
  const frameworkId = searchParams.get("frameworkId");
  const frameworkName = searchParams.get("frameworkName") ? decodeURIComponent(searchParams.get("frameworkName")!) : null;
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

  // Exception dialog state
  const [isExceptionDialogOpen, setIsExceptionDialogOpen] = useState(false);
  const [exceptionForm, setExceptionForm] = useState({ name: "", description: "", departmentId: "", endDate: undefined as Date | undefined });
  const [exceptionFieldErrors, setExceptionFieldErrors] = useState<Record<string, string>>({});
  const [exceptionSaving, setExceptionSaving] = useState(false);

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

  const handleCreateException = async () => {
    const errors: Record<string, string> = {};
    if (!exceptionForm.name.trim()) errors.name = t("Name is required");
    if (!exceptionForm.description.trim()) errors.description = t("Description is required");
    if (!exceptionForm.endDate) errors.endDate = t("End date is required");
    if (Object.keys(errors).length > 0) {
      setExceptionFieldErrors(errors);
      return;
    }
    setExceptionFieldErrors({});
    setExceptionSaving(true);
    try {
      const response = await fetch("/api/exceptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: exceptionForm.name.trim(),
          description: exceptionForm.description.trim(),
          category: "Control",
          controlId: id,
          departmentId: exceptionForm.departmentId || undefined,
          requesterId: (session?.user as { id?: string })?.id || undefined,
          status: "Pending",
          endDate: exceptionForm.endDate?.toISOString(),
        }),
      });
      if (response.ok) {
        setIsExceptionDialogOpen(false);
        setExceptionForm({ name: "", description: "", departmentId: "", endDate: undefined });
        fetchControl();
      }
    } catch (error) {
      console.error("Error creating exception:", error);
    } finally {
      setExceptionSaving(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "Compliant": return "bg-success-light text-success-dark";
      case "Non Compliant": return "bg-error-light text-error-dark";
      case "Not Applicable": return "bg-slate-100 text-slate-600";
      case "Partial Compliant": return "bg-warning-light text-warning-dark";
      default: return "bg-slate-100 text-slate-600";
    }
  };

  const getRiskRatingColor = (rating: string) => {
    switch (rating) {
      case "Catastrophic": return "bg-error-light text-error-dark";
      case "Very High": return "bg-error-light text-error-dark";
      case "High": return "bg-warning-light text-warning-dark";
      case "Medium": return "bg-warning-light text-warning-dark";
      case "Low": return "bg-success-light text-success-dark";
      default: return "bg-slate-100 text-slate-600";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (!control) {
    return <div className="space-y-6">{t("Control not found")}</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <Link href={fromFramework ? "/roles/customer-administrator/compliance" : "/dashboard"} className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Compliance")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        {fromFramework && frameworkId ? (
          <>
            <Link href="/roles/customer-administrator/compliance/framework" className="text-slate-500 hover:text-primary-600 transition-colors">
              {t("Integrated Frameworks")}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
            <Link href={`/roles/customer-administrator/compliance/framework/${frameworkId}/controls`} className="text-slate-500 hover:text-primary-600 transition-colors">
              {t("Controls")}
            </Link>
          </>
        ) : (
          <Link href="/compliance/control" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Controls")}
          </Link>
        )}
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{control.controlCode}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{control.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-slate-500">{control.controlCode}</span>
            <Badge className={getStatusBadgeColor(control.status)}>{t(control.status)}</Badge>
          </div>
        </div>
        <Button onClick={() => setIsEditDialogOpen(true)} className="w-full sm:w-auto">
          <Edit className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t("Edit Control")}
        </Button>
      </div>

      {/* Control Details */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-3 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            <div>
              <p className="text-xs text-slate-400 mb-0.5">{t("Domain")}</p>
              <p className="text-sm font-medium text-slate-800">{control.domain?.name || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">{t("Framework")}</p>
              <p className="text-sm font-medium text-slate-800">{control.framework?.name || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">{t("Owner")}</p>
              <p className="text-sm font-medium text-slate-800">{control.owner?.fullName || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">{t("Functional Grouping")}</p>
              <p className="text-sm font-medium text-slate-800">{control.functionalGrouping || "-"}</p>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100" />

        <div className="p-3 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            <div>
              <p className="text-xs text-slate-400 mb-1">{t("Department")}</p>
              <Select value={inlineDepartmentId} onValueChange={handleInlineDepartmentChange}>
                <SelectTrigger className="h-8 text-sm bg-white border-slate-200">
                  <SelectValue placeholder={t("Select department")} />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">{t("Assigned To")}</p>
              <Select value={inlineAssigneeId} onValueChange={handleInlineAssigneeChange}>
                <SelectTrigger className="h-8 text-sm bg-white border-slate-200">
                  <SelectValue placeholder={t("Select assignee")} />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">{t("Entities")}</p>
              <p className="text-sm font-medium text-slate-800">{t(control.entities || "Organization Wide")}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">{t("Scope")}</p>
              <p className="text-sm font-medium text-slate-800">{control.scope || "-"}</p>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100" />

        <div className="p-3 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-400">{t("Risk")}</p>
            <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => setIsRiskDialogOpen(true)}>
              <Plus className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
              {t("Add")}
            </Button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {control.controlRisks?.map((cr) => (
              <Badge
                key={cr.risk.id}
                variant="outline"
                className="flex items-center gap-1 text-xs"
              >
                {cr.risk.riskId} - {cr.risk.name}
                <button
                  onClick={() => handleRemoveRisk(cr.risk.id)}
                  className="ltr:ml-1 rtl:mr-1 hover:text-semantic-error"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {(!control.controlRisks || control.controlRisks.length === 0) && (
              <span className="text-sm text-slate-400">{t("No risks linked")}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Checkbox
              id="notApplicable"
              checked={inlineNotApplicable}
              onCheckedChange={(checked) => handleNotApplicableChange(checked as boolean)}
            />
            <label htmlFor="notApplicable" className="text-sm text-slate-600 cursor-pointer">{t("Not Applicable")}</label>
          </div>
        </div>

        {(control.description || control.controlQuestion) && (
          <>
            <div className="border-t border-slate-100" />

            <div className="p-3 sm:p-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5">
                {control.description && (
                  <div>
                    <p className="text-xs text-slate-400 mb-1">{t("Description")}</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{control.description}</p>
                  </div>
                )}
                {control.controlQuestion && (
                  <div>
                    <p className="text-xs text-slate-400 mb-1">{t("Control Question")}</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{control.controlQuestion}</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Tabs for related entities */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-0">
          <div className="overflow-x-auto px-3 sm:px-5 pt-3">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="requirements" className="flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                {t("Linked Requirement")} ({control.requirements?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="governance" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {t("Linked Governance")} ({control.policyControls?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="evidence" className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4" />
                {t("Linked Evidence")} ({(control.evidences?.length || 0) + (control.evidenceControls?.length || 0)})
              </TabsTrigger>
              <TabsTrigger value="exceptions" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {t("Linked Exception")} ({control.exceptions?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="risks" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                {t("Linked Risk")} ({control.controlRisks?.length || 0})
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="requirements" className="p-0">
            <div className="overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow className="border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3 ps-5">{t("Code")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3">{t("Name")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3 pe-5">{t("Framework")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {control.requirements?.map((rc) => (
                  <TableRow key={rc.requirement.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                    <TableCell className="py-3.5 ps-5 text-sm font-medium text-slate-800">{rc.requirement.code}</TableCell>
                    <TableCell className="py-3.5 text-sm text-slate-600">{rc.requirement.name}</TableCell>
                    <TableCell className="py-3.5 pe-5 text-sm text-slate-600">{rc.requirement.framework?.name || "-"}</TableCell>
                  </TableRow>
                ))}
                {(!control.requirements || control.requirements.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-12">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center mb-2">
                          <Link2 className="h-5 w-5 text-primary-400" />
                        </div>
                        <p className="text-sm text-slate-500">{t("No linked requirements")}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          </TabsContent>

          <TabsContent value="governance" className="p-0">
            <div className="overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow className="border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3 ps-5">{t("Code")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3">{t("Name")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3">{t("Type")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3 pe-5">{t("Status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {control.policyControls?.map((pc) => (
                  <TableRow key={pc.policy.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                    <TableCell className="py-3.5 ps-5 text-sm font-medium text-slate-800">{pc.policy.code}</TableCell>
                    <TableCell className="py-3.5 text-sm text-slate-600">{pc.policy.name}</TableCell>
                    <TableCell className="py-3.5 text-sm text-slate-600">{pc.policy.documentType}</TableCell>
                    <TableCell className="py-3.5 pe-5">
                      <Badge variant="outline">{pc.policy.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {(!control.policyControls || control.policyControls.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-12">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center mb-2">
                          <FileText className="h-5 w-5 text-primary-400" />
                        </div>
                        <p className="text-sm text-slate-500">{t("No linked policies")}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          </TabsContent>

          <TabsContent value="evidence" className="p-0">
            <div className="overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow className="border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3 ps-5">{t("Evidence Code")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3">{t("Name")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3">{t("Status")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3">{t("Assignee")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3">{t("Due Date")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3 pe-5 text-end">{t("Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Direct evidence links */}
                {control.evidences?.map((e) => (
                  <TableRow key={e.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                    <TableCell className="py-3.5 ps-5 text-sm font-medium text-slate-800">{e.evidenceCode}</TableCell>
                    <TableCell className="py-3.5 text-sm text-slate-600">{e.name}</TableCell>
                    <TableCell className="py-3.5">
                      <Badge variant="outline">{e.status}</Badge>
                    </TableCell>
                    <TableCell className="py-3.5 text-sm text-slate-600">{e.assignee?.fullName || "-"}</TableCell>
                    <TableCell className="py-3.5 text-sm text-slate-600">{e.dueDate ? new Date(e.dueDate).toLocaleDateString() : "-"}</TableCell>
                    <TableCell className="py-3.5 pe-5 text-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50" onClick={() => router.push(`/compliance/evidence/${e.id}`)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {/* Evidence linked via junction table (EvidenceControl) */}
                {control.evidenceControls?.map((ec) => (
                  <TableRow key={ec.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                    <TableCell className="py-3.5 ps-5 text-sm font-medium text-slate-800">{ec.evidence.evidenceCode}</TableCell>
                    <TableCell className="py-3.5 text-sm text-slate-600">{ec.evidence.name}</TableCell>
                    <TableCell className="py-3.5">
                      <Badge variant="outline">{ec.evidence.status}</Badge>
                    </TableCell>
                    <TableCell className="py-3.5 text-sm text-slate-600">{ec.evidence.assignee?.fullName || "-"}</TableCell>
                    <TableCell className="py-3.5 text-sm text-slate-600">{ec.evidence.dueDate ? new Date(ec.evidence.dueDate).toLocaleDateString() : "-"}</TableCell>
                    <TableCell className="py-3.5 pe-5 text-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50" onClick={() => router.push(`/compliance/evidence/${ec.evidence.id}`)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {((!control.evidences || control.evidences.length === 0) && (!control.evidenceControls || control.evidenceControls.length === 0)) && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center mb-2">
                          <ClipboardCheck className="h-5 w-5 text-primary-400" />
                        </div>
                        <p className="text-sm text-slate-500">{t("No linked evidences")}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          </TabsContent>

          <TabsContent value="exceptions" className="p-0">
            <div className="flex items-center justify-between px-3 sm:px-5 py-3 border-b border-slate-100">
              <p className="text-sm font-medium text-slate-700">{t("Exceptions")}</p>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-3 text-xs"
                onClick={() => {
                  setExceptionForm({ name: "", description: "", departmentId: "", endDate: undefined });
                  setExceptionFieldErrors({});
                  setIsExceptionDialogOpen(true);
                }}
              >
                <Plus className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                {t("Add Exception")}
              </Button>
            </div>
            <div className="overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow className="border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3 ps-5">{t("Exception Code")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3">{t("Name")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3">{t("Category")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3">{t("Status")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3 pe-5">{t("End Date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {control.exceptions?.map((ex) => (
                  <TableRow key={ex.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                    <TableCell className="py-3.5 ps-5 text-sm font-medium text-slate-800">{ex.exceptionCode}</TableCell>
                    <TableCell className="py-3.5 text-sm text-slate-600">{ex.name}</TableCell>
                    <TableCell className="py-3.5 text-sm text-slate-600">{ex.category}</TableCell>
                    <TableCell className="py-3.5">
                      <Badge variant="outline">{ex.status}</Badge>
                    </TableCell>
                    <TableCell className="py-3.5 pe-5 text-sm text-slate-600">{ex.endDate ? new Date(ex.endDate).toLocaleDateString() : "-"}</TableCell>
                  </TableRow>
                ))}
                {(!control.exceptions || control.exceptions.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center mb-2">
                          <AlertTriangle className="h-5 w-5 text-primary-400" />
                        </div>
                        <p className="text-sm text-slate-500">{t("No linked exceptions")}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          </TabsContent>

          <TabsContent value="risks" className="p-0">
            <div className="overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow className="border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3 ps-5">{t("Risk ID")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3">{t("Name")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3">{t("Risk Rating")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3">{t("Status")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3 pe-5">{t("Owner")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {control.controlRisks?.map((cr) => (
                  <TableRow key={cr.risk.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                    <TableCell className="py-3.5 ps-5 text-sm font-medium text-slate-800">{cr.risk.riskId}</TableCell>
                    <TableCell className="py-3.5 text-sm text-slate-600">{cr.risk.name}</TableCell>
                    <TableCell className="py-3.5">
                      <Badge className={getRiskRatingColor(cr.risk.riskRating)}>
                        {cr.risk.riskRating}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3.5">
                      <Badge variant="outline">{cr.risk.status}</Badge>
                    </TableCell>
                    <TableCell className="py-3.5 pe-5 text-sm text-slate-600">{cr.risk.owner?.fullName || "-"}</TableCell>
                  </TableRow>
                ))}
                {(!control.controlRisks || control.controlRisks.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center mb-2">
                          <Shield className="h-5 w-5 text-primary-400" />
                        </div>
                        <p className="text-sm text-slate-500">{t("No linked risks")}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Dialog with All Fields */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0 max-h-[90vh] flex flex-col">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex-shrink-0">
            <DialogTitle className="text-base font-semibold text-slate-800">{t("Edit Control")}</DialogTitle>
          </div>

          <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-5 space-y-5">
            {/* Basic Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-500">{t("Control Name")} *</Label>
                <Input
                  value={editData.name || ""}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-500">{t("Control Code")}</Label>
                <Input
                  value={editData.controlCode || ""}
                  onChange={(e) => setEditData({ ...editData, controlCode: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-500">{t("Description")}</Label>
              <Textarea
                value={editData.description || ""}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                rows={3}
                className="text-sm resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-500">{t("Control Question")}</Label>
              <Textarea
                value={editData.controlQuestion || ""}
                onChange={(e) => setEditData({ ...editData, controlQuestion: e.target.value })}
                rows={3}
                className="text-sm resize-none"
              />
            </div>

            <div className="border-t border-slate-100" />

            {/* Classification */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs font-medium text-slate-500">{t("Domain")}</Label>
                <Select
                  value={editData.domainId || control.domain?.id || ""}
                  onValueChange={(v) => setEditData({ ...editData, domainId: v })}
                >
                  <SelectTrigger className="w-full h-9 text-sm">
                    <SelectValue placeholder={t("Select domain")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="max-h-[200px] overflow-y-auto">
                    {domains.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs font-medium text-slate-500">{t("Scope")}</Label>
                <Select value={editData.scope || ""} onValueChange={(v) => setEditData({ ...editData, scope: v })}>
                  <SelectTrigger className="w-full h-9 text-sm">
                    <SelectValue placeholder={t("Select scope")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="max-h-[200px] overflow-y-auto">
                    {SCOPE_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{t(s)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs font-medium text-slate-500">{t("Relative Control Weighting")}</Label>
                <Input
                  type="number"
                  value={editData.relativeControlWeighting || ""}
                  onChange={(e) => setEditData({ ...editData, relativeControlWeighting: parseInt(e.target.value) || undefined })}
                  className="w-full h-9 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-500">{t("Functional Grouping")}</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {FUNCTIONAL_GROUPINGS.map((g) => {
                  const isSelected = editData.functionalGrouping === g;
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setEditData({ ...editData, functionalGrouping: g })}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                        isSelected
                          ? "bg-primary-50 border-primary-300 text-primary-700"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                      }`}
                    >
                      {t(g)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs font-medium text-slate-500">{t("Status")}</Label>
                <Select value={editData.status || ""} onValueChange={(v) => setEditData({ ...editData, status: v })}>
                  <SelectTrigger className="w-full h-9 text-sm">
                    <SelectValue placeholder={t("Select status")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="max-h-[200px] overflow-y-auto">
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{t(s)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs font-medium text-slate-500">{t("Entities")}</Label>
                <Select
                  value={editData.entities || "Organization Wide"}
                  onValueChange={(v) => setEditData({ ...editData, entities: v })}
                >
                  <SelectTrigger className="w-full h-9 text-sm">
                    <SelectValue placeholder={t("Select entity")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="max-h-[200px] overflow-y-auto">
                    {ENTITIES_OPTIONS.map((e) => (
                      <SelectItem key={e} value={e}>{t(e)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-500">{t("Is Control List")}</Label>
                <div className="flex items-center gap-3 h-9">
                  {["yes", "no"].map((v) => {
                    const isSelected = editData.isControlList ? v === "yes" : v === "no";
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setEditData({ ...editData, isControlList: v === "yes" })}
                        className={`px-4 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                          isSelected
                            ? "bg-primary-50 border-primary-300 text-primary-700"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {t(v === "yes" ? "Yes" : "No")}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* CMM Maturity Level Fields */}
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">{t("CMM Maturity Level Descriptions")}</p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-500">{t("Level 0 - Not Performed")}</Label>
                  <Textarea
                    value={editData.notPerformed || ""}
                    onChange={(e) => setEditData({ ...editData, notPerformed: e.target.value })}
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-500">{t("Level 1 - Performed Informally")}</Label>
                  <Textarea
                    value={editData.performedInformally || ""}
                    onChange={(e) => setEditData({ ...editData, performedInformally: e.target.value })}
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-500">{t("Level 2 - Planned and Tracked")}</Label>
                  <Textarea
                    value={editData.plannedAndTracked || ""}
                    onChange={(e) => setEditData({ ...editData, plannedAndTracked: e.target.value })}
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-500">{t("Level 3 - Well Defined")}</Label>
                  <Textarea
                    value={editData.wellDefined || ""}
                    onChange={(e) => setEditData({ ...editData, wellDefined: e.target.value })}
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-500">{t("Level 4 - Quantitatively Controlled")}</Label>
                  <Textarea
                    value={editData.quantitativelyControlled || ""}
                    onChange={(e) => setEditData({ ...editData, quantitativelyControlled: e.target.value })}
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-500">{t("Level 5 - Continuously Improving")}</Label>
                  <Textarea
                    value={editData.continuouslyImproving || ""}
                    onChange={(e) => setEditData({ ...editData, continuouslyImproving: e.target.value })}
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* Requirement Multi-Select - Chip Tags */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-500">{t("Requirement")}</Label>
              {/* Selected requirements as removable chips */}
              {editData.requirementIds && editData.requirementIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {editData.requirementIds.map((reqId) => {
                    const req = allRequirements.find(r => r.id === reqId);
                    if (!req) return null;
                    return (
                      <span
                        key={reqId}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-primary-50 text-primary-700 border border-primary-200"
                      >
                        {req.code}
                        <button
                          type="button"
                          onClick={() => setEditData({ ...editData, requirementIds: editData.requirementIds?.filter(id => id !== reqId) || [] })}
                          className="ml-0.5 hover:text-primary-900 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              {/* Searchable checkbox list */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="relative px-3 py-2 bg-slate-50 border-b border-slate-100">
                  <Search className="absolute ltr:left-5 rtl:right-5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder={t("Search requirements...")}
                    className="w-full ltr:pl-6 rtl:pr-6 text-sm bg-transparent placeholder:text-slate-400 focus:outline-none"
                    onChange={(e) => {
                      const list = e.target.closest('.border')?.querySelector('[data-req-list]');
                      if (list) {
                        const search = e.target.value.toLowerCase();
                        list.querySelectorAll('[data-req-item]').forEach((item: Element) => {
                          const text = item.textContent?.toLowerCase() || '';
                          (item as HTMLElement).style.display = text.includes(search) ? '' : 'none';
                        });
                      }
                    }}
                  />
                </div>
                <div className="max-h-36 overflow-y-auto" data-req-list>
                  {allRequirements.map((req) => {
                    const isChecked = editData.requirementIds?.includes(req.id) || false;
                    return (
                      <div
                        key={req.id}
                        data-req-item
                        className={`flex items-center gap-2.5 py-2 px-3 cursor-pointer transition-colors border-b border-slate-50 last:border-0 ${
                          isChecked ? "bg-primary-50/40" : "hover:bg-slate-50"
                        }`}
                        onClick={() => {
                          const currentIds = editData.requirementIds || [];
                          if (currentIds.includes(req.id)) {
                            setEditData({ ...editData, requirementIds: currentIds.filter(id => id !== req.id) });
                          } else {
                            setEditData({ ...editData, requirementIds: [...currentIds, req.id] });
                          }
                        }}
                      >
                        <Checkbox
                          checked={isChecked}
                          className="pointer-events-none shrink-0"
                        />
                        <span className="text-sm text-slate-700">{req.code} - {req.name}</span>
                      </div>
                    );
                  })}
                  {allRequirements.length === 0 && (
                    <p className="text-slate-400 text-sm py-4 text-center">{t("No requirements available")}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-row items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex-shrink-0">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="w-full sm:w-auto">
              {t("Cancel")}
            </Button>
            <Button onClick={handleUpdateControl} className="w-full sm:w-auto">
              {t("Save Changes")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Exception Dialog */}
      <Dialog open={isExceptionDialogOpen} onOpenChange={setIsExceptionDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[600px] p-0 gap-0 max-h-[90vh] flex flex-col">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex-shrink-0">
            <DialogTitle className="text-base font-semibold text-slate-800">{t("Add Exception")}</DialogTitle>
          </div>

          <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-5 space-y-4">
            {/* Exception Code - read only */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-500">{t("Exception Code")}</Label>
                <Input value={t("Auto-generated")} disabled className="h-9 text-sm bg-slate-50" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-500">{t("Status")}</Label>
                <Input value={t("Pending")} disabled className="h-9 text-sm bg-slate-50" />
              </div>
            </div>

            {/* Exception Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-500">{t("Exception Name")} *</Label>
              <Input
                value={exceptionForm.name}
                onChange={(e) => setExceptionForm({ ...exceptionForm, name: e.target.value })}
                placeholder={t("Enter exception name")}
                className="h-9 text-sm"
              />
              {exceptionFieldErrors.name && <p className="text-xs text-semantic-error">{exceptionFieldErrors.name}</p>}
            </div>

            {/* Category & Control info - read only */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-500">{t("Category")}</Label>
                <Input value={t("Control")} disabled className="h-9 text-sm bg-slate-50" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-500">{t("Control Code")}</Label>
                <Input value={control.controlCode} disabled className="h-9 text-sm bg-slate-50" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-500">{t("Control Name")}</Label>
                <Input value={control.name} disabled className="h-9 text-sm bg-slate-50" />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-500">{t("Description/Justification")} *</Label>
              <Textarea
                value={exceptionForm.description}
                onChange={(e) => setExceptionForm({ ...exceptionForm, description: e.target.value })}
                placeholder={t("Enter description or justification")}
                rows={3}
                className="text-sm resize-none"
              />
              {exceptionFieldErrors.description && <p className="text-xs text-semantic-error">{exceptionFieldErrors.description}</p>}
            </div>

            {/* Department & Requester */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-500">{t("Department")}</Label>
                <Select value={exceptionForm.departmentId} onValueChange={(v) => setExceptionForm({ ...exceptionForm, departmentId: v })}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder={t("Select department")} />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-500">{t("Requester")}</Label>
                <Input value={(session?.user as { fullName?: string })?.fullName || (session?.user?.name ?? "-")} disabled className="h-9 text-sm bg-slate-50" />
              </div>
            </div>

            {/* End Date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-500">{t("End Date")} *</Label>
              <DatePicker
                value={exceptionForm.endDate}
                onChange={(date) => setExceptionForm({ ...exceptionForm, endDate: date })}
                placeholder={t("Select end date")}
                className="h-9 text-sm"
              />
              {exceptionFieldErrors.endDate && <p className="text-xs text-semantic-error">{exceptionFieldErrors.endDate}</p>}
            </div>
          </div>

          <div className="flex flex-row items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex-shrink-0">
            <Button variant="outline" onClick={() => setIsExceptionDialogOpen(false)} className="w-full sm:w-auto">
              {t("Cancel")}
            </Button>
            <Button onClick={handleCreateException} disabled={exceptionSaving} className="w-full sm:w-auto">
              {exceptionSaving ? t("Saving...") : t("Create Exception")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Risk Selection Dialog */}
      <Dialog open={isRiskDialogOpen} onOpenChange={setIsRiskDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0 max-h-[90vh] flex flex-col">
          <div className="px-4 sm:px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogTitle>{t("Select Risks")}</DialogTitle>
          </div>
          <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-5">
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
              <p className="text-slate-400">{t("No risks available")}</p>
            )}
          </div>
          <div className="flex flex-row items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex-shrink-0">
            <Button variant="outline" onClick={() => setIsRiskDialogOpen(false)} className="w-full sm:w-auto">
              {t("Cancel")}
            </Button>
            <Button onClick={handleAddRisks} className="w-full sm:w-auto">
              {t("Add Selected")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
