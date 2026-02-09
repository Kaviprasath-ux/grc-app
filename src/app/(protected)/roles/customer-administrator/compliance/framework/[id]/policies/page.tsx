"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Home,
} from "lucide-react";
import { Unauthorized } from "@/components/ui/unauthorized";
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

interface PolicyControl {
  id: string;
  policyId: string;
  controlId: string;
  policy: Policy;
}

interface Control {
  id: string;
  controlCode: string;
  name: string;
  policyControls?: PolicyControl[];
}

interface RequirementControl {
  id: string;
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

interface ControlDetail {
  id: string;
  policyControls: PolicyControl[];
}

const ITEMS_PER_PAGE = 20;
const BATCH_SIZE = 5; // Concurrent API calls limit

export default function PoliciesByFrameworkPage() {
  const router = useRouter();
  const params = useParams();
  const frameworkId = params.id as string;
  const { t } = useLanguage();

  // All policies extracted from framework controls (de-duplicated)
  const [allPolicies, setAllPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDocType, setActiveDocType] = useState<string>("Policy");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Framework info
  const [framework, setFramework] = useState<{ id: string; name: string; status: string } | null>(null);

  // Step 0, 1, 2, 3P, 4P: Fetch framework, extract controls, fetch control details, extract policies
  useEffect(() => {
    if (!frameworkId) {
      setLoading(false);
      return;
    }

    const fetchFrameworkAndExtractPolicies = async () => {
      try {
        setLoading(true);

        // Step 1: Fetch Framework with all Requirements and their linked Controls
        // Using existing API: GET /api/frameworks/[id]
        const frameworkResponse = await fetch(`/api/frameworks/${frameworkId}`);

        if (!frameworkResponse.ok) {
          console.error("Failed to fetch framework:", frameworkResponse.status);
          setLoading(false);
          return;
        }

        const frameworkData: FrameworkData = await frameworkResponse.json();
        setFramework({ id: frameworkData.id, name: frameworkData.name, status: (frameworkData as { status?: string }).status || "Subscribed" });

        // Step 2: Extract unique Control IDs from all Requirements
        const controlIdsSet = new Set<string>();

        if (frameworkData.requirements && Array.isArray(frameworkData.requirements)) {
          for (const requirement of frameworkData.requirements) {
            if (requirement.controls && Array.isArray(requirement.controls)) {
              for (const reqControl of requirement.controls) {
                if (reqControl.control && reqControl.control.id) {
                  controlIdsSet.add(reqControl.control.id);
                }
              }
            }
          }
        }

        const controlIds = Array.from(controlIdsSet);

        if (controlIds.length === 0) {
          setAllPolicies([]);
          setLoading(false);
          return;
        }

        // Step 3P: Fetch control details to get linked policies
        // Using existing API: GET /api/controls/[id] which returns policyControls[].policy
        // Batch requests to avoid overwhelming the server
        const policiesMap = new Map<string, Policy>();

        for (let i = 0; i < controlIds.length; i += BATCH_SIZE) {
          const batch = controlIds.slice(i, i + BATCH_SIZE);

          const batchPromises = batch.map(async (controlId) => {
            try {
              const response = await fetch(`/api/controls/${controlId}`);
              if (response.ok) {
                const controlDetail: ControlDetail = await response.json();
                return controlDetail;
              }
              return null;
            } catch (error) {
              console.error(`Error fetching control ${controlId}:`, error);
              return null;
            }
          });

          const batchResults = await Promise.all(batchPromises);

          // Step 4P: Extract and de-duplicate policies
          for (const controlDetail of batchResults) {
            if (controlDetail && controlDetail.policyControls) {
              for (const policyControl of controlDetail.policyControls) {
                if (policyControl.policy && policyControl.policy.id) {
                  // De-duplicate by policy ID
                  if (!policiesMap.has(policyControl.policy.id)) {
                    policiesMap.set(policyControl.policy.id, policyControl.policy);
                  }
                }
              }
            }
          }
        }

        // Convert map to array
        const uniquePolicies = Array.from(policiesMap.values());
        setAllPolicies(uniquePolicies);

      } catch (error) {
        console.error("Error fetching framework data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFrameworkAndExtractPolicies();
  }, [frameworkId]);

  // Filter by document type and search
  const filteredPolicies = useMemo(() => {
    let filtered = allPolicies;

    // Filter by document type
    if (activeDocType) {
      filtered = filtered.filter((p) => p.documentType === activeDocType);
    }

    // Filter by search term
    if (search.trim()) {
      const searchLower = search.toLowerCase().trim();
      filtered = filtered.filter((policy) => {
        const matchesCode = policy.code?.toLowerCase().includes(searchLower);
        const matchesName = policy.name?.toLowerCase().includes(searchLower);
        return matchesCode || matchesName;
      });
    }

    return filtered;
  }, [allPolicies, activeDocType, search]);

  // Client-side pagination
  const total = filteredPolicies.length;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  const startItem = total > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, total);
  const paginatedPolicies = filteredPolicies.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "Published": return "bg-green-100 text-green-800";
      case "Approved": return "bg-blue-100 text-blue-800";
      case "Draft": return "bg-yellow-100 text-yellow-800";
      case "Needs Review": return "bg-orange-100 text-orange-800";
      case "Not Uploaded": return "bg-gray-100 text-gray-800";
      case "Pending Approval": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveDocType(tab);
    setCurrentPage(1);
    setSearch("");
  };

  const handleSearch = () => {
    setCurrentPage(1);
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
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/roles/customer-administrator/compliance" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Compliance")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/roles/customer-administrator/compliance/framework" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Integrated Frameworks")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Governance")}</span>
      </nav>

      {/* Header */}
      <h1 className="text-2xl font-bold text-slate-800">{t("Governance")}</h1>

      {/* Tabs */}
      <Tabs value={activeDocType} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="Policy">{t("Policy")}</TabsTrigger>
          <TabsTrigger value="Standard">{t("Standards")}</TabsTrigger>
          <TabsTrigger value="Procedure">{t("Procedures")}</TabsTrigger>
        </TabsList>

        {/* Tab Content - Same structure for all tabs */}
        {["Policy", "Standard", "Procedure"].map((docType) => (
          <TabsContent key={docType} value={docType} className="mt-6">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-slate-100">
                <div className="relative max-w-xs">
                  <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder={t("Search by name or code...")}
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="w-full ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm bg-white border border-slate-300 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
                  />
                </div>
              </div>

              {/* Table */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 border-b border-slate-100">
                      <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider pl-5">{t("Code")}</TableHead>
                      <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Name")}</TableHead>
                      <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Status")}</TableHead>
                      <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Assignee")}</TableHead>
                      <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Approver")}</TableHead>
                      <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider pr-5">{t("Department")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedPolicies.map((policy) => (
                      <TableRow
                        key={policy.id}
                        className="border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50/60 transition-colors"
                        onDoubleClick={() => router.push(`/compliance/governance/${policy.id}`)}
                      >
                        <TableCell className="py-3 pl-5 text-sm font-medium text-slate-800">{policy.code}</TableCell>
                        <TableCell className="py-3 text-sm text-slate-700">{policy.name}</TableCell>
                        <TableCell className="py-3">
                          <Badge className={getStatusBadgeColor(policy.status)}>
                            {policy.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 text-sm text-slate-700">{policy.assignee?.fullName || "-"}</TableCell>
                        <TableCell className="py-3 text-sm text-slate-700">{policy.approver?.fullName || "-"}</TableCell>
                        <TableCell className="py-3 pr-5 text-sm text-slate-700">{policy.department?.name || "-"}</TableCell>
                      </TableRow>
                    ))}
                    {paginatedPolicies.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-sm text-slate-500">
                          {t("No items found for this framework")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}

              {/* Pagination */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
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
