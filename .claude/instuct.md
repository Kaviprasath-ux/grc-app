# Asset Management Module — Migration & Reproduction Instructions

## Purpose

These instructions define the exact process an AI agent must follow to analyze a live web application and reproduce the **Asset Management** module with **complete functional equivalence** in the current developing application.

This is not a redesign, refactor, or optimization task.

UI may be flexible to match the current application, but **all functionality, logic, data, validations, workflows, and permissions must be reproduced exactly.**

If anything is unclear, missing, or ambiguous — the agent must stop and ask before proceeding.

---

## Live Application Access

**URL:**  
https://verifaiuat.baarez.com/

**Login Credentials:**  
- Username: `bts`  
- Password: `1`

After login, navigate to and analyze **only** the Asset Management module.

---

## Objective

Reproduce the Asset Management module such that:

- Every existing screen is present
- Every existing field is present
- Every validation is enforced
- Every workflow behaves identically
- Every error behaves identically
- Every permission behaves identically
- Every status transition behaves identically
- No feature is missing
- No feature is changed

UI layout may adapt to match the current app, but behavior must match exactly.

---

## Step 1 — Discovery

Interact fully with the Asset Management module.

For every page and action, capture:

- Page purpose
- All fields (name, type, required/optional, default, validation rules)
- Dropdowns and lookup sources
- Tables (columns, sorting, filtering, pagination)
- Buttons and actions
- Click behavior
- Success and failure behavior
- Error messages
- Confirmation dialogs
- Status transitions
- Background processing
- Anything that changes data

Do not assume anything.  
Document only what is observed.

---

## Step 2 — Extract Complete Model

### A. Data Model
- Entities
- Attributes
- Types and constraints
- Relationships

### B. Workflows
- Step-by-step logic
- Conditions and branches
- State transitions

### C. Permissions
- Who can see what
- Who can do what

### D. Validations
- Field-level
- Cross-field
- Business rules

---

## Step 3 — Generate Equivalent Module

Generate:

- Data definitions
- Backend logic
- APIs / services
- Frontend pages (list, detail, create, edit, view)
- All validations and constraints
- All workflows and transitions
- All permission checks

Functionality must match exactly.

If something cannot be reproduced exactly, stop and ask.

---

## Step 4 — Verification

Create a verification checklist:

- [ ] All pages reproduced  
- [ ] All fields reproduced  
- [ ] All validations reproduced  
- [ ] All workflows reproduced  
- [ ] All permissions reproduced  
- [ ] All errors reproduced  

Every checkbox must be justified.

---

## Step 5 — Testing

Generate:

- Positive test cases
- Negative test cases
- Edge cases
- User acceptance criteria

---

## Strict Rules

- No guessing
- No omissions
- No creative changes
- No silent assumptions
- No feature removal
- No feature improvement
- No behavior change

If unsure → Stop and ask.

---

## Final Confirmation

At the end, explicitly state:

> "All Asset Management functionality from the UAT system has been fully analyzed and reproduced with no omissions or behavior changes."

If this is not true, list exactly what is missing.

---

End of instructions.
