"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TenantSwitcher } from "./tenant-switcher";
import { ThemeToggle } from "./theme-toggle";
import { Icon } from "./ui";

const NAV = [
  { href: "/", label: "Dashboard", icon: "dashboard" as const, match: (p: string) => p === "/" },
  { href: "/scenarios", label: "Scenarios", icon: "book" as const, match: (p: string) => p.startsWith("/scenarios") },
  { href: "/sessions", label: "Sessions", icon: "chart" as const, match: (p: string) => p.startsWith("/sessions") },
];

export function Sidebar({ tenant, buildInfo }: { tenant: string; buildInfo: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="flex flex-col gap-4 border-b border-line bg-card px-4 py-4 md:sticky md:gap-6 md:py-6 md:top-0 md:h-screen md:w-64 md:shrink-0 md:border-r md:border-b-0"
    >
      <Link href="/" className="flex items-center gap-2.5 px-2 text-ink">
        <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-[9px] bg-accent text-accent-ink">
          <Icon name="logo" />
        </span>
        <span className="font-display text-xl font-semibold tracking-tight">RehearseAI</span>
      </Link>

      <TenantSwitcher current={tenant} />

      <ul className="flex flex-wrap gap-1 md:flex-col md:flex-nowrap md:gap-0.5">
        {NAV.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm ${
                  active ? "bg-accent-soft font-semibold text-accent-strong" : "text-ink-soft hover:bg-sunken"
                }`}
              >
                <Icon name={item.icon} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-3 md:mt-auto">
        <ThemeToggle />
        <div className="hidden md:block">{buildInfo}</div>
      </div>
    </nav>
  );
}
