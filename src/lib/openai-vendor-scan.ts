/**
 * OpenAI-Powered Vendor Risk Scoring (Two-Phase Intelligence Gathering)
 *
 * Replaces the external Python backend for TPRM monitoring scans.
 *
 * Flow:
 *   Phase 0: Real HTTP header scan (fetch vendor URL, parse 10 security headers)
 *   Phase 1: Multi-query intelligence gathering — 16+ targeted web searches
 *            using OpenAI Responses API with web_search tool, gathering evidence
 *            into categorized buckets (breach, vulnerability, compliance, etc.)
 *   Phase 2: Feed ALL gathered intelligence + header scan into GPT for
 *            structured JSON assessment across 14 KPIs
 *   Phase 3: Normalize scores, merge real headers, return unified result
 *
 * Key principle: Scores are based on REAL web-sourced evidence, not LLM hallucination.
 */

import OpenAI from 'openai';

// ==================== CONFIGURATION ====================

const getClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
  return new OpenAI({ apiKey });
};

// ==================== TYPES ====================

export interface VendorScanRequest {
  vendorName: string;
  vendorURL: string;
}

export interface VendorScanResult {
  vendor_name: string;
  vendor_url: string;
  vendor_domain: string;
  overall_summary: string;
  overall_score: number;
  securityPostureScore: number;
  threatExposureScore: number;
  security_posture_summary: string;
  threat_exposure_summary: string;
  compliance_and_legal: {
    privacy_policy_url: string | null;
    dpa_url: string | null;
    laws: string[];
    certifications: string[];
  };
  recommendations: string[];
  kpi_details: KPIDetail[];
  http_security_headers: {
    http_security_headers: HTTPHeaderResult[];
    platform: { server: string; x_powered_by: string | null; guessed_stack: string | null } | null;
    error: string | null;
  };
}

interface KPIDetail {
  kpi_name: string;
  kpi_type: 'security_posture' | 'threat_exposure';
  summary: string;
  key_findings: string[];
  sources: string[];
  security_score: number;
  risk_score: number;
  vulnerabilities: {
    CVE_ID?: string;
    cve_id?: string;
    severity?: string;
    affected_component?: string;
    description?: string;
    source?: string;
  }[];
  recommendation: string;
}

interface HTTPHeaderResult {
  name: string;
  present: boolean;
  value: string | null;
  description: string;
  recommendation: string;
}

interface IntelligenceItem {
  title: string;
  url: string;
  snippet: string;
}

interface IntelligenceBuckets {
  breach_info: IntelligenceItem[];
  vulnerability_info: IntelligenceItem[];
  security_info: IntelligenceItem[];
  certification_info: IntelligenceItem[];
  dns_email_info: IntelligenceItem[];
  ssl_tls_info: IntelligenceItem[];
  ip_reputation_info: IntelligenceItem[];
  privacy_info: IntelligenceItem[];
  dark_web_info: IntelligenceItem[];
  news_info: IntelligenceItem[];
}

// ==================== REAL HTTP HEADER SCAN ====================

interface ScannedHeaders {
  headers: HTTPHeaderResult[];
  platform: { server: string; x_powered_by: string | null; guessed_stack: string | null } | null;
}

