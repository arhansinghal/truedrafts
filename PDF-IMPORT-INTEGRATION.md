# Integrate PDF-Import Submission Flow into the Main App

## Context

The sandbox at `/labs/pdf-import` proved the concept: upload Common App PDFs → Claude (native PDF document blocks) extracts essays, prompts, university, year, activities, honors, major → editable preview → submit. This plan integrates it as **Option 2 of the real submission portal**:

- `/writer/essays/new` becomes a chooser: **Option 1** — manual entry (existing wizard, unchanged flow); **Option 2** — proof of admission + PDF upload → editable preview *(Recommended)*. Consistent Manuscript UI for both.
- Activities slim down to **position / organization / description** (no grades, hrs/wk, wks/yr). **No test scores.**
- **Activities + honors are writer-level**: stored on the writer and displayed on the writer profile — the existing Activities card (`app/(writer)/writer/profile/page.tsx`) gets fed by this data; a **new matching Honors card** is added.
- **Intended major is application-level**: stored in the existing `collegeApplications.major` column and displayed **everywhere the application is listed**.
- After integration, **delete the sandbox** (`app/labs/`, `app/api/labs/`).

## Architecture: extraction feeds the existing wizard via a draft

Option 2 does NOT get a separate preview UI. The flow is:

```
chooser → import screen (proof + 1–2 PDFs) → POST /api/writer/applications/extract
        → server: extract → map to WizardData → INSERT applicationDrafts row
        → redirect /writer/essays/new?draft=<id>
        → existing ApplicationUploadWizard opens fully prefilled  ← the "editable preview"
        → normal review/edit/submit through the existing POST /api/writer/applications
```

