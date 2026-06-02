# GRC AI Help Assistant & Agent Mode — Complete Technical Explanation

> **Audience:** Business analysts, reviewers, and developers who want to understand how the in‑app chatbot works across the **GRC**, **TPRM**, and **Internal Audit (IA)** modules — especially **Agent Mode**, where the chatbot *performs actions* instead of just answering questions.
>
> **Scope:** This document describes the chatbot that lives behind the floating "Help Assistant" widget (the one you open with `F1`). It is **not** the heavy document‑processing AI (policy generation, evidence ingestion, vendor scanning) — that is a separate Python/RunPod backend and is only mentioned for contrast.

---

## 1. The 60‑second summary (layman version)

Imagine a smart help desk operator sitting inside the application. You can type a question in plain English (or Arabic, or Latvian), and it can do **four** different things depending on what you asked:

1. **Answer a "how‑to" question** — e.g. *"How do I create a risk?"* → It looks up the help manual and explains the steps. *(This is RAG — Retrieval‑Augmented Generation.)*
2. **Fetch live data from your account** — e.g. *"How many open risks do we have?"* → It safely queries the database and tells you the number. *(This is NLP‑to‑SQL.)*
3. **Make small talk** — e.g. *"Hi"*, *"Thanks"* → It just replies politely. *(No AI cost.)*
4. **Actually change a record for you** — e.g. *"Change the owner of risk RSK‑001 to John Doe"* → **This is Agent Mode.** It figures out what you want, shows you a preview, asks *"Do you want to proceed?"*, and only after you click **Yes** does it update the database.

The whole thing is wrapped in **6 security layers** so it can never be tricked into leaking passwords, dumping the database, or editing something the user isn't allowed to touch.

```
                  ┌─────────────────────────────────────────────┐
You type ────────►│  /api/ai/chat  (one single endpoint)          │
                  │                                               │
                  │  1. Input guard    (block hacking attempts)   │
                  │  2. PII scanner    (block/redact card #s etc) │
                  │  3. Query router   (decide WHAT you want)      │
                  │       │                                       │
                  │       ├─ kb_search    → RAG (help manual)      │
                  │       ├─ data_query   → NLP-to-SQL (live data) │
                  │       ├─ general_chat → canned reply           │
                  │       └─ agent_update → AGENT MODE (actions)   │
                  │  5. Output guard   (scrub the reply)           │
                  │  6. Audit log      (record everything)         │
                  └─────────────────────────────────────────────┘
```

---

## 2. Is this "Agentic AI"? Which framework is used?

**Short answer: No external agent framework is used.** There is **no LangGraph, no LangChain, no AutoGen, no CrewAI, no OpenAI Agents SDK**. The "agent" is a **hand‑built, custom orchestration** written in TypeScript inside the Next.js app.

| Question | Answer |
|---|---|
| LangGraph / LangChain? | ❌ Not used |
| AutoGen / CrewAI? | ❌ Not used |
| OpenAI Agents SDK / Assistants API? | ❌ Not used |
| Anthropic / Claude SDK? | ❌ Not used for the chatbot |
| What *is* used? | The raw **OpenAI SDK** (`openai` npm package) calling **`gpt-4o-mini`** for reasoning and **`text-embedding-3-small`** for RAG, plus **Prisma** (ORM) for database access. |

### So is it "Agentic AI" or just an "AI Agent"?

It sits deliberately between the two, and the distinction matters:

- It is **more than a chatbot** — it has **tools** (database read, database write), **memory** (conversation history), and it **takes real actions** that change system state. That makes it a genuine **AI Agent**.
- It is **not fully autonomous "Agentic AI"** — it does **not** loop, plan multi‑step chains, or decide on its own to call several tools in sequence. Each user message triggers **exactly one** classified action. There is **no agent loop** ("think → act → observe → think again"). Crucially, every state‑changing action requires **explicit human confirmation** before it runs.

A good label is: **a constrained, single‑step, human‑in‑the‑loop tool‑using agent.** This is a deliberate safety choice for a GRC product — autonomy is traded away for auditability and control.

