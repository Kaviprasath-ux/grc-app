"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Home,
  FileText,
} from "lucide-react";
import { Unauthorized } from "@/components/ui/unauthorized";
import { useTranslatedData } from "@/hooks/useTranslatedData";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

interface Policy {
  id: string;
  code: string;
  name: string;
  version: string;
  documentType: string;
  recurrence?: string;
  status: string;
  effectiveDate?: string;
  reviewDate?: string;
  department?: { id: string; name: string };
  assignee?: { id: string; fullName: string };
  approver?: { id: string; fullName: string };
}

const ITEMS_PER_PAGE = 20;

export default function PoliciesByFrameworkPage() {
  const router = useRouter();
  const params = useParams();
  const frameworkId = params.id as string;
  const { t, isRTL } = useLanguage();

  const [allPolicies, setAllPolicies] = useState<Policy[]>([]);
  const { data: translatedPolicies } = useTranslatedData(allPolicies, { modelName: 'QPostPolicy' });
  const [loading, setLoading] = useState(true);
  const [activeDocType, setActiveDocType] = useState<string>("Policy");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [framework, setFramework] = useState<{ id: string; name: string; status: string } | null>(null);

  useEffect(() => {
    if (!frameworkId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch framework info
        const fwResponse = await fetch(`/api/qpost-compliance/frameworks/${frameworkId}`);
        if (fwResponse.ok) {
          const fwData = await fwResponse.json();
          setFramework({ id: fwData.id, name: fwData.name, status: fwData.status || "Subscribed" });
        }

        // Fetch policies linked to this framework
        const policiesResponse = await fetch(`/api/qpost-compliance/policies?frameworkId=${frameworkId}&limit=1000`);
        if (policiesResponse.ok) {
          const policiesData = await policiesResponse.json();
          setAllPolicies(policiesData.data || []);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [frameworkId]);

  // Filter by document type and search
  const filteredPolicies = useMemo(() => {
    let filtered = translatedPolicies;

    if (activeDocType) {
      filtered = filtered.filter((p) => p.documentType === activeDocType);
    }

    if (search.trim()) {
      const searchLower = search.toLowerCase().trim();
      filtered = filtered.filter((policy) => {
        const matchesCode = policy.code?.toLowerCase().includes(searchLower);
        const matchesName = policy.name?.toLowerCase().includes(searchLower);
        return matchesCode || matchesName;
      });
    }

    return filtered;
  }, [translatedPolicies, activeDocType, search]);

  // Pagination
  const total = filteredPolicies.length;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  const startItem = total > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, total);
  const paginatedPolicies = filteredPolicies.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Published": return "bg-green-50 text-green-700 border-green-200";
      case "Approved": return "bg-blue-50 text-blue-700 border-blue-200";
      case "Draft": return "bg-yellow-50 text-yellow-700 border-yellow-200";
      case "Needs Review": return "bg-orange-50 text-orange-700 border-orange-200";
      case "Not Uploaded": return "bg-slate-50 text-slate-600 border-slate-200";
      case "Pending Approval": return "bg-purple-50 text-purple-700 border-purple-200";
      default: return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveDocType(tab);
    setCurrentPage(1);
    setSearch("");
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
    <div className="space-y-4 sm:space-y-5">
      {/* Breadcrumb */}
      <nav className={`flex items-center gap-1.5 text-xs sm:text-sm overflow-x-auto whitespace-nowrap ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
        <Link href="/qpost-compliance" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Compliance")}</span>
        </Link>
        <ChevronRight className={`h-3.5 w-3.5 text-slate-300 ${isRTL ? "rotate-180" : ""}`} />
        <Link href="/qpost-compliance/framework" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Integrated Frameworks")}
        </Link>
        <ChevronRight className={`h-3.5 w-3.5 text-slate-300 ${isRTL ? "rotate-180" : ""}`} />
        <span className="text-primary-700 font-medium">{t("Governance")}</span>
      </nav>

      {/* Header */}
      <div style={isRTL ? { direction: 'rtl' } : undefined}>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
          {framework ? `${framework.name} - ${t("Governance")}` : t("Governance")}
        </h1>
      </div>

      {/* Tabs */}
      <Tabs value={activeDocType} onValueChange={handleTabChange}>
        <div className={`overflow-x-auto ${isRTL ? "flex justify-end" : ""}`}>
        <TabsList className={`overflow-x-auto ${isRTL ? "flex-row-reverse" : ""}`}>
          <TabsTrigger value="Policy">{t("Policy")}</TabsTrigger>
          <TabsTrigger value="Standard">{t("Standards")}</TabsTrigger>
          <TabsTrigger value="Procedure">{t("Procedures")}</TabsTrigger>
        </TabsList>
        </div>

        {["Policy", "Standard", "Procedure"].map((docType) => (
          <TabsContent key={docType} value={docType} className="mt-6">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" style={isRTL ? { direction: 'rtl' } : undefined}>
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-3 px-3 sm:px-5 py-3 border-b border-slate-100">
                <div className="relative w-full sm:w-56">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder={t("Search by name or code...")}
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full ps-9 pe-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
                  />
                </div>
              </div>

              {/* Table Header */}
              <div className="overflow-x-auto">
              <div className="grid grid-cols-[100px_1fr_130px_140px_140px_140px] gap-0 bg-slate-50 border-b border-slate-100 px-3 sm:px-5 py-2.5 min-w-[800px]">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Code")}</span>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Name")}</span>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Status")}</span>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Assignee")}</span>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Approver")}</span>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Department")}</span>
              </div>

              {/* Table Body */}
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
                </div>
              ) : paginatedPolicies.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                    <FileText className="h-6 w-6 text-primary-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-600 mb-1">
                    {search
                      ? t("No items match your search")
                      : t("No items found for this framework")}
                  </p>
                  <p className="text-xs text-slate-400">
                    {search
                      ? t("Try adjusting your search term")
                      : t("Items will appear here once linked to this framework")}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {paginatedPolicies.map((policy) => (
                    <div
                      key={policy.id}
                      className="grid grid-cols-[100px_1fr_130px_140px_140px_140px] gap-0 items-center px-3 sm:px-5 py-3 hover:bg-slate-50/60 transition-colors cursor-pointer group min-w-[800px]"
                      onDoubleClick={() => router.push(`/qpost-compliance/governance/${policy.id}?from=framework&frameworkId=${frameworkId}&frameworkName=${encodeURIComponent(framework?.name || '')}`)}
                    >
                      <span className="text-sm font-mono text-primary-600 font-medium">{policy.code}</span>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-md bg-primary-50 flex items-center justify-center shrink-0">
                          <FileText className="h-3.5 w-3.5 text-primary-500" />
                        </div>
                        <span className="text-sm font-medium text-slate-800 truncate">{policy.name}</span>
                      </div>
                      <div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${getStatusBadge(policy.status)}`}>
                          {t(policy.status)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        {policy.assignee ? (
                          <>
                            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                              <span className="text-[10px] font-medium text-slate-500">
                                {policy.assignee.fullName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className="text-sm text-slate-700 truncate">{policy.assignee.fullName}</span>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        {policy.approver ? (
                          <>
                            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                              <span className="text-[10px] font-medium text-slate-500">
                                {policy.approver.fullName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className="text-sm text-slate-700 truncate">{policy.approver.fullName}</span>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </div>
                      <span className="text-sm text-slate-600 truncate">{policy.department?.name || "-"}</span>
                    </div>
                  ))}
                </div>
              )}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-3 sm:px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                <span className="text-xs text-slate-500">
                  {total > 0 ? `${startItem} ${t("to")} ${endItem} ${t("of")} ${total}` : t("No items")}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    className="h-7 w-7 text-slate-400 hover:text-slate-600"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="h-7 w-7 text-slate-400 hover:text-slate-600"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
