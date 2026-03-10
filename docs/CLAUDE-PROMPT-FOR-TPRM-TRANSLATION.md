# Claude Prompt — TPRM Dynamic Data Translation Integration

Copy everything below the line and paste it to your Claude Code session.

---

## PROMPT START — COPY FROM HERE

You are working on a GRC (Governance, Risk, and Compliance) Next.js application. A **Dynamic Data Translation system** has been built (Phases 1-4 complete) to translate user-entered data into Arabic and Latvian using a Python GPT backend.

Your task is to **integrate this translation system into ALL TPRM (Third-Party Risk Management) pages**. Read these files first:
- `docs/TRANSLATION-INTEGRATION-GUIDE.md` — General integration patterns and examples
- `docs/TPRM-TRANSLATION-INTEGRATION-GUIDE.md` — TPRM-specific models, pages, API routes, and field mappings

### What you need to do:

**For each page, there are THREE parts:**

#### Part 1: Frontend (Display page)
- Add `useTranslatedData` hook (for list pages) or `useTranslatedRecord` hook (for detail pages) from `@/hooks/useTranslatedData`
- The hook must be called BEFORE any early returns (React hooks rule)
- Replace the original data variable with the translated version for rendering/pagination
- DO NOT change anything else on the page — no refactoring, no cleanup, only add translation

#### Part 2: Backend (API routes)
- In POST handlers: add `void translateRecord(customerAccountId, 'ModelName', record.id, { fields })` after record creation
- In PATCH/PUT handlers: add `void translateRecord(...)` after record update
- In DELETE handlers: add `void deleteRecordTranslations(customerAccountId, 'ModelName', recordId)` after record deletion
- Import from `@/lib/translation-service`
- These are fire-and-forget calls — use `void` prefix, do NOT await them

#### Part 3: Create/Edit forms (if inline in the page component)
- Add `triggerTranslation('ModelName', recordId, { fields })` from `@/hooks/useTranslatedData` after successful save
- This is also fire-and-forget — do NOT await it

---

### STEP 1: Register New Models

First, add these new TPRM models to `src/lib/translation-config.ts`. Add them after the existing TPRM entries:

```typescript
// Priority 5 — TPRM (add after existing TPRMAssessment entry)
{ modelName: 'TPRMVendorIssue', fields: [{ name: 'title' }, { name: 'description' }, { name: 'resolution' }], priority: 5 },
{ modelName: 'TPRMIssueRemediation', fields: [{ name: 'issue' }, { name: 'risk' }, { name: 'recommendation' }, { name: 'description' }], priority: 5 },

// Priority 6 — TPRM Master Data (add after existing TPRMMasterQuestion entry)
{ modelName: 'TPRMQuestionnaireTemplate', fields: [{ name: 'templateName' }, { name: 'frameworkName' }], priority: 6 },
{ modelName: 'TPRMServiceCategory', fields: [{ name: 'name' }], priority: 6 },
{ modelName: 'TPRMDiscipline', fields: [{ name: 'name' }], priority: 6 },
{ modelName: 'TPRMOnboardingQuestion', fields: [{ name: 'title' }, { name: 'question' }], priority: 6 },
{ modelName: 'TPRMOffboardingQuestion', fields: [{ name: 'title' }, { name: 'question' }], priority: 6 },
{ modelName: 'TPRMScorecardFactor', fields: [{ name: 'name' }], priority: 6 },
{ modelName: 'TPRMClarification', fields: [{ name: 'rejectComment' }, { name: 'amResponse' }], priority: 6 },
{ modelName: 'TPRMRemediationComment', fields: [{ name: 'message' }], priority: 6 },
```

---

### STEP 2: Integrate Pages (in priority order)

Work through these groups in order. For each page:
1. Read the page component
2. Add `useTranslatedData` hook for each data list
3. Read the API route
4. Add `translateRecord` / `deleteRecordTranslations` calls

#### Priority A — Core Management Pages

**Vendor Management:**
- Page: `src/app/(protected)/tprm/vendor-management/page.tsx`
- API: `src/app/api/tprm/vendors/route.ts`, `src/app/api/tprm/vendors/[id]/route.ts`
- Model: `TPRMVendor` — fields: `name`, `serviceCategory`

**Master Data:**
- Page: `src/app/(protected)/tprm/master-data/page.tsx`
- API: `src/app/api/tprm/master-data/[type]/route.ts`
- Models: `TPRMDomain` (`name`, `description`), `TPRMMasterQuestion` (`questionText`), `TPRMQuestionnaireTemplate` (`templateName`, `frameworkName`), `TPRMServiceCategory` (`name`), `TPRMDiscipline` (`name`), `TPRMScorecardFactor` (`name`)

**Configurations:**
- Page: `src/app/(protected)/tprm/configurations/page.tsx`
- API: `src/app/api/tprm/configurations/[type]/route.ts`
- Models: `TPRMOnboardingQuestion` (`title`, `question`), `TPRMOffboardingQuestion` (`title`, `question`)

#### Priority B — Assessment Pages