> **Why build it by hand instead of using LangGraph/CrewAI?** Three reasons that fit a compliance product: (1) **total control** over the SQL that runs, so the database can never be damaged; (2) **no extra dependency** to security‑review or keep patched; (3) **predictable cost** — exactly 1–4 cheap `gpt-4o-mini` calls per message, never a runaway agent loop.

---

## 3. The technology stack

| Layer | Technology | Where |
|---|---|---|
| Web framework | Next.js 16 (App Router), React, TypeScript | whole app |
| Chat endpoint | Next.js API Route (`POST /api/ai/chat`) | `src/app/api/ai/chat/route.ts` |
| LLM (reasoning) | OpenAI `gpt-4o-mini` (cheap, fast) | all `chatbot/*` engines |
| Embeddings (RAG) | OpenAI `text-embedding-3-small` (1536 dims) | `chatbot/kb-embeddings.ts` |
| Vector store | PostgreSQL column (`ChatbotKBArticle.embedding`) | Prisma schema |
| Database access | Prisma ORM (no raw SQL for the agent) | `src/lib/prisma.ts` |
| Auth & roles | NextAuth v5 (JWT) + custom RBAC | `src/lib/auth.ts`, `permissions.ts` |
| Voice (optional) | OpenAI Whisper (speech‑to‑text) + `gpt-4o-mini-tts` (text‑to‑speech) | `api/ai/voice/*` |
| UI | Floating widget + React hook | `components/help-chatbot/*`, `hooks/useHelpChatbot.ts` |

All chatbot intelligence runs **inside the Node.js/Next.js process** — it does not depend on the separate Python AI backend.

---

## 4. The front end — how the user interacts

**Files:** `src/components/help-chatbot/help-chatbot.tsx`, `chat-message.tsx`, `src/hooks/useHelpChatbot.ts`

- A floating widget (open with **F1**) anchored below the header. Supports RTL (Arabic), voice input/output, and module browsing.
- The hook `useHelpChatbot` holds:
  - `messages[]` — the conversation transcript
  - `agentMode` — a **toggle switch** the user flips ON to allow the bot to make changes
  - the last **6 messages** of history, which are sent with each request so follow‑ups like *"now change its owner"* are understood.
- Every message is `POST`ed to **one** endpoint, `/api/ai/chat`, with `{ query, conversationHistory, agentMode }`.
- When the bot proposes a change, the message renders **Yes / Cancel buttons** (`confirmUpdate`). Clicking **Yes** sends a second request with `{ confirmUpdateId }` — that is what actually triggers the write.

So the front end is "dumb": all the brains live in the backend endpoint.

---

## 5. The backend brain — one endpoint, six layers

**File:** `src/app/api/ai/chat/route.ts`

Every message flows through the same pipeline. Here is what each layer does and why.