const SECURITY_HEADERS_TO_CHECK = [
  {
    name: 'Content-Security-Policy',
    description: 'Restricts what content the browser can load to prevent XSS.',
    recommendation: "Use a strict CSP such as default-src 'self'; object-src 'none'.",
  },
  {
    name: 'Strict-Transport-Security',
    description: 'Forces HTTPS to protect against protocol downgrade attacks.',
    recommendation: 'Set HSTS max-age >= 31536000 with includeSubDomains and preload.',
  },
  {
    name: 'X-Content-Type-Options',
    description: 'Prevents MIME type sniffing.',
    recommendation: "Always set to 'nosniff' to avoid content-type attacks.",
  },
  {
    name: 'X-Frame-Options',
    description: 'Prevents clickjacking attacks.',
    recommendation: 'Use SAMEORIGIN or DENY unless framing is required.',
  },
  {
    name: 'Referrer-Policy',
    description: 'Controls how much referrer information is leaked.',
    recommendation: 'Use strict-origin-when-cross-origin or stricter.',
  },
  {
    name: 'Permissions-Policy',
    description: 'Controls access to browser features (camera, mic, geolocation).',
    recommendation: 'Add a restrictive Permissions-Policy to disable unused features.',
  },
  {
    name: 'X-XSS-Protection',
    description: 'Legacy XSS filter hint for older browsers.',
    recommendation: 'Set to "1; mode=block" or rely on CSP instead.',
  },
  {
    name: 'Cross-Origin-Opener-Policy',
    description: 'Isolates browsing context to prevent cross-origin attacks.',
    recommendation: 'Set to same-origin for sensitive pages.',
  },
  {
    name: 'Cross-Origin-Resource-Policy',
    description: 'Controls which origins can load the resource.',
    recommendation: 'Set to same-origin or cross-origin as needed.',
  },
  {
    name: 'Cross-Origin-Embedder-Policy',
    description: 'Prevents loading cross-origin resources without explicit permission.',
    recommendation: 'Set to require-corp for full cross-origin isolation.',
  },
];

