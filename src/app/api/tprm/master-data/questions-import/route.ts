import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId } from '@/lib/api-auth';
import prisma from '@/lib/prisma';
import * as XLSX from 'xlsx';

// Each field can match multiple possible column header names (case-insensitive)
const COLUMN_ALIASES: Record<string, { aliases: string[]; required: boolean }> = {
  seqNo:              { aliases: ['sqno.', 'sqno', 'seq no', 'seq no *', 'sequence', 'sl no', '#'], required: false },
  domain:             { aliases: ['domain name', 'domain*', 'domain'], required: false },
  isParent:           { aliases: ['isparent', 'isparent(true/false) *', 'isparent(true/false)', 'is parent'], required: false },
  questionTitle:      { aliases: ['question title', 'question title *', 'question', 'question text', 'title'], required: true },
  evidence:           { aliases: ['evidence', 'evidence required'], required: false },
  mandatoryAttachment:{ aliases: ['mandatory attachment', 'mandatory attachment (true/false) *', 'mandatory attachment (true/false)'], required: false },
  mandatoryQuestion:  { aliases: ['mandatory question', 'mandetory question', 'mandatory question (true/false) *', 'mandatory question (true/false)'], required: false },
  verifaiPrompt:      { aliases: ['varifai prompt question*', 'varifai prompt question', 'varifai prompt', 'control question description', 'control question'], required: false },
  validateThroughAI:  { aliases: ['validatethroughai(true/false)*', 'validatethroughai(true/false)', 'validatethroughai', 'validate through ai'], required: false },
  issue:              { aliases: ['issue *', 'issue'], required: false },
  risk:               { aliases: ['risk *', 'risk'], required: false },
  recommendation:     { aliases: ['recommendation *', 'recommendation'], required: false },
  severity:           { aliases: ['severity (high/medium/low) *', 'severity (high/medium/low)', 'severity'], required: false },
};

function parseBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  const v = String(value ?? '').trim().toUpperCase();
  return v === 'TRUE' || v === 'YES' || v === '1';
}

