# TPRM Dynamic Data Translation — Integration Guide

## Context

The GRC app supports 3 languages: English (default), Arabic (RTL), Latvian (LTR).
Static UI strings are already translated using `t()` from `useLanguage()`.

A **Dynamic Data Translation system** (Phases 1-4 complete) translates **user-entered data** (vendor names, issue descriptions, question text, etc.) into Arabic and Latvian using a Python GPT backend. This guide covers **Phase 5: integrating it into all TPRM pages**.

For the general integration guide, see `docs/TRANSLATION-INTEGRATION-GUIDE.md`.

---

## Architecture Overview

### How It Works
1. **On Create/Edit** — When a user creates or edits a TPRM record (vendor, assessment, issue, etc.), we call `triggerTranslation()` (frontend) or `translateRecord()` (API route). This fires a POST to `/api/translations/translate`. The server translates the text to Arabic & Latvian via our Python GPT API and stores translations in the `DynamicTranslation` table.
2. **On Display (non-English)** — When the user switches to Arabic/Latvian, the `useTranslatedData` hook calls `/api/translations/bulk` to fetch stored translations and overlays them on the original data. If no translation exists, the original text is shown (graceful fallback).
3. **Multi-language input** — Users can enter data in ANY language. The system auto-detects the source language and translates to all OTHER languages (including English if data was entered in Arabic).

### Key Files (DO NOT modify — already complete)
- `src/hooks/useTranslatedData.ts` — Frontend hooks (`useTranslatedData`, `useTranslatedRecord`, `triggerTranslation`)
- `src/lib/translation-service.ts` — Backend translation service (`translateRecord`, `deleteRecordTranslations`)
- `src/lib/translation-config.ts` — Registry of all translatable models and their fields
- `src/app/api/translations/` — Translation API routes (4 files)

### Data Flow Diagram
```
User creates/edits vendor
    → Frontend: triggerTranslation('TPRMVendor', id, { name, serviceCategory })
    → POST /api/translations/translate
    → Python GPT backend translates → stores in DynamicTranslation table

User views page in Arabic
    → useTranslatedData(vendors, { modelName: 'TPRMVendor' })
    → GET /api/translations/bulk?modelName=TPRMVendor&ids=...&locale=ar
    → Returns translated data overlaid on original
```

---

## Integration Pattern A: List Pages (Tables)

Use `useTranslatedData` hook to translate data displayed in tables/lists. Most TPRM pages use this pattern.

### Step-by-Step

**1. Add import:**
```typescript
import { useTranslatedData } from "@/hooks/useTranslatedData";
```

**2. Add hook call BEFORE any early returns (React hooks rule):**
```typescript
const { data: translatedVendors } = useTranslatedData(vendors, { modelName: 'TPRMVendor' });
```

**3. Use `translatedVendors` instead of `vendors` for rendering:**
```typescript
const paginatedVendors = translatedVendors.slice(start, end);
return paginatedVendors.map(v => <Row key={v.id} data={v} />);
```

### TPRM Example — Vendor Management Page:
```typescript
import { useTranslatedData } from "@/hooks/useTranslatedData";

function VendorManagementPage() {
  const [vendors, setVendors] = useState([]);
  // ... existing fetch logic ...

  // ADD THIS — translates name & serviceCategory when locale is ar/lv
  const { data: translatedVendors } = useTranslatedData(vendors, { modelName: 'TPRMVendor' });

  // USE translatedVendors for pagination/rendering
  const totalPages = Math.ceil(translatedVendors.length / ITEMS_PER_PAGE);
  const paginatedVendors = translatedVendors.slice(start, end);

  if (loading) return <Spinner />;

  return (
    <Table>
      {paginatedVendors.map(vendor => (
        <TableRow key={vendor.id}>
          <TableCell>{vendor.name}</TableCell>
          <TableCell>{vendor.serviceCategory}</TableCell>
        </TableRow>
      ))}
    </Table>
  );
}
```

### TPRM Example — Multi-model page (BO Issues with tabs):
```typescript
// When a page fetches multiple data types, add useTranslatedData for each
const { data: translatedRemediations } = useTranslatedData(remediations, { modelName: 'TPRMIssueRemediation' });
const { data: translatedVendorIssues } = useTranslatedData(vendorIssues, { modelName: 'TPRMVendorIssue' });

// Use translatedRemediations in the Remediation tab
// Use translatedVendorIssues in the Vendor Issues tab
```

