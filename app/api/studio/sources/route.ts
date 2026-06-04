import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { studioApps, studioSources } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { ingestPdfSource, ingestUrlSource } from "@/lib/studio/ingest";

const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10MB

async function ownsApp(userId: string, appId: string) {
  const a = await db.query.studioApps.findFirst({
    where: and(eq(studioApps.id, appId), eq(studioApps.userId, userId)),
  });
  return !!a;
}

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const appId = searchParams.get("appId");
  if (!appId) return Response.json({ error: "appId required" }, { status: 400 });
  if (!(await ownsApp(session.user.id, appId))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await db.query.studioSources.findMany({
    where: eq(studioSources.appId, appId),
    orderBy: [desc(studioSources.createdAt)],
  });
  return Response.json(rows);
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const ct = req.headers.get("content-type") ?? "";

  // PDF upload — multipart/form-data with "file" + "appId"
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const appId = String(form.get("appId") ?? "");
    const file = form.get("file");
    if (!appId) return Response.json({ error: "appId required" }, { status: 400 });
    if (!(await ownsApp(session.user.id, appId))) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    if (!(file instanceof Blob)) {
      return Response.json({ error: "file required" }, { status: 400 });
    }
    if (file.size > MAX_PDF_BYTES) {
      return Response.json({ error: "PDF too large (max 10MB)" }, { status: 413 });
    }
    const filename = (file instanceof File ? file.name : null) || "Uploaded PDF";
    const buf = await file.arrayBuffer();

    const [created] = await db
      .insert(studioSources)
      .values({
        appId,
        kind: "pdf",
        uri: `local:${filename}`,
        title: filename,
        status: "pending",
      })
      .returning();

    // Fire-and-await: ingestion is fast for typical PDFs; keep it in-request
    // so the client gets a final status. For very large PDFs we could move
    // this to a queue, but with a 10MB cap it's not worth the complexity.
    const result = await ingestPdfSource(created, buf);
    const final = await db.query.studioSources.findFirst({
      where: eq(studioSources.id, created.id),
    });
    return Response.json({ ...final, _ingest: result }, { status: 201 });
  }

  // URL — JSON body with { appId, url }
  const body = await req.json().catch(() => ({}));
  const { appId, url } = body as { appId?: string; url?: string };
  if (!appId || !url) {
    return Response.json({ error: "appId and url required" }, { status: 400 });
  }
  if (!/^https?:\/\//i.test(url)) {
    return Response.json({ error: "URL must be http(s)" }, { status: 400 });
  }
  if (!(await ownsApp(session.user.id, appId))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const [created] = await db
    .insert(studioSources)
    .values({
      appId,
      kind: "url",
      uri: url,
      title: url, // refined by ingestion
      status: "pending",
    })
    .returning();

  const result = await ingestUrlSource(created);
  const final = await db.query.studioSources.findFirst({
    where: eq(studioSources.id, created.id),
  });
  return Response.json({ ...final, _ingest: result }, { status: 201 });
}
