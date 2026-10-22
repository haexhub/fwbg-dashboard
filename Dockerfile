FROM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

FROM oven/bun:1-slim

WORKDIR /app

COPY --from=builder /app/.output /app/.output

ENV HOST=0.0.0.0
ENV PORT=3000
ENV DATA_PATH=/app/stats_export
ENV ACCOUNTS_PATH=/app/accounts
# Bun.serve closes a request after 10 s without traffic by default, which cuts
# slow fwbg calls (seen for GET proxies with Bun 1.3). A run start waits up to
# 150 s for fwbg's research preflight; the idle timeout must outlast that
# (Bun allows at most 255 s).
ENV NITRO_BUN_IDLE_TIMEOUT=180

EXPOSE 3000

CMD ["bun", ".output/server/index.mjs"]
