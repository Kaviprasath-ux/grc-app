import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import * as XLSX from "xlsx";
import { AUDIT_PROGRAM_COLUMNS } from "@/lib/audit-program-template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Suggested column widths (chars), aligned to AUDIT_PROGRAM_COLUMNS.
const COLUMN_WIDTHS: Record<string, number> = {
  Objective: 28,
  "Process / Sub-process": 24,
  Risk: 22,
  Control: 24,
  "Control Type": 16,
  "Key Control": 14,
  "Test Type": 16,
  "Audit Procedure": 32,
  "Sampling Method": 18,
  "Sample Size": 14,
  "Evidence Required": 24,
  Result: 16,
  Conclusion: 22,
  Exception: 22,
  "Working Paper": 18,
};
const COLUMNS = AUDIT_PROGRAM_COLUMNS.map((header) => ({
  header,
  width: COLUMN_WIDTHS[header] ?? 18,
}));

// GET - Download a blank Audit Program template as an Excel (.xlsx) file.
export const GET = withAuth(
  async (_req: NextRequest) => {
    try {
      const headers = COLUMNS.map((c) => c.header);

      // Header row + blank rows to fill in.
      const blankRows = 25;
      const rows: string[][] = [headers];
      for (let r = 0; r < blankRows; r++) {
        rows.push(new Array(headers.length).fill(""));
      }

      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      worksheet["!cols"] = COLUMNS.map((c) => ({ wch: c.width }));
      // Freeze the header row.
      worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Audit Program");

      const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="Audit-Program-Template.xlsx"`,
        },
      });
    } catch (error) {
      console.error("Error generating audit program template:", error);
      return NextResponse.json({ error: "Failed to generate template" }, { status: 500 });
    }
  },
  { resource: "audit.fieldwork", action: "view" }
);
