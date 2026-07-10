import * as XLSX from "xlsx";

/**
 * Canonical column headers for the Audit Program working-paper template.
 * Single source of truth shared by the template generator and the upload
 * validator, so a downloaded template and an accepted upload always agree.
 */
export const AUDIT_PROGRAM_COLUMNS: string[] = [
  "Objective",
  "Process / Sub-process",
  "Risk",
  "Control",
  "Control Type",
  "Key Control",
  "Test Type",
  "Audit Procedure",
  "Sampling Method",
  "Sample Size",
  "Evidence Required",
  "Result",
  "Conclusion",
  "Exception",
  "Working Paper",
];

export interface TemplateValidationResult {
  valid: boolean;
  /** Human-readable reason when invalid. */
  reason?: string;
  /** Expected columns that were not found in the upload. */
  missing?: string[];
}

const normalize = (s: unknown): string =>
  String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** True if the file name looks like a spreadsheet we should validate. */
export function isSpreadsheetFile(fileName: string): boolean {
  return /\.(xlsx|xlsm|xls|csv)$/i.test(fileName.trim());
}

/**
 * Validate that an uploaded spreadsheet matches the Audit Program template:
 * its first sheet's header row must contain every expected column (extra
 * columns and ordering are allowed; matching is case/space-insensitive).
 */
export function validateAuditProgramWorkbook(buffer: Buffer): TemplateValidationResult {
  let headerRow: unknown[] = [];
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { valid: false, reason: "The file has no worksheets." };
    }
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
    headerRow = (rows[0] as unknown[]) || [];
  } catch {
    return { valid: false, reason: "The file could not be read as a spreadsheet." };
  }

  const present = new Set(headerRow.map(normalize));
  const missing = AUDIT_PROGRAM_COLUMNS.filter((c) => !present.has(normalize(c)));

  if (missing.length > 0) {
    return {
      valid: false,
      missing,
      reason: `The uploaded file does not match the Audit Program template. Missing column(s): ${missing.join(", ")}.`,
    };
  }

  return { valid: true };
}
