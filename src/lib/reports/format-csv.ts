import { ReportData } from "./types";

function escapeCSV(value: string | number): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateCSV(data: ReportData): Buffer {
  const headers = data.columns.map((c) => c.header);
  const lines: string[] = [headers.map(escapeCSV).join(",")];

  for (const row of data.rows) {
    const values = data.columns.map((c) => escapeCSV(row[c.key] ?? ""));
    lines.push(values.join(","));
  }

  return Buffer.from(lines.join("\r\n"), "utf-8");
}
