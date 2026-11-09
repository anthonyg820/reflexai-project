import type { Metadata } from "next";
import Link from "next/link";
import { TenantSwitcher } from "@/components/tenant-switcher";
import { currentTenant } from "@/lib/api";
import { runtimeInfo } from "@/lib/runtime";
import "./globals.css";

export const metadata: Metadata = { title: "Rehearse", description: "Practice hard conversations." };
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const tenant = await currentTenant();
  const info = runtimeInfo();
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <header className="border-b border-line">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-8 gap-y-3 px-4 py-4">
            <Link href="/" className="font-serif text-2xl tracking-tight">
              Rehearse
            </Link>
            <nav className="flex gap-5 text-sm text-muted">
              <Link href="/" className="hover:text-ink">
                Dashboard
              </Link>
              <Link href="/scenarios" className="hover:text-ink">
                Scenarios
              </Link>
            </nav>
            <div className="ml-auto">
              <TenantSwitcher current={tenant} />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 pb-8 text-xs text-muted">
          <span className="rounded border border-line px-2 py-1 font-mono" data-testid="build-info">
            {info.cloud} · {info.environment} · {info.version.slice(0, 12)}
          </span>
        </footer>
      </body>
    </html>
  );
}
