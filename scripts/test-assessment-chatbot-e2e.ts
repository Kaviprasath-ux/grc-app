/**
 * End-to-end per-role test for the TPRM Assessment chatbot.
 *
 * For each seeded role user:
 *   1. NextAuth credentials login (CSRF + callback/credentials).
 *   2. Fire a fixed matrix of questions at /api/ai/chat.
 *   3. Capture the answer + intent + confidence.
 *   4. Write a markdown summary to scripts/out/assessment-chatbot-e2e.md.
 *
 * Run: npx tsx scripts/test-assessment-chatbot-e2e.ts
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";

type UserProfile = {
  label: string;
  username: string;
  password: string;
  /** What the test expects this role to be able to query. */
  expectedAccess: "full-tenant" | "broad" | "am-scoped" | "factory-only" | "denied";
  notes?: string;
};

// Users that actually exist in the dev DB (tenant cmma8yemp0001tsfuwz6psruz / GRC_002).
// Only 1 assessment exists: ASM001 — Submitted, vendor=hdfc, initiatedBy=rm, assessor+approver null.
const USERS: UserProfile[] = [
  { label: "GRCAdministrator",   username: "superadmin", password: "Baarez@2025", expectedAccess: "full-tenant",
    notes: "Lives in a different tenant (grc-admin-account-1) — should see 0 assessments due to tenant isolation." },
  { label: "TPRMAdmin",            username: "tprmadmin", password: "1", expectedAccess: "full-tenant",
    notes: "TPRM super-admin in GRC_002 — must answer every assessment question with no scoping restrictions." },
  { label: "CustomerAdministrator", username: "tprm",    password: "1", expectedAccess: "denied",
    notes: "No tprm.assessments permission — every assessment query should return an access-denied message." },
  { label: "RelationshipManager",  username: "rm",       password: "1", expectedAccess: "broad" },
  { label: "BusinessOwner",        username: "bo",       password: "1", expectedAccess: "broad" },
  { label: "TPRMAssessor",         username: "assessor", password: "1", expectedAccess: "broad" },
  { label: "TPRMApprover",         username: "approvar", password: "1", expectedAccess: "broad" },
  { label: "AccountManager",       username: "hdfc",     password: "1", expectedAccess: "am-scoped",
    notes: "AM email hdfc@1.com matches vendor hdfc.accountManagerEmail — should see ASM001." },
];

type Question = {
  id: string;
  text: string;
  category: "count" | "detail" | "my-queue" | "status-filter" | "cross-role";
};

/** Question matrix fired at every role. */
const QUESTIONS: Question[] = [
  { id: "Q1", text: "How many vendor assessments do we have in total?",                      category: "count" },
  { id: "Q2", text: "How many completed assessments are there?",                             category: "status-filter" },
  { id: "Q3", text: "Show me the details of assessment ASM001",                              category: "detail" },
  { id: "Q4", text: "Who is the assessor of assessment ASM001?",                             category: "detail" },
  { id: "Q5", text: "Who is the approver of assessment ASM002?",                             category: "detail" },
  { id: "Q6", text: "How many assessments are assigned to me?",                              category: "my-queue" },
  { id: "Q7", text: "List assessments with status Submitted",                                category: "status-filter" },
  { id: "Q8", text: "How many Assessment Factory type assessments are there?",               category: "status-filter" },
];

// ==================== HTTP / auth helpers ====================

type Cookies = Map<string, string>;

function serializeCookies(jar: Cookies): string {
  return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
}

function mergeSetCookie(jar: Cookies, setCookieHeaders: string[]): void {
  for (const line of setCookieHeaders) {
    const firstPair = line.split(";")[0];
    const eq = firstPair.indexOf("=");
    if (eq === -1) continue;
    const name = firstPair.slice(0, eq).trim();
    const value = firstPair.slice(eq + 1).trim();
    if (!name) continue;
    jar.set(name, value);
  }
}

async function fetchWithCookies(
  jar: Cookies,
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (jar.size > 0) headers.set("cookie", serializeCookies(jar));
  const res = await fetch(url, { ...init, headers, redirect: "manual" });
  const setCookie = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() || [];
  mergeSetCookie(jar, setCookie);
  return res;
}

