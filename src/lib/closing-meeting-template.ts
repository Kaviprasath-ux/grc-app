import * as XLSX from "xlsx";

/**
 * Closing Meeting (Audit Task Closing Meeting Minutes) Excel template + parser.
 * Single source of truth for the template layout so a downloaded template and
 * an uploaded (filled) workbook always agree.
 */

export interface ClosingMeetingHeader {
  meetingVenue: string;
  history: string;
  assignmentTitle: string;
  auditTaskNumber: string;
  department: string;
  management: string;
}
export interface ClosingMeetingAttendee {
  name: string;
  jobTitle: string;
  management: string;
  signature: string;
}
export interface ClosingMeetingSummaryRow {
  number: string;
  keyNote: string;
  degreeOfRisk: string;
  recommendation: string;
  managementResponse: string;
}
export interface ClosingMeetingDecisionRow {
  implementationDate: string;
  official: string;
  decision: string;
}
export interface ClosingMeetingData {
  header: ClosingMeetingHeader;
  attendees: ClosingMeetingAttendee[];
  summary: ClosingMeetingSummaryRow[];
  decisions: ClosingMeetingDecisionRow[];
}

const MEETING_HEADERS = [
  "Meeting Venue",
  "History",
  "Assignment Title",
  "Audit Task Number",
  "Department",
  "Management",
];
const ATTENDEE_HEADERS = ["Name", "Job Title", "Management", "Signature"];
const SUMMARY_HEADERS = [
  "Number",
  "Key Note",
  "Degree of Risk",
  "Recommendation",
  "Management Response",
];
const DECISION_HEADERS = ["Implementation Date", "Official", "Decision"];

const norm = (v: unknown): string =>
  String(v ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const isBlankRow = (row: unknown[] | undefined): boolean =>
  !row || row.every((c) => norm(c) === "");

/** Build the blank Closing Meeting template workbook (optionally pre-fill header). */
export function buildClosingMeetingTemplate(prefill?: Partial<ClosingMeetingHeader>): Uint8Array {
  const aoa: (string | number)[][] = [];
  aoa.push(["Audit Task Closing Meeting Minutes Form"]);
  aoa.push([]);

  // Meeting Details
  aoa.push(["Meeting Details"]);
  aoa.push(MEETING_HEADERS);
  aoa.push([
    prefill?.meetingVenue ?? "",
    prefill?.history ?? "",
    prefill?.assignmentTitle ?? "",
    prefill?.auditTaskNumber ?? "",
    prefill?.department ?? "",
    prefill?.management ?? "",
  ]);
  aoa.push([]);

  // Attendees
  aoa.push(["Attendees"]);
  aoa.push(ATTENDEE_HEADERS);
  for (let i = 0; i < 5; i++) aoa.push(["", "", "", ""]);
  aoa.push([]);

  // Summary of Audit Results
  aoa.push(["Summary of Audit Results"]);
  aoa.push(SUMMARY_HEADERS);
  for (let i = 0; i < 8; i++) aoa.push(["", "", "", "", ""]);
  aoa.push([]);

  // Decisions taken
  aoa.push(["Decisions taken"]);
  aoa.push(DECISION_HEADERS);
  for (let i = 0; i < 5; i++) aoa.push(["", "", ""]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 22 },
    { wch: 22 },
    { wch: 22 },
    { wch: 20 },
    { wch: 18 },
    { wch: 18 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Closing Meeting");
  return XLSX.write(wb, { bookType: "xlsx", type: "array" }) as Uint8Array;
}

/** Parse a filled Closing Meeting workbook back into structured data. */
export function parseClosingMeetingWorkbook(buffer: Buffer): {
  data?: ClosingMeetingData;
  error?: string;
} {
  let rows: unknown[][] = [];
  try {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return { error: "The file has no worksheets." };
    rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: true });
  } catch {
    return { error: "The file could not be read as a spreadsheet." };
  }

  const header: ClosingMeetingHeader = {
    meetingVenue: "",
    history: "",
    assignmentTitle: "",
    auditTaskNumber: "",
    department: "",
    management: "",
  };
  const attendees: ClosingMeetingAttendee[] = [];
  const summary: ClosingMeetingSummaryRow[] = [];
  const decisions: ClosingMeetingDecisionRow[] = [];
  let foundAnySection = false;

  const cell = (row: unknown[] | undefined, i: number): string => String(row?.[i] ?? "").trim();

  for (let i = 0; i < rows.length; i++) {
    const r = (rows[i] || []).map(norm);

    // Meeting Details: data is the row right after the header row.
    if (r[0] === norm(MEETING_HEADERS[0]) && r[1] === norm(MEETING_HEADERS[1])) {
      foundAnySection = true;
      const d = rows[i + 1];
      header.meetingVenue = cell(d, 0);
      header.history = cell(d, 1);
      header.assignmentTitle = cell(d, 2);
      header.auditTaskNumber = cell(d, 3);
      header.department = cell(d, 4);
      header.management = cell(d, 5);
    }

    // Attendees
    if (r[0] === norm(ATTENDEE_HEADERS[0]) && r[1] === norm(ATTENDEE_HEADERS[1])) {
      foundAnySection = true;
      for (let j = i + 1; j < rows.length; j++) {
        const d = rows[j];
        if (isBlankRow(d)) break;
        const dn = norm(d?.[0]);
        if (dn === norm(SUMMARY_HEADERS[0]) || dn === "summary of audit results") break;
        attendees.push({
          name: cell(d, 0),
          jobTitle: cell(d, 1),
          management: cell(d, 2),
          signature: cell(d, 3),
        });
      }
    }

    // Summary of Audit Results
    if (r[0] === norm(SUMMARY_HEADERS[0]) && r[1] === norm(SUMMARY_HEADERS[1])) {
      foundAnySection = true;
      for (let j = i + 1; j < rows.length; j++) {
        const d = rows[j];
        if (isBlankRow(d)) break;
        const dn = norm(d?.[0]);
        if (dn === norm(DECISION_HEADERS[0]) || dn === "decisions taken") break;
        summary.push({
          number: cell(d, 0),
          keyNote: cell(d, 1),
          degreeOfRisk: cell(d, 2),
          recommendation: cell(d, 3),
          managementResponse: cell(d, 4),
        });
      }
    }

    // Decisions taken
    if (r[0] === norm(DECISION_HEADERS[0]) && r[1] === norm(DECISION_HEADERS[1])) {
      foundAnySection = true;
      for (let j = i + 1; j < rows.length; j++) {
        const d = rows[j];
        if (isBlankRow(d)) break;
        decisions.push({
          implementationDate: cell(d, 0),
          official: cell(d, 1),
          decision: cell(d, 2),
        });
      }
    }
  }

  if (!foundAnySection) {
    return {
      error:
        "The uploaded file does not match the Closing Meeting template. Please download the template, fill it in, and upload it.",
    };
  }

  // Drop fully-empty repeatable rows.
  const cleanAttendees = attendees.filter(
    (a) => a.name || a.jobTitle || a.management || a.signature
  );
  const cleanSummary = summary.filter(
    (s) => s.number || s.keyNote || s.degreeOfRisk || s.recommendation || s.managementResponse
  );
  const cleanDecisions = decisions.filter(
    (d) => d.implementationDate || d.official || d.decision
  );

  return {
    data: { header, attendees: cleanAttendees, summary: cleanSummary, decisions: cleanDecisions },
  };
}
