// Shared presentational helpers for the "Manuscript" writer dashboard.
// Server-safe (no client hooks) — pure styling around the design tokens.
import Link from "next/link";
import {
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  type LucideIcon,
} from "lucide-react";

function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`eyebrow ${className}`}>{children}</div>;
}

export function PageHead({
  eyebrow,
  title,
  sub,
  right,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-[26px] flex items-end justify-between gap-5">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1
          className="serif mt-2 text-[32px] font-medium"
          style={{ color: "var(--ink)", letterSpacing: "-.015em" }}
        >
          {title}
        </h1>
        {sub && (
          <p className="mt-1.5 text-sm" style={{ color: "var(--ink-soft)" }}>
            {sub}
          </p>
        )}
      </div>
      {right}
    </div>
  );
}

const STAT_TONES: Record<string, [string, string]> = {
  emerald: ["var(--emerald-wash)", "var(--emerald)"],
  blue: ["var(--blue-wash)", "var(--td-blue)"],
  neutral: ["var(--paper-2)", "var(--ink-soft)"],
};

export function StatCard({
  icon: Icon,
  tone = "neutral",
  label,
  value,
  sub,
  actionLabel,
  actionHref,
}: {
  icon: LucideIcon;
  tone?: "emerald" | "blue" | "neutral";
  label: string;
  value: React.ReactNode;
  sub?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  const [bg, fg] = STAT_TONES[tone];
  return (
    <div
      className="rounded-[14px] p-5"
      style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--shadow-sm)" }}
    >
      <div className="mb-3.5 flex items-center gap-[9px]">
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-[9px]"
          style={{ background: bg, color: fg }}
        >
          <Icon className="h-4 w-4" />
        </span>
        <Eyebrow>{label}</Eyebrow>
      </div>
      <div
        className="serif text-[30px] font-semibold"
        style={{ color: "var(--ink)", letterSpacing: "-.01em" }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1 text-[12.5px]" style={{ color: "var(--ink-faint)" }}>
          {sub}
        </div>
      )}
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="mt-2 inline-block text-[12.5px] font-semibold"
          style={{ color: "var(--td-blue)" }}
        >
          {actionLabel} →
        </Link>
      )}
    </div>
  );
}

const STATUS: Record<string, { tone: string; label: string; icon: LucideIcon }> = {
  pending: { tone: "amber", label: "Pending review", icon: Clock },
  approved: { tone: "emerald", label: "Live", icon: CheckCircle },
  rejected: { tone: "red", label: "Changes needed", icon: XCircle },
  archived: { tone: "neutral", label: "Archived", icon: FileText },
  paid: { tone: "emerald", label: "Paid", icon: CheckCircle },
  processing: { tone: "blue", label: "Processing", icon: Clock },
  failed: { tone: "red", label: "Failed", icon: XCircle },
};

const PILL_TONES: Record<string, React.CSSProperties> = {
  neutral: { background: "var(--paper-2)", color: "var(--ink-soft)", border: "1px solid var(--line)" },
  blue: { background: "var(--blue-wash)", color: "var(--td-blue)", border: "1px solid var(--blue-line)" },
  emerald: { background: "var(--emerald-wash)", color: "var(--emerald)", border: "1px solid #CCE6DA" },
  amber: { background: "var(--amber-wash)", color: "var(--amber)", border: "1px solid #ECDCB6" },
  red: { background: "var(--red-wash)", color: "var(--td-red)", border: "1px solid #ECCDC9" },
  ink: { background: "var(--ink)", color: "var(--paper)", border: "1px solid var(--ink)" },
};

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: keyof typeof PILL_TONES;
}) {
  return (
    <span
      className="inline-flex items-center gap-[5px] rounded-full px-[9px] py-[3px] text-[11.5px] font-semibold leading-[1.4]"
      style={PILL_TONES[tone]}
    >
      {children}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.pending;
  const Icon = s.icon;
  return (
    <Pill tone={s.tone as keyof typeof PILL_TONES}>
      <Icon className="h-3 w-3" />
      {s.label}
    </Pill>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-bold" style={{ color: "var(--ink)" }}>
      {children}
    </h2>
  );
}
