"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, X, Loader2 } from "lucide-react";

export function PdfImportPanel() {
  const router = useRouter();
  const [proof, setProof] = useState<File | null>(null);
  const [pdfs, setPdfs] = useState<File[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExtract() {
    if (!proof) return setError("Upload your admission proof.");
    if (pdfs.length === 0) return setError("Upload at least one Common App PDF.");
    setError(null);
    setExtracting(true);
    try {
      const form = new FormData();
      form.append("proof", proof);
      pdfs.forEach((f) => form.append("files", f));
      const res = await fetch("/api/writer/applications/extract", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Extraction failed.");
      router.push(`/writer/essays/new?draft=${data.draftId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed.");
      setExtracting(false);
    }
  }

  const card: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--line)",
    borderRadius: 14,
    boxShadow: "var(--shadow-sm)",
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Admission proof */}
      <div className="p-5" style={card}>
        <div className="text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>
          Admission proof <span style={{ color: "var(--td-red)" }}>*</span>
        </div>
        <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--ink-faint)" }}>
          A screenshot or PDF of your decision letter / acceptance. Reviewed privately, never shown publicly.
        </p>
        {proof ? (
          <FileChip name={proof.name} onRemove={() => setProof(null)} />
        ) : (
          <UploadZone
            accept="image/*,application/pdf"
            label="Click to upload your admission proof"
            hint="PNG, JPG, or PDF · up to 10MB"
            onFile={(f) => { setError(null); setProof(f); }}
          />
        )}
      </div>

      {/* Common App PDFs */}
      <div className="p-5" style={card}>
        <div className="text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>
          Common App PDF(s) <span style={{ color: "var(--td-red)" }}>*</span>
        </div>
        <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--ink-faint)" }}>
          Your Common App export (and, optionally, a second PDF with supplemental essays). Up to 2 files.
        </p>
        {pdfs.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {pdfs.map((f, i) => (
              <FileChip key={i} name={f.name} onRemove={() => setPdfs(pdfs.filter((_, idx) => idx !== i))} />
            ))}
          </div>
        )}
        {pdfs.length < 2 && (
          <UploadZone
            accept="application/pdf"
            label={pdfs.length === 0 ? "Click to upload your Common App PDF" : "Add a second PDF (optional)"}
            hint="PDF · up to 10MB each"
            onFile={(f) => { setError(null); setPdfs((p) => [...p, f].slice(0, 2)); }}
          />
        )}
      </div>

      {error && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: "var(--red-wash)", color: "var(--td-red)" }}>
          {error}
        </div>
      )}

      <button
        onClick={handleExtract}
        disabled={extracting}
        className="inline-flex items-center justify-center gap-2 rounded-[10px] px-[18px] py-[13px] text-sm font-semibold text-white disabled:opacity-70"
        style={{ background: "var(--td-blue)" }}
      >
        {extracting ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Reading your application… (~30s)</>
        ) : (
          "Extract & review →"
        )}
      </button>
      <p className="text-center text-xs" style={{ color: "var(--ink-faint)" }}>
        We read your PDFs to pre-fill the form — you review and edit everything before anything is submitted. The PDFs themselves are not stored.
      </p>
    </div>
  );
}

function UploadZone({
  accept,
  label,
  hint,
  onFile,
}: {
  accept: string;
  label: string;
  hint: string;
  onFile: (f: File) => void;
}) {
  return (
    <label
      className="mt-3 flex cursor-pointer flex-col items-center rounded-[12px] px-6 py-7 text-center transition-colors"
      style={{ border: "2px dashed var(--line)", background: "var(--paper)" }}
    >
      <Upload className="mb-2 h-6 w-6" style={{ color: "var(--ink-faint)" }} />
      <span className="text-sm font-medium" style={{ color: "var(--ink-soft)" }}>{label}</span>
      <span className="mt-0.5 text-xs" style={{ color: "var(--ink-faint)" }}>{hint}</span>
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </label>
  );
}

function FileChip({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <div
      className="mt-3 flex items-center gap-3 rounded-[11px] px-3 py-2.5"
      style={{ background: "var(--blue-wash)", border: "1px solid var(--blue-line)" }}
    >
      <FileText className="h-4 w-4 shrink-0" style={{ color: "var(--td-blue)" }} />
      <span className="flex-1 truncate text-[13px] font-medium" style={{ color: "var(--td-blue)" }}>{name}</span>
      <button type="button" onClick={onRemove} aria-label="Remove" style={{ color: "var(--ink-faint)" }}>
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
