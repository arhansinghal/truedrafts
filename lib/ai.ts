import { chatJson, isModelAvailable } from "./llm";

const TAG_MODEL = process.env.ESSAY_TAG_MODEL ?? "deepseek-chat";

export async function generateEssayTags(
  content: string,
  university: string,
  essayType: string
): Promise<string[]> {
  if (!isModelAvailable(TAG_MODEL)) return [];

  try {
    const result = await chatJson<string[]>({
      model: TAG_MODEL,
      maxTokens: 150,
      prompt: `Analyze this college application essay for ${university} (type: ${essayType}).
Suggest exactly 4-6 concise tags describing: theme, topic, writing style, and subject matter.
Return ONLY a JSON array of strings. No explanation.
Example: ["resilience", "immigrant experience", "first-generation", "personal growth"]

Essay excerpt:
${content.slice(0, 1500)}`,
    });
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}
