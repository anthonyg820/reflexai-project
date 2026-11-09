import path from "node:path";
import type { NextConfig } from "next";

/**
 * Build once, promote everywhere: nothing environment-specific is read at
 * build time. API_URL etc. are read at request time (see app/api/[...path]),
 * which is why we don't use next.config rewrites or NEXT_PUBLIC_* vars —
 * both are baked into the bundle at build time.
 */
const config: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  poweredByHeader: false,
};

export default config;