async function scanHTTPHeaders(url: string): Promise<ScannedHeaders> {
  const headers: HTTPHeaderResult[] = [];
  let platform: ScannedHeaders['platform'] = null;

  try {
    let targetUrl = url;
    if (!targetUrl.startsWith('http')) targetUrl = `https://${targetUrl}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(targetUrl, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    clearTimeout(timeout);

    for (const check of SECURITY_HEADERS_TO_CHECK) {
      const value = response.headers.get(check.name.toLowerCase());
      headers.push({
        name: check.name,
        present: value !== null,
        value: value || 'Not Present',
        description: check.description,
        recommendation: check.recommendation,
      });
    }

    const server = response.headers.get('server');
    const xPoweredBy = response.headers.get('x-powered-by');
    if (server || xPoweredBy) {
      const guessedParts: string[] = [];
      if (server) {
        const s = server.toLowerCase();
        if (s.includes('nginx')) guessedParts.push('nginx');
        if (s.includes('apache')) guessedParts.push('Apache HTTPD');
        if (s.includes('iis')) guessedParts.push('Microsoft IIS');
      }
      if (xPoweredBy) {
        const xp = xPoweredBy.toLowerCase();
        if (xp.includes('php')) guessedParts.push('PHP');
        if (xp.includes('asp.net')) guessedParts.push('ASP.NET');
        if (xp.includes('express')) guessedParts.push('Node.js / Express');
      }
      platform = {
        server: server || 'unknown',
        x_powered_by: xPoweredBy,
        guessed_stack: guessedParts.length > 0 ? guessedParts.join(', ') : null,
      };
    }

    console.log(`[VendorScan] HTTP headers scanned for ${targetUrl}: ${headers.filter(h => h.present).length}/${headers.length} present`);
  } catch (err) {
    console.error(`[VendorScan] Failed to scan HTTP headers for ${url}:`, err);
    for (const check of SECURITY_HEADERS_TO_CHECK) {
      headers.push({
        name: check.name,
        present: false,
        value: 'Not Present',
        description: check.description,
        recommendation: check.recommendation,
      });
    }
  }

  return { headers, platform };
}

// ==================== PHASE 1: MULTI-QUERY INTELLIGENCE GATHERING ====================

/**
 * Execute a single web search query using OpenAI Responses API with web_search tool.
 * Returns structured results with title, url, snippet.
 */
async function webSearch(client: OpenAI, query: string): Promise<IntelligenceItem[]> {
  try {
    const response = await client.responses.create({
      model: 'gpt-4o-mini',
      tools: [{ type: 'web_search_preview' as const, search_context_size: 'high' as const }],
      input: [
        {
          role: 'system',
          
          content:
            'You are a cybersecurity web search assistant for TPRM. ' +
            'Use the web_search tool to find relevant security information. ' +
            'Respond ONLY with valid JSON (no markdown fences): ' +
            '{"results": [{"title": "...", "url": "...", "snippet": "..."}]} ' +
            'Each snippet should be 40-80 words explaining security/TPRM relevance.',
        },
        {
          role: 'user',
          content: `Search the web for this query and provide up to 5 relevant results:\n"${query}"`,
        },
      ],
      // NOTE: Cannot use text.format json_object with web_search — parse manually
    });

    const rawText = response.output_text;
    if (!rawText) return [];

    // Extract JSON from the response (may be wrapped in markdown fences)
    let jsonStr = rawText.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(jsonStr);
    } catch {
      // Try to find JSON object in the text
      const braceMatch = rawText.match(/\{[\s\S]*\}/);
      if (!braceMatch) return [];
      data = JSON.parse(braceMatch[0]);
    }

    const results = (data.results || []) as Record<string, unknown>[];
    if (!Array.isArray(results)) return [];

    return results
      .filter((r) => r && typeof r.url === 'string' && (r.url as string).trim())
      .map((r) => ({
        title: String(r.title || query).trim(),
        url: String(r.url).trim(),
        snippet: String(r.snippet || '').trim(),
      }));
  } catch (err) {
    console.warn(`[VendorScan] Web search failed for "${query.substring(0, 60)}...":`, err);
    return [];
  }
}

/**
 * Build all targeted search queries for a vendor, organized by KPI category.
 */
function buildSearchQueries(vendorName: string, domain: string, vendorURL: string): { query: string; bucket: keyof IntelligenceBuckets }[] {
  return [
    // Breach / Information Leak
    { query: `${vendorName} security breach data leak incident`, bucket: 'breach_info' },
    { query: `${vendorName} cyber attack ransomware "data breach"`, bucket: 'breach_info' },
    { query: `${vendorName} "security incident" notification disclosure`, bucket: 'breach_info' },

    // Vulnerabilities / Application Security / Network Security
    { query: `${vendorName} vulnerabilities CVE security issues web application`, bucket: 'vulnerability_info' },
    { query: `${vendorName} external attack surface scan network security open ports firewall`, bucket: 'security_info' },
    { query: `${vendorName} web application security pentest bug bounty program`, bucket: 'security_info' },

    // DNS Health + Email Security
    {
      query: `For the vendor ${vendorName} (website: ${vendorURL}, domain: ${domain}), provide a detailed assessment of its DNS infrastructure and resilience. Identify which DNS service the company uses, whether DNSSEC is enabled, SPF/DKIM/DMARC configuration status, and overall DNS health. Include key findings and public documentation links.`,
      bucket: 'dns_email_info',
    },

    // Patching Cadence
    { query: `${vendorName} patch management vulnerability management security updates cadence`, bucket: 'security_info' },

    // Endpoint Security
    { query: `${vendorName} endpoint security EDR antivirus device protection fleet security`, bucket: 'security_info' },

    // IP Reputation
    { query: `${domain} IP reputation Talos Spamhaus blacklist spam malware`, bucket: 'ip_reputation_info' },

    // Email Security (SPF/DKIM/DMARC)
    {
      query: `For the vendor ${vendorName} (domain: ${domain}), provide a detailed assessment of its email security configuration focusing on SPF, DKIM, and DMARC. Determine the current DMARC policy (none, quarantine, reject) and whether aggregate/forensic reporting is enabled. Include key findings and sources.`,
      bucket: 'dns_email_info',
    },

    // SSL/TLS Configuration
    {
      query: `For the vendor ${vendorName} (domain: ${domain}), provide a detailed assessment of its SSL/TLS configuration and HTTPS security posture. Evaluate supported protocol versions, cipher suites, certificate validity, and HSTS presence. Include SSL Labs grade if available and sources.`,
      bucket: 'ssl_tls_info',
    },

    // Privacy
    { query: `${vendorName} privacy policy GDPR CCPA data protection`, bucket: 'privacy_info' },

    // Cubit Score / External Rating
    { query: `${vendorName} security rating security score BitSight SecurityScorecard`, bucket: 'security_info' },

    // Hacker Chatter / Dark Web
    { query: `${vendorName} "dark web" "hacker forum" "hacker chatter" credentials`, bucket: 'dark_web_info' },

    // Information Leak (credentials)
    { query: `${vendorName} credential leak password dump database exposed`, bucket: 'breach_info' },

    // Social Engineering / Phishing
    { query: `${vendorName} phishing campaign social engineering targeting employees`, bucket: 'dark_web_info' },

    // Compliance & Certifications
    { query: `${vendorName} ISO 27001 SOC 2 PCI-DSS security compliance certification`, bucket: 'certification_info' },

    // General security posture
    { query: `${vendorName} cybersecurity posture security controls incident response`, bucket: 'security_info' },

    // Recent security news
    { query: `${vendorName} security news vulnerability disclosure 2024 2025`, bucket: 'news_info' },
  ];
}

/**
 * Phase 1: Gather vendor intelligence via multiple targeted web searches.
 * Runs searches concurrently in batches to balance speed vs rate limits.
 */
async function gatherVendorIntelligence(
  client: OpenAI,
  vendorName: string,
  vendorURL: string,
): Promise<IntelligenceBuckets> {
  const domain = vendorURL.replace(/^https?:\/\//, '').split('/')[0];
  const queries = buildSearchQueries(vendorName, domain, vendorURL);

  const buckets: IntelligenceBuckets = {
    breach_info: [],
    vulnerability_info: [],
    security_info: [],
    certification_info: [],
    dns_email_info: [],
    ssl_tls_info: [],
    ip_reputation_info: [],
    privacy_info: [],
    dark_web_info: [],
    news_info: [],
  };

  console.log(`[VendorScan] Phase 1: Running ${queries.length} targeted web searches...`);

  // Run searches in batches of 4 to avoid rate limits
  const BATCH_SIZE = 4;
  const TARGET_ITEMS = 30;
  let totalItems = 0;

  for (let i = 0; i < queries.length; i += BATCH_SIZE) {
    const batch = queries.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.allSettled(
      batch.map(({ query }) => webSearch(client, query)),
    );

    for (let j = 0; j < batch.length; j++) {
      const result = batchResults[j];
      if (result.status === 'fulfilled' && result.value.length > 0) {
        const bucketKey = batch[j].bucket;
        buckets[bucketKey].push(...result.value);
        totalItems += result.value.length;
      }
    }

    console.log(`[VendorScan]   Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${totalItems} total items gathered`);

    // Early exit if we have enough intelligence
    if (totalItems >= TARGET_ITEMS) {
      console.log(`[VendorScan]   Reached target of ${TARGET_ITEMS} items, stopping early`);
      break;
    }

    // Brief pause between batches to be gentle on rate limits
    if (i + BATCH_SIZE < queries.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  console.log(`[VendorScan] Phase 1 complete: ${totalItems} intelligence items across ${Object.entries(buckets).filter(([, v]) => v.length > 0).length} categories`);
  return buckets;
}

// ==================== PHASE 2: FORMAT INTELLIGENCE FOR LLM ====================

function formatIntelligenceForLLM(intel: IntelligenceBuckets, vendorName: string): string {
  const sections: string[] = [];
  sections.push(`\n=== REAL-TIME WEB INTELLIGENCE GATHERED FOR ${vendorName.toUpperCase()} ===\n`);

  const bucketLabels: [keyof IntelligenceBuckets, string, number][] = [
    ['breach_info', 'BREACH & DATA LEAK INFORMATION', 10],
    ['vulnerability_info', 'VULNERABILITY INFORMATION', 10],
    ['security_info', 'SECURITY POSTURE INFORMATION', 10],
    ['dns_email_info', 'DNS HEALTH & EMAIL SECURITY', 8],
    ['ssl_tls_info', 'SSL/TLS CONFIGURATION', 8],
    ['ip_reputation_info', 'IP & DOMAIN REPUTATION', 8],
    ['privacy_info', 'PRIVACY & DATA PROTECTION', 8],
    ['certification_info', 'CERTIFICATIONS & COMPLIANCE', 8],
    ['dark_web_info', 'DARK WEB & SOCIAL ENGINEERING', 8],
    ['news_info', 'RECENT SECURITY NEWS', 5],
  ];

  let hasAnyIntel = false;
  for (const [key, label, maxItems] of bucketLabels) {
    const items = intel[key];
    if (items.length > 0) {
      hasAnyIntel = true;
      sections.push(`--- ${label} ---`);
      for (const item of items.slice(0, maxItems)) {
        sections.push(`- ${item.title}\n  URL: ${item.url}\n  ${item.snippet}\n`);
      }
    }
  }

  if (!hasAnyIntel) {
    sections.push(
      'No real-time intelligence was gathered from web searches. ' +
      'Base your assessment on general cybersecurity best practices and ' +
      'clearly acknowledge the lack of external evidence in each KPI.',
    );
  }

  sections.push('\n=== END OF INTELLIGENCE REPORT ===\n');
  return sections.join('\n');
}

// ==================== PHASE 2: ASSESSMENT PROMPT ====================

const ASSESSMENT_SYSTEM_PROMPT = `Act as a world-class cybersecurity threat intelligence and Third-Party Risk Management (TPRM) analyst. You are performing a comprehensive vendor threat and risk assessment.

You have access to:
1) The vendor's name and website/domain.
2) Real-time intelligence gathered from web searches (provided in the user message).
3) Live HTTP security header scan results.

