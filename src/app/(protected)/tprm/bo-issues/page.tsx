"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Download, Search, X, Eye, MessageSquare, AlertTriangle, Home, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataGrid } from "@/components/shared";
import { ColumnDef } from "@tanstack/react-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

// ==================== TYPES ====================

interface Vendor {
  id: string;
  name: string;
  serviceCategory: string | null;
  vrr: string | null;
  contactEmail: string | null;
}

interface IssueRegisterEntry {
  id: string;
  department: string;
  vendorName: string;
  vendorId: string;
  high: number;
  medium: number;
  low: number;
  total: number;
  status: string;
}

interface IssueRemediationEntry {
  id: string;
  issueId: string;
  vendorName: string;
  domain: string;
  severity: string;
  responseDate: string;
  dueDate: string;
  status: string;
}

interface VendorIssueEntry {
  id: string;
  title: string;
  status: string;
  severity: string;
  dueDate: string;
}

// ==================== HELPERS ====================

const SEVERITY_COLORS: Record<string, string> = {
  High: "border-red-300 bg-red-50 text-red-700",
  Medium: "border-orange-300 bg-orange-50 text-orange-700",
  Low: "border-green-300 bg-green-50 text-green-700",
};

const STATUS_COLORS: Record<string, string> = {
  Open: "border-blue-300 bg-blue-50 text-blue-700",
  "In Progress": "border-yellow-300 bg-yellow-50 text-yellow-700",
  Closed: "border-slate-300 bg-slate-50 text-slate-700",
  Resolved: "border-green-300 bg-green-50 text-green-700",
  "Awaiting Response": "border-purple-300 bg-purple-50 text-purple-700",
  Rejected: "border-red-300 bg-red-50 text-red-700",
};

const DEPARTMENTS = ["IT", "Finance", "Operations", "HR", "Legal", "Procurement"];
const SEVERITIES = ["High", "Medium", "Low"];
const ISSUE_TITLES = [
  "Data encryption not enforced",
  "Expired SSL certificate",
  "Missing access control policy",
  "Incomplete incident response plan",
  "Non-compliant data retention",
  "Weak password policy",
  "Unpatched vulnerabilities",
  "Missing audit logs",
  "Inadequate backup procedures",
  "Third-party access not monitored",
];

function generateIssueData(vendors: Vendor[]) {
  const registerEntries: IssueRegisterEntry[] = [];
  const remediationEntries: IssueRemediationEntry[] = [];
  const vendorIssueEntries: VendorIssueEntry[] = [];

  vendors.forEach((v, idx) => {
    const seed = v.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const rand = (min: number, max: number, offset: number) =>
      min + ((seed + offset) % (max - min + 1));

    const high = rand(0, 3, 1);
    const medium = rand(0, 5, 2);
    const low = rand(0, 4, 3);
    const total = high + medium + low;
    const statuses = ["Open", "In Progress", "Closed", "Resolved"];
    const remStatuses = ["Open", "Closed", "Rejected"];

    if (total > 0) {
      registerEntries.push({
        id: `REG-${String(idx + 1).padStart(3, "0")}`,
        department: DEPARTMENTS[rand(0, DEPARTMENTS.length - 1, 4)],
        vendorName: v.name,
        vendorId: `V-${String(idx + 1).padStart(4, "0")}`,
        high,
        medium,
        low,
        total,
        status: statuses[rand(0, statuses.length - 1, 5)],
      });

      for (let i = 0; i < Math.min(total, 3); i++) {
        const severity = SEVERITIES[rand(0, 2, i + 6)];
        const remStatus = remStatuses[rand(0, 2, i + 9)];
        const monthOffset = rand(1, 6, i + 10);
        const responseDate = new Date(2024, monthOffset, rand(1, 28, i + 11));
        const dueDate = new Date(responseDate);
        dueDate.setMonth(dueDate.getMonth() + rand(1, 3, i + 12));

        remediationEntries.push({
          id: `REM-${String(remediationEntries.length + 1).padStart(3, "0")}`,
          issueId: `DD${rand(10, 99, i + 13)}`,
          vendorName: v.name,
          domain: v.contactEmail ? v.contactEmail.split("@")[1] || "" : "",
          severity,
          responseDate: responseDate.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }),
          dueDate: dueDate.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }),
          status: remStatus,
        });
      }

      for (let i = 0; i < Math.min(total, 2); i++) {
        const viStatuses = ["Open", "Awaiting Response", "Closed"];
        vendorIssueEntries.push({
          id: `VI-${String(vendorIssueEntries.length + 1).padStart(3, "0")}`,
          title: ISSUE_TITLES[rand(0, ISSUE_TITLES.length - 1, i + 14)],
          status: viStatuses[rand(0, 2, i + 15)],
          severity: SEVERITIES[rand(0, 2, i + 16)],
          dueDate: new Date(2024, rand(1, 11, i + 17), rand(1, 28, i + 18)).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }),
        });
      }
    }
  });

  return { registerEntries, remediationEntries, vendorIssueEntries };
}

