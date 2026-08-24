import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import prisma from "@/lib/prisma";
import { withAuth, getCustomerAccountId } from "@/lib/api-auth";
import { validateUploadedFile } from "@/lib/upload-validation";

const FIXED_COL_COUNT = 2; // Vendor Name, Engagement ID

/**
 * POST — Import onboarding question responses for existing vendors.
 *
 * Matches question columns by title (stripping "(Yes/No)" / "(Text)" suffix).
 * Only Yes/No questions answered "Yes" contribute to VRR score.
 */
export const POST = withAuth(
  async (req, _context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const formData = await req.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }

      const check = validateUploadedFile(file);
      if (!check.ok) {
        return NextResponse.json({ error: check.reason }, { status: 400 });
      }

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames.includes("Vendor Risk Rating Questions")
        ? "Vendor Risk Rating Questions"
        : workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        return NextResponse.json({ error: "No data sheet found" }, { status: 400 });
      }

      const rawRows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" });
      if (rawRows.length < 2) {
        return NextResponse.json({ error: "No data rows found" }, { status: 400 });
      }

      const headers = rawRows[0].map((h) => String(h).trim());

      // Build vendor lookup by engagementId
      const vendors = await prisma.tPRMVendor.findMany({
        where: { customerAccountId },
        select: { id: true, vendorCode: true, engagementId: true },
      });
      const vendorByEngagement = new Map<string, string>();
      for (const v of vendors) {
        vendorByEngagement.set(v.engagementId || v.vendorCode, v.id);
        vendorByEngagement.set(v.vendorCode, v.id);
      }

      // Fetch onboarding questions
      const allQuestions = await prisma.tPRMOnboardingQuestion.findMany({
        where: { customerAccountId, isActive: true },
        select: { id: true, title: true, score: true, responseType: true },
      });
      const questionByTitle = new Map<string, { id: string; score: number; responseType: string }>();
      for (const q of allQuestions) {
        questionByTitle.set(q.title.toLowerCase().trim(), { id: q.id, score: q.score || 0, responseType: q.responseType });
      }

      // Map question columns
      const questionColMap = new Map<number, { id: string; score: number; responseType: string }>();
      for (let col = FIXED_COL_COUNT; col < headers.length; col++) {
        const raw = headers[col]
          .replace(/\s*\(Yes\/No\)\s*$/, "")
          .replace(/\s*\(Text\)\s*$/, "")
          .replace(/^\s*└\s*/, "")
          .trim();
        const match = questionByTitle.get(raw.toLowerCase());
        if (match) questionColMap.set(col, match);
      }

      // Fetch VRR config
      const config = await prisma.tPRMConfiguration.findFirst({
        where: { customerAccountId },
      });
      const vrrLevels = [
        { name: "Nominal", min: config?.vrrNominal ?? 0 },
        { name: "Low", min: config?.vrrLow ?? 20 },
        { name: "Moderate", min: config?.vrrModerate ?? 30 },
        { name: "High", min: config?.vrrHigh ?? 40 },
        { name: "Critical", min: config?.vrrCritical ?? 50 },
      ];
      function getVrrLabel(score: number): string {
        let label = "Nominal";
        for (const level of vrrLevels) {
          if (score >= level.min) label = level.name;
        }
        return label;
      }

      const results = { ratingsUpdated: 0, rowsProcessed: 0, errors: [] as string[] };

      for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        const engagementId = String(row[1] || "").trim();
        if (!engagementId) continue;

        const vendorId = vendorByEngagement.get(engagementId);
        if (!vendorId) {
          results.errors.push(`Row ${i + 1}: Vendor not found for "${engagementId}"`);
          continue;
        }

        // Calculate VRR and collect onboarding answers
        let vrrScore = 0;
        const onboardingAnswers: Record<string, string> = {};
        for (const [colIdx, qInfo] of questionColMap) {
          const cellValue = String(row[colIdx] || "").trim();
          if (cellValue) {
            onboardingAnswers[qInfo.id] = cellValue;
          }
          if (qInfo.responseType === "Yes/No") {
            const lower = cellValue.toLowerCase();
            if (lower === "yes" || lower === "true" || lower === "1") {
              vrrScore += qInfo.score;
            }
          }
        }
        const vrrLabel = getVrrLabel(vrrScore);
        const status = vrrLabel === "Nominal" ? "Inactive" : "Onboarding";

        try {
          await prisma.tPRMVendor.update({
            where: { id: vendorId },
            data: {
              vrr: vrrLabel,
              status,
              onboardingAnswers: Object.keys(onboardingAnswers).length > 0 ? JSON.stringify(onboardingAnswers) : null,
            },
          });
          results.ratingsUpdated++;
          results.rowsProcessed++;
        } catch {
          results.errors.push(`Row ${i + 1}: Failed to update vendor "${engagementId}"`);
        }
      }

      return NextResponse.json({
        success: true,
        ratingsUpdated: results.ratingsUpdated,
        rowsProcessed: results.rowsProcessed,
        totalRows: rawRows.length - 1,
        errors: results.errors,
      });
    } catch (error) {
      console.error("Error importing vendor questions:", error);
      return NextResponse.json({ error: "Failed to import responses" }, { status: 500 });
    }
  },
  { resource: "tprm.vendor-management", action: "edit" }
);
