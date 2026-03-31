import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import aiApiClient from "@/lib/ai-api-client";
import { AI_ENDPOINTS } from "@/lib/ai-endpoints";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST - AI suggests which controls this technical evidence maps to
export const POST = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);
      const customerAccountId = getCustomerAccountId(session);

      // Fetch the collection with sample records
      const collection = await prisma.technicalEvidenceCollection.findFirst({
        where: { id, ...tenantFilter },
        include: {
          records: { take: 5, orderBy: { collectedAt: "desc" } },
        },
      });

      if (!collection) {
        return NextResponse.json({ error: "Collection not found" }, { status: 404 });
      }

      if (collection.records.length === 0) {
        return NextResponse.json(
          { error: "No records collected yet. Collect data first." },
          { status: 400 }
        );
      }

      // Fetch all controls for this tenant
      const controls = await prisma.control.findMany({
        where: { customerAccountId },
        select: {
          id: true,
          controlCode: true,
          name: true,
          description: true,
          frameworkId: true,
          framework: { select: { id: true, name: true } },
        },
        take: 500,
      });

      if (controls.length === 0) {
        return NextResponse.json(
          { error: "No controls found. Create controls first." },
          { status: 400 }
        );
      }

      // Parse sample records
      const sampleData = collection.records.map((r) => {
        try {
          return JSON.parse(r.data);
        } catch {
          return r.data;
        }
      });

      // Build AI prompt
      const prompt = `You are a GRC compliance expert. Given the following technical evidence collected from an integration platform, suggest which compliance controls it maps to.

EVIDENCE SOURCE: ${collection.displayName}
PLATFORM: ${collection.platform}
DATA SOURCE: ${collection.dataSource}
DESCRIPTION: ${collection.description || "N/A"}

SAMPLE RECORDS (${collection.recordCount} total):
${JSON.stringify(sampleData.slice(0, 3), null, 2).slice(0, 2000)}

AVAILABLE CONTROLS:
${controls.map((c) => `- ${c.controlCode}: ${c.name} (Framework: ${c.framework?.name || "N/A"})`).join("\n").slice(0, 3000)}

Return a JSON array of suggested mappings. Each item should have:
- controlCode: the control code from the list above
- reason: brief explanation of why this evidence maps to this control
- confidence: a number between 0 and 1 indicating confidence

Only suggest controls that are genuinely relevant. Return at most 10 suggestions.
Respond ONLY with the JSON array, no other text.`;

      try {
        // Try using the AI backend
        const aiResponse = await aiApiClient.post(AI_ENDPOINTS.SIMPLE_QUERY, {
          query: prompt,
          customer_id: customerAccountId,
        });

        let suggestions: { controlCode: string; reason: string; confidence: number }[] = [];

        // Parse AI response
        const responseText = typeof aiResponse === "string"
          ? aiResponse
          : (aiResponse as Record<string, unknown>)?.answer ||
            (aiResponse as Record<string, unknown>)?.response ||
            JSON.stringify(aiResponse);

        try {
          // Try to extract JSON array from response
          const jsonMatch = String(responseText).match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            suggestions = JSON.parse(jsonMatch[0]);
          }
        } catch {
          // If parsing fails, return empty suggestions
          suggestions = [];
        }

        // Create mappings for valid suggestions
        let created = 0;
        for (const suggestion of suggestions) {
          const control = controls.find((c) => c.controlCode === suggestion.controlCode);
          if (!control) continue;

          // Upsert to avoid duplicates
          await prisma.technicalEvidenceControlMapping.upsert({
            where: {
              collectionId_controlId: {
                collectionId: id,
                controlId: control.id,
              },
            },
            create: {
              collectionId: id,
              controlId: control.id,
              frameworkId: control.frameworkId,
              suggestedByAI: true,
              confirmedByUser: false,
              confidenceScore: suggestion.confidence || 0.5,
            },
            update: {
              suggestedByAI: true,
              confidenceScore: suggestion.confidence || 0.5,
            },
          });
          created++;
        }

        return NextResponse.json({
          data: {
            suggestionsCount: created,
            suggestions: suggestions.slice(0, 10),
          },
          message: `AI suggested ${created} control mappings`,
        });
      } catch (aiError) {
        // If AI backend is unavailable, do keyword-based matching as fallback
        console.error("AI suggestion failed, using keyword fallback:", aiError);

        const keywords = getKeywordsForDataSource(collection.dataSource);
        const matched = controls.filter((c) => {
          const text = `${c.name} ${c.description || ""}`.toLowerCase();
          return keywords.some((kw) => text.includes(kw));
        });

        let created = 0;
        for (const control of matched.slice(0, 10)) {
          await prisma.technicalEvidenceControlMapping.upsert({
            where: {
              collectionId_controlId: {
                collectionId: id,
                controlId: control.id,
              },
            },
            create: {
              collectionId: id,
              controlId: control.id,
              frameworkId: control.frameworkId,
              suggestedByAI: true,
              confirmedByUser: false,
              confidenceScore: 0.6,
            },
            update: {
              suggestedByAI: true,
              confidenceScore: 0.6,
            },
          });
          created++;
        }

        return NextResponse.json({
          data: {
            suggestionsCount: created,
            fallback: true,
          },
          message: `Keyword-based matching suggested ${created} control mappings`,
        });
      }
    } catch (error) {
      console.error("Error in AI suggest:", error);
      return NextResponse.json(
        { error: "Failed to generate AI suggestions" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.technical-evidence", action: "edit" }
);

/** Map data source types to relevant compliance keywords */
function getKeywordsForDataSource(dataSource: string): string[] {
  const keywordMap: Record<string, string[]> = {
    azure_entra_all_users: ["access", "user", "identity", "account", "authentication"],
    azure_entra_dormant_users: ["access", "user", "dormant", "review", "deprovisioning", "inactive"],
    azure_entra_mfa_status: ["mfa", "multi-factor", "authentication", "access control"],
    azure_entra_password_policies: ["password", "authentication", "policy", "access"],
    azure_security_defender_compliance: ["endpoint", "device", "compliance", "protection"],
    azure_security_sentinel_incidents: ["incident", "security", "monitoring", "detection", "event"],
    azure_security_secure_score: ["security", "posture", "compliance", "control"],
    azure_security_posture: ["security", "posture", "risk", "assessment"],
    azure_security_recommendations: ["hardening", "vulnerability", "remediation", "security"],
    azure_cspm_vulnerabilities: ["vulnerability", "patch", "cve", "security"],
    azure_cspm_inventory: ["asset", "inventory", "resource", "management"],
    azure_cspm_hardening: ["hardening", "configuration", "baseline", "security"],
    gcp_security_findings: ["security", "finding", "vulnerability", "threat"],
    gcp_asset_inventory: ["asset", "inventory", "resource", "cloud"],
    gcp_iam_policies: ["access", "iam", "role", "permission", "identity"],
    gcp_service_accounts: ["service account", "access", "identity", "privilege"],
    cisco_running_config: ["firewall", "network", "configuration", "security"],
    cisco_access_rules: ["firewall", "access", "rule", "network", "filter"],
    paloalto_security_rules: ["firewall", "security", "rule", "network"],
    paloalto_threat_logs: ["threat", "detection", "network", "security"],
    fortigate_firewall_policies: ["firewall", "policy", "network", "security"],
    fortigate_security_events: ["security", "event", "detection", "network"],
    servicenow_incidents: ["incident", "response", "management", "security"],
    servicenow_changes: ["change", "management", "control", "approval"],
    tenable_vulnerabilities: ["vulnerability", "patch", "scan", "assessment"],
    tenable_scans: ["vulnerability", "scan", "assessment", "security"],
    acunetix_vulnerabilities: ["vulnerability", "web", "application", "security"],
    acunetix_scans: ["vulnerability", "scan", "web", "application"],
  };

  return keywordMap[dataSource] || ["security", "compliance"];
}
