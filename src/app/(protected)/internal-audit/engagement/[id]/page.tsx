"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Home,
  ChevronRight,
  ArrowRight,
  Check,
  CircleDot,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/usePermissions";
import { useLanguage } from "@/contexts/LanguageContext";
import MeetingMinutes from "@/components/internal-audit/MeetingMinutes";
import FindingsDiscussionMeeting from "@/components/internal-audit/FindingsDiscussionMeeting";
import ClosingMeeting from "@/components/internal-audit/ClosingMeeting";
import AuditPlanningMemorandum from "@/components/internal-audit/AuditPlanningMemorandum";
import AuditAnnouncement from "@/components/internal-audit/AuditAnnouncement";
import FindingsCommunication from "@/components/internal-audit/FindingsCommunication";
import {
  ENGAGEMENT_STAGES,
  DEFAULT_ENGAGEMENT_STAGE,
  nextStageKey,
  stageIndex,
  type StageProgressMap,
} from "@/lib/audit-engagement-stages";

interface Engagement {
  id: string;
  auditId: string;
  engagementTitle: string | null;
  status: string;
  department?: { id: string; name: string } | null;
  currentStage: string;
  stageProgress: StageProgressMap | null;
}

export default function EngagementWorkflowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useLanguage();
  const { canEdit } = usePermissions("audit.fieldwork");

  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedStage, setSelectedStage] = useState<string>(DEFAULT_ENGAGEMENT_STAGE);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/internal-audit/engagements/${id}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setEngagement(data);
      setSelectedStage(data.currentStage || DEFAULT_ENGAGEMENT_STAGE);
    } catch {
      toast.error(t("Failed to load engagement"));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  const progress: StageProgressMap = engagement?.stageProgress || {};

  const stageStatus = (key: string): "completed" | "current" | "pending" => {
    if (progress[key] === "completed") return "completed";
    if (key === engagement?.currentStage) return "current";
    return "pending";
  };

  const completedCount = ENGAGEMENT_STAGES.filter(
    (s) => progress[s.key] === "completed"
  ).length;

  const patchStages = async (body: {
    currentStage?: string;
    stageProgress?: StageProgressMap;
  }) => {
    if (!engagement) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/internal-audit/engagements/${engagement.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      await load();
    } catch {
      toast.error(t("Failed to update workflow"));
    } finally {
      setSaving(false);
    }
  };

  const markCompleteAndAdvance = async (key: string) => {
    const newProgress: StageProgressMap = { ...progress, [key]: "completed" };
    const next = nextStageKey(key);
    await patchStages({
      stageProgress: newProgress,
      currentStage: next || key,
    });
    if (next) setSelectedStage(next);
    toast.success(t("Step marked complete"));
  };

  const setAsCurrent = async (key: string) => {
    await patchStages({ currentStage: key });
    toast.success(t("Current step updated"));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin ltr:mr-2 rtl:ml-2" />
        {t("Loading")}...
      </div>
    );
  }

  if (!engagement) {
    return (
      <div className="py-24 text-center text-slate-500">
        {t("Engagement not found")}
      </div>
    );
  }

  const stage = ENGAGEMENT_STAGES.find((s) => s.key === selectedStage) || ENGAGEMENT_STAGES[0];
  const selectedStatus = stageStatus(stage.key);

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-slate-500">
        <Home className="h-4 w-4" />
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/internal-audit/audit-planning" className="hover:text-slate-700">
          {t("Audit Planning")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-slate-700 font-medium">{engagement.auditId}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {engagement.engagementTitle || engagement.auditId}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {engagement.auditId}
            {engagement.department?.name ? ` · ${engagement.department.name}` : ""}
            {` · ${t(engagement.status)}`}
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {completedCount}/{ENGAGEMENT_STAGES.length} {t("steps complete")}
        </Badge>
      </div>

      {/* Stepper */}
      <div className="flex flex-wrap gap-2">
        {ENGAGEMENT_STAGES.map((s, idx) => {
          const st = stageStatus(s.key);
          const isSelected = s.key === selectedStage;
          return (
            <button
              key={s.key}
              onClick={() => setSelectedStage(s.key)}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                isSelected
                  ? "border-slate-800 bg-slate-800 text-white"
                  : st === "completed"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : st === "current"
                  ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
                  isSelected ? "bg-white/20" : "bg-black/5"
                }`}
              >
                {st === "completed" ? (
                  <Check className="h-3 w-3" />
                ) : st === "current" ? (
                  <CircleDot className="h-3 w-3" />
                ) : (
                  idx + 1
                )}
              </span>
              {t(s.label)}
            </button>
          );
        })}
      </div>

      {/* Selected stage panel */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {t("Step")} {stageIndex(stage.key) + 1}
          </span>
          {selectedStatus === "completed" && (
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              {t("Completed")}
            </Badge>
          )}
          {selectedStatus === "current" && (
            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
              {t("Current")}
            </Badge>
          )}
        </div>
        <h2 className="text-lg font-semibold text-slate-900">{t(stage.label)}</h2>
        <p className="text-sm text-slate-600 mt-1 max-w-2xl">{t(stage.description)}</p>

        {stage.kind === "meeting" && stage.meetingType && (
          <div className="mt-5">
            {stage.meetingType === "discussion" ? (
              // Findings Discussion uses the structured Preliminary Observations
              // Discussion Meeting form (header + attendees + notes + agreed actions).
              <FindingsDiscussionMeeting engagementId={engagement.id} canEdit={canEdit} />
            ) : stage.meetingType === "closing" ? (
              // Closing Meeting uses the download-template / upload-minutes flow.
              <ClosingMeeting engagementId={engagement.id} canEdit={canEdit} />
            ) : (
              <MeetingMinutes
                engagementId={engagement.id}
                meetingType={stage.meetingType}
                canEdit={canEdit}
              />
            )}
          </div>
        )}

        {stage.kind === "apm" && (
          <div className="mt-5">
            <AuditPlanningMemorandum engagementId={engagement.id} canEdit={canEdit} />
          </div>
        )}

        {stage.kind === "announcement" && (
          <div className="mt-5">
            <AuditAnnouncement engagementId={engagement.id} canEdit={canEdit} />
          </div>
        )}

        {stage.kind === "findings" && (
          <div className="mt-5">
            <FindingsCommunication engagementId={engagement.id} canEdit={canEdit} />
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {stage.kind === "reuse" && stage.href ? (
            <Link href={stage.href(engagement.id)}>
              <Button variant="default" className="gap-2">
                <ExternalLink className="h-4 w-4" />
                {t("Open")} {t(stage.label)}
              </Button>
            </Link>
          ) : stage.kind === "stub" ? (
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              {t("This step will be available in a future update.")}
            </div>
          ) : null}

          {canEdit && (
            <>
              {selectedStatus !== "current" && (
                <Button
                  variant="outline"
                  disabled={saving}
                  onClick={() => setAsCurrent(stage.key)}
                >
                  {t("Set as current step")}
                </Button>
              )}
              {selectedStatus !== "completed" && (
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={saving}
                  onClick={() => markCompleteAndAdvance(stage.key)}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  {t("Mark complete & continue")}
                </Button>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
