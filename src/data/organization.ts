// Organization Profile
export const organizationProfile = {
  name: "Baarez Technology Solutions-2",
  establishedDate: "09/08/2017",
  employeeCount: 80,
  branchCount: 2,
  headOfficeLocation: "Doha, Qatar-1",
  headOfficeAddress: "Office No.15, 2nd Floor, Building no. 226, Street No 230, C-Ring Road",
  website: "www.baarez.com",
  description: "Founded in 2017, Baarez Technology Solutions is a leading technology company specializing in GRC solutions and digital transformation services.",
  vision: "To become the preferred Technology partner for organizations seeking innovative GRC solutions.",
  mission: "At Baarez Technology Solutions, we are committed to delivering cutting-edge technology solutions that help organizations manage their governance, risk, and compliance needs effectively.",
};

// Services
export const services = [
  {
    id: "1",
    title: "GRC Consulting",
    description: "Comprehensive GRC consulting services",
    serviceUser: "External",
    serviceCategory: "consulting",
    serviceItem: "Advisory",
  },
  {
    id: "2",
    title: "Technology Solutions",
    description: "Custom technology solutions for enterprise",
    serviceUser: "External",
    serviceCategory: "Telecom",
    serviceItem: "Internet",
  },
  {
    id: "3",
    title: "Internal Training",
    description: "Employee training and development programs",
    serviceUser: "Internal",
    serviceCategory: "consulting",
    serviceItem: "Advisory",
  },
];

// Departments
export const departments = [
  { id: "1", name: "Human Resources" },
  { id: "2", name: "Revenue" },
  { id: "3", name: "IT Operations" },
  { id: "4", name: "IT Support" },
  { id: "5", name: "Product Development" },
  { id: "6", name: "Compliance" },
  { id: "7", name: "Procurement" },
  { id: "8", name: "Operations" },
  { id: "9", name: "Risk Management" },
  { id: "10", name: "Quality Assurance" },
  { id: "11", name: "Internal Audit" },
];

// Regulations/Frameworks
export const regulations = [
  { id: "1", name: "ISO 27001-2022", status: "Subscribed" },
  { id: "2", name: "GDPR", status: "Subscribed" },
  { id: "3", name: "PCI DSS", status: "Subscribed" },
  { id: "4", name: "NIS Directive", status: "Subscribed" },
  { id: "5", name: "EBA Outsourcing Guidelines", status: "Subscribed" },
];

// Stakeholders
export const stakeholders = [
  { id: "1", name: "John Smith", email: "john.smith@example.com", status: "Active", type: "Internal" },
  { id: "2", name: "Sarah Johnson", email: "sarah.j@partner.com", status: "Active", type: "External" },
  { id: "3", name: "Mike Williams", email: "mike.w@vendor.com", status: "Active", type: "Third Party" },
  { id: "4", name: "Emily Davis", email: "emily.d@baarez.com", status: "Active", type: "Internal" },
  { id: "5", name: "Robert Brown", email: "robert.b@consultant.com", status: "Active", type: "External" },
  { id: "6", name: "Jennifer Wilson", email: "jennifer.w@baarez.com", status: "Inactive", type: "Internal" },
  { id: "7", name: "David Taylor", email: "david.t@partner.com", status: "Active", type: "Third Party" },
];

// Issues
export const issues = [
  {
    id: "1",
    title: "Data Privacy Compliance Gap",
    department: "IT Operations",
    domain: "IT",
    category: "Data breach",
    dueDate: "2025-03-15",
    status: "Open"
  },
  {
    id: "2",
    title: "Employee Training Delay",
    department: "Human Resources",
    domain: "Internal",
    category: "Human Resources",
    dueDate: "2025-02-28",
    status: "In Progress"
  },
  {
    id: "3",
    title: "Budget Allocation Issue",
    department: "Revenue",
    domain: "Internal",
    category: "Finance",
    dueDate: "2025-04-01",
    status: "Open"
  },
  {
    id: "4",
    title: "Third-Party Vendor Risk",
    department: "Procurement",
    domain: "External",
    category: "Finance",
    dueDate: "2025-03-20",
    status: "Pending"
  },
  {
    id: "5",
    title: "System Downtime Incident",
    department: "IT Operations",
    domain: "IT",
    category: "Data breach",
    dueDate: "2025-02-15",
    status: "Resolved"
  },
  {
    id: "6",
    title: "Access Control Weakness",
    department: "IT Operations",
    domain: "IT",
    category: "Data breach",
    dueDate: "2025-03-30",
    status: "Open"
  },
  {
    id: "7",
    title: "Policy Update Required",
    department: "Compliance",
    domain: "GRC",
    category: "Finance",
    dueDate: "2025-04-15",
    status: "In Progress"
  },
  {
    id: "8",
    title: "Recruitment Process Delay",
    department: "Human Resources",
    domain: "Internal",
    category: "Human Resources",
    dueDate: "2025-03-10",
    status: "Open"
  },
];

