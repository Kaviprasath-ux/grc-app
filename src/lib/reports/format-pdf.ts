import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "pdf-lib";
import { ReportData } from "./types";

const A4_W = 595;
const A4_H = 842;
const LANDSCAPE_W = 842;
const LANDSCAPE_H = 595;
const MARGIN = 40;
const FONT_SIZE_TITLE = 16;
const FONT_SIZE_META = 9;
const FONT_SIZE_HEADER = 8;
const FONT_SIZE_CELL = 7.5;
const ROW_HEIGHT = 16;
const HEADER_ROW_HEIGHT = 20;

export async function generatePDF(data: ReportData): Promise<Uint8Array> {
  const useLandscape = data.columns.length > 7;
  const pageW = useLandscape ? LANDSCAPE_W : A4_W;
  const pageH = useLandscape ? LANDSCAPE_H : A4_H;
  const contentWidth = pageW - 2 * MARGIN;

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([pageW, pageH]);
  let y = pageH - MARGIN;

  // Compute column widths proportional to their declared width
  const totalDeclared = data.columns.reduce((s, c) => s + c.width, 0);
  const colWidths = data.columns.map(
    (c) => (c.width / totalDeclared) * contentWidth
  );

  // ---- helper: new page ----
  function newPage(): PDFPage {
    page = doc.addPage([pageW, pageH]);
    y = pageH - MARGIN;
    return page;
  }

  // ---- helper: ensure space ----
  function ensureSpace(needed: number) {
    if (y - needed < MARGIN) {
      newPage();
    }
  }

  // ---- helper: truncate text to fit width ----
  function truncate(
    text: string,
    maxW: number,
    f: PDFFont,
    size: number
  ): string {
    const str = String(text ?? "");
    if (f.widthOfTextAtSize(str, size) <= maxW) return str;
    let t = str;
    while (t.length > 0 && f.widthOfTextAtSize(t + "...", size) > maxW) {
      t = t.slice(0, -1);
    }
    return t + "...";
  }

  // ---- Title ----
  ensureSpace(60);
  page.drawText(data.title, {
    x: MARGIN,
    y,
    size: FONT_SIZE_TITLE,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.4),
  });
  y -= 20;

  // ---- Metadata ----
  const metaLines = [
    data.description,
    `Generated: ${data.generatedAt}`,
    `Customer: ${data.customerName}`,
  ];
  for (const line of metaLines) {
    page.drawText(line, {
      x: MARGIN,
      y,
      size: FONT_SIZE_META,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });
    y -= 14;
  }
  y -= 10;

  // ---- Separator line ----
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: pageW - MARGIN, y },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 15;

  // ---- Table header ----
  function drawTableHeader() {
    ensureSpace(HEADER_ROW_HEIGHT + ROW_HEIGHT);
    // Header background
    page.drawRectangle({
      x: MARGIN,
      y: y - HEADER_ROW_HEIGHT + 4,
      width: contentWidth,
      height: HEADER_ROW_HEIGHT,
      color: rgb(0.2, 0.25, 0.55),
    });

    let x = MARGIN;
    for (let i = 0; i < data.columns.length; i++) {
      const txt = truncate(
        data.columns[i].header,
        colWidths[i] - 6,
        fontBold,
        FONT_SIZE_HEADER
      );
      page.drawText(txt, {
        x: x + 3,
        y: y - HEADER_ROW_HEIGHT + 8,
        size: FONT_SIZE_HEADER,
        font: fontBold,
        color: rgb(1, 1, 1),
      });
      x += colWidths[i];
    }
    y -= HEADER_ROW_HEIGHT;
  }

  drawTableHeader();

  // ---- Table rows ----
  for (let r = 0; r < data.rows.length; r++) {
    if (y - ROW_HEIGHT < MARGIN) {
      newPage();
      drawTableHeader();
    }

    // Alternating row background
    if (r % 2 === 0) {
      page.drawRectangle({
        x: MARGIN,
        y: y - ROW_HEIGHT + 4,
        width: contentWidth,
        height: ROW_HEIGHT,
        color: rgb(0.95, 0.95, 0.97),
      });
    }

    let x = MARGIN;
    for (let i = 0; i < data.columns.length; i++) {
      const val = data.rows[r][data.columns[i].key] ?? "";
      const txt = truncate(
        String(val),
        colWidths[i] - 6,
        font,
        FONT_SIZE_CELL
      );
      page.drawText(txt, {
        x: x + 3,
        y: y - ROW_HEIGHT + 7,
        size: FONT_SIZE_CELL,
        font,
        color: rgb(0.15, 0.15, 0.15),
      });
      x += colWidths[i];
    }
    y -= ROW_HEIGHT;
  }

  // ---- Summary section ----
  if (data.summary) {
    y -= 15;
    ensureSpace(40);
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: pageW - MARGIN, y },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 15;
    page.drawText("Summary", {
      x: MARGIN,
      y,
      size: 11,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.4),
    });
    y -= 16;
    for (const [key, value] of Object.entries(data.summary)) {
      ensureSpace(14);
      page.drawText(`${key}: ${value}`, {
        x: MARGIN,
        y,
        size: 9,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      y -= 14;
    }
  }

  // ---- Footer on last page ----
  page.drawText(`Total rows: ${data.rows.length}`, {
    x: MARGIN,
    y: MARGIN - 15,
    size: 7,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  return doc.save();
}
