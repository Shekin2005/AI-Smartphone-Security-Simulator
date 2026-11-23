# ==================================================
# STRIX SCAN SERVICE
# ==================================================
# Two things this image needs beyond Python:
#   1. the docker CLI, because Strix starts its own sandbox container
#      for every run (docker-outside-of-docker via the mounted socket)
#   2. the real strix-agent package, so we drive Strix itself rather
#      than imitating it
# ==================================================

# Grab just the docker client binary; avoids adding apt repositories.
FROM docker:cli AS dockercli


FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    RUNS_DIR=/data/runs \
    UPLOAD_DIR=/data/uploads \
    TARGET_BASE=http://host.docker.internal:3000

COPY --from=dockercli /usr/local/bin/docker /usr/local/bin/docker

# git/curl/openssl are used by Strix and by source-target scanning
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git \
        curl \
        ca-certificates \
        openssl \
        unzip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

# strix-agent pulls in its own dependencies; reportlab renders the PDF
RUN pip install --upgrade pip \
    && pip install -r requirements.txt

COPY main.py .

RUN mkdir -p /data/runs /data/uploads

EXPOSE 8000

# The health endpoint is token-protected once STRIX_SCAN_TOKEN is set, so
# the probe must present it or the container is reported unhealthy while
# actually working fine.
HEALTHCHECK --interval=20s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -fsS -H "x-scan-token: ${STRIX_SCAN_TOKEN}" http://127.0.0.1:8000/api/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
