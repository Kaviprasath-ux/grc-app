"use client";

/**
 * Internal Audit > Customer Accounts (superadmin view).
 *
 * Shown to GRCAdministrator. Lists every CustomerAccount with
 * isInternalAuditEnabled = true plus their primary CustomerAdministrator user,
 * active flag, and counts of audit engagements + findings.
 *
 * The "Edit" action links to the canonical superadmin customer-accounts
 * page (/grc/customer-accounts) where module toggles + admin details are
 * managed — keeping a single source of truth for customer edits.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, Home, ChevronRight, Search, Loader2, Pencil } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Unauthorized } from "@/components/ui/unauthorized";

interface AccountRow {
  id: string;
  customerCode: string;
  companyName: string;
  userId: string | null;
  fullName: string;
  email: string;
  active: string; // "Yes" | "No"
  engagementCount: number;
  findingCount: number;
}

export default function InternalAuditAccountOverviewPage() {
  const { t } = useLanguage();
  const { canView, isLoading: permLoading } = usePermissions("audit.account-overview");
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");

  // Debounce search input by 300ms so each keystroke doesn't refetch.
  useEffect(() => {
    const id = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (searchDebounced) qs.set("search", searchDebounced);
      const res = await fetch(`/api/internal-audit/account-overview?${qs.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setAccounts(json.data || []);
      } else {
        setAccounts([]);
      }
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [searchDebounced]);

  useEffect(() => {
    if (canView) fetchAccounts();
  }, [canView, fetchAccounts]);

  const total = useMemo(() => accounts.length, [accounts]);

  if (permLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!canView) {
    return <Unauthorized description={t("You don't have permission to view Internal Audit customer accounts.")} />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Internal Audit")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Customer Accounts")}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary-600" />
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
            {t("Customer Accounts")}
          </h1>
          <Badge variant="outline" className="ltr:ml-2 rtl:mr-2 text-xs">
            {total} {total === 1 ? t("customer") : t("customers")}
          </Badge>
        </div>
        <p className="text-sm text-slate-500 w-full sm:w-auto">
          {t("Customers with an active Internal Audit subscription.")}
        </p>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Search by company or code")}
            className="ltr:pl-9 rtl:pr-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("Customer Code")}</TableHead>
              <TableHead>{t("Company Name")}</TableHead>
              <TableHead>{t("Admin User")}</TableHead>
              <TableHead>{t("Email")}</TableHead>
              <TableHead className="text-center">{t("Active")}</TableHead>
              <TableHead className="text-center">{t("Engagements")}</TableHead>
              <TableHead className="text-center">{t("Findings")}</TableHead>
              <TableHead className="text-end">{t("Action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-primary-500 mx-auto" />
                </TableCell>
              </TableRow>
            ) : accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-slate-500">
                  {searchDebounced
                    ? t("No customers match your search.")
                    : t("No customers have an active Internal Audit subscription yet.")}
                </TableCell>
              </TableRow>
            ) : (
              accounts.map((a) => (
                <TableRow key={a.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium">{a.customerCode}</TableCell>
                  <TableCell>{a.companyName}</TableCell>
                  <TableCell>{a.fullName}</TableCell>
                  <TableCell className="text-slate-500">{a.email}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={a.active === "Yes" ? "default" : "secondary"}>
                      {a.active}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{a.engagementCount}</TableCell>
                  <TableCell className="text-center">{a.findingCount}</TableCell>
                  <TableCell className="text-end">
                    <Link href={`/grc/customer-accounts?focus=${a.id}`}>
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <Pencil className="h-3.5 w-3.5" />
                        {t("Edit")}
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
  );
}
