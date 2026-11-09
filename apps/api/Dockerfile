# syntax=docker/dockerfile:1.7
# Built ONCE per commit in CI and promoted by digest. Nothing environment-
# specific goes in here; runtime config arrives with the revision/task def.

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch --frozen-lockfile
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --offline
RUN pnpm turbo run build --filter=@rehearse/api...
RUN pnpm --filter=@rehearse/api deploy --prod --legacy /out

FROM node:22-alpine AS runtime
ARG GIT_SHA=dev
LABEL org.opencontainers.image.source="https://github.com/anthonyg820/reflexai-project" \
      org.opencontainers.image.revision="${GIT_SHA}"
ENV NODE_ENV=production PORT=8080 SERVICE_VERSION=${GIT_SHA}
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 8080
CMD ["node", "--require", "./dist/otel.js", "dist/main.js"]
