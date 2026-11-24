# ==================================================
# AI SMARTPHONE SECURITY SIMULATOR (web app)
# ==================================================
# Runs the Node/Express app plus the AI pentest agent in tools/.
# The agent is spawned by the AI Defender panel inside this same
# container, so there is no separate scanner service to reach.
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

# tini reaps child processes and forwards SIGTERM cleanly.
# The pentest tools below are the same ones Kali ships; Kali is a distro, the
# tools are just packages, so they install here without pulling in Kali.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        tini \
        curl \
        ca-certificates \
        perl \
        libnet-ssleay-perl \
        libxml-writer-perl \
        libjson-perl \
        nmap \
        whatweb \
        dnsutils \
        whois \
    && rm -rf /var/lib/apt/lists/*

# nikto was dropped from Debian bookworm, so install the upstream release.
# It is pure Perl, so no compiler or build stage is needed here.
ARG NIKTO_VERSION=2.6.1
RUN curl -fsSL -o /tmp/nikto.tgz \
        "https://github.com/sullo/nikto/archive/refs/tags/${NIKTO_VERSION}.tar.gz" \
    && tar -xzf /tmp/nikto.tgz -C /opt \
    && mv "/opt/nikto-${NIKTO_VERSION}" /opt/nikto \
    && ln -sf /opt/nikto/program/nikto.pl /usr/local/bin/nikto \
    && rm -f /tmp/nikto.tgz \
    && chmod -R a+rX /opt/nikto \
    && nikto -Version

COPY --from=deps /app/node_modules ./node_modules

# Application code. Secrets are NOT copied; they arrive as env vars.
COPY package.json package-lock.json ./
COPY server.js ./
COPY school-routes.js ./
COPY school-services-routes.js ./
COPY public ./public

# The pentest tooling. Copied with node ownership because the agent writes
# its report here and the process runs as the unprivileged node user.
COPY --chown=node:node tools ./tools

RUN mkdir -p ./tools/out && chown -R node:node ./tools

# Never run as root
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=25s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT}/api/health" || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
