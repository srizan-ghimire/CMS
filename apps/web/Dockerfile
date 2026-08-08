FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile --filter web...

FROM base AS build
COPY --from=deps /app /app
COPY . .

# NEXT_PUBLIC_* is inlined into the client bundle at build time, so it has to be a build ARG.
# Supplying it only at container runtime does nothing: the browser would keep talking to whatever
# was baked in. Empty means same-origin (requests go to /api/v1/... on the web host and are
# forwarded by the rewrite in next.config.mjs); a full https origin talks to the API directly.
ARG NEXT_PUBLIC_API_URL=""
ARG NEXT_PUBLIC_APP_URL=""
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

# Trailing "..." so turbo builds packages/shared first. Its package.json "main" points at
# ./dist/index.js, so a plain `pnpm --filter web build` fails on an unresolved import — being
# listed in transpilePackages is not enough when the file does not exist.
RUN pnpm build --filter web...

FROM base AS runtime
ENV NODE_ENV=production
# Next's standalone server binds localhost unless told otherwise, which a container's port
# mapping cannot reach.
ENV HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