async function login(user: UserProfile): Promise<{ jar: Cookies; ok: boolean; detail: string }> {
  const jar: Cookies = new Map();

  // 1. Get CSRF token
  const csrfRes = await fetchWithCookies(jar, `${BASE_URL}/api/auth/csrf`);
  if (!csrfRes.ok) return { jar, ok: false, detail: `CSRF fetch HTTP ${csrfRes.status}` };
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  // 2. Submit credentials via NextAuth callback
  const body = new URLSearchParams({
    csrfToken,
    username: user.username,
    password: user.password,
    callbackUrl: `${BASE_URL}/`,
    json: "true",
  });
  const callbackRes = await fetchWithCookies(jar, `${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  // 3. Check session was issued
  const sessionRes = await fetchWithCookies(jar, `${BASE_URL}/api/auth/session`);
  const session = (await sessionRes.json()) as { user?: { name?: string; roles?: string[] } } | null;

  const hasUser = !!session?.user && Array.isArray(session.user.roles);
  return {
    jar,
    ok: hasUser,
    detail: hasUser
      ? `roles=[${session!.user!.roles!.join(", ")}] callback=HTTP ${callbackRes.status}`
      : `no session after login (callback HTTP ${callbackRes.status})`,
  };
}

// ==================== Chat call ====================

type ChatAnswer = {
  question: string;
  answer: string;
  intent: string;
  confidence: string;
  isDataQuery?: boolean;
  error?: string;
  elapsedMs: number;
};

async function askChat(jar: Cookies, query: string): Promise<ChatAnswer> {
  const started = Date.now();
  try {
    const res = await fetchWithCookies(jar, `${BASE_URL}/api/ai/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, conversationHistory: [], agentMode: false }),
    });
    const json = (await res.json()) as {
      answer?: string;
      intent?: string;
      confidence?: string;
      isDataQuery?: boolean;
      error?: boolean;
    };
    return {
      question: query,
      answer: (json.answer || "").trim(),
      intent: json.intent || "unknown",
      confidence: json.confidence || "unknown",
      isDataQuery: json.isDataQuery,
      error: json.error ? "server error flag" : undefined,
      elapsedMs: Date.now() - started,
    };
  } catch (err) {
    return {
      question: query,
      answer: "",
      intent: "error",
      confidence: "low",
      error: err instanceof Error ? err.message : String(err),
      elapsedMs: Date.now() - started,
    };
  }
}

// ==================== Runner ====================

type RoleReport = {
  user: UserProfile;
  loginDetail: string;
  answers: ChatAnswer[];
};

function truncate(s: string, n: number): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > n ? flat.slice(0, n) + "…" : flat;
}

function markdownTable(report: RoleReport): string {
  const rows = report.answers.map((a, i) => {
    const q = QUESTIONS[i];
    return `| ${q.id} | ${q.category} | ${truncate(q.text, 55)} | ${a.intent} | ${a.confidence} | ${truncate(a.answer, 180)} |`;
  });
  return [
    `| ID | Category | Question | Intent | Conf. | Answer |`,
    `|----|----------|----------|--------|-------|--------|`,
    ...rows,
  ].join("\n");
}

async function main() {
  const reports: RoleReport[] = [];

  for (const user of USERS) {
    process.stdout.write(`\n▶ ${user.label} (${user.username})\n`);
    const { jar, ok, detail } = await login(user);
    if (!ok) {
      console.log(`  ✗ login failed — ${detail}`);
      reports.push({ user, loginDetail: `FAILED: ${detail}`, answers: [] });
      continue;
    }
    console.log(`  ✓ login ok — ${detail}`);

    const answers: ChatAnswer[] = [];
    for (const q of QUESTIONS) {
      const a = await askChat(jar, q.text);
      const tag =
        a.intent === "data_query" ? "data" :
        a.intent === "kb_search"   ? "kb"   :
        a.intent === "blocked"     ? "BLOCK" :
        a.intent;
      console.log(`  · ${q.id} [${tag}] ${truncate(a.answer, 120)}`);
      answers.push(a);
    }
    reports.push({ user, loginDetail: detail, answers });
  }

  // ==================== Write markdown report ====================
  const outDir = join(process.cwd(), "scripts", "out");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "assessment-chatbot-e2e.md");

  const nowIso = new Date().toISOString();
  const md: string[] = [];
  md.push(`# TPRM Assessment Chatbot — Per-Role E2E Report`);
  md.push("");
  md.push(`_Generated: ${nowIso}_`);
  md.push("");
  md.push(`## Question matrix`);
  md.push("");
  md.push(`| ID | Category | Question |`);
  md.push(`|----|----------|----------|`);
  for (const q of QUESTIONS) md.push(`| ${q.id} | ${q.category} | ${q.text} |`);
  md.push("");

  for (const r of reports) {
    md.push(`## ${r.user.label} — \`${r.user.username}\``);
    md.push("");
    md.push(`- Expected access: **${r.user.expectedAccess}**`);
    if (r.user.notes) md.push(`- Notes: ${r.user.notes}`);
    md.push(`- Login: ${r.loginDetail}`);
    md.push("");
    if (r.answers.length === 0) {
      md.push("> (login failed — no questions asked)");
      md.push("");
      continue;
    }
    md.push(markdownTable(r));
    md.push("");
  }

  // Raw JSON for deeper inspection
  md.push(`## Raw answers (JSON)`);
  md.push("");
  md.push("```json");
  md.push(JSON.stringify(reports, null, 2));
  md.push("```");

  writeFileSync(outPath, md.join("\n"), "utf-8");
  console.log(`\n✓ Report written to ${outPath}`);
}

main().catch((err) => {
  console.error("Runner failed:", err);
  process.exit(1);
});
