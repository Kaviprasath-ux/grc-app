"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  Settings2,
  ArrowLeft,
} from "lucide-react";

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

const ITEMS_PER_PAGE = 20;

export default function ControlsByFrameworkPage() {
  const router = useRouter();
  const params = useParams();
  const frameworkId = params.id as string;

  // All controls extracted from framework (de-duplicated)
  const [allControls, setAllControls] = useState<Control[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [sortField, setSortField] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Framework info
  const [framework, setFramework] = useState<{ id: string; name: string } | null>(null);

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState({
    controlName: true,
    controlCode: true,
    functionalGrouping: true,
    status: true,
    assignee: true,
    domain: true,
  });

  // Step 0 & 1 & 2 & 3: Fetch framework with requirements and extract+deduplicate controls
  useEffect(() => {
    if (!frameworkId) {
      setLoading(false);
      return;
    }

    const fetchFrameworkAndExtractControls = async () => {
      try {
        setLoading(true);

        // Step 1: Fetch Framework with all Requirements and their linked Controls
        // Using existing API: GET /api/frameworks/[id]
        // This returns: { requirements: [{ controls: [{ control: {...} }] }] }
        const response = await fetch(`/api/frameworks/${frameworkId}`);

        if (!response.ok) {
          console.error("Failed to fetch framework:", response.status);
          setLoading(false);
          return;
        }

        const frameworkData: FrameworkData = await response.json();

        // Store framework info
        setFramework({ id: frameworkData.id, name: frameworkData.name });

        // Step 2: Extract Controls from all Requirements
        // Data path: framework.requirements[].controls[].control
        const controlsMap = new Map<string, Control>();

        if (frameworkData.requirements && Array.isArray(frameworkData.requirements)) {
          for (const requirement of frameworkData.requirements) {
            if (requirement.controls && Array.isArray(requirement.controls)) {
              for (const reqControl of requirement.controls) {
                if (reqControl.control && reqControl.control.id) {
                  // Step 3: De-duplicate by control ID
                  // If control already exists in map, skip (first occurrence wins)
                  if (!controlsMap.has(reqControl.control.id)) {
                    controlsMap.set(reqControl.control.id, reqControl.control);
                  }
                }
              }
            }
          }
        }

        // Convert map to array
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

  // Step 4: Apply client-side search filter
  const filteredControls = useMemo(() => {
    if (!search.trim()) {
      return allControls;
    }

    const searchLower = search.toLowerCase().trim();
    return allControls.filter((control) => {
      const matchesCode = control.controlCode?.toLowerCase().includes(searchLower);
      const matchesName = control.name?.toLowerCase().includes(searchLower);
      return matchesCode || matchesName;
    });
  }, [allControls, search]);

  // Apply sorting
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
          aValue = a.name || "";
          bValue = b.name || "";
      }

      if (sortDirection === "asc") {
        return aValue.localeCompare(bValue);
      }
      return bValue.localeCompare(aValue);
    });
  }, [filteredControls, sortField, sortDirection]);

  // Client-side pagination
  const total = sortedControls.length;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  const startIndex = currentPage * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, total);
  const paginatedControls = sortedControls.slice(startIndex, endIndex);

  const handleSearch = () => {
    setCurrentPage(0); // Reset to first page on search
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Helper to get assignee display name
  const getAssigneeName = (control: Control): string => {
    if (!control.assignee) return "-";
    return control.assignee.fullName || control.assignee.userName || "-";
  };

  // Helper to get owner display name
  const getOwnerName = (control: Control): string => {
    if (!control.owner) return "-";
    return control.owner.fullName || control.owner.userName || "-";
  };

  return (
    <div className="space-y-4">
      {/* Header Section */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
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
              <h3 className="text-lg font-semibold text-gray-900">Controls</h3>
              {framework && (
                <p className="text-sm text-muted-foreground">
                  Filtered by: {framework.name}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Search Row */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Input
              placeholder=" Search By Control Code , Name"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(0); // Reset page on search input change
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="max-w-md"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            Framework: <span className="font-medium">{framework?.name || "Loading..."}</span>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg shadow-sm border">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              {visibleColumns.controlName && (
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("name")}
                    className="h-8 px-2 font-semibold"
                  >
                    Control Name
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
              )}
              {visibleColumns.controlCode && (
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("controlCode")}
                    className="h-8 px-2 font-semibold"
                  >
                    Control Code
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
              )}
              {visibleColumns.functionalGrouping && (
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("functionalGrouping")}
                    className="h-8 px-2 font-semibold"
                  >
                    FunctionalGrouping
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
              )}
              {visibleColumns.status && (
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("status")}
                    className="h-8 px-2 font-semibold"
                  >
                    Status
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
              )}
              {visibleColumns.assignee && (
                <TableHead className="font-semibold">Assignee</TableHead>
              )}
              {visibleColumns.domain && (
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("domain")}
                    className="h-8 px-2 font-semibold"
                  >
                    Domain Name
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
              )}
              <TableHead className="w-[50px]">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.controlName}
                      onCheckedChange={(checked) => setVisibleColumns({ ...visibleColumns, controlName: checked })}
                    >
                      Control Name
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.controlCode}
                      onCheckedChange={(checked) => setVisibleColumns({ ...visibleColumns, controlCode: checked })}
                    >
                      Control Code
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.functionalGrouping}
                      onCheckedChange={(checked) => setVisibleColumns({ ...visibleColumns, functionalGrouping: checked })}
                    >
                      FunctionalGrouping
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.status}
                      onCheckedChange={(checked) => setVisibleColumns({ ...visibleColumns, status: checked })}
                    >
                      Status
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.assignee}
                      onCheckedChange={(checked) => setVisibleColumns({ ...visibleColumns, assignee: checked })}
                    >
                      Assignee
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.domain}
                      onCheckedChange={(checked) => setVisibleColumns({ ...visibleColumns, domain: checked })}
                    >
                      Domain Name
                    </DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                </TableCell>
              </TableRow>
            ) : paginatedControls.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No controls found for this framework.
                </TableCell>
              </TableRow>
            ) : (
              paginatedControls.map((control) => (
                <TableRow
                  key={control.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onDoubleClick={() => router.push(`/compliance/control/${control.id}`)}
                >
                  {visibleColumns.controlName && (
                    <TableCell className="font-medium">{control.name}</TableCell>
                  )}
                  {visibleColumns.controlCode && (
                    <TableCell>{control.controlCode}</TableCell>
                  )}
                  {visibleColumns.functionalGrouping && (
                    <TableCell>{control.functionalGrouping || "-"}</TableCell>
                  )}
                  {visibleColumns.status && (
                    <TableCell>{control.status}</TableCell>
                  )}
                  {visibleColumns.assignee && (
                    <TableCell>{getAssigneeName(control)}</TableCell>
                  )}
                  {visibleColumns.domain && (
                    <TableCell>{control.domain?.name || "-"}</TableCell>
                  )}
                  <TableCell></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex items-center justify-center gap-2 p-4 border-t">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(0)}
            disabled={currentPage === 0}
            className="h-8 w-8"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 0}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground px-3 py-1">
            {total > 0
              ? `Currently showing ${startIndex + 1} to ${endIndex} of ${total}`
              : "No controls"}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage >= totalPages - 1}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(totalPages - 1)}
            disabled={currentPage >= totalPages - 1}
            className="h-8 w-8"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
