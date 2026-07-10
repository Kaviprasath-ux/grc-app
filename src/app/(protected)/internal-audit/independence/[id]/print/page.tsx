"use client";

import { useEffect, useState, use } from "react";
import { Loader2, Printer, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  DECLARATION_STATEMENTS,
  DECLARATION_INTRO,
  declarationResultLabel,
} from "@/lib/independence-declaration";

interface Declaration {
  id: string;
  declarationCode: string;
  type: string;
  declarantName: string | null;
  position: string | null;
  department: string | null;
  engagement: string | null;
  declarationDate: string | null;
  result: string | null;
  explanation: string | null;
  employeeSignature: string | null;
  reviewerName: string | null;
  reviewerSignature: string | null;
  reviewedDate: string | null;
  status: string;
}

const fmtDate = (d: string | null) => (d ? d.slice(0, 10) : "—");

export default function DeclarationPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [decl, setDecl] = useState<Declaration | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/internal-audit/declarations/${id}`);
        if (active && res.ok) setDecl(await res.json());
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

  if (!decl) {
    return (
      <div className="py-24 text-center text-slate-500">{t("Declaration not found")}</div>
    );
  }

  const isIndependence = decl.type === "Independence";
  const docTitle = isIndependence ? t("Independence Declaration") : t("Objectivity Declaration");
  const statements = DECLARATION_STATEMENTS[decl.type] || [];
  const intro = DECLARATION_INTRO[decl.type] || "";
  const resultLabel = declarationResultLabel(decl.type, decl.result);

  const Info = ({ label, value }: { label: string; value: string }) => (
    <div>
      <span className="text-slate-400">{t(label)}: </span>
      <span className="text-slate-700">{value || "—"}</span>
    </div>
  );

  return (
    <div className="bg-slate-100 min-h-screen py-8 print:bg-white print:py-0">
      {/* Print-only stylesheet: hide all app chrome, show just the declaration. */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #decl-print, #decl-print * { visibility: visible !important; }
          #decl-print {
            position: absolute; left: 0; top: 0; width: 100%;
            margin: 0; padding: 0; box-shadow: none;
          }
          .decl-no-print { display: none !important; }
          .decl-section { page-break-inside: avoid; }
        }
        @page { margin: 18mm; }
      `}</style>

      <div className="mx-auto max-w-3xl px-4">
        <div className="decl-no-print mb-4 flex justify-end">
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("Print / Save as PDF")}
          </Button>
        </div>

        <div
          id="decl-print"
          className="bg-white rounded-lg shadow-sm border border-slate-200 p-10 print:border-0 print:shadow-none print:rounded-none"
        >
          {/* Header */}
          <div className="border-b border-slate-200 pb-4 mb-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              {t("Internal Audit")}
            </p>
            <h1 className="text-xl font-bold text-slate-900 mt-1">{docTitle}</h1>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[13px]">
              <Info label="Code" value={decl.declarationCode} />
              <Info label="Date" value={fmtDate(decl.declarationDate)} />
              <Info label="Status" value={t(decl.status)} />
            </div>
          </div>

          {/* Declarant details */}
          <section className="decl-section">
            <h2 className="text-base font-semibold text-slate-900 mb-2">{t("Declarant")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px]">
              <Info label="Name" value={decl.declarantName || ""} />
              <Info label="Position" value={decl.position || ""} />
              {isIndependence && <Info label="Department" value={decl.department || ""} />}
              <Info label="Audit Engagement" value={decl.engagement || ""} />
            </div>
          </section>

          {/* Statements */}
          <section className="decl-section mt-6">
            <p className="text-[13px] font-medium text-slate-700 mb-2">{t(intro)}</p>
            <ul className="space-y-1.5">
              {statements.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] text-slate-700">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0 print:hidden" />
                  <span>{t(s)}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Result */}
          <section className="decl-section mt-6">
            <h2 className="text-base font-semibold text-slate-900 mb-1">
              {isIndependence ? t("Declaration Result") : t("Objectivity Assessment")}
            </h2>
            <p className="text-[13px] text-slate-700">{resultLabel ? t(resultLabel) : "—"}</p>
            {decl.explanation && (
              <div className="mt-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  {t("Explanation")}
                </p>
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">
                  {decl.explanation}
                </p>
              </div>
            )}
          </section>

          {/* Signatures */}
          <section className="decl-section mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 mb-1">
                {isIndependence ? t("Employee Signature") : t("Internal Auditor Signature")}
              </p>
              <p className="text-[13px] text-slate-800 border-b border-slate-300 pb-1 min-h-[1.5rem]">
                {decl.employeeSignature || ""}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {t("Date")}: {fmtDate(decl.declarationDate)}
              </p>
            </div>
            {decl.reviewerName && (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 mb-1">
                  {isIndependence
                    ? t("Reviewed by (Chief Audit Executive / Audit Manager)")
                    : t("Approved by (Audit Manager)")}
                </p>
                <p className="text-[13px] text-slate-800 border-b border-slate-300 pb-1 min-h-[1.5rem]">
                  {decl.reviewerSignature || decl.reviewerName}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {t("Reviewer Name")}: {decl.reviewerName}
                  {decl.reviewedDate ? ` · ${t("Reviewed Date")}: ${fmtDate(decl.reviewedDate)}` : ""}
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
