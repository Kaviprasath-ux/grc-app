# Dynamic Data Translation — Integration Guide for Developers

## Context

This GRC app supports 3 languages: English (default), Arabic (RTL), Latvian (LTR).
Static UI strings (buttons, labels, headings) are already translated using `t()` from `useLanguage()`.

We have now built a **Dynamic Data Translation system** that translates **user-entered data** (risk names, descriptions, setting values, etc.) using our Python AI backend. The backend infrastructure is complete (Phases 1-4). Your job is **Phase 5: integrate it into your assigned pages**.

---

## Architecture Overview

### How It Works
1. **On Create/Edit** — When a user creates or edits a record, we call `triggerTranslation()` which fires a POST to `/api/translations/translate`. The server translates the text to Arabic & Latvian via our Python GPT API and stores translations in the `DynamicTranslation` table.
2. **On Display (non-English)** — When the user switches to Arabic/Latvian, the `useTranslatedData` hook calls `/api/translations/bulk` to fetch stored translations and overlays them on the original data. If no translation exists, the original English text is shown (graceful fallback).
3. **English locale** — No API calls are made. Original data is returned as-is.

### Key Files (DO NOT modify these — they are already complete)
- `src/hooks/useTranslatedData.ts` — Frontend hook (`useTranslatedData`, `useTranslatedRecord`, `triggerTranslation`)
- `src/lib/translation-service.ts` — Backend translation service
- `src/lib/translation-config.ts` — Registry of all translatable models and their fields
- `src/app/api/translations/` — Translation API routes (4 files)

---

## Integration Pattern A: List Pages (Tables)

Use `useTranslatedData` hook to translate data displayed in tables/lists.

### Step-by-Step

**1. Add import:**
```typescript
import { useTranslatedData } from "@/hooks/useTranslatedData";
```

**2. Add hook call BEFORE any early returns (React hooks rule):**
```typescript
// The hook must be called unconditionally — before if/return statements
const { data: translatedItems } = useTranslatedData(items, { modelName: 'YourModelName' });
```

**3. Use `translatedItems` instead of `items` for rendering:**
```typescript
// Pagination, mapping, rendering — use translatedItems
const paginatedItems = translatedItems.slice(start, end);
return paginatedItems.map(item => <Row key={item.id} data={item} />);
```

### Example (from Risk Register — already implemented):
```typescript
import { useTranslatedData } from "@/hooks/useTranslatedData";

function RiskRegisterContent() {
  // ... existing state and data fetching ...

  const displayRisks = isDepartmentRole ? risks.filter(...) : risks;

  // ADD THIS — translates name & description fields when locale is ar/lv
  const { data: translatedRisks } = useTranslatedData(displayRisks, { modelName: 'Risk' });

  // USE translatedRisks instead of displayRisks for pagination/rendering
  const totalPages = Math.ceil(translatedRisks.length / ITEMS_PER_PAGE);
  const paginatedRisks = translatedRisks.slice(...);

  // ... early returns for loading/unauthorized ...

  return (
    // render paginatedRisks
  );
}
```

### IMPORTANT: Hook must be called BEFORE early returns
```typescript
// WRONG — violates React hooks rule
if (loading) return <Spinner />;
const { data } = useTranslatedData(items, { modelName: 'Risk' }); // ERROR!

// CORRECT — hook before early returns
const { data } = useTranslatedData(items, { modelName: 'Risk' });
if (loading) return <Spinner />;
```

---

## Integration Pattern B: Detail Pages (Single Record)

Use `useTranslatedRecord` for pages that display a single record.

```typescript
import { useTranslatedRecord } from "@/hooks/useTranslatedData";

function RiskDetailPage({ risk }) {
  const { data: translatedRisk } = useTranslatedRecord(risk, { modelName: 'Risk' });

  return (
    <div>
      <h1>{translatedRisk.name}</h1>
      <p>{translatedRisk.description}</p>
    </div>
  );
}
```

---

## Integration Pattern C: Create/Edit Forms (Trigger Translation)

When a record is created or edited, call `triggerTranslation()` to generate translations in the background.