// Users
export const users = [
  {
    id: "1",
    userName: "bts.admin",
    fullName: "BTS Admin",
    department: "IT Operations",
    designation: "System Administrator",
    status: "Active",
    role: "Administrator",
    email: "admin@baarez.com"
  },
  {
    id: "2",
    userName: "john.doe",
    fullName: "John Doe",
    department: "Compliance",
    designation: "Compliance Manager",
    status: "Active",
    role: "GRC Admin",
    email: "john.doe@baarez.com"
  },
  {
    id: "3",
    userName: "sarah.smith",
    fullName: "Sarah Smith",
    department: "Internal Audit",
    designation: "Lead Auditor",
    status: "Active",
    role: "Auditor",
    email: "sarah.smith@baarez.com"
  },
  {
    id: "4",
    userName: "mike.wilson",
    fullName: "Mike Wilson",
    department: "Risk Management",
    designation: "Risk Analyst",
    status: "Active",
    role: "Risk Manager",
    email: "mike.wilson@baarez.com"
  },
  {
    id: "5",
    userName: "emily.brown",
    fullName: "Emily Brown",
    department: "Human Resources",
    designation: "HR Manager",
    status: "Active",
    role: "User",
    email: "emily.brown@baarez.com"
  },
  {
    id: "6",
    userName: "david.jones",
    fullName: "David Jones",
    department: "IT Support",
    designation: "Support Specialist",
    status: "Active",
    role: "User",
    email: "david.jones@baarez.com"
  },
  {
    id: "7",
    userName: "lisa.taylor",
    fullName: "Lisa Taylor",
    department: "Product Development",
    designation: "Product Manager",
    status: "Active",
    role: "User",
    email: "lisa.taylor@baarez.com"
  },
  {
    id: "8",
    userName: "james.anderson",
    fullName: "James Anderson",
    department: "Revenue",
    designation: "Sales Director",
    status: "Active",
    role: "User",
    email: "james.anderson@baarez.com"
  },
  {
    id: "9",
    userName: "amy.clark",
    fullName: "Amy Clark",
    department: "Internal Audit",
    designation: "Auditor",
    status: "Active",
    role: "Auditor",
    email: "amy.clark@baarez.com"
  },
  {
    id: "10",
    userName: "robert.harris",
    fullName: "Robert Harris",
    department: "Compliance",
    designation: "Compliance Officer",
    status: "Inactive",
    role: "Compliance Officer",
    email: "robert.harris@baarez.com"
  },
  {
    id: "11",
    userName: "jennifer.martin",
    fullName: "Jennifer Martin",
    department: "IT Operations",
    designation: "DevOps Engineer",
    status: "Active",
    role: "User",
    email: "jennifer.martin@baarez.com"
  },
  {
    id: "12",
    userName: "chris.lee",
    fullName: "Chris Lee",
    department: "IT Operations",
    designation: "Security Analyst",
    status: "Active",
    role: "User",
    email: "chris.lee@baarez.com"
  },
];

// Dropdown options
export const stakeholderTypes = ["Internal", "External", "Third Party"];
export const stakeholderStatuses = ["Active", "Inactive"];
export const issueDomains = ["Internal", "External", "IT", "GRC"];
export const issueCategories = ["Finance", "Human Resources", "Data breach"];
export const issueStatuses = ["Open", "In Progress", "Pending", "Resolved", "Closed"];
export const userRoles = ["User", "Administrator", "GRC Admin", "Auditor", "Risk Manager", "Compliance Officer"];
