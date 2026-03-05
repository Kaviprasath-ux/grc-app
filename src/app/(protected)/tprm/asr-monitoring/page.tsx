"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Home, ChevronRight, RefreshCw } from "lucide-react";

interface MonitoringVendor {
  id: string;
  companyName: string;
  domainUrl: string | null;
  securityScore: number | null;
  networkSecurity: number | null;
  dnsHealth: number | null;
  patchingCadence: number | null;
  endpointSecurity: number | null;
  ipReputation: number | null;
  applicationSecurity: number | null;
  cubitScore: number | null;
  emailSecurity: number | null;
  sslTlsConfiguration: number | null;
  privacy: number | null;
  knownBreach: number | null;
  hackerChatter: number | null;
  informationLeak: number | null;
  socialEngineering: number | null;
}

interface ScanJob {
  jobId: string;
  vendorName: string;
  status: string;
}

function KpiCell({ score }: { score: number | null }) {
  if (score === null || score === undefined) return <td className="px-3 py-2 text-center text-muted-foreground">—</td>;
  const colorCls =
    score >= 80
      ? "bg-green-100 text-green-800"
      : score >= 65
      ? "bg-emerald-50 text-emerald-700"
      : score >= 50
      ? "bg-yellow-50 text-yellow-700"
      : "bg-red-50 text-red-700";
  return (
    <td className="px-3 py-2 text-center">
      <span className={`inline-block px-2 py-1 rounded text-sm font-medium ${colorCls}`}>{score}</span>
    </td>
  );
}

const KPI_COLUMNS = [
  "securityScore",
  "networkSecurity",
  "dnsHealth",
  "patchingCadence",
  "endpointSecurity",
  "ipReputation",
  "applicationSecurity",
  "cubitScore",
  "emailSecurity",
  "sslTlsConfiguration",
  "privacy",
  "knownBreach",
  "hackerChatter",
  "informationLeak",
  "socialEngineering",
] as const;

const KPI_LABELS: Record<string, string> = {
  securityScore: "Security Score",
  networkSecurity: "Network Security",
  dnsHealth: "DNS Health",
  patchingCadence: "Patching Cadence",
  endpointSecurity: "Endpoint Security",
  ipReputation: "IP Reputation",
  applicationSecurity: "Application Security",
  cubitScore: "Cubit Score",
  emailSecurity: "Email Security",
  sslTlsConfiguration: "SSL/TLS Configuration",
  privacy: "Privacy",
  knownBreach: "Known Breach",
  hackerChatter: "Hacker Chatter",
  informationLeak: "Information Leak",
  socialEngineering: "Social Engineering",
};

export default function AsrMonitoringPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [vendors, setVendors] = useState<MonitoringVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendorName, setVendorName] = useState("");
  const [vendorUrl, setVendorUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [search, setSearch] = useState("");
  const [activeScans, setActiveScans] = useState<ScanJob[]>([]);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/tprm/monitoring?limit=500");
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

  // Polling for active scans
  useEffect(() => {
    if (activeScans.length === 0) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }
    pollIntervalRef.current = setInterval(async () => {
      for (const scan of activeScans) {
        try {
          const res = await fetch(`/api/tprm/monitoring/scan?jobId=${scan.jobId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.status === "done") {
              setActiveScans((prev) => prev.filter((s) => s.jobId !== scan.jobId));
              fetchData();
              toast({ title: t("Scan Complete"), description: `${scan.vendorName} ${t("scan completed")}` });
            }
          }
        } catch {
          // ignore
        }
      }
    }, 60000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [activeScans.length, fetchData, t, toast, activeScans]);

  const handleAnalyze = async () => {
    if (!vendorName || !vendorUrl) {
      toast({ title: t("Error"), description: t("Please provide vendor name and URL"), variant: "destructive" });
      return;
    }
    try {
      setAnalyzing(true);
      const res = await fetch("/api/tprm/monitoring/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorName, vendorUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.jobId) {
          setActiveScans((prev) => [...prev, { jobId: data.jobId, vendorName, status: "queued" }]);
          toast({ title: t("Scan Queued"), description: `${vendorName} ${t("queued for analysis")}` });
        } else {
          fetchData();
          toast({ title: t("Success"), description: t("Vendor analyzed successfully") });
        }
        setVendorName("");
        setVendorUrl("");
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to analyze vendor"), variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const filtered = useMemo(() => {
    if (!search) return vendors;
    const q = search.toLowerCase();
    return vendors.filter(
      (v) =>
        v.companyName?.toLowerCase().includes(q) ||
        v.domainUrl?.toLowerCase().includes(q)
    );
  }, [vendors, search]);

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
        <span className="text-primary-700 font-medium">{t("Continuous Monitoring")}</span>
      </nav>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("Continuous Monitoring")}</h1>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
          {t("Refresh")}
        </Button>
      </div>

      {/* Analyze Vendor Form */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-1 block">{t("Vendor Name")}</label>
            <Input
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder={t("Vendor Name")}
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-1 block">{t("Vendor Domain (URL)")}</label>
            <Input
              value={vendorUrl}
              onChange={(e) => setVendorUrl(e.target.value)}
              placeholder={t("Vendor Domain (URL)")}
            />
          </div>
          <Button onClick={handleAnalyze} disabled={analyzing}>
            {analyzing && <Loader2 className="h-4 w-4 animate-spin ltr:mr-1 rtl:ml-1" />}
            {t("Analyze Vendor")}
          </Button>
        </div>
      </div>

      {/* KPI Table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-3 text-left font-medium">{t("Company")}</th>
              {KPI_COLUMNS.map((col) => (
                <th key={col} className="px-3 py-3 text-center font-medium whitespace-nowrap">
                  {t(KPI_LABELS[col])}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((vendor) => (
              <tr key={vendor.id} className="border-b hover:bg-muted/30">
                <td className="px-3 py-2">
                  <div className="font-medium">{vendor.companyName}</div>
                  {vendor.domainUrl && (
                    <div className="text-xs text-primary">{vendor.domainUrl}</div>
                  )}
                </td>
                {KPI_COLUMNS.map((col) => (
                  <KpiCell key={col} score={vendor[col] as number | null} />
                ))}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={KPI_COLUMNS.length + 1} className="px-3 py-8 text-center text-muted-foreground">
                  {t("No monitoring data available")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="p-2 text-sm text-muted-foreground text-right border-t">
          {t("Showing")} 1 {t("to")} {filtered.length} {t("of")} {filtered.length}
        </div>
      </div>

      {/* Queued Assessments */}
      {activeScans.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-lg font-semibold mb-3">{t("Queued Assessments")}</h3>
          <div className="space-y-2">
            {activeScans.map((scan) => (
              <div key={scan.jobId} className="flex items-center gap-3 p-2 bg-muted/50 rounded">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="font-medium">{scan.vendorName}</span>
                <span className="text-sm text-muted-foreground">{t("Analyzing")}...</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
