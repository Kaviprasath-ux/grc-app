import * as XLSX from "xlsx";
import { ReportData } from "./types";

export function generateExcel(data: ReportData): Buffer {
  const wb = XLSX.utils.book_new();

  // Build header row from columns
  const headers = data.columns.map((c) => c.header);
  const rows = data.rows.map((row) =>
    data.columns.map((c) => row[c.key] ?? "")
  );

  // Create sheet data: metadata rows + blank + header + data
  const sheetData: (string | number)[][] = [
    [data.title],
    [data.description],
    [`Generated: ${data.generatedAt}`],
    [`Customer: ${data.customerName}`],
    [], // blank row
    headers,
    ...rows,
  ];

  // If there's a summary, add it at the bottom
  if (data.summary) {
    sheetData.push([]); // blank row
    for (const [key, value] of Object.entries(data.summary)) {
      sheetData.push([key, String(value)]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Set column widths
  ws["!cols"] = data.columns.map((c) => ({ wch: c.width }));

  XLSX.utils.book_append_sheet(wb, ws, "Report");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(buf);
}
