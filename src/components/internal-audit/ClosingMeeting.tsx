"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Download, Upload, FileSpreadsheet } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface Attendee {
  name: string;
  jobTitle: string;
  management: string;
  signature: string;
}
interface SummaryRow {
  number: string;
  keyNote: string;
  degreeOfRisk: string;
  recommendation: string;
  managementResponse: string;
}
interface DecisionRow {
  implementationDate: string;
  official: string;
  decision: string;
}
interface ClosingData {
  meetingVenue: string | null;
  history: string | null;
  assignmentTitle: string | null;
  auditTaskNumber: string | null;
  department: string | null;
  management: string | null;
  attendees: Attendee[];
  summary: SummaryRow[];
  decisions: DecisionRow[];
}

const HEADER_FIELDS: { key: keyof ClosingData; label: string }[] = [
  { key: "meetingVenue", label: "Meeting Venue" },
  { key: "history", label: "History" },
  { key: "assignmentTitle", label: "Assignment Title" },
  { key: "auditTaskNumber", label: "Audit Task Number" },
  { key: "department", label: "Department" },
  { key: "management", label: "Management" },
];

export default function ClosingMeeting({
  engagementId,
  canEdit,
}: {
  engagementId: string;
  canEdit: boolean;
}) {
  const { t } = useLanguage();
  const [data, setData] = useState<ClosingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const base = `/api/internal-audit/engagements/${engagementId}/closing-meeting`;
  const headTh = "text-xs font-medium text-slate-500 uppercase tracking-wider py-2";

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(base);
        if (res.ok) {
          const d = await res.json();
          setData(d || null);
        }
      } catch {
        toast.error(t("Failed to load closing meeting"));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engagementId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(base, { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed");
      }
      const d = await res.json();
      setData(d);
      toast.success(t("Closing meeting minutes uploaded"));
    } catch (err) {
      const msg =
        err instanceof Error && err.message !== "Failed"
          ? err.message
          : t("Failed to upload closing meeting minutes");
      toast.error(msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (loading) {
    return (
      <div className="py-10 text-center">
        <Loader2 className="h-6 w-6 animate-spin inline text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <a href={`${base}/template`} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("Download Template")}
          </Button>
        </a>
        {canEdit && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xlsm,.xls"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="bg-primary-600 hover:bg-primary-700"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              )}
              {t("Upload")}
            </Button>
          </>
        )}
      </div>

      {!data ? (
        <div className="border border-dashed rounded-lg p-8 text-center text-sm text-slate-500">
          <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 text-slate-300" />
          {t("Download the template, fill it in, then upload it to record the closing meeting minutes.")}
        </div>
      ) : (
        <div className="space-y-5">
          {/* Meeting Details */}
          <div className="rounded-lg border border-slate-200 overflow-x-auto">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  {HEADER_FIELDS.map((h) => (
                    <TableHead key={h.key} className={headTh}>{t(h.label)}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  {HEADER_FIELDS.map((h) => (
                    <TableCell key={h.key} className="text-sm text-slate-700">
                      {(data[h.key] as string) || "—"}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Attendees */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">{t("Attendees")}</h4>
            <div className="rounded-lg border border-slate-200 overflow-x-auto">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className={headTh}>{t("Name")}</TableHead>
                    <TableHead className={headTh}>{t("Job Title")}</TableHead>
                    <TableHead className={headTh}>{t("Management")}</TableHead>
                    <TableHead className={headTh}>{t("Signature")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.attendees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-slate-400">
                        {t("No data")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.attendees.map((a, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm text-slate-700">{a.name || "—"}</TableCell>
                        <TableCell className="text-sm text-slate-700">{a.jobTitle || "—"}</TableCell>
                        <TableCell className="text-sm text-slate-700">{a.management || "—"}</TableCell>
                        <TableCell className="text-sm text-slate-700">{a.signature || "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Summary of Audit Results */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">{t("Summary of Audit Results")}</h4>
            <div className="rounded-lg border border-slate-200 overflow-x-auto">
              <Table className="min-w-[820px]">
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className={`${headTh} w-12`}>#</TableHead>
                    <TableHead className={headTh}>{t("Key Note")}</TableHead>
                    <TableHead className={headTh}>{t("Degree of Risk")}</TableHead>
                    <TableHead className={headTh}>{t("Recommendation")}</TableHead>
                    <TableHead className={headTh}>{t("Management Response")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.summary.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-slate-400">
                        {t("No data")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.summary.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm text-slate-700">{s.number || i + 1}</TableCell>
                        <TableCell className="text-sm text-slate-700 whitespace-pre-wrap">{s.keyNote || "—"}</TableCell>
                        <TableCell className="text-sm text-slate-700">{s.degreeOfRisk || "—"}</TableCell>
                        <TableCell className="text-sm text-slate-700 whitespace-pre-wrap">{s.recommendation || "—"}</TableCell>
                        <TableCell className="text-sm text-slate-700 whitespace-pre-wrap">{s.managementResponse || "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Decisions taken */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">{t("Decisions taken")}</h4>
            <div className="rounded-lg border border-slate-200 overflow-x-auto">
              <Table className="min-w-[560px]">
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className={headTh}>{t("Implementation Date")}</TableHead>
                    <TableHead className={headTh}>{t("Official")}</TableHead>
                    <TableHead className={headTh}>{t("Decision")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(!data.decisions || data.decisions.length === 0) ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-sm text-slate-400">
                        {t("No data")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.decisions.map((d, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm text-slate-700">{d.implementationDate || "—"}</TableCell>
                        <TableCell className="text-sm text-slate-700">{d.official || "—"}</TableCell>
                        <TableCell className="text-sm text-slate-700 whitespace-pre-wrap">{d.decision || "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
