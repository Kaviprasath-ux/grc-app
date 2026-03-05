"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { DataGrid } from "@/components/shared/data-grid";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Eye, Home, ChevronRight } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";

interface ClarificationItem {
  id: string;
  department: string | null;
  vendorId: string | null;
  vendorName: string | null;
  questionNo: string | null;
  date: string | null;
  domain: string | null;
  status: string;
}

interface RemediationItem {
  id: string;
  issueId: string | null;
  vendorName: string | null;
  engagementId: string | null;
  domain: string | null;
  severity: string | null;
  responseDate: string | null;
  dueDate: string | null;
  reassignStatus: string | null;
  status: string;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString();
}

function getSeverityVariant(severity: string | null): "default" | "secondary" | "destructive" | "outline" {
  switch (severity) {
    case "High":
      return "destructive";
    case "Medium":
      return "secondary";
    case "Low":
      return "default";
    default:
      return "outline";
  }
}

export default function AsrFollowUpsPage() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "clarifications";

  const [activeTab, setActiveTab] = useState(initialTab);
  const [clarSubTab, setClarSubTab] = useState("open");
  const [remSubTab, setRemSubTab] = useState("received");
  const [clarifications, setClarifications] = useState<ClarificationItem[]>([]);
  const [remediations, setRemediations] = useState<RemediationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [cRes, rRes] = await Promise.all([
        fetch("/api/tprm/asr-follow-ups?type=clarifications&limit=200"),
        fetch("/api/tprm/asr-follow-ups?type=remediations&limit=200"),
      ]);
      if (cRes.ok) {
        const cJson = await cRes.json();
        setClarifications(cJson.data || []);
      }
      if (rRes.ok) {
        const rJson = await rRes.json();
        setRemediations(rJson.data || []);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Clarification sub-tab filtering
  const filteredClarifications = useMemo(() => {
    let data = clarifications;
    if (clarSubTab === "open") data = data.filter((c) => c.status === "Open");
    else if (clarSubTab === "vendor-response") data = data.filter((c) => c.status === "Responded");
    else if (clarSubTab === "closed") data = data.filter((c) => c.status === "Closed");

    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (c) =>
          c.vendorName?.toLowerCase().includes(q) ||
          c.department?.toLowerCase().includes(q) ||
          c.domain?.toLowerCase().includes(q)
      );
    }
    return data;
  }, [clarifications, clarSubTab, search]);

  // Remediation sub-tab filtering
  const filteredRemediations = useMemo(() => {
    let data = remediations;
    if (remSubTab === "received") data = data.filter((r) => r.status === "Received");
    else if (remSubTab === "business") data = data.filter((r) => r.reassignStatus === "Assigned to BO");
    else if (remSubTab === "it") data = data.filter((r) => r.reassignStatus === "Assigned to IT");
    else if (remSubTab === "awaiting") data = data.filter((r) => r.status === "Awaiting Vendor");
    else if (remSubTab === "closed") data = data.filter((r) => r.status === "Closed");
    else if (remSubTab === "overdue") data = data.filter((r) => r.status === "Overdue");
    else if (remSubTab === "logs") data = data;

    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (r) =>
          r.vendorName?.toLowerCase().includes(q) ||
          r.domain?.toLowerCase().includes(q) ||
          r.issueId?.toLowerCase().includes(q)
      );
    }

    if (severityFilter !== "all") {
      data = data.filter((r) => r.severity === severityFilter);
    }

    return data;
  }, [remediations, remSubTab, search, severityFilter]);

  // Clarification columns
  const clarificationColumns: ColumnDef<ClarificationItem>[] = [
    { accessorKey: "department", header: t("Department"), cell: ({ row }) => row.getValue("department") || "-" },
    { accessorKey: "vendorId", header: t("Vendor ID"), cell: ({ row }) => row.getValue("vendorId") || "-" },
    { accessorKey: "vendorName", header: t("Vendor Name"), cell: ({ row }) => row.getValue("vendorName") || "-" },
    { accessorKey: "questionNo", header: t("Question No"), cell: ({ row }) => row.getValue("questionNo") || "-" },
    { accessorKey: "date", header: t("Date"), cell: ({ row }) => formatDate(row.getValue("date")) },
    { accessorKey: "domain", header: t("Domain"), cell: ({ row }) => row.getValue("domain") || "-" },
    {
      id: "actions",
      header: t("Action"),
      cell: () => (
        <Button variant="ghost" size="sm">
          <Eye className="h-4 w-4 text-primary" />
        </Button>
      ),
    },
  ];

  // Remediation columns
  const remediationColumns: ColumnDef<RemediationItem>[] = [
    { accessorKey: "issueId", header: t("Issue ID"), cell: ({ row }) => row.getValue("issueId") || "-" },
    { accessorKey: "vendorName", header: t("Vendor Name"), cell: ({ row }) => row.getValue("vendorName") || "-" },
    { accessorKey: "engagementId", header: t("Engagement ID"), cell: ({ row }) => row.getValue("engagementId") || "-" },
    { accessorKey: "domain", header: t("Domain"), cell: ({ row }) => row.getValue("domain") || "-" },
    {
      accessorKey: "severity",
      header: t("Severity"),
      cell: ({ row }) => {
        const sev = row.getValue("severity") as string;
        return sev ? <Badge variant={getSeverityVariant(sev)}>{sev}</Badge> : "-";
      },
    },
    { accessorKey: "responseDate", header: t("Response Date"), cell: ({ row }) => formatDate(row.getValue("responseDate")) },
    { accessorKey: "dueDate", header: t("Due Date"), cell: ({ row }) => formatDate(row.getValue("dueDate")) },
    {
      accessorKey: "reassignStatus",
      header: t("Reassign Status"),
      cell: ({ row }) => row.getValue("reassignStatus") || t("Not Assigned"),
    },
    {
      id: "actions",
      header: t("Action"),
      cell: () => (
        <Button variant="ghost" size="sm">
          <Eye className="h-4 w-4 text-primary" />
        </Button>
      ),
    },
  ];

  const clarSubTabs = [
    { value: "open", label: t("Open Queries") },
    { value: "vendor-response", label: t("Vendor Response") },
    { value: "closed", label: t("Closed Queries") },
  ];

  const remSubTabs = [
    { value: "received", label: t("Received Response") },
    { value: "business", label: t("Business Issues") },
    { value: "it", label: t("IT Issues") },
    { value: "awaiting", label: t("Awaiting Vendor") },
    { value: "closed", label: t("Closed Issues") },
    { value: "overdue", label: t("Overdue Issues") },
    { value: "logs", label: t("Issue Logs") },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Follow-ups")}</span>
      </nav>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSearch(""); }}>
        <TabsList>
          <TabsTrigger value="clarifications">{t("Clarifications")}</TabsTrigger>
          <TabsTrigger value="remediations">{t("Remediations")}</TabsTrigger>
        </TabsList>

        {/* Clarifications Tab */}
        <TabsContent value="clarifications" className="mt-4 space-y-4">
          <h2 className="text-xl font-bold">{t("Clarifications")}</h2>

          {/* Sub-tabs */}
          <div className="flex gap-0 rounded-lg overflow-hidden border">
            {clarSubTabs.map((st) => (
              <button
                key={st.value}
                onClick={() => setClarSubTab(st.value)}
                className={`flex-1 py-2.5 px-4 text-sm font-medium transition-colors ${
                  clarSubTab === st.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder={t("Search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-[180px]"
              placeholder={t("Requested Date")}
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center min-h-[200px]">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <DataGrid columns={clarificationColumns} data={filteredClarifications} hideSearch />
          )}
        </TabsContent>

        {/* Remediations Tab */}
        <TabsContent value="remediations" className="mt-4 space-y-4">
          <h2 className="text-xl font-bold">{t("Remediations")}</h2>

          {/* Sub-tabs */}
          <div className="flex gap-0 rounded-lg overflow-hidden border flex-wrap">
            {remSubTabs.map((st) => (
              <button
                key={st.value}
                onClick={() => setRemSubTab(st.value)}
                className={`flex-1 py-2.5 px-3 text-sm font-medium transition-colors min-w-[120px] ${
                  remSubTab === st.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder={t("Search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="w-[160px]">
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t("Severity")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("All")}</SelectItem>
                  <SelectItem value="High">{t("High")}</SelectItem>
                  <SelectItem value="Medium">{t("Medium")}</SelectItem>
                  <SelectItem value="Low">{t("Low")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-[180px]"
              placeholder={t("Response Date")}
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center min-h-[200px]">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <DataGrid columns={remediationColumns} data={filteredRemediations} hideSearch />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
