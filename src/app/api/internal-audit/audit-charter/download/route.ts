import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getCustomerAccountId } from '@/lib/api-auth';
import { DEFAULT_CHARTER_CONTENT, hasEditableFields } from '@/lib/charter-default';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  WidthType,
  AlignmentType,
} from 'docx';
import type { CharterBlock, CharterInlineNode } from '@/lib/charter-parser';

// Blue color that isBlueHex() will re-detect when the doc is re-uploaded
const BLUE = '2563EB';

type HL = (typeof HeadingLevel)[keyof typeof HeadingLevel];
const HEADING_MAP: Record<number, HL> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
};

function buildRuns(
  segments: CharterInlineNode[],
  fieldValues: Record<string, string>,
): TextRun[] {
  return segments.flatMap((seg) => {
    if (seg.type === 'text') {
      return new TextRun({ text: seg.content });
    }
    // Field node — render current value in blue so mammoth re-detects it on re-upload
    const value = fieldValues[seg.id] ?? seg.defaultValue;
    return new TextRun({ text: value, color: BLUE, bold: false });
  });
}

function blocksToElements(
  blocks: CharterBlock[],
  fieldValues: Record<string, string>,
): Array<Paragraph | Table> {
  const out: Array<Paragraph | Table> = [];

  for (const block of blocks) {
    switch (block.type) {
      case 'heading':
        out.push(
          new Paragraph({
            children: buildRuns(block.segments, fieldValues),
            heading: HEADING_MAP[block.level] ?? HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 120 },
          }),
        );
        break;

      case 'paragraph':
        out.push(
          new Paragraph({
            children: buildRuns(block.segments, fieldValues),
            spacing: { after: 120 },
          }),
        );
        break;

      case 'list':
        for (const item of block.items) {
          out.push(
            new Paragraph({
              children: buildRuns(item.segments, fieldValues),
              bullet: { level: 0 },
              spacing: { after: 60 },
            }),
          );
        }
        // Small gap after list
        out.push(new Paragraph({ text: '', spacing: { after: 80 } }));
        break;

      case 'table':
        out.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: block.rows.map(
              (row) =>
                new TableRow({
                  children: row.cells.map(
                    (cell) =>
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: buildRuns(cell.segments, fieldValues),
                            alignment: AlignmentType.LEFT,
                          }),
                        ],
                      }),
                  ),
                }),
            ),
          }),
        );
        out.push(new Paragraph({ text: '', spacing: { after: 120 } }));
        break;
    }
  }

  return out;
}

export const GET = withAuth(
  async (_req, _ctx, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);

      const charter = await prisma.auditCharter.findUnique({
        where: { customerAccountId },
      });

      const content: CharterBlock[] =
        charter && hasEditableFields((charter.content as unknown[]) ?? [])
          ? (charter.content as CharterBlock[])
          : DEFAULT_CHARTER_CONTENT;

      const fieldValues = (charter?.fieldValues as Record<string, string>) ?? {};

      const doc = new Document({
        creator: 'GRC Application',
        title: 'Audit Charter',
        description: 'IIA Model Internal Audit Charter',
        styles: {
          paragraphStyles: [
            {
              id: 'Normal',
              name: 'Normal',
              run: { font: 'Calibri', size: 22 }, // 11pt
            },
          ],
        },
        sections: [
          {
            properties: {
              page: {
                margin: {
                  top: 1440,    // 1 inch
                  right: 1440,
                  bottom: 1440,
                  left: 1440,
                },
              },
            },
            children: [
              ...blocksToElements(content, fieldValues),
            ],
          },
        ],
      });

      const buffer = await Packer.toBuffer(doc);

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': 'attachment; filename="audit-charter.docx"',
        },
      });
    } catch (err) {
      console.error('GET /api/internal-audit/audit-charter/download:', err);
      return NextResponse.json({ error: 'Failed to generate document' }, { status: 500 });
    }
  },
  { resource: 'audit.charter', action: 'view' },
);
