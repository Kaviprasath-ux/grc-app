import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding evidence data only...");

  // Get customer account (use the first one or specify)
  const customerAccount = await prisma.customerAccount.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!customerAccount) {
    console.error("❌ No customer account found. Run the main seed first.");
    process.exit(1);
  }

  const customerAccountId = customerAccount.id;
  console.log(`📦 Using customer account: ${customerAccount.customerName} (${customerAccountId})`);

  // Get frameworks
  const frameworks = await prisma.framework.findMany({
    where: { customerAccountId },
  });

  const createdFrameworks: Record<string, string> = {};
  for (const fw of frameworks) {
    createdFrameworks[fw.name] = fw.id;
  }
  console.log(`📋 Found ${frameworks.length} frameworks`);

  // Get departments
  const departments = await prisma.department.findMany({
    where: { customerAccountId },
  });

  const createdDepts: Record<string, string> = {};
  for (const dept of departments) {
    createdDepts[dept.name] = dept.id;
  }
  console.log(`🏢 Found ${departments.length} departments`);

  // Get a user for assignment (john.doe or first available)
  let assigneeUser = await prisma.user.findFirst({
    where: { userName: "john.doe" },
  });

  if (!assigneeUser) {
    assigneeUser = await prisma.user.findFirst({
      where: { isActive: true },
    });
  }

  const assigneeId = assigneeUser?.id;
  console.log(`👤 Assignee: ${assigneeUser?.fullName || "None"}`);

  // Clear existing evidence and evidence-control links
  console.log("🧹 Clearing existing evidence data...");
  await prisma.evidenceControl.deleteMany({
    where: { evidence: { customerAccountId } },
  });
  await prisma.evidence.deleteMany({
    where: { customerAccountId },
  });
  console.log("✅ Existing evidence data cleared");

  // Create Evidence Records
  const evidences = [
    { name: "Access Control Logs", framework: "ISO 27001:2022", department: "IT Operations", status: "Pending", dueDate: "2025-01-15", description: "Monthly access control logs showing user authentication and authorization events" },
    { name: "Security Training Records", framework: "ISO 27001:2022", department: "Human Resources", status: "Submitted", dueDate: "2025-01-10", description: "Employee security awareness training completion certificates and attendance records" },
    { name: "Firewall Configuration", framework: "PCI DSS v4.0", department: "IT Operations", status: "Approved", dueDate: "2025-01-05", description: "Current firewall ruleset configuration and change history documentation" },
    { name: "Data Processing Agreement", framework: "GDPR", department: "Compliance", status: "Pending", dueDate: "2025-01-20", description: "Signed data processing agreements with all third-party processors" },
    { name: "Vulnerability Scan Report", framework: "ISO 27001:2022", department: "IT Operations", status: "Overdue", dueDate: "2024-12-15", description: "Quarterly vulnerability scan results with remediation status" },
    { name: "Backup Verification", framework: "ISO 27001:2022", department: "IT Operations", status: "Pending", dueDate: "2025-02-01", description: "Backup restoration test results and verification logs" },
    { name: "Risk Assessment Report", framework: "NIST CSF 2.0", department: "Risk Management", status: "Submitted", dueDate: "2025-01-25", description: "Annual information security risk assessment with treatment plans" },
    { name: "Incident Response Test", framework: "NIS2 Directive", department: "IT Operations", status: "Pending", dueDate: "2025-02-15", description: "Results from tabletop exercise or incident response drill" },
    { name: "SOC 2 Audit Report", framework: "SOC 2 Type II", department: "Compliance", status: "Approved", dueDate: "2025-01-30", description: "Type II SOC 2 audit report from external auditor" },
    { name: "Privacy Impact Assessment", framework: "GDPR", department: "Compliance", status: "Submitted", dueDate: "2025-02-10", description: "DPIA for new customer data processing activities" },
    { name: "Penetration Test Report", framework: "PCI DSS v4.0", department: "IT Operations", status: "Pending", dueDate: "2025-03-01", description: "External and internal penetration test findings and remediation" },
    { name: "Business Continuity Plan", framework: "ISO 27001:2022", department: "Operations", status: "Approved", dueDate: "2025-01-20", description: "Updated BCP documentation with recovery procedures" },
    { name: "Encryption Key Inventory", framework: "PCI DSS v4.0", department: "IT Operations", status: "Pending", dueDate: "2025-02-20", description: "Inventory of cryptographic keys with rotation schedule" },
    { name: "HIPAA Training Certificates", framework: "HIPAA", department: "Human Resources", status: "Submitted", dueDate: "2025-01-15", description: "HIPAA privacy and security training completion records" },
    { name: "Vendor Security Assessments", framework: "SOC 2 Type II", department: "Procurement", status: "Pending", dueDate: "2025-02-28", description: "Security questionnaires and assessments for critical vendors" },
  ];

  let evidenceIdx = 1;
  let createdCount = 0;
  for (const evidence of evidences) {
    const frameworkId = createdFrameworks[evidence.framework];
    if (frameworkId) {
      await prisma.evidence.create({
        data: {
          customerAccountId,
          evidenceCode: `EVD-${String(evidenceIdx++).padStart(3, "0")}`,
          name: evidence.name,
          description: evidence.description,
          frameworkId: frameworkId,
          departmentId: createdDepts[evidence.department] || null,
          assigneeId: assigneeId || null,
          status: evidence.status,
          dueDate: new Date(evidence.dueDate),
        },
      });
      createdCount++;
    } else {
      console.log(`⚠️  Skipping "${evidence.name}" - framework "${evidence.framework}" not found`);
    }
  }
  console.log(`✅ Evidence requests created (${createdCount} items)`);

  // Create Evidence-Control Links
  console.log("🔗 Creating Evidence-Control links...");

  const frameworksForEvidenceLinks = await prisma.framework.findMany({
    where: { customerAccountId },
    include: {
      evidences: true,
      controls: true,
    },
  });

  let evControlLinksCreated = 0;
  for (const framework of frameworksForEvidenceLinks) {
    if (framework.evidences.length === 0 || framework.controls.length === 0) continue;

    // Link each evidence to 1-3 controls from the same framework
    for (let i = 0; i < framework.evidences.length; i++) {
      const evidence = framework.evidences[i];
      const controlCount = Math.min(1 + (i % 3), framework.controls.length);

      for (let j = 0; j < controlCount; j++) {
        const controlIndex = (i + j) % framework.controls.length;
        const control = framework.controls[controlIndex];

        try {
          await prisma.evidenceControl.upsert({
            where: {
              evidenceId_controlId: {
                evidenceId: evidence.id,
                controlId: control.id,
              },
            },
            update: {},
            create: {
              evidenceId: evidence.id,
              controlId: control.id,
            },
          });
          evControlLinksCreated++;
        } catch (e) {
          // Ignore duplicate key errors
        }
      }
    }
  }
  console.log(`✅ Evidence-Control links created (${evControlLinksCreated} links)`);

  console.log("\n✨ Evidence seed completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
