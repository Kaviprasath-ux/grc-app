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

interface Requirement {
  id: string;
  code: string;
  name: string;
  description?: string;
  requirementType?: string;
  chapterType?: string;
  level?: number;
  implementationStatus?: string;
  controlCompliance?: string;
  applicability?: string;
  category?: { id: string; name: string; code?: string };
}

interface FrameworkData {
  id: string;
  name: string;
  code?: string;
  status?: string;
  requirements: Requirement[];
}

const ITEMS_PER_PAGE = 10;

export default function RequirementsByFrameworkPage() {
  const router = useRouter();
  const params = useParams();
  const frameworkId = params.id as string;
  const { t } = useLanguage();

  const [allRequirements, setAllRequirements] = useState<Requirement[]>([]);
  const { data: translatedRequirements } = useTranslatedData(allRequirements, { modelName: 'QPostRequirement' });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [sortField, setSortField] = useState<string>("code");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [framework, setFramework] = useState<{ id: string; name: string; status: string } | null>(null);

  useEffect(() => {
    if (!frameworkId) {
      setLoading(false);
      return;
    }

    const fetchFrameworkAndExtractRequirements = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/qpost-compliance/frameworks/${frameworkId}`);

        if (!response.ok) {
          console.error("Failed to fetch framework:", response.status);
          setLoading(false);
          return;
        }

        const frameworkData: FrameworkData = await response.json();
        setFramework({ id: frameworkData.id, name: frameworkData.name, status: frameworkData.status || "Subscribed" });

        // QPost requirements are directly on the framework (no controls indirection)
        if (frameworkData.requirements && Array.isArray(frameworkData.requirements)) {
          setAllRequirements(frameworkData.requirements);
        }
      } catch (error) {
        console.error("Error fetching framework data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFrameworkAndExtractRequirements();
  }, [frameworkId]);

  // Unique categories for filter dropdown
  const uniqueCategories = useMemo(() => {
    const categories = new Map<string, string>();
    translatedRequirements.forEach(c => {
      if (c.category?.id && c.category?.name) categories.set(c.category.id, c.category.name);
    });
    return Array.from(categories.entries()).map(([id, name]) => ({ id, name }));
  }, [translatedRequirements]);

  // Filtered requirements
  const filteredRequirements = useMemo(() => {
    return translatedRequirements.filter((requirement) => {
      if (search.trim()) {
        const searchLower = search.toLowerCase().trim();
        const matchesCode = requirement.code?.toLowerCase().includes(searchLower);
        const matchesName = requirement.name?.toLowerCase().includes(searchLower);
        if (!matchesCode && !matchesName) return false;
      }
      if (statusFilter !== "all" && requirement.implementationStatus !== statusFilter) return false;
      if (categoryFilter !== "all" && requirement.category?.id !== categoryFilter) return false;
      return true;
    });
  }, [translatedRequirements, search, statusFilter, categoryFilter]);

  // Sorted requirements
  const sortedRequirements = useMemo(() => {
    return [...filteredRequirements].sort((a, b) => {
      let aValue = "";
      let bValue = "";

      switch (sortField) {
        case "name":
          aValue = a.name || "";
          bValue = b.name || "";
          break;
        case "code":
          aValue = a.code || "";
          bValue = b.code || "";
          break;
        case "implementationStatus":
          aValue = a.implementationStatus || "";
          bValue = b.implementationStatus || "";
          break;
        case "category":
          aValue = a.category?.name || "";
          bValue = b.category?.name || "";
          break;
        case "requirementType":
          aValue = a.requirementType || "";
          bValue = b.requirementType || "";
          break;
        default:
          aValue = a.code || "";
          bValue = b.code || "";
      }

      if (sortDirection === "asc") {
        return aValue.localeCompare(bValue);
      }
      return bValue.localeCompare(aValue);
    });
  }, [filteredRequirements, sortField, sortDirection]);

  // Pagination
  const total = sortedRequirements.length;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  const startIndex = currentPage * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, total);
  const paginatedRequirements = sortedRequirements.slice(startIndex, endIndex);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Implemented":
        return "bg-green-50 text-green-700 border-green-200";
      case "Partially Implemented":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "Not Implemented":
        return "bg-red-50 text-red-700 border-red-200";
      case "Not Applicable":
        return "bg-slate-50 text-slate-500 border-slate-200";
      default:
        return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "Mandatory":
        return "bg-red-50 text-red-700";
      case "Optional":
        return "bg-blue-50 text-blue-700";
      case "Recommended":
        return "bg-amber-50 text-amber-700";
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
        <Link href="/qpost-compliance" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Compliance")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/qpost-compliance/framework" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Integrated Frameworks")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Requirements")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
          {framework ? `${framework.name} - ${t("Requirements")}` : t("Requirements")}
        </h1>
      </div>

      {/* Requirements Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 px-3 sm:px-5 py-3 border-b border-slate-100">
          {/* Search */}
          <div className="relative w-full sm:w-56">
            <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={t("Search requirements...")}
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
            <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm bg-slate-50 border-slate-200">
              <SelectValue placeholder={t("Implementation Status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("All Statuses")}</SelectItem>
              <SelectItem value="Implemented">{t("Implemented")}</SelectItem>
              <SelectItem value="Partially Implemented">{t("Partially Implemented")}</SelectItem>
              <SelectItem value="Not Implemented">{t("Not Implemented")}</SelectItem>
              <SelectItem value="Not Applicable">{t("Not Applicable")}</SelectItem>
            </SelectContent>
          </Select>

          {uniqueCategories.length > 0 && (
            <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setCurrentPage(0); }}>
              <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm bg-slate-50 border-slate-200">
                <SelectValue placeholder={t("Category")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All Categories")}</SelectItem>
                {uniqueCategories.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Table Header */}
        <div className="overflow-x-auto">
        <div className="grid grid-cols-[1fr_120px_140px_160px_140px_50px] gap-0 bg-slate-50 border-b border-slate-100 px-3 sm:px-5 py-3 min-w-[800px]">
          <span
            className="text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-slate-700 transition-colors"
            onClick={() => handleSort("name")}
          >
            {t("Requirement Name")} {sortField === "name" && (sortDirection === "asc" ? "↑" : "↓")}
          </span>
          <span
            className="text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-slate-700 transition-colors"
            onClick={() => handleSort("code")}
          >
            {t("Code")} {sortField === "code" && (sortDirection === "asc" ? "↑" : "↓")}
          </span>
          <span
            className="text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-slate-700 transition-colors"
            onClick={() => handleSort("requirementType")}
          >
            {t("Type")} {sortField === "requirementType" && (sortDirection === "asc" ? "↑" : "↓")}
          </span>
          <span
            className="text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-slate-700 transition-colors"
            onClick={() => handleSort("implementationStatus")}
          >
            {t("Implementation Status")} {sortField === "implementationStatus" && (sortDirection === "asc" ? "↑" : "↓")}
          </span>
          <span
            className="text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-slate-700 transition-colors"
            onClick={() => handleSort("category")}
          >
            {t("Category")} {sortField === "category" && (sortDirection === "asc" ? "↑" : "↓")}
          </span>
          <span></span>
        </div>

        {/* Table Body */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
        ) : paginatedRequirements.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
              <FileText className="h-6 w-6 text-primary-400" />
            </div>
            <p className="text-sm font-medium text-slate-600 mb-1">
              {search || statusFilter !== "all" || categoryFilter !== "all"
                ? t("No requirements match your filters")
                : t("No requirements linked yet")}
            </p>
            <p className="text-xs text-slate-400">
              {search || statusFilter !== "all" || categoryFilter !== "all"
                ? t("Try adjusting your search or filters")
                : t("Link requirements to the framework to see them here")}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {paginatedRequirements.map((requirement) => (
              <div
                key={requirement.id}
                className="grid grid-cols-[1fr_120px_140px_160px_140px_50px] gap-0 items-center px-3 sm:px-5 py-3 hover:bg-slate-50/60 transition-colors cursor-pointer group min-w-[800px]"
                onClick={() => router.push(`/qpost-compliance/requirements/${requirement.id}?from=framework&frameworkId=${frameworkId}&frameworkName=${encodeURIComponent(framework?.name || '')}`)}
              >
                {/* Requirement Name */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-primary-50 flex items-center justify-center shrink-0">
                    <FileText className="h-3.5 w-3.5 text-primary-500" />
                  </div>
                  <span className="text-sm font-medium text-slate-800 truncate">{requirement.name}</span>
                </div>

                {/* Code */}
                <span className="text-sm font-mono text-primary-600 font-medium">{requirement.code}</span>

                {/* Requirement Type */}
                <div>
                  {requirement.requirementType ? (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${getTypeBadge(requirement.requirementType)}`}>
                      {t(requirement.requirementType)}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">-</span>
                  )}
                </div>

                {/* Implementation Status */}
                <div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${getStatusBadge(requirement.implementationStatus || "")}`}>
                    {t(requirement.implementationStatus || "Not Set")}
                  </span>
                </div>

                {/* Category */}
                <span className="text-sm text-slate-600 truncate">{requirement.category?.name || "-"}</span>

                {/* View Action */}
                <div className="flex ltr:justify-end rtl:justify-start">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50 opacity-0 group-hover:opacity-100 transition-all"
                    onClick={(e) => { e.stopPropagation(); router.push(`/qpost-compliance/requirements/${requirement.id}?from=framework&frameworkId=${frameworkId}&frameworkName=${encodeURIComponent(framework?.name || '')}`); }}
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
              : t("No requirements")}
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
