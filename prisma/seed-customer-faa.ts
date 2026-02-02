import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Seed CustomerAdmin 'faa' with comprehensive aviation industry-relevant data
 *
 * This creates:
 * 1. CustomerAdmin user 'faa' with password '1'
 * 2. Organization profile and settings
 * 3. Departments, users, stakeholders
 * 4. Risk Settings data (all categories)
 * 5. Workflow data for all modules (Compliance, Risk, Audit, Asset)
 */

async function main() {
  console.log("🛫 Seeding Customer Account 'faa'...");

  // Hash passwords upfront
  const hashedPassword1 = await bcrypt.hash("1", 10);
  const hashedPassword123 = await bcrypt.hash("password123", 10);

  // ==================== CREATE CUSTOMER ACCOUNT ====================
  console.log("\n🏛️ Creating Customer Account...");
  const customerAccount = await prisma.customerAccount.upsert({
    where: { code: "FAA_001" },
    update: {},
    create: {
      id: "customer-account-faa",
      code: "FAA_001",
      name: "Federal Aviation Authority",
      isActive: true,
    },
  });
  const customerAccountId = customerAccount.id;
  console.log("  ✓ Customer Account ready");

  // ==================== CREATE CUSTOMERADMIN USER 'faa' ====================
  console.log("\n👤 Creating CustomerAdmin user 'faa'...");

  // Ensure CustomerAdministrator role exists
  const customerAdminRole = await prisma.role.upsert({
    where: { name: "CustomerAdministrator" },
    update: {},
    create: {
      name: "CustomerAdministrator",
      description: "Organization-level admin, manages users and settings",
      isSystem: true,
    },
  });

  // Create faa user
  const faaUser = await prisma.user.upsert({
    where: { userName: "faa" },
    update: {
      password: hashedPassword1,
      email: "admin@faa.gov",
      firstName: "FAA",
      lastName: "Administrator",
      fullName: "FAA Administrator",
      role: "CustomerAdministrator",
      customerAccountId,
    },
    create: {
      userId: "FAA-001",
      userName: "faa",
      email: "admin@faa.gov",
      password: hashedPassword1,
      firstName: "FAA",
      lastName: "Administrator",
      fullName: "FAA Administrator",
      designation: "Customer Administrator",
      role: "CustomerAdministrator",
      function: "Administration",
      customerCode: "FAA_001",
      customerAccountId,
    },
  });

  // Assign CustomerAdministrator role
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: faaUser.id,
        roleId: customerAdminRole.id,
      },
    },
    update: {},
    create: {
      userId: faaUser.id,
      roleId: customerAdminRole.id,
    },
  });
  console.log("  ✓ CustomerAdmin 'faa' created with password '1'");

  // ==================== CREATE ORGANIZATION ====================
  console.log("\n🏛️ Creating Organization...");

  const organization = await prisma.organization.upsert({
    where: { id: "org-faa" },
    update: {},
    create: {
      id: "org-faa",
      customerAccountId,
      name: "Federal Aviation Authority",
      email: "info@faa.gov",
      phone: "+1 800 322 7873",
      establishedDate: "1958-08-23",
      employeeCount: 45000,
      branchCount: 9,
      headOfficeLocation: "Washington, D.C., USA",
      headOfficeAddress: "800 Independence Avenue SW, Washington, DC 20591",
      website: "https://www.faa.gov",
      description: "The Federal Aviation Authority is responsible for regulating civil aviation, developing air traffic management systems, and ensuring the safety and security of the national airspace system.",
      vision: "To be the world leader in aerospace safety, ensuring the safest and most efficient aerospace system in the world.",
      mission: "Provide the safest, most efficient aerospace system in the world through effective regulation, certification, and oversight of aviation activities.",
      value: "Safety, Excellence, Integrity, People, Innovation",
      ceoMessage: "Our commitment to safety is unwavering. Every decision we make, every rule we implement, and every oversight action we take is guided by our mission to protect the flying public.",
      facebook: "https://facebook.com/FAA",
      youtube: "https://youtube.com/@FAANews",
      twitter: "https://twitter.com/FAANews",
      linkedin: "https://linkedin.com/company/federal-aviation-administration",
    },
  });
  console.log("  ✓ Organization created");

  // Create Branches (Regional Offices)
  await prisma.branch.deleteMany({ where: { organizationId: organization.id } });
  const branches = [
    { location: "Alaskan Region", address: "222 W. 7th Avenue, Anchorage, AK 99513" },
    { location: "Central Region", address: "901 Locust Street, Kansas City, MO 64106" },
    { location: "Eastern Region", address: "1 Aviation Plaza, Jamaica, NY 11434" },
    { location: "Great Lakes Region", address: "2300 E. Devon Ave, Des Plaines, IL 60018" },
    { location: "New England Region", address: "12 New England Executive Park, Burlington, MA 01803" },
    { location: "Northwest Mountain Region", address: "1601 Lind Avenue SW, Renton, WA 98057" },
    { location: "Southern Region", address: "1701 Columbia Avenue, College Park, GA 30337" },
    { location: "Southwest Region", address: "10101 Hillwood Parkway, Fort Worth, TX 76177" },
    { location: "Western-Pacific Region", address: "15000 Aviation Blvd, Lawndale, CA 90261" },
  ];
  for (const branch of branches) {
    await prisma.branch.create({
      data: { ...branch, organizationId: organization.id },
    });
  }
  console.log("  ✓ Regional offices created");

  // Create Data Centers
  await prisma.dataCenter.deleteMany({ where: { organizationId: organization.id } });
  const dataCenters = [
    { locationType: "On-Prem", address: "FAA Primary Data Center, Oklahoma City, OK" },
    { locationType: "On-Prem", address: "FAA Secondary Data Center, Atlantic City, NJ" },
    { locationType: "Outsourced", vendor: "AWS GovCloud (US)" },
    { locationType: "Outsourced", vendor: "Microsoft Azure Government" },
  ];
  for (const dc of dataCenters) {
    await prisma.dataCenter.create({
      data: { ...dc, organizationId: organization.id },
    });
  }
  console.log("  ✓ Data centers created");

  // Create Cloud Providers
  await prisma.cloudProvider.deleteMany({ where: { organizationId: organization.id } });
  const cloudProviders = [
    { name: "AWS GovCloud", serviceType: "IaaS" },
    { name: "Microsoft Azure Government", serviceType: "PaaS" },
    { name: "ServiceNow", serviceType: "SaaS" },
    { name: "Salesforce Government Cloud", serviceType: "SaaS" },
  ];
  for (const cp of cloudProviders) {
    await prisma.cloudProvider.create({
      data: { ...cp, organizationId: organization.id },
    });
  }
  console.log("  ✓ Cloud providers created");

  // ==================== CREATE DEPARTMENTS ====================
  console.log("\n🏢 Creating Departments...");

  const departmentData = [
    { name: "Office of the Administrator", description: "Executive leadership and strategic direction" },
    { name: "Air Traffic Organization", description: "Air traffic control and management" },
    { name: "Aviation Safety", description: "Certification, flight standards, and safety oversight" },
    { name: "Security & Hazardous Materials", description: "Aviation security and hazmat safety" },
    { name: "Airports", description: "Airport planning, engineering, and compliance" },
    { name: "Information Technology", description: "IT infrastructure and systems" },
    { name: "Finance & Management", description: "Financial operations and administration" },
    { name: "Human Resources", description: "Workforce management and development" },
    { name: "Chief Counsel", description: "Legal affairs and regulatory compliance" },
    { name: "Civil Rights", description: "Equal opportunity and civil rights" },
  ];

  const createdDepts: Record<string, string> = {};
  for (const dept of departmentData) {
    const created = await prisma.department.upsert({
      where: {
        customerAccountId_name: { customerAccountId, name: dept.name }
      },
      update: { description: dept.description },
      create: { customerAccountId, ...dept },
    });
    createdDepts[dept.name] = created.id;
  }
  console.log("  ✓ Departments created");

  // ==================== CREATE USERS ====================
  console.log("\n👥 Creating Users...");

  const users = [
    { userId: "FAA-002", userName: "sarah.safety", email: "sarah.safety@faa.gov", firstName: "Sarah", lastName: "Johnson", department: "Aviation Safety", designation: "Associate Administrator for Aviation Safety", role: "Reviewer", function: "Safety" },
    { userId: "FAA-003", userName: "mike.atc", email: "mike.atc@faa.gov", firstName: "Michael", lastName: "Chen", department: "Air Traffic Organization", designation: "Vice President, Safety & Technical Training", role: "Reviewer", function: "Operations" },
    { userId: "FAA-004", userName: "jennifer.security", email: "jennifer.security@faa.gov", firstName: "Jennifer", lastName: "Williams", department: "Security & Hazardous Materials", designation: "Associate Administrator for Security", role: "Reviewer", function: "Security" },
    { userId: "FAA-005", userName: "david.audit", email: "david.audit@faa.gov", firstName: "David", lastName: "Martinez", department: "Finance & Management", designation: "Director of Internal Audit", role: "AuditHead", function: "Audit" },
    { userId: "FAA-006", userName: "lisa.it", email: "lisa.it@faa.gov", firstName: "Lisa", lastName: "Thompson", department: "Information Technology", designation: "Chief Information Officer", role: "Contributor", function: "IT" },
    { userId: "FAA-007", userName: "james.risk", email: "james.risk@faa.gov", firstName: "James", lastName: "Davis", department: "Aviation Safety", designation: "Director of Risk Management", role: "Contributor", function: "Risk" },
    { userId: "FAA-008", userName: "maria.compliance", email: "maria.compliance@faa.gov", firstName: "Maria", lastName: "Garcia", department: "Chief Counsel", designation: "Deputy Chief Counsel for Regulations", role: "Contributor", function: "Compliance" },
    { userId: "FAA-009", userName: "robert.airports", email: "robert.airports@faa.gov", firstName: "Robert", lastName: "Wilson", department: "Airports", designation: "Director of Airport Safety", role: "Contributor", function: "Safety" },
    { userId: "FAA-010", userName: "emily.hr", email: "emily.hr@faa.gov", firstName: "Emily", lastName: "Brown", department: "Human Resources", designation: "Director of HR Operations", role: "Auditee", function: "Business" },
    { userId: "FAA-011", userName: "kevin.finance", email: "kevin.finance@faa.gov", firstName: "Kevin", lastName: "Taylor", department: "Finance & Management", designation: "Chief Financial Officer", role: "Auditee", function: "Business" },
    // Department Reviewer and Department Contributor users
    { userId: "FAA-012", userName: "dr", email: "dr@faa.gov", firstName: "Department", lastName: "Reviewer", department: "Aviation Safety", designation: "Department Reviewer", role: "DepartmentReviewer", function: "Safety" },
    { userId: "FAA-013", userName: "dc", email: "dc@faa.gov", firstName: "Department", lastName: "Contributor", department: "Aviation Safety", designation: "Department Contributor", role: "DepartmentContributor", function: "Safety" },
  ];

  const createdUsers: Record<string, string> = {};
  createdUsers["faa"] = faaUser.id;

  // Users with simple password "1" for testing
  const testUsers = ["dr", "dc"];

  for (const user of users) {
    const password = testUsers.includes(user.userName) ? hashedPassword1 : hashedPassword123;
    const created = await prisma.user.upsert({
      where: { userName: user.userName },
      update: { password },
      create: {
        userId: user.userId,
        userName: user.userName,
        email: user.email,
        password,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName} ${user.lastName}`,
        designation: user.designation,
        role: user.role,
        function: user.function,
        departmentId: createdDepts[user.department],
        customerAccountId,
      },
    });
    createdUsers[user.userName] = created.id;
  }
  console.log("  ✓ Users created");

  // ==================== ASSIGN RBAC ROLES ====================
  console.log("\n🔐 Assigning RBAC roles...");

  // Ensure DepartmentReviewer and DepartmentContributor roles exist
  const deptReviewerRole = await prisma.role.upsert({
    where: { name: "DepartmentReviewer" },
    update: {},
    create: {
      name: "DepartmentReviewer",
      description: "Reviews content within own department",
      isSystem: true,
    },
  });

  const deptContributorRole = await prisma.role.upsert({
    where: { name: "DepartmentContributor" },
    update: {},
    create: {
      name: "DepartmentContributor",
      description: "Creates/edits content within own department",
      isSystem: true,
    },
  });

  // Assign DepartmentReviewer role to dr user
  if (createdUsers["dr"]) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: createdUsers["dr"],
          roleId: deptReviewerRole.id,
        },
      },
      update: {},
      create: {
        userId: createdUsers["dr"],
        roleId: deptReviewerRole.id,
      },
    });
    console.log("  ✓ Assigned DepartmentReviewer role to dr");
  }

  // Assign DepartmentContributor role to dc user
  if (createdUsers["dc"]) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: createdUsers["dc"],
          roleId: deptContributorRole.id,
        },
      },
      update: {},
      create: {
        userId: createdUsers["dc"],
        roleId: deptContributorRole.id,
      },
    });
    console.log("  ✓ Assigned DepartmentContributor role to dc");
  }

  // ==================== RISK SETTINGS ====================
  console.log("\n⚙️ Creating Risk Settings...");

  // Create Vulnerability Categories (Customer-specific)
  const vulnerabilityCategories = [
    { name: "Technical Vulnerabilities" },
    { name: "Operational Vulnerabilities" },
    { name: "Physical Vulnerabilities" },
    { name: "Administrative Vulnerabilities" },
    { name: "Environmental Vulnerabilities" },
    { name: "Aviation-Specific Vulnerabilities" },
  ];
  const createdVulnCategories: Record<string, string> = {};

  for (const cat of vulnerabilityCategories) {
    const existing = await prisma.vulnerabilityCategory.findFirst({
      where: { name: cat.name, customerAccountId },
    });
    if (existing) {
      createdVulnCategories[cat.name] = existing.id;
    } else {
      const created = await prisma.vulnerabilityCategory.create({
        data: { ...cat, customerAccountId },
      });
      createdVulnCategories[cat.name] = created.id;
    }
  }
  console.log("  ✓ Vulnerability Categories created");

  // Create Threat Categories (Customer-specific)
  const threatCategories = [
    { name: "Cyber Threats" },
    { name: "Physical Threats" },
    { name: "Environmental Threats" },
    { name: "Human Threats" },
    { name: "Technical Threats" },
    { name: "Aviation Security Threats" },
  ];
  const createdThreatCategories: Record<string, string> = {};

  for (const cat of threatCategories) {
    const existing = await prisma.threatCategory.findFirst({
      where: { name: cat.name, customerAccountId },
    });
    if (existing) {
      createdThreatCategories[cat.name] = existing.id;
    } else {
      const created = await prisma.threatCategory.create({
        data: { ...cat, customerAccountId },
      });
      createdThreatCategories[cat.name] = created.id;
    }
  }
  console.log("  ✓ Threat Categories created");

  // Create Control Strength (Customer-specific)
  const controlStrengths = [
    { name: "None", score: 0 },
    { name: "Weak", score: 1 },
    { name: "Moderate", score: 2 },
    { name: "Strong", score: 3 },
    { name: "Very Strong", score: 4 },
  ];

  for (const cs of controlStrengths) {
    const existing = await prisma.controlStrength.findFirst({
      where: { name: cs.name, customerAccountId },
    });
    if (!existing) {
      await prisma.controlStrength.create({
        data: { ...cs, customerAccountId },
      });
    }
  }
  console.log("  ✓ Control Strengths created");

  // Create Risk Likelihood (Customer-specific)
  const riskLikelihoods = [
    { title: "Rare", score: 1, timeFrame: "Once in 10+ years", probability: "<5%" },
    { title: "Unlikely", score: 2, timeFrame: "Once in 5-10 years", probability: "5-20%" },
    { title: "Possible", score: 3, timeFrame: "Once in 2-5 years", probability: "20-50%" },
    { title: "Likely", score: 4, timeFrame: "Once in 1-2 years", probability: "50-80%" },
    { title: "Almost Certain", score: 5, timeFrame: "Within 1 year", probability: ">80%" },
  ];

  for (const likelihood of riskLikelihoods) {
    const existing = await prisma.riskLikelihood.findFirst({
      where: { title: likelihood.title, customerAccountId },
    });
    if (!existing) {
      await prisma.riskLikelihood.create({
        data: { ...likelihood, customerAccountId },
      });
    }
  }
  console.log("  ✓ Risk Likelihoods created");

  // Create Impact Categories (Customer-specific)
  const impactCategories = [
    { name: "Safety Impact" },
    { name: "Operational Impact" },
    { name: "Financial Impact" },
    { name: "Regulatory Impact" },
    { name: "Reputational Impact" },
    { name: "Public Trust Impact" },
  ];

  for (const cat of impactCategories) {
    const existing = await prisma.impactCategory.findFirst({
      where: { name: cat.name, customerAccountId },
    });
    if (!existing) {
      await prisma.impactCategory.create({
        data: { ...cat, customerAccountId },
      });
    }
  }
  console.log("  ✓ Impact Categories created");

  // Create Impact Ratings (Customer-specific)
  const impactRatings = [
    { name: "Negligible", score: 1, description: "Minimal impact on aviation safety or operations" },
    { name: "Minor", score: 2, description: "Limited impact with minor disruption to operations" },
    { name: "Moderate", score: 3, description: "Noticeable impact requiring management attention" },
    { name: "Major", score: 4, description: "Significant impact affecting aviation safety or operations" },
    { name: "Catastrophic", score: 5, description: "Severe impact with potential loss of life or major system failure" },
  ];

  for (const rating of impactRatings) {
    const existing = await prisma.impactRating.findFirst({
      where: { name: rating.name, customerAccountId },
    });
    if (!existing) {
      await prisma.impactRating.create({
        data: { ...rating, customerAccountId },
      });
    }
  }
  console.log("  ✓ Impact Ratings created");

  // Create Vulnerability Ratings (Customer-specific)
  const vulnerabilityRatings = [
    { label: "Very Low", score: 1 },
    { label: "Low", score: 2 },
    { label: "Medium", score: 3 },
    { label: "High", score: 4 },
    { label: "Critical", score: 5 },
  ];

  for (const rating of vulnerabilityRatings) {
    const existing = await prisma.vulnerabilityRating.findFirst({
      where: { label: rating.label, customerAccountId },
    });
    if (!existing) {
      await prisma.vulnerabilityRating.create({
        data: { ...rating, customerAccountId },
      });
    }
  }
  console.log("  ✓ Vulnerability Ratings created");

  // Create Risk Sub Categories (Customer-specific)
  const riskSubCategories = [
    { type: "Air Traffic Management" },
    { type: "Aircraft Certification" },
    { type: "Airport Operations" },
    { type: "Cybersecurity" },
    { type: "Data Privacy" },
    { type: "Infrastructure" },
    { type: "Human Factors" },
    { type: "Regulatory Compliance" },
    { type: "Environmental" },
    { type: "Unmanned Aircraft Systems" },
  ];

  for (const subCat of riskSubCategories) {
    const existing = await prisma.riskSubCategory.findFirst({
      where: { type: subCat.type, customerAccountId },
    });
    if (!existing) {
      await prisma.riskSubCategory.create({
        data: { ...subCat, customerAccountId },
      });
    }
  }
  console.log("  ✓ Risk Sub Categories created");

  // Create Risk Ranges (Customer-specific)
  const riskRanges = [
    { title: "Low", color: "#22c55e", lowRange: 1, highRange: 4, timelineDays: 90, description: "Low risk - monitor and manage as part of routine operations" },
    { title: "Medium", color: "#f59e0b", lowRange: 5, highRange: 9, timelineDays: 60, description: "Medium risk - requires attention and planned mitigation actions" },
    { title: "High", color: "#f97316", lowRange: 10, highRange: 16, timelineDays: 30, description: "High risk - requires priority attention and immediate action planning" },
    { title: "Critical", color: "#ef4444", lowRange: 17, highRange: 25, timelineDays: 7, description: "Critical risk - requires immediate executive attention and urgent action" },
  ];

  for (const range of riskRanges) {
    const existing = await prisma.riskRange.findFirst({
      where: { title: range.title, customerAccountId },
    });
    if (!existing) {
      await prisma.riskRange.create({
        data: { ...range, customerAccountId },
      });
    }
  }
  console.log("  ✓ Risk Ranges created");

  // Create Risk Score Config (Customer-specific)
  const existingConfig = await prisma.riskScoreConfig.findFirst({
    where: { customerAccountId },
  });
  if (!existingConfig) {
    await prisma.riskScoreConfig.create({
      data: {
        customerAccountId,
        useLikelihood: true,
        useImpact: true,
        useAssetScore: false,
        useVulnerabilityScore: false,
        riskTolerance: 10,
      },
    });
  }
  console.log("  ✓ Risk Score Config created");

  // Create Risk Categories (Customer-specific)
  const riskCategories = [
    { name: "Safety Risk", description: "Risks affecting aviation safety", color: "#ef4444", status: "Active" },
    { name: "Operational Risk", description: "Risks affecting air traffic operations", color: "#3b82f6", status: "Active" },
    { name: "Security Risk", description: "Aviation security and terrorism risks", color: "#8b5cf6", status: "Active" },
    { name: "Compliance Risk", description: "Regulatory compliance risks", color: "#f59e0b", status: "Active" },
    { name: "Cybersecurity Risk", description: "IT and cybersecurity risks", color: "#ec4899", status: "Active" },
    { name: "Environmental Risk", description: "Environmental and sustainability risks", color: "#10b981", status: "Active" },
  ];

  const createdRiskCategories: Record<string, string> = {};
  for (const cat of riskCategories) {
    const existing = await prisma.riskCategory.findFirst({
      where: { name: cat.name, customerAccountId },
    });
    if (existing) {
      createdRiskCategories[cat.name] = existing.id;
    } else {
      const created = await prisma.riskCategory.create({
        data: { ...cat, customerAccountId },
      });
      createdRiskCategories[cat.name] = created.id;
    }
  }
  console.log("  ✓ Risk Categories created");

  // Create Risk Threats (Customer-specific with categories)
  const threats = [
    { name: "Cyber Attack on ATC Systems", description: "Malicious cyber intrusion targeting air traffic control systems", category: "Cyber Threats" },
    { name: "GPS Spoofing/Jamming", description: "Interference with GPS signals affecting navigation", category: "Technical Threats" },
    { name: "Drone Incursion", description: "Unauthorized drone activity near airports or aircraft", category: "Aviation Security Threats" },
    { name: "Bird Strike", description: "Aircraft collision with birds", category: "Environmental Threats" },
    { name: "Runway Incursion", description: "Unauthorized presence on runway", category: "Physical Threats" },
    { name: "Mid-Air Collision", description: "Collision between aircraft in flight", category: "Aviation Security Threats" },
    { name: "Controlled Flight Into Terrain", description: "CFIT accident risk", category: "Technical Threats" },
    { name: "Weather-Related Hazard", description: "Severe weather impacting flight operations", category: "Environmental Threats" },
    { name: "Controller Fatigue", description: "Air traffic controller fatigue affecting performance", category: "Human Threats" },
    { name: "Equipment Failure", description: "Critical aviation equipment malfunction", category: "Technical Threats" },
    { name: "Insider Threat", description: "Malicious actions by aviation personnel", category: "Human Threats" },
    { name: "Supply Chain Attack", description: "Compromise through aviation supply chain", category: "Cyber Threats" },
    { name: "Terrorism", description: "Terrorist threat to aviation infrastructure", category: "Aviation Security Threats" },
    { name: "Laser Attack", description: "Laser strikes on aircraft cockpits", category: "Physical Threats" },
    { name: "Communication Failure", description: "Loss of communication between ATC and aircraft", category: "Technical Threats" },
  ];

  for (const threat of threats) {
    const existing = await prisma.riskThreat.findFirst({
      where: { name: threat.name, customerAccountId },
    });
    if (!existing) {
      await prisma.riskThreat.create({
        data: {
          name: threat.name,
          description: threat.description,
          categoryId: createdThreatCategories[threat.category],
          customerAccountId,
        },
      });
    }
  }
  console.log("  ✓ Risk Threats created");

  // Create Risk Vulnerabilities (Customer-specific with categories)
  const vulnerabilities = [
    { name: "Legacy ATC Systems", description: "Outdated air traffic control systems lacking modern security", category: "Technical Vulnerabilities" },
    { name: "Inadequate Cybersecurity", description: "Insufficient cybersecurity measures on critical systems", category: "Technical Vulnerabilities" },
    { name: "Staffing Shortages", description: "Insufficient air traffic controller staffing levels", category: "Operational Vulnerabilities" },
    { name: "Training Gaps", description: "Inadequate training on new systems or procedures", category: "Administrative Vulnerabilities" },
    { name: "Communication Gaps", description: "Poor communication between ATC facilities", category: "Operational Vulnerabilities" },
    { name: "Aging Infrastructure", description: "Deteriorating airport and airway infrastructure", category: "Physical Vulnerabilities" },
    { name: "Single Points of Failure", description: "Critical systems without redundancy", category: "Technical Vulnerabilities" },
    { name: "Inadequate Weather Detection", description: "Limited severe weather detection capabilities", category: "Environmental Vulnerabilities" },
    { name: "Drone Detection Gaps", description: "Limited capability to detect unauthorized drones", category: "Aviation-Specific Vulnerabilities" },
    { name: "NextGen Implementation Delays", description: "Delays in implementing NextGen technologies", category: "Technical Vulnerabilities" },
    { name: "Lack of Encryption", description: "Unencrypted aviation communications", category: "Technical Vulnerabilities" },
    { name: "Inadequate Access Controls", description: "Poor physical and logical access controls", category: "Administrative Vulnerabilities" },
    { name: "Insufficient Monitoring", description: "Lack of real-time security monitoring", category: "Operational Vulnerabilities" },
    { name: "Third-Party Dependencies", description: "Over-reliance on external vendors", category: "Operational Vulnerabilities" },
    { name: "Regulatory Compliance Gaps", description: "Gaps in meeting regulatory requirements", category: "Administrative Vulnerabilities" },
  ];

  for (const vuln of vulnerabilities) {
    const existing = await prisma.riskVulnerability.findFirst({
      where: { name: vuln.name, customerAccountId },
    });
    if (!existing) {
      await prisma.riskVulnerability.create({
        data: {
          name: vuln.name,
          description: vuln.description,
          categoryId: createdVulnCategories[vuln.category],
          customerAccountId,
        },
      });
    }
  }
  console.log("  ✓ Risk Vulnerabilities created");

  // ==================== CREATE RISKS ====================
  console.log("\n⚠️ Creating Risks...");

  const risks = [
    { id: "RSK-FAA-001", name: "ATC System Cyber Attack", description: "Risk of cyber attack compromising air traffic control systems", category: "Cybersecurity Risk", likelihood: 3, impact: 5, status: "Open" },
    { id: "RSK-FAA-002", name: "Controller Staffing Shortage", description: "Risk of inadequate ATC staffing affecting safety", category: "Operational Risk", likelihood: 4, impact: 4, status: "In Progress" },
    { id: "RSK-FAA-003", name: "NextGen Implementation Failure", description: "Risk of delays or failures in NextGen system implementation", category: "Operational Risk", likelihood: 3, impact: 4, status: "Open" },
    { id: "RSK-FAA-004", name: "Drone Collision", description: "Risk of drone collision with manned aircraft", category: "Safety Risk", likelihood: 3, impact: 5, status: "Open" },
    { id: "RSK-FAA-005", name: "GPS Vulnerability", description: "Risk of GPS spoofing or jamming affecting navigation", category: "Security Risk", likelihood: 2, impact: 5, status: "In Progress" },
    { id: "RSK-FAA-006", name: "Legacy System Failure", description: "Risk of critical legacy system failure", category: "Operational Risk", likelihood: 3, impact: 4, status: "Open" },
    { id: "RSK-FAA-007", name: "Regulatory Non-Compliance", description: "Risk of failing to meet ICAO or domestic regulations", category: "Compliance Risk", likelihood: 2, impact: 4, status: "In Progress" },
    { id: "RSK-FAA-008", name: "Airport Security Breach", description: "Risk of security breach at airports", category: "Security Risk", likelihood: 2, impact: 5, status: "Open" },
    { id: "RSK-FAA-009", name: "Weather-Related Incident", description: "Risk of severe weather causing aviation incidents", category: "Safety Risk", likelihood: 4, impact: 4, status: "Open" },
    { id: "RSK-FAA-010", name: "Data Breach", description: "Risk of sensitive aviation data being compromised", category: "Cybersecurity Risk", likelihood: 3, impact: 4, status: "Open" },
  ];

  for (const risk of risks) {
    const riskScore = risk.likelihood * risk.impact;
    let riskRating = "Low";
    if (riskScore >= 20) riskRating = "Catastrophic";
    else if (riskScore >= 15) riskRating = "Very High";
    else if (riskScore >= 10) riskRating = "High";
    else if (riskScore >= 5) riskRating = "Medium";

    await prisma.risk.upsert({
      where: {
        customerAccountId_riskId: {
          customerAccountId,
          riskId: risk.id,
        },
      },
      update: {},
      create: {
        customerAccountId,
        riskId: risk.id,
        name: risk.name,
        description: risk.description,
        categoryId: createdRiskCategories[risk.category],
        departmentId: createdDepts["Aviation Safety"],
        ownerId: createdUsers["james.risk"],
        likelihood: risk.likelihood,
        impact: risk.impact,
        riskScore: riskScore,
        riskRating: riskRating,
        status: risk.status,
        responseStrategy: "Treat",
      },
    });
  }
  console.log("  ✓ Risks created");

  // ==================== CREATE STAKEHOLDERS ====================
  console.log("\n🤝 Creating Stakeholders...");

  const stakeholders = [
    { name: "Congress - House Transportation Committee", email: "transportation@house.gov", type: "External", status: "Active" },
    { name: "National Transportation Safety Board (NTSB)", email: "public@ntsb.gov", type: "External", status: "Active" },
    { name: "Department of Homeland Security (TSA)", email: "tsa@dhs.gov", type: "External", status: "Active" },
    { name: "Aircraft Manufacturers (Boeing, Airbus)", email: "oem-liaison@faa.gov", type: "Third Party", status: "Active" },
    { name: "Airlines for America (A4A)", email: "contact@airlines.org", type: "External", status: "Active" },
    { name: "Air Line Pilots Association (ALPA)", email: "alpa@alpa.org", type: "External", status: "Active" },
    { name: "National Air Traffic Controllers Association (NATCA)", email: "natca@natca.org", type: "External", status: "Active" },
    { name: "ICAO", email: "icao@icao.int", type: "External", status: "Active" },
  ];

  for (const stakeholder of stakeholders) {
    await prisma.stakeholder.upsert({
      where: { id: `stakeholder-faa-${stakeholder.name.toLowerCase().replace(/\s+/g, '-').slice(0, 30)}` },
      update: {},
      create: {
        id: `stakeholder-faa-${stakeholder.name.toLowerCase().replace(/\s+/g, '-').slice(0, 30)}`,
        customerAccountId,
        ...stakeholder,
      },
    });
  }
  console.log("  ✓ Stakeholders created");

  // ==================== CREATE ISSUES ====================
  console.log("\n📌 Creating Issues...");

  const issues = [
    { title: "ATC System Maintenance Backlog", domain: "Internal", category: "IT", status: "Open", department: "Information Technology" },
    { title: "Runway Safety Area Non-Compliance", domain: "External", category: "Safety", status: "In Progress", department: "Airports" },
    { title: "Controller Training Certification Delays", domain: "Internal", category: "Operational", status: "Open", department: "Air Traffic Organization" },
    { title: "Cybersecurity Vulnerability Patch Pending", domain: "Internal", category: "Security", status: "In Progress", department: "Information Technology" },
    { title: "Drone Detection System Upgrade Required", domain: "External", category: "Security", status: "Pending", department: "Security & Hazardous Materials" },
  ];

  const createdIssues: Record<string, string> = {};
  for (const issue of issues) {
    const created = await prisma.issue.upsert({
      where: { id: `issue-faa-${issue.title.toLowerCase().replace(/\s+/g, '-').slice(0, 20)}` },
      update: {},
      create: {
        id: `issue-faa-${issue.title.toLowerCase().replace(/\s+/g, '-').slice(0, 20)}`,
        customerAccountId,
        title: issue.title,
        domain: issue.domain,
        category: issue.category,
        status: issue.status,
        departmentId: createdDepts[issue.department],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    createdIssues[issue.title] = created.id;
  }
  console.log("  ✓ Issues created");

  // Create Issue Actions
  const issueActions = [
    { issueTitle: "ATC System Maintenance Backlog", actionType: "Corrective", description: "Schedule emergency maintenance window", status: "Pending" },
    { issueTitle: "ATC System Maintenance Backlog", actionType: "Preventive", description: "Implement automated maintenance scheduling", status: "Pending" },
    { issueTitle: "Runway Safety Area Non-Compliance", actionType: "Corrective", description: "Conduct immediate runway assessment", status: "Resolved" },
    { issueTitle: "Cybersecurity Vulnerability Patch Pending", actionType: "Corrective", description: "Apply critical security patches", status: "Pending" },
  ];

  for (const action of issueActions) {
    const issueId = createdIssues[action.issueTitle];
    if (issueId) {
      await prisma.issueAction.create({
        data: {
          issue: { connect: { id: issueId } },
          actionType: action.actionType,
          description: action.description,
          status: action.status,
          completion: action.status === "Resolved" ? 100 : 0,
          createdBy: { connect: { id: faaUser.id } },
        },
      });
    }
  }
  console.log("  ✓ Issue Actions created");

  // ==================== CREATE PROCESSES ====================
  console.log("\n⚙️ Creating Processes...");

  const processes = [
    { code: "PRC-FAA-001", name: "Air Traffic Control Operations", type: "Primary", department: "Air Traffic Organization", frequency: "Continuous", nature: "Automated" },
    { code: "PRC-FAA-002", name: "Aircraft Certification", type: "Primary", department: "Aviation Safety", frequency: "As needed", nature: "Manual" },
    { code: "PRC-FAA-003", name: "Airport Inspection", type: "Primary", department: "Airports", frequency: "Quarterly", nature: "Manual" },
    { code: "PRC-FAA-004", name: "Security Threat Assessment", type: "Supporting", department: "Security & Hazardous Materials", frequency: "Daily", nature: "Manual + Automated" },
    { code: "PRC-FAA-005", name: "IT Change Management", type: "Supporting", department: "Information Technology", frequency: "Weekly", nature: "Manual" },
    { code: "PRC-FAA-006", name: "Incident Response", type: "Primary", department: "Aviation Safety", frequency: "As needed", nature: "Manual" },
    { code: "PRC-FAA-007", name: "Regulatory Compliance Review", type: "Supporting", department: "Chief Counsel", frequency: "Monthly", nature: "Manual" },
    { code: "PRC-FAA-008", name: "Training & Certification", type: "Supporting", department: "Human Resources", frequency: "Ongoing", nature: "Manual" },
  ];

  for (const process of processes) {
    await prisma.process.upsert({
      where: {
        customerAccountId_processCode: {
          customerAccountId,
          processCode: process.code,
        },
      },
      update: {},
      create: {
        customerAccountId,
        processCode: process.code,
        name: process.name,
        processType: process.type,
        departmentId: createdDepts[process.department],
        ownerId: createdUsers["james.risk"],
        status: "Active",
        processFrequency: process.frequency,
        natureOfImplementation: process.nature,
        riskRating: "Medium",
      },
    });
  }
  console.log("  ✓ Processes created");

  // ==================== CREATE SERVICES ====================
  console.log("\n🛠️ Creating Services...");

  const services = [
    { title: "Air Traffic Control", description: "Real-time air traffic management services", serviceUser: "External", category: "Aviation Services" },
    { title: "Flight Standards", description: "Aircraft and airmen certification services", serviceUser: "External", category: "Certification Services" },
    { title: "Airport Operations", description: "Airport safety and compliance services", serviceUser: "External", category: "Airport Services" },
    { title: "Aviation Security", description: "Security screening and threat assessment", serviceUser: "External", category: "Security Services" },
    { title: "NextGen Systems", description: "Next generation air transportation systems", serviceUser: "Internal", category: "Technology Services" },
    { title: "Employee Portal", description: "Internal employee self-service portal", serviceUser: "Internal", category: "HR Services" },
  ];

  for (const service of services) {
    await prisma.service.upsert({
      where: { id: `svc-faa-${service.title.toLowerCase().replace(/\s+/g, '-')}` },
      update: {},
      create: {
        id: `svc-faa-${service.title.toLowerCase().replace(/\s+/g, '-')}`,
        customerAccountId,
        title: service.title,
        description: service.description,
        serviceUser: service.serviceUser,
        serviceCategory: service.category,
      },
    });
  }
  console.log("  ✓ Services created");

  // ==================== CREATE POLICIES (GOVERNANCE) ====================
  console.log("\n📜 Creating Governance Documents...");

  const policies = [
    { code: "POL-FAA-001", name: "Aviation Safety Policy", type: "Policy", department: "Aviation Safety", status: "Published" },
    { code: "POL-FAA-002", name: "Information Security Policy", type: "Policy", department: "Information Technology", status: "Published" },
    { code: "POL-FAA-003", name: "Air Traffic Management Policy", type: "Policy", department: "Air Traffic Organization", status: "Published" },
    { code: "POL-FAA-004", name: "Airport Security Policy", type: "Policy", department: "Security & Hazardous Materials", status: "Published" },
    { code: "STD-FAA-001", name: "ATC Communication Standards", type: "Standard", department: "Air Traffic Organization", status: "Published" },
    { code: "STD-FAA-002", name: "Cybersecurity Standards", type: "Standard", department: "Information Technology", status: "Published" },
    { code: "PRC-FAA-001", name: "Incident Reporting Procedure", type: "Procedure", department: "Aviation Safety", status: "Published" },
    { code: "PRC-FAA-002", name: "Emergency Response Procedure", type: "Procedure", department: "Aviation Safety", status: "Draft" },
  ];

  for (const policy of policies) {
    await prisma.policy.upsert({
      where: {
        customerAccountId_code: {
          customerAccountId,
          code: policy.code,
        },
      },
      update: {},
      create: {
        customerAccountId,
        code: policy.code,
        name: policy.name,
        documentType: policy.type,
        version: "1.0",
        status: policy.status,
        departmentId: createdDepts[policy.department],
        assigneeId: createdUsers["maria.compliance"],
        approverId: createdUsers["sarah.safety"],
        effectiveDate: new Date("2024-01-01"),
        reviewDate: new Date("2025-01-01"),
      },
    });
  }
  console.log("  ✓ Governance documents created");

  // ==================== CREATE CONTROLS ====================
  console.log("\n🎛️ Creating Controls...");

  // First create control domains
  const domains = [
    { code: "ATC", name: "Air Traffic Control" },
    { code: "SEC", name: "Security Operations" },
    { code: "SAF", name: "Safety Management" },
    { code: "ITM", name: "IT Management" },
    { code: "REG", name: "Regulatory Compliance" },
  ];

  const createdDomains: Record<string, string> = {};
  for (const domain of domains) {
    const created = await prisma.controlDomain.upsert({
      where: {
        customerAccountId_name: { customerAccountId, name: domain.name }
      },
      update: { code: domain.code },
      create: { customerAccountId, ...domain },
    });
    createdDomains[domain.name] = created.id;
  }

  const controls = [
    { code: "ATC-01", name: "ATC System Monitoring", description: "24/7 monitoring of air traffic control systems", domain: "Air Traffic Control", status: "Compliant" },
    { code: "ATC-02", name: "Controller Certification", description: "Mandatory controller certification and recertification", domain: "Air Traffic Control", status: "Compliant" },
    { code: "SEC-01", name: "Airport Access Control", description: "Physical access control to secure areas", domain: "Security Operations", status: "Compliant" },
    { code: "SEC-02", name: "Threat Detection Systems", description: "Automated threat detection and screening", domain: "Security Operations", status: "Partial Compliant" },
    { code: "SAF-01", name: "Safety Reporting System", description: "Mandatory safety incident reporting", domain: "Safety Management", status: "Compliant" },
    { code: "SAF-02", name: "Risk Assessment Process", description: "Periodic aviation risk assessments", domain: "Safety Management", status: "Compliant" },
    { code: "ITM-01", name: "System Backup & Recovery", description: "Critical system backup and disaster recovery", domain: "IT Management", status: "Compliant" },
    { code: "ITM-02", name: "Cybersecurity Controls", description: "Network security and intrusion prevention", domain: "IT Management", status: "Partial Compliant" },
    { code: "REG-01", name: "ICAO Compliance", description: "Compliance with ICAO standards and practices", domain: "Regulatory Compliance", status: "Compliant" },
    { code: "REG-02", name: "Federal Regulations", description: "Compliance with federal aviation regulations", domain: "Regulatory Compliance", status: "Compliant" },
  ];

  const createdControls: Record<string, string> = {};
  for (const control of controls) {
    const created = await prisma.control.upsert({
      where: {
        customerAccountId_controlCode: {
          customerAccountId,
          controlCode: control.code,
        },
      },
      update: {
        name: control.name,
        description: control.description,
        status: control.status,
        domainId: createdDomains[control.domain],
      },
      create: {
        customerAccountId,
        controlCode: control.code,
        name: control.name,
        description: control.description,
        status: control.status,
        entities: "Organization Wide",
        domainId: createdDomains[control.domain],
        ownerId: createdUsers["sarah.safety"],
      },
    });
    createdControls[control.code] = created.id;
  }
  console.log("  ✓ Controls created");

  // ==================== CREATE EVIDENCE ====================
  console.log("\n📄 Creating Evidence...");

  const evidences = [
    { code: "EVD-FAA-001", name: "ATC System Uptime Report", description: "Monthly ATC system availability report", domain: "IT Management", recurrence: "Monthly", controlCode: "ITM-01" },
    { code: "EVD-FAA-002", name: "Controller Certification Records", description: "Controller training and certification records", domain: "Air Traffic Control", recurrence: "Yearly", controlCode: "ATC-02" },
    { code: "EVD-FAA-003", name: "Security Audit Report", description: "Quarterly security assessment report", domain: "Security Operations", recurrence: "Quarterly", controlCode: "SEC-01" },
    { code: "EVD-FAA-004", name: "Safety Incident Log", description: "Safety incident reports and analysis", domain: "Safety Management", recurrence: "Monthly", controlCode: "SAF-01" },
    { code: "EVD-FAA-005", name: "Vulnerability Scan Results", description: "IT vulnerability assessment results", domain: "IT Management", recurrence: "Monthly", controlCode: "ITM-02" },
    { code: "EVD-FAA-006", name: "ICAO Compliance Checklist", description: "ICAO standards compliance documentation", domain: "Regulatory Compliance", recurrence: "Yearly", controlCode: "REG-01" },
  ];

  for (const evidence of evidences) {
    await prisma.evidence.upsert({
      where: {
        customerAccountId_evidenceCode: {
          customerAccountId,
          evidenceCode: evidence.code,
        },
      },
      update: {},
      create: {
        customerAccountId,
        evidenceCode: evidence.code,
        name: evidence.name,
        description: evidence.description,
        domain: evidence.domain,
        recurrence: evidence.recurrence,
        status: "Not Uploaded",
        controlId: createdControls[evidence.controlCode],
        departmentId: createdDepts["Aviation Safety"],
        assigneeId: createdUsers["maria.compliance"],
      },
    });
  }
  console.log("  ✓ Evidence created");

  // ==================== CREATE AUDITS ====================
  console.log("\n🔍 Creating Audits...");

  const audits = [
    { id: "AUD-FAA-001", name: "Annual Safety Management Audit", type: "Internal", department: "Aviation Safety", status: "Completed" },
    { id: "AUD-FAA-002", name: "IT Security Assessment", type: "Internal", department: "Information Technology", status: "In Progress" },
    { id: "AUD-FAA-003", name: "ATC Operations Review", type: "Internal", department: "Air Traffic Organization", status: "Planned" },
    { id: "AUD-FAA-004", name: "ICAO Compliance Audit", type: "External", department: "Chief Counsel", status: "Planned" },
  ];

  for (const audit of audits) {
    await prisma.audit.upsert({
      where: {
        customerAccountId_auditId: {
          customerAccountId,
          auditId: audit.id,
        },
      },
      update: {},
      create: {
        customerAccountId,
        auditId: audit.id,
        name: audit.name,
        auditType: audit.type,
        departmentId: createdDepts[audit.department],
        auditorId: createdUsers["david.audit"],
        status: audit.status,
        startDate: new Date("2024-01-15"),
        endDate: audit.status === "Completed" ? new Date("2024-03-15") : null,
      },
    });
  }
  console.log("  ✓ Audits created");

  // ==================== CREATE KPIs ====================
  console.log("\n📊 Creating KPIs...");

  const kpis = [
    { code: "KPI-FAA-001", objective: "ATC System Availability", description: "Percentage uptime of air traffic control systems", expectedScore: 99.9, actualScore: 99.7, status: "Achieved" },
    { code: "KPI-FAA-002", objective: "Controller Certification Rate", description: "Percentage of controllers with current certification", expectedScore: 100, actualScore: 98, status: "Achieved" },
    { code: "KPI-FAA-003", objective: "Security Incident Response Time", description: "Average time to respond to security incidents", expectedScore: 100, actualScore: 95, status: "Achieved" },
    { code: "KPI-FAA-004", objective: "Safety Report Processing", description: "Safety reports processed within SLA", expectedScore: 95, actualScore: 88, status: "Missed" },
    { code: "KPI-FAA-005", objective: "Regulatory Compliance Score", description: "Overall regulatory compliance percentage", expectedScore: 100, actualScore: 97, status: "Achieved" },
  ];

  for (const kpi of kpis) {
    await prisma.kPI.upsert({
      where: {
        customerAccountId_code: {
          customerAccountId,
          code: kpi.code,
        },
      },
      update: {},
      create: {
        customerAccountId,
        code: kpi.code,
        objective: kpi.objective,
        description: kpi.description,
        expectedScore: kpi.expectedScore,
        actualScore: kpi.actualScore,
        status: kpi.status,
        reviewDate: new Date(),
        departmentId: createdDepts["Aviation Safety"],
      },
    });
  }
  console.log("  ✓ KPIs created");

  console.log("\n🎉 Customer Account 'faa' seeding complete!");
  console.log("\n   Login Credentials:");
  console.log("   Username: faa");
  console.log("   Password: 1");
  console.log("   Role: CustomerAdministrator");
  console.log("\n   Test Users:");
  console.log("   Username: dr (DepartmentReviewer) / Password: 1");
  console.log("   Username: dc (DepartmentContributor) / Password: 1");
}

main()
  .catch((e) => {
    console.error("Error seeding FAA customer data:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