### In Frontend Components (client-side forms):
```typescript
import { triggerTranslation } from "@/hooks/useTranslatedData";

// After successful create/edit API call:
if (response.ok) {
  const responseData = await response.json().catch(() => null);
  const recordId = isEditMode ? editData.id : responseData?.id;

  if (recordId) {
    triggerTranslation('YourModelName', recordId, {
      name: formData.name,
      description: formData.description || null,
      // ... include ALL translatable fields for this model
    });
  }

  toast.success("Record saved successfully");
}
```

### In API Routes (server-side — preferred for settings):
```typescript
import { translateRecord } from '@/lib/translation-service';

// In your POST handler, after creating the record:
export const POST = withAuth(async (req, context, session) => {
  // ... create record ...
  const record = await prisma.yourModel.create({ data: { ... } });

  // Fire-and-forget translation (don't await — runs in background)
  void translateRecord(
    session.user.customerAccountId,
    'YourModelName',
    record.id,
    { name: record.name, description: record.description }
  );

  return NextResponse.json(record, { status: 201 });
});

// In your PATCH/PUT handler, after updating the record:
export const PATCH = withAuth(async (req, context, session) => {
  // ... update record ...
  const updated = await prisma.yourModel.update({ ... });

  // Fire-and-forget translation
  void translateRecord(
    session.user.customerAccountId,
    'YourModelName',
    updated.id,
    { name: updated.name, description: updated.description }
  );

  return NextResponse.json(updated);
});
```

### For DELETE handlers:
```typescript
import { deleteRecordTranslations } from '@/lib/translation-service';

// After deleting the record:
void deleteRecordTranslations(
  session.user.customerAccountId,
  'YourModelName',
  recordId
);
```

---

## Model Name Reference

The `modelName` parameter must match exactly what's registered in `src/lib/translation-config.ts`. Here is the complete list with their translatable fields:

### Priority 1 — Core GRC
| modelName | Fields | Pages |
|-----------|--------|-------|
| `Risk` | name, description | Risk Register, Risk detail |
| `Control` | name, description | Controls list, Control detail |
| `Framework` | name, description | Frameworks list |
| `Policy` | title, description | Governance list |

### Priority 2 — Compliance & Governance
| modelName | Fields | Pages |
|-----------|--------|-------|
| `Evidence` | name, description | Evidence list |
| `Exception` | title, description, justification | Exception Management |
| `KPI` | name, description | KPI list |
| `Requirement` | name, description | Framework requirements |
| `RequirementCategory` | name, description | Framework categories |
| `GovernanceVaultDocument` | title, description | Governance vault |
| `Regulation` | name, description | Regulations |

### Priority 3 — Risk Management Details
| modelName | Fields | Pages |
|-----------|--------|-------|
| `RiskAssessment` | notes | Risk Assessment page |
| `RiskResponse` | description | Risk Response page |
| `RiskControlMatrixEntry` | notes | Risk Control Matrix |
| `RiskCategory` | name, description | Risk Settings |
| `RiskType` | name, description | Risk Settings |
| `RiskThreat` | name, description | Risk Settings |
| `RiskVulnerability` | name, description | Risk Settings |
| `RiskCause` | name | Risk Settings |

### Priority 4 — Internal Audit
| modelName | Fields | Pages |
|-----------|--------|-------|
| `AuditEngagement` | title, objective, scope | Audit Planning |
| `AuditableEntity` | name, description | Audit Universe |
| `InternalAuditFinding` | title, description, recommendation | Audit Findings |
| `InternalAuditCAPA` | title, description | CAPA tracking |
| `AuditReport` | title, executiveSummary | Audit Reports |
| `AuditFinding` | title, description, recommendation | Findings |
| `CAPA` | title, description | CAPA |
| `InternalAuditRisk` | name, description | Audit Risk Register |

### Priority 5 — Organization & Assets
| modelName | Fields | Pages |
|-----------|--------|-------|
| `Organization` | name, description | Organization Profile |
| `Department` | name, description | Organization Profile |
| `Process` | name, description | Process page |
| `Asset` | name, description | Asset Inventory |
| `Service` | name, description | Services |
| `Stakeholder` | name | Context/Stakeholders |
| `Issue` | title, description | Context/Issues |

