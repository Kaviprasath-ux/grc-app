import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding requirements data...");

  // First, get the ISO 27001:2022 framework
  const framework = await prisma.framework.findFirst({
    where: { name: "ISO 27001:2022" },
  });

  if (!framework) {
    console.log("❌ ISO 27001:2022 framework not found. Please run main seed first.");
    return;
  }

  console.log(`✅ Found framework: ${framework.name} (${framework.id})`);

  // Create/Get Requirement Categories for ISO 27001
  const categories = [
    { code: "4", name: "Context of the Organization", description: "Understanding the organization and its context, needs and expectations of interested parties", sortOrder: 1 },
    { code: "5", name: "Leadership", description: "Leadership and commitment, policy, organizational roles, responsibilities and authorities", sortOrder: 2 },
    { code: "6", name: "Planning", description: "Actions to address risks and opportunities, information security objectives", sortOrder: 3 },
    { code: "7", name: "Support", description: "Resources, competence, awareness, communication, documented information", sortOrder: 4 },
    { code: "8", name: "Operation", description: "Operational planning and control, information security risk assessment and treatment", sortOrder: 5 },
    { code: "9", name: "Performance Evaluation", description: "Monitoring, measurement, analysis, evaluation, internal audit, management review", sortOrder: 6 },
    { code: "10", name: "Improvement", description: "Nonconformity and corrective action, continual improvement", sortOrder: 7 },
  ];

  const categoryIds: { [key: string]: string } = {};

  for (const cat of categories) {
    const created = await prisma.requirementCategory.upsert({
      where: {
        frameworkId_name: { frameworkId: framework.id, name: cat.name }
      },
      update: { code: cat.code, description: cat.description, sortOrder: cat.sortOrder },
      create: {
        code: cat.code,
        name: cat.name,
        description: cat.description,
        sortOrder: cat.sortOrder,
        frameworkId: framework.id,
      },
    });
    categoryIds[cat.code] = created.id;
  }
  console.log("✅ Requirement categories created/updated");

  // ISO 27001:2022 Requirements - Complete set based on the standard
  const requirements = [
    // Clause 4 - Context of the Organization
    { categoryCode: "4", code: "4.1", name: "Understanding the organization and its context", description: "The organization shall determine external and internal issues that are relevant to its purpose and that affect its ability to achieve the intended outcome(s) of its information security management system.", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { categoryCode: "4", code: "4.2", name: "Understanding the needs and expectations of interested parties", description: "The organization shall determine interested parties that are relevant to the information security management system and their requirements relevant to information security.", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },
    { categoryCode: "4", code: "4.3", name: "Determining the scope of the information security management system", description: "The organization shall determine the boundaries and applicability of the information security management system to establish its scope.", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { categoryCode: "4", code: "4.4", name: "Information security management system", description: "The organization shall establish, implement, maintain and continually improve an information security management system, in accordance with the requirements of this document.", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },

    // Clause 5 - Leadership
    { categoryCode: "5", code: "5.1", name: "Leadership and commitment", description: "Top management shall demonstrate leadership and commitment with respect to the information security management system by ensuring policies and objectives are established and compatible with strategic direction.", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { categoryCode: "5", code: "5.2", name: "Policy", description: "Top management shall establish an information security policy that is appropriate to the purpose of the organization, includes commitment to continual improvement, and provides framework for setting objectives.", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { categoryCode: "5", code: "5.3", name: "Organizational roles, responsibilities and authorities", description: "Top management shall ensure that the responsibilities and authorities for roles relevant to information security are assigned and communicated within the organization.", compliance: "Non Compliant", applicability: "Yes", implementation: "No" },

    // Clause 6 - Planning
    { categoryCode: "6", code: "6.1", name: "Actions to address risks and opportunities", description: "When planning for the information security management system, the organization shall consider the issues and requirements and determine the risks and opportunities that need to be addressed.", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },
    { categoryCode: "6", code: "6.1.1", name: "General risk planning", description: "The organization shall plan actions to address risks and opportunities to ensure the ISMS can achieve intended outcomes and prevent undesired effects.", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },
    { categoryCode: "6", code: "6.1.2", name: "Information security risk assessment", description: "The organization shall define and apply an information security risk assessment process that establishes and maintains risk criteria.", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },
    { categoryCode: "6", code: "6.1.3", name: "Information security risk treatment", description: "The organization shall define and apply an information security risk treatment process to select appropriate risk treatment options.", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },
    { categoryCode: "6", code: "6.2", name: "Information security objectives and planning to achieve them", description: "The organization shall establish information security objectives at relevant functions and levels. The objectives shall be measurable, monitored, communicated, and updated.", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { categoryCode: "6", code: "6.3", name: "Planning of changes", description: "When the organization determines the need for changes to the information security management system, the changes shall be carried out in a planned manner.", compliance: "Non Compliant", applicability: "Yes", implementation: "No" },

    // Clause 7 - Support
    { categoryCode: "7", code: "7.1", name: "Resources", description: "The organization shall determine and provide the resources needed for the establishment, implementation, maintenance and continual improvement of the information security management system.", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { categoryCode: "7", code: "7.2", name: "Competence", description: "The organization shall determine the necessary competence of person(s) doing work under its control that affects its information security performance, and ensure these persons are competent.", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },
    { categoryCode: "7", code: "7.3", name: "Awareness", description: "Persons doing work under the organization's control shall be aware of the information security policy, their contribution to ISMS effectiveness, and implications of not conforming.", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { categoryCode: "7", code: "7.4", name: "Communication", description: "The organization shall determine the need for internal and external communications relevant to the information security management system including what, when, with whom, and how to communicate.", compliance: "Non Compliant", applicability: "Yes", implementation: "No" },
    { categoryCode: "7", code: "7.5", name: "Documented information", description: "The organization's information security management system shall include documented information required by this document and determined by the organization as being necessary for effectiveness.", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },
    { categoryCode: "7", code: "7.5.1", name: "General documentation requirements", description: "The ISMS documentation shall include documented information required by this document and that determined by the organization as necessary.", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },
    { categoryCode: "7", code: "7.5.2", name: "Creating and updating", description: "When creating and updating documented information, the organization shall ensure appropriate identification, format, and review and approval for suitability.", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { categoryCode: "7", code: "7.5.3", name: "Control of documented information", description: "Documented information shall be controlled to ensure it is available and suitable for use, and adequately protected from loss of confidentiality, improper use, or loss of integrity.", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },

    // Clause 8 - Operation
    { categoryCode: "8", code: "8.1", name: "Operational planning and control", description: "The organization shall plan, implement and control the processes needed to meet information security requirements, and to implement the actions determined in clause 6.", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { categoryCode: "8", code: "8.2", name: "Information security risk assessment", description: "The organization shall perform information security risk assessments at planned intervals or when significant changes are proposed or occur, taking account of established criteria.", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },
    { categoryCode: "8", code: "8.3", name: "Information security risk treatment", description: "The organization shall implement the information security risk treatment plan and retain documented information of the results of the risk treatment.", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },

    // Clause 9 - Performance Evaluation
    { categoryCode: "9", code: "9.1", name: "Monitoring, measurement, analysis and evaluation", description: "The organization shall determine what needs to be monitored and measured, including information security processes and controls, and the methods for monitoring and measurement.", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },
    { categoryCode: "9", code: "9.2", name: "Internal audit", description: "The organization shall conduct internal audits at planned intervals to provide information on whether the ISMS conforms to requirements and is effectively implemented and maintained.", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { categoryCode: "9", code: "9.2.1", name: "Internal audit program", description: "The organization shall plan, establish, implement and maintain audit programmes, including frequency, methods, responsibilities, planning requirements and reporting.", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { categoryCode: "9", code: "9.2.2", name: "Internal audit execution", description: "The organization shall define audit criteria and scope for each audit, select auditors to ensure objectivity, ensure results are reported to relevant management.", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { categoryCode: "9", code: "9.3", name: "Management review", description: "Top management shall review the organization's information security management system at planned intervals to ensure its continuing suitability, adequacy and effectiveness.", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { categoryCode: "9", code: "9.3.1", name: "Management review inputs", description: "The management review shall be planned and carried out taking into consideration status of actions, changes in external and internal issues, and feedback on performance.", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
    { categoryCode: "9", code: "9.3.2", name: "Management review outputs", description: "The outputs of the management review shall include decisions related to continual improvement opportunities and any needs for changes to the ISMS.", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },

    // Clause 10 - Improvement
    { categoryCode: "10", code: "10.1", name: "Continual improvement", description: "The organization shall continually improve the suitability, adequacy and effectiveness of the information security management system.", compliance: "Partial Compliant", applicability: "Yes", implementation: "Ongoing" },
    { categoryCode: "10", code: "10.2", name: "Nonconformity and corrective action", description: "When a nonconformity occurs, the organization shall react to the nonconformity, take action to control and correct it, and deal with the consequences.", compliance: "Compliant", applicability: "Yes", implementation: "Yes" },
  ];

  // Create requirements
  let reqCount = 0;
  for (const req of requirements) {
    const categoryId = categoryIds[req.categoryCode];
    if (categoryId) {
      await prisma.requirement.upsert({
        where: {
          frameworkId_code: { frameworkId: framework.id, code: req.code }
        },
        update: {
          name: req.name,
          description: req.description,
          controlCompliance: req.compliance,
          applicability: req.applicability,
          implementationStatus: req.implementation,
        },
        create: {
          code: req.code,
          name: req.name,
          description: req.description,
          controlCompliance: req.compliance,
          applicability: req.applicability,
          implementationStatus: req.implementation,
          categoryId: categoryId,
          frameworkId: framework.id,
        },
      });
      reqCount++;
    }
  }

  console.log(`✅ Created/updated ${reqCount} requirements for ISO 27001:2022`);

  // Get some controls to link to requirements
  const controls = await prisma.control.findMany({ take: 20 });

  if (controls.length > 0) {
    // Get requirement 4.1
    const req41 = await prisma.requirement.findFirst({
      where: { frameworkId: framework.id, code: "4.1" }
    });

    if (req41) {
      // Link some controls to requirement 4.1
      for (let i = 0; i < Math.min(4, controls.length); i++) {
        await prisma.requirementControl.upsert({
          where: {
            requirementId_controlId: {
              requirementId: req41.id,
              controlId: controls[i].id,
            }
          },
          update: {},
          create: {
            requirementId: req41.id,
            controlId: controls[i].id,
          }
        });
      }
      console.log(`✅ Linked ${Math.min(4, controls.length)} controls to requirement 4.1`);
    }

    // Link controls to other requirements
    const reqCodes = ["5.1", "6.1", "7.3", "8.1", "9.2"];
    for (let j = 0; j < reqCodes.length && j + 4 < controls.length; j++) {
      const req = await prisma.requirement.findFirst({
        where: { frameworkId: framework.id, code: reqCodes[j] }
      });
      if (req) {
        await prisma.requirementControl.upsert({
          where: {
            requirementId_controlId: {
              requirementId: req.id,
              controlId: controls[j + 4].id,
            }
          },
          update: {},
          create: {
            requirementId: req.id,
            controlId: controls[j + 4].id,
          }
        });
      }
    }
    console.log("✅ Linked additional controls to requirements");
  }

  console.log("\n🎉 Requirements seeding completed successfully!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
