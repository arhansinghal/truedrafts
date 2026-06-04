import { config } from "dotenv";
config({ path: ".env.local" });
import Anthropic from "@anthropic-ai/sdk";

async function main() {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 40,
    messages: [{ role: "user", content: "Respond with the single word: PONG" }],
  });
  const block = msg.content[0];
  console.log("Reply:", block.type === "text" ? block.text : block);
  console.log("Usage:", msg.usage);
}

main().catch((e) => {
  console.error("ERR:", e.message ?? e);
  process.exit(1);
});
