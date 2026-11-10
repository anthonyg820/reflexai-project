"use client";
import { TENANTS } from "@rehearse/types";
import { useRouter } from "next/navigation";
import { TENANT_COOKIE } from "@/lib/tenant";

export function TenantSwitcher({ current }: { current: string }) {
  const router = useRouter();
  return (
    <label className="flex flex-col gap-1.5 px-2 text-xs text-muted">
      Organization
      <select
        className="h-10 rounded-lg border border-line bg-paper px-2.5 text-sm text-ink"
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
