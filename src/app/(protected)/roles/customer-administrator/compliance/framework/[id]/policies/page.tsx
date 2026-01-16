"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
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
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowLeft,
} from "lucide-react";

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

  // All policies extracted from framework controls (de-duplicated)
  const [allPolicies, setAllPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDocType, setActiveDocType] = useState<string>("Policy");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Framework info
  const [framework, setFramework] = useState<{ id: string; name: string } | null>(null);

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
        setFramework({ id: frameworkData.id, name: frameworkData.name });

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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/roles/customer-administrator/compliance/framework")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Governance</h1>
            {framework && (
              <p className="text-sm text-muted-foreground">
                Filtered by: {framework.name}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeDocType} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="Policy">Policy</TabsTrigger>
          <TabsTrigger value="Standard">Standards</TabsTrigger>
          <TabsTrigger value="Procedure">Procedures</TabsTrigger>
        </TabsList>

        {/* Tab Content - Same structure for all tabs */}
        {["Policy", "Standard", "Procedure"].map((docType) => (
          <TabsContent key={docType} value={docType} className="mt-4 space-y-4">
            {/* Search Row */}
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Input
                  placeholder={` Search By ${docType} Name , ${docType} Code`}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pr-10"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={handleSearch}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-sm text-muted-foreground">
                Framework: <span className="font-medium">{framework?.name || "Loading..."}</span>
              </div>
            </div>

            {/* Table */}
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : (
              <>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Assignee</TableHead>
                        <TableHead>Approver</TableHead>
                        <TableHead>Department Name</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedPolicies.map((policy) => (
                        <TableRow
                          key={policy.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onDoubleClick={() => router.push(`/compliance/governance/${policy.id}`)}
                        >
                          <TableCell className="font-medium">{policy.code}</TableCell>
                          <TableCell>{policy.name}</TableCell>
                          <TableCell>
                            <Badge className={getStatusBadgeColor(policy.status)}>
                              {policy.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{policy.assignee?.fullName || ""}</TableCell>
                          <TableCell>{policy.approver?.fullName || ""}</TableCell>
                          <TableCell>{policy.department?.name || ""}</TableCell>
                        </TableRow>
                      ))}
                      {paginatedPolicies.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No {docType.toLowerCase()}s found for this framework
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(1)}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground px-4">
                    Currently showing {startItem} to {endItem} of {total}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