### IMPORTANT: Hook must be called BEFORE early returns
```typescript
// WRONG — violates React hooks rule
if (loading) return <Spinner />;
const { data } = useTranslatedData(vendors, { modelName: 'TPRMVendor' }); // ERROR!

// CORRECT — hook before early returns
const { data } = useTranslatedData(vendors, { modelName: 'TPRMVendor' });
if (loading) return <Spinner />;
```

---

## Integration Pattern B: Detail Pages (Single Record)

Use `useTranslatedRecord` for pages that display a single record (e.g., assessment detail, monitoring detail).

### TPRM Example — Assessment Detail Page:
```typescript
import { useTranslatedRecord } from "@/hooks/useTranslatedData";

function AssessmentDetailPage({ assessment }) {
  const { data: translatedAssessment } = useTranslatedRecord(assessment, { modelName: 'TPRMAssessment' });

  return (
    <div>
      <h1>{translatedAssessment.questionnaireTemplate}</h1>
      <p>{translatedAssessment.approverComment}</p>
    </div>
  );
}
```

### TPRM Example — Assessment Detail with nested translated data:
```typescript
// For detail pages that show questions and domains within an assessment:
const { data: translatedQuestions } = useTranslatedData(questions, { modelName: 'TPRMMasterQuestion' });
const { data: translatedDomains } = useTranslatedData(domains, { modelName: 'TPRMDomain' });

// Render using translatedQuestions and translatedDomains
```

---

## Integration Pattern C: Create/Edit Forms (Trigger Translation)

When a record is created or edited, trigger translation in the background.

### In Frontend Components (client-side forms):
```typescript
import { triggerTranslation } from "@/hooks/useTranslatedData";

// After successful create/edit API call:
if (response.ok) {
  const data = await response.json().catch(() => null);
  const recordId = isEditMode ? editData.id : data?.id;

  if (recordId) {
    triggerTranslation('TPRMVendor', recordId, {
      name: formData.name,
      serviceCategory: formData.serviceCategory || null,
    });
  }

  toast.success("Vendor saved successfully");
}
```

### In API Routes (server-side — preferred):
```typescript
import { translateRecord } from '@/lib/translation-service';

// POST handler — after creating the record:
export const POST = withAuth(async (req, context, session) => {
  const customerAccountId = getCustomerAccountId(session);
  // ... create record ...
  const vendor = await prisma.tPRMVendor.create({ data: { ... } });

  // Fire-and-forget translation (don't await)
  void translateRecord(customerAccountId, 'TPRMVendor', vendor.id, {
    name: vendor.name,
    serviceCategory: vendor.serviceCategory,
  });

  return NextResponse.json(vendor, { status: 201 });
});

// PATCH handler — after updating the record:
export const PATCH = withAuth(async (req, context, session) => {
  const customerAccountId = getCustomerAccountId(session);
  // ... update record ...
  const updated = await prisma.tPRMVendor.update({ ... });

  // Fire-and-forget translation
  void translateRecord(customerAccountId, 'TPRMVendor', updated.id, {
    name: updated.name,
    serviceCategory: updated.serviceCategory,
  });

  return NextResponse.json(updated);
});
```

### For DELETE handlers:
```typescript
import { deleteRecordTranslations } from '@/lib/translation-service';

// After deleting the record:
void deleteRecordTranslations(customerAccountId, 'TPRMVendor', vendorId);
```

