# Python Translation Service

## Table of Contents

1. [Overview](#overview)
2. [Why a Separate Service?](#why-a-separate-service)
3. [Technology Stack](#technology-stack)
4. [Source Language Detection](#source-language-detection)
5. [Translation Flow](#translation-flow)
6. [Server-Side Integration (Next.js)](#server-side-integration-nextjs)
7. [Client-Side Integration](#client-side-integration)
8. [Authentication and Security](#authentication-and-security)
9. [Database Storage of Translations](#database-storage-of-translations)
10. [Stale Detection and Re-Translation](#stale-detection-and-re-translation)
11. [Error Handling and Degraded Mode](#error-handling-and-degraded-mode)
12. [Configuration Reference](#configuration-reference)
13. [Adding New Translatable Models](#adding-new-translatable-models)
14. [Translation Architecture Decisions](#translation-architecture-decisions)
15. [Troubleshooting](#troubleshooting)

---

## Overview

The Python Translation Service is a separate backend service responsible for translating user-entered content into all supported languages. The GRC application supports three languages: English, Arabic (RTL), and Latvian. When a user creates or edits a record, the content they enter must be available in all three languages so other users working in a different language see the content translated.

The translation service is not the same as the static `t()` translation function used for UI labels. The `t()` function handles static strings hard-coded in the application (button labels, column headers, page titles). The Python Translation Service handles **dynamic data**: the names, descriptions, and notes entered by users that differ from record to record.

---

## Why a Separate Service?

The translation service runs as a separate Python/FastAPI service rather than being embedded in the Next.js application for several reasons:

### AI/ML Processing Requirements

Translating natural-language text accurately requires calling a large language model (GPT). This type of AI inference:

- Is computationally expensive and has high latency compared to database reads
- Benefits from GPU access for fast inference
- Requires Python ecosystem libraries (OpenAI SDK, langdetect, etc.) that have no natural equivalent in Node.js

### GPU Access via RunPod

The Python service is deployed on RunPod, a cloud platform that provides on-demand GPU compute instances. This allows the translation service to:

- Run on GPU-accelerated infrastructure for faster inference
- Scale down to zero when not in use (no idle cost)
- Scale up instantly when translation requests arrive

RunPod's serverless execution model is ideal for this workload: translation requests arrive in bursts when users are actively creating/editing records, then go quiet.

### Separation of Concerns

Keeping the translation service separate from the Next.js application provides:

- **Independent deployment** — the Python service can be updated, restarted, or scaled without touching the Next.js app
- **Independent failure domains** — if the Python service is unavailable, the Next.js app continues operating in degraded mode (showing original language text)
- **Technology independence** — the Python service can be replaced with a different implementation (different LLM, different language, different framework) without changing the Next.js app, as long as the REST API contract is preserved

---

## Technology Stack

| Component | Technology | Notes |
|---|---|---|
| Framework | FastAPI (Python) | Async HTTP server; auto-generates OpenAPI docs |
| LLM | GPT-4o (via OpenAI API) | Used for translation; configurable to other models |
| Deployment | RunPod Serverless | GPU-enabled; scales to zero |
| Language Detection | Unicode range analysis (custom) | No third-party library dependency |
| Authentication | Bearer token (shared secret) | PYTHON_API_SECRET environment variable |

---

## Source Language Detection

Before translating, the service must determine what language the input text is in. The detection is performed using Unicode character range analysis — examining which Unicode code points appear in the text.

### Detection Algorithm

The detection function inspects the input string character by character and classifies it based on Unicode ranges:

**Arabic Detection (U+0600 – U+06FF):**

Characters in the range U+0600 to U+06FF belong to the Arabic script block. This block includes:
- Arabic letters (ا ب ت ث ج ح خ د...)
- Arabic punctuation marks
- Arabic-Indic numerals
- Diacritical marks used in Arabic

If a significant proportion (configurable threshold, default: >15%) of the text characters fall within this range, the text is classified as Arabic.

```python
def is_arabic(text: str) -> bool:
    arabic_chars = sum(1 for c in text if '؀' <= c <= 'ۿ')
    total_alpha = sum(1 for c in text if c.isalpha())
    if total_alpha == 0:
        return False
    return (arabic_chars / total_alpha) > 0.15
```

**Latvian Detection (Diacritical Characters):**

Latvian uses a Latin-script alphabet with diacritics that are unique to Latvian (they do not commonly appear in English or most other Latin-script languages):

| Character | Unicode | Name |
|---|---|---|
| ā | U+0101 | Latin small letter a with macron |
| č | U+010D | Latin small letter c with caron |
| ē | U+0113 | Latin small letter e with macron |
| ģ | U+0123 | Latin small letter g with cedilla |
| ī | U+012B | Latin small letter i with macron |
| ķ | U+0137 | Latin small letter k with cedilla |
| ļ | U+013C | Latin small letter l with cedilla |
| ņ | U+0146 | Latin small letter n with cedilla |
| š | U+0161 | Latin small letter s with caron |
| ū | U+016B | Latin small letter u with macron |
| ž | U+017E | Latin small letter z with caron |

If any of these characters appear in the text, the text is classified as Latvian.

**English (Default):**

If neither Arabic nor Latvian patterns are detected, the text is assumed to be English. This is the default because:
- The application was originally designed for English input
- English characters occupy the standard ASCII range (U+0041–U+007A)
- Most technical terms, abbreviations, and proper nouns used in GRC contexts are English

### Detection Limitations

The Unicode range detection approach is fast and has no external dependencies but has limitations:

- Mixed-language text (e.g., an Arabic description with English technical terms) may be misclassified
- Short text with insufficient character samples may be detected incorrectly
- Language variants (e.g., Maltese, which shares some Latvian diacritics) could be misidentified

For the specific use case of this application (GRC data in English, Arabic, or Latvian), the detection accuracy is sufficient. Future improvements could integrate a proper language detection library.

---

## Translation Flow

### Complete End-to-End Flow

```
User saves a record (create or edit)
        │
        ▼
Next.js API Route Handler
  (POST /api/risks or PATCH /api/risks/[id])
        │
        ▼
Database write (Prisma)
  → Risk record saved to DB
        │
        ▼
translateRecord() called (non-blocking, fire-and-forget)
  → void translateRecord(customerAccountId, 'Risk', risk.id, {
        name: risk.name,
        description: risk.description
      })
        │
        ▼
translation-service.ts
  → Detect source language from text content
  → Determine target languages (all languages EXCEPT source)
  → For each translatable field:
      → HTTP POST to Python API /api/translate
        Body: { text, source_language, target_language }
        Header: Authorization: Bearer PYTHON_API_SECRET
        │
        ▼
Python FastAPI Service
  → Authenticate request (verify Bearer token)
  → Build GPT prompt for translation
  → Call OpenAI API (GPT-4o)
  → Return translated text
        │
        ▼
translation-service.ts receives response
  → Compute MD5 hash of source text
  → Upsert DynamicTranslation record in DB:
      {
        customerAccountId,
        modelName: 'Risk',
        recordId: risk.id,
        fieldName: 'name',
        locale: 'ar',
        translatedValue: 'الاسم المترجم',
        sourceHash: md5(originalText)
      }
        │
        ▼
Next time user views the page in Arabic:
  useTranslatedData() hook
  → Fetches existing DynamicTranslation records from DB
  → Replaces original field values with translated values
  → Arabic user sees: 'الاسم المترجم' instead of original
```

### Key Design Decisions in the Flow

**Non-blocking translation:**
Translation is called with `void` (fire-and-forget). The API response to the user is sent immediately after the database write. Translation happens asynchronously and does not delay the user's save operation.

**Translation only on create/edit:**
Translations are triggered only when a record is created or edited. They are NOT triggered when a page loads or when a record is viewed. If you navigate to a list page in Arabic and some records have no Arabic translation, you will see the original text for those records.

**All languages translated on create:**
When a record is created, all non-source languages are translated at once. If the user is working in English, Arabic and Latvian translations are both created. This means translations are available immediately for all language users, not just after each language user first views the record.

---

## Server-Side Integration (Next.js)

### translation-service.ts

Located at `src/lib/translation-service.ts`, this file contains the server-side translation logic.

**Key function: `translateRecord()`**

```typescript
async function translateRecord(
  customerAccountId: string,
  modelName: string,
  recordId: string,
  fields: Record<string, string | null | undefined>
): Promise<void>
```

This function:
1. Reads the `PYTHON_API_URL` and `PYTHON_API_SECRET` environment variables
2. Determines the source language from the field values
3. Builds an array of translation tasks (field + target language pairs)
4. Calls the Python API for each translation
5. Upserts the results into the `DynamicTranslation` table

**Important:** `translateRecord()` is async but callers use `void` to fire-and-forget:
```typescript
// In API route handler — correct pattern
if (customerAccountId) {
  void translateRecord(customerAccountId, 'Risk', risk.id, {
    name: risk.name,
    description: risk.description
  });
}
```

Do NOT `await` translateRecord in the API handler. This would make the API response wait for translation to complete, which can take several seconds.

### translation-config.ts

Located at `src/lib/translation-config.ts`, this file is the registry of all models and fields that participate in dynamic translation.

```typescript
export const TRANSLATION_CONFIG: TranslationConfig = {
  Risk: {
    fields: ['name', 'description', 'mitigationPlan']
  },
  Control: {
    fields: ['name', 'description', 'implementationGuidance']
  },
  // ... additional models
}
```

When adding a new module with translatable fields, add the model and field names to this config.

---

## Client-Side Integration

### useTranslatedData Hook

Located at `src/hooks/useTranslatedData.ts`, this React hook fetches translations for a list of records and returns a translated copy.

```typescript
function useTranslatedData<T extends { id: string }>(
  records: T[],
  options: { modelName: string }
): { data: T[] }
```

**Usage:**
```typescript
const { data: translatedRisks } = useTranslatedData(risks, { modelName: 'Risk' });
// Use translatedRisks for rendering — fields are replaced with translations for the current locale
```

The hook:
1. Reads the current locale from `localStorage` (set by the LanguageContext)
2. Calls `GET /api/translations/bulk` with the record IDs and model name
3. Replaces field values in the records array with translated values
4. Returns the translated array

**Important:** The hook fetches from the DB, it does NOT call the Python API. Translations must already exist in the DB for the hook to serve them.

### triggerTranslation

```typescript
function triggerTranslation(
  modelName: string,
  recordId: string,
  fields: Record<string, string>
): void
```

Call this from client-side code after a successful create or edit operation:

```typescript
// After successful API response
triggerTranslation('Risk', savedRisk.id, {
  name: savedRisk.name,
  description: savedRisk.description
});
```

`triggerTranslation` reads the current locale from `localStorage` and calls `POST /api/translations/trigger`, which in turn calls `translateRecord()` server-side.

### Do Not Add Locale Early-Returns

A common mistake is adding an early-return in translation logic for the English locale:

```typescript
// WRONG — do not do this
if (locale === 'en') return records; // Skip translation for English users
```

This is wrong because:
- Records may have been created in Arabic or Latvian, and English users need translated English text
- The system supports multi-directional translation (any language → all other languages)
- Returning original records for English bypasses the translated content for non-English-origin records

---

## Authentication and Security

### Bearer Token Authentication

All requests from the Next.js app to the Python API are authenticated using a shared secret passed as a Bearer token in the HTTP Authorization header:

```
Authorization: Bearer <PYTHON_API_SECRET>
```

The Python API verifies this token on every request. Requests without a valid token return HTTP 401 Unauthorized.

**Environment Variables:**

| Variable | Description | Where Set |
|---|---|---|
| `PYTHON_API_URL` | Base URL of the Python service | Next.js server environment |
| `PYTHON_API_SECRET` | Shared secret for authentication | Next.js server environment + Python service |

**Never expose these values to the client.** They must only be accessed in server-side code (API route handlers, not React components or client-side hooks).

### Network Security

The Python service should only be accessible from the Next.js server. In a production RunPod deployment:

- Use RunPod's network policies to restrict the endpoint to known IP ranges
- Or use a private endpoint (accessible only via RunPod's internal network)
- The Bearer token provides a second layer of defense if the network policy is misconfigured

---

## Database Storage of Translations

### DynamicTranslation Model

Translations are stored in the `DynamicTranslation` table in the application's main database (Neon PostgreSQL in production):

```prisma
model DynamicTranslation {
  id                String   @id @default(cuid())
  customerAccountId String
  modelName         String   // e.g., "Risk", "Control"
  recordId          String   // ID of the translated record
  fieldName         String   // e.g., "name", "description"
  locale            String   // e.g., "ar", "lv"
  translatedValue   String
  sourceHash        String   // MD5 hash of the original text at translation time
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([customerAccountId, modelName, recordId, fieldName, locale])
  @@index([customerAccountId, modelName, recordId])
}
```

The unique constraint `[customerAccountId, modelName, recordId, fieldName, locale]` ensures one translation per record/field/language combination and enables efficient upserts.

### Bulk Fetch Endpoint

The client-side hook calls `GET /api/translations/bulk` with a list of record IDs:

```
GET /api/translations/bulk?model=Risk&ids=id1,id2,id3&locale=ar
```

This endpoint returns an object mapping record IDs to their translated field values. The hook then merges this with the original data.

---

## Stale Detection and Re-Translation

### The Problem

A user creates a risk with the name "Data Breach Risk." The system translates it to Arabic. Later, the user edits the risk and renames it "Customer Data Breach Risk." The Arabic translation is now stale — it still says the old name.

### MD5 Hash Comparison

The solution is storing an MD5 hash of the original source text at the time of translation. When a translation request comes in:

1. Compute the MD5 hash of the current source text
2. Look up the existing translation in `DynamicTranslation`
3. Compare the stored `sourceHash` with the current hash
4. If they match → source text unchanged → existing translation is current → skip re-translation
5. If they differ → source text changed → existing translation is stale → re-translate and update

This approach avoids unnecessary API calls to the Python service when records are frequently saved without changing text fields.

```typescript
const currentHash = md5(sourceText);
const existing = await prisma.dynamicTranslation.findUnique({
  where: { customerAccountId_modelName_recordId_fieldName_locale: { ... } }
});

if (existing?.sourceHash === currentHash) {
  return; // Translation is current, skip
}

// Proceed with translation...
```

---

## Error Handling and Degraded Mode

### What Happens When the Python API Is Down?

The translation service is non-critical to the core GRC workflow. If the Python API is unavailable:

1. The HTTP request to the Python API times out or returns an error
2. `translateRecord()` catches the error and logs a warning (using `safeLog`)
3. No translation is stored in the DB
4. The application continues operating normally
5. Users see the original language text for that record

This "degraded mode" means:

- English users creating records see their English content
- Arabic users viewing the record see English (untranslated) content until the Python API is restored and the record is edited again

### Error Logging

Translation errors are logged using `safeLog` (which never logs the actual text content to prevent sensitive data exposure in logs):

```typescript
safeLog('warn', 'Translation failed for record', {
  modelName,
  recordId,
  error: error.message  // Error message only, not the text being translated
});
```

### Retry Behavior

The current implementation does not automatically retry failed translations. If a translation fails:

- The next time the record is edited, translation is triggered again
- The MD5 hash comparison ensures re-translation will occur (since no translation was stored)

A background retry job could be implemented for critical use cases, but this is not currently in scope.

### Timeout Configuration

The HTTP request to the Python API has a configured timeout (default: 30 seconds). The GPT API call within the Python service can take 5–15 seconds per field. For records with multiple fields being translated to multiple languages, the total time can approach the timeout limit.

If timeout errors are frequent:

- Increase the timeout value in `translation-service.ts`
- Reduce the number of fields being translated per record
- Consider batching multiple fields into a single GPT request on the Python side

---

## Configuration Reference

### Environment Variables

| Variable | Required | Description | Example |
|---|---|---|---|
| `PYTHON_API_URL` | Yes | Base URL of Python service | `https://api.runpod.ai/v2/abc123/runsync` |
| `PYTHON_API_SECRET` | Yes | Bearer token for API auth | Random 32+ char string |

### translation-config.ts

Edit `src/lib/translation-config.ts` to control which models and fields are translated. Only fields that users read in the UI need translation. Internal IDs, status codes, and enum values should NOT be translated.

---

## Adding New Translatable Models

When you create a new module with user-facing text fields:

1. **Add to translation-config.ts:**
```typescript
export const TRANSLATION_CONFIG = {
  // ... existing models
  MyNewModel: {
    fields: ['name', 'description']
  }
}
```

2. **Call translateRecord in the POST/PATCH API handler:**
```typescript
if (customerAccountId) {
  void translateRecord(customerAccountId, 'MyNewModel', record.id, {
    name: record.name,
    description: record.description
  });
}
```

3. **Add useTranslatedData to the list page:**
```typescript
const { data: translatedRecords } = useTranslatedData(records, { modelName: 'MyNewModel' });
```

4. **Call triggerTranslation in the client-side form:**
```typescript
// After successful save
triggerTranslation('MyNewModel', savedRecord.id, {
  name: savedRecord.name,
  description: savedRecord.description
});
```

---

## Translation Architecture Decisions

### Why Not Use a Translation API Directly from Next.js?

Options like Google Translate API or DeepL could be called directly from the Next.js server without a Python intermediary. The Python service was chosen because:

- The team has more control over the prompting and translation quality with GPT
- GPT can handle GRC-specific terminology and context better than pure statistical machine translation
- The Python service provides a single integration point that can be updated independently
- Future AI features (risk summarization, control recommendations) can be added to the same Python service

### Why Fire-and-Forget (Not Synchronous)?

Making the API response wait for translation to complete would add 3–15 seconds to every save operation. Users expect saves to be near-instant. The fire-and-forget pattern keeps save latency fast while translation happens in the background.

The tradeoff: if a user creates a record in Arabic and immediately switches to English, the English translation may not be ready yet. In practice, users rarely switch languages immediately after creating a record, and the translation completes within seconds.

---

## Troubleshooting

### Translations Not Appearing

**Symptom:** Records created in one language do not show translated text for other language users.

**Checks:**
1. Verify `PYTHON_API_URL` and `PYTHON_API_SECRET` are set in the environment
2. Check server logs for translation errors during create/edit operations
3. Verify the model is registered in `translation-config.ts`
4. Verify `translateRecord()` is called in the relevant API route handlers
5. Verify `useTranslatedData()` is used on the list page (not the raw records)
6. Check the `DynamicTranslation` table for records — if empty, the Python API may not be responding

### Python API Not Reachable

**Symptom:** Server logs show connection timeout or connection refused errors for `PYTHON_API_URL`.

**Checks:**
1. Verify the RunPod endpoint is running (check RunPod dashboard)
2. Verify `PYTHON_API_URL` is correct
3. Test the endpoint directly: `curl -H "Authorization: Bearer $PYTHON_API_SECRET" $PYTHON_API_URL/health`
4. Check if RunPod has cold-started (first request after idle may take 30+ seconds)

### Incorrect Language Detection

**Symptom:** Content entered in Arabic is being translated from English, or vice versa.

**Checks:**
1. Very short text (< 5 characters) may not contain enough Arabic characters for detection threshold
2. Mixed-script text may be misclassified
3. Review the source language detection logic in `translation-service.ts`

---

*Last updated: 2026-06-29*
*Module version: GRC App — GRC-MultiTenant branch*
