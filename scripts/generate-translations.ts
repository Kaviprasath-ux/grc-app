/**
 * Translation Build Script
 *
 * This script is the core of the Excel-driven internationalization system.
 *
 * HOW IT WORKS:
 * 1. Reads translations from /i18n/translations.xlsx (single source of truth)
 * 2. Uses the English column as canonical keys (phrase-based, not dot-notation)
 * 3. Generates derived locale files: /locales/en.json, /locales/ar.json, /locales/lv.json
 *
 * EXCEL FILE STRUCTURE:
 * - Column A: English, United States (canonical key)
 * - Column B: Arabic, Qatar
 * - Column C: Latvian, Latvia
 *
 * BUILD RULES:
 * - Generated JSON files are derived artifacts - NEVER edit manually
 * - Build fails if: duplicate English phrases, missing translations, parse errors
 *
 * RTL HANDLING:
 * - Arabic requires full RTL layout (handled by LanguageContext)
 * - This script only handles text translations
 *
 * USAGE:
 * - Development: npx tsx scripts/generate-translations.ts
 * - Build: Runs automatically via npm run build (see package.json)
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const EXCEL_FILE = path.join(process.cwd(), 'i18n', 'translations.xlsx');
const OUTPUT_DIR = path.join(process.cwd(), 'locales');
const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production';

// Locale configuration
const LOCALES = {
  'English, United States': 'en',
  'Arabic, Qatar': 'ar',
  'Latvian, Latvia': 'lv',
} as const;

const ENGLISH_COLUMN = 'English, United States';

interface TranslationRow {
  'English, United States': string;
  'Arabic, Qatar': string;
  'Latvian, Latvia': string;
}

interface ValidationError {
  type: 'duplicate' | 'missing' | 'empty';
  phrase: string;
  locale?: string;
  row?: number;
}

function validateTranslations(rows: TranslationRow[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const seenPhrases = new Map<string, number>();

  rows.forEach((row, index) => {
    const rowNum = index + 2; // Account for header row and 0-based index
    const englishPhrase = row[ENGLISH_COLUMN]?.trim();

    // Check for empty English phrase
    if (!englishPhrase) {
      errors.push({
        type: 'empty',
        phrase: '(empty)',
        locale: 'en',
        row: rowNum,
      });
      return;
    }

    // Check for duplicate English phrases
    if (seenPhrases.has(englishPhrase)) {
      errors.push({
        type: 'duplicate',
        phrase: englishPhrase,
        row: rowNum,
      });
    } else {
      seenPhrases.set(englishPhrase, rowNum);
    }

    // Check for missing translations
    Object.entries(LOCALES).forEach(([columnName, localeCode]) => {
      const translation = row[columnName as keyof TranslationRow]?.trim();
      if (!translation) {
        errors.push({
          type: 'missing',
          phrase: englishPhrase,
          locale: localeCode,
          row: rowNum,
        });
      }
    });
  });

  return errors;
}

function generateLocaleFiles(rows: TranslationRow[]): void {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Generate a file for each locale
  Object.entries(LOCALES).forEach(([columnName, localeCode]) => {
    const translations: Record<string, string> = {};

    rows.forEach((row) => {
      const key = row[ENGLISH_COLUMN]?.trim();
      const value = row[columnName as keyof TranslationRow]?.trim();

      if (key && value) {
        translations[key] = value;
      }
    });

    const outputPath = path.join(OUTPUT_DIR, `${localeCode}.json`);
    const content = JSON.stringify(translations, null, 2);

    fs.writeFileSync(outputPath, content, 'utf-8');
    console.log(`Generated: ${outputPath} (${Object.keys(translations).length} translations)`);
  });
}

function main(): void {
  console.log('\n=== Translation Build Script ===\n');

  // Check if Excel file exists
  if (!fs.existsSync(EXCEL_FILE)) {
    console.error(`ERROR: Translation file not found: ${EXCEL_FILE}`);
    console.error('Please create the Excel file with translations.');
    process.exit(1);
  }

  // Read Excel file
  console.log(`Reading: ${EXCEL_FILE}`);
  const workbook = XLSX.readFile(EXCEL_FILE);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Parse to JSON
  const rows = XLSX.utils.sheet_to_json<TranslationRow>(worksheet);
  console.log(`Found ${rows.length} translation entries`);

  // Validate translations
  console.log('\nValidating translations...');
  const errors = validateTranslations(rows);

  if (errors.length > 0) {
    console.error('\n=== VALIDATION ERRORS ===\n');

    const duplicates = errors.filter((e) => e.type === 'duplicate');
    const missing = errors.filter((e) => e.type === 'missing');
    const empty = errors.filter((e) => e.type === 'empty');

    if (duplicates.length > 0) {
      console.error(`DUPLICATE PHRASES (${duplicates.length}):`);
      duplicates.forEach((e) => {
        console.error(`  Row ${e.row}: "${e.phrase}"`);
      });
    }

    if (missing.length > 0) {
      console.error(`\nMISSING TRANSLATIONS (${missing.length}):`);
      missing.forEach((e) => {
        console.error(`  Row ${e.row}: "${e.phrase}" missing ${e.locale} translation`);
      });
    }

    if (empty.length > 0) {
      console.error(`\nEMPTY ENGLISH PHRASES (${empty.length}):`);
      empty.forEach((e) => {
        console.error(`  Row ${e.row}: Empty English phrase`);
      });
    }

    console.error('\n=========================\n');

    if (IS_DEVELOPMENT) {
      console.error('Development mode: Build failed due to translation errors.');
      console.error('Fix the errors in translations.xlsx and run again.');
    } else {
      console.error('Production mode: Build failed. All translations must be complete.');
    }

    process.exit(1);
  }

  console.log('Validation passed!');

  // Generate locale files
  console.log('\nGenerating locale files...');
  generateLocaleFiles(rows);

  console.log('\n=== Build Complete ===\n');
}

// Run the script
main();