Your output MUST be a single VALID JSON object. DO NOT include any text outside the JSON.

You must assess the vendor across 14 KPIs:

Security Posture KPIs (kpi_type: "security_posture"):
- Network Security, DNS Health, Patching Cadence, Endpoint Security, IP Reputation,
  Application Security, Cubit Score, Email Security, SSL/TLS Configuration, Privacy

Threat Exposure KPIs (kpi_type: "threat_exposure"):
- Known Breach, Hacker Chatter, Information Leak, Social Engineering

For EACH KPI provide:
{
  "kpi_name": "KPI Name",
  "kpi_type": "security_posture" or "threat_exposure",
  "summary": "detailed paragraph based on gathered intelligence",
  "key_findings": ["2-5 specific facts from the intelligence, NOT generic statements"],
  "sources": ["real URLs from the gathered intelligence"],
  "security_score": integer 0-100 (higher = better security),
  "risk_score": integer 0-100 (MUST equal 100 - security_score),
  "vulnerabilities": [{"cve_id": "CVE-XXXX-XXXXX", "severity": "low|medium|high", "affected_component": "...", "description": "...", "source": "URL"}],
  "recommendation": "specific actionable recommendation"
}

SCORING RULES:
- security_score: 0-100, higher = better security (lower risk)
- risk_score: MUST equal 100 - security_score
- securityPostureScore: average of security_scores for all 10 Security Posture KPIs
- threatExposureScore: average of security_scores for all 4 Threat Exposure KPIs
- overall_score: weighted average (security_posture 60% + threat_exposure 40%)
- Be HONEST with scores. If evidence shows problems, score low. If no evidence found, score conservatively (60-70).