**Assessment list + detail pages:**
- `src/app/(protected)/tprm/assessments/page.tsx` — Model: `TPRMAssessment`
- `src/app/(protected)/tprm/asr-assessments/page.tsx` + `[id]/page.tsx` — Models: `TPRMAssessment`, `TPRMVendor`, `TPRMMasterQuestion`, `TPRMDomain`
- `src/app/(protected)/tprm/am-assessments/page.tsx` + `[id]/page.tsx` — Models: `TPRMAssessment`, `TPRMVendor`, `TPRMMasterQuestion`
- `src/app/(protected)/tprm/bo-assessments/page.tsx` — Models: `TPRMAssessment`, `TPRMVendor`
- `src/app/(protected)/tprm/rm-assessments/page.tsx` — Models: `TPRMAssessment`, `TPRMVendor`
- APIs: `src/app/api/tprm/assessments/route.ts`, `src/app/api/tprm/assessments/[id]/route.ts`, `src/app/api/tprm/asr-assessments/[id]/route.ts`

#### Priority C — Issue Management Pages

**Issue pages:**
- `src/app/(protected)/tprm/asr-issue-register/page.tsx` — Model: `TPRMIssueRemediation`
- `src/app/(protected)/tprm/bo-issues/page.tsx` — Models: `TPRMIssueRemediation`, `TPRMVendorIssue`
- `src/app/(protected)/tprm/rm-issues/page.tsx` — Models: `TPRMIssueRemediation`, `TPRMVendorIssue`
- `src/app/(protected)/tprm/it-issues/page.tsx` — Model: `TPRMIssueRemediation`
- APIs: `src/app/api/tprm/asr-issues/route.ts`, `src/app/api/tprm/bo-issues/route.ts`, `src/app/api/tprm/rm-issues/route.ts`, `src/app/api/tprm/it-issues/route.ts`
- Comments API: `src/app/api/tprm/remediation-comments/route.ts` — Model: `TPRMRemediationComment` (`message`)

#### Priority D — Inventory, Contracts, Monitoring, Reports

All these pages display vendor data — add `useTranslatedData(vendors, { modelName: 'TPRMVendor' })`:
- `src/app/(protected)/tprm/rm-inventory/page.tsx`
- `src/app/(protected)/tprm/bo-inventory/page.tsx`
- `src/app/(protected)/tprm/asr-inventory/page.tsx`
- `src/app/(protected)/tprm/bo-contracts/page.tsx`
- `src/app/(protected)/tprm/rm-contracts/page.tsx`
- `src/app/(protected)/tprm/monitoring/page.tsx`
- `src/app/(protected)/tprm/bo-reports/page.tsx`
- `src/app/(protected)/tprm/rm-reports/page.tsx`
- `src/app/(protected)/tprm/asr-factory-reports/page.tsx`

Monitoring report-issue API: `src/app/api/tprm/monitoring/report-issue/route.ts` — POST: `translateRecord('TPRMVendorIssue', ...)`

#### Priority E — Dashboard & Follow-Up Pages

**Dashboards** (vendor/assessment data):
- `src/app/(protected)/tprm/asr-dashboard/page.tsx`
- `src/app/(protected)/tprm/bo-dashboard/page.tsx`
- `src/app/(protected)/tprm/rm-dashboard/page.tsx`

**Follow-ups:**
- `src/app/(protected)/tprm/asr-follow-ups/page.tsx` — Models: `TPRMClarification`, `TPRMIssueRemediation`
- `src/app/(protected)/tprm/am-follow-ups/page.tsx` — Model: `TPRMClarification`
- API: `src/app/api/tprm/am-follow-ups/clarifications/route.ts` — PATCH: `translateRecord('TPRMClarification', ...)`

---

### Important Rules:
1. The `modelName` MUST match exactly what's in `src/lib/translation-config.ts` (e.g., `'TPRMVendor'` not `'tprmvendor'`)
2. Include ALL translatable fields for that model (check `docs/TPRM-TRANSLATION-INTEGRATION-GUIDE.md` for field lists)
3. DO NOT modify any shared components, hooks, or utilities
4. DO NOT refactor or clean up surrounding code — ONLY add translation integration
5. Use `getCustomerAccountId(session)` for the customerAccountId in API routes
6. Hook calls must come BEFORE any early returns (React hooks rule)
7. `void translateRecord(...)` — fire-and-forget, do NOT await
8. `triggerTranslation(...)` — fire-and-forget, do NOT await

### Reference files to read:
- `docs/TRANSLATION-INTEGRATION-GUIDE.md` — General patterns and examples
- `docs/TPRM-TRANSLATION-INTEGRATION-GUIDE.md` — TPRM-specific models, pages, API routes
- `src/lib/translation-config.ts` — Model registry (verify model names and fields)
- `src/hooks/useTranslatedData.ts` — Hook API reference
- `src/app/(protected)/risks/register/page.tsx` — Working example of list page integration
- `src/components/risks/new-risk-wizard.tsx` — Working example of form integration (triggerTranslation)

### Steps:
1. Read `docs/TPRM-TRANSLATION-INTEGRATION-GUIDE.md` (TPRM-specific guide)
2. Read `docs/TRANSLATION-INTEGRATION-GUIDE.md` (general patterns)
3. Read `src/lib/translation-config.ts` — add the new TPRM models listed above
4. Read the working example: `src/app/(protected)/risks/register/page.tsx`
5. Work through Priority A → B → C → D → E
6. For each page: read it, add the hook, read its API route, add translateRecord calls
7. Test: each page loads in English with 0 errors, switch to Arabic — no crashes

## PROMPT END