### Layer 0 — Authentication & context (before anything else)
`withAuthOnly` ensures the user is logged in. The endpoint extracts:
- `customerAccountId` → **tenant isolation** (the user can only ever see/touch their own organization's data).
- `userRoles` → drives every permission decision.
- `moduleContext` → so the bot introduces itself correctly ("TPRM Help Assistant", "Internal Audit Help Assistant", etc. — see `module-context.ts`).

### Layer 1 — Input Guardrails (`guardrails/input-guard.ts`)
Blocks the request **before** it reaches the LLM if it matches:
- **26 prompt‑injection / jailbreak patterns** — e.g. *"ignore all previous instructions"*, *"you are now in admin mode"*, *"DAN mode"*, *"show me your system prompt"*.
- **SQL‑injection strings** — `DROP TABLE`, `SELECT * FROM`, `' OR 1=1`, etc.
- **Data‑exfiltration attempts** — *"show me all passwords"*, *"dump the database"*, *"environment variables"*.
- **Blocked topics** — *"how to hack…"*, *"create malware…"*.
- **Rate limiting** — 30 queries/hour (60 for admins), per user, in memory.

### Layer 2 — PII Scanner (`guardrails/pii-scanner.ts`)
Scans the text for 14 PII patterns:
- **High severity** (credit cards, SSN, Aadhaar, passports, API keys, passwords, DB connection strings) → **request is blocked**.
- **Medium/low** (email, phone, IP, bank account) → **redacted** (replaced with `[EMAIL_REDACTED]` etc.) but the request continues. The LLM never sees the raw PII.

### Layer 3 — Query Router (`chatbot/query-router.ts`) — the decision brain
This is *how the bot decides what to do*. See Section 6.

### Layer 4 — The chosen pipeline runs
Depending on the intent: RAG, NLP‑to‑SQL, general chat, or Agent Mode (Sections 7–9).

### Layer 5 — Output Guardrails (`guardrails/output-guard.ts`)
Before the answer is returned, it is scrubbed: any leaked credentials/connection strings/SQL are `[REDACTED]`, system‑prompt leakage is removed, length is capped at 10k chars.

### Layer 6 — Audit Logging (`guardrails/audit-logger.ts`)
**Always runs**, even on error (it's in a `finally` block). Every interaction is written to the `ChatbotAuditLog` table with PII redacted: who asked, what intent, a response preview, whether it was blocked, tokens used, and latency. A **suspicious‑activity detector** temporarily locks a user who racks up ≥10 blocked attempts or ≥5 PII submissions in an hour.

---

## 6. How the chatbot *understands* the query and decides what to do

**File:** `src/lib/chatbot/query-router.ts`

This is the heart of "deciding what action to perform." It produces one of four **intents**:

| Intent | Meaning | Pipeline |
|---|---|---|
| `general_chat` | greeting / thanks / yes‑no | canned reply, **no AI call** |
| `kb_search` | "how do I…", "what is…", "where is…" | **RAG** over the help manual |
| `data_query` | "how many…", "list…", "which department has most…" | **NLP‑to‑SQL** |
| `agent_update` | "change…", "set…", "update…", "assign…" | **Agent Mode** *(only offered when the agentMode toggle is ON)* |

### The decision logic (3 steps)

1. **Fast path (regex, free):** Obvious greetings (`hi`, `thanks`, `ok`, `bye`) are caught instantly with no API call.
2. **LLM classification (`gpt-4o-mini`, temperature 0):** Everything else is sent to the model with a carefully engineered classifier prompt. The prompt is given the **list of queryable entities** (Risk, Control, Vendor, Finding, …) and explicit rules. Recent conversation history is included so *"what is its status?"* resolves *"its"* to the entity from the previous turn. The model returns strict JSON: `{"intent": "...", "confidence": 0.0-1.0}`.
3. **Code‑level safety net:** Even after the LLM answers, a regex check can **override** a `kb_search` into a `data_query` when the text clearly wants real data (a "data signal word" like *how many / list / which* **plus** an entity name like *risks / controls*). This prevents the help manual from "stealing" questions that should return live numbers.

> **Key design rule baked into the prompt:** when a question is ambiguous between "explain" and "show me data", **data_query wins** — users get more value from real numbers than from navigation tips.

Agent Mode is *only* added as a 4th option in the classifier prompt **when the user has toggled it on** (`agentMode === true`). With the toggle off, the bot can never decide to change data — it physically isn't an option it can choose.

---

## 7. The RAG pipeline (answering "how‑to" questions)

**Files:** `kb-embeddings.ts`, `answer-generator.ts`, `self-reflect.ts`, `data/help-knowledge-base.ts`

This is a textbook **Retrieval‑Augmented Generation** system.

### How RAG is implemented

1. **Knowledge base:** ~80+ curated help articles live in code (`help-knowledge-base.ts`) — each with question, answer, steps, keywords, the module it belongs to, and **role/product visibility flags**.
2. **Seeding (one‑time):** Each article is turned into a 1536‑dimension **embedding** via OpenAI `text-embedding-3-small` and stored in the `ChatbotKBArticle` table (the embedding lives in a Postgres column). If the KB isn't seeded yet, the endpoint seeds it on first use.
3. **Retrieval:** When a question comes in, it is embedded, then compared against stored article embeddings using **cosine similarity**. **RBAC is applied *before* scoring** — articles the user's role/product can't see are filtered out first. The top‑5 above a 0.3 similarity threshold are kept.
4. **Generation:** The retrieved articles are passed as **context** to `gpt-4o-mini` (`answer-generator.ts`) with a strict system prompt: *answer ONLY from the context, never invent features, never reveal table names or emails, keep it concise with numbered steps.*
5. **Self‑Reflective RAG (`self-reflect.ts`):** This is a quality booster. A **second LLM call grades its own answer** 0–10 on relevance, groundedness, and completeness. If the score is below 6, it **retries** with up to 3 strategies:
   - **Reformulate** — re‑search using a better query the grader suggested.
   - **Expand** — widen the search (top‑8, lower threshold).
   - **Combine** — merge vector results with old‑fashioned keyword search.
   The best‑scoring answer across all attempts wins. Confidence shown to the user comes from this grade.

If RAG finds nothing, it falls back to a keyword search (`help-search.ts`) over the same articles, and finally to a polite "not in the knowledge base" message.

---

## 8. The NLP‑to‑SQL pipeline (answering data questions)

**Files:** `data-query-engine.ts`, `schema-metadata.ts`

This lets users ask about their **live data** in plain English — safely.

### How it works

1. **Schema description:** `schema-metadata.ts` is a hand‑curated **whitelist** of ~16 queryable models (Risk, Control, Framework, Requirement, Policy, Evidence, Asset, Department, User, Process, Internal Audit Risk/Engagement/Finding, TPRM Vendor/Department/Assessment). For each model it lists exactly which fields are queryable, their types, enum values, and relations. **Sensitive fields (password, email, userName) are deliberately excluded.**
2. **LLM translation:** `gpt-4o-mini` converts the question into a **structured `QuerySpec` JSON** — *not raw SQL*. Example:
   ```json
   { "model": "Risk", "operation": "count", "filters": { "status": "Open" } }
   ```
   Supported operations: `count`, `list`, `aggregate` (sum/avg/min/max), `group`.
3. **Validation:** The spec is checked against the whitelist — unknown models/fields are rejected, the user's **role access is enforced**, and non‑aggregatable fields can't be summed. (There's a smart fallback: an audit‑only user asking about "risks" is transparently redirected to the **Internal Audit Risk** model.)
4. **Safe execution:** The spec is executed via **Prisma ORM** (never raw SQL), with a **mandatory `customerAccountId` filter** on every query and a hard **50‑row cap**. Relation names ("IT Department") are resolved to IDs. Translation‑aware: if data is stored in Arabic but asked in English, it searches the `DynamicTranslation` table too.
5. **Formatting:** Results are handed back to `gpt-4o-mini` to phrase as friendly business language — with an explicit instruction to **never reveal table or column names**.

> **Security guarantee:** because the LLM only ever produces a *constrained JSON spec* that is validated against a whitelist and executed through Prisma, it is **impossible** for it to run arbitrary SQL, cross tenants, or read forbidden fields.

---

## 9. Agent Mode — how the chatbot *performs actions*

**File:** `src/lib/chatbot/agent-update-engine.ts`

This is the headline feature. When Agent Mode is ON and the router classifies a message as `agent_update`, the bot can **modify records** — but only through a tightly controlled, **two‑step, human‑confirmed** flow.

### The 6‑step propose‑then‑confirm flow

```
User: "Change the owner of risk RSK-001 to John Doe"   (agentMode = ON)
   │
   ▼
[1] LLM → UpdateSpec
       { model:"Risk", recordIdentifier:{field:"riskId",value:"RSK-001"},
         updates:[{field:"ownerId", value:"John Doe"}] }
   │
   ▼
[2] VALIDATE   ─ model exists? field editable? user has EDIT role? enum value valid?
   │
   ▼
[3] FIND       ─ locate the exact record (customerAccountId enforced; must match exactly one)
   │
   ▼
[4] RESOLVE    ─ "John Doe" → real user ID (with translation fallback)
   │
   ▼
[5] PREVIEW    ─ store a PendingUpdate (5-min expiry) and reply:
       "I'm about to update Risk 'RSK-001':
        - Owner: (current) → John Doe.   Do you want to proceed?"   [Yes] [Cancel]
   │
   ▼   (user clicks Yes → second request with confirmUpdateId)
[6] EXECUTE    ─ executeConfirmedUpdate(): verify same user, run prisma.update(), confirm success
```

### What makes this safe

- **Nothing happens without confirmation.** Step 5 only *proposes*. The database write in step 6 happens *only* after the user clicks **Yes**, which sends a separate `confirmUpdateId` request.
- **Pending updates expire** after **5 minutes** (in‑memory store with TTL).
- **Ownership check:** only the user who created the pending update can confirm it.
- **Field‑level safety:** the bot can only touch fields explicitly marked `editable: true` in `schema-metadata.ts`. It can **never** change `status`, computed scores, system fields, or audit timestamps — those are managed by the application's own workflows.
- **RBAC enforced:** `getEditableModelNames(userRoles)` gates which models a role may edit. A read‑only role gets *"You don't have permission to edit … records."* Some models are **read‑only via the chatbot entirely** — e.g. **TPRM Assessments** and **User** records have *no* `allowedEditRoles`, so they can never be changed by the agent.
- **Tenant isolation:** every lookup and update carries `customerAccountId`.
- **Enum validation & relation resolution:** invalid values are rejected with the list of valid options; human names are resolved to IDs (with a translation fallback for non‑English data).
- **Batch support, still confirmed:** *"set department of CTRL‑0022, CTRL‑0044 and CTRL‑0033 to Compliance"* is handled as one confirmed batch; records not found are reported and skipped.

### Which roles can edit what (Agent Mode)

| Module | Editable by (examples) | Read‑only via chatbot |
|---|---|---|
| Risk | GRCAdmin, CustomerAdmin, Reviewer, Contributor, Dept roles | — |
| Compliance (Control, Policy, Evidence) | GRCAdmin, CustomerAdmin, Reviewer, Contributor | Framework, Requirement |
| Asset | GRCAdmin, CustomerAdmin, Reviewer, Contributor, Dept roles | — |
| Internal Audit (Engagement, Finding) | GRCAdmin, CustomerAdmin, AuditHead, Auditor | Audit Risk |
| TPRM Vendor | GRCAdmin, CustomerAdmin, TPRMAdmin, RelationshipManager | **TPRM Assessment (always read‑only)** |
| Organization (Department, Process) | GRCAdmin, CustomerAdmin | **User (always read‑only)** |

---

## 10. Tools, memory, and decision‑making — how they map

People coming from agent frameworks ask "where are the tools / memory / planner?" Here is the mapping in this custom implementation:

| Agent concept | How it's implemented here |
|---|---|
| **Tools** | Three concrete capabilities: (a) **KB vector search** (RAG read), (b) **NLP‑to‑SQL read** via Prisma, (c) **record update** via Prisma. They are not registered as a generic "tool list" — the **router** picks one per message. |
| **Tool selection / planning** | The **Query Router** (`gpt-4o-mini` classifier) — a single decision, not a multi‑step plan. No agent loop. |
| **Memory** | **Short‑term only:** the last 6 conversation turns are sent on each request, letting the bot resolve "it / this / that risk". There is **no long‑term/vector memory of past chats**; only an **audit log** of interactions is persisted. |
| **Reflection / self‑correction** | The **Self‑Reflective RAG** loop (grade → retry up to 3 strategies) for help answers. |
| **Action execution** | The **Agent Update Engine** with mandatory human confirmation. |
| **Guardrails / policies** | The 6 security layers (input, PII, output, audit, RBAC, tenant isolation). |

---

## 11. How it interacts with APIs, databases, documents & external systems

- **Database:** Exclusively through **Prisma ORM** — for reading help embeddings, running data queries, and performing agent updates. **No raw SQL** is ever generated or executed from user input. Every query is scoped by `customerAccountId`.
- **External AI:** Only **OpenAI** (`api.openai.com`) via the official SDK, for: chat completions (`gpt-4o-mini`), embeddings (`text-embedding-3-small`), and voice (Whisper + TTS). Requires `OPENAI_API_KEY`.
- **Documents:** The Help Assistant chatbot does **not** ingest user documents. (Document‑heavy AI — policy generation, evidence ingestion, control extraction, TPRM vendor scanning — is a **separate Python/RunPod backend** reached through `src/lib/ai-api-client.ts` and `/api/ai/*` routes, and is *not* part of this conversational agent.)
- **Internal APIs:** The chatbot is itself a single internal API route. The confirmation step calls the same route a second time with a `confirmUpdateId`.

---

## 12. Real‑world examples per module

### GRC module
- *"How do I create a risk?"* → **RAG** answers with steps from the manual.
- *"How many open risks do we have?"* → **NLP‑to‑SQL** → `count` on Risk where status = Open → *"There are **23** risk(s) matching your criteria (status: Open)."*
- *"Which department has the most high risks?"* → **NLP‑to‑SQL** `group` by department.
- *(Agent ON)* *"Change the owner of risk RSK‑001 to John Doe"* → preview → **Yes** → owner updated.
- *(Agent ON)* *"Set the department of controls CTRL‑0022, CTRL‑0044 and CTRL‑0033 to Compliance"* → **batch** preview → confirmed update of 3 controls.

### TPRM module
- *"List our critical vendors"* → **NLP‑to‑SQL** → list of TPRMVendor where vrr = Critical.
- *"Show me my assessment queue"* → **NLP‑to‑SQL** with the special `assessorId = 'me'` / `approverId = 'me'` resolution, plus **role‑based status scoping** (an Account Manager only sees their assigned vendors' assessments).
- *(Agent ON)* *"Update the contact email of vendor ABC Corp to ops@abc.com"* → preview → confirmed. *(Note: TPRM **Assessments** are read‑only via the chatbot — it will refuse to modify them.)*

### Internal Audit (IA) module
- *"Explain the audit fieldwork workflow"* → **RAG**.
- *"How many open findings do we have?"* → **NLP‑to‑SQL** on InternalAuditFinding.
- An audit‑only user asks *"show me our risks"* → automatically redirected to the **Internal Audit Risk** register (field‑mapped), because they don't have GRC Risk access.
- *(Agent ON)* *"Set the severity of finding FND001 to High"* / *"Change the priority of AUD003 to High"* → preview → confirmed.

---

## 13. End‑to‑end backend flow (the simple version)

**A question:** *"How many high risks are in the IT department?"*
1. Logged‑in user types it → front end POSTs to `/api/ai/chat`.
2. Input guard: clean. PII scan: none.
3. Router (`gpt-4o-mini`) → `data_query`.
4. NLP‑to‑SQL builds `{ model:"Risk", operation:"count", filters:{ riskRating:"High", departmentId:"IT" } }`.
5. Validated against the whitelist + user's role; "IT" resolved to a real department ID; `customerAccountId` added.
6. Prisma runs `risk.count(...)`. Output guard scrubs. Audit log written.
7. User sees: *"There are **7** risk(s) matching your criteria (riskRating: High, departmentId: IT)."*

**An action (Agent Mode ON):** *"Change the owner of RSK‑001 to John Doe"*
1. POST with `agentMode:true`.
2. Guards pass → Router → `agent_update`.
3. Agent engine: LLM → UpdateSpec; validate model/field/role/enum; find RSK‑001 (one match); resolve "John Doe" → user ID.
4. A 5‑minute **PendingUpdate** is stored; bot replies with a before→after **preview** and **Yes/Cancel** buttons.
5. User clicks **Yes** → second POST with `confirmUpdateId`.
6. Engine verifies ownership + expiry, runs `prisma.risk.update(...)`, replies *"Successfully updated Risk 'RSK‑001': Owner: (previous) → John Doe."*
7. Audit log written for both turns.

---

## 14. Normal chatbot vs. this AI Agent — the difference

| | Traditional chatbot | This GRC AI Agent |
|---|---|---|
| Understands intent | Fixed keywords / decision tree | LLM intent classification + context |
| Knowledge | Hard‑coded FAQ | **RAG** over a curated, role‑filtered KB with self‑reflection |
| Live data | Cannot access | **NLP‑to‑SQL** with whitelist + tenant isolation |
| Takes actions | No | **Yes — Agent Mode** updates records (with confirmation) |
| Memory | None / session text | Last‑6‑turn context for follow‑ups |
| Permissions | None | Full **RBAC** + tenant isolation on every read/write |
| Safety | Minimal | **6 guardrail layers** + audit trail + suspicious‑activity lockout |
| Autonomy | None | Single‑step, **human‑in‑the‑loop** (not a self‑running agent loop) |

---

## 15. Security & validation recap (because it's a GRC product)

- **Authentication** on every request (NextAuth).
- **Tenant isolation** — `customerAccountId` forced into every DB query and update.
- **RBAC** — read access (`getAccessibleModelNames`) and edit access (`getEditableModelNames`) both role‑gated; some models permanently read‑only via chatbot.
- **No raw SQL** — only validated Prisma operations from a whitelisted schema.
- **Prompt‑injection, jailbreak, SQL‑injection, exfiltration** patterns blocked at input.
- **PII** blocked (high severity) or redacted (medium/low) before reaching OpenAI; output re‑scrubbed.
- **Field‑level write safety** — only `editable` fields; status/computed/system fields never touched.
- **Two‑step confirmation** for all writes; 5‑minute expiry; confirm‑by‑owner only.
- **Full audit log** of every interaction (PII redacted) + automatic temporary lockout for abusive patterns.
- **Rate limiting** — 30/hour (60 for admins).

---

## 16. File map (where to look in the code)

| Concern | File |
|---|---|
| Main endpoint / 6‑layer pipeline | `src/app/api/ai/chat/route.ts` |
| Intent classification | `src/lib/chatbot/query-router.ts` |
| Agent Mode (actions) | `src/lib/chatbot/agent-update-engine.ts` |
| NLP‑to‑SQL | `src/lib/chatbot/data-query-engine.ts` |
| Queryable/editable schema whitelist | `src/lib/chatbot/schema-metadata.ts` |
| RAG vector search | `src/lib/chatbot/kb-embeddings.ts` |
| RAG answer generation | `src/lib/chatbot/answer-generator.ts` |
| Self‑reflective RAG retry loop | `src/lib/chatbot/self-reflect.ts` |
| Module persona | `src/lib/chatbot/module-context.ts` |
| Input / PII / output / audit guards | `src/lib/chatbot/guardrails/*.ts` |
| Help articles (KB source) | `src/data/help-knowledge-base.ts` |
| Front‑end widget & state | `src/components/help-chatbot/*`, `src/hooks/useHelpChatbot.ts` |
| Voice (optional) | `src/app/api/ai/voice/{transcribe,speak}/route.ts` |

---

### Bottom line
The GRC Help Assistant is a **custom‑built AI Agent** — no LangGraph/AutoGen/CrewAI — that uses OpenAI `gpt-4o-mini` + embeddings to do three jobs (explain via **RAG**, fetch via **NLP‑to‑SQL**, and **act** via **Agent Mode**). Agent Mode is a deliberately **constrained, single‑step, human‑confirmed** tool‑using agent: it proposes a change, you approve it, and only then does it write to the database — always inside strict RBAC, tenant‑isolation, and 6 layers of guardrails. That safety‑first design is exactly what you want when the "agent" is operating on governance, risk, and compliance data.
