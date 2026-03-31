import fs from "fs";
import path from "path";
import prisma from "@/lib/prisma";
import { generateEvidenceCode } from "@/lib/evidence-utils";
import {
  getDomainForPlatform,
  formatEvidenceName,
} from "./platform-domain-map";

/** Keyword map for auto-suggesting controls by data source */
const DATA_SOURCE_KEYWORDS: Record<string, string[]> = {
  azure_entra_all_users: ["access", "user", "identity", "account", "authentication"],
  azure_entra_dormant_users: ["access", "user", "dormant", "review", "deprovisioning", "inactive"],
  azure_entra_mfa_status: ["mfa", "multi-factor", "authentication", "access control"],
  azure_entra_password_policies: ["password", "authentication", "policy", "access"],
  azure_security_defender_compliance: ["endpoint", "device", "compliance", "protection"],
  azure_security_sentinel_incidents: ["incident", "security", "monitoring", "detection"],
  azure_security_secure_score: ["security", "posture", "compliance", "control"],
  azure_security_posture: ["security", "posture", "risk", "assessment"],
  azure_security_recommendations: ["hardening", "vulnerability", "remediation"],
  azure_cspm_vulnerabilities: ["vulnerability", "patch", "cve", "security"],
  azure_cspm_inventory: ["asset", "inventory", "resource", "management"],
  azure_cspm_hardening: ["hardening", "configuration", "baseline"],
  gcp_iam_policies: ["access", "iam", "role", "permission", "identity"],
  gcp_security_findings: ["security", "finding", "vulnerability"],
  gcp_asset_inventory: ["asset", "inventory", "cloud"],
  cisco_access_rules: ["firewall", "access", "rule", "network"],
  paloalto_security_rules: ["firewall", "security", "rule", "network"],
  fortigate_firewall_policies: ["firewall", "policy", "network"],
  servicenow_incidents: ["incident", "response", "management"],
  servicenow_changes: ["change", "management", "control", "approval"],
  tenable_vulnerabilities: ["vulnerability", "patch", "scan"],
  acunetix_vulnerabilities: ["vulnerability", "web", "application"],
};

/** Auto-populate control mappings using keyword matching if none exist */
async function autoSuggestControlMappings(
  collectionId: string,
  dataSource: string,
  customerAccountId: string
): Promise<void> {
  const existing = await prisma.technicalEvidenceControlMapping.count({
    where: { collectionId },
  });
  if (existing > 0) return; // already has mappings

  const keywords = DATA_SOURCE_KEYWORDS[dataSource] || ["security", "compliance"];

  const controls = await prisma.control.findMany({
    where: { customerAccountId },
    select: { id: true, name: true, description: true, frameworkId: true },
    take: 500,
  });

  const matched = controls.filter((c) => {
    const text = `${c.name} ${c.description || ""}`.toLowerCase();
    return keywords.some((kw) => text.includes(kw));
  });

  for (const control of matched.slice(0, 10)) {
    await prisma.technicalEvidenceControlMapping.upsert({
      where: { collectionId_controlId: { collectionId, controlId: control.id } },
      create: {
        collectionId,
        controlId: control.id,
        frameworkId: control.frameworkId,
        suggestedByAI: true,
        confirmedByUser: false,
        confidenceScore: 0.6,
      },
      update: { suggestedByAI: true, confidenceScore: 0.6 },
    });
  }
}

interface PublishSession {
  id: string;
  customerAccountId?: string | null;
}

interface PublishResult {
  evidenceId: string;
  evidenceCode: string;
  created: boolean;
}

/**
 * Auto-create or update an Evidence record from a TechnicalEvidenceCollection.
 *
 * - On first call: creates a new Evidence with auto-generated code, links to controls, saves JSON attachment
 * - On subsequent calls (recollect): updates existing evidence, replaces attachment with fresh data
 */
