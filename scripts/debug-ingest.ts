// Direct test of URL ingestion — bypasses auth + DB. Prints extraction result.
import { extractFromUrl } from "../lib/studio/extract";

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error("Usage: tsx scripts/debug-ingest.ts <url>");
    process.exit(1);
  }
  console.log(`Extracting ${url}...`);
  try {
    const r = await extractFromUrl(url);
    console.log(`  title: ${r.title}`);
    console.log(`  chars: ${r.text.length}`);
    console.log(`  paywalled: ${r.paywalled}`);
    console.log(`  preview: ${r.text.slice(0, 300)}`);
  } catch (err) {
    console.error("FAILED:", err);
  }
}

main().then(() => process.exit(0));