function getStr(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

export const POST = withAuth(
  async (req: NextRequest, _context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const formData = await req.formData();
      const file = formData.get('file') as File;
      const templateId = formData.get('templateId') as string | null;

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      // Read the Excel file
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return NextResponse.json({ error: 'Excel file has no sheets', created: 0, linked: 0, errors: [] }, { status: 400 });
      }

      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as unknown[][];

      if (jsonData.length < 2) {
        return NextResponse.json({ error: 'File is empty or has no data rows', created: 0, linked: 0, errors: [] }, { status: 400 });
      }

      // Build header → field mapping using aliases
      const headers = (jsonData[0] as string[]).map((h) => String(h).trim().toLowerCase());
      const headerMap: Record<string, number> = {}; // fieldName → column index

      for (const [fieldName, config] of Object.entries(COLUMN_ALIASES)) {
        for (const alias of config.aliases) {
          const idx = headers.indexOf(alias.toLowerCase());
          if (idx !== -1) {
            headerMap[fieldName] = idx;
            break;
          }
        }
      }

      // Check required columns
      const missingRequired: string[] = [];
      for (const [fieldName, config] of Object.entries(COLUMN_ALIASES)) {
        if (config.required && headerMap[fieldName] === undefined) {
          missingRequired.push(fieldName);
        }
      }
      if (missingRequired.length > 0) {
        return NextResponse.json({
          error: `Missing required columns: ${missingRequired.join(', ')}. Found headers: ${headers.join(', ')}`,
          created: 0, linked: 0, errors: [],
        }, { status: 400 });
      }

      // Helper to get cell value by field name
      const getCell = (row: unknown[], field: string): unknown => {
        const idx = headerMap[field];
        return idx !== undefined ? row[idx] : undefined;
      };

      // Build domain lookup/cache (name -> id)
      const domainCache = new Map<string, string>();
      const existingDomains = await prisma.tPRMDomain.findMany({
        where: { customerAccountId },
        select: { id: true, name: true },
      });
      for (const d of existingDomains) {
        domainCache.set(d.name.toLowerCase(), d.id);
      }

      // Get max sort order
      const maxOrder = await prisma.tPRMMasterQuestion.aggregate({
        where: { customerAccountId },
        _max: { sortOrder: true },
      });
      let nextSort = (maxOrder._max.sortOrder || 0) + 1;

      const createdQuestionIds: string[] = [];
      const errors: { row: number; message: string }[] = [];

      // Process data rows (skip header)
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as unknown[];
        const rowNum = i + 1;

        // Skip empty rows
        const isEmptyRow = row.every((cell) => cell === undefined || cell === null || String(cell).trim() === '');
        if (isEmptyRow) continue;

        const questionTitle = getStr(getCell(row, 'questionTitle'));
        if (!questionTitle) {
          errors.push({ row: rowNum, message: 'Question title is empty' });
          continue;
        }

        // Resolve domain
        const domainName = getStr(getCell(row, 'domain'));
        let domainId: string | null = null;
        if (domainName) {
          const key = domainName.toLowerCase();
          if (domainCache.has(key)) {
            domainId = domainCache.get(key)!;
          } else {
            const newDomain = await prisma.tPRMDomain.create({
              data: { customerAccountId, name: domainName, sortOrder: 0 },
            });
            domainCache.set(key, newDomain.id);
            domainId = newDomain.id;
          }
        }

        const seqStr = getStr(getCell(row, 'seqNo'));
        const sortOrder = seqStr ? (parseInt(seqStr) || nextSort) : nextSort;
        nextSort = Math.max(nextSort, sortOrder + 1);

        try {
          const question = await prisma.tPRMMasterQuestion.create({
            data: {
              customerAccountId,
              domainId,
              questionText: questionTitle,
              verifaiPrompt: getStr(getCell(row, 'verifaiPrompt')) || null,
              sortOrder,
              isParentQuestion: parseBool(getCell(row, 'isParent')),
              mandatoryAttachment: parseBool(getCell(row, 'mandatoryAttachment')),
              mandatoryQuestion: parseBool(getCell(row, 'mandatoryQuestion')),
              validateThroughAI: parseBool(getCell(row, 'validateThroughAI')),
              evidence: getStr(getCell(row, 'evidence')) || null,
              issue: getStr(getCell(row, 'issue')) || null,
              risk: getStr(getCell(row, 'risk')) || null,
              recommendation: getStr(getCell(row, 'recommendation')) || null,
              severity: getStr(getCell(row, 'severity')) || null,
            },
          });
          createdQuestionIds.push(question.id);
        } catch (err) {
          errors.push({ row: rowNum, message: `DB error: ${err instanceof Error ? err.message : String(err)}` });
        }
      }

      // Link to template if provided
      let linked = 0;
      if (templateId && createdQuestionIds.length > 0) {
        const maxLinkOrder = await prisma.tPRMQuestionnaireQuestion.aggregate({
          where: { customerAccountId, templateId },
          _max: { sortOrder: true },
        });
        let linkSort = (maxLinkOrder._max.sortOrder || 0) + 1;

        await prisma.tPRMQuestionnaireQuestion.createMany({
          data: createdQuestionIds.map((qId) => ({
            customerAccountId,
            templateId,
            questionId: qId,
            sortOrder: linkSort++,
          })),
        });
        linked = createdQuestionIds.length;
      }

      return NextResponse.json({
        created: createdQuestionIds.length,
        linked,
        errors,
        totalRows: jsonData.length - 1,
        validRows: createdQuestionIds.length,
      });
    } catch (error) {
      console.error('Question import error:', error);
      const msg = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: 'Failed to import questions', detail: msg }, { status: 500 });
    }
  },
  { resource: 'tprm.master-data', action: 'create' }
);
