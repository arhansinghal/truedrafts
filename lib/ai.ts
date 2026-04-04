import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
});

export async function generateEssayTags(
  content: string,
  university: string,
  essayType: string
): Promise<string[]> {
  if (!process.env.ANTHROPIC_API_KEY) return [];

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [
        {
          role: "user",
          content: `Analyze this college application essay for ${university} (type: ${essayType}).
Suggest exactly 4-6 concise tags describing: theme, topic, writing style, and subject matter.
Return ONLY a JSON array of strings. No explanation.
Example: ["resilience", "immigrant experience", "first-generation", "personal growth"]

Essay excerpt:
${content.slice(0, 1500)}`,
        },
      ],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "[]";
    return JSON.parse(text);
  } catch {
    return [];
  }
}
