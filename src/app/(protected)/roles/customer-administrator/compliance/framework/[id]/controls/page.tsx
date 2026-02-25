"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Home,
  FileText,
  Eye,
} from "lucide-react";
import { Unauthorized } from "@/components/ui/unauthorized";
import { useTranslatedData } from "@/hooks/useTranslatedData";
import Link from "next/link";

interface Control {
  id: string;
  controlCode: string;
  name: string;
  description?: string;
  controlQuestion?: string;
  functionalGrouping?: string;
  status: string;
  domain?: { id: string; name: string; code?: string };
  framework?: { id: string; name: string };
  department?: { id: string; name: string };
  owner?: { id: string; fullName?: string; userName?: string };
  assignee?: { id: string; fullName?: string; userName?: string };
}

interface RequirementControl {
  id: string;
  requirementId: string;
  controlId: string;
  control: Control;
}

interface Requirement {
  id: string;
  code: string;
  name: string;
  controls: RequirementControl[];
}

interface FrameworkData {
  id: string;
  name: string;
  code?: string;
  requirements: Requirement[];
}

const ITEMS_PER_PAGE = 10;

export default function ControlsByFrameworkPage() {
  const router = useRouter();
  const params = useParams();
  const frameworkId = params.id as string;
  const { t } = useLanguage();

  const [allControls, setAllControls] = useState<Control[]>([]);
  const { data: translatedControls } = useTranslatedData(allControls, { modelName: 'Control' });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [sortField, setSortField] = useState<string>("controlCode");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [statusFilter, setStatusFilter] = useState("all");
  const [groupingFilter, setGroupingFilter] = useState("all");
  const [domainFilter, setDomainFilter] = useState("all");

  const [framework, setFramework] = useState<{ id: string; name: string; status: string } | null>(null);

  useEffect(() => {
    if (!frameworkId) {
      setLoading(false);
      return;
    }

    const fetchFrameworkAndExtractControls = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/frameworks/${frameworkId}`);

        if (!response.ok) {
          console.error("Failed to fetch framework:", response.status);
          setLoading(false);
          return;
        }

        const frameworkData: FrameworkData = await response.json();
        setFramework({ id: frameworkData.id, name: frameworkData.name, status: (frameworkData as { status?: string }).status || "Subscribed" });

        const controlsMap = new Map<string, Control>();

        if (frameworkData.requirements && Array.isArray(frameworkData.requirements)) {
          for (const requirement of frameworkData.requirements) {
            if (requirement.controls && Array.isArray(requirement.controls)) {
              for (const reqControl of requirement.controls) {
                if (reqControl.control && reqControl.control.id) {
                  if (!controlsMap.has(reqControl.control.id)) {
                    controlsMap.set(reqControl.control.id, reqControl.control);
                  }
                }
              }
            }
          }
        }

        const uniqueControls = Array.from(controlsMap.values());
        setAllControls(uniqueControls);
      } catch (error) {
        console.error("Error fetching framework data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFrameworkAndExtractControls();
  }, [frameworkId]);

  // Unique domains and groupings for filter dropdowns
  const uniqueDomains = useMemo(() => {
    const domains = new Map<string, string>();
    translatedControls.forEach(c => {
      if (c.domain?.id && c.domain?.name) domains.set(c.domain.id, c.domain.name);
    });
    return Array.from(domains.entries()).map(([id, name]) => ({ id, name }));
  }, [translatedControls]);

  const uniqueGroupings = useMemo(() => {
    const groupings = new Set<string>();
    translatedControls.forEach(c => {
      if (c.functionalGrouping) groupings.add(c.functionalGrouping);
    });
    return Array.from(groupings).sort();
  }, [translatedControls]);

  // Filtered controls
  const filteredControls = useMemo(() => {
    return translatedControls.filter((control) => {
      if (search.trim()) {
        const searchLower = search.toLowerCase().trim();
        const matchesCode = control.controlCode?.toLowerCase().includes(searchLower);
        const matchesName = control.name?.toLowerCase().includes(searchLower);
        if (!matchesCode && !matchesName) return false;
      }
      if (statusFilter !== "all" && control.status !== statusFilter) return false;
      if (groupingFilter !== "all" && control.functionalGrouping !== groupingFilter) return false;
      if (domainFilter !== "all" && control.domain?.id !== domainFilter) return false;
      return true;
    });
  }, [translatedControls, search, statusFilter, groupingFilter, domainFilter]);

  // Sorted controls
  const sortedControls = useMemo(() => {
    return [...filteredControls].sort((a, b) => {
      let aValue = "";
      let bValue = "";

      switch (sortField) {
        case "name":
          aValue = a.name || "";
          bValue = b.name || "";
          break;
        case "controlCode":
          aValue = a.controlCode || "";
          bValue = b.controlCode || "";
          break;
        case "functionalGrouping":
          aValue = a.functionalGrouping || "";
          bValue = b.functionalGrouping || "";
          break;
        case "status":
          aValue = a.status || "";
          bValue = b.status || "";
          break;
        case "domain":
          aValue = a.domain?.name || "";
          bValue = b.domain?.name || "";
          break;
        default:
          aValue = a.controlCode || "";
          bValue = b.controlCode || "";
      }

      if (sortDirection === "asc") {
        return aValue.localeCompare(bValue);
      }
      return bValue.localeCompare(aValue);
    });
  }, [filteredControls, sortField, sortDirection]);

  // Pagination
  const total = sortedControls.length;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  const startIndex = currentPage * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, total);
  const paginatedControls = sortedControls.slice(startIndex, endIndex);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getAssigneeName = (control: Control): string => {
    if (!control.assignee) return "-";
    return control.assignee.fullName || control.assignee.userName || "-";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Compliant":
        return "bg-green-50 text-green-700 border-green-200";
      case "Partial Compliant":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "Non Compliant":
        return "bg-red-50 text-red-700 border-red-200";
      default:
        return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  const getGroupingBadge = (grouping: string) => {
    switch (grouping) {
      case "Govern":
        return "bg-purple-50 text-purple-700";
      case "Identify":
        return "bg-blue-50 text-blue-700";
      case "Protect":
        return "bg-green-50 text-green-700";
      case "Detect":
        return "bg-amber-50 text-amber-700";
      case "Respond":
        return "bg-orange-50 text-orange-700";
      case "Recover":
        return "bg-teal-50 text-teal-700";
      default:
        return "bg-slate-50 text-slate-600";
    }
  };

  // Block access to not-subscribed frameworks
  if (!loading && framework && framework.status !== "Subscribed") {
    return (
      <Unauthorized
        title={t("Framework Not Subscribed")}
        description={t("You do not have access to this framework. Please subscribe to view its contents.")}
      />
    );
  }

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
        <span className="text-primary-700 font-medium">{t("Controls")}</span>
      </nav>

      {/* Page Header */}
      <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Controls")}</h1>

      {/* Controls Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 px-3 sm:px-5 py-3 border-b border-slate-100">
          {/* Search */}
          <div className="relative w-full sm:w-56">
            <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={t("Search controls...")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(0);
              }}
              className="w-full ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
            />
          </div>

          <div className="hidden sm:block ltr:ml-auto rtl:mr-auto"></div>

          {/* Filters */}
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(0); }}>
            <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm bg-slate-50 border-slate-200">
              <SelectValue placeholder={t("Status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("All Statuses")}</SelectItem>
              <SelectItem value="Compliant">{t("Compliant")}</SelectItem>
              <SelectItem value="Partial Compliant">{t("Partial Compliant")}</SelectItem>
              <SelectItem value="Non Compliant">{t("Non Compliant")}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={groupingFilter} onValueChange={(v) => { setGroupingFilter(v); setCurrentPage(0); }}>
            <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm bg-slate-50 border-slate-200">
              <SelectValue placeholder={t("Grouping")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("All Groupings")}</SelectItem>
              {uniqueGroupings.map(g => (
                <SelectItem key={g} value={g}>{t(g)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {uniqueDomains.length > 0 && (
            <Select value={domainFilter} onValueChange={(v) => { setDomainFilter(v); setCurrentPage(0); }}>
              <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm bg-slate-50 border-slate-200">
                <SelectValue placeholder={t("Domain")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All Domains")}</SelectItem>
                {uniqueDomains.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Table Header */}
        <div className="overflow-x-auto">
        <div className="grid grid-cols-[1fr_120px_140px_130px_140px_140px_50px] gap-0 bg-slate-50 border-b border-slate-100 px-3 sm:px-5 py-3 min-w-[800px]">
          <span
            className="text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-slate-700 transition-colors"
            onClick={() => handleSort("name")}
          >
            {t("Control Name")} {sortField === "name" && (sortDirection === "asc" ? "↑" : "↓")}
          </span>
          <span
            className="text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-slate-700 transition-colors"
            onClick={() => handleSort("controlCode")}
          >
            {t("Code")} {sortField === "controlCode" && (sortDirection === "asc" ? "↑" : "↓")}
          </span>
          <span
            className="text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-slate-700 transition-colors"
            onClick={() => handleSort("functionalGrouping")}
          >
            {t("Grouping")} {sortField === "functionalGrouping" && (sortDirection === "asc" ? "↑" : "↓")}
          </span>
          <span
            className="text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-slate-700 transition-colors"
            onClick={() => handleSort("status")}
          >
            {t("Status")} {sortField === "status" && (sortDirection === "asc" ? "↑" : "↓")}
          </span>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            {t("Assignee")}
          </span>
          <span
            className="text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-slate-700 transition-colors"
            onClick={() => handleSort("domain")}
          >
            {t("Domain")} {sortField === "domain" && (sortDirection === "asc" ? "↑" : "↓")}
          </span>
          <span></span>
        </div>

        {/* Table Body */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
        ) : paginatedControls.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
              <FileText className="h-6 w-6 text-primary-400" />
            </div>
            <p className="text-sm font-medium text-slate-600 mb-1">
              {search || statusFilter !== "all" || groupingFilter !== "all" || domainFilter !== "all"
                ? t("No controls match your filters")
                : t("No controls linked yet")}
            </p>
            <p className="text-xs text-slate-400">
              {search || statusFilter !== "all" || groupingFilter !== "all" || domainFilter !== "all"
                ? t("Try adjusting your search or filters")
                : t("Link controls to requirements in the framework to see them here")}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {paginatedControls.map((control) => (
              <div
                key={control.id}
                className="grid grid-cols-[1fr_120px_140px_130px_140px_140px_50px] gap-0 items-center px-3 sm:px-5 py-3 hover:bg-slate-50/60 transition-colors cursor-pointer group min-w-[800px]"
                onClick={() => router.push(`/compliance/control/${control.id}?from=framework&frameworkId=${frameworkId}&frameworkName=${encodeURIComponent(framework?.name || '')}`)}
              >
                {/* Control Name */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-primary-50 flex items-center justify-center shrink-0">
                    <FileText className="h-3.5 w-3.5 text-primary-500" />
                  </div>
                  <span className="text-sm font-medium text-slate-800 truncate">{control.name}</span>
                </div>

                {/* Code */}
                <span className="text-sm font-mono text-primary-600 font-medium">{control.controlCode}</span>

                {/* Functional Grouping */}
                <div>
                  {control.functionalGrouping ? (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${getGroupingBadge(control.functionalGrouping)}`}>
                      {t(control.functionalGrouping)}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">-</span>
                  )}
                </div>

                {/* Status */}
                <div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${getStatusBadge(control.status)}`}>
                    {t(control.status || "Not Set")}
                  </span>
                </div>

                {/* Assignee */}
                <div className="flex items-center gap-2 min-w-0">
                  {control.assignee ? (
                    <>
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-medium text-slate-500">
                          {(control.assignee.fullName || control.assignee.userName || "?").charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm text-slate-700 truncate">{getAssigneeName(control)}</span>
                    </>
                  ) : (
                    <span className="text-xs text-slate-400">-</span>
                  )}
                </div>

                {/* Domain */}
                <span className="text-sm text-slate-600 truncate">{control.domain?.name || "-"}</span>

                {/* View Action */}
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50 opacity-0 group-hover:opacity-100 transition-all"
                    onClick={(e) => { e.stopPropagation(); router.push(`/compliance/control/${control.id}?from=framework&frameworkId=${frameworkId}&frameworkName=${encodeURIComponent(framework?.name || '')}`); }}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-3 sm:px-5 py-3 border-t border-slate-100 bg-slate-50/50">
          <span className="text-xs text-slate-500">
            {total > 0
              ? t("Showing {start} to {end} of {total}").replace("{start}", String(startIndex + 1)).replace("{end}", String(endIndex)).replace("{total}", String(total))
              : t("No controls")}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 0}
              className="h-7 w-7 text-slate-400 hover:text-slate-600"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage >= totalPages - 1}
              className="h-7 w-7 text-slate-400 hover:text-slate-600"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
