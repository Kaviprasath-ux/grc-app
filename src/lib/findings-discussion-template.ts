import * as XLSX from "xlsx";

/**
 * Findings Discussion (Preliminary Observations Discussion Meeting) Excel
 * template + parser. Single source of truth for the layout so a downloaded
 * template and an uploaded (filled) workbook always agree.
 */

export interface FDHeader {
  meetingVenue: string;
  history: string;
  assignmentTitle: string;
  auditTaskNumber: string;
  department: string;
  management: string;
}
export interface FDAttendee {
  name: string;
  jobTitle: string;
  management: string;
  signature: string;
}
export interface FDNoteRow {
  number: string;
  note: string;
  degreeOfRisk: string;
  managementResponse: string;
  proposedAction: string;
}
export interface FDActionRow {
  implementationDate: string;
  official: string;
  procedure: string;
}
export interface FindingsDiscussionData {
  header: FDHeader;
  attendees: FDAttendee[];
  notesDiscussed: FDNoteRow[];
  agreedActions: FDActionRow[];
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
const NOTE_HEADERS = [
  "Number",
  "Note",
  "Degree of Risk",
  "Management Response",
  "Proposed Action",
];
const ACTION_HEADERS = ["Implementation Date", "Official", "Procedure"];

const norm = (v: unknown): string =>
  String(v ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const isBlankRow = (row: unknown[] | undefined): boolean =>
  !row || row.every((c) => norm(c) === "");

/** Build the blank Findings Discussion template workbook (optionally pre-fill header). */
export function buildFindingsDiscussionTemplate(prefill?: Partial<FDHeader>): Uint8Array {
  const aoa: (string | number)[][] = [];
  aoa.push(["Preliminary Observations Discussion Meeting"]);
  aoa.push([]);

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

  aoa.push(["Attendees"]);
  aoa.push(ATTENDEE_HEADERS);
  for (let i = 0; i < 5; i++) aoa.push(["", "", "", ""]);
  aoa.push([]);

  aoa.push(["Notes Discussed"]);
  aoa.push(NOTE_HEADERS);
  for (let i = 0; i < 8; i++) aoa.push(["", "", "", "", ""]);
  aoa.push([]);

  aoa.push(["Agreed actions"]);
  aoa.push(ACTION_HEADERS);
  for (let i = 0; i < 6; i++) aoa.push(["", "", ""]);

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
  XLSX.utils.book_append_sheet(wb, ws, "Findings Discussion");
  return XLSX.write(wb, { bookType: "xlsx", type: "array" }) as Uint8Array;
}

/** Parse a filled Findings Discussion workbook back into structured data. */
export function parseFindingsDiscussionWorkbook(buffer: Buffer): {
  data?: FindingsDiscussionData;
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

  const header: FDHeader = {
    meetingVenue: "",
    history: "",
    assignmentTitle: "",
    auditTaskNumber: "",
    department: "",
    management: "",
  };
  const attendees: FDAttendee[] = [];
  const notesDiscussed: FDNoteRow[] = [];
  const agreedActions: FDActionRow[] = [];
  let foundAnySection = false;

  const cell = (row: unknown[] | undefined, i: number): string => String(row?.[i] ?? "").trim();

  for (let i = 0; i < rows.length; i++) {
    const r = (rows[i] || []).map(norm);

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

    if (r[0] === norm(ATTENDEE_HEADERS[0]) && r[1] === norm(ATTENDEE_HEADERS[1])) {
      foundAnySection = true;
      for (let j = i + 1; j < rows.length; j++) {
        const d = rows[j];
        if (isBlankRow(d)) break;
        const dn = norm(d?.[0]);
        if (dn === norm(NOTE_HEADERS[0]) || dn === "notes discussed") break;
        attendees.push({
          name: cell(d, 0),
          jobTitle: cell(d, 1),
          management: cell(d, 2),
          signature: cell(d, 3),
        });
      }
    }

    if (r[0] === norm(NOTE_HEADERS[0]) && r[1] === norm(NOTE_HEADERS[1])) {
      foundAnySection = true;
      for (let j = i + 1; j < rows.length; j++) {
        const d = rows[j];
        if (isBlankRow(d)) break;
        const dn = norm(d?.[0]);
        if (dn === norm(ACTION_HEADERS[0]) || dn === "agreed actions") break;
        notesDiscussed.push({
          number: cell(d, 0),
          note: cell(d, 1),
          degreeOfRisk: cell(d, 2),
          managementResponse: cell(d, 3),
          proposedAction: cell(d, 4),
        });
      }
    }

    if (r[0] === norm(ACTION_HEADERS[0]) && r[1] === norm(ACTION_HEADERS[1])) {
      foundAnySection = true;
      for (let j = i + 1; j < rows.length; j++) {
        const d = rows[j];
        if (isBlankRow(d)) break;
        agreedActions.push({
          implementationDate: cell(d, 0),
          official: cell(d, 1),
          procedure: cell(d, 2),
        });
      }
    }
  }

  if (!foundAnySection) {
    return {
      error:
        "The uploaded file does not match the Findings Discussion template. Please download the template, fill it in, and upload it.",
    };
  }

  return {
    data: {
      header,
      attendees: attendees.filter((a) => a.name || a.jobTitle || a.management || a.signature),
      notesDiscussed: notesDiscussed.filter(
        (n) => n.number || n.note || n.degreeOfRisk || n.managementResponse || n.proposedAction
      ),
      agreedActions: agreedActions.filter((a) => a.implementationDate || a.official || a.procedure),
    },
  };
}
