"use client";
import { useEffect, useState } from "react";
import { THEME_COOKIE, type Theme } from "@/lib/theme";
import { Icon } from "./ui";

/** Dark mode switch. The choice is kept in a cookie so the server renders the right theme. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  }, []);

  const dark = theme === "dark";
  const toggle = () => {
    const next: Theme = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    setTheme(next);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      onClick={toggle}
      className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm text-ink-soft hover:bg-sunken"
    >
      <Icon name={dark ? "moon" : "sun"} />
      <span className="flex-1 text-left">Dark mode</span>
      <span aria-hidden="true" className={`relative h-6 w-10 rounded-full transition ${dark ? "bg-accent" : "bg-line-strong"}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-card shadow transition-all ${dark ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}