// ==================== MAIN COMPONENT ====================

export default function BOIssuesPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  // Issue Register filters
  const [regVendorSearch, setRegVendorSearch] = useState("");
  const [regStatusFilter, setRegStatusFilter] = useState("all");

  // Issue Remediation filters
  const [remSearch, setRemSearch] = useState("");
  const [remSeverityFilter, setRemSeverityFilter] = useState("all");
  const [remSubTab, setRemSubTab] = useState("Open");

  // Vendor Issues filters
  const [viSeverityFilter, setViSeverityFilter] = useState("all");
  const [viSubTab, setViSubTab] = useState("Open");

  const loadVendors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tprm/vendors?limit=500");
      if (res.ok) {
        const data = await res.json();
        setVendors(data.data || []);
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to load data"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => { loadVendors(); }, [loadVendors]);

  const { registerEntries, remediationEntries, vendorIssueEntries } = useMemo(
    () => generateIssueData(vendors),
    [vendors]
  );

  // ==================== ISSUE REGISTER ====================

  const filteredRegister = useMemo(() => {
    return registerEntries.filter((e) => {
      const matchesSearch = regVendorSearch === "" ||
        e.vendorName.toLowerCase().includes(regVendorSearch.toLowerCase());
      const matchesStatus = regStatusFilter === "all" || e.status === regStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [registerEntries, regVendorSearch, regStatusFilter]);

  const registerColumns: ColumnDef<IssueRegisterEntry>[] = [
    {
      accessorKey: "department",
      header: t("Department"),
      cell: ({ row }) => <span className="text-sm">{row.original.department}</span>,
    },
    {
      accessorKey: "vendorName",
      header: t("Vendor Name"),
      cell: ({ row }) => <span className="font-medium text-sm">{row.original.vendorName}</span>,
    },
    {
      accessorKey: "vendorId",
      header: t("Vendor ID"),
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.vendorId}</span>,
    },
    {
      accessorKey: "high",
      header: t("High"),
      cell: ({ row }) => (
        <span className={`text-sm font-medium ${row.original.high > 0 ? "text-red-600" : "text-muted-foreground"}`}>
          {row.original.high}
        </span>
      ),
    },
    {
      accessorKey: "medium",
      header: t("Medium"),
      cell: ({ row }) => (
        <span className={`text-sm font-medium ${row.original.medium > 0 ? "text-orange-600" : "text-muted-foreground"}`}>
          {row.original.medium}
        </span>
      ),
    },
    {
      accessorKey: "low",
      header: t("Low"),
      cell: ({ row }) => (
        <span className={`text-sm font-medium ${row.original.low > 0 ? "text-green-600" : "text-muted-foreground"}`}>
          {row.original.low}
        </span>
      ),
    },
    {
      accessorKey: "total",
      header: t("Total"),
      cell: ({ row }) => <span className="text-sm font-bold">{row.original.total}</span>,
    },
    {
      accessorKey: "status",
      header: t("Status"),
      cell: ({ row }) => (
        <Badge variant="outline" className={`${STATUS_COLORS[row.original.status] || ""} text-xs font-medium`}>
          {t(row.original.status)}
        </Badge>
      ),
    },
  ];

  const handleExport = () => {
    const headers = ["Department", "Vendor Name", "Vendor ID", "High", "Medium", "Low", "Total", "Status"];
    const rows = filteredRegister.map((e) => [
      e.department, e.vendorName, e.vendorId, e.high, e.medium, e.low, e.total, e.status,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "issue-register.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ==================== ISSUE REMEDIATION ====================

  const filteredRemediation = useMemo(() => {
    return remediationEntries.filter((e) => {
      const matchesSearch = remSearch === "" ||
        e.vendorName.toLowerCase().includes(remSearch.toLowerCase()) ||
        e.issueId.toLowerCase().includes(remSearch.toLowerCase());
      const matchesSeverity = remSeverityFilter === "all" || e.severity === remSeverityFilter;
      const matchesSubTab = e.status === remSubTab;
      return matchesSearch && matchesSeverity && matchesSubTab;
    });
  }, [remediationEntries, remSearch, remSeverityFilter, remSubTab]);

  const remediationColumns: ColumnDef<IssueRemediationEntry>[] = [
    {
      accessorKey: "issueId",
      header: t("ID"),
      cell: ({ row }) => <span className="text-sm font-medium">{row.original.issueId}</span>,
    },
    {
      accessorKey: "vendorName",
      header: t("Vendor Name"),
      cell: ({ row }) => <span className="text-sm font-medium">{row.original.vendorName}</span>,
    },
    {
      accessorKey: "domain",
      header: t("Domain"),
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.domain || "-"}</span>,
    },
    {
      accessorKey: "severity",
      header: t("Severity"),
      cell: ({ row }) => (
        <Badge variant="outline" className={`${SEVERITY_COLORS[row.original.severity] || ""} text-xs font-medium`}>
          {t(row.original.severity)}
        </Badge>
      ),
    },
    {
      accessorKey: "responseDate",
      header: t("Response Date"),
      cell: ({ row }) => <span className="text-sm">{row.original.responseDate}</span>,
    },
    {
      accessorKey: "dueDate",
      header: t("Due Date"),
      cell: ({ row }) => <span className="text-sm">{row.original.dueDate}</span>,
    },
    {
      id: "comments",
      header: t("Comments"),
      cell: () => (
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
        </Button>
      ),
    },
    {
      id: "action",
      header: t("Action"),
      cell: () => (
        <Button variant="default" size="icon" className="h-8 w-8">
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  // ==================== VENDOR ISSUES ====================

  const filteredVendorIssues = useMemo(() => {
    return vendorIssueEntries.filter((e) => {
      const matchesSeverity = viSeverityFilter === "all" || e.severity === viSeverityFilter;
      const matchesSubTab = e.status === viSubTab;
      return matchesSeverity && matchesSubTab;
    });
  }, [vendorIssueEntries, viSeverityFilter, viSubTab]);

  const vendorIssueColumns: ColumnDef<VendorIssueEntry>[] = [
    {
      accessorKey: "title",
      header: t("Title"),
      cell: ({ row }) => <span className="text-sm font-medium">{row.original.title}</span>,
    },
    {
      accessorKey: "status",
      header: t("Status"),
      cell: ({ row }) => (
        <Badge variant="outline" className={`${STATUS_COLORS[row.original.status] || ""} text-xs font-medium`}>
          {t(row.original.status)}
        </Badge>
      ),
    },
    {
      accessorKey: "severity",
      header: t("Severity"),
      cell: ({ row }) => (
        <Badge variant="outline" className={`${SEVERITY_COLORS[row.original.severity] || ""} text-xs font-medium`}>
          {t(row.original.severity)}
        </Badge>
      ),
    },
    {
      accessorKey: "dueDate",
      header: t("Due Date"),
      cell: ({ row }) => <span className="text-sm">{row.original.dueDate}</span>,
    },
    {
      id: "action",
      header: t("Action"),
      cell: () => (
        <Button variant="default" size="icon" className="h-8 w-8">
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  // ==================== RENDER ====================

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Issue Management")}</span>
      </nav>
      <h1 className="text-2xl font-bold">{t("Issue Management")}</h1>

      <Tabs defaultValue="register">
        <TabsList>
          <TabsTrigger value="register">{t("Issue Register")}</TabsTrigger>
          <TabsTrigger value="remediation">{t("Issue Remediation")}</TabsTrigger>
          <TabsTrigger value="vendor-issues">{t("Vendor Issues")}</TabsTrigger>
        </TabsList>

        {/* ==================== TAB 1: ISSUE REGISTER ==================== */}
        <TabsContent value="register" className="space-y-4 mt-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("Vendor Name")}
                value={regVendorSearch}
                onChange={(e) => setRegVendorSearch(e.target.value)}
                className="pl-9"
              />
              {regVendorSearch && (
                <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setRegVendorSearch("")}>
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
            <Select value={regStatusFilter} onValueChange={setRegStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t("Status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All Statuses")}</SelectItem>
                {["Open", "In Progress", "Closed", "Resolved"].map((s) => (
                  <SelectItem key={s} value={s}>{t(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="ltr:ml-auto rtl:mr-auto">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Export")}
              </Button>
            </div>
          </div>

          {filteredRegister.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>{t("No issues found")}</p>
            </div>
          ) : (
            <DataGrid columns={registerColumns} data={filteredRegister} hideSearch />
          )}
        </TabsContent>

        {/* ==================== TAB 2: ISSUE REMEDIATION ==================== */}
        <TabsContent value="remediation" className="space-y-4 mt-4">
          {/* Sub-tabs */}
          <div className="flex gap-0">
            {["Open", "Closed", "Rejected"].map((tab) => (
              <button
                key={tab}
                onClick={() => setRemSubTab(tab)}
                className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors rounded-lg ${
                  remSubTab === tab
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {t(`${tab} Issues`)}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("Search")}
                value={remSearch}
                onChange={(e) => setRemSearch(e.target.value)}
                className="pl-9"
              />
              {remSearch && (
                <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setRemSearch("")}>
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
            <Select value={remSeverityFilter} onValueChange={setRemSeverityFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t("Severity")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All Severities")}</SelectItem>
                {SEVERITIES.map((s) => (
                  <SelectItem key={s} value={s}>{t(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredRemediation.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>{t("No issues found")}</p>
            </div>
          ) : (
            <DataGrid columns={remediationColumns} data={filteredRemediation} hideSearch />
          )}
        </TabsContent>

        {/* ==================== TAB 3: VENDOR ISSUES ==================== */}
        <TabsContent value="vendor-issues" className="space-y-4 mt-4">
          {/* Sub-tabs */}
          <div className="flex gap-0">
            {["Open", "Awaiting Response", "Closed"].map((tab) => (
              <button
                key={tab}
                onClick={() => setViSubTab(tab)}
                className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors rounded-lg ${
                  viSubTab === tab
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {t(tab)}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Select value={viSeverityFilter} onValueChange={setViSeverityFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t("Severity")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All Severities")}</SelectItem>
                {SEVERITIES.map((s) => (
                  <SelectItem key={s} value={s}>{t(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredVendorIssues.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>{t("No issues found")}</p>
            </div>
          ) : (
            <DataGrid columns={vendorIssueColumns} data={filteredVendorIssues} hideSearch />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
