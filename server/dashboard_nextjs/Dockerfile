FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package*.json ./
RUN npm ci

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY . .

RUN npm run build

FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 nodejs \
 && adduser -u 1001 -G nodejs -s /bin/sh -D nextjs

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js", "-p", "3000", "-H", "0.0.0.0"]
