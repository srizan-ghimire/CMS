FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile --filter api...

FROM base AS build
COPY --from=deps /app /app
COPY . .
RUN pnpm --filter api prisma:generate
# `pnpm build --filter api...` (turbo, trailing "...") builds packages/shared first — a plain
# `pnpm --filter api build` skips it and the API image then starts with an unresolvable import.
RUN pnpm build --filter api...
# Flattens pnpm's symlink farm into a self-contained tree at /out. Hand-copying node_modules
# instead does not work: the symlinks inside apps/api/node_modules are relative (../../node_modules
# /.pnpm, ../../packages/shared), so they only resolve at their original workspace depth and
# dangle wherever you place them in the image.
RUN pnpm deploy --filter api --prod /out

FROM base AS runtime
ENV NODE_ENV=production
# openssl is required by Prisma's query engine on alpine; tini reaps zombies and, more
# importantly, forwards SIGTERM. Node as PID 1 installs no default signal handlers, so without it
# the platform's shutdown signal is swallowed and app.enableShutdownHooks() never fires — jobs die
# mid-flight on every deploy.
RUN apk add --no-cache tini openssl
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/package.json ./package.json
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/prisma ./prisma
# Two things are missing at this point and both are silent until the first request:
#   1. `pnpm deploy` rebuilds node_modules from the lockfile, so the *generated* client that
#      `prisma generate` wrote in the build stage (node_modules/.prisma/client) is not carried
#      over. Importing @prisma/client without it throws "did not initialize yet" at boot.
#   2. The prisma CLI is a devDependency and `--prod` prunes it, but the entrypoint needs it for
#      `migrate deploy`.
# The CLI version is read from the installed @prisma/client rather than pinned, so a lockfile bump
# cannot silently desync the two.
RUN PRISMA_VERSION="$(node -p "require('./node_modules/@prisma/client/package.json').version")" \
  && npm install -g "prisma@${PRISMA_VERSION}" \
  && prisma generate --schema ./prisma/schema.prisma
COPY apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh && chown -R node:node /app
USER node
EXPOSE 4000
# /health, not /api/v1/health: the controller is VERSION_NEUTRAL *and* excluded from the global
# `api` prefix in main.ts.
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||process.env.API_PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/sbin/tini", "--", "./docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
