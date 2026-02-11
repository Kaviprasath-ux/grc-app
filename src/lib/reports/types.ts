export interface ReportColumn {
  key: string;
  header: string;
  width: number; // approximate character width
}

export interface ReportData {
  title: string;
  description: string;
  generatedAt: string;
  customerName: string;
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
  summary?: Record<string, string | number>;
}
