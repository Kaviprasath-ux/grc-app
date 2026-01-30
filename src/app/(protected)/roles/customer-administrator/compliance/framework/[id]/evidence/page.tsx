"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  ChevronsLeft,
  ChevronsRight,
  ArrowLeft,
} from "lucide-react";
import { Unauthorized } from "@/components/ui/unauthorized";

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
  "Not Uploaded": "bg-gray-100 text-gray-800",
  Draft: "bg-yellow-100 text-yellow-800",
  Validated: "bg-blue-100 text-blue-800",
  Published: "bg-green-100 text-green-800",
  "Need Attention": "bg-red-100 text-red-800",
};

const ITEMS_PER_PAGE = 20;

export default function EvidenceByFrameworkPage() {
  const router = useRouter();
  const params = useParams();
  const frameworkId = params.id as string;

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
        title="Framework Not Subscribed"
        description="You do not have access to this framework. Please subscribe to view its contents."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/roles/customer-administrator/compliance/framework")}
            className="h-8 w-8 text-slate-400 hover:text-slate-600"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Evidence</h1>
            {framework && (
              <p className="text-sm text-slate-500">
                Framework: {framework.name}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Search Row */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="Search by name, domain or assignee..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="max-w-md bg-white"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="relative h-8 w-8">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead className="text-xs font-semibold text-slate-600 py-3">Evidence Code</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 py-3">Evidence Name</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 py-3">Domain</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 py-3">Status</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 py-3">Assignee</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 py-3">Department</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedEvidences.map((evidence) => (
                <TableRow
                  key={evidence.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onDoubleClick={() => router.push(`/compliance/evidence/${evidence.id}`)}
                >
                  <TableCell className="font-medium text-slate-900">{evidence.evidenceCode}</TableCell>
                  <TableCell className="text-slate-600">{evidence.name}</TableCell>
                  <TableCell className="text-slate-600">{evidence.domain || "-"}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[evidence.status] || "bg-gray-100 text-gray-800"}>
                      {evidence.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-600">{evidence.assignee?.fullName || "-"}</TableCell>
                  <TableCell className="text-slate-600">{evidence.department?.name || "-"}</TableCell>
                </TableRow>
              ))}
              {paginatedEvidences.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    No evidence records found for this framework
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-2 p-4 border-t border-slate-100">
            <Button
              variant="ghost"
              size="icon"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(1)}
              className="h-8 w-8"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-slate-500 px-3 py-1">
              {total > 0 ? `Showing ${startItem} to ${endItem} of ${total}` : "No evidence"}
            </span>
            <Button
              variant="ghost"
              size="icon"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="h-8 w-8"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
