"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface EvidenceCollectionCardProps {
  collection: {
    id: string;
    displayName: string;
    description?: string | null;
    platform: string;
    dataSource: string;
    lastCollectedAt?: string | null;
    lastCollectionStatus: string;
    recordCount: number;
    lastError?: string | null;
    collectedBy?: { fullName: string } | null;
    _count?: { records: number; controlMappings: number };
    autoCreatedEvidence?: { id: string; evidenceCode: string; status: string } | null;
  };
  onCollected?: () => void;
}

export function EvidenceCollectionCard({
  collection,
  onCollected,
}: EvidenceCollectionCardProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const [collecting, setCollecting] = useState(false);

  const handleCollect = async () => {
    setCollecting(true);
    try {
      const res = await fetch(
        `/api/technical-evidence/${collection.id}/collect`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t("Collection failed"));
        return;
      }
      toast.success(
        `${t("Collected")} ${data.data.recordCount} ${t("records")}`
      );
      onCollected?.();
    } catch {
      toast.error(t("Collection failed"));
    } finally {
      setCollecting(false);
    }
  };

  const statusBadge = () => {
    if (collecting || collection.lastCollectionStatus === "collecting") {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t("Collecting...")}
        </span>
      );
    }
    switch (collection.lastCollectionStatus) {
      case "success":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-200">
            <CheckCircle2 className="h-3 w-3" />
            {collection.recordCount} {t("records")}
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
            <XCircle className="h-3 w-3" />
            {t("Collection failed")}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
            <Clock className="h-3 w-3" />
            {t("Never")}
          </span>
        );
    }
  };

  // Strip platform prefix from display name
  const shortName = collection.displayName.includes(": ")
    ? collection.displayName.split(": ").slice(1).join(": ")
    : collection.displayName;

  return (
    <div className="bg-white rounded-xl border border-slate-200 hover:border-primary-200 hover:shadow-sm transition-all p-4 sm:p-5 flex flex-col justify-between gap-3">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-semibold text-slate-800 leading-tight">
            {shortName}
          </h4>
          {statusBadge()}
        </div>
        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
          {collection.description}
        </p>
      </div>

      {/* Meta info */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <Clock className="h-3 w-3" />
          <span>
            {t("Last Collected")}:{" "}
            <span className="text-slate-500">
              {collection.lastCollectedAt
                ? new Date(collection.lastCollectedAt).toLocaleString()
                : t("Never")}
            </span>
          </span>
        </div>

        {collection.recordCount > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Database className="h-3 w-3" />
            <span>
              {t("Record Count")}:{" "}
              <span className="font-semibold text-slate-600">{collection.recordCount.toLocaleString()}</span>
            </span>
          </div>
        )}

        {collection.lastError && collection.lastCollectionStatus === "failed" && (
          <div className="text-[10px] text-red-600 bg-red-50 rounded-lg p-2 truncate border border-red-100">
            {collection.lastError}
          </div>
        )}
      </div>

      {/* Evidence Link */}
      {collection.autoCreatedEvidence && (
        <Link
          href={`/compliance/evidence`}
          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-lg px-2.5 py-1 hover:bg-primary-100 transition-colors"
        >
          <CheckCircle2 className="h-3 w-3" />
          {collection.autoCreatedEvidence.evidenceCode} — {t("Validated")}
        </Link>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
        {collection.recordCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8"
            onClick={() =>
              router.push(`/compliance/technical-evidence/${collection.id}`)
            }
          >
            <Eye className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />
            {t("View Data")}
          </Button>
        )}
        <Button
          variant={collection.lastCollectionStatus === "success" ? "outline" : "default"}
          size="sm"
          className="text-xs h-8"
          onClick={handleCollect}
          disabled={collecting}
        >
          {collecting ? (
            <Loader2 className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />
          )}
          {collection.lastCollectionStatus === "success"
            ? t("Recollect")
            : t("Collect")}
        </Button>
      </div>
    </div>
  );
}