### TPRM-specific: Master Data `[type]` route with multiple models:
```typescript
import { translateRecord, deleteRecordTranslations } from '@/lib/translation-service';

const typeToModel: Record<string, string> = {
  'domains': 'TPRMDomain',
  'questions': 'TPRMMasterQuestion',
  'questionnaires': 'TPRMQuestionnaireTemplate',
  'service-categories': 'TPRMServiceCategory',
  'disciplines': 'TPRMDiscipline',
  'scorecard-factors': 'TPRMScorecardFactor',
};

const typeToFields: Record<string, (record: any) => Record<string, any>> = {
  'domains': (r) => ({ name: r.name, description: r.description }),
  'questions': (r) => ({ questionText: r.questionText }),
  'questionnaires': (r) => ({ templateName: r.templateName, frameworkName: r.frameworkName }),
  'service-categories': (r) => ({ name: r.name }),
  'disciplines': (r) => ({ name: r.name }),
  'scorecard-factors': (r) => ({ name: r.name }),
};

// In POST handler:
const modelName = typeToModel[type];
if (modelName) {
  const fields = typeToFields[type]?.(record) || {};
  void translateRecord(customerAccountId, modelName, record.id, fields);
}

// In DELETE handler:
const modelName = typeToModel[type];
if (modelName) {
  void deleteRecordTranslations(customerAccountId, modelName, recordId);
}
```

---

## TPRM Models — Complete Reference

### Already Registered in `src/lib/translation-config.ts`:

| modelName | Fields | Priority | Pages |
|-----------|--------|----------|-------|
| `TPRMVendor` | `name`, `serviceCategory` | 5 | Vendor Management, all inventory/contract/report/dashboard pages |
| `TPRMAssessment` | `questionnaireTemplate`, `approverComment` | 5 | Assessments list, ASR/AM/BO/RM assessments, dashboards |
| `TPRMDomain` | `name`, `description` | 6 | Master Data, ASR Assessment detail |
| `TPRMMasterQuestion` | `questionText` | 6 | Master Data, ASR/AM Assessment detail |

### Models to ADD to `src/lib/translation-config.ts`:

| modelName | Fields | Priority | Pages |
|-----------|--------|----------|-------|
| `TPRMVendorIssue` | `title`, `description`, `resolution` | 5 | BO Issues (vendor-issues tab), RM Issues, Monitoring |
| `TPRMIssueRemediation` | `issue`, `risk`, `recommendation`, `description` | 5 | ASR Issue Register, BO Issues, RM Issues, IT Issues, Follow-ups |
| `TPRMQuestionnaireTemplate` | `templateName`, `frameworkName` | 6 | Master Data (questionnaires tab) |
| `TPRMServiceCategory` | `name` | 6 | Master Data (service-categories tab) |
| `TPRMDiscipline` | `name` | 6 | Master Data (disciplines tab) |
| `TPRMOnboardingQuestion` | `title`, `question` | 6 | Configurations (onboarding tab) |
| `TPRMOffboardingQuestion` | `title`, `question` | 6 | Configurations (offboarding tab) |
| `TPRMScorecardFactor` | `name` | 6 | Master Data (scorecard-factors tab) |
| `TPRMClarification` | `rejectComment`, `amResponse` | 6 | ASR Follow-ups, AM Follow-ups |
| `TPRMRemediationComment` | `message` | 6 | BO Issues, RM Issues (comment dialogs) |

### Code to add in `src/lib/translation-config.ts`:

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

## TPRM Pages — Step-by-Step Integration Checklist

### Priority A — Core Management Pages (do these first)

#### 1. Vendor Management
- **Page:** `src/app/(protected)/tprm/vendor-management/page.tsx`
- **API:** `src/app/api/tprm/vendors/route.ts`, `src/app/api/tprm/vendors/[id]/route.ts`
- **Model:** `TPRMVendor` (fields: `name`, `serviceCategory`)
- [ ] Frontend: Add `useTranslatedData(vendors, { modelName: 'TPRMVendor' })` before early returns
- [ ] Frontend: Replace `vendors` with `translatedVendors` for rendering/pagination
- [ ] API POST: Add `void translateRecord(customerAccountId, 'TPRMVendor', vendor.id, { name, serviceCategory })`
- [ ] API PATCH: Add `void translateRecord(customerAccountId, 'TPRMVendor', vendor.id, { name, serviceCategory })`
- [ ] API DELETE: Add `void deleteRecordTranslations(customerAccountId, 'TPRMVendor', vendorId)`
- [ ] If inline create/edit form: Add `triggerTranslation('TPRMVendor', id, { name, serviceCategory })` after save

