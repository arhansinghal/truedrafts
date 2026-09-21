// Tiny CSV writer for the writer earnings export. Kept dependency-free — the
// only consumer is one route and the shapes are flat string/number rows.

export type CsvRow = Record<string, string | number | null | undefined>;

/**
 * Serialises rows to CSV using the keys of the first row as the header.
 * Null/undefined cells become empty strings so column alignment survives a
 * sparse row.
 */
export function toCsv(rows: CsvRow[], headers?: string[]): string {
  if (rows.length === 0) return "";
  const cols = headers ?? Object.keys(rows[0]);

  const lines = [cols.join(",")];
  for (const row of rows) {
    lines.push(cols.map((c) => String(row[c] ?? "")).join(","));
  }
  return lines.join("\n");
}
