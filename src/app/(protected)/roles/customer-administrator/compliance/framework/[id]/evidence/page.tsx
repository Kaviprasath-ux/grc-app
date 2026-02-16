"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
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
  ChevronRight,
  Search,
  Home,
  FileText,
} from "lucide-react";
import { Unauthorized } from "@/components/ui/unauthorized";
import Link from "next/link";

interface EvidenceControl {
  id: string;
  evidenceId: string;
  controlId: string;
}

interface Evidence {
  id: string;
  evidenceCode: string;
  name: string;
  description: string | null;
  domain: string | null;
  recurrence: string | null;
  status: string;
  controlId: string | null; // Legacy direct control reference
  departmentId: string | null;
  assigneeId: string | null;
  department?: { id: string; name: string } | null;
  assignee?: { id: string; fullName: string } | null;
  evidenceControls?: EvidenceControl[]; // Many-to-many junction
}

interface Control {
  id: string;
  controlCode: string;
  name: string;
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

interface EvidencesApiResponse {
  data: Evidence[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const statusColors: Record<string, string> = {
  "Not Uploaded": "bg-slate-100 text-slate-600",
  Draft: "bg-warning-light text-warning-dark",
  Validated: "bg-info-light text-info-dark",
  Published: "bg-success-light text-success-dark",
  "Need Attention": "bg-error-light text-error-dark",
};

const ITEMS_PER_PAGE = 20;

export default function EvidenceByFrameworkPage() {
  const router = useRouter();
  const params = useParams();
  const frameworkId = params.id as string;
  const { t } = useLanguage();

  // All evidence extracted from framework controls (de-duplicated)
  const [allEvidences, setAllEvidences] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Framework info
  const [framework, setFramework] = useState<{ id: string; name: string; status: string } | null>(null);

  // Fetch framework to get control IDs, then fetch all evidences and filter by control linkage
  useEffect(() => {
    if (!frameworkId) {
      setLoading(false);
      return;
    }

    const fetchFrameworkAndExtractEvidence = async () => {
      try {
        setLoading(true);

        // Step 1: Fetch Framework with all Requirements and their linked Controls
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

        if (controlIdsSet.size === 0) {
          setAllEvidences([]);
          setLoading(false);
          return;
        }

        // Step 3: Fetch ALL evidences via /api/evidences (includes evidenceControls junction)
        // Fetch with high limit to get all evidences
        const evidencesResponse = await fetch(`/api/evidences?limit=1000`);

        if (!evidencesResponse.ok) {
          console.error("Failed to fetch evidences:", evidencesResponse.status);
          setLoading(false);
          return;
        }

        const evidencesData: EvidencesApiResponse = await evidencesResponse.json();

        // Step 4: Filter evidences that are linked to the framework's controls
        // An evidence is linked if:
        // - Its legacy controlId matches one of our control IDs, OR
        // - Any of its evidenceControls[].controlId matches one of our control IDs
        const filteredEvidence = evidencesData.data.filter((evidence) => {
          // Check legacy direct control reference
          if (evidence.controlId && controlIdsSet.has(evidence.controlId)) {
            return true;
          }

          // Check many-to-many junction table
          if (evidence.evidenceControls && Array.isArray(evidence.evidenceControls)) {
            for (const ec of evidence.evidenceControls) {
              if (ec.controlId && controlIdsSet.has(ec.controlId)) {
                return true;
              }
            }
          }

          return false;
        });

        setAllEvidences(filteredEvidence);

      } catch (error) {
        console.error("Error fetching framework data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFrameworkAndExtractEvidence();
  }, [frameworkId]);

  // Filter by search term
  const filteredEvidences = useMemo(() => {
    if (!searchTerm.trim()) {
      return allEvidences;
    }

    const searchLower = searchTerm.toLowerCase().trim();
    return allEvidences.filter((evidence) => {
      const matchesCode = evidence.evidenceCode?.toLowerCase().includes(searchLower);
      const matchesName = evidence.name?.toLowerCase().includes(searchLower);
      const matchesDomain = evidence.domain?.toLowerCase().includes(searchLower);
      const matchesAssignee = evidence.assignee?.fullName?.toLowerCase().includes(searchLower);
      return matchesCode || matchesName || matchesDomain || matchesAssignee;
    });
  }, [allEvidences, searchTerm]);

  // Client-side pagination
  const total = filteredEvidences.length;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  const startItem = total > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, total);
  const paginatedEvidences = filteredEvidences.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

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
        <span className="text-primary-700 font-medium">{t("Evidence")}</span>
      </nav>

      {/* Header */}
      <h1 className="text-2xl font-bold text-slate-800">{t("Evidence")}</h1>

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-slate-100">
          <div className="relative max-w-xs">
            <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={t("Search by name, domain or assignee...")}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm bg-white border border-slate-300 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
            />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ps-5">{t("Evidence Code")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Evidence Name")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Domain")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Status")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Assignee")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pe-5">{t("Department")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedEvidences.map((evidence) => (
                  <TableRow
                    key={evidence.id}
                    className="border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50/60 transition-colors"
                    onDoubleClick={() => router.push(`/compliance/evidence/${evidence.id}?from=framework&frameworkId=${frameworkId}&frameworkName=${encodeURIComponent(framework?.name || '')}`)}
                  >
                    <TableCell className="py-3.5 ps-5 text-sm font-medium text-slate-800">{evidence.evidenceCode}</TableCell>
                    <TableCell className="py-3.5 text-sm text-slate-600">{evidence.name}</TableCell>
                    <TableCell className="py-3.5 text-sm text-slate-600">{evidence.domain || "-"}</TableCell>
                    <TableCell className="py-3.5">
                      <Badge className={statusColors[evidence.status] || "bg-slate-100 text-slate-600"}>
                        {t(evidence.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3.5 text-sm text-slate-600">{evidence.assignee?.fullName || "-"}</TableCell>
                    <TableCell className="py-3.5 pe-5 text-sm text-slate-600">{evidence.department?.name || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {paginatedEvidences.length === 0 && (
              <div className="py-16 text-center">
                <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                  <FileText className="h-6 w-6 text-primary-400" />
                </div>
                <p className="text-sm font-medium text-slate-600 mb-1">
                  {searchTerm
                    ? t("No evidence matches your search")
                    : t("No evidence records found for this framework")}
                </p>
                <p className="text-xs text-slate-400">
                  {searchTerm
                    ? t("Try adjusting your search")
                    : t("Link evidence to controls in the framework to see them here")}
                </p>
              </div>
            )}
          </>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
          <span className="text-xs text-slate-500">
            {total > 0
              ? t("Showing {start} to {end} of {total}").replace("{start}", String(startItem)).replace("{end}", String(endItem)).replace("{total}", String(total))
              : t("No evidence")}
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
    </div>
  );
}
