import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";
import { PDFDocument, rgb, StandardFonts, PDFFont } from "pdf-lib";
import { FEEDBACK_SURVEY_SECTIONS, SECTION_LABEL } from "@/lib/internal-audit/feedback-survey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET - Download the engagement feedback survey as a print-friendly PDF.
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;
      const tenantFilter = getTenantFilter(session);

      const engagement = await prisma.auditEngagement.findFirst({
        where: { id, ...tenantFilter },
        select: { id: true, auditId: true, engagementTitle: true },
      });
      if (!engagement) {
        return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
      }

      const saved = await prisma.auditFeedbackSurvey.findUnique({ where: { engagementId: id } });
      const responses: Record<string, string> = saved?.responses ? JSON.parse(saved.responses) : {};
      const comments: Record<string, string> = saved?.comments ? JSON.parse(saved.comments) : {};
      const customRows: Record<string, Array<{ key: string; text: string }>> = saved?.customRows
        ? JSON.parse(saved.customRows)
        : {};

      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const pageW = 595;
      const pageH = 842;
      const margin = 40;
      const contentW = pageW - margin * 2;

      let page = pdfDoc.addPage([pageW, pageH]);
      let y = pageH - margin;

      const ensure = (need: number) => {
        if (y - need < margin) {
          page = pdfDoc.addPage([pageW, pageH]);
          y = pageH - margin;
        }
      };
      const wrap = (text: string, size: number, f: PDFFont, maxW: number): string[] => {
        const clean = (text || "").replace(/\s+/g, " ").trim();
        if (!clean) return [""];
        const words = clean.split(" ");
        const lines: string[] = [];
        let line = "";
        for (const w of words) {
          const test = line ? `${line} ${w}` : w;
          if (f.widthOfTextAtSize(test, size) > maxW && line) {
            lines.push(line);
            line = w;
          } else line = test;
        }
        if (line) lines.push(line);
        return lines;
      };
      const centered = (text: string, size: number, f: PDFFont, color = rgb(0.1, 0.3, 0.6)) => {
        for (const ln of wrap(text, size, f, contentW)) {
          const w = f.widthOfTextAtSize(ln, size);
          ensure(size + 6);
          page.drawText(ln, { x: margin + (contentW - w) / 2, y: y - size, size, font: f, color });
          y -= size + 6;
        }
      };
      const sectionTitle = (text: string) => {
        y -= 12;
        ensure(16);
        page.drawText(text, { x: margin, y: y - 11, size: 11, font: bold, color: rgb(0.1, 0.3, 0.6) });
        y -= 16;
      };
      const ratingLabel = (v?: string) => (!v ? "—" : v === "NA" ? "N/A" : v);

      centered("Internal Audit Engagement Feedback Survey", 14, bold);
      centered(
        `${engagement.auditId || ""}  ${engagement.engagementTitle || ""}`.trim(),
        9,
        font,
        rgb(0.3, 0.3, 0.3)
      );
      y -= 2;
      for (const ln of wrap(
        "Purpose: To obtain feedback on the effectiveness, professionalism, and value of the internal audit engagement and support the QAIP.",
        9,
        font,
        contentW
      )) {
        ensure(12);
        page.drawText(ln, { x: margin, y: y - 9, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
        y -= 12;
      }

      const qNumW = 26;
      const ratingW = 60;
      const qTextW = contentW - qNumW - ratingW - 8;

      for (const section of FEEDBACK_SURVEY_SECTIONS) {
        sectionTitle(SECTION_LABEL[section.key] || section.title);
        section.questions.forEach((q, i) => {
          const lines = wrap(q.text, 9, font, qTextW);
          const rowH = Math.max(lines.length * 12, 12) + 4;
          ensure(rowH);
          const top = y;
          page.drawText(`${i + 1}.`, { x: margin, y: top - 9, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
          let ly = top - 9;
          for (const ln of lines) {
            page.drawText(ln, { x: margin + qNumW, y: ly, size: 9, font, color: rgb(0.15, 0.15, 0.15) });
            ly -= 12;
          }
          page.drawText(`[ ${ratingLabel(responses[q.key])} ]`, {
            x: margin + qNumW + qTextW + 8,
            y: top - 9,
            size: 9,
            font: bold,
            color: rgb(0.1, 0.3, 0.6),
          });
          y = top - rowH;
        });
        // User-added custom rows
        (customRows[section.key] || []).forEach((row, j) => {
          const label = (row.text || "").trim() || "(untitled)";
          const lines = wrap(label, 9, font, qTextW);
          const rowH = Math.max(lines.length * 12, 12) + 4;
          ensure(rowH);
          const top = y;
          page.drawText(`${section.questions.length + j + 1}.`, { x: margin, y: top - 9, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
          let ly = top - 9;
          for (const ln of lines) {
            page.drawText(ln, { x: margin + qNumW, y: ly, size: 9, font, color: rgb(0.15, 0.15, 0.15) });
            ly -= 12;
          }
          page.drawText(`[ ${ratingLabel(responses[row.key])} ]`, {
            x: margin + qNumW + qTextW + 8,
            y: top - 9,
            size: 9,
            font: bold,
            color: rgb(0.1, 0.3, 0.6),
          });
          y = top - rowH;
        });
        const c = (comments[section.key] || "").trim();
        ensure(12);
        page.drawText(`Comments: ${c || "—"}`, { x: margin, y: y - 9, size: 9, font, color: rgb(0.35, 0.35, 0.35) });
        y -= 14;
      }

      sectionTitle("OVERALL SATISFACTION");
      ensure(14);
      page.drawText(
        `Overall satisfaction with the audit engagement (1-5): ${saved?.overallSatisfaction ?? "—"}`,
        { x: margin, y: y - 10, size: 9.5, font, color: rgb(0.15, 0.15, 0.15) }
      );
      y -= 18;

      const openBlock = (label: string, value: string) => {
        ensure(14);
        page.drawText(label, { x: margin, y: y - 10, size: 9.5, font: bold, color: rgb(0.2, 0.2, 0.2) });
        y -= 14;
        for (const ln of wrap(value || "—", 9, font, contentW)) {
          ensure(12);
          page.drawText(ln, { x: margin, y: y - 9, size: 9, font, color: rgb(0.15, 0.15, 0.15) });
          y -= 12;
        }
        y -= 4;
      };
      openBlock("What did the audit team do particularly well?", saved?.didWell || "");
      openBlock("What improvements would you recommend?", saved?.improvements || "");

      const bytes = await pdfDoc.save();
      const safeName = `Feedback-Survey-${engagement.auditId || id}.pdf`;
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${safeName}"`,
          "Content-Length": bytes.length.toString(),
        },
      });
    } catch (error) {
      console.error("Error generating feedback survey PDF:", error);
      return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
    }
  },
  { resource: "audit.fieldwork", action: "view" }
);
