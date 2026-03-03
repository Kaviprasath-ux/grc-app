"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Home, ChevronRight, Loader2, Search, Eye } from "lucide-react";

// ── Types ──────────────────────────────────────────────
interface Vendor {
  id: string;
  vendorCode: string;
  name: string;
  contractStartDate: string | null;
  contractEndDate: string | null;
  serviceCategory: string | null;
  status: string;
  contactEmail: string | null;
  contactPhone: string | null;
  accountManagerName: string | null;
}

// ── Helpers ──────────────────────────────────────────────
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString();
}

function isExpiringSoon(dateStr: string | null, daysAhead = 90): boolean {
  if (!dateStr) return false;
  const end = new Date(dateStr);
  const now = new Date();
  const diff = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= daysAhead;
}

function isExpired(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

// ── Main Component ──────────────────────────────────────
export default function BOContractsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"expiring" | "all">("expiring");
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tprm/vendors?limit=500");
      if (res.ok) {
        const json = await res.json();
        setVendors(json.data || []);
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to load vendors"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  const filtered = useMemo(() => {
    let data = vendors;

    if (tab === "expiring") {
      data = data.filter((v) => isExpiringSoon(v.contractEndDate) || isExpired(v.contractEndDate));
    }

    if (search) {
      const s = search.toLowerCase();
      data = data.filter(
        (v) =>
          v.vendorCode.toLowerCase().includes(s) ||
          v.name.toLowerCase().includes(s)
      );
    }

    return data;
  }, [vendors, tab, search]);

  const tabs = [
    { key: "expiring" as const, label: t("Expiring Contracts") },
    { key: "all" as const, label: t("All Vendor Contracts") },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Contracts")}</span>
      </nav>
      <h1 className="text-2xl font-bold">{t("Contracts")}</h1>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map((t_) => (
          <button
            key={t_.key}
            onClick={() => { setTab(t_.key); setSearch(""); }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t_.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {t_.label}
          </button>
        ))}
      </div>

      {/* Search & Table */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("Filter") + "..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs font-medium text-slate-500 uppercase">{t("Vendor Code")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase">{t("Vendor Name")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase">{t("Contract Start")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase">{t("Expiring On")}</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 uppercase">{t("Action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {t("No contracts found")}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono text-sm">{v.vendorCode}</TableCell>
                      <TableCell>{v.name}</TableCell>
                      <TableCell>{formatDate(v.contractStartDate)}</TableCell>
                      <TableCell>
                        <span className={isExpired(v.contractEndDate) ? "text-red-600 font-medium" : isExpiringSoon(v.contractEndDate) ? "text-amber-600 font-medium" : ""}>
                          {formatDate(v.contractEndDate)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setSelectedVendor(v); setDialogOpen(true); }}
                        >
                          <Eye className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                          {t("View")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Contract Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Contract Details")} - {selectedVendor?.name}</DialogTitle>
          </DialogHeader>
          {selectedVendor && (
            <div className="grid grid-cols-2 gap-4 py-4">
              <div>
                <label className="text-sm text-muted-foreground">{t("Vendor Code")}</label>
                <p className="font-mono">{selectedVendor.vendorCode}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Vendor Name")}</label>
                <p>{selectedVendor.name}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Service Category")}</label>
                <p>{selectedVendor.serviceCategory || "-"}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Status")}</label>
                <p>{t(selectedVendor.status)}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Contract Start")}</label>
                <p>{formatDate(selectedVendor.contractStartDate)}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Contract End")}</label>
                <p className={isExpired(selectedVendor.contractEndDate) ? "text-red-600 font-medium" : ""}>
                  {formatDate(selectedVendor.contractEndDate)}
                </p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Contact Email")}</label>
                <p>{selectedVendor.contactEmail || "-"}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Account Manager")}</label>
                <p>{selectedVendor.accountManagerName || "-"}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