CRITICAL RULES:
- Base your assessment on the REAL intelligence provided. Do NOT fabricate data.
- Only include CVE IDs that appear in the gathered intelligence.
- Sources must be real URLs from the intelligence report.
- If no intelligence was found for a KPI, say so honestly.
- Be specific to THIS vendor, not generic cybersecurity advice.

REQUIRED JSON STRUCTURE:
{
  "vendor_name": "string",
  "vendor_domain": "string",
  "overall_summary": "3-5 sentence comprehensive summary",
  "overall_score": integer,
  "securityPostureScore": integer,
  "threatExposureScore": integer,
  "security_posture_summary": "2-3 sentence analysis",
  "threat_exposure_summary": "2-3 sentence analysis",
  "compliance_and_legal": {
    "privacy_policy_url": "string or null",
    "dpa_url": "string or null",
    "laws": ["applicable laws/regulations"],
    "certifications": ["security certifications found"]
  },
  "recommendations": ["5-10 actionable recommendations"],
  "kpi_details": [
    { ...KPI_OBJECT for each of the 14 KPIs... }
  ]
}

Return ONLY this JSON, nothing else.`;

// ==================== SCORE NORMALIZATION ====================

function normalizeScores(result: Record<string, unknown>): void {
  const clamp = (v: unknown): number | null => {
    if (v === null || v === undefined) return null;
    const n = Math.round(Number(v));
    return isNaN(n) ? null : Math.max(0, Math.min(100, n));
  };

  const kpiDetails = result.kpi_details as KPIDetail[] | undefined;
  if (!Array.isArray(kpiDetails)) return;

  const spScores: number[] = [];
  const teScores: number[] = [];

  for (const kpi of kpiDetails) {
    let sec = clamp(kpi.security_score);
    let risk = clamp(kpi.risk_score);

    // Derive missing from the other
    if (sec === null && risk !== null) sec = 100 - risk;
    else if (sec !== null && risk === null) risk = 100 - sec;

    // Heuristic fallback if both missing
    if (sec === null) {
      let base = 70;
      const text = [kpi.summary, ...(kpi.key_findings || [])].join(' ').toLowerCase();
      const negativeTerms = ['breach', 'ransomware', 'exploit', 'leak', 'compromise', 'exposed', 'critical', 'incident'];
      const positiveTerms = ['iso 27001', 'soc 2', 'certified', 'encryption', 'mfa', 'patch', 'bug bounty'];

      if (negativeTerms.some(t => text.includes(t))) base -= 15;
      if (positiveTerms.some(t => text.includes(t))) base += 5;
      if (Array.isArray(kpi.vulnerabilities) && kpi.vulnerabilities.length > 0) {
        base -= 10 * Math.min(3, kpi.vulnerabilities.length);
      }

      sec = Math.max(0, Math.min(100, Math.round(base)));
      risk = 100 - sec;
    }

    kpi.security_score = sec!;
    kpi.risk_score = 100 - sec!;

    if (kpi.kpi_type === 'security_posture') spScores.push(sec!);
    else if (kpi.kpi_type === 'threat_exposure') teScores.push(sec!);
  }

  // Category scores
  const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 65;
  const spAvg = avg(spScores);
  const teAvg = avg(teScores);

  result.securityPostureScore = clamp(result.securityPostureScore) ?? spAvg;
  result.threatExposureScore = clamp(result.threatExposureScore) ?? teAvg;

  // Overall: 60% SP + 40% TE
  const computedOverall = Math.round(spAvg * 0.6 + teAvg * 0.4);
  result.overall_score = clamp(result.overall_score) ?? computedOverall;
}

// ==================== MAIN SCAN FUNCTION ====================

/**
 * Run a complete vendor risk assessment using two-phase intelligence gathering.
 * Phase 0: Real HTTP header scan
 * Phase 1: Multi-query web intelligence gathering (16+ searches)
 * Phase 2: GPT assessment with all gathered evidence
 * Phase 3: Score normalization + result assembly
 */
export async function runVendorScan(request: VendorScanRequest): Promise<VendorScanResult> {
  const { vendorName, vendorURL } = request;
  const domain = vendorURL.replace(/^https?:\/\//, '').split('/')[0];
  console.log(`[VendorScan] Starting two-phase scan for: ${vendorName} (${vendorURL})`);

  const client = getClient();

  // Phase 0: Real HTTP header scan (runs in parallel with Phase 1)
  console.log('[VendorScan] Phase 0: Scanning HTTP security headers...');
  const [scannedHeaders, intelligence] = await Promise.all([
    scanHTTPHeaders(vendorURL),
    gatherVendorIntelligence(client, vendorName, vendorURL),
  ]);

  // Format header scan results for the LLM
  const headerLines = ['=== LIVE HTTP SECURITY HEADER SCAN ==='];
  for (const h of scannedHeaders.headers) {
    headerLines.push(`- ${h.name}: ${h.present ? `present (${h.value})` : 'missing'}`);
  }
  if (scannedHeaders.platform) {
    headerLines.push(
      `Platform: Server=${scannedHeaders.platform.server}, ` +
      `X-Powered-By=${scannedHeaders.platform.x_powered_by || 'N/A'}, ` +
      `Stack=${scannedHeaders.platform.guessed_stack || 'N/A'}`,
    );
  }
  const headerContext = headerLines.join('\n');

  // Format intelligence for the LLM
  const intelligenceContext = formatIntelligenceForLLM(intelligence, vendorName);

  // Phase 2: Final GPT assessment with all gathered evidence
  console.log('[VendorScan] Phase 2: Running GPT assessment with gathered intelligence...');

  const userPrompt = `Perform a comprehensive TPRM risk assessment for the following vendor and return the results in JSON format:

