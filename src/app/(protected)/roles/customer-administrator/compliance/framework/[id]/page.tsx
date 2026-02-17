"use client";

import * as XLSX from "xlsx";
import { useEffect, useState, use, useRef, Fragment } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft,
  ChevronDown,
  Plus,
  Download,
  Edit2,
  Link2,
  AlertTriangle,
  ChevronRight,
  Home,
  Search,
  X,
  FileText,
  Unlink,
  Clock,
  User,
  Shield,
  Settings,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Unauthorized } from "@/components/ui/unauthorized";
import Link from "next/link";
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

export default function CustomerAdminFrameworkDetailPage({
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
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [openCatIds, setOpenCatIds] = useState<string[]>([]);
  const [expandedReqId, setExpandedReqId] = useState<string | null>(null);

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
  const [excErrors, setExcErrors] = useState<Record<string, string>>({});

  // SOA state
  const [soaExpandedCats, setSoaExpandedCats] = useState<string[]>([]);
  const [soaSearch, setSoaSearch] = useState("");
  const [soaStatusFilter, setSoaStatusFilter] = useState("all");

  // Audit Logs state
  const [auditLogSearch, setAuditLogSearch] = useState("");
  const [auditLogActionFilter, setAuditLogActionFilter] = useState("all");
  const [auditLogPage, setAuditLogPage] = useState(1);
  const AUDIT_LOG_PAGE_SIZE = 10;

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
    const errors: Record<string, string> = {};
    if (!newRequirement.name.trim()) errors.name = t("Requirement name should not be empty.");
    if (!newRequirement.category.trim()) errors.category = t("Requirement category should not be empty.");
    if (!newRequirement.code.trim()) errors.code = t("Requirement code should not be empty.");
    if (Object.keys(errors).length > 0) {
      setReqErrors(errors);
      return;
    }
    setReqErrors({});
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
        setReqErrors({});
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

  const handleExportAuditLogs = () => {
    if (filteredAuditLogs.length === 0) {
      toast({ title: t("No audit logs available to export"), variant: "destructive" });
      return;
    }

    const headers = ["User", "Action", "Target", "Details", "Date & Time"];
    const rows = filteredAuditLogs.map((log) => [
      log.user,
      log.action,
      log.target,
      log.detail,
      formatAuditDate(log.timestamp),
    ]);

    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Auto-fit column widths
    ws["!cols"] = headers.map((_, i) => ({
      wch: Math.max(
        headers[i].length,
        ...rows.map((row) => (row[i] || "").toString().length)
      ) + 2,
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Audit Logs");

    const fileName = `${(framework?.name || "Framework")} Audit Log Report.xlsx`;
    const wbOut = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbOut], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({ title: t("Exported"), description: t("Audit logs exported successfully") });
  };

  const handleExportSOA = () => {
    if (soaCategories.length === 0) {
      toast({ title: t("No SOA data available to export"), variant: "destructive" });
      return;
    }

    const headers = ["Category", "Code", "Requirement", "Applicable", "Justification", "Impl. Status", "Compliance"];
    const rows: string[][] = [];

    soaCategories.forEach((cat) => {
      (cat.children || []).forEach((req) => {
        rows.push([
          cat.name || "",
          req.code || "",
          req.name || "",
          req.applicability || "",
          req.justification || "",
          req.implementationStatus || "",
          req.controlCompliance || "Non Compliant",
        ]);
      });
    });

    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Auto-fit column widths
    ws["!cols"] = headers.map((_, i) => ({
      wch: Math.max(
        headers[i].length,
        ...rows.map((row) => (row[i] || "").toString().length)
      ) + 2,
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SOA");

    const fileName = `${(framework?.name || "Framework")} SOA Report.xlsx`;
    const wbOut = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbOut], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({ title: t("Exported"), description: t("SOA report exported successfully") });
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
        setExcErrors({});
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
      <div className="space-y-4 sm:space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs sm:text-sm overflow-x-auto whitespace-nowrap">
          <Link href="/roles/customer-administrator/compliance" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
            <Home className="h-4 w-4" />
            <span>{t("Compliance")}</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <Link href="/roles/customer-administrator/compliance/framework" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Integrated Frameworks")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-primary-700 font-medium">{t("Framework Details")}</span>
        </nav>

        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Framework Details")}</h1>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
              <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
            </div>
            <p className="text-sm text-slate-500 font-medium">{t("Loading framework...")}</p>
          </div>
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

  // Block access to not-subscribed frameworks
  if (framework.status !== "Subscribed") {
    return (
      <Unauthorized
        title={t("Framework Not Subscribed")}
        description={t("You do not have access to this framework. Please subscribe to view its contents.")}
      />
    );
  }

  // Use dummy data if no requirements from API
  const hasApiRequirements = framework.requirements && framework.requirements.length > 0;
  const requirementsToUse = hasApiRequirements ? framework.requirements : [];

  // Build hierarchy from API data (show empty state if no requirements)
  const requirementHierarchy = hasApiRequirements
    ? buildHierarchy(requirementsToUse)
    : [];
  const filteredHierarchy = filterRequirements(requirementHierarchy);

  // Categories filtered by category dropdown
  const categoriesAll = selectedCategoryId === "all"
    ? filteredHierarchy
    : filteredHierarchy.filter(c => c.id === selectedCategoryId);

  // Apply status filter to requirements within categories
  const categoriesToDisplay = statusFilter === "all"
    ? categoriesAll
    : categoriesAll.map(cat => ({
        ...cat,
        children: cat.children?.filter(r => r.controlCompliance === statusFilter),
      })).filter(cat => (cat.children?.length || 0) > 0);

  // Accordion helpers
  const toggleCategory = (catId: string) => {
    setOpenCatIds(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  const effectiveOpenCatIds = openCatIds.length === 0 && categoriesToDisplay.length > 0 && !searchTerm
    ? [categoriesToDisplay[0].id]
    : openCatIds;

  const displayOpenCatIds = searchTerm
    ? categoriesToDisplay.map(c => c.id)
    : effectiveOpenCatIds;

  // SOA data - grouped by category with search/filter
  const soaHierarchy = hasApiRequirements
    ? buildHierarchy(requirementsToUse)
    : [];

  // Apply SOA search and status filter, keep category grouping for separator rows
  const soaCategories = soaHierarchy.map(cat => {
    const filtered = (cat.children || []).filter(req => {
      const matchesSearch = !soaSearch ||
        req.name.toLowerCase().includes(soaSearch.toLowerCase()) ||
        req.code.toLowerCase().includes(soaSearch.toLowerCase());
      const matchesStatus = soaStatusFilter === "all" || req.controlCompliance === soaStatusFilter;
      return matchesSearch && matchesStatus;
    });
    return { ...cat, children: filtered };
  }).filter(cat => (cat.children || []).length > 0);

  const soaTotalRequirements = soaCategories.reduce((sum, cat) => sum + (cat.children?.length || 0), 0);

  // Expand all categories by default when no user interaction yet
  const soaEffectiveExpanded = soaExpandedCats.length === 0 && soaCategories.length > 0
    ? soaCategories.map(c => c.id)
    : soaExpandedCats;

  const toggleSoaCat = (catId: string) => {
    setSoaExpandedCats(prev => {
      // If using default (all expanded), initialize with all then toggle
      const current = prev.length === 0 ? soaCategories.map(c => c.id) : prev;
      return current.includes(catId)
        ? current.filter(id => id !== catId)
        : [...current, catId];
    });
  };

  // Audit Logs - dummy data
  const dummyAuditLogs = [
    { id: "1", user: "BTS Customer Admin", action: "Updated", target: "Requirement 4.2 - Applicability", detail: "Changed from 'No' to 'Yes'", timestamp: "2026-02-09T14:32:00Z", category: "SOA" },
    { id: "2", user: "BTS Customer Admin", action: "Updated", target: "Requirement 6.1 - Implementation Status", detail: "Changed from 'No' to 'Ongoing'", timestamp: "2026-02-09T14:28:00Z", category: "SOA" },
    { id: "3", user: "Abhishek Kumar", action: "Linked", target: "Control AC-001 to Requirement 5.1", detail: "Access Control Policy linked", timestamp: "2026-02-09T13:45:00Z", category: "Control" },
    { id: "4", user: "BTS Customer Admin", action: "Created", target: "Exception EXC-003", detail: "New exception for Requirement 7.4", timestamp: "2026-02-09T11:20:00Z", category: "Exception" },
    { id: "5", user: "Abhishek Kumar", action: "Updated", target: "Requirement 9.1 - Compliance Status", detail: "Changed from 'Non Compliant' to 'Partial Compliant'", timestamp: "2026-02-08T16:55:00Z", category: "SOA" },
    { id: "6", user: "BTS Customer Admin", action: "Created", target: "Requirement 10.2", detail: "Nonconformity and corrective action added", timestamp: "2026-02-08T15:30:00Z", category: "Requirement" },
    { id: "7", user: "Abhishek Kumar", action: "Unlinked", target: "Control SC-005 from Requirement 8.2", detail: "Security Configuration removed", timestamp: "2026-02-08T14:10:00Z", category: "Control" },
    { id: "8", user: "BTS Customer Admin", action: "Updated", target: "Requirement 7.5.2 - Justification", detail: "Added justification text", timestamp: "2026-02-08T11:45:00Z", category: "SOA" },
    { id: "9", user: "Abhishek Kumar", action: "Approved", target: "Exception EXC-001", detail: "Exception approved for Requirement 4.1", timestamp: "2026-02-07T17:20:00Z", category: "Exception" },
    { id: "10", user: "BTS Customer Admin", action: "Updated", target: "Framework Status", detail: "Changed from 'Draft' to 'Active'", timestamp: "2026-02-07T15:00:00Z", category: "Framework" },
    { id: "11", user: "Abhishek Kumar", action: "Linked", target: "Control RM-003 to Requirement 6.1.2", detail: "Risk Management control linked", timestamp: "2026-02-07T13:30:00Z", category: "Control" },
    { id: "12", user: "BTS Customer Admin", action: "Created", target: "Requirement 6.3", detail: "Planning of changes added", timestamp: "2026-02-07T10:15:00Z", category: "Requirement" },
    { id: "13", user: "Abhishek Kumar", action: "Updated", target: "Requirement 5.3 - Implementation Status", detail: "Changed from 'Yes' to 'No'", timestamp: "2026-02-06T16:40:00Z", category: "SOA" },
    { id: "14", user: "BTS Customer Admin", action: "Deleted", target: "Exception EXC-002", detail: "Expired exception removed", timestamp: "2026-02-06T14:25:00Z", category: "Exception" },
    { id: "15", user: "Abhishek Kumar", action: "Created", target: "Exception EXC-002", detail: "Temporary exception for Requirement 5.3", timestamp: "2026-02-06T11:00:00Z", category: "Exception" },
    { id: "16", user: "BTS Customer Admin", action: "Updated", target: "Requirement 8.1 - Applicability", detail: "Changed from 'No' to 'Yes'", timestamp: "2026-02-05T15:50:00Z", category: "SOA" },
    { id: "17", user: "Abhishek Kumar", action: "Linked", target: "Control IA-002 to Requirement 9.2", detail: "Internal Audit control linked", timestamp: "2026-02-05T13:20:00Z", category: "Control" },
    { id: "18", user: "BTS Customer Admin", action: "Updated", target: "Framework Description", detail: "Updated framework scope description", timestamp: "2026-02-05T10:45:00Z", category: "Framework" },
  ];

  const filteredAuditLogs = dummyAuditLogs.filter(log => {
    const matchesSearch = !auditLogSearch ||
      log.user.toLowerCase().includes(auditLogSearch.toLowerCase()) ||
      log.target.toLowerCase().includes(auditLogSearch.toLowerCase()) ||
      log.detail.toLowerCase().includes(auditLogSearch.toLowerCase());
    const matchesAction = auditLogActionFilter === "all" || log.action === auditLogActionFilter;
    return matchesSearch && matchesAction;
  });

  const auditLogTotalPages = Math.ceil(filteredAuditLogs.length / AUDIT_LOG_PAGE_SIZE);
  const paginatedAuditLogs = filteredAuditLogs.slice(
    (auditLogPage - 1) * AUDIT_LOG_PAGE_SIZE,
    auditLogPage * AUDIT_LOG_PAGE_SIZE
  );

  const formatAuditDate = (isoString: string) => {
    const date = new Date(isoString);
    const day = date.getDate().toString().padStart(2, "0");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    const h = hours % 12 || 12;
    return `${day} ${month} ${year}, ${h}:${minutes} ${ampm}`;
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "Created":
        return "bg-green-50 text-green-700";
      case "Updated":
        return "bg-blue-50 text-blue-700";
      case "Deleted":
        return "bg-red-50 text-red-700";
      case "Linked":
        return "bg-purple-50 text-purple-700";
      case "Unlinked":
        return "bg-orange-50 text-orange-700";
      case "Approved":
        return "bg-emerald-50 text-emerald-700";
      default:
        return "bg-slate-50 text-slate-700";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "SOA":
        return <FileText className="h-4 w-4" />;
      case "Control":
        return <Shield className="h-4 w-4" />;
      case "Exception":
        return <AlertTriangle className="h-4 w-4" />;
      case "Requirement":
        return <FileText className="h-4 w-4" />;
      case "Framework":
        return <Settings className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs sm:text-sm overflow-x-auto whitespace-nowrap">
        <Link href="/roles/customer-administrator/compliance" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Compliance")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/roles/customer-administrator/compliance/framework" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Integrated Frameworks")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium truncate">{framework.name}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{framework.name}</h1>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="overflow-x-auto">
          <TabsTrigger value="requirements">{t("All Requirements")}</TabsTrigger>
          <TabsTrigger value="soa">{t("SOA")}</TabsTrigger>
          <TabsTrigger value="audit-logs">{t("Audit Logs")}</TabsTrigger>
        </TabsList>

        {/* Requirements Tab */}
        <TabsContent value="requirements" className="mt-6">
          {/* Action bar + Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative w-full sm:w-64">
              <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={t("Search requirements...")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm bg-white border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm bg-white border-slate-200">
                <SelectValue placeholder={t("Status")} />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4}>
                <SelectItem value="all">{t("All Statuses")}</SelectItem>
                <SelectItem value="Compliant">{t("Compliant")}</SelectItem>
                <SelectItem value="Partial Compliant">{t("Partial Compliant")}</SelectItem>
                <SelectItem value="Non Compliant">{t("Non Compliant")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
              <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm bg-white border-slate-200">
                <SelectValue placeholder={t("Category")} />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4}>
                <SelectItem value="all">{t("All Categories")}</SelectItem>
                {filteredHierarchy.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.code} - {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto ltr:sm:ml-auto rtl:sm:mr-auto">
              <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={handleExportRequirements}>
                <Download className="h-4 w-4 me-2" />
                {t("Export")}
              </Button>
              <Button size="sm" className="w-full sm:w-auto" onClick={() => setIsAddRequirementOpen(true)}>
                <Plus className="h-4 w-4 me-2" />
                {t("New Requirement")}
              </Button>
            </div>
          </div>

          {categoriesToDisplay.length > 0 || searchTerm || selectedCategoryId !== "all" || statusFilter !== "all" ? (
            <div className="space-y-3">
              {categoriesToDisplay.map((cat) => {
                const isOpen = displayOpenCatIds.includes(cat.id);
                const allChildren = categoriesAll.find(c => c.id === cat.id)?.children || [];
                const compliantCount = allChildren.filter(r => r.controlCompliance === "Compliant").length;
                const partialCount = allChildren.filter(r => r.controlCompliance === "Partial Compliant").length;
                const nonCompCount = allChildren.length - compliantCount - partialCount;
                const totalCount = allChildren.length;
                const progressPercent = totalCount > 0 ? Math.round((compliantCount / totalCount) * 100) : 0;
                const accentColor = progressPercent >= 75 ? '#22c55e' : progressPercent >= 40 ? '#f59e0b' : '#ef4444';
                const displayChildren = cat.children || [];

                return (
                  <div
                    key={cat.id}
                    className="bg-white rounded-xl border border-slate-200 overflow-hidden"
                  >
                    {/* Category Header */}
                    <button
                      onClick={() => toggleCategory(cat.id)}
                      className={`w-full flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 sm:py-3.5 text-left transition-colors hover:bg-slate-50/80 ${isOpen ? "border-b border-slate-100" : ""}`}
                    >
                      <ChevronRight className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${isOpen ? "rotate-90" : "ltr:rotate-0 rtl:rotate-180"}`} />
                      <span className="text-sm font-semibold text-slate-800 flex-1">
                        {cat.code}. {cat.name}
                      </span>
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                        {totalCount}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-slate-500 font-medium">{compliantCount}/{totalCount}</span>
                        <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${progressPercent}%`, backgroundColor: accentColor }}
                          />
                        </div>
                      </div>
                      {/* Collapsed compliance summary */}
                      {!isOpen && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          {compliantCount > 0 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-600">
                              {compliantCount} {t("Compliant")}
                            </span>
                          )}
                          {partialCount > 0 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-600">
                              {partialCount} {t("Partial")}
                            </span>
                          )}
                          {nonCompCount > 0 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-600">
                              {nonCompCount} {t("Non Compliant")}
                            </span>
                          )}
                        </div>
                      )}
                    </button>

                    {/* Expanded: Requirement Rows */}
                    {isOpen && (
                      <div className="divide-y divide-slate-100">
                        {displayChildren.map((req) => {
                          const isExpanded = expandedReqId === req.id;
                          const controlCount = req.controls?.length || 0;

                          return (
                            <div key={req.id} className={isExpanded ? "bg-primary-50/15" : ""}>
                              {/* Requirement Row */}
                              <div
                                className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 cursor-pointer hover:bg-slate-50/60 transition-colors"
                                onClick={() => setExpandedReqId(isExpanded ? null : req.id)}
                              >
                                {/* Status dot */}
                                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                  req.controlCompliance === "Compliant" ? "bg-green-500" :
                                  req.controlCompliance === "Partial Compliant" ? "bg-amber-500" :
                                  "bg-red-500"
                                }`} />

                                {/* Code */}
                                <span className="text-sm font-bold text-primary-600 shrink-0">{req.code}</span>

                                {/* Name */}
                                <span className="text-sm text-slate-700 flex-1 truncate">{req.name}</span>

                                {/* Implementation status */}
                                <span className={`text-[11px] font-medium shrink-0 ${
                                  req.implementationStatus === "Yes" ? "text-green-600" :
                                  req.implementationStatus === "Ongoing" ? "text-amber-600" :
                                  req.implementationStatus === "No" ? "text-red-600" :
                                  "text-slate-400"
                                }`}>
                                  {t(req.implementationStatus || "-")}
                                </span>

                                {/* Control count */}
                                <span className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
                                  <Link2 className="h-3 w-3" />
                                  {controlCount}
                                </span>

                                {/* Chevron */}
                                <ChevronDown className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                              </div>

                              {/* Expanded Detail */}
                              {isExpanded && (
                                <div className="px-3 sm:px-5 pb-4 ltr:sm:pl-[52px] rtl:sm:pr-[52px]">
                                  <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                                    {/* Description */}
                                    {req.description && (
                                      <div className="px-3 sm:px-4 py-3 border-b border-slate-100">
                                        <p className="text-sm text-slate-600 leading-relaxed">{req.description}</p>
                                      </div>
                                    )}

                                    {/* Metadata + Actions */}
                                    <div className="px-3 sm:px-4 py-3 border-b border-slate-100">
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs text-slate-500">{t("Applicability")}</span>
                                          <span className="text-xs font-medium text-slate-700">{t(req.applicability || "-")}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs text-slate-500">{t("Implementation")}</span>
                                          <span className={`text-xs font-medium ${
                                            req.implementationStatus === "Yes" ? "text-green-600" :
                                            req.implementationStatus === "Ongoing" ? "text-amber-600" :
                                            req.implementationStatus === "No" ? "text-red-600" :
                                            "text-slate-600"
                                          }`}>{t(req.implementationStatus || "-")}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs text-slate-500">{t("Type")}</span>
                                          <span className="text-xs font-medium text-slate-700">{t(req.requirementType)}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs text-slate-500">{t("Compliance")}</span>
                                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                            req.controlCompliance === "Compliant" ? "bg-green-50 text-green-700" :
                                            req.controlCompliance === "Partial Compliant" ? "bg-amber-50 text-amber-700" :
                                            "bg-red-50 text-red-700"
                                          }`}>
                                            {t(req.controlCompliance || "Non Compliant")}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex flex-wrap justify-end gap-2 mt-3">
                                        <Button variant="outline" size="sm" className="h-7 text-xs text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700 w-full sm:w-auto" onClick={(e) => { e.stopPropagation(); setSelectedRequirement(req); setIsAddExceptionOpen(true); }}>
                                          <AlertTriangle className="h-3 w-3 me-1.5" />
                                          {t("Add Exception")}
                                        </Button>
                                        <Button variant="outline" size="sm" className="h-7 text-xs w-full sm:w-auto" onClick={(e) => { e.stopPropagation(); handleOpenUpdateRequirement(req); }}>
                                          <Edit2 className="h-3 w-3 me-1.5" />
                                          {t("Edit")}
                                        </Button>
                                      </div>
                                    </div>

                                    {/* Linked Controls */}
                                    <div className="px-3 sm:px-4 py-3">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                                          {t("Linked Controls")}
                                          <span className="ltr:ml-1.5 rtl:mr-1.5 text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                                            {controlCount}
                                          </span>
                                        </span>
                                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); setSelectedRequirement(req); setIsLinkControlsOpen(true); }}>
                                          <Plus className="h-3 w-3 me-1" />
                                          {t("Link")}
                                        </Button>
                                      </div>
                                      {controlCount === 0 ? (
                                        <div className="py-4 text-center">
                                          <Link2 className="h-5 w-5 text-slate-300 mx-auto mb-1.5" />
                                          <p className="text-xs text-slate-400">{t("No controls linked yet")}</p>
                                        </div>
                                      ) : (
                                        <div className="rounded-lg border border-slate-200 overflow-hidden divide-y divide-slate-100">
                                          {req.controls!.map((rc) => (
                                            <div
                                              key={rc.id}
                                              className="flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 transition-colors group cursor-pointer"
                                              onClick={() => router.push(`/compliance/control/${rc.control.id}`)}
                                            >
                                              <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-6 h-6 rounded-md bg-primary-50 flex items-center justify-center shrink-0">
                                                  <FileText className="h-3 w-3 text-primary-500" />
                                                </div>
                                                <span className="text-sm font-medium text-primary-600">{rc.control.controlCode}</span>
                                                <span className="text-xs text-slate-400 truncate">{rc.control.name}</span>
                                              </div>
                                              <div className="flex items-center gap-2 shrink-0">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                                  rc.control.status === "Compliant" ? "bg-green-50 text-green-600" :
                                                  rc.control.status === "Partial Compliant" ? "bg-amber-50 text-amber-600" :
                                                  "bg-red-50 text-red-600"
                                                }`}>
                                                  {t(rc.control.status)}
                                                </span>
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-6 w-6 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all"
                                                  onClick={(e) => { e.stopPropagation(); handleUnlinkControl(req.id, rc.controlId); }}
                                                  title={t("Unlink control")}
                                                >
                                                  <Unlink className="h-3 w-3" />
                                                </Button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {displayChildren.length === 0 && (
                          <div className="px-5 py-6 text-center">
                            <p className="text-xs text-slate-400">{t("No requirements match your filters.")}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {categoriesToDisplay.length === 0 && (
                <div className="bg-white rounded-xl border border-slate-200 px-5 py-12 text-center text-sm text-slate-400">
                  {t("No requirements match your search.")}
                </div>
              )}
            </div>
          ) : (
            /* Empty State */
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-4">
                <FileText className="h-6 w-6 text-primary-500" />
              </div>
              <h3 className="text-base font-semibold text-slate-800 mb-1">{t("No Requirements")}</h3>
              <p className="text-sm text-slate-500 mb-6">{t("Add your first requirement to get started.")}</p>
              <Button size="sm" onClick={() => setIsAddRequirementOpen(true)}>
                <Plus className="h-4 w-4 me-2" />
                {t("New Requirement")}
              </Button>
            </div>
          )}
        </TabsContent>

        {/* SOA Tab */}
        <TabsContent value="soa" className="mt-6">
          {/* Top bar: count, search, filter, actions */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="text-sm text-slate-500">{soaTotalRequirements} {t("requirements")}</span>
            <div className="relative w-full sm:w-56 ltr:sm:ml-auto rtl:sm:mr-auto">
              <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={t("Search requirements...")}
                value={soaSearch}
                onChange={(e) => setSoaSearch(e.target.value)}
                className="w-full ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm bg-white border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
              />
            </div>
            <Select value={soaStatusFilter} onValueChange={(v) => setSoaStatusFilter(v)}>
              <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm bg-white border-slate-200">
                <SelectValue placeholder={t("All Statuses")} />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4}>
                <SelectItem value="all">{t("All Statuses")}</SelectItem>
                <SelectItem value="Compliant">{t("Compliant")}</SelectItem>
                <SelectItem value="Partial Compliant">{t("Partial Compliant")}</SelectItem>
                <SelectItem value="Non Compliant">{t("Non Compliant")}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={handleExportSOA}>
              <Download className="h-4 w-4 me-2" />
              {t("Download Report")}
            </Button>
            <Button size="sm" className="w-full sm:w-auto">{t("Save")}</Button>
          </div>

          {/* Accordion Cards - one per category */}
          <div className="space-y-4">
            {soaCategories.map((cat) => {
              const isExpanded = soaEffectiveExpanded.includes(cat.id);
              const requirements = cat.children || [];
              return (
                <div key={cat.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  {/* Card Header - clickable */}
                  <button
                    onClick={() => toggleSoaCat(cat.id)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/60 transition-colors"
                  >
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? "" : "ltr:-rotate-90 rtl:rotate-90"}`} />
                    <span className="text-sm font-semibold text-slate-800">{cat.name}</span>
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      {requirements.length}
                    </span>
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="overflow-x-auto">
                      {/* Column Headers */}
                      <div className="grid grid-cols-[70px_1fr_100px_1fr_120px_120px] gap-4 px-3 sm:px-5 py-2.5 bg-slate-50 border-t border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[700px]">
                        <span>{t("Code")}</span>
                        <span>{t("Requirement")}</span>
                        <span>{t("Applicable")}</span>
                        <span>{t("Justification")}</span>
                        <span>{t("Impl. Status")}</span>
                        <span>{t("Compliance")}</span>
                      </div>

                      {/* Requirement rows */}
                      <div className="divide-y divide-slate-100">
                        {requirements.map((req) => (
                          <div key={req.id} className="grid grid-cols-[70px_1fr_100px_1fr_120px_120px] gap-4 px-3 sm:px-5 py-3.5 items-center hover:bg-slate-50/60 transition-colors min-w-[700px]">
                            <span className="text-sm font-medium text-slate-800">{req.code}</span>
                            <span className="text-sm text-slate-700 leading-snug">{req.name}</span>
                            <Select
                              value={req.applicability || ""}
                              onValueChange={(value) => handleSOAUpdate(req.id, "applicability", value)}
                            >
                              <SelectTrigger className="h-8 text-sm bg-white border-slate-200 w-full">
                                <SelectValue placeholder="-" />
                              </SelectTrigger>
                              <SelectContent position="popper" sideOffset={4}>
                                <SelectItem value="Yes">{t("Yes")}</SelectItem>
                                <SelectItem value="No">{t("No")}</SelectItem>
                              </SelectContent>
                            </Select>
                            <input
                              type="text"
                              className="h-8 px-3 text-sm bg-slate-50 border border-slate-200 rounded-md w-full placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
                              value={req.justification || ""}
                              onChange={(e) => handleSOAUpdate(req.id, "justification", e.target.value)}
                              placeholder={t("Enter justification...")}
                            />
                            <Select
                              value={req.implementationStatus || ""}
                              onValueChange={(value) => handleSOAUpdate(req.id, "implementationStatus", value)}
                            >
                              <SelectTrigger className="h-8 text-sm bg-white border-slate-200 w-full">
                                <SelectValue placeholder="-" />
                              </SelectTrigger>
                              <SelectContent position="popper" sideOffset={4}>
                                <SelectItem value="Yes">{t("Yes")}</SelectItem>
                                <SelectItem value="No">{t("No")}</SelectItem>
                                <SelectItem value="Ongoing">{t("Ongoing")}</SelectItem>
                                <SelectItem value="N/A">{t("N/A")}</SelectItem>
                              </SelectContent>
                            </Select>
                            <div>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  req.controlCompliance === "Compliant"
                                    ? "bg-green-50 text-green-700"
                                    : req.controlCompliance === "Partial Compliant"
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-red-50 text-red-700"
                                }`}
                              >
                                {t(req.controlCompliance || "Non Compliant")}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Empty state when no categories match */}
            {soaCategories.length === 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <p className="text-sm text-slate-400">{t("No requirements match your search.")}</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Audit Logs Tab */}
        <TabsContent value="audit-logs" className="mt-6">
          {/* Top bar: search, filter, export */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative w-full sm:w-56">
              <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={t("Search logs...")}
                value={auditLogSearch}
                onChange={(e) => { setAuditLogSearch(e.target.value); setAuditLogPage(1); }}
                className="w-full ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm bg-white border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
              />
            </div>
            <div className="hidden sm:block ltr:ml-auto rtl:mr-auto"></div>
            <Select value={auditLogActionFilter} onValueChange={(v) => { setAuditLogActionFilter(v); setAuditLogPage(1); }}>
              <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm bg-white border-slate-200">
                <SelectValue placeholder={t("All Actions")} />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4}>
                <SelectItem value="all">{t("All Actions")}</SelectItem>
                <SelectItem value="Created">{t("Created")}</SelectItem>
                <SelectItem value="Updated">{t("Updated")}</SelectItem>
                <SelectItem value="Deleted">{t("Deleted")}</SelectItem>
                <SelectItem value="Linked">{t("Linked")}</SelectItem>
                <SelectItem value="Unlinked">{t("Unlinked")}</SelectItem>
                <SelectItem value="Approved">{t("Approved")}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={handleExportAuditLogs}>
              <Download className="h-4 w-4 me-2" />
              {t("Export")}
            </Button>
          </div>

          {/* Audit Log Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
            {/* Column Headers */}
            <div className="grid grid-cols-[180px_100px_1fr_1fr_170px] gap-4 px-3 sm:px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[800px]">
              <span>{t("User")}</span>
              <span>{t("Action")}</span>
              <span>{t("Target")}</span>
              <span>{t("Details")}</span>
              <span>{t("Date & Time")}</span>
            </div>

            {/* Log rows */}
            <div className="divide-y divide-slate-100">
              {paginatedAuditLogs.map((log) => (
                <div key={log.id} className="grid grid-cols-[180px_100px_1fr_1fr_170px] gap-4 px-3 sm:px-5 py-3.5 items-center hover:bg-slate-50/60 transition-colors min-w-[800px]">
                  {/* User */}
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-primary-50 flex items-center justify-center shrink-0">
                      <User className="h-3.5 w-3.5 text-primary-600" />
                    </div>
                    <span className="text-sm font-medium text-slate-800 truncate">{log.user}</span>
                  </div>
                  {/* Action badge */}
                  <div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getActionBadge(log.action)}`}>
                      {t(log.action)}
                    </span>
                  </div>
                  {/* Target */}
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded bg-slate-100 flex items-center justify-center shrink-0 text-slate-400">
                      {getCategoryIcon(log.category)}
                    </div>
                    <span className="text-sm text-slate-700 truncate">{log.target}</span>
                  </div>
                  {/* Details */}
                  <span className="text-sm text-slate-500 truncate">{log.detail}</span>
                  {/* Timestamp */}
                  <div className="flex items-center gap-1.5 text-sm text-slate-500">
                    <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>{formatAuditDate(log.timestamp)}</span>
                  </div>
                </div>
              ))}
              {paginatedAuditLogs.length === 0 && (
                <div className="px-5 py-12 text-center">
                  <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <Clock className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="text-sm text-slate-500">{t("No audit logs match your search.")}</p>
                </div>
              )}
            </div>
            </div>

            {/* Pagination */}
            {filteredAuditLogs.length > 0 && (
              <div className="flex items-center justify-between px-3 sm:px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                <span className="text-xs text-slate-500">
                  {t("Showing")} {((auditLogPage - 1) * AUDIT_LOG_PAGE_SIZE) + 1} {t("to")} {Math.min(auditLogPage * AUDIT_LOG_PAGE_SIZE, filteredAuditLogs.length)} {t("of")} {filteredAuditLogs.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setAuditLogPage(p => Math.max(1, p - 1))}
                    disabled={auditLogPage === 1}
                    className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setAuditLogPage(p => Math.min(auditLogTotalPages, p + 1))}
                    disabled={auditLogPage === auditLogTotalPages}
                    className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Requirement Dialog */}
      <Dialog open={isAddRequirementOpen} onOpenChange={(open) => { if (!open) { setReqErrors({}); } setIsAddRequirementOpen(open); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0 max-h-[90vh] flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Sticky Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add Requirement")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
            <p className="text-sm text-slate-500">
              {t("To add a requirement to this framework, please accurately fill in the fields below.")}
            </p>

            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Requirement Name")} <span className="text-red-500">*</span></Label>
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
              <Label className="text-sm font-medium text-slate-700">{t("Requirement Category")} <span className="text-red-500">*</span></Label>
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
              <Label className="text-sm font-medium text-slate-700">{t("Requirement Code")} <span className="text-red-500">*</span></Label>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Requirement Type")}</Label>
                <Select
                  value={newRequirement.requirementType}
                  onValueChange={(value) =>
                    setNewRequirement({ ...newRequirement, requirementType: value })
                  }
                >
                  <SelectTrigger className="mt-1.5 bg-white w-full">
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
                  <SelectTrigger className="mt-1.5 bg-white w-full">
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
          </div>

          {/* Sticky Footer */}
          <div className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => { setReqErrors({}); setIsAddRequirementOpen(false); }}
            >
              {t("Cancel")}
            </Button>
            <Button
              onClick={handleAddRequirement}
            >
              {t("Add Requirement")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Link Controls Dialog */}
      <Dialog open={isLinkControlsOpen} onOpenChange={setIsLinkControlsOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0 max-h-[90vh] flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Sticky Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Control Select")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-4 overflow-y-auto flex-1">
            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <Select
                value={controlFilters.domainId || "all"}
                onValueChange={(value) =>
                  setControlFilters({ ...controlFilters, domainId: value === "all" ? "" : value })
                }
              >
                <SelectTrigger className="bg-white w-full">
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
                <SelectTrigger className="bg-white w-full">
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

          {/* Sticky Footer */}
          <div className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex-shrink-0">
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
              {t("Link Controls")} ({selectedControlIds.length})
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Exception Dialog */}
      <Dialog open={isAddExceptionOpen} onOpenChange={(open) => { if (!open) { setExcErrors({}); } setIsAddExceptionOpen(open); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[600px] p-0 gap-0 max-h-[90vh] flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add Exception")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
            {/* Context Info - Read-only summary */}
            <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 sm:p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">{t("Exception Code")}</span>
                  <p className="text-sm font-medium text-slate-500 italic mt-0.5">{t("Auto-generated")}</p>
                </div>
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">{t("Category")}</span>
                  <p className="text-sm font-medium text-slate-700 mt-0.5">{t("Compliance")}</p>
                </div>
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">{t("Framework")}</span>
                  <p className="text-sm font-medium text-slate-700 mt-0.5">{framework.name}</p>
                </div>
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">{t("Requirement")}</span>
                  <p className="text-sm font-medium text-slate-700 mt-0.5">{selectedRequirement?.code || "-"}</p>
                </div>
              </div>
            </div>

            {/* Editable Fields */}
            <div>
              <Label className="text-sm font-medium text-slate-700">
                {t("Exception Name")} <span className="text-red-500">*</span>
              </Label>
              <Input
                value={newException.name}
                onChange={(e) => {
                  setNewException({ ...newException, name: e.target.value });
                  if (excErrors.name) { setExcErrors((prev) => { const { name, ...rest } = prev; return rest; }); }
                }}
                placeholder={t("Enter exception name")}
                className={`mt-1.5 bg-white ${excErrors.name ? "border-red-500 focus:ring-red-500" : ""}`}
              />
              {excErrors.name && (
                <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                  <p className="text-sm text-red-600">{excErrors.name}</p>
                </div>
              )}
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
                placeholder={t("Provide justification for this exception")}
                className={`mt-1.5 bg-white min-h-[100px] ${excErrors.description ? "border-red-500 focus:ring-red-500" : ""}`}
              />
              {excErrors.description && (
                <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                  <p className="text-sm text-red-600">{excErrors.description}</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Status")}</Label>
                <Select
                  value={newException.status}
                  onValueChange={(value) =>
                    setNewException({ ...newException, status: value })
                  }
                >
                  <SelectTrigger className="mt-1.5 bg-white w-full">
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
                    <SelectItem value="RiskAccepted">{t("Risk Accepted")}</SelectItem>
                    <SelectItem value="Closed">{t("Closed")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("End Date")} <span className="text-red-500">*</span></Label>
                <DatePicker
                  value={newException.endDate}
                  onChange={(date) => {
                    setNewException({ ...newException, endDate: date ? date.toISOString().split("T")[0] : "" });
                    if (excErrors.endDate) { setExcErrors((prev) => { const { endDate, ...rest } = prev; return rest; }); }
                  }}
                  placeholder={t("Select date")}
                  className="mt-1.5 bg-white"
                />
                {excErrors.endDate && (
                  <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                    <p className="text-sm text-red-600">{excErrors.endDate}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex-shrink-0">
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

      {/* Update Requirement Dialog */}
      <Dialog open={isUpdateRequirementOpen} onOpenChange={setIsUpdateRequirementOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0 max-h-[90vh] flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Sticky Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Update Requirement")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Requirement Type")}</Label>
                <Select
                  value={updateRequirement.requirementType}
                  onValueChange={(value) =>
                    setUpdateRequirement({ ...updateRequirement, requirementType: value })
                  }
                >
                  <SelectTrigger className="mt-1.5 bg-white w-full">
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
                  <SelectTrigger className="mt-1.5 bg-white w-full">
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Applicability")}</Label>
                <Select
                  value={updateRequirement.applicability}
                  onValueChange={(value) =>
                    setUpdateRequirement({ ...updateRequirement, applicability: value })
                  }
                >
                  <SelectTrigger className="mt-1.5 bg-white w-full">
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
                  <SelectTrigger className="mt-1.5 bg-white w-full">
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
                  <SelectTrigger className="mt-1.5 bg-white w-full">
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

          {/* Sticky Footer */}
          <div className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex-shrink-0">
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
