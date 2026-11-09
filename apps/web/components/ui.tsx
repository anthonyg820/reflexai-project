import Link from "next/link";

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-serif text-3xl tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-line bg-card p-5 ${className}`}>{children}</div>;
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card>
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1 font-serif text-3xl tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </Card>
  );
}

export const buttonClass =
  "inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:opacity-90 disabled:opacity-50";
export const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-accent-soft disabled:opacity-50";

export function ButtonLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={buttonClass}>
      {children}
    </Link>
  );
}

export function ScoreBadge({ score, passing }: { score: number | null; passing?: number }) {
  if (score === null) return <span className="text-muted">—</span>;
  const pass = passing === undefined || score >= passing;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-sm tabular-nums ${pass ? "bg-accent-soft text-accent" : "bg-warn-soft text-warn"}`}
    >
      {score}
    </span>
  );
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
