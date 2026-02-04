"use client";

import { useEffect, useState, use, useRef, useMemo, memo, useCallback } from "react";
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
  Upload,
  Edit2,
  Link2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Home,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

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
        controls: [
          {
            id: "rc-1",
            controlId: "ctrl-1",
            control: {
              id: "ctrl-1",
              controlCode: "GOV-01",
              name: "Information Security Policy",
              status: "Compliant",
              domain: { id: "d1", name: "Governance" },
              functionalGrouping: "Govern",
            },
          },
        ],
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
        controls: [],
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
        controls: [
          {
            id: "rc-2",
            controlId: "ctrl-2",
            control: {
              id: "ctrl-2",
              controlCode: "GOV-02",
              name: "ISMS Scope Definition",
              status: "Compliant",
              domain: { id: "d1", name: "Governance" },
              functionalGrouping: "Govern",
            },
          },
        ],
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
        controls: [],
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
        controls: [
          {
            id: "rc-3",
            controlId: "ctrl-3",
            control: {
              id: "ctrl-3",
              controlCode: "GOV-03",
              name: "Management Commitment",
              status: "Compliant",
              domain: { id: "d1", name: "Governance" },
              functionalGrouping: "Govern",
            },
          },
        ],
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
        controls: [
          {
            id: "rc-4",
            controlId: "ctrl-4",
            control: {
              id: "ctrl-4",
              controlCode: "GOV-04",
              name: "Security Policy Documentation",
              status: "Compliant",
              domain: { id: "d1", name: "Governance" },
              functionalGrouping: "Govern",
            },
          },
        ],
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
        controls: [],
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
        controls: [
          {
            id: "rc-5",
            controlId: "ctrl-5",
            control: {
              id: "ctrl-5",
              controlCode: "RSK-01",
              name: "Risk Assessment Process",
              status: "Partial Compliant",
              domain: { id: "d2", name: "Risk Management" },
              functionalGrouping: "Identify",
            },
          },
          {
            id: "rc-6",
            controlId: "ctrl-6",
            control: {
              id: "ctrl-6",
              controlCode: "RSK-02",
              name: "Risk Treatment Plan",
              status: "Partial Compliant",
              domain: { id: "d2", name: "Risk Management" },
              functionalGrouping: "Identify",
            },
          },
        ],
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
        controls: [
          {
            id: "rc-7",
            controlId: "ctrl-7",
            control: {
              id: "ctrl-7",
              controlCode: "GOV-05",
              name: "Security Objectives",
              status: "Compliant",
              domain: { id: "d1", name: "Governance" },
              functionalGrouping: "Govern",
            },
          },
        ],
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
        controls: [],
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
        controls: [],
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
        controls: [
          {
            id: "rc-8",
            controlId: "ctrl-8",
            control: {
              id: "ctrl-8",
              controlCode: "HRS-01",
              name: "Security Competence Training",
              status: "Partial Compliant",
              domain: { id: "d3", name: "Human Resources" },
              functionalGrouping: "Protect",
            },
          },
        ],
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
        controls: [
          {
            id: "rc-9",
            controlId: "ctrl-9",
            control: {
              id: "ctrl-9",
              controlCode: "SAT-01",
              name: "Security Awareness Program",
              status: "Compliant",
              domain: { id: "d4", name: "Security Awareness" },
              functionalGrouping: "Protect",
            },
          },
        ],
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
        controls: [],
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
        controls: [
          {
            id: "rc-10",
            controlId: "ctrl-10",
            control: {
              id: "ctrl-10",
              controlCode: "GOV-06",
              name: "Document Control",
              status: "Partial Compliant",
              domain: { id: "d1", name: "Governance" },
              functionalGrouping: "Govern",
            },
          },
        ],
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
        controls: [
          {
            id: "rc-11",
            controlId: "ctrl-11",
            control: {
              id: "ctrl-11",
              controlCode: "OPS-01",
              name: "Operational Procedures",
              status: "Compliant",
              domain: { id: "d5", name: "Operations" },
              functionalGrouping: "Protect",
            },
          },
        ],
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
        controls: [
          {
            id: "rc-12",
            controlId: "ctrl-12",
            control: {
              id: "ctrl-12",
              controlCode: "RSK-03",
              name: "Periodic Risk Assessment",
              status: "Partial Compliant",
              domain: { id: "d2", name: "Risk Management" },
              functionalGrouping: "Identify",
            },
          },
        ],
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
        controls: [
          {
            id: "rc-13",
            controlId: "ctrl-13",
            control: {
              id: "ctrl-13",
              controlCode: "RSK-04",
              name: "Risk Treatment Implementation",
              status: "Partial Compliant",
              domain: { id: "d2", name: "Risk Management" },
              functionalGrouping: "Identify",
            },
          },
        ],
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
        controls: [
          {
            id: "rc-14",
            controlId: "ctrl-14",
            control: {
              id: "ctrl-14",
              controlCode: "MON-01",
              name: "Security Monitoring",
              status: "Partial Compliant",
              domain: { id: "d6", name: "Monitoring" },
              functionalGrouping: "Detect",
            },
          },
        ],
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
        controls: [
          {
            id: "rc-15",
            controlId: "ctrl-15",
            control: {
              id: "ctrl-15",
              controlCode: "AUD-01",
              name: "Internal Audit Program",
              status: "Compliant",
              domain: { id: "d7", name: "Audit" },
              functionalGrouping: "Detect",
            },
          },
        ],
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
        controls: [
          {
            id: "rc-16",
            controlId: "ctrl-16",
            control: {
              id: "ctrl-16",
              controlCode: "GOV-07",
              name: "Management Review Process",
              status: "Compliant",
              domain: { id: "d1", name: "Governance" },
              functionalGrouping: "Govern",
            },
          },
        ],
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
        controls: [],
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
        controls: [
          {
            id: "rc-17",
            controlId: "ctrl-17",
            control: {
              id: "ctrl-17",
              controlCode: "INC-01",
              name: "Corrective Action Process",
              status: "Compliant",
              domain: { id: "d8", name: "Incident Management" },
              functionalGrouping: "Respond",
            },
          },
        ],
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
  t: (key: string) => string;
}

