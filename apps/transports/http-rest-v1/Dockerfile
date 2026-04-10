# Build from the monorepo root (parent of `apps/`):
#   docker build -f apps/transports/http-rest-v1/Dockerfile -t cryptessage-http-rest-v1:latest .
#
# Required at runtime: DEPLOYMENT_SECRET (and optional vars from README).

# --- compile TypeScript (needs root devDependencies: typescript) ---
FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json nx.json tsconfig.base.json ./
COPY apps/transports/http-rest-v1 ./apps/transports/http-rest-v1
COPY apps/web-app/package.json ./apps/web-app/package.json

RUN mkdir -p packages

# Monorepo has peer-dep ranges that npm 10 treats as errors; lockfile matches local installs.
RUN npm ci --legacy-peer-deps

RUN npx tsc -p apps/transports/http-rest-v1/tsconfig.json

# --- minimal production image ---
FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY apps/transports/http-rest-v1/package.runtime.json ./package.json

RUN npm install --omit=dev

COPY --from=build /app/apps/transports/http-rest-v1/dist ./dist

EXPOSE 3333

USER node

CMD ["node", "dist/main.js"]
