# Help Chatbot — Implementation Guide & Future Roadmap

> **Version:** 1.0 (Phase 1 — Static Knowledge Base)
> **Last Updated:** March 2026
> **Total Files:** 7 new files, 2 modified files
> **Total Lines:** ~2,755 lines of code
> **Total Articles:** 73 knowledge base entries

---

## Table of Contents

1. [Current Architecture Overview](#1-current-architecture-overview)
2. [File Structure & Responsibilities](#2-file-structure--responsibilities)
3. [Knowledge Base Structure](#3-knowledge-base-structure)
4. [Search Engine](#4-search-engine)
5. [Product Scope & Role Isolation](#5-product-scope--role-isolation)
6. [UI Components](#6-ui-components)
7. [React Hook (State Management)](#7-react-hook-state-management)
8. [How to Add New Articles](#8-how-to-add-new-articles)
9. [How to Add a New Module Manual](#9-how-to-add-a-new-module-manual)
10. [i18n (Internationalization)](#10-i18n-internationalization)
11. [Future Phase 2 — RAG-Based AI Assistant](#11-future-phase-2--rag-based-ai-assistant)
12. [Future Phase 3 — AI Agentic (MCP Tools)](#12-future-phase-3--ai-agentic-mcp-tools)
13. [Future Phase 4 — Evidence Automation & Integrations](#13-future-phase-4--evidence-automation--integrations)
14. [UI Roadmap — Two-Tab Design](#14-ui-roadmap--two-tab-design)
15. [Migration Guide — Phase 1 → Phase 2](#15-migration-guide--phase-1--phase-2)
16. [Technical Integration Requirements](#16-technical-integration-requirements)

---

## 1. Current Architecture Overview

### What It Is
A **client-side knowledge base chatbot** embedded in the GRC application as a right-side Sheet panel. It provides instant, deterministic answers from pre-authored Q&A entries. **No AI/LLM involved** — purely TypeScript keyword/fuzzy search.

### Architecture Diagram

```
User types question
        │
        ▼
┌──────────────────────────────────┐
│  useHelpChatbot.ts (React Hook)  │
│  ├─ Reads session: roles,        │
│  │   isGrcAdded, isTprmAdded     │
│  ├─ Computes ProductFlags         │
│  │   (isAuditUser, isAuditOnly)  │
│  └─ Calls searchKnowledgeBase()  │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  help-search.ts (Search Engine)   │
│  ├─ filterArticles() — scope,     │
│  │   role, module filtering       │
│  ├─ 4-strategy scoring:           │
│  │   Exact +100, Token +50,       │
│  │   Keyword +30, Fuzzy +10       │
│  └─ Returns ScoredResult[]        │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  help-knowledge-base.ts (Data)    │
│  ├─ 73 articles (Q&A entries)     │
│  ├─ 8 module categories           │
│  └─ ProductScope per article      │
└──────────────────────────────────┘
```

### Key Features
- **Product scope isolation**: GRC / TPRM / Internal Audit users see only their content
- **Role-based filtering**: AuditHead-only articles hidden from Auditors, etc.
- **Context-aware suggestions**: Shows relevant questions based on current page URL
- **F1 keyboard shortcut**: Toggles help panel
- **RTL support**: Panel slides from left in Arabic mode
- **Zero dependencies**: Search engine is pure TypeScript, no external libraries

---

## 2. File Structure & Responsibilities

### New Files Created

```
src/
├── data/
│   └── help-knowledge-base.ts      # 1,688 lines — All Q&A articles + types
├── lib/
│   └── help-search.ts              # 332 lines  — Search engine + filtering
├── hooks/
│   └── useHelpChatbot.ts           # 230 lines  — Chat state + session integration
└── components/
    └── help-chatbot/
        ├── help-chatbot.tsx         # 210 lines  — Main component (Sheet + trigger)
        ├── chat-message.tsx         # 155 lines  — Message bubbles (user/bot)
        └── suggested-questions.tsx  # 140 lines  — Module cards + article lists
```

### Modified Files

| File | Change |
|------|--------|
| `src/components/layout/main-layout.tsx` | Added `<HelpChatbot />` as last child (fixed position, no layout impact) |
| `scripts/init-translations.ts` | Added 21 new i18n phrases for chatbot UI |

### File Dependency Graph

```
main-layout.tsx
    └── help-chatbot.tsx
            ├── useHelpChatbot.ts
            │       ├── help-knowledge-base.ts (articles data)
            │       └── help-search.ts (search engine)
            ├── chat-message.tsx
            └── suggested-questions.tsx
```

---

## 3. Knowledge Base Structure

### TypeScript Types

```typescript
// Product scope determines which user group can see the article
type ProductScope = "grc" | "tprm" | "audit" | "both";

// Module categories
type HelpModule =
  | "general"          // Login, navigation, search, roles
  | "organization"     // Profile, users, processes, BIA
  | "compliance"       // Frameworks, controls, governance, evidence
  | "risk-management"  // Risk register, assessment, response
  | "asset-management" // Inventory, classification
  | "internal-audit"   // Planning, fieldwork, CAPA, reports
  | "tprm"             // Vendors, assessments, monitoring
  | "grc-admin";       // Customer accounts, email, config

// Each article in the knowledge base
interface HelpArticle {
  id: string;                    // Unique identifier (e.g., "audit-planning-create")
  module: HelpModule;            // Which module this belongs to
  category: string;              // Sub-category (e.g., "Audit Planning")
  question: string;              // Primary question text
  alternateQuestions: string[];   // Alternate phrasings for better search
  keywords: string[];            // Keywords for search matching
  answer: string;                // Overview (1-2 line summary)
  steps?: string[];              // Numbered step-by-step instructions
  notes?: string[];              // Validations, warnings, tips
  relatedLinks?: { label: string; href: string }[]; // Navigation links
  roles?: string[];              // Role restriction (empty = all roles)
  productScope: ProductScope;    // GRC/TPRM/Audit/Both visibility
}
```

### Module-to-Scope Mapping

| Module | ProductScope | Visible To |
|--------|-------------|------------|
| `general` | `"both"` | All users |
| `organization` | `"grc"` | GRC users (not audit-only) |
| `compliance` | `"grc"` | GRC users (not audit-only) |
| `risk-management` | `"grc"` | GRC users (not audit-only) |
| `asset-management` | `"grc"` | GRC users (not audit-only) |
| `internal-audit` | `"audit"` | Users with audit roles |
| `tprm` | `"tprm"` | TPRM users |
| `grc-admin` | `"both"` | All users (further filtered by role) |

### Current Article Counts

| Module | Articles | Source |
|--------|----------|--------|
| General | 7 | GRC User Manual |
| Organization | 14 | GRC User Manual |
| Compliance | 11 | GRC User Manual |
| Risk Management | 10 | GRC User Manual |
| Asset Management | 7 | GRC User Manual |
| Internal Audit | 22 | Internal Audit User Manual |
| TPRM | 1 | Placeholder (needs TPRM manual) |
| GRC Admin | 1 | Placeholder |
| **Total** | **73** | |

---

## 4. Search Engine

**File:** `src/lib/help-search.ts`

### How Search Works

The search engine uses a **multi-strategy scoring** approach with no external dependencies:

```
Query: "how to create audit engagement"
                    │
     ┌──────────────┼──────────────────────────────┐
     │              │              │                │
  Strategy 1    Strategy 2    Strategy 3       Strategy 4
  Exact Match   Token Match   Keyword Match   Fuzzy Match
  (+100 pts)    (+50 pts)     (+30 pts)       (+10 pts)
     │              │              │                │
     └──────────────┼──────────────────────────────┘
                    │
              Sort by score
              Filter > 15 pts
              Return top 5
```

### Scoring Strategies

| Strategy | Points | Description |
|----------|--------|-------------|
| **Exact Phrase Match** | +100 | Query appears inside question or alternate questions |
| **Reverse Exact Match** | +80 | Question appears inside query |
| **Token Overlap (Jaccard)** | up to +50 | Percentage of query words found in article tokens |
| **Keyword Intersection** | up to +30 | Query words matching article keywords |
| **Fuzzy Match (Levenshtein)** | +10 per match | Words with edit distance ≤ 2 (typo tolerance) |

### Filtering Hierarchy

```
1. Product Scope Filter (hard boundary)
   ├─ "grc"   → isGrcAdded=true AND NOT audit-only user
   ├─ "audit" → isGrcAdded=true AND user has audit role
   ├─ "tprm"  → isTprmAdded=true
   └─ "both"  → always visible

2. Module Filter (for category browsing)
   └─ Only show articles from the selected module

3. Role Filter (article-level restriction)
   └─ If article has roles[], user must have at least one matching role
```

### Public API Functions

```typescript
// Search the knowledge base with multi-strategy scoring
searchKnowledgeBase(query, articles, options) → ScoredResult[]

// Get articles for a specific module (category browsing)
getArticlesByModule(articles, module, productFlags, roleFilter?) → HelpArticle[]

// Get context-aware suggestions based on current page URL
getSuggestionsForPage(articles, pathname, productFlags, roleFilter?) → HelpArticle[]

// Get visible modules with article counts
getVisibleModules(articles, productFlags, roleFilter?) → (HelpModuleInfo & { count })[]
```

---

## 5. Product Scope & Role Isolation

### How It Works

The system uses three layers of isolation:

#### Layer 1: Account-Level Flags (from NextAuth session)
```typescript
session.user.isGrcAdded   // true if customer has GRC module
session.user.isTprmAdded  // true if customer has TPRM module
```

#### Layer 2: Audit Role Detection (computed from roles)
```typescript
const AUDIT_ROLES = ["AuditHead", "AuditManager", "Auditor", "Auditee"];

isAuditUser  = userRoles has at least one audit role
isAuditOnly  = ALL user roles are audit roles (no CustomerAdmin, Reviewer, etc.)
```

#### Layer 3: Combined ProductFlags
```typescript
interface ProductFlags {
  isGrcAdded: boolean;    // Account has GRC module
  isTprmAdded: boolean;   // Account has TPRM module
  isAuditUser: boolean;   // User has audit role(s)
  isAuditOnly: boolean;   // User has ONLY audit roles
}
```

### Visibility Matrix

| User Type | General | Org | Compliance | Risk | Assets | Audit | TPRM | Admin |
|-----------|---------|-----|------------|------|--------|-------|------|-------|
| GRC User (Reviewer/Contributor) | Yes | Yes | Yes | Yes | Yes | No | No | Yes |
| GRC + Audit (CustomerAdmin + AuditHead) | Yes | Yes | Yes | Yes | Yes | Yes | No | Yes |
| Audit-Only (AuditHead only) | Yes | No | No | No | No | Yes | No | No |
| TPRM-Only User | Yes | No | No | No | No | No | Yes | Yes |
| Full Access (GRC + TPRM + Audit) | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |

---

## 6. UI Components

### Component Hierarchy

```
HelpChatbot (main orchestrator)
├── Floating Trigger Button (bottom-right, hidden when panel open)
└── Sheet Panel (400px, right side LTR / left side RTL)
    ├── Header (gradient, title, clear + close buttons)
    ├── ScrollArea (messages body)
    │   ├── ChatMessage[] (user/bot bubbles)
    │   ├── ModuleCards (module grid + page suggestions)
    │   └── ModuleArticleList (articles in selected module)
    └── Footer (input + send button + F1 hint)
```

### Floating Button
- Position: `fixed bottom-6 ltr:right-6 rtl:left-6`
- Size: 56px circular
- Color: `bg-primary-500`
- Icon: `MessageCircleQuestion` from lucide-react
- Hidden when Sheet is open

### Sheet Panel
- Width: 400px
- Side: `right` (LTR) / `left` (RTL)
- Header: gradient `from-primary-600 to-primary-500`
- Auto-scrolls to bottom on new messages

### Chat Message Bubbles

**User messages:**
- Aligned right
- Background: `bg-primary-500 text-white`
- Rounded corners

**Bot messages:**
- Aligned left
- Background: `bg-slate-50`
- Structured display:
  - **Overview** (answer text)
  - **Steps** (numbered list, bold keywords via `**text**`)
  - **Notes** (amber background, warning-style)
  - **Related** (clickable navigation buttons using `router.push()`)
  - **Related Questions** (shown when multiple search results match)

---

## 7. React Hook (State Management)

**File:** `src/hooks/useHelpChatbot.ts`

### State

```typescript
isOpen: boolean              // Sheet visibility
messages: ChatMessage[]      // Chat message history
activeModule: HelpModule     // Currently browsing module (or null)
```

### Computed Values (useMemo)

```typescript
userRoles: string[]          // From session.user.roles
productFlags: ProductFlags   // isGrcAdded, isTprmAdded, isAuditUser, isAuditOnly
modulesWithCounts: []        // Visible modules with article counts
pageSuggestions: []           // Context-aware suggestions for current URL
moduleArticles: []            // Articles for the active browsing module
```

### Actions

```typescript
toggleOpen()              // Toggle Sheet visibility
open() / close()          // Explicit open/close
sendMessage(text)         // Search KB, add user msg + bot result to chat
selectArticle(article)    // Display a specific article
browseModule(module)      // Browse a module's articles
backToModules()           // Return to module grid
clearChat()               // Reset to welcome state
```

### Keyboard Shortcut

`F1` toggles the help panel (registered via `useEffect` with `keydown` listener).

### Context-Aware Suggestions

The hook uses `usePathname()` to detect the current page and suggests relevant articles:

```typescript
URL /organization/*    → suggests Organization module articles
URL /compliance/*      → suggests Compliance module articles
URL /risks/*           → suggests Risk Management articles
URL /internal-audit/*  → suggests Internal Audit articles
URL /tprm/*            → suggests TPRM articles
```

---

## 8. How to Add New Articles

### Step 1: Open the Knowledge Base File

```
src/data/help-knowledge-base.ts
```

### Step 2: Add an Article Entry

Find the appropriate module section and add a new object to the `helpArticles` array:

```typescript
{
  id: "unique-article-id",           // e.g., "audit-new-feature"
  module: "internal-audit",          // Which module
  category: "Field Work",            // Sub-category for grouping
  productScope: "audit",             // Who can see it
  question: "How do I do X?",        // Primary question
  alternateQuestions: [              // Other ways to ask
    "Do X",
    "Perform X",
    "X feature"
  ],
  keywords: ["x", "feature", "do"],  // Search keywords
  answer: "Brief 1-2 sentence overview of the feature.",
  steps: [                           // Step-by-step instructions
    "Navigate to **Module** > **Page**",
    "Click the **Button Name**",
    "Fill in the required fields",
    "Click **Save**",
  ],
  notes: [                           // Optional warnings/tips
    "Only AdminRole can perform this action",
    "This change cannot be undone",
  ],
  relatedLinks: [                    // Optional navigation links
    { label: "Page Name", href: "/module/page" },
  ],
  roles: ["AuditHead"],             // Optional role restriction (omit for all)
},
```

### Step 3: Formatting Tips

- Use `**bold text**` in steps for UI elements (buttons, fields, labels)
- Use `>` for navigation breadcrumbs: `Navigate to **Module** > **Page**`
- Keep answers concise (1-2 sentences)
- Keep steps actionable and numbered
- Add notes for permissions, validations, or warnings
- Use relatedLinks to help users navigate to the actual page

### Step 4: Verify

```bash
npm run build    # Ensure no TypeScript errors
```

---

## 9. How to Add a New Module Manual

### Process: Converting a .docx Manual to Knowledge Base Articles

#### Step 1: Convert .docx to Markdown

```bash
# Install mammoth if not present
npm install mammoth --no-save

# Convert using Node.js script
node -e "
const mammoth = require('mammoth');
const fs = require('fs');
mammoth.convertToMarkdown({ path: 'path/to/manual.docx' })
  .then(result => {
    let text = result.value;
    // Strip base64 images (they make the file huge)
    text = text.replace(/data:image\/[a-z]+;base64,[A-Za-z0-9+\/=]+/g, '');
    text = text.replace(/!\[\]\(\)/g, '');
    text = text.replace(/\n{3,}/g, '\n\n');
    fs.writeFileSync('tmp-manual.md', text, 'utf8');
    console.log('Lines:', text.split('\n').length);
  });
"
```

#### Step 2: Read and Extract Articles

Read through the cleaned markdown and identify:
- Section headings → become `category` values
- Feature descriptions → become `answer` values
- Step-by-step instructions → become `steps[]` values
- Warnings/notes → become `notes[]` values
- Related pages → become `relatedLinks[]` values

#### Step 3: Add Articles to Knowledge Base

Add all new articles to `src/data/help-knowledge-base.ts` under the appropriate module section. Follow the article format described in Section 8.

#### Step 4: Set Product Scope

- GRC modules (Organization, Compliance, Risk, Assets) → `productScope: "grc"`
- Internal Audit → `productScope: "audit"`
- TPRM → `productScope: "tprm"`
- Cross-module (Login, Navigation) → `productScope: "both"`

#### Step 5: Verify and Clean Up

```bash
npm run build              # Verify no TypeScript errors
rm tmp-manual.md           # Clean up temp files
```

---

## 10. i18n (Internationalization)

### Current Chatbot UI Phrases (21 entries)

These are in `scripts/init-translations.ts`:

```
Help Assistant, Need help?, Ask anything about the application,
Type your question..., Clear chat, Browse by Module,
Suggested for this page, topics, Back to modules,
Steps, Notes, Related, Related Questions,
Press, to toggle help, General, Risk Management,
Asset Management, Internal Audit, TPRM, GRC Administration
```

### Adding New Phrases

1. Add the phrase to `scripts/init-translations.ts` with en/ar/lv translations
2. Run `npx tsx scripts/init-translations.ts` to regenerate translation JSON files
3. Use `t("phrase")` in component code

### Knowledge Base Articles

Article content (answer, steps, notes) is **English-only** in Phase 1. The `t()` function does not apply to dynamic content. Future phases may add `answer_ar` and `answer_lv` fields.

---

## 11. Future Phase 2 — RAG-Based AI Assistant

### Overview

Replace the client-side keyword search with a **Retrieval-Augmented Generation** (RAG) system that uses vector embeddings + LLM to generate natural language answers.

### Architecture

```
User question → /api/ai/chat
                     │
          ┌──────────┼──────────────────┐
          │          │                  │
    Embed Query   Vector DB Search   Prisma DB Query
    (OpenAI)      (Policies, SOPs)   (Live audit/risk data)
          │          │                  │
          └──────────┼──────────────────┘
                     │
              LLM (Claude API)
              Generate answer with
              retrieved context
                     │
                     ▼
              Streaming response
              to frontend
```

### What Changes

| Component | Current (Phase 1) | Future (Phase 2) |
|-----------|-------------------|-------------------|
| Search | Client-side keyword/fuzzy | API → Vector DB → LLM |
| Data Source | Static TypeScript array | Vector DB + Live Prisma DB |
| Response | Pre-authored text | AI-generated with sources |
| Latency | Instant (~5ms) | 1-3 seconds (LLM call) |
| Cost | Zero | Per-query (embedding + LLM tokens) |

### New Backend Components

```
src/
├── app/api/ai/
│   └── chat/
│       └── route.ts           # Orchestration endpoint
├── lib/
│   ├── vector-db.ts           # Vector DB client (pgvector or Pinecone)
│   ├── embedding.ts           # Embedding pipeline (OpenAI text-embedding-3-small)
│   ├── rag-pipeline.ts        # RAG orchestration (embed → search → LLM)
│   └── llm-client.ts          # Claude/OpenAI API client
└── scripts/
    └── ingest-documents.ts    # Bulk embed documents into vector DB
```

### Data Sources for RAG

**Static (Vector DB):**
- Current 73 KB articles (seed data)
- Uploaded policies and SOPs
- Compliance framework documents
- ISO/NIST/SOC2 documents
- Control descriptions

**Dynamic (Live DB Queries):**
- "How many open HR risks?" → `SELECT COUNT(*) FROM Risk WHERE status='Open' AND department='HR'`
- "What is our audit completion rate?" → Query from AuditEngagement table
- "Evidence status summary?" → Query from Evidence table
- "Dormant users?" → Query from User table or external API

### Environment Variables Needed

```env
# Vector DB
VECTOR_DB_URL=               # pgvector connection or Pinecone API URL
PINECONE_API_KEY=            # If using Pinecone

# LLM
ANTHROPIC_API_KEY=           # Claude API key
OPENAI_API_KEY=              # For embeddings (text-embedding-3-small)

# Rate Limiting
AI_CHAT_RATE_LIMIT=10        # Max queries per minute per user
AI_TOKEN_BUDGET=50000        # Max tokens per user per day
```

### Vector DB Options

| Option | Pros | Cons |
|--------|------|------|
| **pgvector on Neon** | Same database, no new service, free tier | Limited scale |
| **Pinecone** | Purpose-built, fast, serverless | New service, cost at scale |
| **ChromaDB** | Open-source, easy setup | Self-hosted, no serverless |

**Recommendation:** Start with **pgvector on Neon** (your existing database) to avoid new infrastructure. Migrate to Pinecone when scale demands it.

---

## 12. Future Phase 3 — AI Agentic (MCP Tools)

### Overview

Add an **Action-Oriented AI Agent** that can perform actions instead of just answering questions. Uses **MCP (Model Context Protocol)** tools connected to existing API routes.

### Existing API Routes = MCP Tools

```
┌────────────────────────────────────┬───────────────────────────────────┐
│ Agent Command                      │ Existing API Route (MCP Tool)     │
├────────────────────────────────────┼───────────────────────────────────┤
│ "Create a risk for data breach"    │ POST /api/risks/register          │
│ "Draft a password policy"          │ POST /api/compliance/governance   │
│ "Create audit finding for IT"      │ POST /api/internal-audit/findings │
│ "Add a new vendor"                 │ POST /api/tprm/vendors            │
│ "Create audit engagement"          │ POST /api/internal-audit/planning │
│ "Generate SOA for ISO 27001"       │ NEW: POST /api/ai/soa             │
│ "Run gap analysis"                 │ NEW: POST /api/ai/gap-analysis    │
│ "Pull Azure AD dormant users"      │ NEW: POST /api/integrations/azure │
│ "Collect evidence from AWS"         │ NEW: POST /api/integrations/aws   │
└────────────────────────────────────┴───────────────────────────────────┘
```

### Agentic Capabilities

1. **Multi-step reasoning** — Break complex requests into sequential API calls
2. **Action confirmation** — User must approve before any data modification
3. **Cross-platform integration** — Azure AD, AWS, GCP connectors
4. **Automated evidence collection** — Pull compliance data from cloud APIs
5. **Suggested remediation** — AI recommends fixes for audit findings

### New Backend Components

```
src/
├── app/api/ai/
│   ├── agent/
│   │   └── route.ts           # Agent orchestration endpoint
│   ├── soa/
│   │   └── route.ts           # Statement of Applicability generation
│   └── gap-analysis/
│       └── route.ts           # Gap analysis engine
├── lib/
│   ├── mcp-tools.ts           # MCP tool definitions (maps to API routes)
│   ├── agent-executor.ts      # Agent loop (plan → execute → confirm)
│   └── integrations/
│       ├── azure-ad.ts        # Azure AD connector
│       ├── aws.ts             # AWS connector
│       └── gcp.ts             # GCP connector
```

### Security Model for Agent Actions

```
User sends command
        │
        ▼
Agent plans action(s)
        │
        ▼
Show confirmation dialog:
"I will create a new risk with:
 - Name: Data Breach Risk
 - Department: IT
 - Severity: High

 [Confirm] [Cancel]"
        │
  User confirms
        │
        ▼
Execute API call with USER's session
(inherits all RBAC permissions)
        │
        ▼
Return result to chat
```

**Key security rule:** The agent always uses the **user's session token** to call API routes. This means:
- An Auditor cannot create risks through the agent (no permission)
- RBAC is enforced at the API level, same as manual actions
- No privilege escalation is possible

---

## 13. Future Phase 4 — Evidence Automation & Integrations

### Cloud Integrations

| Platform | What to Pull | API |
|----------|-------------|-----|
| **Azure AD** | Dormant users, user rights, device compliance | Microsoft Graph API |
| **Microsoft 365** | Email policies, DLP settings | Microsoft Graph API |
| **AWS** | Security findings, IAM policies, S3 configs | AWS SDK (Boto3) |
| **GCP** | Cloud security findings, IAM | Google Cloud SDK |
| **Defender** | Security recommendations, alerts | Microsoft Defender API |

### On-Premise Integrations

| Source | Approach |
|--------|----------|
| Local Active Directory | Secure agent or hybrid connector |
| On-prem server logs | Log forwarder or syslog integration |
| Firewall logs | API-based or syslog |
| Endpoint tools | Vendor-specific API connectors |

### Background Job Engine

```
Evidence Collection Flow:

1. User/Agent triggers collection
2. Job created in queue (AsyncJob table)
3. Background worker picks up job
4. Calls external API (Azure/AWS/GCP)
5. Normalizes and stores evidence
6. Updates Evidence table with results
7. Notifies user via in-app notification
```

### New Database Models

```prisma
model IntegrationConnector {
  id                String   @id @default(uuid())
  customerAccountId String
  platform          String   // "azure_ad", "aws", "gcp"
  credentials       Json     // Encrypted OAuth tokens / service account keys
  lastSyncAt        DateTime?
  status            String   // "active", "error", "disabled"
}

model AsyncJob {
  id                String   @id @default(uuid())
  type              String   // "evidence_collection", "gap_analysis"
  status            String   // "queued", "running", "completed", "failed"
  input             Json
  output            Json?
  createdAt         DateTime @default(now())
  completedAt       DateTime?
}
```

---

## 14. UI Roadmap — Two-Tab Design

### Current (Phase 1)

```
┌──────────────────────────┐
│ Help Assistant     🗑️  ✕ │
│──────────────────────────│
│ [Chat messages...]       │
│ [Module cards]           │
│ [Search results]         │
│──────────────────────────│
│ [Type your question...]  │
│ Press F1 to toggle help  │
└──────────────────────────┘
```

### Future (Phase 2+3)

```
┌──────────────────────────┐
│ AI Copilot         🗑️  ✕ │
│ [Assistant] [Agent]  tabs │
│──────────────────────────│
│                          │
│ Tab 1 (Assistant):       │
│  Q&A + Dashboard queries │
│  Policy search           │
│  Audit/Risk status       │
│  Streaming LLM answers   │
│                          │
│ Tab 2 (Agent):           │
│  Create policy           │
│  Run gap analysis        │
│  Generate SOA            │
│  Pull cloud evidence     │
│  Action confirmations    │
│  Progress indicators     │
│                          │
│──────────────────────────│
│ [Type your question...]  │
│ [🎤] [📎] [⚡ Quick]    │
└──────────────────────────┘
```

### New UI Elements Needed

- **Tab switcher** component (Assistant / Agent)
- **Streaming text** display (typewriter effect for LLM responses)
- **Action confirmation** dialog (Confirm/Cancel before agent executes)
- **Progress indicator** for long-running operations (evidence collection)
- **Source citations** showing which documents the RAG used
- **Quick action** buttons (common agent commands)

---

## 15. Migration Guide — Phase 1 → Phase 2

### What Stays the Same
- `HelpChatbot` component (Sheet panel, trigger button)
- `ChatMessage` component (message bubbles, steps/notes rendering)
- `suggested-questions.tsx` (module cards, article lists)
- `ProductFlags` and role-based filtering (passed as metadata to RAG)
- `ChatMessage` interface (role, content, article, results)
- i18n with `t()` function

### What Changes

#### 1. Make `sendMessage()` Async

```typescript
// BEFORE (Phase 1) — synchronous, instant
const sendMessage = useCallback((text: string) => {
  const results = searchKnowledgeBase(text, helpArticles, { ... });
  setMessages(prev => [...prev, userMsg, botMsg]);
}, []);

// AFTER (Phase 2) — async, API call
const sendMessage = useCallback(async (text: string) => {
  setMessages(prev => [...prev, userMsg, loadingMsg]);

  const response = await fetch("/api/ai/chat", {
    method: "POST",
    body: JSON.stringify({
      query: text,
      productFlags,
      userRoles,
      conversationHistory: messages.slice(-10),
    }),
  });

  const reader = response.body.getReader();
  // Stream response chunks...

  setMessages(prev => [...prev.filter(m => m.id !== "loading"), botMsg]);
}, []);
```

#### 2. Add New API Route

```typescript
// src/app/api/ai/chat/route.ts
export const POST = withAuth(async (req, context, session) => {
  const { query, productFlags, userRoles } = await req.json();

  // 1. Embed query
  const embedding = await embedText(query);

  // 2. Vector search (filtered by product scope + tenant)
  const docs = await vectorSearch(embedding, {
    customerAccountId: session.user.customerAccountId,
    productScope: getScope(productFlags),
  });

  // 3. Check if query needs live data
  const liveData = await checkLiveDataQuery(query, session);

  // 4. Generate response with LLM
  const response = await generateAnswer(query, docs, liveData);

  // 5. Stream response
  return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
});
```

#### 3. Seed Vector DB with Current Articles

```typescript
// scripts/seed-vector-db.ts
import { helpArticles } from "@/data/help-knowledge-base";

for (const article of helpArticles) {
  const text = `${article.question}\n${article.answer}\n${article.steps?.join("\n")}`;
  const embedding = await embedText(text);
  await vectorDB.upsert({
    id: article.id,
    values: embedding,
    metadata: {
      module: article.module,
      productScope: article.productScope,
      category: article.category,
      roles: article.roles || [],
    },
  });
}
```

### Phase 1 Stays as Fallback

Keep `help-search.ts` as a **fallback** when:
- LLM API is unavailable
- User is offline
- Rate limit exceeded
- Cost budget exceeded

```typescript
const sendMessage = useCallback(async (text: string) => {
  try {
    // Try RAG first
    const result = await fetchRAG(text);
    // ...
  } catch {
    // Fallback to local KB search
    const results = searchKnowledgeBase(text, helpArticles, options);
    // ...
  }
}, []);
```

---

## 16. Technical Integration Requirements

### API Layer
- REST-based secure API connections
- OAuth authentication for cloud integrations
- Service accounts for automated evidence collection
- Token management and refresh logic

### Data Processing Layer
- Data normalization from external sources
- Severity mapping (external → internal scale)
- Risk scoring algorithms
- Control tagging and mapping

### Security Layer
- Encryption in transit (HTTPS/TLS)
- Encryption at rest (for stored credentials)
- Role-based data filtering (RBAC applies to all AI responses)
- Tenant isolation (customerAccountId on all queries)
- Rate limiting and token budgets per tenant

### Cost Management

| Component | Estimated Cost |
|-----------|---------------|
| Embeddings (text-embedding-3-small) | ~$0.02 per 1M tokens |
| LLM (Claude Sonnet) | ~$3 per 1M input tokens |
| Vector DB (pgvector on Neon) | Free tier / $19/month |
| Cloud API calls (Azure/AWS) | Varies by volume |

**Recommendation:** Start with conservative rate limits (10 queries/min per user, 50K tokens/day budget per tenant) and adjust based on usage.

---

## Appendix A: Quick Reference

### File Locations

| Purpose | Path |
|---------|------|
| Knowledge Base (articles) | `src/data/help-knowledge-base.ts` |
| Search Engine | `src/lib/help-search.ts` |
| React Hook | `src/hooks/useHelpChatbot.ts` |
| Main UI Component | `src/components/help-chatbot/help-chatbot.tsx` |
| Message Bubbles | `src/components/help-chatbot/chat-message.tsx` |
| Module Cards / Suggestions | `src/components/help-chatbot/suggested-questions.tsx` |
| Layout Integration | `src/components/layout/main-layout.tsx` |
| i18n Phrases | `scripts/init-translations.ts` |

### Common Tasks

| Task | What to Do |
|------|-----------|
| Add a single article | Edit `help-knowledge-base.ts`, add entry to `helpArticles` array |
| Add a new module manual | Convert .docx → markdown → extract articles → add to KB |
| Restrict article to a role | Add `roles: ["AuditHead"]` to the article |
| Change module scope | Edit `helpModules` array, change `productScope` field |
| Add new UI phrase | Add to `scripts/init-translations.ts`, run script, use `t("phrase")` |
| Test as specific user | Login with that user, open Help Assistant, verify modules shown |

### Test Users

| User | Roles | Should See |
|------|-------|-----------|
| `superadmin` | GRCAdministrator | General + GRC Admin |
| `grcadmin2` | CustomerAdministrator | General + all GRC modules |
| `abhishek` | AuditHead | General + Internal Audit (22 topics) |

---

## Appendix B: Phase Roadmap Summary

| Phase | Scope | Status | Dependencies |
|-------|-------|--------|-------------|
| **Phase 1** | Static KB + keyword search | **DONE** | None |
| **Phase 2** | RAG AI Assistant (vector DB + LLM) | Planned | API keys, vector DB setup |
| **Phase 3** | AI Agentic (MCP tools + actions) | Planned | Phase 2, agent framework |
| **Phase 4** | Evidence Automation (cloud connectors) | Planned | Phase 3, OAuth setup, cloud credentials |

**Key principle:** Each phase builds on the previous one. No throwaway work — Phase 1 code serves as fallback and seed data for all future phases.
