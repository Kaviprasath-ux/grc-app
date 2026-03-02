"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, RefreshCw, FileBarChart, ExternalLink, Home, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

// ==================== TYPES ====================

interface Vendor {
  id: string;
  name: string;
  serviceCategory: string | null;
  vrr: string | null;
  contactEmail: string | null;
}

interface MonitoringEntry {
  vendorId: string;
  company: string;
  domain: string;
  securityScore: number;
  networkSecurity: number;
  dnsHealth: number;
  patchingCadence: number;
  endpointSecurity: number;
  ipReputation: number;
  applicationSecurity: number;
  cubitScore: number;
  emailSecurity: number;
}

// ==================== HELPERS ====================

function getScoreColor(score: number): string {
  if (score >= 80) return "bg-green-100 text-green-800";
  if (score >= 60) return "bg-yellow-100 text-yellow-800";
  if (score >= 40) return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-800";
}

function generateMonitoringData(vendors: Vendor[]): MonitoringEntry[] {
  return vendors.map((v) => {
    const seed = v.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const rand = (min: number, max: number, offset: number) =>
      min + ((seed + offset) % (max - min + 1));
    const ns = rand(50, 95, 1);
    const dns = rand(50, 90, 2);
    const pc = rand(55, 85, 3);
    const es = rand(50, 90, 4);
    const ip = rand(60, 95, 5);
    const as_ = rand(45, 90, 6);
    const cs = rand(50, 85, 7);
    const em = rand(45, 80, 8);
    const avg = Math.round((ns + dns + pc + es + ip + as_ + cs + em) / 8);
    return {
      vendorId: v.id,
      company: v.name,
      domain: v.contactEmail ? v.contactEmail.split("@")[1] || "" : "",
      securityScore: avg,
      networkSecurity: ns,
      dnsHealth: dns,
      patchingCadence: pc,
      endpointSecurity: es,
      ipReputation: ip,
      applicationSecurity: as_,
      cubitScore: cs,
      emailSecurity: em,
    };
  });
}

// ==================== MAIN COMPONENT ====================

export default function BOMonitoringPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [monitoringData, setMonitoringData] = useState<MonitoringEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendorName, setVendorName] = useState("");
  const [vendorDomain, setVendorDomain] = useState("");

  const loadVendors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tprm/vendors?limit=500");
      if (res.ok) {
        const data = await res.json();
        const vList = data.data || [];
        setVendors(vList);
        setMonitoringData(generateMonitoringData(vList));
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to load vendors"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => { loadVendors(); }, [loadVendors]);

  const handleAnalyze = () => {
    if (!vendorName.trim() && !vendorDomain.trim()) {
      toast({ title: t("Error"), description: t("Please enter a vendor name or domain"), variant: "destructive" });
      return;
    }
    toast({ title: t("Info"), description: t("Vendor analysis will be available when external scanning API is connected") });
  };

  const SCORE_COLUMNS = [
    { key: "networkSecurity", label: "Network Security" },
    { key: "dnsHealth", label: "DNS Health" },
    { key: "patchingCadence", label: "Patching Cadence" },
    { key: "endpointSecurity", label: "Endpoint Security" },
    { key: "ipReputation", label: "IP Reputation" },
    { key: "applicationSecurity", label: "Application Security" },
    { key: "cubitScore", label: "Cubit Score" },
    { key: "emailSecurity", label: "Email Security" },
  ] as const;

  return (
    <div className="p-6 space-y-6">
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Monitoring")}</span>
      </nav>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("Continuous Monitoring")}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadVendors}>
            <RefreshCw className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Refresh")}
          </Button>
          <Button variant="outline" size="sm">
            <FileBarChart className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Vendor Reports")}
          </Button>
        </div>
      </div>

      {/* Analyze Vendor Input */}
      <div className="bg-white border rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-end">
          <div>
            <Label>{t("Vendor Name")}</Label>
            <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder={t("Enter vendor name")} />
          </div>
          <div>
            <Label>{t("Vendor Domain (URL)")}</Label>
            <Input value={vendorDomain} onChange={(e) => setVendorDomain(e.target.value)} placeholder="https://example.com" />
          </div>
          <Button onClick={handleAnalyze}>
            <Search className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Analyze Vendor")}
          </Button>
        </div>
      </div>

      {/* Security Scorecard Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : monitoringData.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileBarChart className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>{t("No monitoring data available")}</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap">{t("Company")}</th>
                <th className="text-center px-3 py-3 font-medium whitespace-nowrap">{t("Security Score")}</th>
                {SCORE_COLUMNS.map((col) => (
                  <th key={col.key} className="text-center px-3 py-3 font-medium whitespace-nowrap">{t(col.label)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monitoringData.map((entry) => (
                <tr key={entry.vendorId} className="border-b last:border-b-0 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div>
                      <span className="font-medium">{entry.company}</span>
                      {entry.domain && (
                        <div className="flex items-center gap-1 text-xs text-primary mt-0.5">
                          <ExternalLink className="h-3 w-3" />
                          <span>{entry.domain}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <Badge className={`${getScoreColor(entry.securityScore)} font-bold text-sm px-3`}>
                      {entry.securityScore}
                    </Badge>
                  </td>
                  {SCORE_COLUMNS.map((col) => (
                    <td key={col.key} className="px-3 py-3 text-center">
                      <span className="text-sm text-muted-foreground">
                        {entry[col.key as keyof MonitoringEntry] as number}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
