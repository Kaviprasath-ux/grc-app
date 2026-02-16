"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowUpDown,
  Eye,
  Search,
  Layers,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Home,
  ChevronRight,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

interface Control {
  id: string;
  controlCode: string;
  name: string;
  description: string | null;
  functionalGrouping: string | null;
  status: string;
  entities: string;
  domain: { id: string; name: string; code?: string } | null;
  department: { id: string; name: string } | null;
  framework: { id: string; name: string } | null;
  assignee?: { id: string; name: string } | null;
  owner?: { id: string; name: string } | null;
}

interface Framework {
  id: string;
  name: string;
}

interface Customer {
  id: string;
  customerCode: string;
  customerName: string;
}

const FUNCTIONAL_GROUPINGS = [
  "Govern",
  "Identify",
  "Protect",
  "Detect",
  "Respond",
  "Recover",
];

const DONUT_COLORS = [
  "#3b82f6", // blue - Govern
  "#f97316", // orange - Identify
  "#22c55e", // green - Protect
  "#ef4444", // red - Detect
  "#a855f7", // purple - Respond
  "#78716c", // brown - Recover
];

export default function CustomerControlsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { t } = useLanguage();
  const customerId = params.customerId as string;
  const frameworkIdParam = searchParams.get("frameworkId");

  const [controls, setControls] = useState<Control[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeView, setActiveView] = useState<"dashboard" | "all">("all");
  const [selectedFrameworkId, setSelectedFrameworkId] = useState<string>(frameworkIdParam || "all");
  const [searchQuery, setSearchQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [fgFilter, setFgFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<string>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [showColumns, setShowColumns] = useState(true);

  useEffect(() => {
    fetchCustomer();
    fetchFrameworks();
    fetchControls();
  }, [customerId]);

  useEffect(() => {
    fetchControls();
  }, [selectedFrameworkId]);

  const fetchCustomer = async () => {
    try {
      const response = await fetch("/api/grc/customers");
      if (response.ok) {
        const data = await response.json();
        const found = data.find((c: Customer) => c.id === customerId);
        setCustomer(found || null);
      }
    } catch (error) {
      console.error("Error fetching customer:", error);
    }
  };

  const fetchFrameworks = async () => {
    try {
      const response = await fetch(
        `/api/grc/customers/${customerId}/frameworks`
      );
      if (response.ok) {
        const data = await response.json();
        setFrameworks(data);
      }
    } catch (error) {
      console.error("Error fetching frameworks:", error);
    }
  };

  const fetchControls = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (selectedFrameworkId && selectedFrameworkId !== "all") {
        queryParams.set("frameworkId", selectedFrameworkId);
      }
      const response = await fetch(
        `/api/grc/customers/${customerId}/controls?${queryParams.toString()}`
      );
      if (response.ok) {
        const data = await response.json();
        setControls(data);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("Controls API error:", response.status, errorData);
      }
    } catch (error) {
      console.error("Error fetching controls:", error);
    } finally {
      setLoading(false);
    }
  };

  // Stats
  const stats = useMemo(() => {
    const total = controls.length;
    const nonCompliant = controls.filter(
      (c) => c.status === "Non Compliant"
    ).length;
    const compliant = controls.filter((c) => c.status === "Compliant").length;
    const notApplicable = controls.filter(
      (c) => c.status === "Not Applicable"
    ).length;
    return { total, nonCompliant, compliant, notApplicable };
  }, [controls]);

  // Functional grouping data for donut chart
  const fgData = useMemo(() => {
    const counts: Record<string, number> = {};
    controls.forEach((c) => {
      const fg = c.functionalGrouping || "Unknown";
      counts[fg] = (counts[fg] || 0) + 1;
    });
    const total = controls.length || 1;
    return FUNCTIONAL_GROUPINGS.filter((fg) => counts[fg]).map((fg, i) => ({
      label: fg,
      count: counts[fg] || 0,
      percentage: (((counts[fg] || 0) / total) * 100).toFixed(1),
      color: DONUT_COLORS[i],
    }));
  }, [controls]);

  // Unique domains for filter
  const domains = useMemo(() => {
    const domainMap = new Map<string, string>();
    controls.forEach((c) => {
      if (c.domain) domainMap.set(c.domain.id, c.domain.name);
    });
    return Array.from(domainMap.entries()).map(([id, name]) => ({ id, name }));
  }, [controls]);

  // Filtered and sorted controls
  const filteredControls = useMemo(() => {
    let result = [...controls];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.controlCode.toLowerCase().includes(q)
      );
    }

    if (domainFilter && domainFilter !== "all") {
      result = result.filter((c) => c.domain?.id === domainFilter);
    }

    if (fgFilter && fgFilter !== "all") {
      result = result.filter((c) => c.functionalGrouping === fgFilter);
    }

    result.sort((a, b) => {
      let valA = "";
      let valB = "";
      switch (sortField) {
        case "name":
          valA = a.name;
          valB = b.name;
          break;
        case "controlCode":
          valA = a.controlCode;
          valB = b.controlCode;
          break;
        case "functionalGrouping":
          valA = a.functionalGrouping || "";
          valB = b.functionalGrouping || "";
          break;
        case "status":
          valA = a.status;
          valB = b.status;
          break;
        case "domain":
          valA = a.domain?.name || "";
          valB = b.domain?.name || "";
          break;
        default:
          valA = a.name;
          valB = b.name;
      }
      return sortAsc
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    });

    return result;
  }, [controls, searchQuery, domainFilter, fgFilter, sortField, sortAsc]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleBack = () => {
    router.push(`/grc/customers/${customerId}/frameworks`);
  };

  // Donut chart SVG
  const renderDonutChart = () => {
    if (fgData.length === 0) {
      return (
        <div className="text-center py-12 text-slate-500">
          {t("No control data available for chart.")}
        </div>
      );
    }

    const total = controls.length;
    const size = 280;
    const cx = size / 2;
    const cy = size / 2;
    const outerR = 120;
    const innerR = 70;

    let currentAngle = -90;

    const paths = fgData.map((item) => {
      const angle = (item.count / total) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;

      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      const x1Outer = cx + outerR * Math.cos(startRad);
      const y1Outer = cy + outerR * Math.sin(startRad);
      const x2Outer = cx + outerR * Math.cos(endRad);
      const y2Outer = cy + outerR * Math.sin(endRad);
      const x1Inner = cx + innerR * Math.cos(endRad);
      const y1Inner = cy + innerR * Math.sin(endRad);
      const x2Inner = cx + innerR * Math.cos(startRad);
      const y2Inner = cy + innerR * Math.sin(startRad);

      const largeArc = angle > 180 ? 1 : 0;

      const midAngle = ((startAngle + endAngle) / 2 * Math.PI) / 180;
      const labelR = (outerR + innerR) / 2;
      const labelX = cx + labelR * Math.cos(midAngle);
      const labelY = cy + labelR * Math.sin(midAngle);

      const d = [
        `M ${x1Outer} ${y1Outer}`,
        `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2Outer} ${y2Outer}`,
        `L ${x1Inner} ${y1Inner}`,
        `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2Inner} ${y2Inner}`,
        "Z",
      ].join(" ");

      return { d, color: item.color, label: `${item.percentage}%`, labelX, labelY, angle };
    });

    return (
      <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-12">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[280px] h-auto">
          {paths.map((p, i) => (
            <g key={i}>
              <path d={p.d} fill={p.color} stroke="white" strokeWidth="2" />
              {p.angle > 15 && (
                <text
                  x={p.labelX}
                  y={p.labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize="11"
                  fontWeight="600"
                >
                  {p.label}
                </text>
              )}
            </g>
          ))}
        </svg>

        <div className="space-y-2">
          {fgData.map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-sm"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm text-slate-700">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading && controls.length === 0) {
    return (
      <div className="space-y-6">
        <nav className="flex items-center gap-1.5 text-sm">
          <Link href="/grc" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
            <Home className="h-4 w-4" />
            <span>{t("GRC")}</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <Link href="/grc/customers" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Customers")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-slate-500">{t("Customer")}</span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-primary-700 font-medium">{t("Controls")}</span>
        </nav>
        <div className="bg-white rounded-xl border border-slate-200 p-16 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/grc" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("GRC")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/grc/customers" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Customers")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href={`/grc/customers/${customerId}/frameworks`} className="text-slate-500 hover:text-primary-600 transition-colors">
          {customer?.customerName || t("Customer")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Controls")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Controls")}</h1>
        <Select
          value={selectedFrameworkId}
          onValueChange={setSelectedFrameworkId}
        >
          <SelectTrigger className="w-full sm:w-[200px] h-9 text-sm bg-slate-50 border-slate-200 rounded-lg">
            <SelectValue placeholder={t("Framework")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("All Frameworks")}</SelectItem>
            {frameworks.map((fw) => (
              <SelectItem key={fw.id} value={fw.id}>
                {fw.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Sub-tabs */}
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as "dashboard" | "all")}>
        <TabsList>
          <TabsTrigger value="dashboard">{t("Dashboard")}</TabsTrigger>
          <TabsTrigger value="all">{t("All Controls")}</TabsTrigger>
        </TabsList>

        {/* Dashboard View */}
        <TabsContent value="dashboard" className="mt-6 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-sm font-medium text-slate-500 mb-4">
              {t("Functional Grouping")}
            </h2>
            <div className="flex justify-center py-8">
              {renderDonutChart()}
            </div>
          </div>
        </TabsContent>

        {/* All Controls View */}
        <TabsContent value="all" className="mt-6 space-y-6">
          <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {[
              {
                label: t("Total Controls"),
                value: stats.total,
                icon: <Layers className="h-5 w-5" />,
              },
              {
                label: t("Non Compliant"),
                value: stats.nonCompliant,
                icon: <AlertTriangle className="h-5 w-5" />,
              },
              {
                label: t("Compliant"),
                value: stats.compliant,
                icon: <CheckCircle2 className="h-5 w-5" />,
              },
              {
                label: t("Not Applicable"),
                value: stats.notApplicable,
                icon: <XCircle className="h-5 w-5" />,
              },
            ].map((card) => (
              <div
                key={card.label}
                className="bg-white rounded-xl p-3 sm:p-5 border border-slate-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50 text-primary-600">
                    {card.icon}
                  </div>
                </div>
                <div className="text-3xl font-bold tracking-tight text-slate-800">{card.value}</div>
                <div className="mt-1 text-sm font-medium text-slate-500">{card.label}</div>
              </div>
            ))}
          </div>

          {/* Controls Table Card */}
          <div className="bg-white rounded-xl border border-slate-200">
            {/* Search and Filters Toolbar */}
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 px-3 sm:px-5 py-3 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  placeholder={t("Search By Control Code, Name")}
                  className="w-full sm:w-64 ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="ltr:ml-auto rtl:mr-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                <Select value={domainFilter} onValueChange={setDomainFilter}>
                  <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm bg-slate-50 border-slate-200">
                    <SelectValue placeholder={t("Domain")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                    <SelectItem value="all">{t("All Domains")}</SelectItem>
                    {domains.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={fgFilter} onValueChange={setFgFilter}>
                  <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm bg-slate-50 border-slate-200">
                    <SelectValue placeholder={t("Functional Grouping")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                    <SelectItem value="all">{t("All Groupings")}</SelectItem>
                    {FUNCTIONAL_GROUPINGS.map((fg) => (
                      <SelectItem key={fg} value={fg}>
                        {fg}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow className="border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                  <TableHead className="ps-5 text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3">
                    <button
                      className="flex items-center gap-1 hover:text-slate-800"
                      onClick={() => handleSort("name")}
                    >
                      {t("Control Name")}
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3">
                    <button
                      className="flex items-center gap-1 hover:text-slate-800"
                      onClick={() => handleSort("controlCode")}
                    >
                      {t("Control Code")}
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3">
                    <button
                      className="flex items-center gap-1 hover:text-slate-800"
                      onClick={() => handleSort("functionalGrouping")}
                    >
                      {t("Functional Group")}
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3">
                    <button
                      className="flex items-center gap-1 hover:text-slate-800"
                      onClick={() => handleSort("status")}
                    >
                      {t("Status")}
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3">
                    {t("Assignee")}
                  </TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3">
                    <button
                      className="flex items-center gap-1 hover:text-slate-800"
                      onClick={() => handleSort("domain")}
                    >
                      {t("Domain Name")}
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3 pe-5 text-center w-12">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-slate-600"
                      onClick={() => setShowColumns(!showColumns)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredControls.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7}>
                      <div className="py-16 text-center">
                        <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-4">
                          <Shield className="h-6 w-6 text-primary-500" />
                        </div>
                        <h3 className="text-sm font-medium text-slate-600 mb-1">
                          {t("No Controls Found")}
                        </h3>
                        <p className="text-xs text-slate-400">
                          {searchQuery || domainFilter !== "all" || fgFilter !== "all"
                            ? t("No controls match the current filters.")
                            : t("No controls available for this customer.")}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredControls.map((control) => (
                    <TableRow key={control.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                      <TableCell className="py-3.5 ps-5 text-sm font-medium text-slate-800" title={control.name}>
                        {control.name.length > 25
                          ? control.name.substring(0, 25) + "..."
                          : control.name}
                      </TableCell>
                      <TableCell className="py-3.5 text-sm text-slate-600">
                        {control.controlCode}
                      </TableCell>
                      <TableCell className="py-3.5 text-sm text-slate-600">
                        {control.functionalGrouping || "-"}
                      </TableCell>
                      <TableCell className="py-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                            control.status === "Compliant"
                              ? "bg-green-50 text-green-700 border-green-200"
                              : control.status === "Non Compliant"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : control.status === "Partial Compliant"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-slate-50 text-slate-700 border-slate-200"
                          }`}
                        >
                          {control.status}
                        </span>
                      </TableCell>
                      <TableCell className="py-3.5 text-sm text-slate-600">
                        {control.assignee?.name || "-"}
                      </TableCell>
                      <TableCell
                        className="py-3.5 text-sm text-slate-600"
                        title={control.domain?.name || ""}
                      >
                        {control.domain?.name
                          ? control.domain.name.length > 22
                            ? control.domain.name.substring(0, 22) + "..."
                            : control.domain.name
                          : "-"}
                      </TableCell>
                      <TableCell className="py-3.5 pe-5 text-center">
                        {showColumns && (
                          <span className="text-xs text-slate-500">
                            {control.entities}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </div>
          </div>
        </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
