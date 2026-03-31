"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Brain,
  Check,
  X,
  Loader2,
  Link as LinkIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ControlMapping {
  id: string;
  suggestedByAI: boolean;
  confirmedByUser: boolean;
  confidenceScore: number | null;
  control: {
    id: string;
    controlCode: string;
    name: string;
    framework?: { id: string; name: string } | null;
  };
  framework?: { id: string; name: string } | null;
}

interface ControlMappingPanelProps {
  collectionId: string;
  canEdit: boolean;
}

export function ControlMappingPanel({
  collectionId,
  canEdit,
}: ControlMappingPanelProps) {
  const { t } = useLanguage();
  const [mappings, setMappings] = useState<ControlMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggesting, setSuggesting] = useState(false);

  const fetchMappings = async () => {
    try {
      const res = await fetch(
        `/api/technical-evidence/${collectionId}/control-mappings`
      );
      const json = await res.json();
      if (res.ok) {
        setMappings(json.data || []);
      }
    } catch (err) {
      console.error("Error fetching mappings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMappings();
  }, [collectionId]);

  const handleAiSuggest = async () => {
    setSuggesting(true);
    try {
      const res = await fetch(
        `/api/technical-evidence/${collectionId}/ai-suggest`,
        { method: "POST" }
      );
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || t("AI suggestion failed"));
        return;
      }
      toast.success(json.message || t("AI suggestions generated"));
      fetchMappings();
    } catch {
      toast.error(t("AI suggestion failed"));
    } finally {
      setSuggesting(false);
    }
  };

  const handleConfirm = async (mappingId: string) => {
    try {
      const res = await fetch(
        `/api/technical-evidence/${collectionId}/control-mappings`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mappingId, confirmed: true }),
        }
      );
      if (res.ok) {
        setMappings((prev) =>
          prev.map((m) =>
            m.id === mappingId ? { ...m, confirmedByUser: true } : m
          )
        );
        toast.success(t("Mapping confirmed"));
      }
    } catch {
      toast.error(t("Failed to confirm mapping"));
    }
  };

  const handleReject = async (mappingId: string) => {
    try {
      const res = await fetch(
        `/api/technical-evidence/${collectionId}/control-mappings`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mappingId, confirmed: false }),
        }
      );
      if (res.ok) {
        setMappings((prev) => prev.filter((m) => m.id !== mappingId));
        toast.success(t("Mapping rejected"));
      }
    } catch {
      toast.error(t("Failed to reject mapping"));
    }
  };

  const confirmed = mappings.filter((m) => m.confirmedByUser);
  const pending = mappings.filter((m) => !m.confirmedByUser);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LinkIcon className="h-4 w-4 text-primary-600" />
          <h3 className="text-sm font-semibold text-slate-800">
            {t("Control Mappings")}
          </h3>
          <span className="text-xs text-slate-400">
            ({mappings.length})
          </span>
        </div>
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleAiSuggest}
            disabled={suggesting}
          >
            {suggesting ? (
              <Loader2 className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1 animate-spin" />
            ) : (
              <Brain className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" />
            )}
            {t("AI Suggest Controls")}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />
        </div>
      ) : mappings.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">
          {t("No control mappings yet. Use AI Suggest to auto-map controls.")}
        </p>
      ) : (
        <div className="space-y-3">
          {/* Pending AI suggestions */}
          {pending.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-amber-600">
                {t("Pending Confirmation")} ({pending.length})
              </p>
              {pending.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-2 p-2 rounded-lg bg-amber-50 border border-amber-100"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Brain className="h-3 w-3 text-amber-500 flex-shrink-0" />
                      <span className="text-xs font-medium text-slate-700 truncate">
                        {m.control.controlCode}: {m.control.name}
                      </span>
                    </div>
                    {m.control.framework && (
                      <span className="text-[10px] text-slate-400 ltr:ml-4.5 rtl:mr-4.5">
                        {m.control.framework.name}
                      </span>
                    )}
                    {m.confidenceScore !== null && (
                      <span className="text-[10px] text-amber-600 ltr:ml-2 rtl:mr-2">
                        {Math.round(m.confidenceScore * 100)}% {t("confidence")}
                      </span>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleConfirm(m.id)}
                        className="p-1 rounded hover:bg-green-100 text-green-600"
                        title={t("Confirm")}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleReject(m.id)}
                        className="p-1 rounded hover:bg-red-100 text-red-500"
                        title={t("Reject")}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Confirmed mappings */}
          {confirmed.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-green-600">
                {t("Confirmed")} ({confirmed.length})
              </p>
              {confirmed.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-green-50 border border-green-100"
                >
                  <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
                  <span className="text-xs font-medium text-slate-700 truncate">
                    {m.control.controlCode}: {m.control.name}
                  </span>
                  {m.control.framework && (
                    <span className="text-[10px] text-slate-400">
                      {m.control.framework.name}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
