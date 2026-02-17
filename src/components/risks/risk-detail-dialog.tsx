"use client";

import { useState, useEffect, Fragment } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RiskRatingBadge } from "./risk-rating-badge";
import { RiskStatusBadge } from "./risk-status-badge";
import {
  X,
  Shield,
  AlertTriangle,
  Target,
  FileText,
  Clock,
  Link2,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Risk {
  id: string;
  riskId: string;
  name: string;
  description: string | null;
  riskSources: string | null;
  category: { id: string; name: string } | null;
  type: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  owner: { id: string; fullName: string; email: string } | null;
  impactedAsset?: { id: string; assetId: string; name: string } | null;
  impactedProcess?: { id: string; processCode: string; name: string } | null;
  likelihood: number;
  impact: number;
  riskScore: number;
  riskRating: string;
  status: string;
  responseStrategy: string | null;
  treatmentPlan?: string | null;
  treatmentDueDate?: string | null;
  treatmentStatus?: string | null;
  createdAt: string;
  updatedAt: string;
  threats?: Array<{ threat: { id: string; name: string } }>;
  vulnerabilities?: Array<{ vulnerability: { id: string; name: string } }>;
  causes?: Array<{ cause: { id: string; name: string } }>;
  controlRisks?: Array<{ control: { id: string; controlCode: string; name: string } }>;
  activityLogs?: Array<{
    id: string;
    activity: string;
    description: string | null;
    actor: string;
    createdAt: string;
  }>;
  assessments?: Array<{
    id: string;
    assessmentId: string;
    likelihood: number;
    impact: number;
    riskRating: string;
    assessmentDate: string;
    status: string;
  }>;
  responses?: Array<{
    id: string;
    responseId: string;
    responseType: string;
    actionTitle: string;
    status: string;
    dueDate: string | null;
  }>;
}

interface RiskDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  risk: Risk | null;
}

const likelihoodLabels = ["", "Rare", "Unlikely", "Possible", "Likely", "Almost Certain"];
const impactLabels = ["", "Insignificant", "Minor", "Moderate", "Major", "Catastrophic"];

const sections = [
  { id: "overview", label: "Overview", icon: FileText },
  { id: "context", label: "Context", icon: Target },
  { id: "assessment", label: "Assessment", icon: AlertTriangle },
  { id: "controls", label: "Controls", icon: Shield },
  { id: "response", label: "Response", icon: Link2 },
  { id: "activity", label: "Activity", icon: Clock },
];

