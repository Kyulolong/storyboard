# Coolify는 이 파일로 이미지를 굽는다 (Build Pack: Dockerfile).
# 이 앱은 서버 라우트(/api/generate, /api/sketch, /api/providers)가 있어서
# 정적 내보내기(next export)가 불가능하다 — Node 서버로 떠야 한다.

# ---- 1) 의존성 ----
# package.json이 안 바뀌면 이 레이어는 캐시에서 재사용된다.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- 2) 빌드 ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- 3) 런타임 ----
# standalone 출력에는 실행에 필요한 것만 들어 있다.
# 소스도 devDependencies도 최종 이미지에 남기지 않는다.
FROM node:22-alpine AS runner
WORKDIR /app

# HOSTNAME을 0.0.0.0으로 열지 않으면 컨테이너 밖(Traefik)에서 못 붙는다.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# standalone은 정적 자산을 안 품는다. 따로 얹어야 CSS/JS가 나온다.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
