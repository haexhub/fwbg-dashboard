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

EXPOSE 3000

CMD ["bun", ".output/server/index.mjs"]
