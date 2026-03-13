import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import prisma from "@/lib/prisma";
import { withAuth, getCustomerAccountId } from "@/lib/api-auth";

/**
 * GET — Download a vendor import template.
 *
 * Fixed columns: vendor profile fields
 * Dynamic columns: one per onboarding question (Yes/No or free text depending on responseType)
 * Reference sheet: available service categories
 */
export const GET = withAuth(
  async (_req, _context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);

      // Fetch onboarding questions (parent + children)
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

      // Build flat question list with response type info
      const questionColumns: { title: string; responseType: string }[] = [];
      for (const pq of parentQuestions) {
        questionColumns.push({ title: pq.title, responseType: pq.responseType });
        for (const cq of pq.children) {
          questionColumns.push({ title: `  └ ${cq.title}`, responseType: cq.responseType });
        }
      }

      const fixedHeaders = [
        "Vendor Name",
        "Account Manager Name",
        "Account Manager Email",
        "Contact Number",
        "Service Category",
        "Service Description",
        "Vendor URL",
      ];

      // Build header with response type hints for question columns
      const headerRow = [
        ...fixedHeaders,
        ...questionColumns.map((q) =>
          q.responseType === "Yes/No" ? `${q.title} (Yes/No)` : `${q.title} (Text)`
        ),
      ];

      const vendorSheet = XLSX.utils.aoa_to_sheet([headerRow]);
      vendorSheet["!cols"] = headerRow.map((h) => ({ wch: Math.max(String(h).length + 3, 18) }));

      // Service Categories reference sheet
      const categories = await prisma.tPRMServiceCategory.findMany({
        where: { customerAccountId, isActive: true },
        select: { name: true },
        orderBy: { name: "asc" },
      });
      const catRows: string[][] = [["Available Service Categories"]];
      for (const c of categories) catRows.push([c.name]);
      const catSheet = XLSX.utils.aoa_to_sheet(catRows);
      catSheet["!cols"] = [{ wch: 35 }];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, vendorSheet, "Vendor Import");
      XLSX.utils.book_append_sheet(workbook, catSheet, "Service Categories");

      const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });

      return new NextResponse(Buffer.from(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="Vendor_Import_Template.xlsx"',
        },
      });
    } catch (error) {
      console.error("Error generating vendor template:", error);
      return NextResponse.json({ error: "Failed to generate template" }, { status: 500 });
    }
  },
  { resource: "tprm.vendor-management", action: "view" }
);
