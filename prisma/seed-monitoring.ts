/**
 * seed-monitoring.ts
 * Seeds TPRM Monitoring data for all TPRM-enabled customer accounts.
 * Uses the same 9 vendors and scores as seen in the Mendix UAT reference app.
 *
 * Run: npx tsx prisma/seed-monitoring.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 14 KPI columns (matching Mendix monitoring page column order)
type KpiRow = {
  kpiName: string;
  score: number;
  kpiType: "Security Posture" | "Threat Exposure";
  summary: string;
  recommendation: string;
};

// Vendor monitoring data (exact values from Mendix UAT)
const VENDORS = [
  {
    vendorName: "CSFloat",
    vendorURL: "https://csfloat.com/",
    vendorOnboarded: true,
    overallScore: 68,
    securityPostureScore: 72,
    threatExposureScore: 64,
    calculatedOverallScore: 67.8,
    calculatedSecurityPosture: 72.1,
    calculatedThreatExposure: 63.5,
    jobID: "JOB-2025-001",
    status: "Completed",
    overallSummary:
      "CSFloat demonstrates a moderate security posture with strong network infrastructure but shows vulnerabilities in endpoint configuration and social engineering resilience. Immediate attention required for patching cadence and information leak prevention.",
    securityPostureSummary:
      "Network security measures are above average. DNS health and IP reputation are solid. Application security and endpoint hardening need improvement.",
    threatExposureSummary:
      "Known breach history is limited. Hacker chatter is low. Privacy practices are adequate but SSL/TLS configuration could be strengthened.",
    recommendation:
      "Prioritize endpoint security improvements and implement a more rigorous patching schedule. Consider engaging a third-party penetration testing firm to identify application-level vulnerabilities.",
    privacyPolicyUrl: "https://csfloat.com/privacy",
    dpaUrl: "https://csfloat.com/dpa",
    laws: ["GDPR", "CCPA", "ISO 27001"],
    certifications: ["SOC 2 Type II", "ISO 27001"],
    kpis: [
      { kpiName: "Network Security", score: 85, kpiType: "Security Posture", summary: "Network perimeter controls are strong with multi-layer firewall configurations.", recommendation: "Implement zero-trust network segmentation." },
      { kpiName: "DNS Health", score: 70, kpiType: "Security Posture", summary: "DNS configuration is healthy with proper DNSSEC implementation.", recommendation: "Enable DNS-over-HTTPS for additional protection." },
      { kpiName: "Patching Cadence", score: 60, kpiType: "Security Posture", summary: "Patching cycles are moderate. Several critical patches are delayed beyond acceptable windows.", recommendation: "Reduce average patch deployment time to under 14 days for critical vulnerabilities." },
      { kpiName: "Endpoint Security", score: 55, kpiType: "Security Posture", summary: "Endpoint detection and response coverage is incomplete across the fleet.", recommendation: "Deploy EDR solution across all endpoints within 30 days." },
      { kpiName: "IP Reputation", score: 75, kpiType: "Threat Exposure", summary: "IP reputation scores are acceptable with minimal blacklist appearances.", recommendation: "Monitor outbound traffic for anomalies using threat intelligence feeds." },
      { kpiName: "Application Security", score: 60, kpiType: "Security Posture", summary: "Application layer shows moderate vulnerabilities. SQL injection and XSS mitigations are partially implemented.", recommendation: "Conduct quarterly DAST scans and implement a bug bounty program." },
      { kpiName: "Cubit Score", score: 65, kpiType: "Security Posture", summary: "Overall cybersecurity maturity is moderate.", recommendation: "Invest in security awareness training for all staff." },
      { kpiName: "Email Security", score: 50, kpiType: "Threat Exposure", summary: "DMARC, DKIM, and SPF records are present but misconfigured.", recommendation: "Fix SPF record alignment and enforce DMARC policy to 'reject'." },
      { kpiName: "SSL/TLS Configuration", score: 85, kpiType: "Security Posture", summary: "TLS 1.3 is supported and configured correctly. Certificate management is automated.", recommendation: "Disable TLS 1.0 and 1.1 on legacy services." },
      { kpiName: "Privacy", score: 75, kpiType: "Threat Exposure", summary: "Data privacy controls are adequate. PII handling procedures are documented.", recommendation: "Conduct annual privacy impact assessments for new data processing activities." },
      { kpiName: "Known Breach", score: 80, kpiType: "Threat Exposure", summary: "No major breaches in the past 24 months. Minor incident reported in 2023 was contained.", recommendation: "Maintain incident response retainer and conduct tabletop exercises quarterly." },
      { kpiName: "Hacker Chatter", score: 65, kpiType: "Threat Exposure", summary: "Low-level mentions detected on dark web forums. No active targeting observed.", recommendation: "Subscribe to dark web monitoring service for continuous threat intelligence." },
      { kpiName: "Information Leak", score: 70, kpiType: "Threat Exposure", summary: "Some employee credentials found in public breach databases.", recommendation: "Enforce password resets and implement multi-factor authentication company-wide." },
      { kpiName: "Social Engineering", score: 55, kpiType: "Threat Exposure", summary: "Phishing simulation results indicate 22% click-through rate — above industry average.", recommendation: "Increase phishing simulation frequency and provide targeted training for repeat offenders." },
    ] as KpiRow[],
    httpHeaders: [
      { name: "Strict-Transport-Security", present: true, value: "max-age=31536000; includeSubDomains", description: "Enforces HTTPS connections.", recommendation: "Add preload directive to HSTS header." },
      { name: "Content-Security-Policy", present: false, value: null, description: "Prevents XSS and data injection attacks.", recommendation: "Implement a strict CSP policy to restrict content sources." },
      { name: "X-Frame-Options", present: true, value: "DENY", description: "Prevents clickjacking attacks.", recommendation: "Already configured correctly." },
      { name: "X-Content-Type-Options", present: true, value: "nosniff", description: "Prevents MIME type sniffing.", recommendation: "Already configured correctly." },
      { name: "Referrer-Policy", present: false, value: null, description: "Controls referrer information in requests.", recommendation: "Add Referrer-Policy: strict-origin-when-cross-origin header." },
    ],
    platform: "nginx/1.24.0",
    keyFindings: [
      "Endpoint security coverage is below 80% of the total fleet",
      "Email authentication misconfiguration exposes domain to spoofing",
      "22% phishing simulation click-through rate indicates training gap",
    ],
    vulnerabilities: [
      { cveId: "CVE-2024-1234", severity: "High", affectedComponent: "Web Application Firewall", description: "Bypass vulnerability in WAF rule engine allowing crafted requests to reach backend systems." },
      { cveId: "CVE-2023-5678", severity: "Medium", affectedComponent: "Email Gateway", description: "SMTP smuggling vulnerability in email gateway component." },
    ],
  },
  {
    vendorName: "ChatGPT",
    vendorURL: "https://chatgpt.com",
    vendorOnboarded: true,
    overallScore: 69,
    securityPostureScore: 78,
    threatExposureScore: 60,
    calculatedOverallScore: 69.2,
    calculatedSecurityPosture: 77.8,
    calculatedThreatExposure: 60.5,
    jobID: "JOB-2025-002",
    status: "Completed",
    overallSummary: "ChatGPT (OpenAI) maintains a strong security posture with excellent network infrastructure. Privacy and known breach scores reflect the high-profile nature of the service.",
    securityPostureSummary: "Network and application security are robust. Patching cadence is excellent with rapid deployment of security fixes.",
    threatExposureSummary: "Privacy score is moderate due to large-scale data processing. Known breach score is lowered by historical incidents.",
    recommendation: "Enhance data minimization practices and strengthen incident response documentation.",
    privacyPolicyUrl: "https://openai.com/privacy",
    dpaUrl: "https://openai.com/dpa",
    laws: ["GDPR", "CCPA", "HIPAA"],
    certifications: ["SOC 2 Type II", "ISO 27001", "CSA STAR"],
    kpis: [
      { kpiName: "Network Security", score: 88, kpiType: "Security Posture", summary: "Enterprise-grade network security with advanced threat detection.", recommendation: "Maintain current posture and continue regular red team exercises." },
      { kpiName: "DNS Health", score: 75, kpiType: "Security Posture", summary: "DNS configuration is secure with DNSSEC and CAA records.", recommendation: "Consider implementing DoT/DoH for recursive resolution." },
      { kpiName: "Patching Cadence", score: 82, kpiType: "Security Posture", summary: "Patches deployed within 7 days for critical vulnerabilities.", recommendation: "Maintain current patching velocity." },
      { kpiName: "Endpoint Security", score: 70, kpiType: "Security Posture", summary: "EDR deployed across majority of infrastructure.", recommendation: "Extend EDR coverage to cloud workloads." },
      { kpiName: "IP Reputation", score: 85, kpiType: "Threat Exposure", summary: "Excellent IP reputation with clean threat intelligence feeds.", recommendation: "Continue monitoring for subnet-level reputation issues." },
      { kpiName: "Application Security", score: 74, kpiType: "Security Posture", summary: "Robust SDLC with security reviews at each stage.", recommendation: "Increase automated SAST coverage in CI/CD pipeline." },
      { kpiName: "Cubit Score", score: 65, kpiType: "Security Posture", summary: "Above-average cybersecurity maturity score.", recommendation: "Focus on supply chain security improvements." },
      { kpiName: "Email Security", score: 66, kpiType: "Threat Exposure", summary: "DMARC policy is in monitoring mode.", recommendation: "Move DMARC to enforcement mode immediately." },
      { kpiName: "SSL/TLS Configuration", score: 92, kpiType: "Security Posture", summary: "Excellent TLS configuration with A+ rating.", recommendation: "Already at optimal configuration." },
      { kpiName: "Privacy", score: 70, kpiType: "Threat Exposure", summary: "Privacy practices are documented but data retention policies need review.", recommendation: "Implement automated data lifecycle management." },
      { kpiName: "Known Breach", score: 60, kpiType: "Threat Exposure", summary: "Previous data exposure incidents have been remediated.", recommendation: "Strengthen access controls for training data pipelines." },
      { kpiName: "Hacker Chatter", score: 64, kpiType: "Threat Exposure", summary: "Active discussions about AI system vulnerabilities on security forums.", recommendation: "Monitor AI-specific threat intelligence channels." },
      { kpiName: "Information Leak", score: 58, kpiType: "Threat Exposure", summary: "Some employee data found in credential dumps.", recommendation: "Implement hardware security keys for all privileged accounts." },
      { kpiName: "Social Engineering", score: 62, kpiType: "Threat Exposure", summary: "High-profile status makes social engineering targeting more likely.", recommendation: "Implement executive protection protocols and enhanced vetting for privileged access." },
    ] as KpiRow[],
    httpHeaders: [
      { name: "Strict-Transport-Security", present: true, value: "max-age=63072000; includeSubDomains; preload", description: "HSTS with preload enabled.", recommendation: "Already optimally configured." },
      { name: "Content-Security-Policy", present: true, value: "default-src 'self'; script-src 'self' 'nonce-...'", description: "CSP implemented with nonce-based script allowlisting.", recommendation: "Review nonce rotation frequency." },
      { name: "X-Frame-Options", present: true, value: "DENY", description: "Clickjacking protection enabled.", recommendation: "Already correctly configured." },
      { name: "X-Content-Type-Options", present: true, value: "nosniff", description: "MIME sniffing protection enabled.", recommendation: "No action required." },
      { name: "Permissions-Policy", present: true, value: "camera=(), microphone=(), geolocation=()", description: "Browser feature permissions restricted.", recommendation: "Review and update permissions policy annually." },
    ],
    platform: "cloudflare",
    keyFindings: [
      "DMARC policy in monitoring mode — not enforcing",
      "Previous data incidents require enhanced monitoring",
    ],
    vulnerabilities: [],
  },
  {
    vendorName: "Perplexity",
    vendorURL: "https://www.perplexity.ai/",
    vendorOnboarded: false,
    overallScore: 62,
    securityPostureScore: 68,
    threatExposureScore: 56,
    calculatedOverallScore: 62.4,
    calculatedSecurityPosture: 68.1,
    calculatedThreatExposure: 56.7,
    jobID: "JOB-2025-003",
    status: "Completed",
    overallSummary: "Perplexity AI shows moderate security controls appropriate for a growing AI company. Several gaps exist in endpoint protection and information leak prevention.",
    securityPostureSummary: "Network security is strong but endpoint and application security need improvement.",
    threatExposureSummary: "Known breach history is clean. Privacy and hacker chatter scores indicate emerging threat exposure.",
    recommendation: "Focus on building a formal security program with dedicated CISO oversight and third-party auditing.",
    privacyPolicyUrl: "https://www.perplexity.ai/privacy",
    dpaUrl: null,
    laws: ["GDPR", "CCPA"],
    certifications: ["SOC 2 Type I"],
    kpis: [
      { kpiName: "Network Security", score: 85, kpiType: "Security Posture", summary: "Cloud-native infrastructure with strong network segmentation.", recommendation: "Implement network micro-segmentation for critical services." },
      { kpiName: "DNS Health", score: 75, kpiType: "Security Posture", summary: "DNS health is good with proper record configuration.", recommendation: "Enable DNSSEC validation." },
      { kpiName: "Patching Cadence", score: 60, kpiType: "Security Posture", summary: "Container-based infrastructure helps with rapid patching.", recommendation: "Automate vulnerability scanning in CI/CD pipeline." },
      { kpiName: "Endpoint Security", score: 55, kpiType: "Security Posture", summary: "Endpoint coverage is partial, especially for remote workers.", recommendation: "Deploy MDM solution for all company-issued devices." },
      { kpiName: "IP Reputation", score: 65, kpiType: "Threat Exposure", summary: "IP reputation is acceptable with some fluctuations.", recommendation: "Investigate and remediate any listed IPs promptly." },
      { kpiName: "Application Security", score: 50, kpiType: "Security Posture", summary: "Application security testing is ad-hoc rather than systematic.", recommendation: "Establish a formal SDLC security review process." },
      { kpiName: "Cubit Score", score: 60, kpiType: "Security Posture", summary: "Moderate cybersecurity maturity.", recommendation: "Develop and publish a formal security roadmap." },
      { kpiName: "Email Security", score: 60, kpiType: "Threat Exposure", summary: "Basic email security controls in place.", recommendation: "Implement advanced email threat protection." },
      { kpiName: "SSL/TLS Configuration", score: 90, kpiType: "Security Posture", summary: "TLS configuration is excellent.", recommendation: "Already at optimal configuration." },
      { kpiName: "Privacy", score: 65, kpiType: "Threat Exposure", summary: "Privacy controls are developing. Data retention needs clarification.", recommendation: "Publish detailed data retention schedule." },
      { kpiName: "Known Breach", score: 55, kpiType: "Threat Exposure", summary: "Clean breach history as a newer company.", recommendation: "Maintain proactive threat hunting program." },
      { kpiName: "Hacker Chatter", score: 70, kpiType: "Threat Exposure", summary: "Elevated discussions due to growing public profile.", recommendation: "Monitor AI-specific threat intelligence." },
      { kpiName: "Information Leak", score: 45, kpiType: "Threat Exposure", summary: "Some code repository exposure detected.", recommendation: "Audit all public repositories and implement secret scanning." },
      { kpiName: "Social Engineering", score: 60, kpiType: "Threat Exposure", summary: "Social engineering resistance is moderate.", recommendation: "Implement mandatory security awareness training quarterly." },
    ] as KpiRow[],
    httpHeaders: [
      { name: "Strict-Transport-Security", present: true, value: "max-age=31536000; includeSubDomains", description: "HSTS enabled.", recommendation: "Add preload directive." },
      { name: "Content-Security-Policy", present: false, value: null, description: "CSP not implemented.", recommendation: "Implement Content Security Policy to prevent XSS attacks." },
      { name: "X-Frame-Options", present: true, value: "SAMEORIGIN", description: "Partial clickjacking protection.", recommendation: "Consider changing to DENY for stricter protection." },
      { name: "X-Content-Type-Options", present: true, value: "nosniff", description: "MIME sniffing protection enabled.", recommendation: "No action required." },
    ],
    platform: "vercel",
    keyFindings: [
      "CSP not implemented — XSS risk elevated",
      "Application security testing is ad-hoc",
      "Information leak in public repositories detected",
    ],
    vulnerabilities: [
      { cveId: "CVE-2024-9012", severity: "Medium", affectedComponent: "Frontend Framework", description: "Prototype pollution vulnerability in dependency." },
    ],
  },
  {
    vendorName: "Aternos",
    vendorURL: "https://aternos.org/",
    vendorOnboarded: true,
    overallScore: 74,
    securityPostureScore: 79,
    threatExposureScore: 69,
    calculatedOverallScore: 74.2,
    calculatedSecurityPosture: 79.3,
    calculatedThreatExposure: 69.1,
    jobID: "JOB-2025-004",
    status: "Completed",
    overallSummary: "Aternos demonstrates above-average security posture with strong network defenses and excellent SSL/TLS configuration. Known breach score reflects historical incidents.",
    securityPostureSummary: "Strong network and application security. Patching cadence is excellent.",
    threatExposureSummary: "SSL/TLS configuration is exemplary. Privacy practices need improvement.",
    recommendation: "Invest in improving privacy practices and hacker chatter monitoring capabilities.",
    privacyPolicyUrl: "https://aternos.org/privacy",
    dpaUrl: "https://aternos.org/dpa",
    laws: ["GDPR"],
    certifications: ["ISO 27001"],
    kpis: [
      { kpiName: "Network Security", score: 88, kpiType: "Security Posture", summary: "Strong network security with DDoS protection and WAF.", recommendation: "Continue current network security program." },
      { kpiName: "DNS Health", score: 70, kpiType: "Security Posture", summary: "DNS configuration is secure.", recommendation: "Enable CAA records." },
      { kpiName: "Patching Cadence", score: 84, kpiType: "Security Posture", summary: "Rapid patching with automated deployment pipeline.", recommendation: "Extend automated patching to all components." },
      { kpiName: "Endpoint Security", score: 72, kpiType: "Security Posture", summary: "Good endpoint coverage across the fleet.", recommendation: "Implement behavioral analytics on endpoints." },
      { kpiName: "IP Reputation", score: 80, kpiType: "Threat Exposure", summary: "Excellent IP reputation.", recommendation: "Maintain current monitoring." },
      { kpiName: "Application Security", score: 76, kpiType: "Security Posture", summary: "Regular security testing with bug bounty program.", recommendation: "Increase SAST coverage in CI/CD." },
      { kpiName: "Cubit Score", score: 75, kpiType: "Security Posture", summary: "Good cybersecurity maturity.", recommendation: "Progress toward advanced maturity level." },
      { kpiName: "Email Security", score: 68, kpiType: "Threat Exposure", summary: "DMARC in enforcement mode.", recommendation: "Implement BIMI for additional authentication." },
      { kpiName: "SSL/TLS Configuration", score: 92, kpiType: "Security Posture", summary: "Excellent TLS with A+ rating and modern cipher suites.", recommendation: "Already at optimal configuration." },
      { kpiName: "Privacy", score: 60, kpiType: "Threat Exposure", summary: "Privacy controls exist but documentation is sparse.", recommendation: "Publish comprehensive privacy impact assessment." },
      { kpiName: "Known Breach", score: 58, kpiType: "Threat Exposure", summary: "Previous DDoS incident history noted.", recommendation: "Enhance DDoS resilience and response procedures." },
      { kpiName: "Hacker Chatter", score: 82, kpiType: "Threat Exposure", summary: "Elevated chatter related to gaming infrastructure targeting.", recommendation: "Monitor gaming-sector specific threat intelligence." },
      { kpiName: "Information Leak", score: 78, kpiType: "Threat Exposure", summary: "Minor information leaks detected and remediated.", recommendation: "Implement DLP solution for sensitive data." },
      { kpiName: "Social Engineering", score: 72, kpiType: "Threat Exposure", summary: "Good social engineering resistance.", recommendation: "Continue regular security awareness training." },
    ] as KpiRow[],
    httpHeaders: [
      { name: "Strict-Transport-Security", present: true, value: "max-age=31536000; includeSubDomains; preload", description: "HSTS with preload.", recommendation: "Already optimal." },
      { name: "Content-Security-Policy", present: true, value: "default-src 'self'", description: "CSP implemented.", recommendation: "Review and tighten CSP policy." },
      { name: "X-Frame-Options", present: true, value: "DENY", description: "Clickjacking protection.", recommendation: "No action required." },
      { name: "X-Content-Type-Options", present: true, value: "nosniff", description: "MIME sniffing protection.", recommendation: "No action required." },
      { name: "Referrer-Policy", present: true, value: "strict-origin-when-cross-origin", description: "Referrer policy configured.", recommendation: "No action required." },
    ],
    platform: "nginx/1.22.0",
    keyFindings: ["Previous DDoS incidents indicate targeting by threat actors", "Privacy documentation needs improvement"],
    vulnerabilities: [],
  },
  {
    vendorName: "TPRM",
    vendorURL: "https://tprm-verifaiuat.baarez.com/",
    vendorOnboarded: true,
    overallScore: 70,
    securityPostureScore: 65,
    threatExposureScore: 75,
    calculatedOverallScore: 70.1,
    calculatedSecurityPosture: 65.4,
    calculatedThreatExposure: 74.8,
    jobID: "JOB-2025-005",
    status: "Completed",
    overallSummary: "The internal TPRM application shows moderate security with strong threat exposure controls. Application security and endpoint hardening need attention.",
    securityPostureSummary: "Network security is adequate. Application security requires improvement.",
    threatExposureSummary: "Known breach history is very clean with active monitoring. SSL/TLS is excellent.",
    recommendation: "Prioritize application security testing and implement a formal vulnerability disclosure program.",
    privacyPolicyUrl: "https://baarez.com/privacy",
    dpaUrl: "https://baarez.com/dpa",
    laws: ["GDPR", "CCPA", "UAE PDPL"],
    certifications: ["ISO 27001", "SOC 2 Type II"],
    kpis: [
      { kpiName: "Network Security", score: 72, kpiType: "Security Posture", summary: "Network security controls are in place with room for improvement.", recommendation: "Implement IDS/IPS at network perimeter." },
      { kpiName: "DNS Health", score: 62, kpiType: "Security Posture", summary: "DNS configuration has some gaps.", recommendation: "Implement DNSSEC and CAA records." },
      { kpiName: "Patching Cadence", score: 55, kpiType: "Security Posture", summary: "Patching is inconsistent across components.", recommendation: "Implement automated patch management system." },
      { kpiName: "Endpoint Security", score: 50, kpiType: "Security Posture", summary: "Endpoint coverage is incomplete.", recommendation: "Deploy unified endpoint management solution." },
      { kpiName: "IP Reputation", score: 70, kpiType: "Threat Exposure", summary: "Clean IP reputation.", recommendation: "Maintain current posture." },
      { kpiName: "Application Security", score: 45, kpiType: "Security Posture", summary: "Application security testing is infrequent.", recommendation: "Implement continuous security testing in deployment pipeline." },
      { kpiName: "Cubit Score", score: 60, kpiType: "Security Posture", summary: "Moderate maturity score.", recommendation: "Develop a structured security improvement roadmap." },
      { kpiName: "Email Security", score: 65, kpiType: "Threat Exposure", summary: "Email security controls implemented.", recommendation: "Enforce DMARC reject policy." },
      { kpiName: "SSL/TLS Configuration", score: 86, kpiType: "Security Posture", summary: "Strong TLS configuration.", recommendation: "Disable older cipher suites." },
      { kpiName: "Privacy", score: 40, kpiType: "Threat Exposure", summary: "Privacy controls need significant improvement.", recommendation: "Conduct privacy impact assessment and implement data governance framework." },
      { kpiName: "Known Breach", score: 90, kpiType: "Threat Exposure", summary: "No breach history detected.", recommendation: "Maintain current security monitoring." },
      { kpiName: "Hacker Chatter", score: 85, kpiType: "Threat Exposure", summary: "No active targeting detected in dark web monitoring.", recommendation: "Continue current threat intelligence monitoring." },
      { kpiName: "Information Leak", score: 70, kpiType: "Threat Exposure", summary: "No significant information leaks detected.", recommendation: "Implement DLP solution." },
      { kpiName: "Social Engineering", score: 70, kpiType: "Threat Exposure", summary: "Security awareness training is conducted regularly.", recommendation: "Increase training frequency for high-risk roles." },
    ] as KpiRow[],
    httpHeaders: [
      { name: "Strict-Transport-Security", present: true, value: "max-age=31536000", description: "HSTS enabled.", recommendation: "Add includeSubDomains and preload." },
      { name: "Content-Security-Policy", present: false, value: null, description: "CSP not implemented.", recommendation: "Implement Content Security Policy." },
      { name: "X-Frame-Options", present: true, value: "SAMEORIGIN", description: "Partial clickjacking protection.", recommendation: "Consider stricter DENY policy." },
      { name: "X-Content-Type-Options", present: true, value: "nosniff", description: "MIME protection enabled.", recommendation: "No action required." },
    ],
    platform: "Apache/2.4",
    keyFindings: ["Application security testing is infrequent", "Privacy controls require significant improvement", "Endpoint coverage incomplete"],
    vulnerabilities: [
      { cveId: "CVE-2024-3456", severity: "High", affectedComponent: "Web Application", description: "Insecure direct object reference vulnerability allowing unauthorized data access." },
    ],
  },
  {
    vendorName: "Deepseek",
    vendorURL: "https://chat.deepseek.com/",
    vendorOnboarded: false,
    overallScore: 58,
    securityPostureScore: 65,
    threatExposureScore: 51,
    calculatedOverallScore: 58.3,
    calculatedSecurityPosture: 65.2,
    calculatedThreatExposure: 51.4,
    jobID: "JOB-2025-006",
    status: "Completed",
    overallSummary: "Deepseek shows below-average security posture with significant concerns around privacy, known breach history, and information leak prevention. Geopolitical risk factors should be considered.",
    securityPostureSummary: "Network and SSL/TLS security are adequate. Application and endpoint security need improvement.",
    threatExposureSummary: "Known breach history and privacy scores are concerning. Information leak and social engineering risks are elevated.",
    recommendation: "Conduct comprehensive third-party security audit. Consider geopolitical risk classification and implement enhanced monitoring and data handling restrictions.",
    privacyPolicyUrl: "https://deepseek.com/privacy",
    dpaUrl: null,
    laws: ["PIPL", "GDPR"],
    certifications: [],
    kpis: [
      { kpiName: "Network Security", score: 80, kpiType: "Security Posture", summary: "Network infrastructure is capable.", recommendation: "Implement additional threat intelligence integration." },
      { kpiName: "DNS Health", score: 70, kpiType: "Security Posture", summary: "DNS configuration is functional.", recommendation: "Implement DNSSEC." },
      { kpiName: "Patching Cadence", score: 65, kpiType: "Security Posture", summary: "Patching is moderate.", recommendation: "Improve patch velocity for critical vulnerabilities." },
      { kpiName: "Endpoint Security", score: 60, kpiType: "Security Posture", summary: "Basic endpoint controls in place.", recommendation: "Deploy comprehensive EDR solution." },
      { kpiName: "IP Reputation", score: 80, kpiType: "Threat Exposure", summary: "IP reputation is acceptable.", recommendation: "Monitor for changes in reputation scoring." },
      { kpiName: "Application Security", score: 45, kpiType: "Security Posture", summary: "Application security testing details are limited.", recommendation: "Provide application security testing reports as part of due diligence." },
      { kpiName: "Cubit Score", score: 60, kpiType: "Security Posture", summary: "Moderate maturity.", recommendation: "Request security maturity assessment from vendor." },
      { kpiName: "Email Security", score: 65, kpiType: "Threat Exposure", summary: "Basic email security implemented.", recommendation: "Enforce DMARC reject policy." },
      { kpiName: "SSL/TLS Configuration", score: 92, kpiType: "Security Posture", summary: "TLS configuration is strong.", recommendation: "Already optimal." },
      { kpiName: "Privacy", score: 58, kpiType: "Threat Exposure", summary: "Privacy practices differ significantly from Western standards.", recommendation: "Evaluate data localization requirements and implement data residency controls." },
      { kpiName: "Known Breach", score: 35, kpiType: "Threat Exposure", summary: "Significant data breach incidents reported in early 2025.", recommendation: "Obtain breach incident reports and remediation evidence before onboarding." },
      { kpiName: "Hacker Chatter", score: 60, kpiType: "Threat Exposure", summary: "High-profile nature increases threat actor interest.", recommendation: "Implement enhanced monitoring for supply chain attacks." },
      { kpiName: "Information Leak", score: 30, kpiType: "Threat Exposure", summary: "Significant information exposure incidents detected.", recommendation: "Do not integrate with internal systems until remediation evidence is provided." },
      { kpiName: "Social Engineering", score: 65, kpiType: "Threat Exposure", summary: "Limited information available on security training.", recommendation: "Request evidence of security awareness program." },
    ] as KpiRow[],
    httpHeaders: [
      { name: "Strict-Transport-Security", present: true, value: "max-age=31536000", description: "HSTS enabled.", recommendation: "Add includeSubDomains and preload." },
      { name: "Content-Security-Policy", present: false, value: null, description: "CSP not implemented.", recommendation: "Implement CSP immediately." },
      { name: "X-Frame-Options", present: false, value: null, description: "No clickjacking protection.", recommendation: "Implement X-Frame-Options: DENY." },
      { name: "X-Content-Type-Options", present: true, value: "nosniff", description: "MIME protection.", recommendation: "No action required." },
    ],
    platform: "unknown",
    keyFindings: [
      "Significant data breach in 2025 — remediation evidence required",
      "Privacy practices do not meet GDPR standards",
      "Information leak score critically low — do not integrate without remediation",
    ],
    vulnerabilities: [
      { cveId: "CVE-2025-0001", severity: "Critical", affectedComponent: "User Data Store", description: "Unauthorized access to user conversation histories via misconfigured API endpoint." },
    ],
  },
  {
    vendorName: "SouthParkStudios",
    vendorURL: "https://www.southparkstudios.com/",
    vendorOnboarded: false,
    overallScore: 66,
    securityPostureScore: 71,
    threatExposureScore: 61,
    calculatedOverallScore: 66.4,
    calculatedSecurityPosture: 71.2,
    calculatedThreatExposure: 61.6,
    jobID: "JOB-2025-007",
    status: "Completed",
    overallSummary: "SouthParkStudios (Paramount) shows moderate security posture. Known breach history and privacy controls need improvement.",
    securityPostureSummary: "Network security and TLS configuration are strong. Application security needs attention.",
    threatExposureSummary: "Privacy and known breach scores are below average, likely due to parent company incidents.",
    recommendation: "Request updated security posture documentation from Paramount and evaluate shared infrastructure risks.",
    privacyPolicyUrl: "https://www.paramountglobal.com/privacy",
    dpaUrl: null,
    laws: ["GDPR", "CCPA", "COPPA"],
    certifications: ["SOC 2 Type I"],
    kpis: [
      { kpiName: "Network Security", score: 85, kpiType: "Security Posture", summary: "Strong network infrastructure backed by Paramount's enterprise controls.", recommendation: "Maintain current posture." },
      { kpiName: "DNS Health", score: 65, kpiType: "Security Posture", summary: "DNS health is adequate.", recommendation: "Implement DNSSEC." },
      { kpiName: "Patching Cadence", score: 70, kpiType: "Security Posture", summary: "Patching cadence is good.", recommendation: "Automate patching for web properties." },
      { kpiName: "Endpoint Security", score: 60, kpiType: "Security Posture", summary: "Enterprise EDR partially deployed.", recommendation: "Extend EDR to all internet-facing systems." },
      { kpiName: "IP Reputation", score: 85, kpiType: "Threat Exposure", summary: "Good IP reputation on major CDN infrastructure.", recommendation: "Maintain current posture." },
      { kpiName: "Application Security", score: 55, kpiType: "Security Posture", summary: "Application security is moderate with some legacy components.", recommendation: "Conduct application security assessment of legacy components." },
      { kpiName: "Cubit Score", score: 65, kpiType: "Security Posture", summary: "Moderate maturity.", recommendation: "Leverage parent company security resources." },
      { kpiName: "Email Security", score: 60, kpiType: "Threat Exposure", summary: "Email security controls in place.", recommendation: "Enforce DMARC reject policy." },
      { kpiName: "SSL/TLS Configuration", score: 90, kpiType: "Security Posture", summary: "Excellent TLS configuration via CDN.", recommendation: "Already optimal." },
      { kpiName: "Privacy", score: 55, kpiType: "Threat Exposure", summary: "Privacy controls are moderate, COPPA compliance is active.", recommendation: "Conduct annual COPPA compliance review." },
      { kpiName: "Known Breach", score: 50, kpiType: "Threat Exposure", summary: "Parent company breach history affects score.", recommendation: "Obtain incident isolation evidence for this specific service." },
      { kpiName: "Hacker Chatter", score: 80, kpiType: "Threat Exposure", summary: "Minimal targeting observed.", recommendation: "Maintain current monitoring." },
      { kpiName: "Information Leak", score: 60, kpiType: "Threat Exposure", summary: "Some credential exposure in parent company breaches.", recommendation: "Rotate all shared credentials immediately." },
      { kpiName: "Social Engineering", score: 65, kpiType: "Threat Exposure", summary: "Security awareness program exists.", recommendation: "Increase training for customer-facing staff." },
    ] as KpiRow[],
    httpHeaders: [
      { name: "Strict-Transport-Security", present: true, value: "max-age=31536000; includeSubDomains", description: "HSTS enabled.", recommendation: "Add preload directive." },
      { name: "Content-Security-Policy", present: false, value: null, description: "CSP not implemented.", recommendation: "Implement CSP to protect against XSS." },
      { name: "X-Frame-Options", present: true, value: "SAMEORIGIN", description: "Partial clickjacking protection.", recommendation: "Consider DENY policy." },
      { name: "X-Content-Type-Options", present: true, value: "nosniff", description: "MIME protection.", recommendation: "No action required." },
    ],
    platform: "Akamai",
    keyFindings: ["Parent company breach history requires isolation evidence", "Legacy application components with known vulnerabilities"],
    vulnerabilities: [],
  },
  {
    vendorName: "Wolters Kluwer",
    vendorURL: "https://www.wolterskluwer.com",
    vendorOnboarded: true,
    overallScore: 68,
    securityPostureScore: 74,
    threatExposureScore: 62,
    calculatedOverallScore: 68.2,
    calculatedSecurityPosture: 74.3,
    calculatedThreatExposure: 62.1,
    jobID: "JOB-2025-008",
    status: "Completed",
    overallSummary: "Wolters Kluwer demonstrates solid enterprise security with strong network and SSL/TLS controls. Known breach history requires ongoing monitoring.",
    securityPostureSummary: "Strong network security and patching cadence. Application security is good.",
    threatExposureSummary: "Known breach history impacts score. IP reputation and SSL are strong.",
    recommendation: "Request updated breach remediation evidence and enhanced monitoring SLAs.",
    privacyPolicyUrl: "https://www.wolterskluwer.com/en/solutions/security-privacy-risk/privacy-statement",
    dpaUrl: "https://www.wolterskluwer.com/en/solutions/security-privacy-risk/data-processing-agreement",
    laws: ["GDPR", "CCPA", "SOX", "HIPAA"],
    certifications: ["ISO 27001", "SOC 2 Type II", "ISO 9001"],
    kpis: [
      { kpiName: "Network Security", score: 88, kpiType: "Security Posture", summary: "Enterprise-grade network security with global NOC.", recommendation: "Continue current security program." },
      { kpiName: "DNS Health", score: 75, kpiType: "Security Posture", summary: "DNS configuration is secure.", recommendation: "Enable CAA records for all domains." },
      { kpiName: "Patching Cadence", score: 70, kpiType: "Security Posture", summary: "Good patching program with formal vulnerability management.", recommendation: "Reduce critical patch window to 7 days." },
      { kpiName: "Endpoint Security", score: 70, kpiType: "Security Posture", summary: "EDR deployed across enterprise.", recommendation: "Extend to cloud workloads." },
      { kpiName: "IP Reputation", score: 85, kpiType: "Threat Exposure", summary: "Excellent IP reputation.", recommendation: "Maintain current posture." },
      { kpiName: "Application Security", score: 65, kpiType: "Security Posture", summary: "Regular penetration testing program in place.", recommendation: "Increase DAST coverage in CI/CD pipeline." },
      { kpiName: "Cubit Score", score: 65, kpiType: "Security Posture", summary: "Above-average maturity.", recommendation: "Focus on supply chain security." },
      { kpiName: "Email Security", score: 70, kpiType: "Threat Exposure", summary: "Strong email security with DMARC enforcement.", recommendation: "Implement BIMI." },
      { kpiName: "SSL/TLS Configuration", score: 90, kpiType: "Security Posture", summary: "Excellent TLS configuration.", recommendation: "Already optimal." },
      { kpiName: "Privacy", score: 80, kpiType: "Threat Exposure", summary: "Strong privacy program with dedicated DPO.", recommendation: "Maintain current privacy program." },
      { kpiName: "Known Breach", score: 58, kpiType: "Threat Exposure", summary: "Historical cybersecurity incident affected reputation.", recommendation: "Provide incident remediation report and evidence of security improvements." },
      { kpiName: "Hacker Chatter", score: 55, kpiType: "Threat Exposure", summary: "Some threat actor discussions noted in legal sector targeting.", recommendation: "Monitor legal-sector specific threat intelligence." },
      { kpiName: "Information Leak", score: 62, kpiType: "Threat Exposure", summary: "Limited information exposure detected.", recommendation: "Audit access to sensitive customer data." },
      { kpiName: "Social Engineering", score: 60, kpiType: "Threat Exposure", summary: "Security training program exists.", recommendation: "Increase social engineering simulation frequency." },
    ] as KpiRow[],
    httpHeaders: [
      { name: "Strict-Transport-Security", present: true, value: "max-age=31536000; includeSubDomains; preload", description: "Optimal HSTS configuration.", recommendation: "Already optimal." },
      { name: "Content-Security-Policy", present: true, value: "default-src 'self' *.wolterskluwer.com", description: "CSP implemented.", recommendation: "Tighten CSP to minimize wildcard domains." },
      { name: "X-Frame-Options", present: true, value: "DENY", description: "Clickjacking protection.", recommendation: "No action required." },
      { name: "X-Content-Type-Options", present: true, value: "nosniff", description: "MIME protection.", recommendation: "No action required." },
      { name: "Permissions-Policy", present: true, value: "camera=(), microphone=()", description: "Feature permissions restricted.", recommendation: "Review annually." },
    ],
    platform: "IIS/10.0",
    keyFindings: ["2019 cybersecurity incident requires ongoing monitoring", "Legal sector targeting observed in threat intelligence"],
    vulnerabilities: [],
  },
  {
    vendorName: "Tesla",
    vendorURL: "https://www.tesla.com/",
    vendorOnboarded: false,
    overallScore: 60,
    securityPostureScore: 67,
    threatExposureScore: 53,
    calculatedOverallScore: 60.1,
    calculatedSecurityPosture: 67.4,
    calculatedThreatExposure: 52.8,
    jobID: "JOB-2025-009",
    status: "Completed",
    overallSummary: "Tesla shows moderate security posture. Known breach history and information leak scores are concerning given the high-value nature of Tesla's IP and customer data.",
    securityPostureSummary: "Network and patching cadence are adequate. Application and endpoint security need improvement.",
    threatExposureSummary: "Known breach history, information leaks, and social engineering are significant concerns.",
    recommendation: "Request detailed security improvement roadmap and evidence of remediation for historical incidents. Evaluate supply chain risk given IoT/automotive integration.",
    privacyPolicyUrl: "https://www.tesla.com/legal/privacy",
    dpaUrl: null,
    laws: ["GDPR", "CCPA", "CPRA"],
    certifications: ["ISO 27001"],
    kpis: [
      { kpiName: "Network Security", score: 85, kpiType: "Security Posture", summary: "Strong network infrastructure.", recommendation: "Continue current program." },
      { kpiName: "DNS Health", score: 70, kpiType: "Security Posture", summary: "DNS health is adequate.", recommendation: "Enable DNSSEC." },
      { kpiName: "Patching Cadence", score: 68, kpiType: "Security Posture", summary: "Patching is moderate.", recommendation: "Improve IoT device patching cadence." },
      { kpiName: "Endpoint Security", score: 65, kpiType: "Security Posture", summary: "Enterprise endpoints are protected. IoT fleet coverage varies.", recommendation: "Implement unified IoT security management." },
      { kpiName: "IP Reputation", score: 80, kpiType: "Threat Exposure", summary: "Good IP reputation.", recommendation: "Maintain current posture." },
      { kpiName: "Application Security", score: 62, kpiType: "Security Posture", summary: "Web application security is moderate.", recommendation: "Expand bug bounty program scope." },
      { kpiName: "Cubit Score", score: 60, kpiType: "Security Posture", summary: "Moderate maturity.", recommendation: "Develop IoT security framework." },
      { kpiName: "Email Security", score: 72, kpiType: "Threat Exposure", summary: "Good email security controls.", recommendation: "Maintain current posture." },
      { kpiName: "SSL/TLS Configuration", score: 78, kpiType: "Security Posture", summary: "TLS configuration is good but not optimal.", recommendation: "Upgrade to TLS 1.3 across all services." },
      { kpiName: "Privacy", score: 55, kpiType: "Threat Exposure", summary: "Vehicle data collection raises privacy concerns.", recommendation: "Publish detailed data collection and retention policies for vehicle data." },
      { kpiName: "Known Breach", score: 45, kpiType: "Threat Exposure", summary: "Multiple historical incidents including employee data theft cases.", recommendation: "Provide breach remediation reports for all historical incidents." },
      { kpiName: "Hacker Chatter", score: 50, kpiType: "Threat Exposure", summary: "High-value target with active threat actor interest.", recommendation: "Implement enhanced threat intelligence monitoring." },
      { kpiName: "Information Leak", score: 40, kpiType: "Threat Exposure", summary: "Source code and employee data leaks detected.", recommendation: "Implement DLP and stricter access controls for sensitive repositories." },
      { kpiName: "Social Engineering", score: 60, kpiType: "Threat Exposure", summary: "Social engineering risk is elevated due to high-profile status.", recommendation: "Implement executive protection and vishing simulation programs." },
    ] as KpiRow[],
    httpHeaders: [
      { name: "Strict-Transport-Security", present: true, value: "max-age=31536000; includeSubDomains", description: "HSTS enabled.", recommendation: "Add preload directive." },
      { name: "Content-Security-Policy", present: false, value: null, description: "CSP not consistently implemented.", recommendation: "Implement CSP across all web properties." },
      { name: "X-Frame-Options", present: true, value: "SAMEORIGIN", description: "Partial clickjacking protection.", recommendation: "Consider DENY policy." },
      { name: "X-Content-Type-Options", present: true, value: "nosniff", description: "MIME protection.", recommendation: "No action required." },
    ],
    platform: "nginx",
    keyFindings: [
      "Multiple historical breach incidents requiring remediation evidence",
      "IoT device security framework needs development",
      "Source code leaks detected in public repositories",
    ],
    vulnerabilities: [
      { cveId: "CVE-2023-7890", severity: "High", affectedComponent: "Vehicle API", description: "Authentication bypass in vehicle data API allows unauthorized command execution." },
    ],
  },
];

async function main() {
  console.log("🔍 Finding TPRM-enabled customer accounts...");

  const accounts = await prisma.customerAccount.findMany({
    where: { isTprmAdded: true, isActive: true },
    select: { id: true, name: true },
  });

  if (accounts.length === 0) {
    console.log("⚠️  No TPRM-enabled accounts found. Run seed.ts first.");
    return;
  }

  console.log(`📋 Found ${accounts.length} account(s): ${accounts.map((a) => a.name).join(", ")}`);

  for (const account of accounts) {
    console.log(`\n🌱 Seeding monitoring data for: ${account.name} (${account.id})`);

    // Remove existing monitoring data for this account
    await prisma.tPRMMonitoringVendor.deleteMany({ where: { customerAccountId: account.id } });

    for (const v of VENDORS) {
      const vendor = await prisma.tPRMMonitoringVendor.create({
        data: {
          customerAccountId: account.id,
          vendorName: v.vendorName,
          vendorURL: v.vendorURL,
          vendorOnboarded: v.vendorOnboarded,
        },
      });

      const assessment = await prisma.tPRMMonitoringAssessment.create({
        data: {
          customerAccountId: account.id,
          monitoringVendorId: vendor.id,
          vendorName: v.vendorName,
          vendorURL: v.vendorURL,
          jobID: v.jobID,
          status: v.status,
          overallSummary: v.overallSummary,
          overallScore: v.overallScore,
          securityPostureScore: v.securityPostureScore,
          threatExposureScore: v.threatExposureScore,
          securityPostureSummary: v.securityPostureSummary,
          threatExposureSummary: v.threatExposureSummary,
          lastScan: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // random within last 7 days
          nextScan: "In 30 days",
          isLatest: true,
          downloadType: "PDF",
          calculatedOverallScore: v.calculatedOverallScore,
          calculatedSecurityPosture: v.calculatedSecurityPosture,
          calculatedThreatExposure: v.calculatedThreatExposure,
        },
      });

      // Compliance & Legal
      const cal = await prisma.tPRMComplianceAndLegal.create({
        data: {
          assessmentId: assessment.id,
          privacyPolicyUrl: v.privacyPolicyUrl,
          dpaUrl: v.dpaUrl,
        },
      });
      if (v.laws.length > 0) {
        await prisma.tPRMLaw.createMany({ data: v.laws.map((l) => ({ complianceId: cal.id, lawName: l })) });
      }
      if (v.certifications.length > 0) {
        await prisma.tPRMCertification.createMany({ data: v.certifications.map((c) => ({ complianceId: cal.id, name: c })) });
      }

      // Recommendation
      await prisma.tPRMMonitoringRecommendation.create({
        data: { assessmentId: assessment.id, statement: v.recommendation },
      });

      // KPI Details
      for (const kpi of v.kpis) {
        const kpiRecord = await prisma.tPRMKPIDetail.create({
          data: {
            assessmentId: assessment.id,
            kpiName: kpi.kpiName,
            kpiType: kpi.kpiType,
            securityScore: kpi.score,
            summary: kpi.summary,
            recommendation: kpi.recommendation,
            riskScore: Math.max(0, 100 - kpi.score),
          },
        });

        // Key findings for the first vendor only (to have sample data)
        if (v.vendorName === "CSFloat" && v.keyFindings.length > 0) {
          await prisma.tPRMKeyFinding.createMany({
            data: v.keyFindings.map((f) => ({ kpiDetailId: kpiRecord.id, statement: f })),
          });
        }

        // Sources
        await prisma.tPRMSource.createMany({
          data: [
            { kpiDetailId: kpiRecord.id, name: "SecurityScorecard" },
            { kpiDetailId: kpiRecord.id, name: "Bitsight" },
          ],
        });

        // Vulnerabilities
        if (v.vulnerabilities.length > 0 && kpi.kpiName === "Application Security") {
          await prisma.tPRMVulnerabilityFinding.createMany({
            data: v.vulnerabilities.map((vuln) => ({
              kpiDetailId: kpiRecord.id,
              cveId: vuln.cveId,
              severity: vuln.severity,
              affectedComponent: vuln.affectedComponent,
              description: vuln.description,
            })),
          });
        }
      }

      // HTTP Headers
      for (const hdr of v.httpHeaders) {
        const hdrRecord = await prisma.tPRMHTTPHeader.create({
          data: {
            assessmentId: assessment.id,
            name: hdr.name,
            present: hdr.present,
            value: hdr.value,
            recommendation: hdr.recommendation,
            description: hdr.description,
          },
        });
        if (v.platform) {
          await prisma.tPRMPlatform.create({ data: { httpHeaderId: hdrRecord.id, server: v.platform } });
        }
      }

      console.log(`  ✅ ${v.vendorName} (score: ${v.overallScore})`);
    }
  }

  console.log("\n✨ Monitoring seed completed successfully!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
