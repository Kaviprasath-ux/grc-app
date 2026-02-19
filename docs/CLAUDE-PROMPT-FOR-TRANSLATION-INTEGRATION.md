# Claude Prompt — Dynamic Data Translation Integration

Copy everything below the line and paste it to your Claude Code session.

---

## PROMPT START — COPY FROM HERE

You are working on a GRC (Governance, Risk, and Compliance) Next.js application. A **Dynamic Data Translation system** has been built (Phases 1-4 complete) to translate user-entered data (risk names, descriptions, settings values, etc.) into Arabic and Latvian using a Python GPT backend.

Your task is to **integrate this translation system into the page(s) assigned to you**. Read the integration guide at `docs/TRANSLATION-INTEGRATION-GUIDE.md` first — it has all patterns, model names, field mappings, and examples.

### What you need to do:

**For each page assigned to you, there are TWO parts:**

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

### Important Rules:
1. The `modelName` MUST match exactly what's in `src/lib/translation-config.ts` (e.g., `'Risk'` not `'risk'`)
2. Include ALL translatable fields for that model (check `translation-config.ts` for the field list)
3. DO NOT modify any existing files except the specific page component and its API routes
4. DO NOT modify any shared components, hooks, or utilities
5. DO NOT add new dependencies
6. DO NOT refactor or clean up surrounding code
7. The `session.user.customerAccountId` is available in API route handlers via `withAuth`

### Reference files to read:
- `docs/TRANSLATION-INTEGRATION-GUIDE.md` — Full integration guide with patterns and examples
- `src/lib/translation-config.ts` — Model registry (check your model's exact name and fields)
- `src/hooks/useTranslatedData.ts` — Hook API reference
- `src/app/(protected)/risks/register/page.tsx` — Working example of list page integration
- `src/components/risks/new-risk-wizard.tsx` — Working example of form integration (triggerTranslation)

### My assigned page(s):

**[DEVELOPER: Replace this section with your assigned pages. Examples below:]**

Example 1: "Integrate translation for the Controls page"
- List page: `src/app/(protected)/compliance/control/page.tsx` (or wherever the controls list is)
- API route: `src/app/api/controls/route.ts` and `src/app/api/controls/[id]/route.ts`
- Model: `Control` (fields: name, description)

Example 2: "Integrate translation for Risk Settings page"
- Page: `src/app/(protected)/risks/settings/page.tsx`
- API routes: `src/app/api/risk-categories/route.ts`, `src/app/api/risk-types/route.ts`, `src/app/api/risk-likelihoods/route.ts`, `src/app/api/risk-ranges/route.ts`, `src/app/api/impact-categories/route.ts`, `src/app/api/impact-ratings/route.ts`, `src/app/api/vulnerability-categories/route.ts`, `src/app/api/vulnerability-ratings/route.ts`, `src/app/api/threat-categories/route.ts`, `src/app/api/control-strengths/route.ts`, `src/app/api/risk-sub-categories/route.ts`
- Models: RiskCategory, RiskType, RiskLikelihood, RiskRange, ImpactCategory, ImpactRating, VulnerabilityCategory, VulnerabilityRating, ThreatCategory, ControlStrength, RiskSubCategory

### Steps:
1. First read `docs/TRANSLATION-INTEGRATION-GUIDE.md`
2. Then read `src/lib/translation-config.ts` to find your model's fields
3. Read the existing working example: `src/app/(protected)/risks/register/page.tsx` (see the `useTranslatedData` integration)
4. Read your assigned page component to understand its structure
5. Read the API route(s) for your model
6. Make the changes following the patterns exactly
7. Test: page loads in English with 0 errors, switch to Arabic — no crashes, switch back — no issues

## PROMPT END
