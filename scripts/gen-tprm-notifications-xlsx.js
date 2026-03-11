const XLSX = require("xlsx-js-style");

const data = [
  ["#", "Category", "Notification Event", "Trigger Action", "Recipient(s)", "Message Template", "Priority", "Delivery Channel", "Link", "Source File", "Status"],

  // ===== USER & ACCOUNT MANAGEMENT =====
  [1, "User Management", "TPRM Account Created", "New TPRM user created via User Management", "The newly created user", "Your TPRM account has been created with role: {tprmRole}.", "Normal", "In-app + Email", "-", "api/tprm/user-management/route.ts", "Active"],
  [2, "User Management", "RM Account Created", "Relationship Manager user created", "GRCAdministrator, CustomerAdministrator, Business Owner users", "A new Relationship Manager account has been created for {rmName} ({rmEmail}).", "Normal", "In-app + Email", "-", "api/tprm/user-management/route.ts", "Active"],
  [3, "User Management", "SME Account Created", "Account Manager creates an SME user", "The newly created SME user", "Your TPRM account has been created with role: SME.", "Normal", "In-app + Email", "-", "api/tprm/am-sme-management/route.ts", "Active"],

  // ===== VENDOR MANAGEMENT =====
  [4, "Vendor Management", "Vendor Onboarded", "New vendor created via Vendor Management", "Vendor's Account Manager (if assigned and active)", "Vendor {vendorCode}: {vendorName} has been onboarded.", "Normal", "In-app + Email", "/tprm/bo-inventory", "api/tprm/vendors/route.ts", "Active"],
  [5, "Vendor Management", "Vendor Offboarding", "Vendor status changed to Offboarding / Offboarded / Inactive", "Vendor's Account Manager (if assigned and active)", "Vendor offboarding process has started for {vendorCode}: {vendorName}.", "HIGH", "In-app + Email", "/tprm/bo-inventory", "api/tprm/vendors/[id]/route.ts", "Active"],

  // ===== ASSESSMENT LIFECYCLE =====
  [6, "Assessment", "Assessment Initiated", "New assessment created for a vendor", "Account Manager (auto-created or assigned)", "A new assessment {assessmentCode} has been initiated for vendor {vendorName}.", "Normal", "In-app + Email", "/tprm/am-assessments/{id}", "api/tprm/assessments/route.ts", "Active"],
  [7, "Assessment", "Assessment Assigned", "Assessment assigned to an assessor", "The assigned assessor", "Assessment {assessmentCode} for vendor {vendorName} has been assigned to you.", "Normal", "In-app + Email", "/tprm/asr-assessments/{id}", "api/tprm/asr-assessments/[id]/assign/route.ts", "Active"],
  [8, "Assessment", "Assessment Reassigned", "Assessment reassigned to a different assessor", "The previous assessor", "Assessment {assessmentCode} has been reassigned to {newAssessorName}.", "Normal", "In-app + Email", "/tprm/asr-assessments", "api/tprm/asr-assessments/[id]/assign/route.ts", "Active"],
  [9, "Assessment", "Assessment Submitted", "AM / Vendor submits assessment for review", "Assigned assessor + Assessment initiator (if different)", "Assessment {assessmentCode} for vendor {vendorName} has been submitted for your review.", "Normal", "In-app + Email", "/tprm/asr-assessments/{id}", "api/tprm/am-assessments/[id]/submit/route.ts", "Active"],
  [10, "Assessment", "Assessment Sent to Approver", "Assessor sends assessment to approver for final review", "The assigned approver", "Assessment {assessmentCode} for vendor {vendorName} is ready for your approval.", "Normal", "In-app + Email", "/tprm/asr-assessments/{id}", "api/tprm/asr-assessments/[id]/complete/route.ts", "Not Implemented"],
  [11, "Assessment", "Assessment Completed (Reviewed)", "Assessor marks assessment as Reviewed", "Assessment initiator + Account Manager", "Assessment {assessmentCode} for vendor {vendorName} has been reviewed.", "Normal", "In-app + Email", "/tprm/am-assessments/{id}", "api/tprm/asr-assessments/[id]/complete/route.ts", "Active"],
  [12, "Assessment", "Assessment Approved", "Approver approves the assessment", "Assessment initiator + Account Manager + Assessor", "Assessment {assessmentCode} for vendor {vendorName} has been approved.", "Normal", "In-app + Email", "/tprm/am-assessments/{id}", "api/tprm/asr-assessments/[id]/complete/route.ts", "Not Implemented"],
  [13, "Assessment", "Assessment Returned (by Assessor)", "Assessor returns assessment to AM for rework", "Assessment initiator + Account Manager", "Assessment {assessmentCode} for vendor {vendorName} has been returned. Reason: {comment}", "HIGH", "In-app + Email", "/tprm/am-assessments/{id}", "api/tprm/asr-assessments/[id]/complete/route.ts", "Active"],
  [14, "Assessment", "Assessment Returned (by Approver)", "Approver returns assessment to assessor for rework", "Assessor + Assessment initiator + Account Manager", "Assessment {assessmentCode} for vendor {vendorName} has been returned by approver. Reason: {comment}", "HIGH", "In-app + Email", "/tprm/asr-assessments/{id}", "api/tprm/asr-assessments/[id]/complete/route.ts", "Active"],

  // ===== ASSESSMENT COLLABORATION =====
  [15, "Assessment", "Clarification Requested", "Assessor requests clarification on an assessment question", "Vendor's Account Manager", "Assessor has requested clarification on assessment {assessmentCode}: {comment}", "Normal", "In-app + Email", "/tprm/am-assessments/{id}", "api/tprm/asr-assessments/[id]/clarification/route.ts", "Active"],
  [16, "Assessment", "Clarification Responded", "Account Manager responds to a clarification request", "The assessor who requested clarification", "Account Manager has responded to your clarification on assessment {assessmentCode}.", "Normal", "In-app + Email", "/tprm/asr-assessments/{id}", "-", "Not Implemented"],
  [17, "Assessment", "Comment Added", "Comment added on an assessment", "Assessor + Assessment initiator (excluding the commenter)", "New comment on assessment {assessmentCode}: {commentPreview}", "Normal", "In-app + Email", "/tprm/asr-assessments/{id}", "api/tprm/asr-assessments/[id]/comments/route.ts", "Active"],
  [18, "Assessment", "Override Applied", "Assessor overrides AI evaluation on a question", "Assessment initiator (if different from the assessor)", "Assessor overrode AI evaluation on assessment {assessmentCode}: {status}", "Normal", "In-app + Email", "/tprm/asr-assessments/{id}", "api/tprm/asr-assessments/[id]/override/route.ts", "Active"],

  // ===== REMEDIATION WORKFLOW =====
  [19, "Remediation", "Remediation Created", "Approver approves assessment with unsatisfactory items, auto-creating remediations", "Account Manager + Business Owner", "Remediation items have been created for assessment {assessmentCode} ({count} issues).", "HIGH", "In-app + Email", "/tprm/am-follow-ups", "api/tprm/asr-assessments/[id]/complete/route.ts", "Not Implemented"],
  [20, "Remediation", "Remediation Assigned (to AM)", "Assessor assigns remediation to Account Manager for vendor response", "Account Manager", "Remediation for {vendorName} - {questionTitle} has been assigned to you for vendor response.", "Normal", "In-app + Email", "/tprm/am-follow-ups", "api/tprm/asr-follow-ups/route.ts", "Not Implemented"],
  [21, "Remediation", "Remediation Submitted (AM Response)", "Account Manager submits vendor's remediation response", "Assessor + Business Owner", "Account Manager has submitted remediation response for {vendorName}: {questionTitle}.", "Normal", "In-app + Email", "/tprm/asr-follow-ups", "api/tprm/am-follow-ups/issue-remediations/route.ts", "Not Implemented"],
  [22, "Remediation", "Remediation Marked Satisfactory", "Assessor marks remediation as satisfactory/resolved", "Account Manager + Business Owner", "Remediation for {vendorName} - {questionTitle} has been marked as Satisfactory.", "Normal", "In-app + Email", "/tprm/am-follow-ups", "api/tprm/asr-follow-ups/route.ts", "Not Implemented"],
  [23, "Remediation", "Remediation Marked Unsatisfactory", "Assessor marks remediation as unsatisfactory", "Account Manager + Business Owner", "Remediation for {vendorName} - {questionTitle} has been marked as Unsatisfactory. Further action required.", "HIGH", "In-app + Email", "/tprm/am-follow-ups", "api/tprm/asr-follow-ups/route.ts", "Not Implemented"],
  [24, "Remediation", "Remediation Sent to Business", "Assessor sends remediation to Business Owner for review", "Business Owner", "Remediation for {vendorName} - {questionTitle} has been sent to you for business review.", "Normal", "In-app + Email", "/tprm/bo-follow-ups", "api/tprm/asr-follow-ups/route.ts", "Not Implemented"],
  [25, "Remediation", "Remediation Reassigned to IT/RM", "Assessor reassigns remediation to IT team or Relationship Manager", "The assigned IT/RM user", "Remediation for {vendorName} - {questionTitle} has been reassigned to you.", "Normal", "In-app + Email", "/tprm/rm-issues", "api/tprm/asr-follow-ups/route.ts", "Not Implemented"],
  [26, "Remediation", "IT Remediation Submitted", "IT/RM submits their remediation response", "Assessor + Business Owner", "IT/RM has submitted remediation response for {vendorName}: {questionTitle}.", "Normal", "In-app + Email", "/tprm/asr-follow-ups", "api/tprm/rm-issues/route.ts", "Not Implemented"],
  [27, "Remediation", "IT Remediation Approved", "Assessor approves IT team's remediation", "IT/RM user + Business Owner", "IT remediation for {vendorName} - {questionTitle} has been approved.", "Normal", "In-app + Email", "/tprm/rm-issues", "api/tprm/asr-follow-ups/route.ts", "Not Implemented"],
  [28, "Remediation", "IT Remediation Returned", "Assessor returns IT remediation for rework", "IT/RM user", "IT remediation for {vendorName} - {questionTitle} has been returned. Please revise and resubmit.", "HIGH", "In-app + Email", "/tprm/rm-issues", "api/tprm/asr-follow-ups/route.ts", "Not Implemented"],
  [29, "Remediation", "Remediation Overdue", "Remediation due date has passed without resolution", "Account Manager + Assessor + Business Owner", "Remediation for {vendorName} - {questionTitle} is overdue. Due date: {dueDate}.", "HIGH", "In-app + Email", "/tprm/asr-follow-ups", "-", "Not Implemented"],
  [30, "Remediation", "Remediation Closed", "All remediation items for an assessment are resolved/closed", "Account Manager + Business Owner", "All remediation items for assessment {assessmentCode} have been closed.", "Normal", "In-app + Email", "/tprm/am-follow-ups", "-", "Not Implemented"],

  // ===== VENDOR ISSUES =====
  [31, "Vendor Issues", "Vendor Issue Created", "AM or RM reports a vendor issue", "GRCAdministrator, CustomerAdministrator, Business Owner users", "A new issue has been reported for vendor {vendorName}: {issueTitle}", "HIGH", "In-app + Email", "/tprm/am-follow-ups", "api/tprm/am-follow-ups/vendor-issues/route.ts", "Active"],
  [32, "Vendor Issues", "Vendor Issue Updated", "Status or details of a vendor issue are changed", "Issue reporter + Assigned users", "Vendor issue for {vendorName} has been updated: {issueTitle}. Status: {newStatus}.", "Normal", "In-app + Email", "/tprm/am-follow-ups", "api/tprm/am-follow-ups/vendor-issues/route.ts", "Not Implemented"],
  [33, "Vendor Issues", "Vendor Issue Resolved", "Vendor issue is marked as resolved/closed", "Issue reporter + Business Owner + Account Manager", "Vendor issue for {vendorName} has been resolved: {issueTitle}.", "Normal", "In-app + Email", "/tprm/am-follow-ups", "-", "Not Implemented"],
  [34, "Vendor Issues", "Vendor Issue Escalated", "Vendor issue is escalated to higher authority", "Business Owner + GRCAdministrator", "Vendor issue for {vendorName} has been escalated: {issueTitle}.", "HIGH", "In-app + Email", "/tprm/bo-follow-ups", "-", "Not Implemented"],

  // ===== OFFBOARDING WORKFLOW =====
  [35, "Offboarding", "Offboard Assessment Submitted", "Account Manager submits offboard assessment", "Assigned assessor", "Offboard assessment for vendor {vendorName} has been submitted for your review.", "Normal", "In-app + Email", "/tprm/offboard-review/{id}", "api/tprm/offboard-assessments/[id]/route.ts", "Not Implemented"],
  [36, "Offboarding", "Offboard Assessor Approved", "Assessor approves offboard assessment", "Relationship Manager", "Offboard assessment for vendor {vendorName} has been approved by assessor. Awaiting your review.", "Normal", "In-app + Email", "/tprm/offboard-review/{id}", "api/tprm/offboard-assessments/[id]/route.ts", "Not Implemented"],
  [37, "Offboarding", "Offboard Assessor Sent Back", "Assessor sends back offboard assessment for rework", "Account Manager", "Offboard assessment for vendor {vendorName} has been returned by assessor. Reason: {comment}.", "HIGH", "In-app + Email", "/tprm/offboard-review/{id}", "api/tprm/offboard-assessments/[id]/route.ts", "Not Implemented"],
  [38, "Offboarding", "Offboard RM Approved", "Relationship Manager approves offboard assessment", "Business Owner", "Offboard assessment for vendor {vendorName} has been approved by RM. Awaiting your final approval.", "Normal", "In-app + Email", "/tprm/offboard-review/{id}", "api/tprm/offboard-assessments/[id]/route.ts", "Not Implemented"],
  [39, "Offboarding", "Offboard RM Sent Back", "Relationship Manager sends back offboard assessment", "Account Manager + Assessor", "Offboard assessment for vendor {vendorName} has been returned by RM. Reason: {comment}.", "HIGH", "In-app + Email", "/tprm/offboard-review/{id}", "api/tprm/offboard-assessments/[id]/route.ts", "Not Implemented"],
  [40, "Offboarding", "Offboard BO Approved (Final)", "Business Owner gives final approval for offboarding", "Account Manager + Assessor + Relationship Manager", "Vendor {vendorName} offboarding has been fully approved. Vendor status set to Offboarded.", "HIGH", "In-app + Email", "/tprm/bo-inventory", "api/tprm/offboard-assessments/[id]/route.ts", "Not Implemented"],
  [41, "Offboarding", "Offboard BO Sent to RM", "Business Owner sends back to RM for re-review", "Relationship Manager", "Offboard assessment for vendor {vendorName} has been sent back to you by Business Owner.", "Normal", "In-app + Email", "/tprm/offboard-review/{id}", "api/tprm/offboard-assessments/[id]/route.ts", "Not Implemented"],

  // ===== MONITORING & SCANNING =====
  [42, "Monitoring", "Vendor Scan Completed", "Continuous monitoring scan finishes for a vendor", "Business Owner + Account Manager", "Monitoring scan completed for vendor {vendorName}. Risk score: {riskScore}.", "Normal", "In-app + Email", "/tprm/monitoring", "api/tprm/monitoring/scan/route.ts", "Not Implemented"],
  [43, "Monitoring", "Critical Risk Detected", "Monitoring scan detects a critical or high risk score", "Business Owner + Account Manager + Assessor", "CRITICAL: Monitoring scan for vendor {vendorName} detected high risk. Score: {riskScore}.", "HIGH", "In-app + Email", "/tprm/monitoring", "api/tprm/monitoring/scan/route.ts", "Not Implemented"],

  // ===== SUPPORT =====
  [44, "Support", "Support Request", "User submits a support / contact request", "GRCAdministrator, CustomerAdministrator users (excluding requester)", "Support request from {name} ({company}) - Phone: {phone}: {message}", "Normal", "In-app + Email", "/tprm/bo-support", "api/tprm/support-request/route.ts", "Active"],

  // ===== SCHEDULED / CRON =====
  [45, "Scheduled", "Contract Expiry Reminder", "Vendor contract approaching expiry date (cron job)", "Account Manager + Business Owner", "Vendor {vendorName} contract expires on {expiryDate}. Please take action.", "HIGH", "In-app + Email", "/tprm/bo-inventory", "-", "Defined but NOT triggered"],
  [46, "Scheduled", "Assessment Due Reminder", "Assessment approaching due date (cron job)", "Account Manager + Assessor", "Assessment {assessmentCode} for vendor {vendorName} is due on {dueDate}.", "HIGH", "In-app + Email", "/tprm/asr-assessments/{id}", "-", "Not Implemented"],
  [47, "Scheduled", "SME Assignment Pending", "SME assigned to assessment question but hasn't responded", "The assigned SME", "You have a pending SME assignment on assessment {assessmentCode}.", "Normal", "In-app + Email", "/tprm/asr-assessments/{id}", "-", "Defined but NOT triggered"],
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(data);

ws["!cols"] = [
  { wch: 4 },
  { wch: 18 },
  { wch: 30 },
  { wch: 50 },
  { wch: 45 },
  { wch: 70 },
  { wch: 10 },
  { wch: 16 },
  { wch: 28 },
  { wch: 48 },
  { wch: 22 },
];

const headerStyle = {
  font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
  fill: { fgColor: { rgb: "1F4E79" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: {
    top: { style: "thin", color: { rgb: "000000" } },
    bottom: { style: "thin", color: { rgb: "000000" } },
    left: { style: "thin", color: { rgb: "000000" } },
    right: { style: "thin", color: { rgb: "000000" } },
  },
};

const allCols = "ABCDEFGHIJK";
for (let c = 0; c < allCols.length; c++) {
  const cell = ws[allCols[c] + "1"];
  if (cell) cell.s = headerStyle;
}

// Category colors
const categoryColors = {
  "User Management": "D6E4F0",
  "Vendor Management": "E2EFDA",
  "Assessment": "FCE4D6",
  "Remediation": "FFF2CC",
  "Vendor Issues": "F8CBAD",
  "Offboarding": "D9E2F3",
  "Monitoring": "E2D9F3",
  "Support": "DDEBF7",
  "Scheduled": "F2F2F2",
};

for (let r = 1; r < data.length; r++) {
  const isHigh = data[r][6] === "HIGH";
  const isNotImpl = String(data[r][10]).includes("Not Implemented");
  const isDefined = String(data[r][10]).includes("NOT triggered");
  const category = String(data[r][1]);
  const catColor = categoryColors[category] || "FFFFFF";

  for (let c = 0; c < allCols.length; c++) {
    const cell = ws[allCols[c] + (r + 1)];
    if (!cell) continue;

    let fillColor = catColor;
    if (isNotImpl) fillColor = "FFF2CC";
    if (isDefined) fillColor = "F2F2F2";

    cell.s = {
      font: {
        sz: 10,
        color: isDefined ? { rgb: "999999" } : isNotImpl ? { rgb: "996600" } : undefined,
        bold: c === 1, // Bold category column
      },
      fill: { fgColor: { rgb: fillColor } },
      alignment: { vertical: "center", wrapText: true },
      border: {
        top: { style: "thin", color: { rgb: "D0D0D0" } },
        bottom: { style: "thin", color: { rgb: "D0D0D0" } },
        left: { style: "thin", color: { rgb: "D0D0D0" } },
        right: { style: "thin", color: { rgb: "D0D0D0" } },
      },
    };
  }
}

ws["!rows"] = [{ hpt: 30 }];
for (let r = 1; r < data.length; r++) ws["!rows"].push({ hpt: 40 });

// Add merge info for category grouping (visual only)
ws["!autofilter"] = { ref: "A1:K" + data.length };

XLSX.utils.book_append_sheet(wb, ws, "TPRM Notifications");

// Add a summary sheet
const summaryData = [
  ["Category", "Active", "Not Implemented", "Defined (Not Triggered)", "Total"],
  ["User Management", 3, 0, 0, 3],
  ["Vendor Management", 2, 0, 0, 2],
  ["Assessment", 8, 2, 0, 10],
  ["Remediation", 0, 12, 0, 12],
  ["Vendor Issues", 1, 3, 0, 4],
  ["Offboarding", 0, 7, 0, 7],
  ["Monitoring", 0, 2, 0, 2],
  ["Support", 1, 0, 0, 1],
  ["Scheduled", 0, 1, 2, 3],
  ["", "", "", "", ""],
  ["TOTAL", 15, 27, 2, 44],
];

const ws2 = XLSX.utils.aoa_to_sheet(summaryData);
ws2["!cols"] = [{ wch: 20 }, { wch: 12 }, { wch: 18 }, { wch: 24 }, { wch: 10 }];

for (let c = 0; c < 5; c++) {
  const cell = ws2[String.fromCharCode(65 + c) + "1"];
  if (cell) cell.s = headerStyle;
}

for (let r = 1; r < summaryData.length; r++) {
  for (let c = 0; c < 5; c++) {
    const cell = ws2[String.fromCharCode(65 + c) + (r + 1)];
    if (!cell) continue;
    const isTotalRow = r === summaryData.length - 1;
    cell.s = {
      font: { sz: 10, bold: isTotalRow || c === 0 },
      fill: { fgColor: { rgb: isTotalRow ? "D6E4F0" : r % 2 === 0 ? "E8F0FE" : "FFFFFF" } },
      alignment: { vertical: "center", horizontal: c > 0 ? "center" : "left" },
      border: {
        top: { style: "thin", color: { rgb: "D0D0D0" } },
        bottom: { style: "thin", color: { rgb: "D0D0D0" } },
        left: { style: "thin", color: { rgb: "D0D0D0" } },
        right: { style: "thin", color: { rgb: "D0D0D0" } },
      },
    };
  }
}

XLSX.utils.book_append_sheet(wb, ws2, "Summary");

XLSX.writeFile(wb, "TPRM_Notifications.xlsx");
console.log("Created TPRM_Notifications.xlsx with 47 notification events (15 active, 27 not implemented, 2 defined but not triggered, 3 scheduled)");