Vendor Name: ${vendorName}
Vendor URL: ${vendorURL}
Domain: ${domain}

${intelligenceContext}

${headerContext}

INSTRUCTIONS:
1. Analyze ALL the real-time intelligence provided above carefully.
2. Use the JSON schema and constraints specified in the system prompt.
3. Assign realistic SECURITY scores (0-100 integers; higher = better security, lower risk).
4. Include risk_score = 100 - security_score for every KPI.
5. List ALL relevant source URLs from the intelligence.
6. Only include real CVE IDs if found in the intelligence.
7. Provide detailed, actionable recommendations specific to this vendor.
8. Return the complete assessment as a valid JSON object (no extra text).`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: ASSESSMENT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    max_completion_tokens: 16000,
  });

  const outputText = response.choices[0]?.message?.content;
  if (!outputText) {
    throw new Error('OpenAI returned empty response');
  }

  console.log(`[VendorScan] Phase 2 complete: ${outputText.length} chars received`);

  // Phase 3: Parse, normalize, and assemble
  let aiResult: Record<string, unknown>;
  try {
    aiResult = JSON.parse(outputText);
  } catch {
    console.error('[VendorScan] Failed to parse GPT JSON:', outputText.substring(0, 500));
    throw new Error('Failed to parse AI response as JSON');
  }

  // Normalize scores (handles missing/inconsistent values)
  normalizeScores(aiResult);

  const clamp = (v: unknown, fallback: number): number => {
    const n = typeof v === 'number' ? v : fallback;
    return Math.max(0, Math.min(100, Math.round(n)));
  };

  // Validate KPIs
  const rawKpis = aiResult.kpi_details as KPIDetail[] | undefined;
  const validatedKpis: KPIDetail[] = (rawKpis || []).map(kpi => ({
    ...kpi,
    security_score: clamp(kpi.security_score, 50),
    risk_score: clamp(kpi.risk_score, 50),
    key_findings: Array.isArray(kpi.key_findings) ? kpi.key_findings : [],
    sources: Array.isArray(kpi.sources) ? kpi.sources : [],
    vulnerabilities: Array.isArray(kpi.vulnerabilities) ? kpi.vulnerabilities : [],
  }));

  // Merge real HTTP headers
  const httpSecurityHeaders = {
    http_security_headers: [
      ...scannedHeaders.headers,
      ...(scannedHeaders.platform
        ? [{ platform: scannedHeaders.platform } as unknown as HTTPHeaderResult]
        : []),
    ],
    platform: scannedHeaders.platform,
    error: null,
  };

  const complianceLegal = aiResult.compliance_and_legal as Record<string, unknown> | undefined;
  const result: VendorScanResult = {
    vendor_name: vendorName,
    vendor_url: vendorURL.startsWith('http') ? vendorURL : `https://${vendorURL}`,
    vendor_domain: domain,
    overall_summary: String(aiResult.overall_summary || ''),
    overall_score: clamp(aiResult.overall_score, 50),
    securityPostureScore: clamp(aiResult.securityPostureScore, 50),
    threatExposureScore: clamp(aiResult.threatExposureScore, 50),
    security_posture_summary: String(aiResult.security_posture_summary || ''),
    threat_exposure_summary: String(aiResult.threat_exposure_summary || ''),
    compliance_and_legal: {
      privacy_policy_url: (complianceLegal?.privacy_policy_url as string) || null,
      dpa_url: (complianceLegal?.dpa_url as string) || null,
      laws: Array.isArray(complianceLegal?.laws) ? complianceLegal.laws as string[] : [],
      certifications: Array.isArray(complianceLegal?.certifications) ? complianceLegal.certifications as string[] : [],
    },
    recommendations: Array.isArray(aiResult.recommendations) ? aiResult.recommendations as string[] : [],
    kpi_details: validatedKpis,
    http_security_headers: httpSecurityHeaders,
  };

  const totalIntel = Object.values(intelligence).reduce((sum, arr) => sum + arr.length, 0);
  console.log(`[VendorScan] Scan complete: ${vendorName} — overall=${result.overall_score}, SP=${result.securityPostureScore}, TE=${result.threatExposureScore}, KPIs=${validatedKpis.length}, intel_items=${totalIntel}`);
  return result;
}
