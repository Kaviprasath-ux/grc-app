"use client";

import { useEffect, useState, use, useRef, useMemo, memo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
  Plus,
  Download,
  Upload,
  Edit2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Home,
  Search,
} from "lucide-react";
import * as XLSX from "xlsx";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedData, useTranslatedRecord, triggerTranslation } from "@/hooks/useTranslatedData";

import { FileInput } from "@/components/shared/file-input";
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
  evidences?: { id: string; evidenceId: string; evidence: { id: string; evidenceCode: string; name: string; status: string; } }[];
  policies?: { id: string; policyId: string; policy: { id: string; code: string; name: string; status: string; } }[];
  // SOA text fields
  soaPolicy?: string;
  soaEvidence?: string;
  // Gap Assessment fields
  gapCurrentState?: string;
  gapExpectedRequirement?: string;
  gapEvidence?: string;
  gapIdentified?: string;
  gapRiskLevel?: string;
  gapRecommendation?: string;
  gapOwner?: string;
  gapTargetDate?: string;
  gapStatus?: string;
  gapCompliant?: boolean;
}

// Dummy requirements data for demonstration
const dummyRequirements: Requirement[] = [
  // Category 1: Context of the Organization
  {
    id: "cat-1",
    code: "4",
    name: "Context of the Organization",
    description: "Understanding the organization and its context",
    requirementType: "Mandatory",
    chapterType: "Domain",
    level: 0,
    children: [
      {
        id: "req-4.1",
        code: "4.1",
        name: "Understanding the organization and its context",
        description: "The organization shall determine external and internal issues that are relevant to its purpose and that affect its ability to achieve the intended outcome(s) of its information security management system.",
        requirementType: "Mandatory",
        chapterType: "Domain",
        level: 1,
        parentId: "cat-1",
        applicability: "Yes",
        implementationStatus: "Yes",
        controlCompliance: "Compliant",
        evidences: [],
        policies: [],
      },
      {
        id: "req-4.2",
        code: "4.2",
        name: "Understanding the needs and expectations of interested parties",
        description: "The organization shall determine interested parties that are relevant to the information security management system and their requirements relevant to information security.",
        requirementType: "Mandatory",
        chapterType: "Domain",
        level: 1,
        parentId: "cat-1",
        applicability: "Yes",
        implementationStatus: "Ongoing",
        controlCompliance: "Partial Compliant",
        evidences: [],
        policies: [],
      },
      {
        id: "req-4.3",
        code: "4.3",
        name: "Determining the scope of the ISMS",
        description: "The organization shall determine the boundaries and applicability of the information security management system to establish its scope.",
        requirementType: "Mandatory",
        chapterType: "Domain",
        level: 1,
        parentId: "cat-1",
        applicability: "Yes",
        implementationStatus: "Yes",
        controlCompliance: "Compliant",
        evidences: [],
        policies: [],
      },
      {
        id: "req-4.4",
        code: "4.4",
        name: "Information security management system",
        description: "The organization shall establish, implement, maintain and continually improve an information security management system.",
        requirementType: "Mandatory",
        chapterType: "Domain",
        level: 1,
        parentId: "cat-1",
        applicability: "Yes",
        implementationStatus: "Ongoing",
        controlCompliance: "Partial Compliant",
        evidences: [],
        policies: [],
      },
    ],
  },
  // Category 2: Leadership
  {
    id: "cat-2",
    code: "5",
    name: "Leadership",
    description: "Leadership and commitment requirements",
    requirementType: "Mandatory",
    chapterType: "Domain",
    level: 0,
    children: [
      {
        id: "req-5.1",
        code: "5.1",
        name: "Leadership and commitment",
        description: "Top management shall demonstrate leadership and commitment with respect to the information security management system.",
        requirementType: "Mandatory",
        chapterType: "Domain",
        level: 1,
        parentId: "cat-2",
        applicability: "Yes",
        implementationStatus: "Yes",
        controlCompliance: "Compliant",
        evidences: [],
        policies: [],
      },
      {
        id: "req-5.2",
        code: "5.2",
        name: "Policy",
        description: "Top management shall establish an information security policy that is appropriate to the purpose of the organization.",
        requirementType: "Mandatory",
        chapterType: "Domain",
        level: 1,
        parentId: "cat-2",
        applicability: "Yes",
        implementationStatus: "Yes",
        controlCompliance: "Compliant",
        evidences: [],
        policies: [],
      },
      {
        id: "req-5.3",
        code: "5.3",
        name: "Organizational roles, responsibilities and authorities",
        description: "Top management shall ensure that the responsibilities and authorities for roles relevant to information security are assigned and communicated.",
        requirementType: "Mandatory",
        chapterType: "Domain",
        level: 1,
        parentId: "cat-2",
        applicability: "Yes",
        implementationStatus: "No",
        controlCompliance: "Non Compliant",
        evidences: [],
        policies: [],
      },
    ],
  },
  // Category 3: Planning
  {
    id: "cat-3",
    code: "6",
    name: "Planning",
    description: "Planning for the ISMS",
    requirementType: "Mandatory",
    chapterType: "Domain",
    level: 0,
    children: [
      {
        id: "req-6.1",
        code: "6.1",
        name: "Actions to address risks and opportunities",
        description: "When planning for the information security management system, the organization shall consider the issues and requirements and determine the risks and opportunities.",
        requirementType: "Mandatory",
        chapterType: "Domain",
        level: 1,
        parentId: "cat-3",
        applicability: "Yes",
        implementationStatus: "Ongoing",
        controlCompliance: "Partial Compliant",
        evidences: [],
        policies: [],
      },
      {
        id: "req-6.2",
        code: "6.2",
        name: "Information security objectives and planning to achieve them",
        description: "The organization shall establish information security objectives at relevant functions and levels.",
        requirementType: "Mandatory",
        chapterType: "Domain",
        level: 1,
        parentId: "cat-3",
        applicability: "Yes",
        implementationStatus: "Yes",
        controlCompliance: "Compliant",
        evidences: [],
        policies: [],
      },
      {
        id: "req-6.3",
        code: "6.3",
        name: "Planning of changes",
        description: "When the organization determines the need for changes to the information security management system, the changes shall be carried out in a planned manner.",
        requirementType: "Mandatory",
        chapterType: "Domain",
        level: 1,
        parentId: "cat-3",
        applicability: "Yes",
        implementationStatus: "No",
        controlCompliance: "Non Compliant",
        evidences: [],
        policies: [],
      },
    ],
  },
  // Category 4: Support
  {
    id: "cat-4",
    code: "7",
    name: "Support",
    description: "Support requirements for the ISMS",
    requirementType: "Mandatory",
    chapterType: "Domain",
    level: 0,
    children: [
      {
        id: "req-7.1",
        code: "7.1",
        name: "Resources",
        description: "The organization shall determine and provide the resources needed for the establishment, implementation, maintenance and continual improvement of the ISMS.",
        requirementType: "Mandatory",
        chapterType: "Domain",
        level: 1,
        parentId: "cat-4",
        applicability: "Yes",
        implementationStatus: "Yes",
        controlCompliance: "Compliant",
        evidences: [],
        policies: [],
      },
      {
        id: "req-7.2",
        code: "7.2",
        name: "Competence",
        description: "The organization shall determine the necessary competence of person(s) doing work under its control that affects its information security performance.",
        requirementType: "Mandatory",
        chapterType: "Domain",
        level: 1,
        parentId: "cat-4",
        applicability: "Yes",
        implementationStatus: "Ongoing",
        controlCompliance: "Partial Compliant",
        evidences: [],
        policies: [],
      },
      {
        id: "req-7.3",
        code: "7.3",
        name: "Awareness",
        description: "Persons doing work under the organization's control shall be aware of the information security policy and their contribution to the effectiveness of the ISMS.",
        requirementType: "Mandatory",
        chapterType: "Domain",
        level: 1,
        parentId: "cat-4",
        applicability: "Yes",
        implementationStatus: "Yes",
        controlCompliance: "Compliant",
        evidences: [],
        policies: [],
      },
      {
        id: "req-7.4",
        code: "7.4",
        name: "Communication",
        description: "The organization shall determine the need for internal and external communications relevant to the information security management system.",
        requirementType: "Mandatory",
        chapterType: "Domain",
        level: 1,
        parentId: "cat-4",
        applicability: "Yes",
        implementationStatus: "No",
        controlCompliance: "Non Compliant",
        evidences: [],
        policies: [],
      },
      {
        id: "req-7.5",
        code: "7.5",
        name: "Documented information",
        description: "The organization's information security management system shall include documented information required by this document and determined by the organization as being necessary.",
        requirementType: "Mandatory",
        chapterType: "Domain",
        level: 1,
        parentId: "cat-4",
        applicability: "Yes",
        implementationStatus: "Ongoing",
        controlCompliance: "Partial Compliant",
        evidences: [],
        policies: [],
      },
    ],
  },
  // Category 5: Operation
  {
    id: "cat-5",
    code: "8",
    name: "Operation",
    description: "Operational planning and control",
    requirementType: "Mandatory",
    chapterType: "Domain",
    level: 0,
    children: [
      {
        id: "req-8.1",
        code: "8.1",
        name: "Operational planning and control",
        description: "The organization shall plan, implement and control the processes needed to meet information security requirements.",
        requirementType: "Mandatory",
        chapterType: "Domain",
        level: 1,
        parentId: "cat-5",
        applicability: "Yes",
        implementationStatus: "Yes",
        controlCompliance: "Compliant",
        evidences: [],
        policies: [],
      },
      {
        id: "req-8.2",
        code: "8.2",
        name: "Information security risk assessment",
        description: "The organization shall perform information security risk assessments at planned intervals or when significant changes are proposed or occur.",
        requirementType: "Mandatory",
        chapterType: "Domain",
        level: 1,
        parentId: "cat-5",
        applicability: "Yes",
        implementationStatus: "Ongoing",
        controlCompliance: "Partial Compliant",
        evidences: [],
        policies: [],
      },
      {
        id: "req-8.3",
        code: "8.3",
        name: "Information security risk treatment",
        description: "The organization shall implement the information security risk treatment plan.",
        requirementType: "Mandatory",
        chapterType: "Domain",
        level: 1,
        parentId: "cat-5",
        applicability: "Yes",
        implementationStatus: "Ongoing",
        controlCompliance: "Partial Compliant",
        evidences: [],
        policies: [],
      },
    ],
  },
  // Category 6: Performance Evaluation
  {
    id: "cat-6",
    code: "9",
    name: "Performance Evaluation",
    description: "Monitoring, measurement, analysis and evaluation",
    requirementType: "Mandatory",
    chapterType: "Domain",
    level: 0,
    children: [
      {
        id: "req-9.1",
        code: "9.1",
        name: "Monitoring, measurement, analysis and evaluation",
        description: "The organization shall determine what needs to be monitored and measured, including information security processes and controls.",
        requirementType: "Mandatory",
        chapterType: "Domain",
        level: 1,
        parentId: "cat-6",
        applicability: "Yes",
        implementationStatus: "Ongoing",
        controlCompliance: "Partial Compliant",
        evidences: [],
        policies: [],
      },
      {
        id: "req-9.2",
        code: "9.2",
        name: "Internal audit",
        description: "The organization shall conduct internal audits at planned intervals to provide information on whether the ISMS conforms to requirements.",
        requirementType: "Mandatory",
        chapterType: "Domain",
        level: 1,
        parentId: "cat-6",
        applicability: "Yes",
        implementationStatus: "Yes",
        controlCompliance: "Compliant",
        evidences: [],
        policies: [],
      },
      {
        id: "req-9.3",
        code: "9.3",
        name: "Management review",
        description: "Top management shall review the organization's information security management system at planned intervals.",
        requirementType: "Mandatory",
        chapterType: "Domain",
        level: 1,
        parentId: "cat-6",
        applicability: "Yes",
        implementationStatus: "Yes",
        controlCompliance: "Compliant",
        evidences: [],
        policies: [],
      },
    ],
  },
  // Category 7: Improvement
  {
    id: "cat-7",
    code: "10",
    name: "Improvement",
    description: "Continual improvement",
    requirementType: "Mandatory",
    chapterType: "Domain",
    level: 0,
    children: [
      {
        id: "req-10.1",
        code: "10.1",
        name: "Continual improvement",
        description: "The organization shall continually improve the suitability, adequacy and effectiveness of the information security management system.",
        requirementType: "Mandatory",
        chapterType: "Domain",
        level: 1,
        parentId: "cat-7",
        applicability: "Yes",
        implementationStatus: "Ongoing",
        controlCompliance: "Partial Compliant",
        evidences: [],
        policies: [],
      },
      {
        id: "req-10.2",
        code: "10.2",
        name: "Nonconformity and corrective action",
        description: "When a nonconformity occurs, the organization shall react to the nonconformity and take action to control and correct it.",
        requirementType: "Mandatory",
        chapterType: "Domain",
        level: 1,
        parentId: "cat-7",
        applicability: "Yes",
        implementationStatus: "Yes",
        controlCompliance: "Compliant",
        evidences: [],
        policies: [],
      },
    ],
  },
];

