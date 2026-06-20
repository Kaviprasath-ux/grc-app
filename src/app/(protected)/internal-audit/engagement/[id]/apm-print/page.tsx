"use client";

import { useEffect, useState, use } from "react";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  type ApmContent,
  APM_STRUCTURE,
  APM_AUDIT_PROGRAM_COLUMNS,
  normalizeApmContent,
  cloneDefaultApmContent,
} from "@/lib/apm-template";

interface Engagement {
  id: string;
  auditId: string;
  engagementTitle: string | null;
  department?: { id: string; name: string } | null;
}

interface ProgramOverview {
  auditTitle: string;
  department: string;
  period: string;
}

export default function ApmPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [program, setProgram] = useState<ProgramOverview>({
    auditTitle: "",
    department: "",
    period: "",
  });
  const [content, setContent] = useState<ApmContent>(cloneDefaultApmContent());

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [engRes, apmRes] = await Promise.all([
          fetch(`/api/internal-audit/engagements/${id}`),
          fetch(`/api/internal-audit/engagements/${id}/apm`),
        ]);
        if (active && engRes.ok) setEngagement(await engRes.json());
        if (active && apmRes.ok) {
          const apm = await apmRes.json();
          if (apm) {
            try {
              const parsed = apm.programOverview ? JSON.parse(apm.programOverview) : null;
              const row = Array.isArray(parsed) ? parsed[0] : parsed;
              if (row)
                setProgram({
                  auditTitle: row.auditTitle ?? "",
                  department: row.department ?? "",
                  period: row.period ?? "",
                });
            } catch {
              /* ignore malformed overview */
            }
            if (apm.content) {
              try {
                setContent(normalizeApmContent(JSON.parse(apm.content)));
              } catch {
                /* keep defaults */
              }
            }
          }
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin ltr:mr-2 rtl:ml-2" />
        {t("Loading")}...
      </div>
    );
  }

  const c = content;
  const title =
    program.auditTitle ||
    engagement?.engagementTitle ||
    engagement?.auditId ||
    t("Audit Planning Memorandum");

  // A single labeled field: small label + whitespace-preserved value.
  const Field = ({ label, value }: { label: string; value: string }) => (
    <div className="mt-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{t(label)}</p>
      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">
        {value || "—"}
      </p>
    </div>
  );

  // Section 2 widget: checked trigger factors.
  const triggerFactorsBlock = (
    <ul className="mt-2 ltr:ml-5 rtl:mr-5 list-disc text-[13px] leading-relaxed text-slate-700">
      {c.triggerFactors
        .filter((f) => f.checked)
        .map((f, i) => (
          <li key={i}>{t(f.label)}</li>
        ))}
    </ul>
  );

  // Section 7 widget: Risk & Control table.
  const frameworkBlock = (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-slate-50 text-left text-slate-600">
            <th className="border border-slate-300 p-1.5">{t("Objective")}</th>
            <th className="border border-slate-300 p-1.5">{t("Risk")}</th>
            <th className="border border-slate-300 p-1.5">{t("Control")}</th>
            <th className="border border-slate-300 p-1.5">{t("Audit Procedure")}</th>
            <th className="border border-slate-300 p-1.5">{t("Risk Rating")}</th>
            <th className="border border-slate-300 p-1.5">{t("Control Type")}</th>
            <th className="border border-slate-300 p-1.5">{t("Control Frequency")}</th>
          </tr>
        </thead>
        <tbody>
          {c.frameworkRows.map((row, i) => (
            <tr key={i} className="align-top text-slate-700">
              <td className="border border-slate-300 p-1.5 whitespace-pre-wrap">{row.objective || "—"}</td>
              <td className="border border-slate-300 p-1.5 whitespace-pre-wrap">{row.risk || "—"}</td>
              <td className="border border-slate-300 p-1.5 whitespace-pre-wrap">{row.control || "—"}</td>
              <td className="border border-slate-300 p-1.5 whitespace-pre-wrap">{row.auditProcedure || "—"}</td>
              <td className="border border-slate-300 p-1.5">{row.riskRating ? t(row.riskRating) : "—"}</td>
              <td className="border border-slate-300 p-1.5">{row.controlType ? t(row.controlType) : "—"}</td>
              <td className="border border-slate-300 p-1.5">
                {row.controlFrequency ? t(row.controlFrequency) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="bg-slate-100 min-h-screen py-8 print:bg-white print:py-0">
      {/* Print-only stylesheet: hide all app chrome, show just the memorandum. */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #apm-print, #apm-print * { visibility: visible !important; }
          #apm-print {
            position: absolute; left: 0; top: 0; width: 100%;
            margin: 0; padding: 0; box-shadow: none;
          }
          .apm-no-print { display: none !important; }
          .apm-section { page-break-inside: avoid; }
        }
        @page { margin: 18mm; }
      `}</style>

      <div className="mx-auto max-w-4xl px-4">
        <div className="apm-no-print mb-4 flex justify-end">
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />
            {t("Print / Save as PDF")}
          </Button>
        </div>

        <div
          id="apm-print"
          className="bg-white rounded-lg shadow-sm border border-slate-200 p-10 print:border-0 print:shadow-none print:rounded-none"
        >
          {/* Header */}
          <div className="border-b border-slate-200 pb-4 mb-2">
            <h1 className="text-xl font-bold text-slate-900">
              {t("Audit Planning Memorandum")}
            </h1>
            <p className="text-sm text-slate-600 mt-1">{title}</p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[13px]">
              <div>
                <span className="text-slate-400">{t("Audit Title")}: </span>
                <span className="text-slate-700">
                  {program.auditTitle || engagement?.engagementTitle || "—"}
                </span>
              </div>
              <div>
                <span className="text-slate-400">{t("Department")}: </span>
                <span className="text-slate-700">
                  {program.department || engagement?.department?.name || "—"}
                </span>
              </div>
              <div>
                <span className="text-slate-400">{t("Period")}: </span>
                <span className="text-slate-700">{program.period || "—"}</span>
              </div>
            </div>
          </div>

          {(() => {
            // Remaining predefined sections + custom sections, renumbered.
            const removed = c.removedSections ?? [];
            const ordered = [
              ...APM_STRUCTURE.filter((s) => !removed.includes(s.key)).map((s) => ({
                key: s.key,
                title: t(s.title),
                special: s.special,
                specialAfter: s.specialAfter,
              })),
              ...c.customSections.map((cs) => ({
                key: cs.key,
                title: cs.title || t("Untitled section"),
                special: undefined as undefined | "triggerFactors" | "frameworkTable",
                specialAfter: undefined as number | undefined,
              })),
            ];
            return ordered.map((sec, idx) => {
              const fields = c.sections[sec.key] ?? [];
              const after = Math.min(sec.specialAfter ?? fields.length, fields.length);
              return (
                <section key={sec.key} className="apm-section">
                  <h2 className="text-base font-semibold text-slate-900 mt-5 mb-1">
                    {idx + 1}. {sec.title}
                  </h2>
                  {fields.slice(0, after).map((f) => (
                    <Field key={f.id} label={f.label} value={f.value} />
                  ))}
                  {sec.special === "triggerFactors" && triggerFactorsBlock}
                  {sec.special === "frameworkTable" && frameworkBlock}
                  {fields.slice(after).map((f) => (
                    <Field key={f.id} label={f.label} value={f.value} />
                  ))}
                </section>
              );
            });
          })()}

          {/* Audit Program working-paper entries */}
          {(c.auditProgramRows ?? []).some((row) =>
            APM_AUDIT_PROGRAM_COLUMNS.some((col) => (row[col] || "").trim())
          ) && (
            <section className="apm-section">
              <h2 className="text-base font-semibold text-slate-900 mt-5 mb-1">
                {t("Audit Program")}
              </h2>
              {c.auditProgramRows.map((row, i) => (
                <div key={i} className="mt-3 border border-slate-200 rounded p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                    {t("Entry")} {i + 1}
                  </p>
                  {APM_AUDIT_PROGRAM_COLUMNS.map((col) => (
                    <Field key={col} label={col} value={row[col] || ""} />
                  ))}
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