This reuses the wizard, drafts system, validation, and submit route wholesale — UI consistency between options is automatic because both end in the same wizard. (Verified: `ApplicationUploadWizard` props `{universities, draftId, initialData, initialStep}` fully prefill all steps from a draft's `data` JSON; `?draft=<id>` loading already exists in `app/(writer)/writer/essays/new/page.tsx`.)

## Schema changes (apply with `npm run db:push` — drizzle-kit push is the repo convention)

1. `users`: add `honors: text("honors").default("[]")` — JSON `[{name, description}]`, mirroring the existing `users.activities` column/shape.
2. `collegeApplications`: **no new columns** — `major` already exists (currently AI-inferred on approval).

## File changes

### 1. Extraction lib: `lib/labs/pdf-import/` → `lib/pdf-import/` (move + trim)

- `schema.ts`: `ExtractedActivity` slims to `{position, organization, description}`; drop `testScores` and `SandboxSubmission`; keep `ExtractionResult` (now with `honorsAwards`, `intendedMajor`, slimmed activities).
- Move `COMMON_APP_PROMPTS` + `COMMON_APP_WORD_LIMIT` to a new shared `lib/common-app.ts`; import it from **both** the wizard (`ApplicationUploadWizard.tsx:12-24`, deleting its local copy) and the extraction lib — kills the intentional sandbox duplication.
- `extract-application.ts`: update the AI prompt schema (remove gradeLevels/hoursPerWeek/weeksPerYear/testScores); keep native-PDF primary + unpdf fallback, model/env lever, 8192 maxTokens, normalization.
- Add `matchUniversity(name, universities)` here (move from sandbox client) — server-side now.

### 2. New endpoint: `POST /api/writer/applications/extract`

Auth-gated like the real submit route (`auth.api.getSession`, role `writer` — copy the guard from `app/api/writer/applications/route.ts:24-27`). `runtime = "nodejs"`, `maxDuration = 60`. Multipart:
- `proof`: 1 file (image or PDF, ≤10MB) — required
- `files`: 1–2 PDFs (≤10MB each)

Server: extract → map `ExtractionResult` → `WizardData`:
- `universityId` = `matchUniversity()` against `db.query.universities` (name + aliases), `""` if no match (wizard step 1 makes the writer pick)
- `admissionProof` = base64 data URI of the proof upload (existing wizard storage pattern)
- `caScreenshot` = `""` — deliberately NOT the uploaded PDF. The detail page fetches the full row on every public view (only the embedding is excluded), so a multi-MB base64 PDF in `commonAppScreenshotUrl` would bloat every detail-page fetch (they already had to slim the list query for this reason). The prefilled wizard's step 2 requires the writer to attach a screenshot, same as the manual flow.
- `caPromptIndex`, `caContent`, `submittedCommonApp`, `supplementals`, `numSupplementals` map directly
- New WizardData fields (see §3): `intendedMajor`; `activities`/`honors` = **merge of the writer's current profile lists + extracted items** (dedupe by case-insensitive name; extracted activity → `{name: "position — organization", description}`). Never seed from extraction alone — a second import must not present a list that, on submit-overwrite, clobbers a previously curated profile.

INSERT into `applicationDrafts` (`writerId`, `universityId` **(null — not `""` — when unmatched; it's a uuid FK column)**, `universityName`, `universitySlug`, `currentStep: 1`, `data: JSON.stringify(wizardData)`) and return `{draftId}`. Client redirects to `/writer/essays/new?draft=<id>`.

### 3. Wizard: `components/writer/ApplicationUploadWizard.tsx`

- Extend `WizardData` with `intendedMajor: string`, `activities: {name, description}[]`, `honors: {name, description}[]` (defaults: `""`/`[]` — verified safe: state init is `useState({ ...DEFAULT_DATA, ...initialData })` at line 275, so old drafts get the defaults).
- New **Step 4 "Profile & Major"** (optional, between Supplementals and Review; `STEP_LABELS` becomes 5 entries):
  - Intended major: text input (application-level).
  - Activities + Honors editors styled like the profile page's numbered Activities card (name input + ≤100-word description textarea, add/remove). **Manual** flow initializes from the writer's current profile (`users.activities`/`honors`, passed from the page); **PDF** flow from the profile+extraction merge baked into the draft (§2).
  - Step is skippable (no required validation) — manual users can blow past it.
- Review step shows major + counts of activities/honors.
- Submit payload adds `major`, `activities`, `honors`.

### 4. Submit route: `app/api/writer/applications/route.ts` (POST)

- Accept `major` → store in `collegeApplications.major`.
- Accept `activities`/`honors` → update `users.activities`/`users.honors` (overwrite with the edited list — it's the writer's canonical profile data; route already updates `users` for `writersAgreedBundlesAt`, same transaction spot). Skip the user update when both arrays are empty.

### 5. Approve pipeline: `app/api/admin/applications/[id]/approve/route.ts`

Change `if (meta.major) updates.major = meta.major;` → only when `!app.major`, so the AI never overwrites a writer-provided major. (Same one-line guard in `app/api/admin/retag/route.ts`.)

### 6. Chooser + import screen: `app/(writer)/writer/essays/new/`

- `page.tsx`: when **no** `draft`/`mode` param → render a chooser (two Manuscript-styled cards using `PageHead`/tokens `var(--td-blue)`, `var(--line)`, `.eyebrow`):
  - **Manual entry** — "Type in your essays step by step" → `?mode=manual`
  - **Import from PDFs (Recommended)** — "Upload your admission proof + Common App PDFs; we fill everything in for review" → `?mode=import`
  - `?mode=manual` → wizard as today; `?draft=<id>` → wizard prefilled as today (also pass the writer's current profile activities/honors for step-4 defaults).
- New `components/writer/PdfImportPanel.tsx` (`?mode=import`): proof upload (reuse the wizard's `ImageUpload` look) + PDF file input + "Extract & review" button with progress state (~30s) + error banner → on success `router.push('/writer/essays/new?draft=<id>')`. Adapted from the sandbox `PdfImportClient.tsx` upload section, restyled with Manuscript tokens.

### 7. Writer profile: `app/(writer)/writer/profile/page.tsx` + `PATCH /api/writer/settings`

- Add an **Honors card** mirroring the existing Activities card (numbered rows, name + description, add/remove, 100-word counter).
- Extend the settings PATCH (and `app/api/writer/onboarding/profile/route.ts` if it whitelists fields) to accept `honors`.
- Public profile `app/(marketing)/writers/[username]/page.tsx`: render read-only Activities + Honors sections (the private card's sub-text already promises "shown on your profile").

### 8. Major displayed everywhere applications are listed

Already shown: `ApplicationCard` (browse + search). Add small-text major to:
- Writer essays list `app/(writer)/writer/essays/page.tsx` (add `major` to its column select + row render)
- Admin queue `components/admin/ApplicationQueue.tsx` (summary row + editable input in the expanded panel, beside tags)
- Application detail page frontispiece (`app/(marketing)/applications/[slug]/page.tsx` → reader/paywall header, near university + year)

### 9. Delete the sandbox

Remove `app/labs/`, `app/api/labs/`, `lib/labs/` (after the move in §1). Remove `sandbox-submissions/` if present.

## Implementation order

1. `lib/common-app.ts` + move/trim extraction lib (§1) — type-check checkpoint
2. Schema: `users.honors` + `npm run db:push`
3. Extract endpoint (§2)
4. Wizard changes (§3) + submit route (§4) + approve/retag guard (§5)
5. Chooser + import panel (§6)
6. Profile cards + settings PATCH + public profile (§7)
7. Major display surfaces (§8)
8. Delete sandbox (§9)
9. Verify (below)

Type-check: `node node_modules/typescript/bin/tsc --noEmit` (the `.bin/tsc` shim is broken).

## Verification

1. Dev server already runs on **localhost:3003**.
2. **Chooser**: `/writer/essays/new` (as a writer) shows both options, Recommended bracket on PDF import; `?mode=manual` lands in the unchanged wizard.
3. **Import flow**: upload proof image + the real Common App PDF → progress → lands in the wizard prefilled; verify university matched, prompt index right, essay verbatim, supplementals attributed, step 4 holds slimmed activities (no grades/hrs/wks) + honors + major **merged with any pre-existing profile entries (no clobbering on a second import)**; step 2 asks for the CA screenshot (intentionally not prefilled); edit something → submit → row in `collegeApplications` with `major`, `users.activities`/`honors` updated; draft deleted.
4. **Manual flow regression**: complete a manual submission end-to-end; step 4 optional (skip it) — payload still valid; old in-flight drafts (without new fields) still open.
5. **Profile**: `/writer/profile` shows the populated Activities card + new Honors card; edits save; public profile renders both.
6. **Major surfaces**: browse card, writer essays list, admin queue (and editable there), application detail frontispiece.
7. **Approve**: approve the test submission → AI tagging does NOT overwrite the writer's major.
8. **Sandbox gone**: `/labs/pdf-import` 404s; `git status` shows deletions; no `lib/labs` imports remain (grep).

## Risks

- **Draft/body size**: only the base64 admission proof travels in the draft `data` JSON — same pattern the manual wizard already uses; the application PDFs are processed in-memory by the extract endpoint and never stored.
- **Profile clobbering**: submit overwrites `users.activities`/`honors` with the reviewed list — safe only because step 4 always seeds from a profile-merged list (§2/§3); keep that invariant.
- **Wizard step renumber**: inserting "Profile & Major" before Review moves Review from step 4 → 5, so an old draft saved at `currentStep: 4` reopens on the new step instead of Review. Harmless (writer clicks Next), but don't claim index stability — just ensure step rendering is driven by one source of truth (`STEP_LABELS` order).