export async function publishTechnicalEvidence(
  collectionId: string,
  session: PublishSession
): Promise<PublishResult> {
  const customerAccountId = session.customerAccountId;
  if (!customerAccountId) {
    throw new Error("Customer account ID required for publishing evidence");
  }

  // 1. Load collection with mappings and records
  const collection = await prisma.technicalEvidenceCollection.findFirst({
    where: { id: collectionId, customerAccountId },
    include: {
      controlMappings: {
        include: { control: true },
      },
      records: {
        orderBy: { collectedAt: "desc" },
      },
      autoCreatedEvidence: {
        select: { id: true, evidenceCode: true },
      },
    },
  });

  if (!collection) {
    throw new Error("Collection not found");
  }

  if (collection.lastCollectionStatus !== "success") {
    throw new Error("Collection has no successful data to publish");
  }

  // 2. Auto-suggest control mappings if none exist yet
  await autoSuggestControlMappings(collectionId, collection.dataSource, customerAccountId);

  // Reload mappings after auto-suggest
  const freshMappings = await prisma.technicalEvidenceControlMapping.findMany({
    where: { collectionId },
    include: { control: true },
  });
  collection.controlMappings = freshMappings;

  // 3. Determine control IDs — prefer confirmed, fall back to AI-suggested
  const confirmedMappings = collection.controlMappings.filter(
    (m) => m.confirmedByUser
  );
  const mappingsToUse =
    confirmedMappings.length > 0
      ? confirmedMappings
      : collection.controlMappings;
  const controlIds = mappingsToUse.map((m) => m.controlId);
  const firstFrameworkId = mappingsToUse[0]?.frameworkId || null;

  // 3. Generate CSV from collected records
  const records = collection.records.map((r) => {
    try {
      return JSON.parse(r.data);
    } catch {
      return r.data;
    }
  });
  const csvBuffer = generateCsv(records);

  // 4. Evidence name and domain
  const collectedAt = collection.lastCollectedAt || new Date();
  const evidenceName = formatEvidenceName(
    collection.displayName,
    collectedAt
  );
  const domain = getDomainForPlatform(collection.platform);
  const description = `Auto-collected from ${collection.displayName}. ${collection.recordCount} records collected on ${collectedAt.toLocaleDateString()}.`;

  // 5. Check if evidence already exists
  const existingEvidence = collection.autoCreatedEvidence;

  if (existingEvidence) {
    // === UPDATE PATH ===
    // Update the evidence record
    await prisma.evidence.update({
      where: { id: existingEvidence.id },
      data: {
        name: evidenceName,
        description,
        status: "Validated",
        updatedAt: new Date(),
      },
    });

    // Re-sync control links
    await prisma.evidenceControl.deleteMany({
      where: { evidenceId: existingEvidence.id },
    });
    if (controlIds.length > 0) {
      await prisma.evidenceControl.createMany({
        data: controlIds.map((controlId) => ({
          evidenceId: existingEvidence.id,
          controlId,
        })),
        skipDuplicates: true,
      });
    }

    // Replace attachment
    await replaceAttachment(existingEvidence.id, collection.dataSource, csvBuffer);

    return {
      evidenceId: existingEvidence.id,
      evidenceCode: existingEvidence.evidenceCode,
      created: false,
    };
  } else {
    // === CREATE PATH ===
    const evidenceCode = await generateEvidenceCode(customerAccountId);

    const evidence = await prisma.evidence.create({
      data: {
        customerAccountId,
        evidenceCode,
        name: evidenceName,
        description,
        domain,
        status: "Validated",
        recurrence: "Monthly",
        frameworkId: firstFrameworkId,
        technicalEvidenceCollectionId: collectionId,
      },
    });

    // Link controls
    if (controlIds.length > 0) {
      await prisma.evidenceControl.createMany({
        data: controlIds.map((controlId) => ({
          evidenceId: evidence.id,
          controlId,
        })),
        skipDuplicates: true,
      });
    }

    // Create attachment
    await saveAttachment(evidence.id, collection.dataSource, csvBuffer);

    return {
      evidenceId: evidence.id,
      evidenceCode,
      created: true,
    };
  }
}

/** Save collected data as a JSON attachment for the evidence */
/** Convert an array of objects to CSV buffer */
function generateCsv(records: unknown[]): Buffer {
  if (records.length === 0) return Buffer.from("No records collected\n", "utf-8");

  // Flatten nested objects one level deep
  const flatten = (obj: unknown, prefix = ""): Record<string, string> => {
    if (typeof obj !== "object" || obj === null) return { value: String(obj) };
    const result: Record<string, string> = {};
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      const colName = prefix ? `${prefix}.${key}` : key;
      if (typeof val === "object" && val !== null && !Array.isArray(val)) {
        Object.assign(result, flatten(val, colName));
      } else if (Array.isArray(val)) {
        result[colName] = val.join("; ");
      } else {
        result[colName] = val == null ? "" : String(val);
      }
    }
    return result;
  };

  const flattened = records.map((r) => flatten(r));

  // Collect all unique headers
  const headers = Array.from(new Set(flattened.flatMap((r) => Object.keys(r))));

  const escape = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const lines = [
    headers.map(escape).join(","),
    ...flattened.map((row) => headers.map((h) => escape(row[h] ?? "")).join(",")),
  ];

  return Buffer.from(lines.join("\n"), "utf-8");
}

async function saveAttachment(
  evidenceId: string,
  dataSource: string,
  csvBuffer: Buffer
): Promise<void> {
  const uploadsDir = path.join(process.cwd(), "uploads", "evidence", evidenceId);
  fs.mkdirSync(uploadsDir, { recursive: true });

  const fileName = `${dataSource}_${Date.now()}.csv`;
  const filePath = path.join(uploadsDir, fileName);
  fs.writeFileSync(filePath, csvBuffer);

  await prisma.evidenceAttachment.create({
    data: {
      evidenceId,
      fileName,
      fileType: "text/csv",
      filePath: `/uploads/evidence/${evidenceId}/${fileName}`,
      fileSize: csvBuffer.length,
    },
  });
}

/** Replace all existing attachments with fresh data */
async function replaceAttachment(
  evidenceId: string,
  dataSource: string,
  csvBuffer: Buffer
): Promise<void> {
  // Delete old auto-generated attachments (JSON files from this data source)
  const oldAttachments = await prisma.evidenceAttachment.findMany({
    where: {
      evidenceId,
      fileType: "text/csv",
    },
  });

  for (const att of oldAttachments) {
    const fullPath = path.join(process.cwd(), att.filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  await prisma.evidenceAttachment.deleteMany({
    where: {
      evidenceId,
      fileType: "text/csv",
    },
  });

  // Save new attachment
  await saveAttachment(evidenceId, dataSource, csvBuffer);
}
