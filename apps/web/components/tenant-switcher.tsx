"use client";
import { TENANTS } from "@rehearse/types";
import { useRouter } from "next/navigation";
import { TENANT_COOKIE } from "@/lib/tenant";

export function TenantSwitcher({ current }: { current: string }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      Tenant
      <select
        className="rounded-md border border-line bg-card px-2 py-1 text-ink"
        defaultValue={current}
        onChange={(e) => {
          document.cookie = `${TENANT_COOKIE}=${e.target.value}; path=/; max-age=31536000; samesite=lax`;
          router.push("/");
          router.refresh();
        }}
      >
        {TENANTS.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  );
}
