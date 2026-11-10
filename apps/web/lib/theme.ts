export const THEME_COOKIE = "theme";
export type Theme = "light" | "dark";

export function normalizeTheme(value: string | undefined): Theme | null {
  return value === "light" || value === "dark" ? value : null;
}

/**
 * Runs before first paint when no theme cookie is set yet, so the page starts
 * in the OS theme without a flash. Kept tiny and dependency-free.
 */
export const themeBootScript = `try{if(!document.documentElement.dataset.theme){document.documentElement.dataset.theme=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}}catch(e){}`;
