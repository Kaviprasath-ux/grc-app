"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Home, ChevronRight, ListChecks, Search, ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedData } from "@/hooks/useTranslatedData";

interface Engagement {
  id: string;
  auditId: string;
  engagementTitle: string;
  status: string;
  department?: { id: string; name: string } | null;
  assignedAuditors?: string[];
}

interface Department {
  id: string;
  name: string;
}

const statusBadge = (status: string): string => {
  switch ((status || "").toLowerCase()) {
    case "completed":
      return "bg-green-100 text-green-700";
    case "in progress":
      return "bg-blue-100 text-blue-700";
    case "pending":
      return "bg-yellow-100 text-yellow-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
};

export default function FollowUpListPage() {
  const { t } = useLanguage();

  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: translatedEngagements } = useTranslatedData(engagements, {
    modelName: "AuditEngagement",
  });
  const { data: translatedDepartments } = useTranslatedData(departments, {
    modelName: "Department",
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [engRes, deptRes] = await Promise.all([
          fetch("/api/internal-audit/engagements"),
          fetch("/api/departments"),
        ]);
        if (engRes.ok) {
          const data = await engRes.json();
          setEngagements(Array.isArray(data) ? data : data.engagements || []);
        }
        if (deptRes.ok) {
          const data = await deptRes.json();
          setDepartments(Array.isArray(data) ? data : []);
        }
      } catch {
        toast.error(t("Failed to load engagements"));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = translatedEngagements.filter((e) => {
    const matchSearch =
      !search.trim() ||
      e.auditId?.toLowerCase().includes(search.toLowerCase()) ||
      e.engagementTitle?.toLowerCase().includes(search.toLowerCase());
    const matchDept = departmentFilter === "all" || e.department?.id === departmentFilter;
    const matchStatus = statusFilter === "all" || e.status === statusFilter;
    return matchSearch && matchDept && matchStatus;
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Internal Audit")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Follow-up")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
          <ListChecks className="h-6 w-6 text-slate-700" />
          {t("Follow-up")}
        </h1>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 px-3 sm:px-5 py-3 border-b border-slate-100">
          <div className="relative w-full sm:w-[320px]">
            <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={t("Search engagements...")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
            />
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto sm:ltr:ml-auto sm:rtl:mr-auto">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[150px] h-9 text-sm bg-slate-50 border-slate-200">
                <SelectValue placeholder={t("Status")} />
              </SelectTrigger>
              <SelectContent className="bg-white" position="popper" sideOffset={4}>
                <SelectItem value="all">{t("All Statuses")}</SelectItem>
                <SelectItem value="Pending">{t("Pending")}</SelectItem>
                <SelectItem value="In Progress">{t("In Progress")}</SelectItem>
                <SelectItem value="Completed">{t("Completed")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm bg-slate-50 border-slate-200">
                <SelectValue placeholder={t("Department")} />
              </SelectTrigger>
              <SelectContent className="bg-white" position="popper" sideOffset={4}>
                <SelectItem value="all">{t("All Departments")}</SelectItem>
                {translatedDepartments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap ltr:pl-5 rtl:pr-5 min-w-[100px]">{t("Audit ID")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap min-w-[220px]">{t("Engagement")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap min-w-[130px]">{t("Department")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap min-w-[120px]">{t("Auditor")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap min-w-[100px]">{t("Status")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap ltr:pr-5 rtl:pl-5 min-w-[90px] ltr:text-right rtl:text-left">{t("Action")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center">
                    <Loader2 className="h-6 w-6 animate-spin inline text-slate-400" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-sm text-slate-400">
                    {t("No engagements found.")}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((e) => (
                  <TableRow key={e.id} className="border-b border-slate-100 last:border-0">
                    <TableCell className="py-3 text-sm font-medium text-slate-800 ltr:pl-5 rtl:pr-5 whitespace-nowrap">
                      {e.auditId}
                    </TableCell>
                    <TableCell className="py-3 text-sm text-slate-700 max-w-[280px] truncate">
                      {e.engagementTitle}
                    </TableCell>
                    <TableCell className="py-3 text-sm text-slate-700 whitespace-nowrap">
                      {e.department?.name || "-"}
                    </TableCell>
                    <TableCell className="py-3 text-sm text-slate-700 whitespace-nowrap">
                      {e.assignedAuditors && e.assignedAuditors.length > 0
                        ? e.assignedAuditors.join(", ")
                        : "-"}
                    </TableCell>
                    <TableCell className="py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge(e.status)}`}>
                        {t(e.status)}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 ltr:pr-5 rtl:pl-5 whitespace-nowrap ltr:text-right rtl:text-left">
                      <Link href={`/internal-audit/follow-up/${e.id}`}>
                        <Button variant="outline" size="sm">
                          {t("Open")}
                          <ArrowRight className="h-4 w-4 ltr:ml-1.5 rtl:mr-1.5 ltr:rotate-0 rtl:rotate-180" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
