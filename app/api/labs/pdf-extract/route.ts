// Sandbox PDF-import lab — extraction endpoint. Dev-only, no auth, no DB.
// POST multipart/form-data with 1–2 PDFs under "files".

import {
  extractApplication,
  ExtractionError,
  type PdfInput,
} from "@/lib/labs/pdf-import/extract-application";

export const runtime = "nodejs"; // unpdf fallback cannot run on edge
export const maxDuration = 60; // PDF + large extraction response is slow

const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10MB, mirrors studio sources route
const MAX_FILES = 2;

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Expected multipart/form-data." }, { status: 400 });
  }

  const entries = form.getAll("files").filter((e): e is File => e instanceof File);
  if (entries.length === 0) {
    return Response.json({ error: "Upload at least one PDF under 'files'." }, { status: 400 });
  }
  if (entries.length > MAX_FILES) {
    return Response.json({ error: `At most ${MAX_FILES} PDFs.` }, { status: 400 });
  }

  const files: PdfInput[] = [];
  for (const file of entries) {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return Response.json({ error: `${file.name} is not a PDF.` }, { status: 400 });
    }
    if (file.size > MAX_PDF_BYTES) {
      return Response.json({ error: `${file.name} exceeds the 10MB limit.` }, { status: 413 });
    }
    files.push({ filename: file.name, buffer: await file.arrayBuffer() });
  }

  try {
    const result = await extractApplication(files);
    return Response.json(result);
  } catch (err) {
    if (err instanceof ExtractionError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error("[labs/pdf-extract]", err);
    return Response.json({ error: "Extraction failed unexpectedly." }, { status: 500 });
  }
}
