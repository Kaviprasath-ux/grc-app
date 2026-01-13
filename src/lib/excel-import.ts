import * as XLSX from "xlsx";

export interface ColumnDefinition {
  name: string;
  required: boolean;
  type?: "string" | "number" | "boolean";
}

export interface ValidationError {
  row: number;
  column: string;
  message: string;
}

export interface ExcelImportResult<T> {
  success: boolean;
  data: T[];
  errors: ValidationError[];
  totalRows: number;
  validRows: number;
}

/**
 * Reusable Excel import utility that can be used for various entities
 * @param file - The Excel file buffer
 * @param columns - Array of column definitions with validation rules
 * @returns Parsed data with validation results
 */
export function parseExcelFile<T extends Record<string, unknown>>(
  fileBuffer: ArrayBuffer,
  columns: ColumnDefinition[]
): ExcelImportResult<T> {
  const errors: ValidationError[] = [];
  const data: T[] = [];

  try {
    // Read the workbook
    const workbook = XLSX.read(fileBuffer, { type: "array" });

    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return {
        success: false,
        data: [],
        errors: [{ row: 0, column: "", message: "Excel file is empty or has no sheets" }],
        totalRows: 0,
        validRows: 0,
      };
    }

    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON with header row
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
    }) as (string | number | boolean | null | undefined)[][];

    if (jsonData.length === 0) {
      return {
        success: false,
        data: [],
        errors: [{ row: 0, column: "", message: "Excel file is empty" }],
        totalRows: 0,
        validRows: 0,
      };
    }

    // Get headers from first row
    const headers = (jsonData[0] as string[]).map((h) => String(h).trim());

    // Validate required columns exist
    const missingColumns: string[] = [];
    const columnNames = columns.map((c) => c.name.toLowerCase());

    for (const col of columns) {
      if (col.required) {
        const headerLower = headers.map((h) => h.toLowerCase());
        if (!headerLower.includes(col.name.toLowerCase())) {
          missingColumns.push(col.name);
        }
      }
    }

    if (missingColumns.length > 0) {
      return {
        success: false,
        data: [],
        errors: [
          {
            row: 1,
            column: "",
            message: `Missing required columns: ${missingColumns.join(", ")}`,
          },
        ],
        totalRows: 0,
        validRows: 0,
      };
    }

    // Create header index map
    const headerIndexMap: Record<string, number> = {};
    headers.forEach((header, index) => {
      // Find matching column definition (case-insensitive)
      const matchingCol = columns.find(
        (c) => c.name.toLowerCase() === header.toLowerCase()
      );
      if (matchingCol) {
        headerIndexMap[matchingCol.name] = index;
      }
    });

    // Process data rows (skip header row)
    const totalRows = jsonData.length - 1;

    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i] as unknown[];
      const rowNum = i + 1; // 1-based for user display
      const rowData: Record<string, unknown> = {};
      let rowHasErrors = false;

      // Check if row is completely empty
      const isEmptyRow = row.every(
        (cell) => cell === undefined || cell === null || String(cell).trim() === ""
      );
      if (isEmptyRow) {
        continue; // Skip empty rows
      }

      // Process each column
      for (const col of columns) {
        const colIndex = headerIndexMap[col.name];
        const cellValue = colIndex !== undefined ? row[colIndex] : undefined;
        const stringValue = cellValue !== undefined && cellValue !== null
          ? String(cellValue).trim()
          : "";

        // Check required fields
        if (col.required && stringValue === "") {
          errors.push({
            row: rowNum,
            column: col.name,
            message: `Required field "${col.name}" is empty`,
          });
          rowHasErrors = true;
        }

        // Type validation
        if (stringValue !== "" && col.type) {
          if (col.type === "number" && isNaN(Number(stringValue))) {
            errors.push({
              row: rowNum,
              column: col.name,
              message: `"${col.name}" must be a number`,
            });
            rowHasErrors = true;
          }
        }

        // Store value
        rowData[col.name] = stringValue;
      }

      if (!rowHasErrors) {
        data.push(rowData as T);
      }
    }

    return {
      success: errors.length === 0,
      data,
      errors,
      totalRows,
      validRows: data.length,
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      errors: [
        {
          row: 0,
          column: "",
          message: `Failed to parse Excel file: ${error instanceof Error ? error.message : "Unknown error"}`,
        },
      ],
      totalRows: 0,
      validRows: 0,
    };
  }
}

/**
 * Generate an Excel template file with the specified columns
 * @param columns - Array of column names for the header row
 * @param sheetName - Name of the worksheet
 * @returns ArrayBuffer of the Excel file
 */
export function generateExcelTemplate(
  columns: string[],
  sheetName: string = "Sheet1"
): ArrayBuffer {
  // Create a new workbook
  const workbook = XLSX.utils.book_new();

  // Create worksheet data with just the header row
  const worksheetData = [columns];

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Set column widths
  const colWidths = columns.map((col) => ({ wch: Math.max(col.length + 5, 15) }));
  worksheet["!cols"] = colWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Generate buffer
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });

  return buffer;
}