### Priority 6 — Settings / Master Data
| modelName | Fields | Pages |
|-----------|--------|-------|
| `ControlDomain` | name, description | Compliance Settings |
| `AssetCategory` | name, description | Asset Settings |
| `AssetSubCategory` | name | Asset Settings |
| `AssetGroup` | name | Asset Settings |
| `RiskLikelihood` | title, timeFrame, probability | Risk Settings |
| `ImpactCategory` | name | Risk Settings |
| `ImpactRating` | name, description | Risk Settings |
| `RiskRange` | title, description | Risk Settings |
| `VulnerabilityCategory` | name | Risk Settings |
| `ThreatCategory` | name | Risk Settings |
| `VulnerabilityRating` | label | Risk Settings |
| `ControlStrength` | name | Risk Settings |
| `RiskSubCategory` | type | Risk Settings |
| `RiskSetting` | label, description | Risk Settings |

---

## Page Assignment Checklist

For each page assigned to you, do these steps:

### Frontend (List/Detail page):
- [ ] Add `import { useTranslatedData } from "@/hooks/useTranslatedData"` (or `useTranslatedRecord` for detail pages)
- [ ] Add the hook call BEFORE any early returns
- [ ] Replace the original data variable with the translated version for rendering
- [ ] Test: Page loads in English (no errors, no API calls)
- [ ] Test: Switch to Arabic — UI labels are Arabic, data shows original (until translations exist)

### Backend (API route for that model):
- [ ] Add `import { translateRecord, deleteRecordTranslations } from '@/lib/translation-service'`
- [ ] Add `void translateRecord(...)` in POST handler after record creation
- [ ] Add `void translateRecord(...)` in PATCH/PUT handler after record update
- [ ] Add `void deleteRecordTranslations(...)` in DELETE handler after record deletion
- [ ] Verify the `modelName` matches exactly what's in translation-config.ts

### If the page has inline create/edit (via dialog/modal in the same component):
- [ ] Add `import { triggerTranslation } from "@/hooks/useTranslatedData"`
- [ ] Call `triggerTranslation('ModelName', recordId, { field1: value1, ... })` after successful save

---

## Common Mistakes to Avoid

1. **Wrong modelName** — Must match exactly: `'Risk'` not `'risk'` or `'Risks'`
2. **Hook after early return** — React hooks must be called before any `if (...) return` statements
3. **Missing fields** — Include ALL translatable fields for the model, not just name
4. **Awaiting triggerTranslation** — It's fire-and-forget, don't await it on the frontend
5. **Awaiting translateRecord in API** — Use `void translateRecord(...)` — don't await it, let it run in background
6. **Forgetting deleteRecordTranslations** — When a record is deleted, clean up its translations too

---

## How to Verify

1. Start dev server: `npm run dev`
2. Login as `bts.admin` (password: `1`) — has CustomerAdministrator role with access to most pages
3. Navigate to your page in English — should work exactly as before (no regression)
4. Switch language to Arabic (click EN button → Arabic) — UI labels should be in Arabic, dynamic data stays in English (no translations stored yet)
5. Switch back to English — everything should return to normal
6. Check browser console — should have 0 errors (warnings about missing static translations are OK)
7. Check server console — if Python API is configured, you'll see `[TRANSLATION]` logs when creating/editing records

---

## Quick Copy-Paste Templates

### For a list page component:
```typescript
import { useTranslatedData } from "@/hooks/useTranslatedData";

// Inside component, BEFORE early returns:
const { data: translatedItems } = useTranslatedData(originalItems, { modelName: 'MODEL_NAME' });

// Use translatedItems for rendering instead of originalItems
```

### For a create/edit form component:
```typescript
import { triggerTranslation } from "@/hooks/useTranslatedData";

// After successful API response:
if (response.ok) {
  const data = await response.json().catch(() => null);
  const id = isEdit ? editId : data?.id;
  if (id) {
    triggerTranslation('MODEL_NAME', id, {
      fieldName1: formData.fieldName1,
      fieldName2: formData.fieldName2 || null,
    });
  }
}
```

### For an API route (POST):
```typescript
import { translateRecord } from '@/lib/translation-service';

// After prisma.create():
void translateRecord(session.user.customerAccountId, 'MODEL_NAME', record.id, {
  fieldName1: record.fieldName1,
  fieldName2: record.fieldName2,
});
```

### For an API route (DELETE):
```typescript
import { deleteRecordTranslations } from '@/lib/translation-service';

// After prisma.delete():
void deleteRecordTranslations(session.user.customerAccountId, 'MODEL_NAME', recordId);
```
