// Sandbox PDF-import lab — submission endpoint. Dev-only, no auth, NO DB.
//
// Sandbox twin of POST /api/writer/applications: enforces only what the real
// route actually enforces (universityId + admissionProofUrl present, every
// supplemental has both prompt and content). The 700-word Common App limit is
// display-only in the real wizard, so it is never a reject here. On success
// the payload is written to sandbox-submissions/<timestamp>.json (untracked).

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { SandboxSubmission } from "@/lib/labs/pdf-import/schema";

export const runtime = "nodejs";

const OUT_DIR = path.join(process.cwd(), "sandbox-submissions");

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }

  let body: SandboxSubmission;
  try {
    body = (await req.json()) as SandboxSubmission;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Mirror of the real route's checks (app/api/writer/applications/route.ts).
  if (!body.universityId || !body.admissionProofUrl) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }
  const supplementals = body.supplementals ?? [];
  if (supplementals.some((s) => !s.prompt?.trim() || !s.content?.trim())) {
    return Response.json(
      { error: "Each supplemental essay needs both a prompt and the essay text." },
      { status: 400 },
    );
  }

  const submission: SandboxSubmission = {
    ...body,
    commonAppScreenshotUrl: null,
    numSupplementals: supplementals.length,
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(OUT_DIR, `${stamp}.json`);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(file, JSON.stringify(submission, null, 2), "utf8");

  return Response.json({ ok: true, savedTo: `sandbox-submissions/${stamp}.json`, submission }, { status: 201 });
}
