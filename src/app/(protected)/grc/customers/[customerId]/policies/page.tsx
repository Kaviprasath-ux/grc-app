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
  DialogFooter,
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
  FileCheck,
  Pencil,
  Trash2,
  ArrowUpDown,
  Home,
  ChevronRight,
  CloudOff,
  FileEdit,
  BadgeCheck,
  AlertTriangle,
  Upload,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isValidName } from "@/lib/validations";
import Link from "next/link";

interface PolicyItem {
  id: string;
  code: string;
  name: string;
  documentType: string;
  status: string;
  version: string;
  department: { id: string; name: string } | null;
  assignee: { id: string; fullName: string } | null;
  approver: { id: string; fullName: string } | null;
  frameworkId?: string;
}

interface Customer {
  id: string;
  customerCode: string;
  customerName: string;
}

const POLICY_STATUSES = ["Not Uploaded", "Draft", "Approved", "Needs Review", "Published"] as const;

export default function CustomerPoliciesPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { t } = useLanguage();
  const customerId = params.customerId as string;
  const frameworkId = searchParams.get("frameworkId");

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [policies, setPolicies] = useState<PolicyItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Sub-tab state
  const [policySubTab, setPolicySubTab] = useState<"Dashboard" | "Policy" | "Standard" | "Procedure">("Dashboard");
  const [policySearchQuery, setPolicySearchQuery] = useState("");
  const [policyStatusFilter, setPolicyStatusFilter] = useState<string>("all");
  const [policySortField, setPolicySortField] = useState<string>("name");
  const [policySortAsc, setPolicySortAsc] = useState(true);

  // Edit/delete states
  const [editItem, setEditItem] = useState<{ id: string; name: string } | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editItemError, setEditItemError] = useState("");
  const [isEditItemDialogOpen, setIsEditItemDialogOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{ id: string; name: string } | null>(null);
  const [isDeleteItemDialogOpen, setIsDeleteItemDialogOpen] = useState(false);

  useEffect(() => {
    fetchCustomer();
    fetchPolicies();
  }, [customerId]);

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

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/grc/customers/${customerId}/policies`);
      if (response.ok) {
        const data = await response.json();
        setPolicies(data);
      }
    } catch (error) {
      console.error("Error fetching policies:", error);
    } finally {
      setLoading(false);
    }
  };

  // If frameworkId is provided, filter policies by framework (client-side)
  const basePolicies = useMemo(() => {
    if (!frameworkId) return policies;
    return policies.filter((p) => p.frameworkId === frameworkId);
  }, [policies, frameworkId]);

  // Filter policies by sub-tab document type
  const filteredByType = useMemo(() => {
    const policySubTabType = policySubTab === "Policy" ? "Policy" : policySubTab === "Standard" ? "Standard" : policySubTab === "Procedure" ? "Procedure" : null;
    return policySubTabType ? basePolicies.filter((p) => p.documentType === policySubTabType) : basePolicies;
  }, [basePolicies, policySubTab]);

  // Status counts
  const statusCounts = useMemo(() => {
    return POLICY_STATUSES.reduce((acc, s) => {
      acc[s] = filteredByType.filter((p) => p.status === s).length;
      return acc;
    }, {} as Record<string, number>);
  }, [filteredByType]);

  // Apply search, status filter, and sorting for list sub-tabs
  const listPolicies = useMemo(() => {
    return filteredByType
      .filter((p) => {
        if (policySearchQuery) {
          const q = policySearchQuery.toLowerCase();
          if (!p.name.toLowerCase().includes(q) && !p.code.toLowerCase().includes(q)) return false;
        }
        if (policyStatusFilter !== "all" && p.status !== policyStatusFilter) return false;
        return true;
      })
      .sort((a, b) => {
        let aVal = "";
        let bVal = "";
        if (policySortField === "name") { aVal = a.name; bVal = b.name; }
        else if (policySortField === "status") { aVal = a.status; bVal = b.status; }
        else if (policySortField === "assignee") { aVal = a.assignee?.fullName || ""; bVal = b.assignee?.fullName || ""; }
        else if (policySortField === "approver") { aVal = a.approver?.fullName || ""; bVal = b.approver?.fullName || ""; }
        else if (policySortField === "department") { aVal = a.department?.name || ""; bVal = b.department?.name || ""; }
        const cmp = aVal.localeCompare(bVal);
        return policySortAsc ? cmp : -cmp;
      });
  }, [filteredByType, policySearchQuery, policyStatusFilter, policySortField, policySortAsc]);

  const handlePolicySortToggle = (field: string) => {
    if (policySortField === field) {
      setPolicySortAsc(!policySortAsc);
    } else {
      setPolicySortField(field);
      setPolicySortAsc(true);
    }
  };

  // Edit handlers
  const handleEditItem = (id: string, name: string) => {
    setEditItem({ id, name });
    setEditItemName(name);
    setEditItemError("");
    setIsEditItemDialogOpen(true);
  };

  const handleSaveEditItem = async () => {
    if (!editItem) return;
    if (!editItemName.trim()) {
      setEditItemError(t("Name is required"));
      return;
    } else if (!isValidName(editItemName.trim())) {
      setEditItemError(t("Only letters, numbers, spaces, and hyphens are allowed"));
      return;
    }
    setEditItemError("");
    try {
      const response = await fetch(`/api/policies/${editItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editItemName }),
      });
      if (response.ok) {
        toast({ title: t("Success"), description: t("Item updated successfully") });
        fetchPolicies();
        setIsEditItemDialogOpen(false);
      } else {
        const error = await response.json();
        toast({ title: t("Error"), description: error.error || t("Failed to update"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error updating item:", error);
      toast({ title: t("Error"), description: t("Failed to update"), variant: "destructive" });
    }
  };

  // Delete handlers
  const handleDeleteItem = (id: string, name: string) => {
    setDeleteItem({ id, name });
    setIsDeleteItemDialogOpen(true);
  };

  const handleConfirmDeleteItem = async () => {
    if (!deleteItem) return;
    try {
      const response = await fetch(`/api/policies/${deleteItem.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        toast({ title: t("Success"), description: t("Item deleted successfully") });
        fetchPolicies();
        setIsDeleteItemDialogOpen(false);
      } else {
        const error = await response.json();
        toast({ title: t("Error"), description: error.error || t("Failed to delete"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error deleting item:", error);
      toast({ title: t("Error"), description: t("Failed to delete"), variant: "destructive" });
    }
  };

  const statusCardData = [
    { label: "Not Uploaded", icon: CloudOff },
    { label: "Draft", icon: FileEdit },
    { label: "Approved", icon: BadgeCheck },
    { label: "Needs Review", icon: AlertTriangle },
    { label: "Published", icon: Upload },
  ];

  if (loading && policies.length === 0) {
    return (
      <div className="space-y-6">
        <nav className="flex items-center gap-1.5 text-sm">
          <Link href="/grc" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
            <Home className="h-4 w-4" />
            <span>{t("GRC")}</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <Link href="/grc/customers" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Customers")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-slate-500">{t("Customer")}</span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-primary-700 font-medium">{t("Policies")}</span>
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
        <Link href="/grc" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("GRC")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/grc/customers" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Customers")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href={`/grc/customers/${customerId}/frameworks`} className="text-slate-500 hover:text-primary-600 transition-colors">
          {customer?.customerName || t("Customer")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Policies")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
          {customer?.customerName ? `${customer.customerName} — ${t("Policies")}` : t("Policies")}
        </h1>
      </div>

      {/* Content */}
      <Tabs value={policySubTab} onValueChange={(v) => { setPolicySubTab(v as "Dashboard" | "Policy" | "Standard" | "Procedure"); setPolicySearchQuery(""); setPolicyStatusFilter("all"); }}>
        <TabsList>
          <TabsTrigger value="Dashboard">{t("Dashboard")}</TabsTrigger>
          <TabsTrigger value="Policy">{t("Policy")}</TabsTrigger>
          <TabsTrigger value="Standard">{t("Standards")}</TabsTrigger>
          <TabsTrigger value="Procedure">{t("Procedures")}</TabsTrigger>
        </TabsList>

        <TabsContent value={policySubTab} className="mt-6 space-y-5">
        {/* Status Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {statusCardData.map(({ label, icon: Icon }) => (
            <div key={label} className="bg-white rounded-xl p-3 sm:p-5 border border-slate-200">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50 text-primary-600">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <div className="text-3xl font-bold tracking-tight text-slate-800">{statusCounts[label] || 0}</div>
              <div className="mt-1 text-sm font-medium text-slate-500">{t(label)}</div>
            </div>
          ))}
        </div>

        {/* List view for Policy / Standard / Procedure sub-tabs */}
        {policySubTab !== "Dashboard" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 px-3 sm:px-5 py-3 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={t("Search by name or code...")}
                  value={policySearchQuery}
                  onChange={(e) => setPolicySearchQuery(e.target.value)}
                  className="w-full sm:w-64 ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
                />
              </div>
              <div className="ltr:ml-auto rtl:mr-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                <Select value={policyStatusFilter} onValueChange={setPolicyStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[150px] h-9 text-sm bg-slate-50 border-slate-200">
                    <SelectValue placeholder={t("All Status")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                    <SelectItem value="all">{t("All Status")}</SelectItem>
                    {POLICY_STATUSES.map((s) => <SelectItem key={s} value={s}>{t(s)}</SelectItem>)}
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
                      { key: "name", label: t("Name") },
                      { key: "status", label: t("Status") },
                      { key: "assignee", label: t("Assignee") },
                      { key: "approver", label: t("Approver") },
                      { key: "department", label: t("Department") },
                    ].map((col, i) => (
                      <TableHead key={col.key} className={`text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3 cursor-pointer ${i === 0 ? "ps-5" : ""}`} onClick={() => handlePolicySortToggle(col.key)}>
                        <span className="flex items-center gap-1">{col.label} <ArrowUpDown className="h-3 w-3" /></span>
                      </TableHead>
                    ))}
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3 pe-5">{t("Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listPolicies.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={6}>
                        <div className="py-16 text-center">
                          <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                            <FileCheck className="h-6 w-6 text-primary-500" />
                          </div>
                          <h3 className="text-sm font-medium text-slate-600 mb-1">{t("No Items Found")}</h3>
                          <p className="text-xs text-slate-400">{t("Try adjusting your search or filters.")}</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    listPolicies.map((pol) => (
                      <TableRow key={pol.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                        <TableCell className="py-3.5 ps-5 text-sm font-medium text-slate-800">{pol.name}</TableCell>
                        <TableCell className="py-3.5 text-sm text-slate-600">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                            pol.status === "Published" || pol.status === "Approved" ? "bg-green-50 text-green-700 border-green-200" :
                            pol.status === "Draft" ? "bg-blue-50 text-blue-700 border-blue-200" :
                            pol.status === "Not Uploaded" ? "bg-slate-50 text-slate-700 border-slate-200" :
                            "bg-amber-50 text-amber-700 border-amber-200"
                          }`}>{t(pol.status)}</span>
                        </TableCell>
                        <TableCell className="py-3.5 text-sm text-slate-600">{pol.assignee?.fullName || "-"}</TableCell>
                        <TableCell className="py-3.5 text-sm text-slate-600">{pol.approver?.fullName || "-"}</TableCell>
                        <TableCell className="py-3.5 text-sm text-slate-600">{pol.department?.name || "-"}</TableCell>
                        <TableCell className="py-3.5 pe-5">
                          <div className="flex items-center justify-end gap-0.5">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50" onClick={() => handleEditItem(pol.id, pol.name)} title={t("Edit")}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50" onClick={() => handleDeleteItem(pol.id, pol.name)} title={t("Delete")}>
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
        )}
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={isEditItemDialogOpen} onOpenChange={setIsEditItemDialogOpen}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Edit Policy")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="editItemName">{t("Name")}</Label>
              <Input
                id="editItemName"
                value={editItemName}
                onChange={(e) => { setEditItemName(e.target.value); setEditItemError(""); }}
                className="mt-1"
              />
              {editItemError && <p className="text-xs text-red-500 mt-1">{editItemError}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditItemDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleSaveEditItem}>
              {t("Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteItemDialogOpen} onOpenChange={setIsDeleteItemDialogOpen}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Delete Policy")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 py-2">
            {t("Are you sure you want to delete")} <strong>{deleteItem?.name}</strong>? {t("This action cannot be undone.")}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteItemDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button variant="destructive" onClick={handleConfirmDeleteItem}>
              {t("Delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