#### 2. Master Data
- **Page:** `src/app/(protected)/tprm/master-data/page.tsx`
- **API:** `src/app/api/tprm/master-data/[type]/route.ts`
- **Models:** `TPRMDomain`, `TPRMMasterQuestion`, `TPRMQuestionnaireTemplate`, `TPRMServiceCategory`, `TPRMDiscipline`, `TPRMScorecardFactor`
- [ ] Frontend: Add `useTranslatedData` for each data list (domains, questions, templates, service-categories, disciplines, scorecard-factors)
- [ ] API: Add `typeToModel` mapping (see Pattern C example above)
- [ ] API POST: Add `void translateRecord(customerAccountId, modelName, record.id, fields)`
- [ ] API PATCH: Add `void translateRecord(...)` after update
- [ ] API DELETE: Add `void deleteRecordTranslations(customerAccountId, modelName, recordId)`

#### 3. Configurations
- **Page:** `src/app/(protected)/tprm/configurations/page.tsx`
- **API:** `src/app/api/tprm/configurations/[type]/route.ts`
- **Models:** `TPRMOnboardingQuestion` (`title`, `question`), `TPRMOffboardingQuestion` (`title`, `question`)
- [ ] Frontend: Add `useTranslatedData` for onboarding and offboarding question lists
- [ ] API POST: Add `void translateRecord(customerAccountId, modelName, record.id, { title, question })`
- [ ] API PATCH: Add `void translateRecord(...)` after update

#### 4. Settings
- **Page:** `src/app/(protected)/tprm/settings/page.tsx`
- **Models:** Various TPRM settings models
- [ ] Frontend: Add `useTranslatedData` where settings values are displayed

---

### Priority B — Assessment Pages

#### 5. Assessments List
- **Page:** `src/app/(protected)/tprm/assessments/page.tsx`
- **API:** `src/app/api/tprm/assessments/route.ts`, `src/app/api/tprm/assessments/[id]/route.ts`
- **Model:** `TPRMAssessment` (`questionnaireTemplate`, `approverComment`)
- [ ] Frontend: Add `useTranslatedData(assessments, { modelName: 'TPRMAssessment' })`
- [ ] API POST: `void translateRecord(customerAccountId, 'TPRMAssessment', assessment.id, { questionnaireTemplate, approverComment })`
- [ ] API PATCH: `void translateRecord(...)` after update

#### 6. ASR Assessments (Assessor view)
- **List:** `src/app/(protected)/tprm/asr-assessments/page.tsx`
- **Detail:** `src/app/(protected)/tprm/asr-assessments/[id]/page.tsx`
- **API:** `src/app/api/tprm/asr-assessments/[id]/route.ts`
- **Models:** `TPRMAssessment`, `TPRMVendor`, `TPRMMasterQuestion`, `TPRMDomain`
- [ ] List page: `useTranslatedData(assessments, { modelName: 'TPRMAssessment' })`
- [ ] Detail page: `useTranslatedData` for questions (`TPRMMasterQuestion`) and domains (`TPRMDomain`)
- [ ] API PATCH: `void translateRecord(customerAccountId, 'TPRMAssessment', id, { approverComment })`

#### 7. AM Assessments (Account Manager view)
- **List:** `src/app/(protected)/tprm/am-assessments/page.tsx`
- **Detail:** `src/app/(protected)/tprm/am-assessments/[id]/page.tsx`
- **API:** `src/app/api/tprm/am-assessments/[id]/route.ts`
- **Models:** `TPRMAssessment`, `TPRMVendor`, `TPRMMasterQuestion`
- [ ] List page: `useTranslatedData(assessments, { modelName: 'TPRMAssessment' })`
- [ ] Detail page: `useTranslatedData` for questions

#### 8. BO Assessments & RM Assessments
- **Pages:** `src/app/(protected)/tprm/bo-assessments/page.tsx`, `src/app/(protected)/tprm/rm-assessments/page.tsx`
- **Models:** `TPRMAssessment`, `TPRMVendor`
- [ ] Frontend: `useTranslatedData(assessments, { modelName: 'TPRMAssessment' })`

---

### Priority C — Issue Management Pages

