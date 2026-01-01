"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Pencil,
  Plus,
  LayoutGrid,
  LayoutList,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Eye,
} from "lucide-react";
import { PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface AuditLogChange {
  id: string;
  attributeName: string;
  moduleName: string;
  oldValue: string | null;
  newValue: string | null;
}

interface AuditLog {
  id: string;
  entityType: string;
  referenceNumber: string;
  entityId: string;
  userName: string | null;
  type: string;
  attributeCount: number;
  createdAt: string;
  _count?: {
    changes: number;
  };
}

interface AuditLogDetail extends AuditLog {
  changes: AuditLogChange[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    currentPage: number;
    totalPages: number;
    hasMore: boolean;
  };
}

interface AuditLogsResponse {
  data: AuditLog[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

type SortField = "attributeName" | "moduleName" | "oldValue" | "newValue";
type SortDirection = "asc" | "desc" | null;
type TableSortField = "entityType" | "referenceNumber" | "createdAt" | "attributeCount" | "userName" | "type";

interface ColumnVisibility {
  attributeName: boolean;
  moduleName: boolean;
  oldValue: boolean;
  newValue: boolean;
}

interface TableColumnVisibility {
  entityType: boolean;
  referenceNumber: boolean;
  createdAt: boolean;
  attributeCount: boolean;
  userName: boolean;
  type: boolean;
}

export default function AuditLogsPage() {
  // View mode state
  const [viewMode, setViewMode] = useState<"list" | "table">("list");

  // State for audit logs list
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  // State for selected audit log detail
  const [selectedLog, setSelectedLog] = useState<AuditLogDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailPage, setDetailPage] = useState(1);
  const DETAIL_PAGE_SIZE = 10;

  // Table view pagination
  const [tableOffset, setTableOffset] = useState(0);
  const TABLE_PAGE_SIZE = 20;

  // Sorting state for detail view
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Sorting state for table view
  const [tableSortField, setTableSortField] = useState<TableSortField | null>(null);
  const [tableSortDirection, setTableSortDirection] = useState<SortDirection>(null);

  // Column visibility
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>({
    attributeName: true,
    moduleName: true,
    oldValue: true,
    newValue: true,
  });

  const [tableColumnVisibility, setTableColumnVisibility] = useState<TableColumnVisibility>({
    entityType: true,
    referenceNumber: true,
    createdAt: true,
    attributeCount: true,
    userName: true,
    type: true,
  });

  // View member dialog state
  const [viewMemberDialog, setViewMemberDialog] = useState<{
    open: boolean;
    change: AuditLogChange | null;
  }>({ open: false, change: null });

  // Fetch audit logs
  const fetchAuditLogs = useCallback(async (reset = false, search?: string) => {
    if (reset) {
      setLoading(true);
      setOffset(0);
      setTableOffset(0);
    } else {
      setLoadingMore(true);
    }

    try {
      const currentOffset = reset ? 0 : offset;
      const searchValue = search !== undefined ? search : searchTerm;
      const searchQuery = searchValue ? `&search=${encodeURIComponent(searchValue)}` : "";
      const res = await fetch(`/api/audit-logs?limit=20&offset=${currentOffset}${searchQuery}`);

      if (res.ok) {
        const data: AuditLogsResponse = await res.json();
        if (reset) {
          setAuditLogs(data.data);
        } else {
          setAuditLogs((prev) => [...prev, ...data.data]);
        }
        setHasMore(data.hasMore);
        setTotal(data.total);
        setOffset(currentOffset + data.data.length);
      }
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [offset, searchTerm]);

  // Fetch all logs for table view
  const fetchAllLogs = useCallback(async () => {
    setLoading(true);
    try {
      const searchQuery = searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : "";
      const res = await fetch(`/api/audit-logs?limit=1000&offset=0${searchQuery}`);

      if (res.ok) {
        const data: AuditLogsResponse = await res.json();
        setAuditLogs(data.data);
        setTotal(data.total);
      }
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  // Fetch audit log detail
  const fetchAuditLogDetail = async (id: string, page = 1) => {
    setLoadingDetail(true);
    try {
      const detailOffset = (page - 1) * DETAIL_PAGE_SIZE;
      const res = await fetch(`/api/audit-logs/${id}?limit=${DETAIL_PAGE_SIZE}&offset=${detailOffset}`);

      if (res.ok) {
        const data: AuditLogDetail = await res.json();
        setSelectedLog(data);
        setDetailPage(page);
      }
    } catch (error) {
      console.error("Error fetching audit log detail:", error);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    if (viewMode === "table") {
      fetchAllLogs();
    } else {
      fetchAuditLogs(true);
    }
  }, [viewMode]);

  // Handle search
  const handleSearch = () => {
    if (viewMode === "table") {
      fetchAllLogs();
    } else {
      fetchAuditLogs(true);
    }
  };

  // Handle refresh/clear
  const handleRefresh = () => {
    setSearchTerm("");
    setSelectedLog(null);
    setSortField(null);
    setSortDirection(null);
    setTableSortField(null);
    setTableSortDirection(null);
    if (viewMode === "table") {
      setTableOffset(0);
      fetchAllLogs();
    } else {
      fetchAuditLogs(true, "");
    }
  };

  // Handle load more
  const handleLoadMore = () => {
    fetchAuditLogs(false);
  };

  // Handle log selection
  const handleSelectLog = (log: AuditLog) => {
    fetchAuditLogDetail(log.id, 1);
  };

  // Handle detail pagination
  const handleDetailPageChange = (page: number) => {
    if (selectedLog) {
      fetchAuditLogDetail(selectedLog.id, page);
    }
  };

  // Handle table pagination
  const handleTablePageChange = (newOffset: number) => {
    setTableOffset(newOffset);
  };

  // Handle sorting for detail view
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortField(null);
        setSortDirection(null);
      } else {
        setSortDirection("asc");
      }
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Handle sorting for table view
  const handleTableSort = (field: TableSortField) => {
    if (tableSortField === field) {
      if (tableSortDirection === "asc") {
        setTableSortDirection("desc");
      } else if (tableSortDirection === "desc") {
        setTableSortField(null);
        setTableSortDirection(null);
      } else {
        setTableSortDirection("asc");
      }
    } else {
      setTableSortField(field);
      setTableSortDirection("asc");
    }
  };

  // Sort changes
  const getSortedChanges = () => {
    if (!selectedLog || !sortField || !sortDirection) {
      return selectedLog?.changes || [];
    }

    return [...selectedLog.changes].sort((a, b) => {
      const aValue = a[sortField] || "";
      const bValue = b[sortField] || "";
      const comparison = aValue.localeCompare(bValue);
      return sortDirection === "asc" ? comparison : -comparison;
    });
  };

  // Sort table logs
  const getSortedLogs = () => {
    if (!tableSortField || !tableSortDirection) {
      return auditLogs;
    }

    return [...auditLogs].sort((a, b) => {
      let aValue: string | number = "";
      let bValue: string | number = "";

      switch (tableSortField) {
        case "entityType":
          aValue = a.entityType;
          bValue = b.entityType;
          break;
        case "referenceNumber":
          aValue = a.referenceNumber;
          bValue = b.referenceNumber;
          break;
        case "createdAt":
          aValue = a.createdAt;
          bValue = b.createdAt;
          break;
        case "attributeCount":
          aValue = a.attributeCount;
          bValue = b.attributeCount;
          break;
        case "userName":
          aValue = a.userName || "";
          bValue = b.userName || "";
          break;
        case "type":
          aValue = a.type;
          bValue = b.type;
          break;
      }

      if (typeof aValue === "number" && typeof bValue === "number") {
        return tableSortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }

      const comparison = String(aValue).localeCompare(String(bValue));
      return tableSortDirection === "asc" ? comparison : -comparison;
    });
  };

  // Get paginated table logs
  const getPaginatedLogs = () => {
    const sorted = getSortedLogs();
    return sorted.slice(tableOffset, tableOffset + TABLE_PAGE_SIZE);
  };

  // Export to Excel (CSV format)
  const handleExportToExcel = () => {
    const headers = ["Module Name", "Ref id", "Changed date (UTC)", "Nr. of changes", "Changed by", "Type"];
    const rows = auditLogs.map((log) => [
      log.entityType,
      log.referenceNumber,
      formatDateForExport(log.createdAt),
      log.attributeCount.toString(),
      log.userName || "",
      log.type,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Format date for table
  const formatTableDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Format date for export
  const formatDateForExport = (dateString: string) => {
    const date = new Date(dateString);
    return date.toISOString().split("T")[0];
  };

  // Format date for detail header (UTC)
  const formatDetailDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZone: "UTC",
    }) + " (UTC)";
  };

  // Get sort icon
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1" />;
    if (sortDirection === "asc") return <ArrowUp className="h-3 w-3 ml-1" />;
    return <ArrowDown className="h-3 w-3 ml-1" />;
  };

  // Get table sort icon
  const getTableSortIcon = (field: TableSortField) => {
    if (tableSortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1" />;
    if (tableSortDirection === "asc") return <ArrowUp className="h-3 w-3 ml-1" />;
    return <ArrowDown className="h-3 w-3 ml-1" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Trail log overview" />

      <div className="bg-white rounded-lg border shadow-sm">
        {/* Header description */}
        <div className="p-4 border-b">
          <h4 className="text-lg font-semibold text-gray-900">Audit Trail log overview</h4>
          <p className="text-sm text-muted-foreground mt-1">
            Use this page to view all log entries stored by the Audit Trail module.
          </p>
        </div>

        <div className="flex flex-col">
          {/* View Toggle Toolbar */}
          <div className="p-3 border-b flex items-center gap-2">
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode("table")}
              title="Table View"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode("list")}
              title="List View"
            >
              <LayoutList className="h-4 w-4" />
            </Button>
          </div>

          {viewMode === "table" ? (
            /* Table View Mode */
            <div className="flex">
              {/* Main Table */}
              <div className="flex-1 flex flex-col border-r">
                {/* Export Button */}
                <div className="p-3 border-b">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportToExcel}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Export to Excel
                  </Button>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {tableColumnVisibility.entityType && (
                          <TableHead className="min-w-[200px]">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-auto p-0 font-semibold hover:bg-transparent"
                              onClick={() => handleTableSort("entityType")}
                            >
                              Module Name
                              {getTableSortIcon("entityType")}
                            </Button>
                          </TableHead>
                        )}
                        {tableColumnVisibility.referenceNumber && (
                          <TableHead className="min-w-[150px]">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-auto p-0 font-semibold hover:bg-transparent"
                              onClick={() => handleTableSort("referenceNumber")}
                            >
                              Ref id
                              {getTableSortIcon("referenceNumber")}
                            </Button>
                          </TableHead>
                        )}
                        {tableColumnVisibility.createdAt && (
                          <TableHead className="min-w-[120px]">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-auto p-0 font-semibold hover:bg-transparent"
                              onClick={() => handleTableSort("createdAt")}
                            >
                              Changed date (UTC)
                              {getTableSortIcon("createdAt")}
                            </Button>
                          </TableHead>
                        )}
                        {tableColumnVisibility.attributeCount && (
                          <TableHead className="min-w-[100px]">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-auto p-0 font-semibold hover:bg-transparent"
                              onClick={() => handleTableSort("attributeCount")}
                            >
                              Nr. of changes
                              {getTableSortIcon("attributeCount")}
                            </Button>
                          </TableHead>
                        )}
                        {tableColumnVisibility.userName && (
                          <TableHead className="min-w-[100px]">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-auto p-0 font-semibold hover:bg-transparent"
                              onClick={() => handleTableSort("userName")}
                            >
                              Changed by
                              {getTableSortIcon("userName")}
                            </Button>
                          </TableHead>
                        )}
                        {tableColumnVisibility.type && (
                          <TableHead className="min-w-[80px]">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-auto p-0 font-semibold hover:bg-transparent"
                              onClick={() => handleTableSort("type")}
                            >
                              Type
                              {getTableSortIcon("type")}
                            </Button>
                          </TableHead>
                        )}
                        <TableHead className="w-[50px]">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <LayoutGrid className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuCheckboxItem
                                checked={tableColumnVisibility.entityType}
                                onCheckedChange={(checked) =>
                                  setTableColumnVisibility((prev) => ({ ...prev, entityType: checked }))
                                }
                              >
                                Module Name
                              </DropdownMenuCheckboxItem>
                              <DropdownMenuCheckboxItem
                                checked={tableColumnVisibility.referenceNumber}
                                onCheckedChange={(checked) =>
                                  setTableColumnVisibility((prev) => ({ ...prev, referenceNumber: checked }))
                                }
                              >
                                Ref id
                              </DropdownMenuCheckboxItem>
                              <DropdownMenuCheckboxItem
                                checked={tableColumnVisibility.createdAt}
                                onCheckedChange={(checked) =>
                                  setTableColumnVisibility((prev) => ({ ...prev, createdAt: checked }))
                                }
                              >
                                Changed date (UTC)
                              </DropdownMenuCheckboxItem>
                              <DropdownMenuCheckboxItem
                                checked={tableColumnVisibility.attributeCount}
                                onCheckedChange={(checked) =>
                                  setTableColumnVisibility((prev) => ({ ...prev, attributeCount: checked }))
                                }
                              >
                                Nr. of changes
                              </DropdownMenuCheckboxItem>
                              <DropdownMenuCheckboxItem
                                checked={tableColumnVisibility.userName}
                                onCheckedChange={(checked) =>
                                  setTableColumnVisibility((prev) => ({ ...prev, userName: checked }))
                                }
                              >
                                Changed by
                              </DropdownMenuCheckboxItem>
                              <DropdownMenuCheckboxItem
                                checked={tableColumnVisibility.type}
                                onCheckedChange={(checked) =>
                                  setTableColumnVisibility((prev) => ({ ...prev, type: checked }))
                                }
                              >
                                Type
                              </DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getPaginatedLogs().map((log) => (
                        <TableRow
                          key={log.id}
                          className={cn(
                            "hover:bg-gray-50 cursor-pointer",
                            selectedLog?.id === log.id && "bg-blue-50"
                          )}
                          onClick={() => handleSelectLog(log)}
                        >
                          {tableColumnVisibility.entityType && (
                            <TableCell>{log.entityType}</TableCell>
                          )}
                          {tableColumnVisibility.referenceNumber && (
                            <TableCell>{log.referenceNumber}</TableCell>
                          )}
                          {tableColumnVisibility.createdAt && (
                            <TableCell>{formatTableDate(log.createdAt)}</TableCell>
                          )}
                          {tableColumnVisibility.attributeCount && (
                            <TableCell>{log.attributeCount}</TableCell>
                          )}
                          {tableColumnVisibility.userName && (
                            <TableCell>{log.userName || "-"}</TableCell>
                          )}
                          {tableColumnVisibility.type && (
                            <TableCell>{log.type}</TableCell>
                          )}
                          <TableCell></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Table Pagination */}
                <div className="p-3 border-t bg-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleTablePageChange(0)}
                      disabled={tableOffset === 0}
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleTablePageChange(Math.max(0, tableOffset - TABLE_PAGE_SIZE))}
                      disabled={tableOffset === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    <span className="hidden sm:inline">Currently showing </span>
                    {tableOffset + 1} to {Math.min(tableOffset + TABLE_PAGE_SIZE, auditLogs.length)} of {auditLogs.length}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleTablePageChange(tableOffset + TABLE_PAGE_SIZE)}
                      disabled={tableOffset + TABLE_PAGE_SIZE >= auditLogs.length}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        handleTablePageChange(
                          Math.floor((auditLogs.length - 1) / TABLE_PAGE_SIZE) * TABLE_PAGE_SIZE
                        )
                      }
                      disabled={tableOffset + TABLE_PAGE_SIZE >= auditLogs.length}
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Detail Panel for Table View */}
              <div className="w-[500px] flex flex-col">
                {selectedLog ? (
                  <>
                    {/* Detail Header */}
                    <div className="p-4 border-b bg-gray-50">
                      <h3 className="font-semibold text-gray-900">{selectedLog.entityType}</h3>
                      <p className="text-sm text-muted-foreground">
                        Reference # {selectedLog.referenceNumber}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedLog.attributeCount} attribute{selectedLog.attributeCount !== 1 ? "s" : ""} changed by{" "}
                        <span className="font-medium">{selectedLog.userName || "System"}</span> on{" "}
                        {formatDetailDate(selectedLog.createdAt)}
                      </p>
                    </div>

                    {/* Detail Changes Table */}
                    <div className="flex-1 overflow-auto">
                      {loadingDetail ? (
                        <div className="flex items-center justify-center h-64">
                          <p className="text-muted-foreground">Loading...</p>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {columnVisibility.attributeName && (
                                <TableHead className="w-[180px]">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-0 font-semibold hover:bg-transparent"
                                    onClick={() => handleSort("attributeName")}
                                  >
                                    Attribute Value
                                    {getSortIcon("attributeName")}
                                  </Button>
                                </TableHead>
                              )}
                              {columnVisibility.moduleName && (
                                <TableHead className="w-[100px]">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-0 font-semibold hover:bg-transparent"
                                    onClick={() => handleSort("moduleName")}
                                  >
                                    Module Name
                                    {getSortIcon("moduleName")}
                                  </Button>
                                </TableHead>
                              )}
                              {columnVisibility.oldValue && (
                                <TableHead>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-0 font-semibold hover:bg-transparent"
                                    onClick={() => handleSort("oldValue")}
                                  >
                                    Old value
                                    {getSortIcon("oldValue")}
                                  </Button>
                                </TableHead>
                              )}
                              {columnVisibility.newValue && (
                                <TableHead>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-0 font-semibold hover:bg-transparent"
                                    onClick={() => handleSort("newValue")}
                                  >
                                    New value
                                    {getSortIcon("newValue")}
                                  </Button>
                                </TableHead>
                              )}
                              <TableHead className="w-[40px]"></TableHead>
                              <TableHead className="w-[40px]">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <LayoutGrid className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuCheckboxItem
                                      checked={columnVisibility.attributeName}
                                      onCheckedChange={(checked) =>
                                        setColumnVisibility((prev) => ({ ...prev, attributeName: checked }))
                                      }
                                    >
                                      Attribute Value
                                    </DropdownMenuCheckboxItem>
                                    <DropdownMenuCheckboxItem
                                      checked={columnVisibility.moduleName}
                                      onCheckedChange={(checked) =>
                                        setColumnVisibility((prev) => ({ ...prev, moduleName: checked }))
                                      }
                                    >
                                      Module Name
                                    </DropdownMenuCheckboxItem>
                                    <DropdownMenuCheckboxItem
                                      checked={columnVisibility.oldValue}
                                      onCheckedChange={(checked) =>
                                        setColumnVisibility((prev) => ({ ...prev, oldValue: checked }))
                                      }
                                    >
                                      Old value
                                    </DropdownMenuCheckboxItem>
                                    <DropdownMenuCheckboxItem
                                      checked={columnVisibility.newValue}
                                      onCheckedChange={(checked) =>
                                        setColumnVisibility((prev) => ({ ...prev, newValue: checked }))
                                      }
                                    >
                                      New value
                                    </DropdownMenuCheckboxItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {getSortedChanges().map((change) => (
                              <TableRow key={change.id} className="hover:bg-gray-50">
                                {columnVisibility.attributeName && (
                                  <TableCell className="font-medium">{change.attributeName}</TableCell>
                                )}
                                {columnVisibility.moduleName && (
                                  <TableCell>{change.moduleName}</TableCell>
                                )}
                                {columnVisibility.oldValue && (
                                  <TableCell className="text-muted-foreground">{change.oldValue || ""}</TableCell>
                                )}
                                {columnVisibility.newValue && (
                                  <TableCell>{change.newValue || ""}</TableCell>
                                )}
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => setViewMemberDialog({ open: true, change })}
                                  >
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                </TableCell>
                                <TableCell></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>

                    {/* Detail Pagination */}
                    {selectedLog.pagination && (
                      <div className="p-3 border-t bg-gray-50 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDetailPageChange(1)}
                            disabled={detailPage === 1}
                          >
                            <ChevronsLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDetailPageChange(detailPage - 1)}
                            disabled={detailPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="text-sm text-muted-foreground">
                          {selectedLog.pagination.offset + 1} to{" "}
                          {Math.min(
                            selectedLog.pagination.offset + selectedLog.changes.length,
                            selectedLog.pagination.total
                          )}{" "}
                          of {selectedLog.pagination.total}
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDetailPageChange(detailPage + 1)}
                            disabled={detailPage >= selectedLog.pagination.totalPages}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDetailPageChange(selectedLog.pagination.totalPages)}
                            disabled={detailPage >= selectedLog.pagination.totalPages}
                          >
                            <ChevronsRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <p>Select an audit log entry to view details</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* List View Mode */
            <div className="flex">
              {/* Left Panel - Audit Log List */}
              <div className="w-[400px] border-r flex flex-col">
                {/* Search */}
                <div className="p-3 border-b">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Search"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      className="h-9"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={handleRefresh}
                      title="Refresh/Clear"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Log List */}
                <ScrollArea className="flex-1 h-[500px]">
                  <div className="divide-y">
                    {auditLogs.map((log) => (
                      <button
                        key={log.id}
                        onClick={() => handleSelectLog(log)}
                        className={cn(
                          "w-full p-3 text-left hover:bg-gray-50 transition-colors",
                          selectedLog?.id === log.id && "bg-blue-50 border-l-4 border-blue-500"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <div className="mt-1">
                            {log.type === "Create" ? (
                              <div className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center">
                                <Plus className="h-3 w-3 text-gray-500" />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded bg-blue-100 flex items-center justify-center">
                                <Pencil className="h-3 w-3 text-blue-600" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h5 className="font-medium text-sm text-gray-900 truncate">
                              {log.entityType}
                            </h5>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {log.attributeCount} attribute value{log.attributeCount !== 1 ? "s have" : " has"} changed.
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatDate(log.createdAt)}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Load More Button */}
                  {hasMore && (
                    <div className="p-3 border-t">
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                      >
                        <RefreshCw className={cn("h-4 w-4 mr-2", loadingMore && "animate-spin")} />
                        {loadingMore ? "Loading..." : "Load more..."}
                      </Button>
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Right Panel - Detail View */}
              <div className="flex-1 flex flex-col">
                {selectedLog ? (
                  <>
                    {/* Detail Header */}
                    <div className="p-4 border-b bg-gray-50">
                      <h3 className="font-semibold text-gray-900">{selectedLog.entityType}</h3>
                      <p className="text-sm text-muted-foreground">
                        Reference # {selectedLog.referenceNumber}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedLog.attributeCount} attribute{selectedLog.attributeCount !== 1 ? "s" : ""} changed by{" "}
                        <span className="font-medium">{selectedLog.userName || "System"}</span> on{" "}
                        {formatDetailDate(selectedLog.createdAt)}
                      </p>
                    </div>

                    {/* Changes Table */}
                    <div className="flex-1 overflow-auto">
                      {loadingDetail ? (
                        <div className="flex items-center justify-center h-64">
                          <p className="text-muted-foreground">Loading...</p>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {columnVisibility.attributeName && (
                                <TableHead className="w-[200px]">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-0 font-semibold hover:bg-transparent"
                                    onClick={() => handleSort("attributeName")}
                                  >
                                    Attribute Value
                                    {getSortIcon("attributeName")}
                                  </Button>
                                </TableHead>
                              )}
                              {columnVisibility.moduleName && (
                                <TableHead className="w-[120px]">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-0 font-semibold hover:bg-transparent"
                                    onClick={() => handleSort("moduleName")}
                                  >
                                    Module Name
                                    {getSortIcon("moduleName")}
                                  </Button>
                                </TableHead>
                              )}
                              {columnVisibility.oldValue && (
                                <TableHead>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-0 font-semibold hover:bg-transparent"
                                    onClick={() => handleSort("oldValue")}
                                  >
                                    Old value
                                    {getSortIcon("oldValue")}
                                  </Button>
                                </TableHead>
                              )}
                              {columnVisibility.newValue && (
                                <TableHead>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-0 font-semibold hover:bg-transparent"
                                    onClick={() => handleSort("newValue")}
                                  >
                                    New value
                                    {getSortIcon("newValue")}
                                  </Button>
                                </TableHead>
                              )}
                              <TableHead className="w-[50px]"></TableHead>
                              <TableHead className="w-[50px]">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <LayoutGrid className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuCheckboxItem
                                      checked={columnVisibility.attributeName}
                                      onCheckedChange={(checked) =>
                                        setColumnVisibility((prev) => ({ ...prev, attributeName: checked }))
                                      }
                                    >
                                      Attribute Value
                                    </DropdownMenuCheckboxItem>
                                    <DropdownMenuCheckboxItem
                                      checked={columnVisibility.moduleName}
                                      onCheckedChange={(checked) =>
                                        setColumnVisibility((prev) => ({ ...prev, moduleName: checked }))
                                      }
                                    >
                                      Module Name
                                    </DropdownMenuCheckboxItem>
                                    <DropdownMenuCheckboxItem
                                      checked={columnVisibility.oldValue}
                                      onCheckedChange={(checked) =>
                                        setColumnVisibility((prev) => ({ ...prev, oldValue: checked }))
                                      }
                                    >
                                      Old value
                                    </DropdownMenuCheckboxItem>
                                    <DropdownMenuCheckboxItem
                                      checked={columnVisibility.newValue}
                                      onCheckedChange={(checked) =>
                                        setColumnVisibility((prev) => ({ ...prev, newValue: checked }))
                                      }
                                    >
                                      New value
                                    </DropdownMenuCheckboxItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {getSortedChanges().map((change) => (
                              <TableRow key={change.id} className="hover:bg-gray-50">
                                {columnVisibility.attributeName && (
                                  <TableCell className="font-medium">{change.attributeName}</TableCell>
                                )}
                                {columnVisibility.moduleName && (
                                  <TableCell>{change.moduleName}</TableCell>
                                )}
                                {columnVisibility.oldValue && (
                                  <TableCell className="text-muted-foreground">{change.oldValue || ""}</TableCell>
                                )}
                                {columnVisibility.newValue && (
                                  <TableCell>{change.newValue || ""}</TableCell>
                                )}
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => setViewMemberDialog({ open: true, change })}
                                  >
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                </TableCell>
                                <TableCell></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>

                    {/* Pagination */}
                    {selectedLog.pagination && (
                      <div className="p-3 border-t bg-gray-50 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDetailPageChange(1)}
                            disabled={detailPage === 1}
                          >
                            <ChevronsLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDetailPageChange(detailPage - 1)}
                            disabled={detailPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="text-sm text-muted-foreground">
                          <span className="hidden sm:inline">Currently showing </span>
                          {selectedLog.pagination.offset + 1} to{" "}
                          {Math.min(
                            selectedLog.pagination.offset + selectedLog.changes.length,
                            selectedLog.pagination.total
                          )}{" "}
                          of {selectedLog.pagination.total}
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDetailPageChange(detailPage + 1)}
                            disabled={detailPage >= selectedLog.pagination.totalPages}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDetailPageChange(selectedLog.pagination.totalPages)}
                            disabled={detailPage >= selectedLog.pagination.totalPages}
                          >
                            <ChevronsRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <p>Select an audit log entry to view details</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* View Member Dialog */}
      <Dialog
        open={viewMemberDialog.open}
        onOpenChange={(open) => setViewMemberDialog({ open, change: null })}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>View member</DialogTitle>
          </DialogHeader>
          {viewMemberDialog.change && (
            <div className="space-y-4">
              <h4 className="font-semibold">{viewMemberDialog.change.attributeName}</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Old value:</p>
                  <p className="mt-1 p-2 bg-gray-50 rounded min-h-[40px]">
                    {viewMemberDialog.change.oldValue || <span className="text-muted-foreground italic">empty</span>}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">New value:</p>
                  <p className="mt-1 p-2 bg-gray-50 rounded min-h-[40px]">
                    {viewMemberDialog.change.newValue || <span className="text-muted-foreground italic">empty</span>}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Diff:</p>
                <div className="mt-1 p-2 bg-gray-50 rounded min-h-[40px]">
                  {viewMemberDialog.change.oldValue !== viewMemberDialog.change.newValue ? (
                    <div className="space-y-1 text-sm">
                      {viewMemberDialog.change.oldValue && (
                        <p className="text-red-600 line-through">{viewMemberDialog.change.oldValue}</p>
                      )}
                      {viewMemberDialog.change.newValue && (
                        <p className="text-green-600">{viewMemberDialog.change.newValue}</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground italic">No change</span>
                  )}
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setViewMemberDialog({ open: false, change: null })}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
