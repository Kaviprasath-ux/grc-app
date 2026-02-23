import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

// Sample artifact content templates
const sampleArtifacts = [
  {
    name: "Access Control Logs Q4 2024",
    fileName: "access_control_logs_q4_2024.txt",
    fileType: "txt",
    content: `ACCESS CONTROL LOGS - Q4 2024
=====================================

Date: October 1, 2024 - December 31, 2024
System: Enterprise Authentication System v3.2
Report Generated: January 5, 2025

SUMMARY
-------
Total Login Attempts: 45,892
Successful Logins: 44,156 (96.2%)
Failed Logins: 1,736 (3.8%)
Unique Users: 1,234
MFA Enforced: Yes (100%)

SECURITY EVENTS
---------------
1. Password resets requested: 234
2. Account lockouts: 89
3. Suspicious login attempts blocked: 156
4. After-hours access: 2,341 (authorized)

COMPLIANCE STATUS
-----------------
- All access logged with timestamps
- User ID and IP recorded for each session
- Session timeout: 30 minutes idle
- Password policy enforced: 12+ chars, complexity required

This log demonstrates compliance with access control requirements
for ISO 27001:2022 Control A.9.2 User Access Management.
`,
  },
  {
    name: "Security Training Report 2024",
    fileName: "security_training_report_2024.txt",
    fileType: "txt",
    content: `SECURITY AWARENESS TRAINING REPORT
===================================

Training Period: January 2024 - December 2024
Organization: Sample Corporation
Department: Human Resources

TRAINING COMPLETION SUMMARY
---------------------------
Total Employees: 1,500
Training Completed: 1,485 (99%)
Training Pending: 15 (1%)
Average Score: 87.5%

MODULES COMPLETED
-----------------
1. Phishing Awareness - 100% completion
2. Password Security - 100% completion
3. Data Classification - 98% completion
4. Incident Reporting - 99% completion
5. Social Engineering - 97% completion
6. Remote Work Security - 100% completion

ASSESSMENT RESULTS
------------------
- Passing Score Required: 80%
- Employees Passed: 1,456 (98%)
- Employees Requiring Retraining: 29 (2%)

PHISHING SIMULATION RESULTS
---------------------------
- Simulations Sent: 4,500
- Clicks on Phishing Links: 180 (4%)
- Reports to Security Team: 3,420 (76%)

This report provides evidence of security awareness training
compliance with ISO 27001:2022 and NIST CSF requirements.
`,
  },
  {
    name: "Firewall Configuration Jan 2025",
    fileName: "firewall_config_jan2025.txt",
    fileType: "txt",
    content: `FIREWALL CONFIGURATION AUDIT
============================

System: Palo Alto PA-5220
Audit Date: January 10, 2025
Auditor: Security Operations Team

CONFIGURATION SUMMARY
---------------------
- Default Deny Policy: ENABLED
- Logging: ALL traffic logged
- IPS/IDS: Active with latest signatures
- SSL Inspection: Enabled for outbound traffic

SECURITY ZONES
--------------
1. DMZ - Web servers, limited access
2. Internal - Corporate network, restricted
3. Guest - Isolated guest WiFi
4. Management - Admin access only

RULE AUDIT HIGHLIGHTS
---------------------
Total Rules: 234
Active Rules: 198
Disabled Rules: 36 (scheduled removal)
Last Review: January 5, 2025

COMPLIANCE NOTES
----------------
- No "any-any" rules detected
- All rules have business justification documented
- Change management process followed for all modifications
- Quarterly review completed

This configuration audit demonstrates compliance with
PCI DSS v4.0 Requirement 1 - Network Security Controls.
`,
  },
  {
    name: "Incident Response Drill Report",
    fileName: "ir_drill_report_dec2024.txt",
    fileType: "txt",
    content: `INCIDENT RESPONSE DRILL REPORT
==============================

Exercise Name: Operation Cyber Shield
Date: December 15, 2024
Duration: 4 hours
Participants: 28

SCENARIO
--------
Simulated ransomware attack targeting file servers
with lateral movement to domain controllers.

OBJECTIVES
----------
1. Test detection capabilities
2. Validate communication protocols
3. Assess containment procedures
4. Verify recovery processes

TIMELINE
--------
10:00 - Attack simulation initiated
10:15 - SOC detected anomalous behavior
10:22 - Incident declared, IRT assembled
10:45 - Source identified and contained
11:30 - Affected systems isolated
12:00 - Recovery procedures initiated
14:00 - Systems restored from backup

RESULTS
-------
- Detection Time: 15 minutes (Target: <30 min) PASSED
- Response Time: 7 minutes (Target: <15 min) PASSED
- Containment: 23 minutes (Target: <60 min) PASSED
- Recovery: 2.5 hours (Target: <4 hours) PASSED

LESSONS LEARNED
---------------
1. Improve backup verification frequency
2. Update contact list for external forensics
3. Enhance network segmentation

This drill report provides evidence of incident response
capability testing per ISO 27001 and NIS2 requirements.
`,
  },
  {
    name: "Vulnerability Scan Report Q4",
    fileName: "vulnerability_scan_q4_2024.txt",
    fileType: "txt",
    content: `VULNERABILITY ASSESSMENT REPORT
===============================

Scan Period: Q4 2024 (October - December)
Scanner: Qualys Vulnerability Management
Scope: All production systems

EXECUTIVE SUMMARY
-----------------
Total Assets Scanned: 2,456
Critical Vulnerabilities: 0
High Vulnerabilities: 12 (all remediated)
Medium Vulnerabilities: 45
Low Vulnerabilities: 156

REMEDIATION STATUS
------------------
Critical: 0/0 - N/A
High: 12/12 - 100% remediated within SLA
Medium: 38/45 - 84% remediated
Low: 89/156 - 57% remediated (ongoing)

SLA COMPLIANCE
--------------
- Critical: 24 hours - COMPLIANT
- High: 7 days - COMPLIANT
- Medium: 30 days - ON TRACK
- Low: 90 days - ON TRACK

TOP VULNERABILITIES FOUND
-------------------------
1. CVE-2024-XXXX - Apache Log4j - PATCHED
2. CVE-2024-YYYY - OpenSSL - PATCHED
3. CVE-2024-ZZZZ - Microsoft Exchange - PATCHED

TRENDING ANALYSIS
-----------------
- 23% reduction in high vulnerabilities vs Q3
- Patch compliance improved from 89% to 96%
- Mean time to remediate: 4.2 days

This report provides evidence of vulnerability management
compliance with ISO 27001, PCI DSS, and SOC 2 requirements.
`,
  },
];

