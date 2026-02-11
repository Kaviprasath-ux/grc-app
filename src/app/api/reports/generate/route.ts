import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getReportFetcher } from "@/lib/reports/data-fetchers";
import { generateCSV } from "@/lib/reports/format-csv";
import { generateExcel } from "@/lib/reports/format-excel";
import { generatePDF } from "@/lib/reports/format-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withAuth(
  async (req: NextRequest, _context, session) => {
    try {
      const body = await req.json();
      const { reportType, format } = body as {
        reportType: string;
        format: string;
      };

      if (!reportType || !format) {
        return NextResponse.json(
          { error: "reportType and format are required" },
          { status: 400 }
        );
      }

      const fetcher = getReportFetcher(reportType);
      if (!fetcher) {
        return NextResponse.json(
          { error: `Unknown report type: ${reportType}` },
          { status: 400 }
        );
      }

      // Fetch data
      const data = await fetcher(session);

      // Generate file
      let fileBuffer: Buffer | Uint8Array;
      let contentType: string;
      let extension: string;

      switch (format) {
        case "csv":
          fileBuffer = generateCSV(data);
          contentType = "text/csv";
          extension = "csv";
          break;
        case "excel":
          fileBuffer = generateExcel(data);
          contentType =
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          extension = "xlsx";
          break;
        case "pdf":
          fileBuffer = await generatePDF(data);
          contentType = "application/pdf";
          extension = "pdf";
          break;
        default:
          return NextResponse.json(
            { error: `Unsupported format: ${format}` },
            { status: 400 }
          );
      }

      const filename = `${data.title.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.${extension}`;

      return new NextResponse(Buffer.from(fileBuffer), {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    } catch (error) {
      console.error("Error generating report:", error);
      const message =
        error instanceof Error ? error.message : "Unknown error";
      return NextResponse.json(
        { error: "Failed to generate report", details: message },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.dashboard", action: "view" }
);