export function RiskDetailDialog({
  open,
  onOpenChange,
  risk,
}: RiskDetailDialogProps) {
  const [activeSection, setActiveSection] = useState(0);
  const [activityLogs, setActivityLogs] = useState<Risk["activityLogs"]>([]);

  useEffect(() => {
    if (open && risk) {
      fetchActivityLogs(risk.riskId);
      setActiveSection(0);
    }
  }, [open, risk]);

  const fetchActivityLogs = async (riskId: string) => {
    try {
      const response = await fetch(`/api/risks/activity-log?riskId=${riskId}&limit=50`);
      if (response.ok) {
        const data = await response.json();
        setActivityLogs(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch activity logs:", error);
    }
  };

  if (!risk) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" showCloseButton={false}>
        {/* Fixed Header */}
        <div className="flex-shrink-0 px-4 sm:px-6 pt-5 pb-0">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg font-semibold text-slate-800 truncate pe-2">
                  {risk.riskId} - {risk.name}
                </DialogTitle>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600 flex-shrink-0" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              <RiskRatingBadge rating={risk.riskRating} />
              <RiskStatusBadge status={risk.status} />
            </div>
          </DialogHeader>
        </div>

        {/* Tab Navigation */}
        <div className="flex-shrink-0 px-4 sm:px-6 border-b border-slate-200">
          <div className="flex items-center gap-1 overflow-x-auto -mb-px">
            {sections.map((section, index) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(index)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap border-b-2",
                    activeSection === index
                      ? "text-primary-600 border-primary-600"
                      : "text-slate-400 border-transparent hover:text-slate-600"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {section.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
          {/* Risk Overview Section */}
          {activeSection === 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Risk ID</p>
                  <p className="font-semibold text-slate-800 mt-1">{risk.riskId}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Status</p>
                  <RiskStatusBadge status={risk.status} className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Risk Rating</p>
                  <RiskRatingBadge rating={risk.riskRating} className="mt-1" />
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Risk Score</p>
                  <p className="font-bold text-lg text-slate-800 mt-0.5">{risk.riskScore}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Department</p>
                  <p className="font-medium text-slate-800 mt-1">{risk.department?.name || "-"}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Risk Owner</p>
                  <p className="font-medium text-slate-800 mt-1">{risk.owner?.fullName || "-"}</p>
                  {risk.owner?.email && (
                    <p className="text-xs text-slate-500">{risk.owner.email}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Created</p>
                  <p className="font-medium text-slate-800 mt-1">
                    {new Date(risk.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Last Updated</p>
                  <p className="font-medium text-slate-800 mt-1">
                    {new Date(risk.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Risk Context Section */}
          {activeSection === 1 && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Description</p>
                <p className="text-sm text-slate-700">{risk.description || "No description provided"}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Risk Sources</p>
                <p className="text-sm text-slate-700">{risk.riskSources || "No sources specified"}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Category</p>
                  <p className="font-medium text-slate-800 mt-1">{risk.category?.name || "-"}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Risk Type</p>
                  <p className="font-medium text-slate-800 mt-1">{risk.type?.name || "-"}</p>
                </div>
              </div>

              {risk.impactedAsset && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Impacted Asset</p>
                  <p className="font-medium text-slate-800 mt-1">{risk.impactedAsset.assetId} - {risk.impactedAsset.name}</p>
                </div>
              )}
              {risk.impactedProcess && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Impacted Process</p>
                  <p className="font-medium text-slate-800 mt-1">{risk.impactedProcess.processCode} - {risk.impactedProcess.name}</p>
                </div>
              )}

              {/* Threats */}
              {risk.threats && risk.threats.length > 0 && (
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Threats</p>
                  <div className="flex flex-wrap gap-2">
                    {risk.threats.map((t) => (
                      <span
                        key={t.threat.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 text-xs rounded-full border border-slate-200"
                      >
                        <Zap className="h-3 w-3" />
                        {t.threat.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Vulnerabilities */}
              {risk.vulnerabilities && risk.vulnerabilities.length > 0 && (
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Vulnerabilities</p>
                  <div className="flex flex-wrap gap-2">
                    {risk.vulnerabilities.map((v) => (
                      <span
                        key={v.vulnerability.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 text-xs rounded-full border border-slate-200"
                      >
                        <Shield className="h-3 w-3" />
                        {v.vulnerability.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Causes */}
              {risk.causes && risk.causes.length > 0 && (
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Causes</p>
                  <div className="flex flex-wrap gap-2">
                    {risk.causes.map((c) => (
                      <span
                        key={c.cause.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 text-xs rounded-full border border-slate-200"
                      >
                        <AlertTriangle className="h-3 w-3" />
                        {c.cause.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Risk Assessment Section */}
          {activeSection === 2 && (
            <div className="space-y-4">
              {/* Likelihood / Impact / Score */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 text-center">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Likelihood</p>
                  <p className="text-3xl font-bold text-slate-800 mt-1">{risk.likelihood}</p>
                  <p className="text-sm text-slate-600">{likelihoodLabels[risk.likelihood]}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 text-center">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Impact</p>
                  <p className="text-3xl font-bold text-slate-800 mt-1">{risk.impact}</p>
                  <p className="text-sm text-slate-600">{impactLabels[risk.impact]}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 text-center">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Risk Score</p>
                  <p className="text-3xl font-bold text-slate-800 mt-1">{risk.riskScore}</p>
                  <RiskRatingBadge rating={risk.riskRating} className="mt-1" />
                </div>
              </div>

              {/* Risk Matrix Grid */}
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-sm font-medium text-slate-700 mb-3">Risk Matrix</p>
                <div className="grid grid-cols-6 gap-1 text-xs">
                  <div className="p-2"></div>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="p-2 text-center font-medium text-slate-600">
                      {i}
                    </div>
                  ))}
                  {[5, 4, 3, 2, 1].map((likelihood) => (
                    <Fragment key={`row-${likelihood}`}>
                      <div className="p-2 text-center font-medium text-slate-600">
                        {likelihood}
                      </div>
                      {[1, 2, 3, 4, 5].map((impact) => {
                        const score = likelihood * impact;
                        const isCurrentCell =
                          likelihood === risk.likelihood && impact === risk.impact;
                        let bgColor = "bg-green-200";
                        if (score >= 20) bgColor = "bg-red-400";
                        else if (score >= 15) bgColor = "bg-orange-400";
                        else if (score >= 10) bgColor = "bg-yellow-300";
                        else if (score >= 5) bgColor = "bg-green-300";

                        return (
                          <div
                            key={`${likelihood}-${impact}`}
                            className={cn(
                              "p-2 text-center rounded",
                              bgColor,
                              isCurrentCell && "ring-2 ring-black ring-offset-1 font-bold"
                            )}
                          >
                            {score}
                          </div>
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-slate-400 mt-2">
                  <span>Likelihood</span>
                  <span>Impact</span>
                </div>
              </div>

              {/* Assessment History */}
              {risk.assessments && risk.assessments.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-3">Assessment History</p>
                  <div className="space-y-2">
                    {risk.assessments.map((assessment) => (
                      <div
                        key={assessment.id}
                        className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100"
                      >
                        <span className="text-sm font-medium text-slate-800">{assessment.assessmentId}</span>
                        <span className="text-sm text-slate-500">
                          {new Date(assessment.assessmentDate).toLocaleDateString()}
                        </span>
                        <RiskRatingBadge rating={assessment.riskRating} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Controls Section */}
          {activeSection === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                Controls linked to this risk ({risk.controlRisks?.length || 0})
              </p>
              {risk.controlRisks && risk.controlRisks.length > 0 ? (
                <div className="space-y-2">
                  {risk.controlRisks.map((cr) => (
                    <div
                      key={cr.control.id}
                      className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                        <Shield className="h-4 w-4 text-primary-600" />
                      </div>
                      <div>
                        <span className="font-medium text-primary-600">{cr.control.controlCode}</span>
                        <span className="text-sm text-slate-600 ms-2">{cr.control.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg p-8 text-center">
                  <Shield className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-medium text-slate-600">No controls linked</p>
                  <p className="text-xs text-slate-400 mt-1">Use Edit to associate controls with this risk</p>
                </div>
              )}
            </div>
          )}

          {/* Risk Response Section */}
          {activeSection === 4 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Response Strategy</p>
                  <p className="font-semibold text-slate-800 mt-1">
                    {risk.responseStrategy || "Not defined"}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Treatment Due Date</p>
                  <p className="font-semibold text-slate-800 mt-1">
                    {risk.treatmentDueDate
                      ? new Date(risk.treatmentDueDate).toLocaleDateString()
                      : "Not set"}
                  </p>
                </div>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Treatment Plan</p>
                <p className="text-sm text-slate-700">
                  {risk.treatmentPlan || "No treatment plan defined"}
                </p>
              </div>
              {risk.treatmentStatus && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Treatment Status</p>
                  <p className="font-medium text-slate-800 mt-1">{risk.treatmentStatus}</p>
                </div>
              )}

              {/* Response Actions */}
              {risk.responses && risk.responses.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-3">Response Actions</p>
                  <div className="space-y-2">
                    {risk.responses.map((response) => (
                      <div
                        key={response.id}
                        className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100"
                      >
                        <div>
                          <span className="font-medium text-slate-800">{response.actionTitle}</span>
                          <span className="text-xs text-slate-500 ms-2">
                            ({response.responseType})
                          </span>
                        </div>
                        <span
                          className={cn(
                            "text-xs px-2.5 py-1 rounded-full font-medium",
                            response.status === "Completed"
                              ? "bg-green-100 text-green-800"
                              : response.status === "In Progress"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-slate-100 text-slate-700"
                          )}
                        >
                          {response.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Activity Log Section */}
          {activeSection === 5 && (
            <div className="space-y-4">
              {activityLogs && activityLogs.length > 0 ? (
                <div className="space-y-2">
                  {activityLogs.map((log) => (
                    <div key={log.id} className="flex gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="w-2 h-2 mt-2 rounded-full bg-primary-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className="font-medium text-slate-800">{log.activity}</span>
                            <span className="text-sm text-slate-500 ms-2">
                              by {log.actor}
                            </span>
                          </div>
                          <span className="text-xs text-slate-400 flex-shrink-0">
                            {new Date(log.createdAt).toLocaleString()}
                          </span>
                        </div>
                        {log.description && (
                          <p className="text-sm text-slate-500 mt-1">
                            {log.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg p-8 text-center">
                  <Clock className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-medium text-slate-600">No activity logs yet</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Created on {new Date(risk.createdAt).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-center px-4 sm:px-6 py-3 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
          <p className="text-xs font-medium text-slate-400">
            {sections[activeSection].label} &middot; {activeSection + 1} of {sections.length}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
