// PDF-import extraction → seeds an applicationDrafts row → the writer continues
// in the normal upload wizard (the "editable preview"). Writer-auth gated.

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { universities, applicationDrafts, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  extractApplication,
  matchUniversity,
  ExtractionError,
  type PdfInput,
} from "@/lib/pdf-import/extract-application";

export const runtime = "nodejs"; // unpdf fallback cannot run on edge
export const maxDuration = 60; // PDF + large extraction response is slow

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_PDFS = 2;

type Entry = { name: string; description: string };

function parseList(s?: string | null): Entry[] {
  try {
    const a = JSON.parse(s ?? "[]");
    return Array.isArray(a)
      ? a.map((x) => ({ name: String(x?.name ?? ""), description: String(x?.description ?? "") })).filter((x) => x.name.trim())
      : [];
  } catch {
    return [];
  }
}

// Merge extracted items into the writer's existing list, deduping by
// case-insensitive name. Existing entries win (never clobbered).
function mergeByName(base: Entry[], add: Entry[]): Entry[] {
  const seen = new Set(base.map((x) => x.name.trim().toLowerCase()));
  const out = [...base];
  for (const x of add) {
    const k = x.name.trim().toLowerCase();
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(x);
    }
  }
  return out;
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "writer") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Expected multipart/form-data." }, { status: 400 });
  }

  // Admission proof (required) — image or PDF.
  const proof = form.get("proof");
  if (!(proof instanceof File)) {
    return Response.json({ error: "Admission proof is required." }, { status: 400 });
  }
  if (proof.size > MAX_BYTES) {
    return Response.json({ error: "Proof exceeds the 10MB limit." }, { status: 413 });
  }

  // Common App PDFs (1–2).
  const pdfEntries = form.getAll("files").filter((e): e is File => e instanceof File);
  if (pdfEntries.length === 0) {
    return Response.json({ error: "Upload at least one Common App PDF." }, { status: 400 });
  }
  if (pdfEntries.length > MAX_PDFS) {
    return Response.json({ error: `At most ${MAX_PDFS} PDFs.` }, { status: 400 });
  }
  const files: PdfInput[] = [];
  for (const f of pdfEntries) {
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      return Response.json({ error: `${f.name} is not a PDF.` }, { status: 400 });
    }
    if (f.size > MAX_BYTES) {
      return Response.json({ error: `${f.name} exceeds the 10MB limit.` }, { status: 413 });
    }
    files.push({ filename: f.name, buffer: await f.arrayBuffer() });
  }

  // Extract.
  let extracted;
  try {
    extracted = await extractApplication(files);
  } catch (err) {
    if (err instanceof ExtractionError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error("[applications/extract]", err);
    return Response.json({ error: "Extraction failed unexpectedly." }, { status: 500 });
  }

  // Match university + load the writer's current profile lists.
  const [allUnis, writer] = await Promise.all([
    db
      .select({ id: universities.id, name: universities.name, slug: universities.slug, aliases: universities.aliases })
      .from(universities),
    db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { activities: true, honors: true },
    }),
  ]);
  const uniId = matchUniversity(extracted.universityName, allUnis);
  const matchedUni = uniId ? allUnis.find((u) => u.id === uniId) : null;

  // Profile merge — existing entries are preserved; only new ones append.
  const extractedActivities: Entry[] = extracted.activities
    .map((a) => ({
      name: [a.position, a.organization].filter((x) => x.trim()).join(" — ") || a.organization || a.position,
      description: a.description,
    }))
    .filter((a) => a.name.trim());
  const extractedHonors: Entry[] = extracted.honorsAwards.map((h) => ({ name: h, description: "" })).filter((h) => h.name.trim());
  const activities = mergeByName(parseList(writer?.activities), extractedActivities);
  const honors = mergeByName(parseList(writer?.honors), extractedHonors);

  // Admission proof → base64 data URI (same storage shape the manual wizard uses).
  const proofMime = proof.type || "application/octet-stream";
  const admissionProof = `data:${proofMime};base64,${Buffer.from(await proof.arrayBuffer()).toString("base64")}`;

  // Map ExtractionResult → WizardData (matches the wizard's draft `data` shape).
  // caScreenshot is "" and pdfImported is true: the uploaded Common App PDF is
  // already proof, so step 2 doesn't require a screenshot (and the PDF itself is
  // never stored — it would bloat every public detail-page fetch).
  const wizardData = {
    universityId: uniId, // "" if unmatched → wizard step 1 makes the writer pick
    admittedYear: extracted.admittedYear || String(new Date().getFullYear()),
    submittedCommonApp: extracted.submittedCommonApp,
    numSupplementals: extracted.supplementals.length,
    admissionProof,
    caPromptIndex: extracted.caPromptIndex,
    caContent: extracted.caContent,
    caScreenshot: "",
    pdfImported: true,
    supplementals: extracted.supplementals,
    intendedMajor: extracted.intendedMajor,
    activities,
    honors,
    disclaimerChecked: false,
  };

  const [draft] = await db
    .insert(applicationDrafts)
    .values({
      writerId: session.user.id,
      universityId: uniId || null, // uuid FK — null (not "") when unmatched
      universityName: matchedUni?.name ?? (extracted.universityName || null),
      universitySlug: matchedUni?.slug ?? null,
      currentStep: 1,
      data: JSON.stringify(wizardData),
    })
    .returning({ id: applicationDrafts.id });

  return Response.json({ draftId: draft.id }, { status: 201 });
}