// Flatten requirements for SOA tab
const flattenRequirements = (requirements: Requirement[]): Requirement[] => {
  const flat: Requirement[] = [];
  const flatten = (reqs: Requirement[]) => {
    for (const req of reqs) {
      flat.push(req);
      if (req.children && req.children.length > 0) {
        flatten(req.children);
      }
    }
  };
  flatten(requirements);
  return flat;
};

// Memoized SOA Row Component to prevent re-renders
interface SOARowProps {
  req: Requirement;
  disabled: boolean;
  onApplicabilityChange: (id: string, value: string) => void;
  onJustificationChange: (id: string, value: string) => void;
  onImplementationChange: (id: string, value: string) => void;
  onPolicyChange: (id: string, value: string) => void;
  onEvidenceChange: (id: string, value: string) => void;
  t: (key: string) => string;
  translatedName?: string;
}

const SOARow = memo(function SOARow({
  req,
  disabled,
  onApplicabilityChange,
  onJustificationChange,
  onImplementationChange,
  onPolicyChange,
  onEvidenceChange,
  t,
  translatedName,
}: SOARowProps) {
  return (
    <TableRow className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
      <TableCell className="py-3 text-sm font-medium text-slate-800 w-16">{req.code}</TableCell>
      <TableCell className="py-3 text-sm text-slate-700 w-64 truncate">
        {translatedName || req.name}
      </TableCell>
      <TableCell className="py-3 w-36">
        <input
          type="text"
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-slate-50 disabled:cursor-not-allowed"
          defaultValue={req.soaPolicy ?? ""}
          onBlur={(e) => onPolicyChange(req.id, e.target.value)}
          placeholder={t("Enter policy")}
          disabled={disabled}
        />
      </TableCell>
      <TableCell className="py-3 w-36">
        <input
          type="text"
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-slate-50 disabled:cursor-not-allowed"
          defaultValue={req.soaEvidence ?? ""}
          onBlur={(e) => onEvidenceChange(req.id, e.target.value)}
          placeholder={t("Enter evidence")}
          disabled={disabled}
        />
      </TableCell>
      <TableCell className="py-3 w-28">
        <Select
          defaultValue={req.applicability ?? undefined}
          onValueChange={(value) => onApplicabilityChange(req.id, value)}
          disabled={disabled}
        >
          <SelectTrigger className="w-24 bg-white">
            <SelectValue placeholder="-" />
          </SelectTrigger>
          <SelectContent className="bg-white z-50">
            <SelectItem value="Yes">{t("Yes")}</SelectItem>
            <SelectItem value="No">{t("No")}</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="py-3 w-44">
        <input
          type="text"
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-slate-50 disabled:cursor-not-allowed"
          defaultValue={req.justification ?? ""}
          onBlur={(e) => onJustificationChange(req.id, e.target.value)}
          placeholder={t("Enter justification")}
          disabled={disabled}
        />
      </TableCell>
      <TableCell className="py-3 w-36">
        <Select
          defaultValue={req.implementationStatus ?? undefined}
          onValueChange={(value) => onImplementationChange(req.id, value)}
          disabled={disabled}
        >
          <SelectTrigger className="w-28 bg-white">
            <SelectValue placeholder="-" />
          </SelectTrigger>
          <SelectContent className="bg-white z-50">
            <SelectItem value="Yes">{t("Yes")}</SelectItem>
            <SelectItem value="No">{t("No")}</SelectItem>
            <SelectItem value="Ongoing">{t("Ongoing")}</SelectItem>
            <SelectItem value="N/A">{t("N/A")}</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="py-3 w-32">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            req.controlCompliance === "Compliant"
              ? "bg-success-light text-semantic-success-dark"
              : req.controlCompliance === "Partial Compliant"
              ? "bg-warning-light text-warning-dark"
              : "bg-error-light text-semantic-error"
          }`}
        >
          {t(req.controlCompliance || "Non Compliant")}
        </span>
      </TableCell>
    </TableRow>
  );
});

export default function FrameworkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [framework, setFramework] = useState<Framework | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("requirements");

  // Dialogs
  const [isAddRequirementOpen, setIsAddRequirementOpen] = useState(false);
  const [isUpdateRequirementOpen, setIsUpdateRequirementOpen] = useState(false);
  const [isAddExceptionOpen, setIsAddExceptionOpen] = useState(false);
  const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null);

  // Update Requirement form
  const [updateRequirement, setUpdateRequirement] = useState({
    id: "",
    name: "",
    code: "",
    description: "",
    requirementType: "Mandatory",
    chapterType: "Domain",
    applicability: "",
    implementationStatus: "",
    controlCompliance: "",
  });

  // Import Requirements
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importName, setImportName] = useState("");
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New Requirement form
  const [newRequirement, setNewRequirement] = useState({
    name: "",
    category: "",
    code: "",
    description: "",
    requirementType: "Mandatory",
    chapterType: "Domain",
  });
  const [reqErrors, setReqErrors] = useState<Record<string, string>>({});

  // Exception form
  const [newException, setNewException] = useState({
    name: "",
    description: "",
    status: "Pending",
    endDate: "",
  });
  const [excErrors, setExcErrors] = useState<Record<string, string>>({});

  // SOA Pagination
  const [soaPage, setSoaPage] = useState(0);
  const SOA_PAGE_SIZE = 20;

  // SOA Local Edits - track changes before saving
  const [soaEdits, setSoaEdits] = useState<Record<string, { applicability?: string; justification?: string; implementationStatus?: string; soaPolicy?: string; soaEvidence?: string }>>({});
  const [soaSaving, setSoaSaving] = useState(false);

  // Gap Assessment state
  const [gapExpandedCats, setGapExpandedCats] = useState<string[]>([]);
  const [gapSearch, setGapSearch] = useState("");
  const [gapSaving, setGapSaving] = useState(false);
  const [gapEdits, setGapEdits] = useState<Record<string, Record<string, string | boolean>>>({});
  const [gapPolicyDialogOpen, setGapPolicyDialogOpen] = useState(false);
  const [gapPolicyReqId, setGapPolicyReqId] = useState<string | null>(null);
  const [gapPolicySearch, setGapPolicySearch] = useState("");
  const [gapSelectedPolicyIds, setGapSelectedPolicyIds] = useState<string[]>([]);
  const [allGapPolicies, setAllGapPolicies] = useState<{ id: string; code: string; name: string; status: string }[]>([]);
  const [gapPoliciesLoading, setGapPoliciesLoading] = useState(false);
  const [gapOwnerDialogOpen, setGapOwnerDialogOpen] = useState(false);
  const [gapOwnerReqId, setGapOwnerReqId] = useState<string | null>(null);
  const [gapOwnerDeptId, setGapOwnerDeptId] = useState("");
  const [gapOwnerUserId, setGapOwnerUserId] = useState("");
  const [gapDeptUsers, setGapDeptUsers] = useState<{ deptId: string; deptName: string; users: { id: string; fullName: string }[] }[]>([]);

  // Audit Logs state
  interface AuditLogEntry {
    id: string;
    changeType: string;
    entityType: string;
    entityId: string;
    userId?: string;
    userName?: string;
    changes?: string;
    createdAt: string;
  }
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const [auditLogSearch, setAuditLogSearch] = useState("");
  const [auditLogActionFilter, setAuditLogActionFilter] = useState("all");
  const [auditLogPage, setAuditLogPage] = useState(0);
  const AUDIT_LOG_PAGE_SIZE = 10;

  // Dynamic data translation hooks
  const { data: translatedFramework } = useTranslatedRecord(framework, { modelName: 'QPostFramework' });

  // Flatten all requirements for translation
  const allRequirements = useMemo(() => framework?.requirements || [], [framework?.requirements]);
  const { data: translatedRequirements } = useTranslatedData(allRequirements, { modelName: 'QPostRequirement' });

  // Translate categories
  const allCategories = useMemo(() => framework?.requirementCategories || [], [framework?.requirementCategories]);
  const { data: translatedCategories } = useTranslatedData(allCategories, { modelName: 'QPostRequirementCategory' });

  // Lookup helpers
  const tReq = useCallback((reqId: string, fallback: string) => {
    return translatedRequirements.find(r => r.id === reqId)?.name || fallback;
  }, [translatedRequirements]);

  const tReqDesc = useCallback((reqId: string, fallback: string) => {
    return translatedRequirements.find(r => r.id === reqId)?.description || fallback;
  }, [translatedRequirements]);

  const tCat = useCallback((catId: string, fallback: string) => {
    return translatedCategories.find(c => c.id === catId)?.name || fallback;
  }, [translatedCategories]);

  useEffect(() => {
    fetchFramework();
  }, [id]);

  // Fetch audit logs when tab is activated
  useEffect(() => {
    if (activeTab === "audit-logs" && auditLogs.length === 0) {
      fetchAuditLogs();
    }
  }, [activeTab]);

  const fetchAuditLogs = async () => {
    setAuditLogsLoading(true);
    try {
      const res = await fetch(`/api/audit-logs?limit=1000&offset=0&search=${encodeURIComponent(framework?.name || "")}`);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setAuditLogsLoading(false);
    }
  };

  const filteredAuditLogs = useMemo(() => {
    let logs = auditLogs;
    if (auditLogSearch) {
      const search = auditLogSearch.toLowerCase();
      logs = logs.filter(
        (log) =>
          (log.userName || "").toLowerCase().includes(search) ||
          log.changeType.toLowerCase().includes(search) ||
          log.entityType.toLowerCase().includes(search) ||
          (log.changes || "").toLowerCase().includes(search)
      );
    }
    if (auditLogActionFilter !== "all") {
      logs = logs.filter((log) => log.changeType === auditLogActionFilter);
    }
    return logs;
  }, [auditLogs, auditLogSearch, auditLogActionFilter]);

  const auditLogActions = useMemo(() => {
    const actions = new Set(auditLogs.map((log) => log.changeType));
    return Array.from(actions).sort();
  }, [auditLogs]);

  const formatAuditLogDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, "0");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${day} ${month} ${year}, ${displayHours}:${minutes} ${ampm}`;
  };

  const parseChangesDetails = (changes: string | undefined): string => {
    if (!changes) return "-";
    try {
      const parsed = JSON.parse(changes);
      if (Array.isArray(parsed)) {
        return parsed.map((c: { field?: string; oldValue?: string; newValue?: string }) =>
          `${c.field || ""}: ${c.oldValue || "(empty)"} → ${c.newValue || "(empty)"}`
        ).join("; ");
      }
      if (typeof parsed === "object") {
        return Object.entries(parsed)
          .map(([key, val]) => `${key}: ${val}`)
          .join("; ");
      }
      return String(parsed);
    } catch {
      return changes;
    }
  };

  const handleExportAuditLogs = () => {
    if (filteredAuditLogs.length === 0) {
      toast({ title: t("No audit logs available to export"), variant: "destructive" });
      return;
    }

    try {
      const exportData = filteredAuditLogs.map((log) => ({
        "User": log.userName || "-",
        "Action": log.changeType,
        "Target": log.entityType,
        "Details": parseChangesDetails(log.changes),
        "Date & Time": formatAuditLogDate(log.createdAt),
      }));

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      worksheet["!cols"] = [
        { wch: 20 },
        { wch: 15 },
        { wch: 25 },
        { wch: 50 },
        { wch: 25 },
      ];
      XLSX.utils.book_append_sheet(workbook, worksheet, "Audit Logs");

      const frameworkName = (framework?.name || "Framework").replace(/[^a-zA-Z0-9]/g, "_");
      const dateStr = new Date().toISOString().split("T")[0].replace(/-/g, "");
      XLSX.writeFile(workbook, `Framework_AuditLogs_${frameworkName}_${dateStr}.xlsx`);

      toast({ title: t("Exported"), description: t("Audit logs exported successfully") });
    } catch (error) {
      console.error("Export error:", error);
      toast({ title: t("Error"), description: t("Failed to export audit logs"), variant: "destructive" });
    }
  };

  const fetchFramework = async () => {
    try {
      const response = await fetch(`/api/qpost-compliance/frameworks/${id}`);
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

  // Build requirement hierarchy by grouping requirements by category
  const buildHierarchy = (requirements: Requirement[]): Requirement[] => {
    // If framework has requirement categories, group requirements by category
    if (framework?.requirementCategories && framework.requirementCategories.length > 0) {
      const categoryMap = new Map<string, Requirement>();

      // Create category entries
      framework.requirementCategories.forEach((cat) => {
        categoryMap.set(cat.id, {
          id: cat.id,
          code: cat.code || "",
          name: cat.name,
          description: "",
          requirementType: "Mandatory",
          chapterType: "Domain",
          level: 0,
          children: [],
        });
      });

      // Add requirements to their categories
      requirements.forEach((req) => {
        if (req.categoryId && categoryMap.has(req.categoryId)) {
          const category = categoryMap.get(req.categoryId)!;
          category.children!.push({
            ...req,
            level: 1,
            parentId: req.categoryId,
          });
        }
      });

      // Return only categories that have children, sorted by sortOrder
      return Array.from(categoryMap.values())
        .filter((cat) => cat.children && cat.children.length > 0)
        .sort((a, b) => {
          const catA = framework.requirementCategories.find((c) => c.id === a.id);
          const catB = framework.requirementCategories.find((c) => c.id === b.id);
          return (catA?.sortOrder || 0) - (catB?.sortOrder || 0);
        });
    }

    // Fallback: build hierarchy based on parentId
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
    const errors: Record<string, string> = {};
    if (!newRequirement.name.trim()) errors.name = t("Control name should not be empty.");
    if (!newRequirement.category.trim()) errors.category = t("Control category should not be empty.");
    if (!newRequirement.code.trim()) errors.code = t("Control code should not be empty.");
    if (Object.keys(errors).length > 0) {
      setReqErrors(errors);
      return;
    }
    setReqErrors({});
    try {
      const response = await fetch("/api/qpost-compliance/requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newRequirement,
          frameworkId: id,
        }),
      });

      if (response.ok) {
        const savedReq = await response.json();
        setIsAddRequirementOpen(false);
        setNewRequirement({
          name: "",
          category: "",
          code: "",
          description: "",
          requirementType: "Mandatory",
          chapterType: "Domain",
        });
        setReqErrors({});
        fetchFramework();
        triggerTranslation('Requirement', savedReq.id, {
          name: newRequirement.name.trim(),
          description: newRequirement.description.trim(),
        });
      }
    } catch (error) {
      console.error("Error adding requirement:", error);
    }
  };

  const handleOpenUpdateRequirement = (requirement: Requirement) => {
    setUpdateRequirement({
      id: requirement.id,
      name: tReq(requirement.id, requirement.name),
      code: requirement.code,
      description: tReqDesc(requirement.id, requirement.description || ""),
      requirementType: requirement.requirementType || "Mandatory",
      chapterType: requirement.chapterType || "Domain",
      applicability: requirement.applicability || "",
      implementationStatus: requirement.implementationStatus || "",
      controlCompliance: requirement.controlCompliance || "",
    });
    setIsUpdateRequirementOpen(true);
  };

  const handleUpdateRequirement = async () => {
    try {
      const response = await fetch(`/api/qpost-compliance/requirements/${updateRequirement.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: updateRequirement.name,
          code: updateRequirement.code,
          description: updateRequirement.description,
          requirementType: updateRequirement.requirementType,
          chapterType: updateRequirement.chapterType,
          applicability: updateRequirement.applicability,
          implementationStatus: updateRequirement.implementationStatus,
          controlCompliance: updateRequirement.controlCompliance,
        }),
      });

      if (response.ok) {
        setIsUpdateRequirementOpen(false);
        const reqId = updateRequirement.id;
        const reqName = updateRequirement.name;
        const reqDesc = updateRequirement.description;
        setUpdateRequirement({
          id: "",
          name: "",
          code: "",
          description: "",
          requirementType: "Mandatory",
          chapterType: "Domain",
          applicability: "",
          implementationStatus: "",
          controlCompliance: "",
        });
        fetchFramework();
        triggerTranslation('Requirement', reqId, {
          name: reqName,
          description: reqDesc,
        });
      }
    } catch (error) {
      console.error("Error updating requirement:", error);
    }
  };

  const handleExportRequirements = () => {
    if (!framework) return;

    const requirements = framework.requirements || [];

    // Create CSV content
    const headers = [
      "Code",
      "Name",
      "Description",
      "Category",
      "Applicability",
      "Implementation Status",
      "Control Compliance",
      "Evidences",
      "Policies",
    ];

    const rows = requirements.map((req) => {
      const evidenceCount = req.evidences?.length || 0;
      const policyCount = req.policies?.length || 0;

      return [
        req.code,
        req.name,
        req.description?.replace(/"/g, '""') || "",
        req.category?.name || "",
        req.applicability || "",
        req.implementationStatus || "",
        req.controlCompliance || "",
        String(evidenceCount),
        String(policyCount),
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    // Download the file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `${framework.name}-requirements-${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadTemplate = () => {
    const template = "Requirement Code,Requirement Name,Description,Category\n";
    const blob = new Blob([template], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "requirements-template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImportFile(e.target.files[0]);
    }
  };

  const handleImportRequirements = async () => {
    if (!importFile || !framework) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("frameworkId", framework.id);

      const response = await fetch("/api/qpost-compliance/requirements/import", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setIsImportOpen(false);
        setImportFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        fetchFramework();
      } else {
        const error = await response.json();
        console.error("Import error:", error);
        toast({ title: t("Error"), description: t("Failed to import controls. Please check the file format."), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error importing requirements:", error);
      toast({ title: t("Error"), description: t("Failed to import controls. Please try again."), variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handleAddException = async () => {
    const errors: Record<string, string> = {};
    if (!newException.name.trim()) errors.name = t("Please enter the exception name");
    if (!newException.description.trim()) errors.description = t("Please enter the reason for exception");
    if (!newException.endDate) errors.endDate = t("Please select the enddate");
    if (Object.keys(errors).length > 0) {
      setExcErrors(errors);
      return;
    }
    setExcErrors({});
    if (!selectedRequirement) return;

    try {
      // Generate exception code
      const response = await fetch("/api/qpost-compliance/exceptions", {
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
        const excData = await response.json();
        setIsAddExceptionOpen(false);
        const excName = newException.name.trim();
        const excDesc = newException.description.trim();
        setNewException({
          name: "",
          description: "",
          status: "Pending",
          endDate: "",
        });
        setExcErrors({});
        setSelectedRequirement(null);
        triggerTranslation('QPostException', excData.id, {
          name: excName,
          description: excDesc,
        });
      }
    } catch (error) {
      console.error("Error adding exception:", error);
    }
  };

  // Track local SOA changes with useCallback to prevent re-renders
  const handleApplicabilityChange = useCallback((requirementId: string, value: string) => {
    setSoaEdits((prev) => ({
      ...prev,
      [requirementId]: {
        ...prev[requirementId],
        applicability: value,
      },
    }));
  }, []);

  const handleJustificationChange = useCallback((requirementId: string, value: string) => {
    setSoaEdits((prev) => ({
      ...prev,
      [requirementId]: {
        ...prev[requirementId],
        justification: value,
      },
    }));
  }, []);

  const handleImplementationChange = useCallback((requirementId: string, value: string) => {
    setSoaEdits((prev) => ({
      ...prev,
      [requirementId]: {
        ...prev[requirementId],
        implementationStatus: value,
      },
    }));
  }, []);

  const handlePolicyChange = useCallback((requirementId: string, value: string) => {
    setSoaEdits((prev) => ({
      ...prev,
      [requirementId]: {
        ...prev[requirementId],
        soaPolicy: value,
      },
    }));
  }, []);

  const handleEvidenceChange = useCallback((requirementId: string, value: string) => {
    setSoaEdits((prev) => ({
      ...prev,
      [requirementId]: {
        ...prev[requirementId],
        soaEvidence: value,
      },
    }));
  }, []);

  // Save all SOA changes to the server
  const handleSaveSOA = async () => {
    if (Object.keys(soaEdits).length === 0) {
      toast({ title: t("No changes"), description: t("No changes to save.") });
      return;
    }

    setSoaSaving(true);
    try {
      const updatePromises = Object.entries(soaEdits).map(([requirementId, changes]) =>
        fetch(`/api/qpost-compliance/requirements/${requirementId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(changes),
        })
      );

      const results = await Promise.all(updatePromises);
      const allSuccess = results.every((res) => res.ok);

      if (allSuccess) {
        toast({ title: t("Success"), description: t("SOA changes saved successfully.") });
        setSoaEdits({});
        fetchFramework();
      } else {
        toast({ title: t("Error"), description: t("Some changes failed to save."), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error saving SOA:", error);
      toast({ title: t("Error"), description: t("Failed to save SOA changes."), variant: "destructive" });
    } finally {
      setSoaSaving(false);
    }
  };

  // Download SOA Report as CSV
  const handleDownloadSOAReport = () => {
    if (!framework) return;

    const requirements = framework.requirements && framework.requirements.length > 0
      ? framework.requirements
      : [];

    // Create CSV content
    const headers = [
      "Code",
      "Control",
      "Policy",
      "Evidence",
      "Applicability",
      "Justification",
      "Implementation Status",
      "Control Compliance",
    ];

    const rows = requirements.map((req) => {
      // Use edited values if available
      const applicability = soaEdits[req.id]?.applicability ?? req.applicability ?? "";
      const justification = soaEdits[req.id]?.justification ?? req.justification ?? "";
      const implementationStatus = soaEdits[req.id]?.implementationStatus ?? req.implementationStatus ?? "";
      const policy = soaEdits[req.id]?.soaPolicy ?? req.soaPolicy ?? "";
      const evidence = soaEdits[req.id]?.soaEvidence ?? req.soaEvidence ?? "";

      return [
        req.code,
        req.name.replace(/"/g, '""'),
        policy.replace(/"/g, '""'),
        evidence.replace(/"/g, '""'),
        applicability,
        justification.replace(/"/g, '""'),
        implementationStatus,
        req.controlCompliance || "Non Compliant",
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    // Download the file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `${framework.name}-SOA-${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Check if there are unsaved SOA changes
  const hasUnsavedSOAChanges = Object.keys(soaEdits).length > 0;

  // ---------------------------------------------------------------------------
  // Gap Assessment handlers
  // ---------------------------------------------------------------------------

  const hasUnsavedGapChanges = Object.keys(gapEdits).length > 0;

  const handleGapEdit = (requirementId: string, field: string, value: string | boolean) => {
    setGapEdits(prev => ({
      ...prev,
      [requirementId]: { ...(prev[requirementId] || {}), [field]: value },
    }));
  };

  const getGapValue = (req: Requirement, field: string) => {
    const edited = gapEdits[req.id]?.[field];
    if (edited !== undefined) return edited;
    return (req as unknown as Record<string, unknown>)[field] ?? "";
  };

  const handleSaveGap = async () => {
    if (!hasUnsavedGapChanges) return;
    setGapSaving(true);
    try {
      const updates = Object.entries(gapEdits).map(([reqId, changes]) =>
        fetch(`/api/qpost-compliance/requirements/${reqId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(changes),
        })
      );
      const results = await Promise.all(updates);
      const allOk = results.every(r => r.ok);
      if (allOk) {
        toast({ title: t("Success"), description: t("Gap assessment saved successfully") });
        setGapEdits({});
        fetchFramework();
      } else {
        toast({ title: t("Error"), description: t("Some changes failed to save"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to save gap assessment"), variant: "destructive" });
    } finally {
      setGapSaving(false);
    }
  };

  const fetchGapPolicies = async () => {
    setGapPoliciesLoading(true);
    try {
      const res = await fetch("/api/qpost-compliance/policies?limit=500");
      if (res.ok) {
        const data = await res.json();
        setAllGapPolicies((data.data || []).map((p: { id: string; code: string; name: string; status: string }) => ({ id: p.id, code: p.code, name: p.name, status: p.status })));
      }
    } catch { /* ignore */ }
    finally { setGapPoliciesLoading(false); }
  };

  const fetchGapDeptUsers = async () => {
    try {
      const deptRes = await fetch("/api/departments");
      if (!deptRes.ok) return;
      const depts = await deptRes.json();
      const deptList = Array.isArray(depts) ? depts : depts.data || [];
      const result: { deptId: string; deptName: string; users: { id: string; fullName: string }[] }[] = [];
      for (const dept of deptList) {
        const uRes = await fetch(`/api/users?departmentId=${dept.id}`);
        if (uRes.ok) {
          const uData = await uRes.json();
          const users = Array.isArray(uData) ? uData : uData.data || [];
          result.push({ deptId: dept.id, deptName: dept.name, users: users.map((u: { id: string; fullName: string }) => ({ id: u.id, fullName: u.fullName })) });
        }
      }
      setGapDeptUsers(result);
    } catch { /* ignore */ }
  };

  const openGapPolicyDialog = (reqId: string) => {
    setGapPolicyReqId(reqId);
    setGapPolicySearch("");
    const req = flatRequirements.find(r => r.id === reqId);
    const linkedIds = req?.policies?.map(p => p.policy.id) || [];
    setGapSelectedPolicyIds(linkedIds);
    if (allGapPolicies.length === 0) fetchGapPolicies();
    setGapPolicyDialogOpen(true);
  };

  const handleSaveGapPolicies = async () => {
    if (!gapPolicyReqId) return;
    const req = flatRequirements.find(r => r.id === gapPolicyReqId);
    const currentIds = req?.policies?.map(p => p.policy.id) || [];
    const toAdd = gapSelectedPolicyIds.filter(id => !currentIds.includes(id));
    const toRemove = currentIds.filter(id => !gapSelectedPolicyIds.includes(id));

    try {
      for (const policyId of toAdd) {
        await fetch(`/api/qpost-compliance/requirements/${gapPolicyReqId}/policies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ policyId }),
        });
      }
      for (const policyId of toRemove) {
        await fetch(`/api/qpost-compliance/requirements/${gapPolicyReqId}/policies?policyId=${policyId}`, { method: "DELETE" });
      }
      toast({ title: t("Success"), description: t("Policies updated") });
      setGapPolicyDialogOpen(false);
      fetchFramework();
    } catch {
      toast({ title: t("Error"), description: t("Failed to update policies"), variant: "destructive" });
    }
  };

  const handleExportGap = () => {
    if (!framework) return;
    const reqs = flatRequirements;
    const rows = reqs.map(req => ({
      [t("Control ID")]: req.code,
      [t("Framework")]: framework.name,
      [t("Description")]: req.description || req.name,
      [t("Current State")]: (getGapValue(req, "gapCurrentState") as string) || "",
      [t("Expected Requirement")]: (getGapValue(req, "gapExpectedRequirement") as string) || "",
      [t("Linked Policies")]: req.policies?.map(p => p.policy.name).join(", ") || "",
      [t("Evidence")]: (getGapValue(req, "gapEvidence") as string) || "",
      [t("Gap Identified")]: (getGapValue(req, "gapIdentified") as string) || "",
      [t("Risk Level")]: (getGapValue(req, "gapRiskLevel") as string) || "",
      [t("Recommendation")]: (getGapValue(req, "gapRecommendation") as string) || "",
      [t("Owner")]: ((getGapValue(req, "gapOwner") as string) || "").split(":")[2] || "",
      [t("Target Date")]: (getGapValue(req, "gapTargetDate") as string) || "",
      [t("Status")]: (getGapValue(req, "gapStatus") as string) || "",
      [t("Compliant")]: getGapValue(req, "gapCompliant") ? t("Yes") : t("No"),
    }));
    import("xlsx").then(XLSX => {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Gap Assessment");
      XLSX.writeFile(wb, `${framework.name}-Gap-Assessment-${new Date().toISOString().split("T")[0]}.xlsx`);
    });
  };

  // Use dummy data if no requirements from API - memoized for stable references
  // MUST be called unconditionally (before any early return) to follow Rules of Hooks
  const hasApiRequirements = useMemo(() => {
    return framework?.requirements && framework.requirements.length > 0;
  }, [framework?.requirements]);

  const requirementsToUse = useMemo(() => {
    return hasApiRequirements && framework ? framework.requirements : [];
  }, [hasApiRequirements, framework?.requirements]);

  const requirementHierarchy = useMemo(() => {
    return hasApiRequirements && framework
      ? buildHierarchy(requirementsToUse)
      : [];
  }, [hasApiRequirements, requirementsToUse, framework]);

  const filteredHierarchy = filterRequirements(requirementHierarchy);

  const flatRequirements = useMemo(() => {
    return hasApiRequirements && framework
      ? requirementsToUse
      : [];
  }, [hasApiRequirements, requirementsToUse, framework]);

  const soaTotalPages = Math.ceil(flatRequirements.length / SOA_PAGE_SIZE);
  const soaStartIndex = soaPage * SOA_PAGE_SIZE;
  const soaEndIndex = Math.min(soaStartIndex + SOA_PAGE_SIZE, flatRequirements.length);

  const soaRequirements = useMemo(() => {
    return flatRequirements.slice(soaStartIndex, soaEndIndex);
  }, [flatRequirements, soaStartIndex, soaEndIndex]);

  // Gap Assessment: group requirements by category (must be after flatRequirements)
  const gapCategories = useMemo(() => {
    if (!framework?.requirementCategories || !framework?.requirements) return [];
    const search = gapSearch.toLowerCase();
    return framework.requirementCategories.map(cat => {
      const reqs = flatRequirements.filter(r => r.categoryId === cat.id && r.level >= 2 && (!search || r.code.toLowerCase().includes(search) || r.name.toLowerCase().includes(search)));
      return { ...cat, requirements: reqs };
    }).filter(c => c.requirements.length > 0);
  }, [framework?.requirementCategories, framework?.requirements, flatRequirements, gapSearch]);

  const toggleGapCat = (catId: string) => {
    setGapExpandedCats(prev => prev.includes(catId) ? prev.filter(c => c !== catId) : [...prev, catId]);
  };

  const gapEffectiveExpanded = gapExpandedCats.length === 0 ? gapCategories.map(c => c.id) : gapExpandedCats;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
            <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-sm text-slate-500 font-medium">{t("Loading framework...")}</p>
        </div>
      </div>
    );
  }

  if (!framework) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-800">{t("Framework not found")}</p>
          <p className="text-sm text-slate-500 mt-1">{t("The requested framework could not be loaded.")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Compliance")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/qpost-compliance/framework" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Frameworks")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{translatedFramework?.name || framework.name}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{translatedFramework?.name || framework.name}</h1>
        <p className="text-sm text-slate-500">{t("Manage framework controls")}</p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="requirements">{t("All Controls")}</TabsTrigger>
            <TabsTrigger value="soa">{t("SOA")}</TabsTrigger>
            <TabsTrigger value="gap-assessment">{t("Gap Assessment")}</TabsTrigger>
            <TabsTrigger value="audit-logs">{t("Audit Logs")}</TabsTrigger>
          </TabsList>
        </div>

        {/* Requirements Tab */}
        <TabsContent value="requirements" className="mt-6">
          {/* Header with actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <Input
              placeholder={t("Search by control code, name...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:max-w-sm bg-white"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportRequirements}>
                <Download className="h-4 w-4 me-2" />
                {t("Export")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsImportOpen(true)}
              >
                <Upload className="h-4 w-4 me-2" />
                {t("Import")}
              </Button>
              <Button size="sm" onClick={() => setIsAddRequirementOpen(true)}>
                <Plus className="h-4 w-4 me-2" />
                {t("New Control")}
              </Button>
            </div>
          </div>

          {/* Requirements Accordion */}
          <div className="bg-white rounded-xl border border-slate-200">
            <Accordion type="multiple" className="w-full">
              {filteredHierarchy.map((category) => (
                <AccordionItem key={category.id} value={category.id}>
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{tCat(category.id, category.name)}</span>
                      <span className="text-slate-400 text-sm">
                        {category.children?.length || 0} {t("items")}
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
                              {requirement.code} - {tReq(requirement.id, requirement.name)}
                            </span>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-4">
                            {/* Requirement Description */}
                            <div className="flex items-start justify-between p-4 bg-muted/50 rounded-lg">
                              <p className="text-sm flex-1">
                                {tReqDesc(requirement.id, requirement.description || "") || t("No description")}
                              </p>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenUpdateRequirement(requirement)}
                              >
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
                                <AlertTriangle className="h-4 w-4 me-2" />
                                {t("Add Exception")}
                              </Button>
                            </div>

                            {/* Linked Evidences & Policies Summary */}
                            <div className="flex items-center gap-3 mt-2">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                {t("Evidences")}: {requirement.evidences?.length || 0}
                              </span>
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                                {t("Policies")}: {requirement.policies?.length || 0}
                              </span>
                            </div>
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
        <TabsContent value="soa" className="mt-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-800">{t("Statement of Applicability")}</h3>
            {hasUnsavedSOAChanges && (
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                {t("Unsaved changes")}
              </span>
            )}
          </div>

          {/* Sample data notice */}
          {!hasApiRequirements && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <p className="text-sm text-amber-700">
                {t("This framework has no controls. Import controls to enable SOA editing.")}
              </p>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
            <Table className="table-fixed w-full min-w-[1000px]">
              <TableHeader>
                <TableRow className="border-b border-slate-100 bg-slate-50/50">
                  <TableHead className="text-xs font-semibold text-slate-600 py-3 w-16">{t("Code")}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 py-3 w-64">{t("Control")}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 py-3 w-36">{t("Policy")}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 py-3 w-36">{t("Evidence")}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 py-3 w-28">{t("Applicability")}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 py-3 w-44">{t("Justification")}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 py-3 w-36">{t("Implementation Status")}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 py-3 w-32">{t("Control Compliance")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {soaRequirements.map((req) => (
                  <SOARow
                    key={req.id}
                    req={req}
                    disabled={!hasApiRequirements}
                    onApplicabilityChange={handleApplicabilityChange}
                    onPolicyChange={handlePolicyChange}
                    onEvidenceChange={handleEvidenceChange}
                    onJustificationChange={handleJustificationChange}
                    onImplementationChange={handleImplementationChange}
                    t={t}
                    translatedName={tReq(req.id, req.name)}
                  />
                ))}
              </TableBody>
            </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
              <span className="text-xs text-slate-500">
                {flatRequirements.length > 0
                  ? t("Showing {start} to {end} of {total}").replace("{start}", String(soaStartIndex + 1)).replace("{end}", String(soaEndIndex)).replace("{total}", String(flatRequirements.length))
                  : t("No controls")}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-400 hover:text-slate-600"
                  onClick={() => setSoaPage(soaPage - 1)}
                  disabled={soaPage === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-400 hover:text-slate-600"
                  onClick={() => setSoaPage(soaPage + 1)}
                  disabled={soaPage >= soaTotalPages - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Action buttons at bottom right */}
          <div className="flex flex-row items-center ltr:justify-end rtl:justify-start gap-3 mt-4">
            <Button
              variant="outline"
              onClick={handleDownloadSOAReport}
            >
              <Download className="h-4 w-4 me-2" />
              {t("Download Report")}
            </Button>
            <Button
              onClick={handleSaveSOA}
              disabled={!hasApiRequirements || !hasUnsavedSOAChanges || soaSaving}
            >
              {soaSaving ? t("Saving...") : t("Save")}
            </Button>
          </div>
        </TabsContent>

        {/* Gap Assessment Tab */}
        <TabsContent value="gap-assessment" className="mt-6">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-3 sm:px-5 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-slate-800">{t("Gap Assessment")}</h3>
                <Badge variant="outline">{flatRequirements.filter(r => r.level >= 2).length}</Badge>
                {hasUnsavedGapChanges && (
                  <Badge variant="secondary" className="bg-amber-50 text-amber-700">{t("Unsaved changes")}</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute ltr:left-2.5 rtl:right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder={t("Search controls...")}
                    value={gapSearch}
                    onChange={(e) => setGapSearch(e.target.value)}
                    className="ltr:pl-8 rtl:pr-8 ltr:pr-3 rtl:pl-3 py-1.5 text-sm border border-slate-200 rounded-md bg-slate-50 w-48 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
                <Button size="sm" variant="outline" onClick={handleExportGap}>
                  <Download className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                  {t("Export")}
                </Button>
                <Button size="sm" onClick={handleSaveGap} disabled={!hasUnsavedGapChanges || gapSaving}>
                  {gapSaving ? t("Saving...") : t("Save")}
                </Button>
              </div>
            </div>

            {/* Category Accordions */}
            <div className="divide-y divide-slate-100">
              {gapCategories.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <p className="text-sm">{t("No controls found")}</p>
                </div>
              ) : (
                gapCategories.map(cat => {
                  const isExpanded = gapEffectiveExpanded.includes(cat.id);
                  return (
                    <div key={cat.id}>
                      <button
                        className="w-full flex items-center justify-between px-3 sm:px-5 py-3 hover:bg-slate-50 transition-colors"
                        onClick={() => toggleGapCat(cat.id)}
                      >
                        <div className="flex items-center gap-2">
                          <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                          <span className="text-sm font-medium text-slate-800">{cat.name}</span>
                          <Badge variant="outline" className="text-xs">{cat.requirements.length}</Badge>
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="overflow-x-auto border-t border-slate-100">
                          <table className="w-full text-xs min-w-[1400px]">
                            <thead>
                              <tr className="bg-slate-50/80 border-b border-slate-100">
                                <th className="text-start px-2 py-2 font-medium text-slate-500 w-24">{t("Control ID")}</th>
                                <th className="text-start px-2 py-2 font-medium text-slate-500 w-32">{t("Framework")}</th>
                                <th className="text-start px-2 py-2 font-medium text-slate-500 w-48">{t("Description")}</th>
                                <th className="text-start px-2 py-2 font-medium text-slate-500 w-32">{t("Current State")}</th>
                                <th className="text-start px-2 py-2 font-medium text-slate-500 w-32">{t("Expected Requirement")}</th>
                                <th className="text-start px-2 py-2 font-medium text-slate-500 w-32">{t("Policy")}</th>
                                <th className="text-start px-2 py-2 font-medium text-slate-500 w-28">{t("Evidence")}</th>
                                <th className="text-start px-2 py-2 font-medium text-slate-500 w-28">{t("Gap Identified")}</th>
                                <th className="text-start px-2 py-2 font-medium text-slate-500 w-20">{t("Risk Level")}</th>
                                <th className="text-start px-2 py-2 font-medium text-slate-500 w-28">{t("Recommendation")}</th>
                                <th className="text-start px-2 py-2 font-medium text-slate-500 w-28">{t("Owner")}</th>
                                <th className="text-start px-2 py-2 font-medium text-slate-500 w-28">{t("Target Date")}</th>
                                <th className="text-start px-2 py-2 font-medium text-slate-500 w-24">{t("Status")}</th>
                                <th className="text-center px-2 py-2 font-medium text-slate-500 w-20">{t("Compliant")}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {cat.requirements.map(req => {
                                const isCompliant = getGapValue(req, "gapCompliant") as boolean;
                                return (
                                  <tr key={req.id} className={isCompliant ? "bg-green-50/50" : ""}>
                                    <td className="px-2 py-2 font-mono text-slate-700">{req.code}</td>
                                    <td className="px-2 py-2 text-slate-600 truncate">{framework?.name}</td>
                                    <td className="px-2 py-2 text-slate-600" title={req.description || req.name}>{(req.description || req.name).substring(0, 60)}{(req.description || req.name).length > 60 ? "..." : ""}</td>
                                    <td className="px-2 py-1"><input type="text" className="w-full px-1.5 py-1 text-xs border border-slate-200 rounded bg-white" value={(getGapValue(req, "gapCurrentState") as string) || ""} onChange={(e) => handleGapEdit(req.id, "gapCurrentState", e.target.value)} /></td>
                                    <td className="px-2 py-1"><input type="text" className="w-full px-1.5 py-1 text-xs border border-slate-200 rounded bg-white" value={(getGapValue(req, "gapExpectedRequirement") as string) || ""} onChange={(e) => handleGapEdit(req.id, "gapExpectedRequirement", e.target.value)} /></td>
                                    <td className="px-2 py-1">
                                      <button className="text-xs text-primary-600 hover:underline" onClick={() => openGapPolicyDialog(req.id)}>
                                        {req.policies && req.policies.length > 0 ? req.policies.map(p => p.policy.name).join(", ") : t("Link")}
                                      </button>
                                    </td>
                                    <td className="px-2 py-1"><input type="text" className="w-full px-1.5 py-1 text-xs border border-slate-200 rounded bg-white" value={(getGapValue(req, "gapEvidence") as string) || ""} onChange={(e) => handleGapEdit(req.id, "gapEvidence", e.target.value)} /></td>
                                    <td className="px-2 py-1"><input type="text" className="w-full px-1.5 py-1 text-xs border border-slate-200 rounded bg-white" value={(getGapValue(req, "gapIdentified") as string) || ""} onChange={(e) => handleGapEdit(req.id, "gapIdentified", e.target.value)} /></td>
                                    <td className="px-2 py-1">
                                      <select className="w-full px-1 py-1 text-xs border border-slate-200 rounded bg-white" value={(getGapValue(req, "gapRiskLevel") as string) || ""} onChange={(e) => handleGapEdit(req.id, "gapRiskLevel", e.target.value)}>
                                        <option value="">-</option>
                                        <option value="High">{t("High")}</option>
                                        <option value="Medium">{t("Medium")}</option>
                                        <option value="Low">{t("Low")}</option>
                                      </select>
                                    </td>
                                    <td className="px-2 py-1"><input type="text" className="w-full px-1.5 py-1 text-xs border border-slate-200 rounded bg-white" value={(getGapValue(req, "gapRecommendation") as string) || ""} onChange={(e) => handleGapEdit(req.id, "gapRecommendation", e.target.value)} /></td>
                                    <td className="px-2 py-1">
                                      <button className="text-xs text-primary-600 hover:underline truncate w-full text-start" onClick={() => { setGapOwnerReqId(req.id); setGapOwnerDeptId(""); setGapOwnerUserId(""); if (gapDeptUsers.length === 0) fetchGapDeptUsers(); setGapOwnerDialogOpen(true); }}>
                                        {((getGapValue(req, "gapOwner") as string) || "").split(":")[2] || t("Select")}
                                      </button>
                                    </td>
                                    <td className="px-2 py-1"><input type="date" className="w-full px-1 py-1 text-xs border border-slate-200 rounded bg-white" value={(getGapValue(req, "gapTargetDate") as string) || ""} onChange={(e) => handleGapEdit(req.id, "gapTargetDate", e.target.value)} min={new Date().toISOString().split("T")[0]} /></td>
                                    <td className="px-2 py-1">
                                      <select className="w-full px-1 py-1 text-xs border border-slate-200 rounded bg-white" value={(getGapValue(req, "gapStatus") as string) || ""} onChange={(e) => handleGapEdit(req.id, "gapStatus", e.target.value)}>
                                        <option value="">-</option>
                                        <option value="Open">{t("Open")}</option>
                                        <option value="In Progress">{t("In Progress")}</option>
                                        <option value="Closed">{t("Closed")}</option>
                                      </select>
                                    </td>
                                    <td className="px-2 py-1 text-center">
                                      <button
                                        className={`px-2 py-0.5 rounded text-xs font-medium ${isCompliant ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}
                                        onClick={() => handleGapEdit(req.id, "gapCompliant", !isCompliant)}
                                      >
                                        {isCompliant ? t("Yes") : t("No")}
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Link Policy Dialog */}
          <Dialog open={gapPolicyDialogOpen} onOpenChange={setGapPolicyDialogOpen}>
            <DialogContent className="max-w-lg max-h-[70vh] flex flex-col p-0 gap-0">
              <DialogHeader className="px-4 py-3 border-b">
                <DialogTitle>{t("Link Policies")}</DialogTitle>
              </DialogHeader>
              <div className="px-4 py-3 space-y-3 flex-1 overflow-y-auto">
                <input
                  type="text"
                  placeholder={t("Search policies...")}
                  value={gapPolicySearch}
                  onChange={(e) => setGapPolicySearch(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                />
                {gapPoliciesLoading ? (
                  <p className="text-sm text-slate-500 text-center py-4">{t("Loading...")}</p>
                ) : (
                  <div className="space-y-1 max-h-[300px] overflow-y-auto">
                    {allGapPolicies
                      .filter(p => !gapPolicySearch || p.name.toLowerCase().includes(gapPolicySearch.toLowerCase()) || p.code.toLowerCase().includes(gapPolicySearch.toLowerCase()))
                      .map(p => (
                        <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={gapSelectedPolicyIds.includes(p.id)}
                            onChange={(e) => {
                              if (e.target.checked) setGapSelectedPolicyIds(prev => [...prev, p.id]);
                              else setGapSelectedPolicyIds(prev => prev.filter(id => id !== p.id));
                            }}
                            className="rounded"
                          />
                          <span className="text-sm text-slate-700">{p.code} - {p.name}</span>
                        </label>
                      ))}
                  </div>
                )}
              </div>
              <div className="px-4 py-3 border-t flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setGapPolicyDialogOpen(false)}>{t("Cancel")}</Button>
                <Button size="sm" onClick={handleSaveGapPolicies}>{t("Save")}</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Select Owner Dialog */}
          <Dialog open={gapOwnerDialogOpen} onOpenChange={setGapOwnerDialogOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>{t("Select Owner")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("Department")}</Label>
                  <select className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md" value={gapOwnerDeptId} onChange={(e) => { setGapOwnerDeptId(e.target.value); setGapOwnerUserId(""); }}>
                    <option value="">{t("Select department")}</option>
                    {gapDeptUsers.map(d => <option key={d.deptId} value={d.deptId}>{d.deptName}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("Owner")}</Label>
                  <select className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md" value={gapOwnerUserId} onChange={(e) => setGapOwnerUserId(e.target.value)} disabled={!gapOwnerDeptId}>
                    <option value="">{t("Select owner")}</option>
                    {gapDeptUsers.find(d => d.deptId === gapOwnerDeptId)?.users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setGapOwnerDialogOpen(false)}>{t("Cancel")}</Button>
                <Button size="sm" onClick={() => {
                  if (gapOwnerReqId && gapOwnerDeptId && gapOwnerUserId) {
                    const user = gapDeptUsers.find(d => d.deptId === gapOwnerDeptId)?.users.find(u => u.id === gapOwnerUserId);
                    handleGapEdit(gapOwnerReqId, "gapOwner", `${gapOwnerDeptId}:${gapOwnerUserId}:${user?.fullName || ""}`);
                    setGapOwnerDialogOpen(false);
                  }
                }} disabled={!gapOwnerDeptId || !gapOwnerUserId}>{t("Save")}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Audit Logs Tab */}
        <TabsContent value="audit-logs" className="mt-6">
          <div className="bg-white rounded-xl border border-slate-200">
            {/* Toolbar */}
            <div className="p-3 sm:p-4 border-b border-slate-200 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
              <div className="relative flex-1 min-w-0 sm:min-w-[200px] sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={t("Search audit logs...")}
                  value={auditLogSearch}
                  onChange={(e) => { setAuditLogSearch(e.target.value); setAuditLogPage(0); }}
                  className="pl-9 bg-white"
                />
              </div>
              <Select value={auditLogActionFilter} onValueChange={(v) => { setAuditLogActionFilter(v); setAuditLogPage(0); }}>
                <SelectTrigger className="w-full sm:w-[180px] bg-white">
                  <SelectValue placeholder={t("All Actions")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("All Actions")}</SelectItem>
                  {auditLogActions.map((action) => (
                    <SelectItem key={action} value={action}>{action}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handleExportAuditLogs} className="gap-2">
                <Download className="h-4 w-4" />
                {t("Export")}
              </Button>
            </div>

            {/* Table */}
            {auditLogsLoading ? (
              <div className="p-12 text-center">
                <p className="text-sm text-slate-500">{t("Loading...")}</p>
              </div>
            ) : filteredAuditLogs.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-sm text-slate-500">{t("No audit logs found.")}</p>
              </div>
            ) : (
              <>
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[140px]">{t("User")}</TableHead>
                        <TableHead className="min-w-[100px]">{t("Action")}</TableHead>
                        <TableHead className="min-w-[150px]">{t("Target")}</TableHead>
                        <TableHead className="min-w-[250px]">{t("Details")}</TableHead>
                        <TableHead className="min-w-[180px]">{t("Date & Time")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAuditLogs
                        .slice(auditLogPage * AUDIT_LOG_PAGE_SIZE, (auditLogPage + 1) * AUDIT_LOG_PAGE_SIZE)
                        .map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="font-medium">{log.userName || "-"}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                log.changeType === "CREATE" ? "bg-green-100 text-green-700" :
                                log.changeType === "DELETE" ? "bg-red-100 text-red-700" :
                                "bg-primary-50 text-primary-700"
                              }`}>
                                {log.changeType}
                              </span>
                            </TableCell>
                            <TableCell>{log.entityType}</TableCell>
                            <TableCell className="text-slate-600 text-sm max-w-[350px] truncate" title={parseChangesDetails(log.changes)}>
                              {parseChangesDetails(log.changes)}
                            </TableCell>
                            <TableCell className="text-slate-500 text-sm">{formatAuditLogDate(log.createdAt)}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {filteredAuditLogs.length > AUDIT_LOG_PAGE_SIZE && (
                  <div className="p-3 border-t border-slate-200 flex items-center justify-between">
                    <p className="text-sm text-slate-500">
                      {t("Showing")} {auditLogPage * AUDIT_LOG_PAGE_SIZE + 1} {t("to")}{" "}
                      {Math.min((auditLogPage + 1) * AUDIT_LOG_PAGE_SIZE, filteredAuditLogs.length)} {t("of")}{" "}
                      {filteredAuditLogs.length}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setAuditLogPage((p) => Math.max(0, p - 1))}
                        disabled={auditLogPage === 0}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setAuditLogPage((p) => p + 1)}
                        disabled={(auditLogPage + 1) * AUDIT_LOG_PAGE_SIZE >= filteredAuditLogs.length}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Requirement Dialog */}
      <Dialog open={isAddRequirementOpen} onOpenChange={(open) => { if (!open) { setReqErrors({}); } setIsAddRequirementOpen(open); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0 max-h-[90vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add Control")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-5">
            <p className="text-sm text-slate-500">
              {t("To add a control to this framework, please accurately fill in the fields below.")}
            </p>

            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Control Name")} <span className="text-red-500">*</span></Label>
              <Input
                value={newRequirement.name}
                onChange={(e) => {
                  setNewRequirement({ ...newRequirement, name: e.target.value });
                  if (reqErrors.name) {
                    setReqErrors((prev) => { const { name, ...rest } = prev; return rest; });
                  }
                }}
                placeholder={t("Enter Name")}
                className={`mt-1.5 bg-white ${reqErrors.name ? "border-red-500 focus:ring-red-500" : ""}`}
              />
              {reqErrors.name && (
                <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                  <p className="text-sm text-red-600">{reqErrors.name}</p>
                </div>
              )}
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Control Category")} <span className="text-red-500">*</span></Label>
              <Input
                value={newRequirement.category}
                onChange={(e) => {
                  setNewRequirement({
                    ...newRequirement,
                    category: e.target.value,
                  });
                  if (reqErrors.category) {
                    setReqErrors((prev) => { const { category, ...rest } = prev; return rest; });
                  }
                }}
                placeholder={t("Enter Category")}
                className={`mt-1.5 bg-white ${reqErrors.category ? "border-red-500 focus:ring-red-500" : ""}`}
              />
              {reqErrors.category && (
                <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                  <p className="text-sm text-red-600">{reqErrors.category}</p>
                </div>
              )}
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Control Code")} <span className="text-red-500">*</span></Label>
              <Input
                value={newRequirement.code}
                onChange={(e) => {
                  setNewRequirement({ ...newRequirement, code: e.target.value });
                  if (reqErrors.code) {
                    setReqErrors((prev) => { const { code, ...rest } = prev; return rest; });
                  }
                }}
                placeholder={t("Enter Code")}
                className={`mt-1.5 bg-white ${reqErrors.code ? "border-red-500 focus:ring-red-500" : ""}`}
              />
              {reqErrors.code && (
                <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                  <p className="text-sm text-red-600">{reqErrors.code}</p>
                </div>
              )}
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Control Description")}</Label>
              <Textarea
                value={newRequirement.description}
                onChange={(e) =>
                  setNewRequirement({
                    ...newRequirement,
                    description: e.target.value,
                  })
                }
                placeholder={t("Type here")}
                className="mt-1.5 bg-white"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Control Type")}</Label>
              <Select
                value={newRequirement.requirementType}
                onValueChange={(value) =>
                  setNewRequirement({ ...newRequirement, requirementType: value })
                }
              >
                <SelectTrigger className="mt-1.5 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="Mandatory">{t("Mandatory")}</SelectItem>
                  <SelectItem value="Additional">{t("Additional")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Chapter Type")}</Label>
              <Select
                value={newRequirement.chapterType}
                onValueChange={(value) =>
                  setNewRequirement({ ...newRequirement, chapterType: value })
                }
              >
                <SelectTrigger className="mt-1.5 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="Domain">{t("Domain")}</SelectItem>
                  <SelectItem value="Process Domain">{t("Process Domain")}</SelectItem>
                  <SelectItem value="Technical Domain">{t("Technical Domain")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex ltr:justify-end rtl:justify-start gap-2 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button
              variant="outline"
              onClick={() => { setReqErrors({}); setIsAddRequirementOpen(false); }}
            >
              {t("Cancel")}
            </Button>
            <Button
              onClick={handleAddRequirement}
            >
              {t("Add Control")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Exception Dialog */}
      <Dialog open={isAddExceptionOpen} onOpenChange={(open) => { if (!open) { setExcErrors({}); } setIsAddExceptionOpen(open); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0 max-h-[90vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add Exception")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Exception Code")}</Label>
                <Input disabled value={t("Auto-generated")} className="mt-1.5 bg-slate-50" />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Exception Name")} <span className="text-red-500">*</span></Label>
                <Input
                  value={newException.name}
                  onChange={(e) => {
                    setNewException({ ...newException, name: e.target.value });
                    if (excErrors.name) { setExcErrors((prev) => { const { name, ...rest } = prev; return rest; }); }
                  }}
                  className={`mt-1.5 bg-white ${excErrors.name ? "border-red-500 focus:ring-red-500" : ""}`}
                />
                {excErrors.name && (
                  <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                    <p className="text-sm text-red-600">{excErrors.name}</p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Category")}</Label>
              <Input disabled value={t("Compliance")} className="mt-1.5 bg-slate-50" />
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Framework")}</Label>
              <Input disabled value={translatedFramework?.name || framework.name} className="mt-1.5 bg-slate-50" />
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Control Code")}</Label>
              <Input disabled value={selectedRequirement?.code || ""} className="mt-1.5 bg-slate-50" />
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Description/Justification")} <span className="text-red-500">*</span></Label>
              <Textarea
                value={newException.description}
                onChange={(e) => {
                  setNewException({
                    ...newException,
                    description: e.target.value,
                  });
                  if (excErrors.description) { setExcErrors((prev) => { const { description, ...rest } = prev; return rest; }); }
                }}
                className={`mt-1.5 bg-white ${excErrors.description ? "border-red-500 focus:ring-red-500" : ""}`}
              />
              {excErrors.description && (
                <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                  <p className="text-sm text-red-600">{excErrors.description}</p>
                </div>
              )}
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Status")}</Label>
              <Select
                value={newException.status}
                onValueChange={(value) =>
                  setNewException({ ...newException, status: value })
                }
              >
                <SelectTrigger className="mt-1.5 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="Pending">{t("Pending")}</SelectItem>
                  <SelectItem value="Approved">{t("Approved")}</SelectItem>
                  <SelectItem value="Authorised">{t("Authorised")}</SelectItem>
                  <SelectItem value="Submitted for Closure">
                    {t("Submitted for Closure")}
                  </SelectItem>
                  <SelectItem value="Overdue">{t("Overdue")}</SelectItem>
                  <SelectItem value="RiskAccepted">{t("RiskAccepted")}</SelectItem>
                  <SelectItem value="Closed">{t("Closed")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700">{t("End Date")} <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={newException.endDate}
                onChange={(e) => {
                  setNewException({ ...newException, endDate: e.target.value });
                  if (excErrors.endDate) { setExcErrors((prev) => { const { endDate, ...rest } = prev; return rest; }); }
                }}
                className={`mt-1.5 bg-white ${excErrors.endDate ? "border-red-500 focus:ring-red-500" : ""}`}
              />
              {excErrors.endDate && (
                <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                  <p className="text-sm text-red-600">{excErrors.endDate}</p>
                </div>
              )}
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex ltr:justify-end rtl:justify-start gap-2 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button
              variant="outline"
              onClick={() => {
                setExcErrors({});
                setIsAddExceptionOpen(false);
                setSelectedRequirement(null);
              }}
            >
              {t("Cancel")}
            </Button>
            <Button onClick={handleAddException}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Requirements Dialog */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0 max-h-[90vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Import Controls")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-5">
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Name")}</Label>
              <Input
                value={importName}
                onChange={(e) => setImportName(e.target.value)}
                placeholder={t("Enter Name")}
                className="mt-1.5 bg-white"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700">{t("File")}</Label>
              <div className="flex gap-2 mt-1.5">
                <Input
                  value={importFile?.name || ""}
                  readOnly
                  placeholder={t("Select a file...")}
                  className="flex-1 bg-slate-50"
                />
                <FileInput
                  accept=".csv"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {t("Browse")}
                </Button>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="w-full"
            >
              <Download className="h-4 w-4 me-2" />
              {t("Download Template")}
            </Button>
          </div>

          {/* Fixed Footer */}
          <div className="flex ltr:justify-end rtl:justify-start gap-2 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button
              variant="outline"
              onClick={() => {
                setIsImportOpen(false);
                setImportFile(null);
                setImportName("");
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
              }}
            >
              {t("Cancel")}
            </Button>
            <Button
              onClick={handleImportRequirements}
              disabled={!importFile || importing}
            >
              {importing ? t("Importing...") : t("Import")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Update Requirement Dialog */}
      <Dialog open={isUpdateRequirementOpen} onOpenChange={setIsUpdateRequirementOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0 max-h-[90vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Update Control")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Control Code")}</Label>
                <Input
                  value={updateRequirement.code}
                  onChange={(e) =>
                    setUpdateRequirement({ ...updateRequirement, code: e.target.value })
                  }
                  className="mt-1.5 bg-white"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Control Name")}</Label>
                <Input
                  value={updateRequirement.name}
                  onChange={(e) =>
                    setUpdateRequirement({ ...updateRequirement, name: e.target.value })
                  }
                  className="mt-1.5 bg-white"
                />
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
              <Textarea
                value={updateRequirement.description}
                onChange={(e) =>
                  setUpdateRequirement({
                    ...updateRequirement,
                    description: e.target.value,
                  })
                }
                rows={3}
                className="mt-1.5 bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Control Type")}</Label>
                <Select
                  value={updateRequirement.requirementType}
                  onValueChange={(value) =>
                    setUpdateRequirement({ ...updateRequirement, requirementType: value })
                  }
                >
                  <SelectTrigger className="mt-1.5 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="Mandatory">{t("Mandatory")}</SelectItem>
                    <SelectItem value="Additional">{t("Additional")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Chapter Type")}</Label>
                <Select
                  value={updateRequirement.chapterType}
                  onValueChange={(value) =>
                    setUpdateRequirement({ ...updateRequirement, chapterType: value })
                  }
                >
                  <SelectTrigger className="mt-1.5 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="Domain">{t("Domain")}</SelectItem>
                    <SelectItem value="Process Domain">{t("Process Domain")}</SelectItem>
                    <SelectItem value="Technical Domain">{t("Technical Domain")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Applicability")}</Label>
                <Select
                  value={updateRequirement.applicability}
                  onValueChange={(value) =>
                    setUpdateRequirement({ ...updateRequirement, applicability: value })
                  }
                >
                  <SelectTrigger className="mt-1.5 bg-white">
                    <SelectValue placeholder={t("Select")} />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="Yes">{t("Yes")}</SelectItem>
                    <SelectItem value="No">{t("No")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Implementation")}</Label>
                <Select
                  value={updateRequirement.implementationStatus}
                  onValueChange={(value) =>
                    setUpdateRequirement({ ...updateRequirement, implementationStatus: value })
                  }
                >
                  <SelectTrigger className="mt-1.5 bg-white">
                    <SelectValue placeholder={t("Select")} />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="Yes">{t("Yes")}</SelectItem>
                    <SelectItem value="No">{t("No")}</SelectItem>
                    <SelectItem value="Ongoing">{t("Ongoing")}</SelectItem>
                    <SelectItem value="N/A">{t("N/A")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Compliance")}</Label>
                <Select
                  value={updateRequirement.controlCompliance}
                  onValueChange={(value) =>
                    setUpdateRequirement({ ...updateRequirement, controlCompliance: value })
                  }
                >
                  <SelectTrigger className="mt-1.5 bg-white">
                    <SelectValue placeholder={t("Select")} />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="Compliant">{t("Compliant")}</SelectItem>
                    <SelectItem value="Non Compliant">{t("Non Compliant")}</SelectItem>
                    <SelectItem value="Partial Compliant">{t("Partial Compliant")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex ltr:justify-end rtl:justify-start gap-2 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button
              variant="outline"
              onClick={() => setIsUpdateRequirementOpen(false)}
            >
              {t("Cancel")}
            </Button>
            <Button
              onClick={handleUpdateRequirement}
              disabled={!updateRequirement.name || !updateRequirement.code}
            >
              {t("Update")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
