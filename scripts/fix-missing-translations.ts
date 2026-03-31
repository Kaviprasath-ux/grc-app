/**
 * One-off script to fill in missing Arabic/Latvian translations for existing rows in translations.xlsx
 * Run with: npx tsx scripts/fix-missing-translations.ts
 */

import * as XLSX from 'xlsx';
import * as path from 'path';

const EXCEL_FILE = path.join(process.cwd(), 'i18n', 'translations.xlsx');

// Translations for missing phrases (English → { ar, lv })
const TRANSLATIONS: Record<string, { ar: string; lv: string }> = {
  'Approve': { ar: 'موافقة', lv: 'Apstiprināt' },
  'Select Approver': { ar: 'اختر المعتمد', lv: 'Izvēlēties apstiprinātāju' },
  'Offboarding': { ar: 'إنهاء التعاقد', lv: 'Atslēgšana' },
  'Offboard Approval': { ar: 'موافقة إنهاء التعاقد', lv: 'Atslēgšanas apstiprinājums' },
  'Failed to request clarification': { ar: 'فشل طلب التوضيح', lv: 'Neizdevās pieprasīt skaidrojumu' },
  'No questions match the selected filters': { ar: 'لا توجد أسئلة تطابق الفلاتر المحددة', lv: 'Nav jautājumu, kas atbilst izvēlētajiem filtriem' },
  'Mandatory Attachments': { ar: 'المرفقات الإلزامية', lv: 'Obligātie pielikumi' },
  'No issues found': { ar: 'لا توجد مشكلات', lv: 'Nav atrasto problēmu' },
  'Awaiting Response': { ar: 'في انتظار الرد', lv: 'Gaida atbildi' },
  'Internal Comments': { ar: 'تعليقات داخلية', lv: 'Iekšējie komentāri' },
  'Unassigned Queue': { ar: 'قائمة الانتظار غير المخصصة', lv: 'Nepiešķirta rinda' },
  'Due Diligence': { ar: 'العناية الواجبة', lv: 'Pienācīga rūpība' },
  'For any further questions or follow-ups on this report, please reach out to us.': {
    ar: 'لأي أسئلة أو متابعات إضافية بشأن هذا التقرير، يرجى التواصل معنا.',
    lv: 'Ja jums ir papildu jautājumi vai nepieciešamas turpmākas darbības saistībā ar šo ziņojumu, lūdzu, sazinieties ar mums.',
  },
  'Sincerely,': { ar: 'مع خالص التحيات،', lv: 'Ar cieņu,' },
  'Third Party Risk Management Team': { ar: 'فريق إدارة مخاطر الطرف الثالث', lv: 'Trešo pušu risku pārvaldības komanda' },
  'Third Party Risk Management Team conducted a due diligence review of': {
    ar: 'أجرى فريق إدارة مخاطر الطرف الثالث مراجعة للعناية الواجبة على',
    lv: 'Trešo pušu risku pārvaldības komanda veica pienācīgas rūpības pārskatu par',
  },
  'The control environment was found to be:': { ar: 'تبين أن بيئة التحكم هي:', lv: 'Konstatēts, ka kontroles vide ir:' },
  'VerifAI Summary': { ar: 'ملخص VerifAI', lv: 'VerifAI kopsavilkums' },
  'Number of Questions': { ar: 'عدد الأسئلة', lv: 'Jautājumu skaits' },
  'Reassessments': { ar: 'إعادة التقييمات', lv: 'Atkārtotie novērtējumi' },
  'Assessment Report': { ar: 'تقرير التقييم', lv: 'Novērtēšanas ziņojums' },
  'Prepared By': { ar: 'أُعِدَّ بواسطة', lv: 'Sagatavoja' },
  'Sincerely': { ar: 'مع التحيات', lv: 'Ar cieņu' },
  'Overall Cybersecurity Score': { ar: 'الدرجة الإجمالية للأمن السيبراني', lv: 'Kopējais kiberdrošības rādītājs' },
  'The control environment was found to be': { ar: 'تبين أن بيئة التحكم هي', lv: 'Konstatēts, ka kontroles vide ir' },
  'Terminated Vendors': { ar: 'الموردون المُنهى تعاقدهم', lv: 'Pārtrauktie piegādātāji' },
};

function main() {
  console.log('Reading:', EXCEL_FILE);
  const workbook = XLSX.readFile(EXCEL_FILE);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Get the range of the sheet
  const range = XLSX.utils.decode_range(worksheet['!ref']!);
  let fixed = 0;

  // Find column indices from header row (row 0)
  let colEn = -1, colAr = -1, colLv = -1;
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = worksheet[XLSX.utils.encode_cell({ r: 0, c })];
    if (!cell) continue;
    const val = cell.v as string;
    if (val === 'English, United States') colEn = c;
    else if (val === 'Arabic, Qatar') colAr = c;
    else if (val === 'Latvian, Latvia') colLv = c;
  }

  if (colEn === -1 || colAr === -1 || colLv === -1) {
    console.error('Could not find required columns!');
    process.exit(1);
  }

  console.log(`Columns: EN=${colEn}, AR=${colAr}, LV=${colLv}`);

  // Iterate rows (skip header)
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const enCell = worksheet[XLSX.utils.encode_cell({ r, c: colEn })];
    if (!enCell) continue;
    const enText = (enCell.v as string)?.trim();
    if (!enText) continue;

    const t = TRANSLATIONS[enText];
    if (!t) continue;

    const arAddr = XLSX.utils.encode_cell({ r, c: colAr });
    const lvAddr = XLSX.utils.encode_cell({ r, c: colLv });

    const arCell = worksheet[arAddr];
    const lvCell = worksheet[lvAddr];

    let changed = false;
    if (!arCell || !arCell.v || String(arCell.v).trim() === '') {
      worksheet[arAddr] = { t: 's', v: t.ar };
      changed = true;
    }
    if (!lvCell || !lvCell.v || String(lvCell.v).trim() === '') {
      worksheet[lvAddr] = { t: 's', v: t.lv };
      changed = true;
    }

    if (changed) {
      console.log(`  Row ${r + 1}: filled "${enText}"`);
      fixed++;
    }
  }

  if (fixed === 0) {
    console.log('No missing translations found.');
    return;
  }

  XLSX.writeFile(workbook, EXCEL_FILE);
  console.log(`\nDone. Fixed ${fixed} row(s). Saved to ${EXCEL_FILE}`);
}

main();
