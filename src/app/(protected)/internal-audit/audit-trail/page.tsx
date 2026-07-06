"use client";

import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import {
  Activity,
  Home,
  ChevronRight,
  Search,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  Loader2,
  X,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface TrailRow {
  id: string;
  userName: string;
  userRole: string | null;
  action: string;
  module: string;
  recordId: string | null;
  createdAt: string;
}

interface Facets {
  modules: string[];
  roles: string[];
  actions: string[];
  users: string[];
}

const ALL = "__all__";

const actionColor = (action: string): string => {
  switch (action.toLowerCase()) {
    case "create":
      return "bg-green-100 text-green-700";
    case "update":
      return "bg-blue-100 text-blue-700";
    case "delete":
    case "reject":
      return "bg-red-100 text-red-700";
    case "approve":
      return "bg-emerald-100 text-emerald-700";
    case "submit":
      return "bg-amber-100 text-amber-700";
    case "login":
      return "bg-slate-100 text-slate-700";
    case "logout":
      return "bg-slate-100 text-slate-500";
    case "export":
      return "bg-purple-100 text-purple-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
};

const emptyFilters = {
  q: "",
  userName: ALL,
  userRole: ALL,
  action: ALL,
  module: ALL,
  from: "",
  to: "",
};

export default function AuditTrailPage() {
  const { t } = useLanguage();

  const [rows, setRows] = useState<TrailRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [scope, setScope] = useState<"all" | "own">("own");
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState(emptyFilters);
  const [search, setSearch] = useState(""); // debounced into filters.q
  const [facets, setFacets] = useState<Facets>({ modules: [], roles: [], actions: [], users: [] });

  const isAdmin = scope === "all";

  // Debounce the free-text search box into the active filter.
  useEffect(() => {
    const tmr = setTimeout(() => {
      setFilters((f) => (f.q === search ? f : { ...f, q: search }));
      setPage(1);
    }, 350);
    return () => clearTimeout(tmr);
  }, [search]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      params.set("sortBy", sortBy);
      params.set("sortDir", sortDir);
      if (filters.q) params.set("q", filters.q);
      if (filters.userName !== ALL) params.set("userName", filters.userName);
      if (filters.userRole !== ALL) params.set("userRole", filters.userRole);
      if (filters.action !== ALL) params.set("action", filters.action);
      if (filters.module !== ALL) params.set("module", filters.module);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);

      const res = await fetch(`/api/internal-audit/audit-trail?${params.toString()}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setRows(data.rows || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setScope(data.scope || "own");
    } catch {
      setRows([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, sortBy, sortDir, filters]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  // Load filter facets once (admin only).
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/internal-audit/audit-trail?facets=1");
        if (res.ok) setFacets(await res.json());
      } catch {
        /* non-fatal */
      }
    })();
  }, []);

  const toggleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
    setPage(1);
  };

  const setFilter = (key: keyof typeof filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setSearch("");
    setPage(1);
  };

  const hasActiveFilters =
    filters.userName !== ALL ||
    filters.userRole !== ALL ||
    filters.action !== ALL ||
    filters.module !== ALL ||
    !!filters.from ||
    !!filters.to ||
    !!filters.q;

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const th = "text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap select-none";
  const SortHead = ({ col, label }: { col: string; label: string }) => (
    <TableHead className={`${th} cursor-pointer hover:text-slate-700`} onClick={() => toggleSort(col)}>
      <span className="inline-flex items-center gap-1">
        {t(label)}
        {sortBy === col &&
          (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </span>
    </TableHead>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Internal Audit")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Audit Trail")}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Activity className="h-6 w-6 text-slate-700" />
            {t("Audit Trail")}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isAdmin
              ? t("Read-only log of all user activity across your organization.")
              : t("Read-only log of your activity across the platform.")}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Label className="text-xs text-muted-foreground">{t("Search")}</Label>
            <Search className="absolute ltr:left-2.5 rtl:right-2.5 top-[34px] h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("Search by user, module, action, record…")}
              className="ltr:pl-8 rtl:pr-8"
            />
          </div>

          {isAdmin && (
            <>
              <div className="min-w-[150px]">
                <Label className="text-xs text-muted-foreground">{t("User Name")}</Label>
                <Select value={filters.userName} onValueChange={(v) => setFilter("userName", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>{t("All Users")}</SelectItem>
                    {facets.users.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[140px]">
                <Label className="text-xs text-muted-foreground">{t("User Role")}</Label>
                <Select value={filters.userRole} onValueChange={(v) => setFilter("userRole", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>{t("All Roles")}</SelectItem>
                    {facets.roles.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="min-w-[130px]">
            <Label className="text-xs text-muted-foreground">{t("Action Type")}</Label>
            <Select value={filters.action} onValueChange={(v) => setFilter("action", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("All Actions")}</SelectItem>
                {facets.actions.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[150px]">
            <Label className="text-xs text-muted-foreground">{t("Module Name")}</Label>
            <Select value={filters.module} onValueChange={(v) => setFilter("module", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("All Modules")}</SelectItem>
                {facets.modules.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t("From Date")}</Label>
            <Input type="date" value={filters.from} onChange={(e) => setFilter("from", e.target.value)} className="w-[150px]" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t("To Date")}</Label>
            <Input type="date" value={filters.to} onChange={(e) => setFilter("to", e.target.value)} className="w-[150px]" />
          </div>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
              {t("Clear")}
            </Button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-[820px]">
            <TableHeader>
              <TableRow className="border-b border-slate-100 bg-slate-50/60 hover:bg-slate-50/60">
                <TableHead className={`${th} w-12 ltr:pl-5 rtl:pr-5`}>#</TableHead>
                <SortHead col="userName" label="User Name" />
                <SortHead col="userRole" label="User Role" />
                <SortHead col="action" label="Action" />
                <SortHead col="module" label="Module/Entity" />
                <SortHead col="createdAt" label="Date & Time" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center">
                    <Loader2 className="h-6 w-6 animate-spin inline text-slate-400" />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-sm text-slate-400">
                    {t("No audit records found.")}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r, idx) => (
                  <TableRow key={r.id} className="border-b border-slate-100 last:border-0">
                    <TableCell className="py-3 text-sm text-slate-500 ltr:pl-5 rtl:pr-5">
                      {(page - 1) * pageSize + idx + 1}
                    </TableCell>
                    <TableCell className="py-3 text-sm font-medium text-slate-800 whitespace-nowrap">{r.userName}</TableCell>
                    <TableCell className="py-3 text-sm text-slate-600 whitespace-nowrap">{r.userRole ? t(r.userRole) : "—"}</TableCell>
                    <TableCell className="py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${actionColor(r.action)}`}>
                        {t(r.action)}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-sm text-slate-700 whitespace-nowrap">{t(r.module)}</TableCell>
                    <TableCell className="py-3 text-sm text-slate-600 whitespace-nowrap">{fmt(r.createdAt)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50/40">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>
              {total === 0
                ? t("No records")
                : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} ${t("of")} ${total}`}
            </span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-7 w-[110px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} / {t("page")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4 ltr:rotate-0 rtl:rotate-180" />
              {t("Previous")}
            </Button>
            <span className="text-xs text-slate-500">
              {t("Page")} {page} {t("of")} {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              {t("Next")}
              <ChevronRight className="h-4 w-4 ltr:rotate-0 rtl:rotate-180" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