#### 9. ASR Issue Register
- **Page:** `src/app/(protected)/tprm/asr-issue-register/page.tsx`
- **API:** `src/app/api/tprm/asr-issues/route.ts`
- **Models:** `TPRMIssueRemediation` (`issue`, `risk`, `recommendation`, `description`)
- [ ] Frontend: `useTranslatedData(remediations, { modelName: 'TPRMIssueRemediation' })`
- [ ] API POST: `void translateRecord(customerAccountId, 'TPRMIssueRemediation', rem.id, { issue, risk, recommendation, description })`
- [ ] API PATCH: `void translateRecord(...)` after update

#### 10. BO Issues
- **Page:** `src/app/(protected)/tprm/bo-issues/page.tsx`
- **API:** `src/app/api/tprm/bo-issues/route.ts`
- **Models:** `TPRMIssueRemediation`, `TPRMVendorIssue`, `TPRMRemediationComment`
- [ ] Frontend: `useTranslatedData(remediations, { modelName: 'TPRMIssueRemediation' })`
- [ ] Frontend: `useTranslatedData(vendorIssues, { modelName: 'TPRMVendorIssue' })`
- [ ] API PATCH: `void translateRecord(...)` after status/comment updates

#### 11. RM Issues
- **Page:** `src/app/(protected)/tprm/rm-issues/page.tsx`
- **API:** `src/app/api/tprm/rm-issues/route.ts`
- **Models:** `TPRMIssueRemediation`, `TPRMVendorIssue`, `TPRMRemediationComment`
- [ ] Frontend: `useTranslatedData` for remediation and vendor issue lists
- [ ] API PATCH: `void translateRecord(...)` after updates

#### 12. IT Issues
- **Page:** `src/app/(protected)/tprm/it-issues/page.tsx`
- **API:** `src/app/api/tprm/it-issues/route.ts`
- **Model:** `TPRMIssueRemediation`
- [ ] Frontend: `useTranslatedData(remediations, { modelName: 'TPRMIssueRemediation' })`
- [ ] API PATCH: `void translateRecord(...)` after updates

#### 13. Remediation Comments (shared API)
- **API:** `src/app/api/tprm/remediation-comments/route.ts`
- **Model:** `TPRMRemediationComment` (`message`)
- [ ] API POST: `void translateRecord(customerAccountId, 'TPRMRemediationComment', comment.id, { message })`

---

### Priority D — Inventory, Contracts, Monitoring, Reports

#### 14. Inventory Pages (display-only — no API changes needed)
- `src/app/(protected)/tprm/rm-inventory/page.tsx`
- `src/app/(protected)/tprm/bo-inventory/page.tsx`
- `src/app/(protected)/tprm/asr-inventory/page.tsx`
- **Model:** `TPRMVendor`
- [ ] Frontend: `useTranslatedData(vendors, { modelName: 'TPRMVendor' })`

#### 15. Contract Pages (display-only)
- `src/app/(protected)/tprm/bo-contracts/page.tsx`
- `src/app/(protected)/tprm/rm-contracts/page.tsx`
- **Model:** `TPRMVendor`
- [ ] Frontend: `useTranslatedData(vendors, { modelName: 'TPRMVendor' })`

#### 16. Monitoring
- **Page:** `src/app/(protected)/tprm/monitoring/page.tsx`
- **Detail:** `src/app/(protected)/tprm/monitoring/[id]/page.tsx`
- **API:** `src/app/api/tprm/monitoring/report-issue/route.ts`
- **Models:** `TPRMVendor`, `TPRMVendorIssue`
- [ ] Frontend: `useTranslatedData(vendors, { modelName: 'TPRMVendor' })`
- [ ] report-issue API POST: `void translateRecord(customerAccountId, 'TPRMVendorIssue', issue.id, { title, description })`

#### 17. Reports Pages (display-only)
- `src/app/(protected)/tprm/bo-reports/page.tsx`
- `src/app/(protected)/tprm/rm-reports/page.tsx`
- `src/app/(protected)/tprm/asr-factory-reports/page.tsx`
- **Model:** `TPRMVendor`
- [ ] Frontend: `useTranslatedData(vendors, { modelName: 'TPRMVendor' })`

---

### Priority E — Dashboard & Follow-Up Pages

