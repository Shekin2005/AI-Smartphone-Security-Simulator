# ==================================================
# AI SMARTPHONE SECURITY SIMULATOR (web app)
# ==================================================
# Runs the Node/Express app that also proxies to the Strix scanner.
# Built for a single-host deployment where both containers share a
# private network, so no tunnel or public scanner URL is needed.
# ==================================================

# ---- dependencies ----
# argon2 is a native module; build it in a throwaway stage so the
# runtime image does not ship a compiler.
FROM node:22-bookworm-slim AS deps

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 \
        make \
        g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./

RUN npm ci --omit=dev


# ---- runtime ----
FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

WORKDIR /app

# tini reaps child processes and forwards SIGTERM cleanly
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        tini \
        curl \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules

# Application code. Secrets are NOT copied; they arrive as env vars.
COPY package.json package-lock.json ./
COPY server.js ./
COPY strix-proxy-routes.js ./
COPY school-routes.js ./
COPY school-services-routes.js ./
COPY public ./public

# Never run as root
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=25s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT}/api/health" || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