const SOARow = memo(function SOARow({
  req,
  disabled,
  onApplicabilityChange,
  onJustificationChange,
  onImplementationChange,
  t,
}: SOARowProps) {
  return (
    <TableRow className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
      <TableCell className="py-3 text-sm font-medium text-slate-800 w-16">{req.code}</TableCell>
      <TableCell className="py-3 text-sm text-slate-700 w-64 truncate">
        {req.name}
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
          {req.controlCompliance || t("Non Compliant")}
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
  const [isLinkControlsOpen, setIsLinkControlsOpen] = useState(false);
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

  // SOA Local Edits - track changes before saving
  const [soaEdits, setSoaEdits] = useState<Record<string, { applicability?: string; justification?: string; implementationStatus?: string }>>({});
  const [soaSaving, setSoaSaving] = useState(false);

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

  const handleOpenUpdateRequirement = (requirement: Requirement) => {
    setUpdateRequirement({
      id: requirement.id,
      name: requirement.name,
      code: requirement.code,
      description: requirement.description || "",
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
      const response = await fetch(`/api/requirements/${updateRequirement.id}`, {
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
      "Linked Controls",
    ];

    const rows = requirements.map((req) => {
      const linkedControls = req.controls
        ?.map((rc) => rc.control?.controlCode || rc.control?.name)
        .join("; ") || "";

      return [
        req.code,
        req.name,
        req.description?.replace(/"/g, '""') || "",
        req.category?.name || "",
        req.applicability || "",
        req.implementationStatus || "",
        req.controlCompliance || "",
        linkedControls,
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
    const template = "Requirement Code,Requirement Name,Description,Category,Control Mapping\n";
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

      const response = await fetch("/api/requirements/import", {
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
        toast({ title: t("Error"), description: t("Failed to import requirements. Please check the file format."), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error importing requirements:", error);
      toast({ title: t("Error"), description: t("Failed to import requirements. Please try again."), variant: "destructive" });
    } finally {
      setImporting(false);
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

  // Save all SOA changes to the server
  const handleSaveSOA = async () => {
    if (Object.keys(soaEdits).length === 0) {
      toast({ title: t("No changes"), description: t("No changes to save.") });
      return;
    }

    setSoaSaving(true);
    try {
      const updatePromises = Object.entries(soaEdits).map(([requirementId, changes]) =>
        fetch(`/api/requirements/${requirementId}`, {
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
      : flattenRequirements(dummyRequirements);

    // Create CSV content
    const headers = [
      "Code",
      "Requirement",
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

      return [
        req.code,
        req.name.replace(/"/g, '""'),
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
      : dummyRequirements;
  }, [hasApiRequirements, requirementsToUse, framework]);

  const filteredHierarchy = filterRequirements(requirementHierarchy);

  const flatRequirements = useMemo(() => {
    return hasApiRequirements && framework
      ? requirementsToUse
      : flattenRequirements(dummyRequirements);
  }, [hasApiRequirements, requirementsToUse, framework]);

  const soaTotalPages = Math.ceil(flatRequirements.length / SOA_PAGE_SIZE);
  const soaStartIndex = soaPage * SOA_PAGE_SIZE;
  const soaEndIndex = Math.min(soaStartIndex + SOA_PAGE_SIZE, flatRequirements.length);

  const soaRequirements = useMemo(() => {
    return flatRequirements.slice(soaStartIndex, soaEndIndex);
  }, [flatRequirements, soaStartIndex, soaEndIndex]);

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
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Compliance")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <Link href="/compliance/framework" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Frameworks")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{framework.name}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800">{framework.name}</h1>
        <p className="text-sm text-slate-500">{t("Manage framework requirements and controls")}</p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="requirements">{t("All Requirements")}</TabsTrigger>
          <TabsTrigger value="soa">{t("SOA")}</TabsTrigger>
          <TabsTrigger value="audit-logs">{t("Audit Logs")}</TabsTrigger>
        </TabsList>

        {/* Requirements Tab */}
        <TabsContent value="requirements" className="mt-6">
          {/* Header with actions */}
          <div className="flex items-center justify-between mb-4">
            <Input
              placeholder={t("Search by requirement code, name, control code...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm bg-white"
            />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportRequirements}>
                <Download className="h-4 w-4 mr-2" />
                {t("Export")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsImportOpen(true)}
              >
                <Upload className="h-4 w-4 mr-2" />
                {t("Import")}
              </Button>
              <Button size="sm" onClick={() => setIsAddRequirementOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {t("New Requirement")}
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
                      <span className="font-medium">{category.name}</span>
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
                              {requirement.code} - {requirement.name}
                            </span>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-4">
                            {/* Requirement Description */}
                            <div className="flex items-start justify-between p-4 bg-muted/50 rounded-lg">
                              <p className="text-sm flex-1">
                                {requirement.description || t("No description")}
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
                                <AlertTriangle className="h-4 w-4 mr-2" />
                                {t("Add Exception")}
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
                                {t("Link Controls")}
                              </Button>
                            </div>

                            {/* Linked Controls Table */}
                            {requirement.controls &&
                              requirement.controls.length > 0 && (
                                <div className="mt-4">
                                  <h4 className="font-medium mb-2">
                                    {t("Linked Controls")}
                                  </h4>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>{t("Control Code")}</TableHead>
                                        <TableHead>{t("Control Name")}</TableHead>
                                        <TableHead>{t("Status")}</TableHead>
                                        <TableHead>{t("Action")}</TableHead>
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
                                              {t("Unlink")}
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
                {t("This framework has no requirements. Import requirements to enable SOA editing.")}
              </p>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow className="border-b border-slate-100 bg-slate-50/50">
                  <TableHead className="text-xs font-semibold text-slate-600 py-3 w-16">{t("Code")}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 py-3 w-64">{t("Requirement")}</TableHead>
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
                    onJustificationChange={handleJustificationChange}
                    onImplementationChange={handleImplementationChange}
                    t={t}
                  />
                ))}
              </TableBody>
            </Table>

            {/* Pagination inside card */}
            <div className="flex items-center justify-between p-4 border-t border-slate-100">
              <div className="text-xs text-slate-500">
                {flatRequirements.length > 0
                  ? `${t("Showing")} ${soaStartIndex + 1} ${t("to")} ${soaEndIndex} ${t("of")} ${flatRequirements.length}`
                  : t("No requirements")}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setSoaPage(0)}
                  disabled={soaPage === 0}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setSoaPage(soaPage - 1)}
                  disabled={soaPage === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setSoaPage(soaPage + 1)}
                  disabled={soaPage >= soaTotalPages - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setSoaPage(soaTotalPages - 1)}
                  disabled={soaPage >= soaTotalPages - 1}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Action buttons at bottom right */}
          <div className="flex items-center justify-end gap-3 mt-4">
            <Button
              variant="outline"
              onClick={handleDownloadSOAReport}
            >
              <Download className="h-4 w-4 mr-2" />
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

        {/* Audit Logs Tab */}
        <TabsContent value="audit-logs" className="mt-6">
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <p className="text-sm text-slate-500">{t("Audit logs will be displayed here.")}</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Requirement Dialog */}
      <Dialog open={isAddRequirementOpen} onOpenChange={setIsAddRequirementOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0 max-h-[90vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add Requirement")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-5">
            <p className="text-sm text-slate-500">
              {t("To add a requirement to this framework, please accurately fill in the fields below.")}
            </p>

            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Requirement Name")}</Label>
              <Input
                value={newRequirement.name}
                onChange={(e) =>
                  setNewRequirement({ ...newRequirement, name: e.target.value })
                }
                placeholder={t("Enter Name")}
                className="mt-1.5 bg-white"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Requirement Category")}</Label>
              <Input
                value={newRequirement.category}
                onChange={(e) =>
                  setNewRequirement({
                    ...newRequirement,
                    category: e.target.value,
                  })
                }
                placeholder={t("Enter Category")}
                className="mt-1.5 bg-white"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Requirement Code")}</Label>
              <Input
                value={newRequirement.code}
                onChange={(e) =>
                  setNewRequirement({ ...newRequirement, code: e.target.value })
                }
                placeholder={t("Enter Code")}
                className="mt-1.5 bg-white"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Requirement Description")}</Label>
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
              <Label className="text-sm font-medium text-slate-700">{t("Requirement Type")}</Label>
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
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button
              variant="outline"
              onClick={() => setIsAddRequirementOpen(false)}
            >
              {t("Cancel")}
            </Button>
            <Button
              onClick={handleAddRequirement}
              disabled={!newRequirement.name || !newRequirement.code}
            >
              {t("Add Requirement")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Link Controls Dialog */}
      <Dialog open={isLinkControlsOpen} onOpenChange={setIsLinkControlsOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0 max-h-[90vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Control Select")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-4">
            {/* Filters */}
            <div className="grid grid-cols-3 gap-4">
              <Select
                value={controlFilters.domainId || "all"}
                onValueChange={(value) =>
                  setControlFilters({ ...controlFilters, domainId: value === "all" ? "" : value })
                }
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder={t("Domain")} />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">{t("All Domains")}</SelectItem>
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
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder={t("Function Grouping")} />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">{t("All Functions")}</SelectItem>
                  <SelectItem value="Govern">{t("Govern")}</SelectItem>
                  <SelectItem value="Identify">{t("Identify")}</SelectItem>
                  <SelectItem value="Protect">{t("Protect")}</SelectItem>
                  <SelectItem value="Detect">{t("Detect")}</SelectItem>
                  <SelectItem value="Respond">{t("Respond")}</SelectItem>
                  <SelectItem value="Recover">{t("Recover")}</SelectItem>
                </SelectContent>
              </Select>

              <Input
                placeholder={t("Search by code, name")}
                value={controlFilters.search}
                onChange={(e) =>
                  setControlFilters({ ...controlFilters, search: e.target.value })
                }
                className="bg-white"
              />
            </div>

            {/* Controls List */}
            <div className="border border-slate-200 rounded-lg max-h-64 overflow-y-auto">
              {filteredControls.map((control) => (
                <div
                  key={control.id}
                  className={`flex items-center gap-3 p-3 border-b border-slate-100 last:border-b-0 cursor-pointer hover:bg-slate-50 ${
                    selectedControlIds.includes(control.id) ? "bg-primary-50" : ""
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
                    <div className="text-sm font-medium text-slate-800">{control.controlCode}</div>
                    <div className="text-xs text-slate-500">
                      {control.name}
                    </div>
                  </div>
                </div>
              ))}
              {filteredControls.length === 0 && (
                <div className="p-4 text-center text-sm text-slate-500">
                  {t("No controls found")}
                </div>
              )}
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button
              variant="outline"
              onClick={() => {
                setIsLinkControlsOpen(false);
                setSelectedControlIds([]);
              }}
            >
              {t("Cancel")}
            </Button>
            <Button
              onClick={handleLinkControls}
              disabled={selectedControlIds.length === 0}
            >
              {`${t("Link Controls")} (${selectedControlIds.length})`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Exception Dialog */}
      <Dialog open={isAddExceptionOpen} onOpenChange={setIsAddExceptionOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0 max-h-[90vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add Exception")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Exception Code")}</Label>
                <Input disabled value={t("Auto-generated")} className="mt-1.5 bg-slate-50" />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Exception Name")}</Label>
                <Input
                  value={newException.name}
                  onChange={(e) =>
                    setNewException({ ...newException, name: e.target.value })
                  }
                  className="mt-1.5 bg-white"
                />
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Category")}</Label>
              <Input disabled value={t("Compliance")} className="mt-1.5 bg-slate-50" />
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Framework")}</Label>
              <Input disabled value={framework.name} className="mt-1.5 bg-slate-50" />
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Requirement Code")}</Label>
              <Input disabled value={selectedRequirement?.code || ""} className="mt-1.5 bg-slate-50" />
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Description/Justification")}</Label>
              <Textarea
                value={newException.description}
                onChange={(e) =>
                  setNewException({
                    ...newException,
                    description: e.target.value,
                  })
                }
                className="mt-1.5 bg-white"
              />
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
              <Label className="text-sm font-medium text-slate-700">{t("End Date")}</Label>
              <Input
                type="date"
                value={newException.endDate}
                onChange={(e) =>
                  setNewException({ ...newException, endDate: e.target.value })
                }
                className="mt-1.5 bg-white"
              />
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button
              variant="outline"
              onClick={() => {
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
        <DialogContent className="sm:max-w-[700px] p-0 gap-0 max-h-[90vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Import Requirements")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-5">
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
                <input
                  type="file"
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
              <Download className="h-4 w-4 mr-2" />
              {t("Download Template")}
            </Button>
          </div>

          {/* Fixed Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
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
        <DialogContent className="sm:max-w-[700px] p-0 gap-0 max-h-[90vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Update Requirement")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Requirement Code")}</Label>
                <Input
                  value={updateRequirement.code}
                  onChange={(e) =>
                    setUpdateRequirement({ ...updateRequirement, code: e.target.value })
                  }
                  className="mt-1.5 bg-white"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Requirement Name")}</Label>
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
                <Label className="text-sm font-medium text-slate-700">{t("Requirement Type")}</Label>
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
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
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
