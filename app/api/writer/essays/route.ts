import { auth } from "@/lib/auth";
import { db, essays, universities } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { generateSlug, computePreview } from "@/lib/utils";
import { generateEssayTags } from "@/lib/ai";
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "writer") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db.query.essays.findMany({
    where: eq(essays.writerId, session.user.id),
    with: { university: true },
    orderBy: [desc(essays.createdAt)],
  });

  return Response.json(rows);
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "writer") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { title, universityId, essayType, fullContent, priceCents, admittedYear, essayPrompt, submissionImageUrl } = body;

  if (!title || !universityId || !essayType || !fullContent || !priceCents || !submissionImageUrl) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const slug = generateSlug(title);
  const previewContent = computePreview(fullContent, 0.25);
  const wordCount = fullContent.split(/\s+/).length;

  // Get university name for tagging
  const university = await db.query.universities.findFirst({
    where: eq(universities.id, universityId),
  });

  // AI auto-tag (non-blocking)
  const tags = await generateEssayTags(
    fullContent,
    university?.name ?? "university",
    essayType
  );

  const [essay] = await db
    .insert(essays)
    .values({
      writerId: session.user.id,
      universityId,
      title,
      slug,
      essayType,
      fullContent,
      previewContent,
      wordCount,
      priceCents,
      admittedYear: admittedYear ?? null,
      tags,
      essayPrompt: essayPrompt ?? null,
      submissionImageUrl,
      status: "pending",
    })
    .returning();

  return Response.json(essay, { status: 201 });
}
