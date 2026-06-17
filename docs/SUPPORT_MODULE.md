# Support Ticketing Module — Complete Reference

> **Status:** Production-ready (local). Not yet committed/deployed.
> **Last updated:** 2026-06-16
> **Owner doc:** this file is the canonical reference. Keep it updated whenever
> support functionality changes.

A native, in-platform customer-support system built entirely on the existing
**Next.js 16 + Prisma + NextAuth + notification** stack — **no Python, no
external helpdesk (Freshdesk/Zendesk), no new runtime dependencies.** It
implements the buildable scope of the *Glimmora.ai — AI Platform Support
Services* SOW.

---

## Table of Contents

1. [What this implements (SOW mapping)](#1-what-this-implements-sow-mapping)
2. [Architecture overview](#2-architecture-overview)
3. [Data model](#3-data-model)
4. [RBAC — resources, roles, scopes](#4-rbac--resources-roles-scopes)
5. [API reference](#5-api-reference)
6. [UI pages & components](#6-ui-pages--components)
7. [AI chatbot escalation](#7-ai-chatbot-escalation)
8. [SLA engine (cron)](#8-sla-engine-cron)
9. [Knowledge Base authoring](#9-knowledge-base-authoring)
10. [KPI dashboard](#10-kpi-dashboard)
11. [CSAT / NPS](#11-csat--nps)
12. [SOC password reset](#12-soc-password-reset)
13. [WhatsApp / Teams channels](#13-whatsapp--teams-channels)
14. [Notifications](#14-notifications)
15. [Internationalization](#15-internationalization)
16. [Environment variables](#16-environment-variables)
17. [Complete file inventory](#17-complete-file-inventory)
18. [How to test](#18-how-to-test)
19. [Deployment checklist](#19-deployment-checklist)
20. [Security notes](#20-security-notes)
21. [Future roadmap / pending work](#21-future-roadmap--pending-work)
22. [How to extend the module](#22-how-to-extend-the-module)

---

## 1. What this implements (SOW mapping)

| # | SOW feature | SOW § | Status |
|---|-------------|-------|--------|
| 1 | "Need Help?" widget on every screen | §5, §15 | ✅ Pre-existing (chatbot widget) |
| 2 | L1 AI Concierge (RAG + NLP-to-SQL) | §4.1, §7.2 | ✅ Pre-existing |
| 3 | Knowledge-base brain (embeddings) | §4.1 | ✅ Pre-existing |
| 4 | Notification infra (email/SMS) | §4, §7 | ✅ Pre-existing |
| 5 | Ticket core (CRUD, codes, comments) | §4, §6, §8 | ✅ Built |
| 6 | Priority (P1–P4) + tier (L1–L4) auto-tagging | §6 | ✅ Built |
| 7 | Escalation engine (chatbot → human ticket) | §9 | ✅ Built |
| 8 | Agent Console (queues) | §4.2/4.3 | ✅ Built |
| 9 | Routing rules (config) | §11 | ✅ Built |
| 10 | SLA timers + breach alerts | §6, §10 | ✅ Built |
| 11 | KB authoring screen | §15 | ✅ Built |
| 12 | KPI dashboards | §12 | ✅ Built |
| 13 | CSAT / NPS capture | §7.1 | ✅ Built |
| 14 | SOC self-service password reset | §7.4 | ✅ Built |
| 15 | WhatsApp / Teams channels | §4.1, §11 | ✅ Built (scaffold + webhooks) |
| — | Team org, SOC procedures, governance meetings, 3rd-party tools | §7, §13 | ⚪ Out of scope (operational, not software) |

**Everything in the SOW that is software is implemented.** Remaining items are
organizational/operational or external provider provisioning (see
[§21](#21-future-roadmap--pending-work)).

---

## 2. Architecture overview

```
Customer
  │  "Need Help?" widget  ───────────────►  AI Concierge (existing chatbot, OpenAI RAG)
  │  WhatsApp / Teams / Email             │     │ resolves 70-80%
  │                                       │     │ low-confidence / no answer
  ▼                                       ▼     ▼
Support Ticket  ◄── auto-classify (priority/tier/SLA) ── classify-ticket.ts
  │   routing rules (per-tenant)
  ├── Agent Console (queues: mine / unassigned / open / all)
  ├── Detail: reply, internal note, status, assign, escalate (L1→L2→L3→L4)
  ├── SLA cron (every 15 min) → breach alerts
  ├── CSAT rating on resolve → KPI dashboard
  └── Activity trail (audit)
```

**Design principles**
- **Additive only** — new tables/fields/routes/pages/roles; minimal edits to
  existing code (documented in [§17](#17-complete-file-inventory)).
- **Tenant isolation** — every ticket carries `customerAccountId`; all reads go
  through `getTenantFilter(session)`.
- **Reuse existing infra** — `withAuth`, notification service, cron scheduler,
  i18n, dynamic translation, embeddings — all pre-existing.
- **Replaceable boundaries** — outbound SMS/WhatsApp/Teams sit behind single
  functions (like `sms-service.ts`) so providers can be swapped.

---

## 3. Data model

All in `prisma/schema.prisma`. Status/priority/tier/etc. are `String` columns
with inline allowed-value comments (matching the existing Finding/CAPA
convention — not Prisma enums). Allowed values live in
`src/lib/support/constants.ts`.

### `SupportTicket`
| Field | Type | Notes |
|-------|------|-------|
| `id` | cuid | PK |
| `customerAccountId` | String | tenant (FK) |
| `ticketCode` | String | `TKT-001`, unique per tenant |
| `subject`, `description` | String | description is `@db.Text` |
| `priority` | String | P1, P2, P3, P4 (default P3) |
| `severity` | String | Critical, High, Medium, Low |
| `tier` | String | L1, L2, L3, L4 (owning team) |
| `status` | String | New, Open, In Progress, Pending Customer, Resolved, Closed, Reopened |
| `category`, `subcategory` | String? | drives routing |
| `channel` | String | InApp, Chatbot, Email, WhatsApp, Phone |
| `reporterId` / `reporterName` / `reporterEmail` / `reporterPhone` | — | reporter (user FK optional; phone for external channels) |
| `assignedToId` | FK User? | current agent |
| `departmentId` | FK Department? | |
| `originConversationId` / `botTranscript` / `escalationReason` | — | chatbot linkage |
| `acknowledgedAt` / `resolvedAt` / `closedAt` / `firstResponseAt` | DateTime? | lifecycle stamps |
| `slaAckDeadline` / `slaResolveDeadline` | DateTime? | computed on create |
| `slaAckAlertedAt` / `slaResolveAlertedAt` | DateTime? | breach-alert dedupe |
| `csatScore` / `csatComment` / `csatSubmittedAt` | — | item 13 |
| `externalRef` | String? | provider message/thread id (item 15) |
| `createdById`, `createdAt`, `updatedAt` | — | |

Indexes: `(customerAccountId)`, `(customerAccountId,status)`,
`(customerAccountId,assignedToId)`, `(customerAccountId,tier,status)`,
`(customerAccountId,externalRef)`. Unique: `(customerAccountId,ticketCode)`.

### `SupportTicketComment`
`id, ticketId (cascade), userId, comment @db.Text, isInternal (bool), createdAt`.
Internal notes vs customer-visible replies.

### `SupportTicketActivity`
`id, ticketId (cascade), actorId?, action, fromValue?, toValue?, note?, createdAt`.
Actions: created, assigned, escalated, status_changed, priority_changed,
tier_changed, commented, csat_submitted.

### `SupportRoutingRule`
`id, customerAccountId, category (unique per tenant), defaultTier, defaultPriority,
assignToDepartmentId?, keywords (JSON array string), isActive, timestamps`.

### `PasswordResetToken` (item 14)
`id, userId (cascade), otpHash (bcrypt), expiresAt, attempts, consumed,
consumedAt?, requestIp?, createdAt`. Indexes: `(userId)`, `(requestIp,createdAt)`.

### `ChatbotKBArticle` (extended for item 11)
Existing global model, plus new fields: `answer @db.Text?`, `isPublished (bool,
default true)`, `source ("seed" | "manual")`, `updatedById?`.

### Back-relations added
`User`: assigned/reported/created tickets, comments, activities, passwordResetTokens.
`CustomerAccount`: supportTickets, supportRoutingRules.
`Department`: supportTickets.

> **Reminder:** after any schema change regenerate the SQL:
> `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/schema.sql`

---

## 4. RBAC — resources, roles, scopes

Defined in `src/lib/permissions.ts` and `src/lib/role-module-map.ts`.

**Resources:** `support.console`, `support.tickets`, `support.dashboard`,
`support.kb`, `support.settings`.

**Roles** (all mapped to the GRC module in `role-module-map.ts`, seeded in
`prisma/seed.ts`):

| Role | console | tickets | dashboard | kb | settings |
|------|:------:|:------:|:------:|:------:|:------:|
| `SupportAgentL1` | view | view/create/edit **(own)** | view | — | — |
| `SupportSpecialistL2` | view | view/create/edit (all) | view | — | — |
| `SupportEngineerL3` | view | view/create/edit (all) | view | — | — |
| `SupportManager` | full | full | full | full | full |
| `CustomerAdministrator` | full | full | full | full | full |

- **`own` scope** (L1) = tickets assigned-to / reported-by / created-by the
  user. Implemented in `getTicketScopeWhere()` (`ticket-service.ts`) because
  tickets have no `ownerId` column that the generic `getDataScopeFilter` expects.
- `GRCAdministrator` (superadmin) is **not** granted support access by design —
  support is a customer-facing function. Grant a `Support*` role or use a
  `CustomerAdministrator` to access it.
- KB is a **global** table; granting `support.kb` lets a manager edit content
  seen by all tenants (acceptable for a single-customer deployment — see
  [§21](#21-future-roadmap--pending-work)).

---

## 5. API reference

All under `src/app/api/`. Protected routes use `withAuth({resource, action})`;
public ones are noted.

### Tickets
| Method & path | Resource/action | Purpose |
|---------------|-----------------|---------|
| `GET /api/support/tickets` | tickets/view | List. Filters: `search, status, priority, tier, category, channel, queue(mine\|unassigned\|open), page, pageSize`. Scope-filtered. |
| `POST /api/support/tickets` | tickets/create | Create + auto-classify; notifies assignee or tier queue; triggers translation. |
| `GET /api/support/tickets/[id]` | tickets/view | Detail incl. comments + activities. |
| `PATCH /api/support/tickets/[id]` | tickets/edit | Update subject/desc/category/priority/tier/severity/department/status; sets lifecycle stamps; logs activity. |
| `DELETE /api/support/tickets/[id]` | tickets/delete | Delete (cascades comments/activities). |
| `POST /api/support/tickets/[id]/assign` | tickets/edit | Assign/reassign (or unassign). Notifies assignee. |
| `POST /api/support/tickets/[id]/escalate` | tickets/edit | Bump tier L→L+1, return to queue, notify. |
| `GET/POST /api/support/tickets/[id]/comments` | tickets/view·edit | List / add reply or internal note. Pushes to external channel if applicable. |
| `POST /api/support/tickets/[id]/feedback` | tickets/view | CSAT 1–5 (reporter only, resolved/closed, once). |
| `POST /api/support/tickets/from-chat` | **withAuthOnly** | Chatbot handoff — any authenticated user; creates a Chatbot-channel ticket with transcript. |
| `GET /api/support/agents` | tickets/view | Assignable support users (for the assign dropdown). |

### Routing rules / settings
| `GET/POST /api/support/routing-rules` | settings/view·create |
| `PATCH/DELETE /api/support/routing-rules/[id]` | settings/edit·delete |

### KB authoring (item 11)
| `GET/POST /api/support/kb` | kb/view·create | List / create (re-embeds). |
| `PATCH/DELETE /api/support/kb/[id]` | kb/edit·delete | Edit (re-embeds if text changed) / delete (manual only). |

### Metrics (item 12)
| `GET /api/support/metrics?days=90` | dashboard/view | Aggregated KPIs. |

### SLA cron (item 10)
| `GET /api/cron/ticket-sla` | public (CRON_SECRET) | Breach checker, every 15 min. |

### Password reset (item 14) — **public**
| `POST /api/auth/forgot-password/request` | public | Issue + email OTP; throttled; abuse alert. |
| `POST /api/auth/forgot-password/reset` | public | Verify OTP + set new password. |

### Channels (item 15) — **public webhooks**
| `GET/POST /api/support/channels/whatsapp` | public (x-verify-token) | Verify handshake / inbound message → ticket. |
| `POST /api/support/channels/teams` | public (x-verify-token) | Inbound message → ticket. |

---

## 6. UI pages & components

**Pages** (`src/app/(protected)/support/` unless noted):
- `console/` — Agent Console (queue tabs: My Queue / Unassigned / Open / All)
- `tickets/` — full searchable list
- `tickets/[id]/` — detail: conversation, internal notes, status/priority/tier
  editors, assign, escalate, activity timeline, chatbot transcript, SLA status,
  CSAT widget (reporter)
- `dashboard/` — KPI cards + priority chart + distributions
- `kb/` — KB article list + editor dialog
- `settings/` — routing-rule management
- `src/app/forgot-password/` — **public** 3-step reset flow

**Shared components** (`src/components/support/`):
- `ticket-meta.tsx` — badge colour maps, option constants, `slaState()` helper
- `tickets-view.tsx` — reusable filterable table (used by console + list)
- `new-ticket-dialog.tsx` — create dialog

All strings wrapped in `t()`; RTL-aware (`ltr:`/`rtl:` variants). Navigation
entries added in `src/lib/navigation.ts` under a **Support** section
(`module: "GRC"`).

---

## 7. AI chatbot escalation

The existing chatbot (`src/lib/chatbot/`, OpenAI RAG) is **untouched except one
additive field**:
- `src/app/api/ai/chat/route.ts` → returns `escalationSuggested: true` when RAG
  confidence is `low` (covers low-confidence + no-results).
- `src/hooks/useHelpChatbot.ts` → holds a per-conversation id, captures the
  flag, exposes `createTicketFromChat(messageId)` which POSTs the last 8
  messages to `/api/support/tickets/from-chat`.
- `src/components/help-chatbot/chat-message.tsx` → renders a **"Create support
  ticket"** button on low-confidence replies; shows the ticket code after.
- `src/components/help-chatbot/help-chatbot.tsx` → wires the handler through.

The 6-layer guardrail pipeline, intent routing, and agent mode are unchanged.

---

## 8. SLA engine (cron)

- **Targets** (`SLA_TARGETS` in `constants.ts`, from SOW §10): P1 1h/4h,
  P2 4h/24h, P3 8h/72h, P4 8h/72h (ack/resolve). Deadlines computed at create
  time by `classifyTicket()`.
- **Checker** `src/app/api/cron/ticket-sla/route.ts` runs every 15 min
  (registered in `vercel.json` + `src/lib/cron-scheduler.ts`). Finds open
  tickets past a deadline, fires `SUPPORT_TICKET_SLA_BREACHED` inbox alerts to
  assignee (or tier queue) + managers, and stamps `slaAckAlertedAt` /
  `slaResolveAlertedAt` so each breach alerts **once**.
- Console rows show "Due soon / Breached" chips; detail page shows the
  resolution-SLA status.
- Manual trigger: `curl localhost:3000/api/cron/ticket-sla`.

---

## 9. Knowledge Base authoring

- Edits the **global** `ChatbotKBArticle` table (the same KB the AI concierge
  reads). New `answer` field holds the editable body; `content` holds the
  embedded text.
- On create/edit the API calls `generateEmbedding()` and re-embeds, so the AI
  picks up changes **immediately**.
- `searchKB()` now filters `isPublished: true` (drafts excluded — safe because
  all existing rows default to published).
- Seeded articles (`source:"seed"`) can be edited but **not deleted** here;
  authored ones (`source:"manual"`) can be deleted.

---

## 10. KPI dashboard

`GET /api/support/metrics?days=90` aggregates (tenant-scoped, in JS over a
lightweight projection): totals (open/resolved), by priority/tier/status/channel,
avg first-response & resolution minutes, SLA breaches + compliance %, CSAT
average + count, and chatbot-escalation count. UI `/support/dashboard` renders
KPI cards + a recharts bar chart + distribution chips.

---

## 11. CSAT / NPS

`csatScore` (1–5), `csatComment`, `csatSubmittedAt` on the ticket.
`POST /api/support/tickets/[id]/feedback` — reporter-only, resolved/closed,
once. The detail page shows a rating widget to the reporter; the score appears
in Details and the dashboard.

---

## 12. SOC password reset

- `PasswordResetToken` model + `src/lib/support/password-reset.ts` helpers.
- **Flow:** `/forgot-password` (public page) → request OTP (emailed) → enter OTP
  + new password.
- **Security:** OTP is 6-digit, **bcrypt-hashed**, 15-min expiry, single-use,
  max 5 verify attempts; throttled to 3 requests/hour per IP and per user;
  generic responses (no user enumeration); >3/hr from an IP raises a
  `SECURITY_PASSWORD_RESET_ABUSE` alert to admins; OTPs/passwords are never
  logged.
- `/forgot-password` is whitelisted in the `src/proxy.ts` middleware matcher;
  the login page's "Forgot passcode?" button links to it.

---

## 13. WhatsApp / Teams channels

- `src/lib/support/channels.ts`:
  - `handleInboundMessage()` — finds the sender's recent open ticket by
    `reporterPhone` and appends the message, else creates + classifies a new
    ticket (`channel: WhatsApp|Teams`).
  - `sendChannelReply()` — replaceable outbound boundary (dev-stubs; wire a
    provider in production).
- Webhooks: `/api/support/channels/whatsapp` (+ GET verify handshake) and
  `/teams`. Accept a simplified `{from,name,text}` shape and parse provider
  payloads (Meta / Bot Framework) leniently. Guarded by `x-verify-token`.
- Agent replies (non-internal) on a WhatsApp/Teams ticket are pushed back out
  from the comments route.
- **Tenant routing:** single-customer by default
  (`SUPPORT_DEFAULT_CUSTOMER_ACCOUNT_ID`, else the only/first account). A
  multi-customer rollout needs an inbound-number→tenant map (future work).

---

## 14. Notifications

Inbox-only (best-effort), via the existing service. New events in
`notification-constants.ts`: `SUPPORT_TICKET_CREATED`, `_ASSIGNED`,
`_ESCALATED`, `_COMMENT_ADDED`, `_SLA_WARNING`, `_SLA_BREACHED`,
`SECURITY_PASSWORD_RESET_ABUSE`. All map to `GENERIC_NOTIFICATION` email
template (email is not used for support — inbox channel only).

---

## 15. Internationalization

All UI strings use `t()` from `LanguageContext`. Ticket subject/description are
registered for **dynamic translation** (`SupportTicket` in
`translation-config.ts`); `triggerTranslation()` runs on create, and lists use
`useTranslatedData(tickets, {modelName:"SupportTicket"})`.

---

## 16. Environment variables

All optional; absence degrades gracefully.

| Var | Used by | Notes |
|-----|---------|-------|
| `CRON_SECRET` | SLA cron | Bearer auth in production (existing var) |
| `WHATSAPP_VERIFY_TOKEN` | WhatsApp webhook | Required to enable verify + `x-verify-token` guard |
| `WHATSAPP_API_TOKEN` | outbound WhatsApp | Enables real send (else stub-logs) |
| `TEAMS_VERIFY_TOKEN` | Teams webhook | guard |
| `TEAMS_BOT_TOKEN` | outbound Teams | Enables real send |
| `SUPPORT_DEFAULT_CUSTOMER_ACCOUNT_ID` | inbound channels | Tenant routing for webhooks |
| (existing email config) | password-reset OTP | OTP only sends if email service is configured |

---

## 17. Complete file inventory

### New files
```
src/lib/support/constants.ts            # allowed values, SLA targets, helpers
src/lib/support/classify-ticket.ts      # deterministic auto-tagging + SLA calc
src/lib/support/ticket-service.ts       # code gen, scope filter, activity, notify
src/lib/support/password-reset.ts       # OTP, throttle, abuse alert (item 14)
src/lib/support/channels.ts             # inbound/outbound WhatsApp/Teams (item 15)

src/app/api/support/tickets/route.ts
src/app/api/support/tickets/[id]/route.ts
src/app/api/support/tickets/[id]/assign/route.ts
src/app/api/support/tickets/[id]/escalate/route.ts
src/app/api/support/tickets/[id]/comments/route.ts
src/app/api/support/tickets/[id]/feedback/route.ts        # item 13
src/app/api/support/tickets/from-chat/route.ts
src/app/api/support/routing-rules/route.ts
src/app/api/support/routing-rules/[id]/route.ts
src/app/api/support/agents/route.ts
src/app/api/support/metrics/route.ts                      # item 12
src/app/api/support/kb/route.ts                           # item 11
src/app/api/support/kb/[id]/route.ts                      # item 11
src/app/api/support/channels/whatsapp/route.ts            # item 15
src/app/api/support/channels/teams/route.ts               # item 15
src/app/api/auth/forgot-password/request/route.ts         # item 14
src/app/api/auth/forgot-password/reset/route.ts           # item 14
src/app/api/cron/ticket-sla/route.ts                      # item 10

src/components/support/ticket-meta.tsx
src/components/support/tickets-view.tsx
src/components/support/new-ticket-dialog.tsx

src/app/(protected)/support/console/page.tsx
src/app/(protected)/support/tickets/page.tsx
src/app/(protected)/support/tickets/[id]/page.tsx
src/app/(protected)/support/settings/page.tsx
src/app/(protected)/support/dashboard/page.tsx            # item 12
src/app/(protected)/support/kb/page.tsx                   # item 11
src/app/forgot-password/page.tsx                          # item 14 (public)

scripts/seed-support-roles.ts           # upsert 4 roles into an existing DB
docs/SUPPORT_MODULE.md                  # this file
```

### Modified files (all additive / narrow)
```
prisma/schema.prisma          # 4 new models + fields + relations; ChatbotKBArticle + PasswordResetToken
prisma/schema.sql             # regenerated
prisma/seed.ts                # +4 support roles
src/lib/permissions.ts        # +5 resources, +4 roles, matrix entries
src/lib/role-module-map.ts    # +4 roles → GRC module
src/lib/navigation.ts         # +Support section & items (BookOpen import)
src/lib/notification-constants.ts   # +7 events
src/lib/notification-service.ts     # +7 email-template map entries
src/lib/translation-config.ts       # +SupportTicket
src/lib/cron-scheduler.ts           # +ticket-sla job
src/lib/chatbot/kb-embeddings.ts    # searchKB filters isPublished:true
src/app/api/ai/chat/route.ts        # +escalationSuggested field
src/hooks/useHelpChatbot.ts         # +conversationId, +createTicketFromChat
src/components/help-chatbot/chat-message.tsx   # +Create-ticket button
src/components/help-chatbot/help-chatbot.tsx   # wire handler
src/app/login/page.tsx              # "Forgot passcode?" → /forgot-password
src/proxy.ts                        # matcher excludes /forgot-password
vercel.json                         # +ticket-sla cron
```

---

## 18. How to test

Dev server: `npm run dev` → http://localhost:3000. The dev script runs
`prisma db push && prisma generate && next dev`.

1. **Access** — sign in as a **CustomerAdministrator**, or assign a user a
   `Support*` role (superadmin/GRCAdmin has no support access by design).
2. **Ticket + classify** — Support → Agent Console → New Ticket. "Payment
   gateway down" → P1/Critical/L2; "How do I export a report?" → P3/L1.
3. **Chatbot escalation** — "Need Help?" → ask something unanswerable → "Create
   support ticket" → appears in console (channel = Chatbot, transcript attached).
4. **Work a ticket** — reply, internal note, change status/priority/tier,
   assign, escalate. Check the Activity timeline.
5. **SLA** — `curl localhost:3000/api/cron/ticket-sla`; breached tickets show a
   chip and alert assignee/managers.
6. **CSAT** — resolve a ticket you reported → rate 1–5 → shows in Details + Dashboard.
7. **KB** — Support → Knowledge Base → New Article → ask the chatbot that
   question → answered from the new article.
8. **Dashboard** — Support → Support Dashboard.
9. **Password reset** — login → "Forgot passcode?" → request OTP (needs email
   configured) → reset.
10. **Channels** — `POST /api/support/channels/whatsapp` with
    `{"from":"+1...","name":"X","text":"sync failed"}` → creates a ticket.

---

## 19. Deployment checklist

- [ ] `npm run build` locally (stricter than dev) — must pass.
- [ ] Push schema to the target DB: `prisma db push` (additive; no data loss).
- [ ] Seed the 4 support roles on the cloud DB:
      `npx tsx scripts/seed-support-roles.ts` (or full reseed — `seed.ts`
      already includes them).
- [ ] Set `CRON_SECRET` so `/api/cron/ticket-sla` is protected; the Vercel cron
      is already declared in `vercel.json`.
- [ ] (Optional) Set channel + `SUPPORT_DEFAULT_CUSTOMER_ACCOUNT_ID` env vars.
- [ ] Confirm email service is configured for OTP delivery.
- [ ] Assign support roles to the relevant users.

---

## 20. Security notes

- Password reset is auth-sensitive: hashed single-use OTP, expiry, attempt
  lockout, IP/user throttle, no enumeration, no secret logging, abuse alerting.
  **Recommend running `/security-review` on this flow before production.**
- Webhooks are public but guarded by `x-verify-token` when the env tokens are
  set; without tokens they accept input (fine for dev/single-tenant, **set the
  tokens in production**).
- All ticket reads are tenant-scoped; cross-tenant access is blocked by
  `validateTenantAccess` on detail/mutation routes.
- KB authoring is global — restrict `support.kb` to trusted roles in
  multi-tenant setups.

---

## 21. Future roadmap / pending work

Nothing in the SOW's software scope is outstanding. The following are
**enhancements / operational / external** items for the future:

### A. Enhancements (code, nice-to-have)
1. **Multi-tenant KB** — today `ChatbotKBArticle` is global. Add
   `customerAccountId` (nullable for shared/system articles) so each customer
   curates its own help content. Touches `searchKB`, the seed, and the KB API.
2. **Inbound-number → tenant map** for channels (item 15) so WhatsApp/Teams work
   across multiple customers (replace the single-tenant fallback in
   `channels.ts`).
3. **Real provider adapters** for WhatsApp (MSG91/Twilio/360dialog) and Teams
   (Bot Framework) inside `sendChannelReply()` + signature verification on the
   webhooks.
4. **SLA *warning* (pre-breach) alerts** — currently only breach alerts fire;
   add an 80%-of-deadline warning using `SUPPORT_TICKET_SLA_WARNING`.
5. **Email channel intake** — parse inbound support emails into tickets (an
   email-to-ticket webhook), complementing WhatsApp/Teams.
6. **Email notifications for support** — currently inbox-only; add real email
   templates if customers want emailed ticket updates.
7. **CSAT via emailed link** — let external reporters rate without logging in
   (signed link), for email/WhatsApp-origin tickets.
8. **NPS survey** (separate from per-ticket CSAT) — periodic relationship NPS as
   the SOW §7.1 mentions.
9. **Bulk actions / saved views / export** on the ticket list.
10. **AI auto-classification v2** — optional LLM classifier (reuse the OpenAI
    client) for category/priority when keyword rules are insufficient.
11. **Reporting exports & scheduled KPI emails** (SOW §13 governance cadence).
12. **Customer health score** (SOW §7.1) — aggregate ticket velocity + CSAT into
    a churn-risk signal surfaced to Sales/CS.

### B. Operational / external (not code)
- WhatsApp Business / BSP account + approved number; Teams app registration.
- Email/SMS provider production credentials (OTP + future email intake).
- Security review + pen-test of the password-reset flow before go-live.
- Staffing the L1–L4 tiers; assigning the support roles to real users.
- Governance cadence (weekly/monthly/quarterly reviews) — process, not software.

### C. Explicitly out of scope (SOW operational sections)
Team org/RACI, SOC procedures, 3rd-party ops tooling (Datadog/Okta/Splunk/
PagerDuty), and infrastructure/BCP/DR — organizational, not part of this app.

---

## 22. How to extend the module

**Add a ticket field:** edit `SupportTicket` in `schema.prisma` → `prisma db
push` + regenerate SQL + `prisma generate` (stop the dev server first; it locks
the client DLL on Windows) → surface in the API route + detail page.

**Add a status/priority value:** update `src/lib/support/constants.ts` (single
source of truth) — the badges, selects, and validators read from it.

**Add a new support API route:** copy an existing one; wrap with
`withAuth({resource:'support.x', action})`; use `getTenantFilter(session)` +
`getTicketScopeWhere(session)` for reads; `getCustomerAccountId(session)` for
writes.

**Add a new role/resource:** add to `RESOURCES`/`ROLES`/`ROLE_PERMISSIONS` in
`permissions.ts`, to `ROLE_MODULES` in `role-module-map.ts`, and to the seed +
`scripts/seed-support-roles.ts`. (Both `Record<RoleName,...>` maps are
compile-enforced — the build fails if you miss one.)

**Add a cron:** create `src/app/api/cron/<name>/route.ts` (clone `ticket-sla`),
register in `vercel.json` + `cron-scheduler.ts`.

**Golden rule:** keep changes additive; never weaken `auth.ts`, the chatbot
guardrails, or tenant isolation. Run `npx tsc --noEmit` before declaring done.
