import type { Difficulty } from "@rehearse/types";
import Link from "next/link";

export function PageTitle({
  title,
  subtitle,
  eyebrow,
  action,
}: {
  title: string;
  subtitle?: React.ReactNode;
  eyebrow?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-[13px] text-muted">{eyebrow}</p>}
        <h1 className="text-[32px] leading-tight font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 text-muted">{subtitle}</p>}
      </div>
      {action && <div className="flex flex-wrap gap-2.5">{action}</div>}
    </header>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[14px] border border-line bg-card ${className}`}>{children}</div>;
}

export function SectionCard({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-[14px] border border-line bg-card ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, children }: { label: string; value: React.ReactNode; hint?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-1.5 px-5 py-[18px]">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="font-display text-[34px] leading-tight font-semibold tabular-nums">{value}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
      {children}
    </Card>
  );
}

const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-[18px] text-sm transition disabled:opacity-50";
export const buttonClass = `${button} bg-accent font-semibold text-accent-ink hover:opacity-90`;
export const secondaryButtonClass = `${button} border border-line-strong bg-card font-medium text-ink hover:bg-sunken`;
export const outlineAccentButtonClass =
  "inline-flex min-h-9 items-center justify-center rounded-lg border border-accent px-3.5 text-[13px] font-semibold text-accent-strong hover:bg-accent-soft";

export function ButtonLink({ href, children, secondary }: { href: string; children: React.ReactNode; secondary?: boolean }) {
  return (
    <Link href={href} className={secondary ? secondaryButtonClass : buttonClass}>
      {children}
    </Link>
  );
}

export function ScoreBadge({ score, passing }: { score: number | null; passing?: number | null }) {
  if (score === null) return <span className="text-muted">—</span>;
  const pass = passing === undefined || passing === null || score >= passing;
  return (
    <span
      className={`inline-block min-w-10 rounded-full px-2.5 py-1 text-center text-[13px] font-semibold tabular-nums ${
        pass ? "bg-accent-soft text-accent-strong" : "bg-warn-soft text-warn"
      }`}
    >
      {score}
    </span>
  );
}

const DIFFICULTY: Record<Difficulty, { label: string; className: string }> = {
  intro: { label: "Intro", className: "bg-accent-soft text-accent-strong" },
  core: { label: "Core", className: "bg-info-soft text-info" },
  advanced: { label: "Advanced", className: "bg-warn-soft text-warn" },
};

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const d = DIFFICULTY[difficulty];
  return <span className={`inline-block rounded-full px-2.5 py-[3px] text-xs font-medium whitespace-nowrap ${d.className}`}>{d.label}</span>;
}
export const difficultyLabel = (d: Difficulty) => DIFFICULTY[d].label;

const AVATAR_TINTS = ["bg-accent-soft text-accent-strong", "bg-info-soft text-info", "bg-violet-soft text-violet", "bg-warn-soft text-warn"];

export function Avatar({ name, size = 44, tint }: { name: string; size?: number; tint?: number }) {
  const first = name.split(",")[0]!.trim();
  const initials = first.split(/\s+/).length > 1 ? first.split(/\s+/).map((w) => w[0]).join("").slice(0, 2) : first.slice(0, 2);
  const index = tint ?? [...first].reduce((n, c) => n + c.charCodeAt(0), 0) % AVATAR_TINTS.length;
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold uppercase ${AVATAR_TINTS[index]}`}
      style={{ width: size, height: size, fontSize: size * 0.32 }}
    >
      {initials}
    </span>
  );
}

/** Horizontal meter. `good` decides accent vs amber. */
export function Bar({ value, max = 100, good, height = 8 }: { value: number; max?: number; good: boolean; height?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div aria-hidden="true" className="w-full overflow-hidden rounded bg-line-soft" style={{ height }}>
      <div className={`h-full rounded ${good ? "bg-accent" : "bg-warn-bar"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** "12 min ago", "3 h ago", "Yesterday", else a date. */
export function timeAgo(iso: string, now = Date.now()) {
  const mins = Math.round((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  if (hours < 48) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function Icon({ name, size = 18 }: { name: keyof typeof ICONS; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}

const ICONS = {
  logo: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </>
  ),
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>
  ),
  chart: (
    <>
      <path d="M12 20V10" />
      <path d="M18 20V4" />
      <path d="M6 20v-4" />
    </>
  ),
  play: <polygon points="6 4 20 12 6 20 6 4" />,
  plus: <path d="M12 5v14M5 12h14" />,
  back: <path d="M15 18l-6-6 6-6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
};