async function main() {
  console.log("🌱 Seeding artifact data...\n");

  // Get customer account
  const customerAccount = await prisma.customerAccount.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!customerAccount) {
    console.error("❌ No customer account found. Run the main seed first.");
    process.exit(1);
  }

  const customerAccountId = customerAccount.id;
  console.log(`📦 Using customer account: ${customerAccount.customerName}`);

  // Get a user for uploadedById
  const uploaderUser = await prisma.user.findFirst({
    where: {
      customerAccountId,
      isActive: true,
    },
  });

  if (!uploaderUser) {
    console.error("❌ No active user found.");
    process.exit(1);
  }
  console.log(`👤 Uploader: ${uploaderUser.fullName}`);

  // Create uploads directory with customer isolation
  const uploadDir = path.join(process.cwd(), "uploads", "artifacts", customerAccountId);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log(`📁 Created directory: ${uploadDir}`);
  }

  // Clear existing artifacts for this customer
  console.log("\n🧹 Clearing existing artifacts...");

  // Delete evidence-artifact links first
  await prisma.evidenceArtifact.deleteMany({
    where: { artifact: { customerAccountId } },
  });

  // Delete artifacts
  await prisma.artifact.deleteMany({
    where: { customerAccountId },
  });
  console.log("✅ Existing artifacts cleared\n");

  // Create artifacts
  console.log("📄 Creating sample artifacts...");
  const createdArtifacts: { id: string; name: string }[] = [];

  for (let i = 0; i < sampleArtifacts.length; i++) {
    const artifact = sampleArtifacts[i];
    const timestamp = Date.now() + i;
    const baseName = path.basename(artifact.fileName, `.${artifact.fileType}`);
    const storedFileName = `${baseName}_${timestamp}.${artifact.fileType}`;
    const filePath = path.join(uploadDir, storedFileName);

    // Write file to disk
    fs.writeFileSync(filePath, artifact.content);
    console.log(`  ✓ Created file: ${storedFileName}`);

    // Create database record
    const artifactRecord = await prisma.artifact.create({
      data: {
        customerAccountId,
        artifactCode: `ART-${String(i + 1).padStart(3, "0")}`,
        name: artifact.name,
        fileName: artifact.fileName,
        fileType: artifact.fileType,
        fileSize: Buffer.byteLength(artifact.content),
        filePath: `/uploads/artifacts/${customerAccountId}/${storedFileName}`,
        uploadedById: uploaderUser.id,
        uploadedBy: uploaderUser.fullName,
      },
    });

    createdArtifacts.push({ id: artifactRecord.id, name: artifact.name });
    console.log(`  ✓ Created record: ${artifactRecord.artifactCode} - ${artifact.name}`);
  }

  console.log(`\n✅ Created ${createdArtifacts.length} artifacts\n`);

  // Link artifacts to evidences
  console.log("🔗 Linking artifacts to evidences...");

  const evidences = await prisma.evidence.findMany({
    where: { customerAccountId },
    take: 5,
    orderBy: { createdAt: "asc" },
  });

  if (evidences.length === 0) {
    console.log("⚠️  No evidences found to link artifacts to.");
  } else {
    let linksCreated = 0;
    for (let i = 0; i < Math.min(createdArtifacts.length, evidences.length); i++) {
      const artifact = createdArtifacts[i];
      const evidence = evidences[i];

      await prisma.evidenceArtifact.create({
        data: {
          artifactId: artifact.id,
          evidenceId: evidence.id,
        },
      });

      console.log(`  ✓ Linked "${artifact.name}" → ${evidence.evidenceCode}`);
      linksCreated++;
    }
    console.log(`\n✅ Created ${linksCreated} evidence-artifact links`);
  }

  console.log("\n✨ Artifact seed completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
