"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Home, ChevronRight, Search, Plus, Minus, Info } from "lucide-react";
import { useTranslatedData } from "@/hooks/useTranslatedData";

interface Vendor {
  id: string;
  name: string;
  vendorCode: string;
  vendorRiskRating: string | null;
  status: string;
  serviceCategory: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}

function getRiskBadge(rating: string | null) {
  switch (rating) {
    case "High":
    case "Critical":
      return <Badge variant="destructive">{rating}</Badge>;
    case "Moderate":
    case "Medium":
      return <Badge variant="secondary">{rating}</Badge>;
    case "Low":
    case "Nominal":
      return <Badge variant="default">{rating}</Badge>;
    default:
      return <Badge variant="outline">{rating || "N/A"}</Badge>;
  }
}

export default function AsrInventoryPage() {
  const { t } = useLanguage();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedVendors, setExpandedVendors] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/tprm/vendors?limit=500");
      if (res.ok) {
        const json = await res.json();
        setVendors(json.data || []);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const { data: translatedVendors } = useTranslatedData(vendors, { modelName: 'TPRMVendor' });

  const filtered = useMemo(() => {
    if (!search) return translatedVendors;
    const q = search.toLowerCase();
    return translatedVendors.filter(
      (v) =>
        v.name?.toLowerCase().includes(q) ||
        v.vendorCode?.toLowerCase().includes(q) ||
        v.serviceCategory?.toLowerCase().includes(q)
    );
  }, [translatedVendors, search]);

  const toggleVendor = (id: string) => {
    setExpandedVendors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Vendor Inventory")}</span>
      </nav>

      <h1 className="text-2xl font-bold">{t("Vendor Inventory")}</h1>

      {/* Vendors section */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between p-4 border-b bg-sky-50">
          <h3 className="text-lg font-semibold text-primary">{t("Vendors")}</h3>
          <Info className="h-5 w-5 text-muted-foreground" />
        </div>

        <div className="p-4">
          {/* Search */}
          <div className="relative max-w-md mb-4">
            <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("Search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ltr:pl-9 rtl:pr-9"
            />
          </div>

          {/* Vendor list */}
          <div className="space-y-2">
            {filtered.map((vendor) => {
              const isExpanded = expandedVendors.has(vendor.id);
              return (
                <div key={vendor.id} className="border rounded-lg">
                  <button
                    onClick={() => toggleVendor(vendor.id)}
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                  >
                    <span className="font-medium">
                      {vendor.name}
                      {vendor.vendorRiskRating && (
                        <span className="text-muted-foreground ltr:ml-2 rtl:mr-2">
                          - {vendor.vendorRiskRating}
                        </span>
                      )}
                    </span>
                    {isExpanded ? (
                      <Minus className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="p-4 border-t bg-muted/20">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">{t("Vendor Code")}:</span>
                          <p className="font-medium">{vendor.vendorCode || "-"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t("Service Category")}:</span>
                          <p className="font-medium">{vendor.serviceCategory || "-"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t("Risk Rating")}:</span>
                          <p className="mt-1">{getRiskBadge(vendor.vendorRiskRating)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t("Status")}:</span>
                          <p className="font-medium">{vendor.status || "-"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t("Email")}:</span>
                          <p className="font-medium">{vendor.contactEmail || "-"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t("Phone")}:</span>
                          <p className="font-medium">{vendor.contactPhone || "-"}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {t("No vendors found")}
              </div>
            )}
          </div>

          {/* Pagination info */}
          <div className="mt-4 text-sm text-muted-foreground text-right">
            {t("Showing")} 1 {t("to")} {filtered.length} {t("of")} {filtered.length}
          </div>
        </div>
      </div>
    </div>
  );
}
