# Worker image for the STEALER engine.
# Runs on Render / Railway / Fly. Talks to Supabase + kie.ai + ElevenLabs + OpenAI.
FROM node:20-bookworm-slim

# ffmpeg-static ships its own binary, but having a system ffmpeg is a useful
# fallback and removes the need to point fluent-ffmpeg at the npm binary.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps using the lockfile.
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy sources and build.
COPY tsconfig.json ./
COPY src ./src
RUN npm install --include=dev typescript tsx \
 && npx tsc -p tsconfig.json \
 && npm prune --omit=dev

# Healthcheck: simple file presence + exit code.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "process.exit(0)"

CMD ["node", "dist/server.js"]
