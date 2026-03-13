import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { withAuth, getCustomerAccountId } from "@/lib/api-auth";
import { checkVendorLimit } from "@/lib/tprm-subscription";

const FIXED_COL_COUNT = 7; // Vendor Name through Vendor URL

/**
 * POST — Import vendors from the combined template.
 *
 * Row 1 = headers (fixed cols + question titles with "(Yes/No)" or "(Text)" suffix).
 * Row 2+ = data.
 *
 * Maps question columns back to TPRMOnboardingQuestion by matching the title
 * from the header (stripping the suffix). Only Yes/No questions contribute to VRR score.
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

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames.includes("Vendor Import")
        ? "Vendor Import"
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

      // Fetch all onboarding questions for this customer (flat)
      const allQuestions = await prisma.tPRMOnboardingQuestion.findMany({
        where: { customerAccountId, isActive: true },
        select: { id: true, title: true, score: true, responseType: true },
      });

      // Build title → question map (for matching header columns to questions)
      const questionByTitle = new Map<string, { id: string; score: number; responseType: string }>();
      for (const q of allQuestions) {
        questionByTitle.set(q.title.toLowerCase().trim(), { id: q.id, score: q.score || 0, responseType: q.responseType });
      }

      // Map question columns: colIndex → question info
      const questionColMap = new Map<number, { id: string; score: number; responseType: string }>();
      for (let col = FIXED_COL_COUNT; col < headers.length; col++) {
        // Strip suffix like " (Yes/No)" or " (Text)" or "  └ " prefix
        const raw = headers[col]
          .replace(/\s*\(Yes\/No\)\s*$/, "")
          .replace(/\s*\(Text\)\s*$/, "")
          .replace(/^\s*└\s*/, "")
          .trim();
        const match = questionByTitle.get(raw.toLowerCase());
        if (match) {
          questionColMap.set(col, match);
        }
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

      // Pre-fetch existing vendors for code generation
      const allVendors = await prisma.tPRMVendor.findMany({
        where: { customerAccountId },
        select: { vendorCode: true, engagementId: true, name: true },
      });
      const vendorNameToBaseCode = new Map<string, string>();
      let maxCodeNum = 0;
      for (const v of allVendors) {
        const base = v.vendorCode.split(".")[0];
        const match = base.match(/^VEN(\d+)$/);
        if (match) {
          const num = parseInt(match[1]);
          if (num > maxCodeNum) maxCodeNum = num;
        }
        vendorNameToBaseCode.set(v.name.toLowerCase(), base);
      }
      const baseCodeEngagements = new Map<string, number>();
      for (const v of allVendors) {
        const base = v.vendorCode.split(".")[0];
        const eid = v.engagementId || v.vendorCode;
        const parts = eid.split(".");
        const num = parts.length > 1 ? parseInt(parts[parts.length - 1]) : 0;
        if (!isNaN(num)) baseCodeEngagements.set(base, Math.max(baseCodeEngagements.get(base) || 0, num));
      }

      const createdAMs = new Map<string, string>();
      const results = { created: 0, skipped: 0, amCreated: 0, errors: [] as string[] };

      // Process data rows (starting from row index 1)
      for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        const vendorName = String(row[0] || "").trim();
        if (!vendorName) { results.skipped++; continue; }

        // Check vendor limit
        const vendorCheck = await checkVendorLimit(customerAccountId);
        if (!vendorCheck.allowed) {
          results.errors.push(`Row ${i + 1}: Vendor limit reached — ${vendorCheck.message}`);
          break;
        }

        // Generate vendor code
        let baseCode = vendorNameToBaseCode.get(vendorName.toLowerCase());
        if (!baseCode) {
          maxCodeNum++;
          baseCode = `VEN${String(maxCodeNum).padStart(3, "0")}`;
          vendorNameToBaseCode.set(vendorName.toLowerCase(), baseCode);
        }
        const engNum = (baseCodeEngagements.get(baseCode) || 0) + 1;
        baseCodeEngagements.set(baseCode, engNum);
        const fullVendorCode = `${baseCode}.${engNum}`;

        const amName = String(row[1] || "").trim();
        const amEmail = String(row[2] || "").trim();
        const contactPhone = String(row[3] || "").trim();
        const serviceCategory = String(row[4] || "").trim();
        const serviceDescription = String(row[5] || "").trim();
        const vendorUrl = String(row[6] || "").trim();

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
          await prisma.tPRMVendor.create({
            data: {
              customerAccountId,
              vendorCode: fullVendorCode,
              engagementId: fullVendorCode,
              name: vendorName,
              accountManagerName: amName || null,
              accountManagerEmail: amEmail || null,
              contactPhone: contactPhone || null,
              serviceCategory: serviceCategory || null,
              serviceDescription: serviceDescription || null,
              vendorUrl: vendorUrl || null,
              vrr: vrrLabel,
              status,
              onboardingAnswers: Object.keys(onboardingAnswers).length > 0 ? JSON.stringify(onboardingAnswers) : null,
            },
          });
          results.created++;

          // Auto-create Account Manager user
          if (amEmail && amName && !createdAMs.has(amEmail.toLowerCase())) {
            const existingUser = await prisma.user.findFirst({
              where: { customerAccountId, email: { equals: amEmail, mode: "insensitive" } },
            });
            if (!existingUser) {
              try {
                const hashedPw = await bcrypt.hash("Baarez@2025", 10);
                const nameParts = amName.split(" ");
                const userId = `AM_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                const user = await prisma.user.create({
                  data: {
                    userId,
                    customerAccountId,
                    fullName: amName,
                    firstName: nameParts[0] || amName,
                    lastName: nameParts.slice(1).join(" ") || amName,
                    email: amEmail,
                    userName: amEmail.split("@")[0] + "_am",
                    password: hashedPw,
                    tprmRole: "Account Manager",
                    tprmFunctionCategory: "TPRM Team",
                    isActive: true,
                  },
                });
                const amRole = await prisma.role.upsert({
                  where: { name: "AccountManager" },
                  update: {},
                  create: { name: "AccountManager", description: "TPRM Account Manager role", isSystem: true },
                });
                await prisma.userRole.create({ data: { userId: user.id, roleId: amRole.id } });
                createdAMs.set(amEmail.toLowerCase(), user.id);
                results.amCreated++;
              } catch { /* non-fatal */ }
            } else {
              createdAMs.set(amEmail.toLowerCase(), existingUser.id);
            }
          }
        } catch (err) {
          results.errors.push(`Row ${i + 1} "${vendorName}": ${err instanceof Error ? err.message : "Unknown error"}`);
          results.skipped++;
        }
      }

      return NextResponse.json({
        success: true,
        created: results.created,
        amCreated: results.amCreated,
        skipped: results.skipped,
        totalRows: rawRows.length - 1,
        errors: results.errors,
      });
    } catch (error) {
      console.error("Error importing vendors:", error);
      return NextResponse.json({ error: "Failed to import vendors" }, { status: 500 });
    }
  },
  { resource: "tprm.vendor-management", action: "create" }
);
