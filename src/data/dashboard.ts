// Dashboard stats
export const dashboardStats = {
  departments: 11,
  stakeholders: 7,
  regulations: 5,
  issues: 8,
  risks: 92,
  exceptions: 5,
};

// Overall Compliance Status data
export const complianceData = [
  { framework: "Latvia...", compliant: 0, nonCompliant: 100 },
  { framework: "latvia...", compliant: 0, nonCompliant: 100 },
  { framework: "GDPR", compliant: 35, nonCompliant: 65 },
  { framework: "EU Directive", compliant: 42, nonCompliant: 58 },
  { framework: "ISO 27001", compliant: 58, nonCompliant: 42 },
  { framework: "PCI DSS", compliant: 25, nonCompliant: 75 },
  { framework: "NIS Directive", compliant: 30, nonCompliant: 70 },
  { framework: "EBA Outsourcing", compliant: 45, nonCompliant: 55 },
  { framework: "Labour Law", compliant: 60, nonCompliant: 40 },
];

// Risk Assessment Overview
export const riskAssessmentData = [
  { category: "Low Risk", total: 17, closed: 5 },
  { category: "High", total: 45, closed: 12 },
  { category: "Very High", total: 25, closed: 8 },
  { category: "Catastrophic", total: 5, closed: 2 },
];

// Issue By Category
export const issueByCategoryData = [
  { name: "Finance", value: 3, color: "#146FF4" },
  { name: "Human Resources", value: 2, color: "#22C55E" },
  { name: "Data breach", value: 3, color: "#EF4444" },
];

// Issue By Department
export const issueByDepartmentData = [
  { name: "Revenue", value: 1, color: "#146FF4" },
  { name: "IT Operations", value: 4, color: "#22C55E" },
  { name: "Product Development", value: 1, color: "#F59E0B" },
];

// Issue By Domain
export const issueByDomainData = [
  { name: "Internal", value: 2, color: "#146FF4" },
  { name: "External", value: 1, color: "#22C55E" },
  { name: "IT", value: 4, color: "#EF4444" },
  { name: "GRC", value: 1, color: "#F59E0B" },
];

// Exception by Type
export const exceptionByTypeData = [
  { name: "Compliance", value: 0, color: "#146FF4" },
  { name: "Policy", value: 2, color: "#22C55E" },
  { name: "Control", value: 2, color: "#EF4444" },
];

// Evidence KPI by Department
export const evidenceKPIData = [
  { department: "IT Operations", overdue: 10, achieved: 30, missed: 5, scheduled: 55 },
  { department: "Compliance", overdue: 5, achieved: 45, missed: 10, scheduled: 40 },
  { department: "Human Resources", overdue: 15, achieved: 25, missed: 20, scheduled: 40 },
  { department: "Revenue", overdue: 8, achieved: 40, missed: 12, scheduled: 40 },
];

// Process KPI by Department
export const processKPIData = [
  { department: "IT Operations", overdue: 8, achieved: 35, missed: 7, scheduled: 50 },
  { department: "Compliance", overdue: 3, achieved: 50, missed: 7, scheduled: 40 },
  { department: "Human Resources", overdue: 12, achieved: 28, missed: 15, scheduled: 45 },
  { department: "Revenue", overdue: 5, achieved: 42, missed: 8, scheduled: 45 },
];

// Governance Status
export const governanceStatusData = [
  { type: "Policy", notUploaded: 50, draft: 100, approved: 200, needsReview: 80, published: 170 },
  { type: "Procedure", notUploaded: 30, draft: 80, approved: 150, needsReview: 60, published: 120 },
  { type: "Standard", notUploaded: 20, draft: 60, approved: 100, needsReview: 40, published: 80 },
];

// Exception Status
export const exceptionStatusData = [
  { type: "Control", pending: 1, approved: 0, authorized: 1, closed: 0, overdue: 0 },
  { type: "Compliance", pending: 0, approved: 0, authorized: 0, closed: 0, overdue: 0 },
  { type: "Policy", pending: 1, approved: 1, authorized: 0, closed: 0, overdue: 0 },
];