#### 18. Dashboard Pages (display-only)
- `src/app/(protected)/tprm/asr-dashboard/page.tsx`
- `src/app/(protected)/tprm/bo-dashboard/page.tsx`
- `src/app/(protected)/tprm/rm-dashboard/page.tsx`
- **Models:** `TPRMVendor`, `TPRMAssessment`
- [ ] Frontend: `useTranslatedData` for vendor/assessment lists

#### 19. Follow-Up Pages
- `src/app/(protected)/tprm/asr-follow-ups/page.tsx` — Models: `TPRMClarification`, `TPRMIssueRemediation`
- `src/app/(protected)/tprm/am-follow-ups/page.tsx` — Model: `TPRMClarification`
- **API:** `src/app/api/tprm/am-follow-ups/clarifications/route.ts`
- [ ] Frontend: `useTranslatedData` for clarification and remediation lists
- [ ] clarifications API PATCH: `void translateRecord(customerAccountId, 'TPRMClarification', clar.id, { rejectComment, amResponse })`

---

## API Route Summary

| API Route | Method | Model | translateRecord Fields |
|-----------|--------|-------|----------------------|
| `api/tprm/vendors/route.ts` | POST | `TPRMVendor` | `name`, `serviceCategory` |
| `api/tprm/vendors/[id]/route.ts` | PATCH | `TPRMVendor` | `name`, `serviceCategory` |
| `api/tprm/vendors/[id]/route.ts` | DELETE | `TPRMVendor` | `deleteRecordTranslations` |
| `api/tprm/assessments/route.ts` | POST | `TPRMAssessment` | `questionnaireTemplate`, `approverComment` |
| `api/tprm/assessments/[id]/route.ts` | PATCH | `TPRMAssessment` | `questionnaireTemplate`, `approverComment` |
| `api/tprm/asr-assessments/[id]/route.ts` | PATCH | `TPRMAssessment` | `approverComment` |
| `api/tprm/master-data/[type]/route.ts` | POST/PATCH/DELETE | Multiple | Map `type` → modelName (see mapping below) |
| `api/tprm/configurations/[type]/route.ts` | POST/PATCH | `TPRMOnboardingQuestion`, `TPRMOffboardingQuestion` | `title`, `question` |
| `api/tprm/asr-issues/route.ts` | POST/PATCH | `TPRMIssueRemediation` | `issue`, `risk`, `recommendation`, `description` |
| `api/tprm/bo-issues/route.ts` | PATCH | `TPRMIssueRemediation` | `issue`, `risk`, `recommendation`, `description` |
| `api/tprm/rm-issues/route.ts` | PATCH | `TPRMIssueRemediation` | `issue`, `risk`, `recommendation`, `description` |
| `api/tprm/it-issues/route.ts` | PATCH | `TPRMIssueRemediation` | `issue`, `risk`, `recommendation`, `description` |
| `api/tprm/remediation-comments/route.ts` | POST | `TPRMRemediationComment` | `message` |
| `api/tprm/monitoring/report-issue/route.ts` | POST | `TPRMVendorIssue` | `title`, `description` |
| `api/tprm/am-follow-ups/clarifications/route.ts` | PATCH | `TPRMClarification` | `rejectComment`, `amResponse` |

---

## Quick Reference — Master Data `[type]` → modelName Mapping

When integrating `api/tprm/master-data/[type]/route.ts`, use this mapping:

```typescript
const typeToModel: Record<string, string> = {
  'domains': 'TPRMDomain',
  'questions': 'TPRMMasterQuestion',
  'questionnaires': 'TPRMQuestionnaireTemplate',
  'service-categories': 'TPRMServiceCategory',
  'disciplines': 'TPRMDiscipline',
  'scorecard-factors': 'TPRMScorecardFactor',
};
```

---

## Common Mistakes to Avoid

