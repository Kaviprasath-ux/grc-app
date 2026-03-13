import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import prisma from "@/lib/prisma";
import { withAuth, getCustomerAccountId } from "@/lib/api-auth";

/**
 * GET — Export existing vendors with onboarding questions for filling responses.
 *
 * Columns: Vendor Name, Engagement ID, then one column per question
 * with "(Yes/No)" or "(Text)" suffix. User fills answers, then imports back.
 */
export const GET = withAuth(
  async (_req, _context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);

      const vendors = await prisma.tPRMVendor.findMany({
        where: { customerAccountId },
        orderBy: { createdAt: "asc" },
      });

      const parentQuestions = await prisma.tPRMOnboardingQuestion.findMany({
        where: { customerAccountId, isActive: true, questionType: "Parent" },
        include: {
          children: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { sortOrder: "asc" },
      });

      // Build flat question list with IDs for answer lookup
      const questionColumns: { id: string; title: string; responseType: string }[] = [];
      for (const pq of parentQuestions) {
        questionColumns.push({ id: pq.id, title: pq.title, responseType: pq.responseType });
        for (const cq of pq.children) {
          questionColumns.push({ id: cq.id, title: `  └ ${cq.title}`, responseType: cq.responseType });
        }
      }

      const HEADERS = [
        "Vendor Name",
        "Engagement ID",
        ...questionColumns.map((q) =>
          q.responseType === "Yes/No" ? `${q.title} (Yes/No)` : `${q.title} (Text)`
        ),
      ];

      const rows: (string | number)[][] = [HEADERS];

      for (const vendor of vendors) {
        // Parse stored onboarding answers if available
        let answers: Record<string, string> = {};
        if (vendor.onboardingAnswers) {
          try { answers = JSON.parse(vendor.onboardingAnswers); } catch { /* ignore */ }
        }
        rows.push([
          vendor.name,
          vendor.engagementId || vendor.vendorCode,
          ...questionColumns.map((q) => answers[q.id] || ""),
        ]);
      }

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      worksheet["!cols"] = HEADERS.map((h) => ({ wch: Math.max(String(h).length + 3, 18) }));
      XLSX.utils.book_append_sheet(workbook, worksheet, "Vendor Risk Rating Questions");

      const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });

      return new NextResponse(Buffer.from(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="Vendor_Risk_Rating_Questions.xlsx"',
        },
      });
    } catch (error) {
      console.error("Error exporting vendor questions:", error);
      return NextResponse.json({ error: "Failed to export questions" }, { status: 500 });
    }
  },
  { resource: "tprm.vendor-management", action: "view" }
);
