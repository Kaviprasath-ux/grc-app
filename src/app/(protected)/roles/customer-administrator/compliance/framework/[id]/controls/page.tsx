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
  Home,
} from "lucide-react";
import { Unauthorized } from "@/components/ui/unauthorized";
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
  const [framework, setFramework] = useState<{ id: string; name: string; status: string } | null>(null);

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

        // Store framework info including status for access control
        setFramework({ id: frameworkData.id, name: frameworkData.name, status: (frameworkData as { status?: string }).status || "Subscribed" });

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
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/roles/customer-administrator/compliance" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>Compliance</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <Link href="/roles/customer-administrator/compliance/framework" className="text-slate-500 hover:text-primary-600 transition-colors">
          Integrated Frameworks
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">Controls</span>
      </nav>

      {/* Page Header */}
      <h1 className="text-2xl font-bold text-slate-800">Controls</h1>

      {/* Search Row */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="Search by control code or name..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrentPage(0);
          }}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="max-w-md bg-white"
        />
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-100 bg-slate-50/50">
              {visibleColumns.controlName && (
                <TableHead
                  className="text-xs font-semibold text-slate-600 py-4 pl-4 cursor-pointer select-none"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center gap-2">
                    Control Name
                    <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </TableHead>
              )}
              {visibleColumns.controlCode && (
                <TableHead
                  className="text-xs font-semibold text-slate-600 py-4 cursor-pointer select-none"
                  onClick={() => handleSort("controlCode")}
                >
                  <div className="flex items-center gap-2">
                    Control Code
                    <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </TableHead>
              )}
              {visibleColumns.functionalGrouping && (
                <TableHead
                  className="text-xs font-semibold text-slate-600 py-4 cursor-pointer select-none"
                  onClick={() => handleSort("functionalGrouping")}
                >
                  <div className="flex items-center gap-2">
                    Functional Grouping
                    <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </TableHead>
              )}
              {visibleColumns.status && (
                <TableHead
                  className="text-xs font-semibold text-slate-600 py-4 cursor-pointer select-none"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center gap-2">
                    Status
                    <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </TableHead>
              )}
              {visibleColumns.assignee && (
                <TableHead className="text-xs font-semibold text-slate-600 py-4">Assignee</TableHead>
              )}
              {visibleColumns.domain && (
                <TableHead
                  className="text-xs font-semibold text-slate-600 py-4 cursor-pointer select-none"
                  onClick={() => handleSort("domain")}
                >
                  <div className="flex items-center gap-2">
                    Domain Name
                    <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </TableHead>
              )}
              <TableHead className="w-[50px] py-4">
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
                    <div className="relative h-6 w-6">
                      <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
                      <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : paginatedControls.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                  No controls found for this framework.
                </TableCell>
              </TableRow>
            ) : (
              paginatedControls.map((control) => (
                <TableRow
                  key={control.id}
                  className="border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50"
                  onDoubleClick={() => router.push(`/compliance/control/${control.id}`)}
                >
                  {visibleColumns.controlName && (
                    <TableCell className="py-4 pl-4 text-sm font-medium text-slate-900">{control.name}</TableCell>
                  )}
                  {visibleColumns.controlCode && (
                    <TableCell className="py-4 text-sm text-slate-700">{control.controlCode}</TableCell>
                  )}
                  {visibleColumns.functionalGrouping && (
                    <TableCell className="py-4 text-sm text-slate-700">{control.functionalGrouping || "-"}</TableCell>
                  )}
                  {visibleColumns.status && (
                    <TableCell className="py-4 text-sm text-slate-700">{control.status}</TableCell>
                  )}
                  {visibleColumns.assignee && (
                    <TableCell className="py-4 text-sm text-slate-700">{getAssigneeName(control)}</TableCell>
                  )}
                  {visibleColumns.domain && (
                    <TableCell className="py-4 text-sm text-slate-700">{control.domain?.name || "-"}</TableCell>
                  )}
                  <TableCell className="py-4"></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
          <span className="text-sm text-slate-500">
            {total > 0
              ? `${startIndex + 1} to ${endIndex} of ${total}`
              : "No controls"}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage(0)}
              disabled={currentPage === 0}
              className="h-8 w-8"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 0}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage >= totalPages - 1}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
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
    </div>
  );
}
