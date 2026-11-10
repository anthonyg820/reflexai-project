import { TENANTS } from "@rehearse/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Sidebar } from "@/components/sidebar";
import { currentTenant } from "@/lib/api";
import { runtimeInfo } from "@/lib/runtime";
import { THEME_COOKIE, normalizeTheme, themeBootScript } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = { title: "RehearseAI", description: "Practice hard conversations." };
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const tenant = await currentTenant();
  const theme = normalizeTheme((await cookies()).get(THEME_COOKIE)?.value);
  const info = runtimeInfo();
  const tenantName = TENANTS.find((t) => t.id === tenant)?.name ?? tenant;
  return (
    <html lang="en" data-theme={theme ?? undefined} suppressHydrationWarning>
      <head>
        {/* No theme cookie yet: start in the OS theme before first paint. */}
        {!theme && <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />}
      </head>
      <body className="min-h-screen font-sans text-sm antialiased md:flex">
        <Sidebar
          tenant={tenant}
          buildInfo={
            <div className="rounded-[10px] border border-line px-3 py-2.5 font-mono text-[11px] leading-relaxed text-muted" data-testid="build-info">
              {info.cloud} · {info.environment} · {info.version.slice(0, 12)}
              <br />
              {tenantName}
            </div>
          }
        />
        <main className="min-w-0 flex-1 px-4 py-8 sm:px-10">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </body>
    </html>
  );
}
