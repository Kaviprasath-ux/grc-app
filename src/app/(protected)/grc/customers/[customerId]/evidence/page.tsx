"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  ClipboardList,
  Pencil,
  Trash2,
  ArrowUpDown,
  Home,
  ChevronRight,
  Layers,
  CloudOff,
  FileText,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { isValidName } from "@/lib/validations";

interface EvidenceItem {
  id: string;
  evidenceCode: string;
  name: string;
  description: string | null;
  status: string;
  domain: string | null;
  framework: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  assignee: { id: string; fullName: string } | null;
}

interface Customer {
  id: string;
  customerCode: string;
  customerName: string;
}

export default function CustomerEvidencePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { t } = useLanguage();
  const customerId = params.customerId as string;
  const frameworkIdParam = searchParams.get("frameworkId");

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [evidences, setEvidences] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Sub-tab state
  const [evidenceSubTab, setEvidenceSubTab] = useState<"Dashboard" | "AllEvidence">("Dashboard");
  const [evidenceSearchQuery, setEvidenceSearchQuery] = useState("");
  const [evidenceDeptFilter, setEvidenceDeptFilter] = useState<string>("all");
  const [evidenceFrameworkFilter, setEvidenceFrameworkFilter] = useState<string>("all");
  const [evidenceSortField, setEvidenceSortField] = useState<string>("evidenceCode");
  const [evidenceSortAsc, setEvidenceSortAsc] = useState(true);

  // Edit/Delete states
  const [editItem, setEditItem] = useState<{ id: string; name: string } | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editItemError, setEditItemError] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{ id: string; name: string } | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    fetchCustomer();
    fetchEvidences();
  }, [customerId]);

  // If frameworkId param is present, pre-set the framework filter
  useEffect(() => {
    if (frameworkIdParam) {
      // We filter by framework name in the dropdown, so we need to wait for evidences to load
      // and find the matching framework name
      const matchingEvidence = evidences.find(
        (e) => e.framework?.id === frameworkIdParam
      );
      if (matchingEvidence?.framework?.name) {
        setEvidenceFrameworkFilter(matchingEvidence.framework.name);
        setEvidenceSubTab("AllEvidence");
      }
    }
  }, [frameworkIdParam, evidences]);

  const fetchCustomer = async () => {
    try {
      const response = await fetch("/api/grc/customers");
      if (response.ok) {
        const data = await response.json();
        const found = data.find((c: Customer) => c.id === customerId);
        setCustomer(found || null);
      }
    } catch (error) {
      console.error("Error fetching customer:", error);
    }
  };

  const fetchEvidences = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/grc/customers/${customerId}/evidences`
      );
      if (response.ok) {
        const data = await response.json();
        setEvidences(data);
      }
    } catch (error) {
      console.error("Error fetching evidences:", error);
    } finally {
      setLoading(false);
    }
  };

  // Status counts for cards
  const evStatusCounts = useMemo(() => {
    return {
      "Total count": evidences.length,
      "Not Uploaded": evidences.filter((e) => e.status === "Not Uploaded").length,
      "Draft": evidences.filter((e) => e.status === "Draft").length,
      "Need Attention": evidences.filter((e) => e.status === "Need Attention").length,
      "Published": evidences.filter((e) => e.status === "Published").length,
    };
  }, [evidences]);

  // Unique frameworks for dropdown
  const evFrameworks = useMemo(
    () =>
      Array.from(
        new Set(
          evidences.filter((e) => e.framework).map((e) => e.framework!.name)
        )
      ),
    [evidences]
  );

  // Unique departments for dropdown
  const evDepartments = useMemo(
    () =>
      Array.from(
        new Set(
          evidences.filter((e) => e.department).map((e) => e.department!.name)
        )
      ),
    [evidences]
  );

  // Filtered & sorted evidences for list view
  const listEvidences = useMemo(() => {
    return evidences
      .filter((ev) => {
        if (evidenceSearchQuery) {
          const q = evidenceSearchQuery.toLowerCase();
          if (
            !ev.name.toLowerCase().includes(q) &&
            !ev.evidenceCode.toLowerCase().includes(q)
          )
            return false;
        }
        if (
          evidenceDeptFilter !== "all" &&
          ev.department?.name !== evidenceDeptFilter
        )
          return false;
        if (
          evidenceFrameworkFilter !== "all" &&
          ev.framework?.name !== evidenceFrameworkFilter
        )
          return false;
        return true;
      })
      .sort((a, b) => {
        let aVal = "";
        let bVal = "";
        if (evidenceSortField === "evidenceCode") {
          aVal = a.evidenceCode;
          bVal = b.evidenceCode;
        } else if (evidenceSortField === "name") {
          aVal = a.name;
          bVal = b.name;
        } else if (evidenceSortField === "status") {
          aVal = a.status;
          bVal = b.status;
        } else if (evidenceSortField === "assignee") {
          aVal = a.assignee?.fullName || "";
          bVal = b.assignee?.fullName || "";
        } else if (evidenceSortField === "department") {
          aVal = a.department?.name || "";
          bVal = b.department?.name || "";
        }
        const cmp = aVal.localeCompare(bVal);
        return evidenceSortAsc ? cmp : -cmp;
      });
  }, [
    evidences,
    evidenceSearchQuery,
    evidenceDeptFilter,
    evidenceFrameworkFilter,
    evidenceSortField,
    evidenceSortAsc,
  ]);

  const handleEvSortToggle = (field: string) => {
    if (evidenceSortField === field) {
      setEvidenceSortAsc(!evidenceSortAsc);
    } else {
      setEvidenceSortField(field);
      setEvidenceSortAsc(true);
    }
  };

  // Edit handlers
  const handleEditItem = (id: string, name: string) => {
    setEditItem({ id, name });
    setEditItemName(name);
    setEditItemError("");
    setIsEditDialogOpen(true);
  };

  const handleSaveEditItem = async () => {
    if (!editItem) return;
    if (!editItemName.trim()) {
      setEditItemError(t("Name is required"));
      return;
    } else if (!isValidName(editItemName.trim())) {
      setEditItemError(
        t("Only letters, numbers, spaces, and hyphens are allowed")
      );
      return;
    }
    setEditItemError("");
    try {
      const response = await fetch(`/api/evidences/${editItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editItemName }),
      });
      if (response.ok) {
        toast({
          title: t("Success"),
          description: t("Item updated successfully"),
        });
        fetchEvidences();
        setIsEditDialogOpen(false);
      } else {
        const error = await response.json();
        toast({
          title: t("Error"),
          description: error.error || t("Failed to update"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error updating item:", error);
      toast({
        title: t("Error"),
        description: t("Failed to update"),
        variant: "destructive",
      });
    }
  };

  // Delete handlers
  const handleDeleteItem = (id: string, name: string) => {
    setDeleteItem({ id, name });
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDeleteItem = async () => {
    if (!deleteItem) return;
    try {
      const response = await fetch(`/api/evidences/${deleteItem.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        toast({
          title: t("Success"),
          description: t("Item deleted successfully"),
        });
        fetchEvidences();
        setIsDeleteDialogOpen(false);
      } else {
        const error = await response.json();
        toast({
          title: t("Error"),
          description: error.error || t("Failed to delete"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error deleting item:", error);
      toast({
        title: t("Error"),
        description: t("Failed to delete"),
        variant: "destructive",
      });
    }
  };

  const evStatusCardData = [
    {
      label: "Total count",
      icon: <Layers className="h-5 w-5" />,
    },
    {
      label: "Not Uploaded",
      icon: <CloudOff className="h-5 w-5" />,
    },
    {
      label: "Draft",
      icon: <FileText className="h-5 w-5" />,
    },
    {
      label: "Need Attention",
      icon: <AlertTriangle className="h-5 w-5" />,
    },
    {
      label: "Published",
      icon: <CheckCircle2 className="h-5 w-5" />,
    },
  ];

  // Status badge styling helper
  const getStatusBadgeClasses = (status: string) => {
    if (status === "Published" || status === "Validated") {
      return "bg-green-50 text-green-700 border-green-200";
    }
    if (status === "Draft") {
      return "bg-blue-50 text-blue-700 border-blue-200";
    }
    if (status === "Not Uploaded") {
      return "bg-slate-50 text-slate-700 border-slate-200";
    }
    return "bg-amber-50 text-amber-700 border-amber-200";
  };

  // Reusable status cards renderer
  const renderStatusCards = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
      {evStatusCardData.map(({ label, icon }) => (
        <div
          key={label}
          className="bg-white rounded-xl p-3 sm:p-5 border border-slate-200"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50 text-primary-600">
              {icon}
            </div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-slate-800">
            {evStatusCounts[label as keyof typeof evStatusCounts] || 0}
          </div>
          <div className="mt-1 text-sm font-medium text-slate-500">
            {t(label)}
          </div>
        </div>
      ))}
    </div>
  );

  // Loading state
  if (loading && evidences.length === 0) {
    return (
      <div className="space-y-6">
        <nav className="flex items-center gap-1.5 text-sm">
          <Link
            href="/grc"
            className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors"
          >
            <Home className="h-4 w-4" />
            <span>{t("GRC")}</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <Link
            href="/grc/customers"
            className="text-slate-500 hover:text-primary-600 transition-colors"
          >
            {t("Customers")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-slate-500">{t("Customer")}</span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-primary-700 font-medium">{t("Evidence")}</span>
        </nav>
        <div className="bg-white rounded-xl border border-slate-200 p-16 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link
          href="/grc"
          className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors"
        >
          <Home className="h-4 w-4" />
          <span>{t("GRC")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link
          href="/grc/customers"
          className="text-slate-500 hover:text-primary-600 transition-colors"
        >
          {t("Customers")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link
          href={`/grc/customers/${customerId}/frameworks`}
          className="text-slate-500 hover:text-primary-600 transition-colors"
        >
          {customer?.customerName || t("Customer")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Evidence")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
          {customer?.customerName
            ? `${customer.customerName} — ${t("Evidence")}`
            : t("Evidence")}
        </h1>
      </div>

      {/* Sub-tabs */}
      <Tabs value={evidenceSubTab} onValueChange={(v) => { setEvidenceSubTab(v as "Dashboard" | "AllEvidence"); setEvidenceSearchQuery(""); setEvidenceDeptFilter("all"); setEvidenceFrameworkFilter("all"); }}>
        <TabsList>
          <TabsTrigger value="Dashboard">{t("Dashboard")}</TabsTrigger>
          <TabsTrigger value="AllEvidence">{t("All Evidence")}</TabsTrigger>
        </TabsList>

        {/* Dashboard sub-tab */}
        <TabsContent value="Dashboard" className="mt-6 space-y-6">
          {renderStatusCards()}
        </TabsContent>

        {/* All Evidence sub-tab */}
        <TabsContent value="AllEvidence" className="mt-6 space-y-6">
          {/* Status Cards */}
          {renderStatusCards()}

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 px-3 sm:px-5 py-3 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={t("Search by name...")}
                  value={evidenceSearchQuery}
                  onChange={(e) => setEvidenceSearchQuery(e.target.value)}
                  className="w-full sm:w-64 ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
                />
              </div>
              <div className="ltr:ml-auto rtl:mr-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                <Select
                  value={evidenceFrameworkFilter}
                  onValueChange={setEvidenceFrameworkFilter}
                >
                  <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm bg-slate-50 border-slate-200">
                    <SelectValue placeholder={t("Framework")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                    <SelectItem value="all">{t("All Frameworks")}</SelectItem>
                    {evFrameworks.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={evidenceDeptFilter}
                  onValueChange={setEvidenceDeptFilter}
                >
                  <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm bg-slate-50 border-slate-200">
                    <SelectValue placeholder={t("Department")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                    <SelectItem value="all">{t("All Departments")}</SelectItem>
                    {evDepartments.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow className="border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                    {[
                      { key: "evidenceCode", label: t("Code") },
                      { key: "name", label: t("Name") },
                      { key: "status", label: t("Status") },
                      { key: "assignee", label: t("Assignee") },
                      { key: "department", label: t("Department") },
                    ].map((col, i) => (
                      <TableHead
                        key={col.key}
                        className={`text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3 cursor-pointer ${
                          i === 0 ? "ps-5" : ""
                        }`}
                        onClick={() => handleEvSortToggle(col.key)}
                      >
                        <span className="flex items-center gap-1">
                          {col.label} <ArrowUpDown className="h-3 w-3" />
                        </span>
                      </TableHead>
                    ))}
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3 pe-5">
                      {t("Actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listEvidences.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={6}>
                        <div className="py-16 text-center">
                          <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                            <ClipboardList className="h-6 w-6 text-primary-500" />
                          </div>
                          <h3 className="text-sm font-medium text-slate-600 mb-1">
                            {t("No Evidence Found")}
                          </h3>
                          <p className="text-xs text-slate-400">
                            {t("Try adjusting your search or filters.")}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    listEvidences.map((ev) => (
                      <TableRow
                        key={ev.id}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors"
                      >
                        <TableCell className="py-3.5 ps-5 text-sm font-medium text-slate-800">
                          {ev.evidenceCode}
                        </TableCell>
                        <TableCell className="py-3.5 text-sm text-slate-600">
                          {ev.name}
                        </TableCell>
                        <TableCell className="py-3.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeClasses(ev.status)}`}
                          >
                            {ev.status}
                          </span>
                        </TableCell>
                        <TableCell className="py-3.5 text-sm text-slate-600">
                          {ev.assignee?.fullName || "-"}
                        </TableCell>
                        <TableCell className="py-3.5 text-sm text-slate-600">
                          {ev.department?.name || "-"}
                        </TableCell>
                        <TableCell className="py-3.5 pe-5">
                          <div className="flex items-center justify-end gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                              onClick={() =>
                                handleEditItem(ev.id, ev.name)
                              }
                              title={t("Edit")}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                              onClick={() =>
                                handleDeleteItem(ev.id, ev.name)
                              }
                              title={t("Delete")}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent
          className="max-w-[95vw] sm:max-w-[400px] p-0 gap-0 overflow-hidden"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {t("Edit")} {t("evidence")}
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5">
            <div className="space-y-1.5">
              <Label
                htmlFor="edit-item-name"
                className="text-sm font-medium text-slate-700"
              >
                {t("Name")}
              </Label>
              <Input
                id="edit-item-name"
                value={editItemName}
                onChange={(e) => {
                  setEditItemName(e.target.value);
                  setEditItemError("");
                }}
                placeholder={t("Enter name")}
              />
              {editItemError && (
                <p className="text-sm text-red-500">{editItemError}</p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditDialogOpen(false)}
            >
              {t("Cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleSaveEditItem}
              disabled={!editItemName.trim()}
            >
              {t("Save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent
          className="max-w-[95vw] sm:max-w-[400px] p-0 gap-0 overflow-hidden"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {t("Confirm Delete")}
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5">
            <p className="text-sm text-slate-600">
              {t("Are you sure you want to delete")}{" "}
              <strong>{deleteItem?.name}</strong>?{" "}
              {t("This action cannot be undone.")}
            </p>
          </div>
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              {t("Cancel")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDeleteItem}
            >
              {t("Delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
