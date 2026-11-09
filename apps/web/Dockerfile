# syntax=docker/dockerfile:1.7
# Built ONCE per commit in CI and promoted by digest. No NEXT_PUBLIC_* or
# other build-time env: API_URL etc. are read at request time.

# Debian (glibc), not Alpine: Next.js's musl SWC/Turbopack binaries crashed
# (SIGKILL/SIGBUS) under Docker Desktop on Windows.
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch --frozen-lockfile
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --offline
RUN pnpm turbo run build --filter=@rehearse/web...

FROM node:22-bookworm-slim AS runtime
ARG GIT_SHA=dev
LABEL org.opencontainers.image.source="https://github.com/anthonyg820/reflexai-project" \
      org.opencontainers.image.revision="${GIT_SHA}"
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080 HOSTNAME=0.0.0.0 SERVICE_VERSION=${GIT_SHA}
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 8080
CMD ["node", "apps/web/server.js"]