1. **Wrong modelName** — Must match exactly: `'TPRMVendor'` not `'tprmvendor'` or `'Vendor'` or `'TPRMVendors'`
2. **Hook after early return** — React hooks must be called before any `if (...) return` statements. Place `useTranslatedData` ABOVE loading checks.
3. **Missing fields** — Include ALL translatable fields for the model. Don't just translate `name` when the model also has `description`.
4. **Awaiting triggerTranslation** — It's fire-and-forget, don't await it on the frontend
5. **Awaiting translateRecord in API** — Use `void translateRecord(...)` — don't await it, let it run in background
6. **Forgetting deleteRecordTranslations** — When a record is deleted, clean up its translations too
7. **Wrong customerAccountId source** — In API routes use `getCustomerAccountId(session)`, NOT `session.user.customerAccountId`
8. **Modifying shared files** — DO NOT modify `useTranslatedData.ts`, `translation-service.ts`, or `translation-config.ts` (except to add new model entries)
9. **Adding locale early-returns** — DO NOT add `if (locale === 'en') return` in hooks — users can enter data in Arabic that needs English translation
10. **Translating in GET handlers** — Only translate in POST/PATCH/PUT. GET handlers just fetch data; `useTranslatedData` handles display translation.

---

## Verification Steps

1. Start dev server: `npm run dev`
2. Login as `bowner` / `1` (Business Owner) or `remm` / `1` (Relationship Manager)
3. Navigate to each TPRM page in English — should work exactly as before
4. Switch language to Arabic — UI labels should be Arabic, TPRM data stays in English (until translations are generated)
5. Switch back to English — everything normal
6. Check browser console — 0 errors (translation warnings are OK)
7. Create/edit a vendor — check server console for `[TRANSLATION]` logs

---

## Quick Copy-Paste Templates

### For a TPRM list page component:
```typescript
import { useTranslatedData } from "@/hooks/useTranslatedData";

// Inside component, BEFORE early returns:
const { data: translatedVendors } = useTranslatedData(vendors, { modelName: 'TPRMVendor' });

// Use translatedVendors for rendering instead of vendors
```

### For a TPRM detail page component:
```typescript
import { useTranslatedRecord } from "@/hooks/useTranslatedData";

// Inside component, BEFORE early returns:
const { data: translatedAssessment } = useTranslatedRecord(assessment, { modelName: 'TPRMAssessment' });

// Use translatedAssessment for rendering instead of assessment
```

### For a TPRM create/edit form component:
```typescript
import { triggerTranslation } from "@/hooks/useTranslatedData";

// After successful API response:
if (response.ok) {
  const data = await response.json().catch(() => null);
  const id = isEdit ? editId : data?.id;
  if (id) {
    triggerTranslation('TPRMVendor', id, {
      name: formData.name,
      serviceCategory: formData.serviceCategory || null,
    });
  }
}
```

### For a TPRM API route (POST):
```typescript
import { translateRecord } from '@/lib/translation-service';

// After prisma.create():
const customerAccountId = getCustomerAccountId(session);
void translateRecord(customerAccountId, 'TPRMVendor', vendor.id, {
  name: vendor.name,
  serviceCategory: vendor.serviceCategory,
});
```

### For a TPRM API route (PATCH):
```typescript
import { translateRecord } from '@/lib/translation-service';

// After prisma.update():
const customerAccountId = getCustomerAccountId(session);
void translateRecord(customerAccountId, 'TPRMVendor', updated.id, {
  name: updated.name,
  serviceCategory: updated.serviceCategory,
});
```

### For a TPRM API route (DELETE):
```typescript
import { deleteRecordTranslations } from '@/lib/translation-service';

// After prisma.delete():
const customerAccountId = getCustomerAccountId(session);
void deleteRecordTranslations(customerAccountId, 'TPRMVendor', vendorId);
```

### For a multi-model TPRM page (e.g., BO Issues with remediation + vendor issues):
```typescript
import { useTranslatedData } from "@/hooks/useTranslatedData";

// Translate each data list separately:
const { data: translatedRemediations } = useTranslatedData(remediations, { modelName: 'TPRMIssueRemediation' });
const { data: translatedVendorIssues } = useTranslatedData(vendorIssues, { modelName: 'TPRMVendorIssue' });

// Use translatedRemediations in Remediation tab
// Use translatedVendorIssues in Vendor Issues tab
```

### For remediation comment creation (API):
```typescript
import { translateRecord } from '@/lib/translation-service';

// After creating comment:
const comment = await prisma.tPRMRemediationComment.create({ data: { ... } });
void translateRecord(customerAccountId, 'TPRMRemediationComment', comment.id, {
  message: comment.message,
});
```
