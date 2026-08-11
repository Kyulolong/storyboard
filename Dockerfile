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
# PORT는 기본값일 뿐이다 — Coolify가 런타임에 자기 값(80 등)으로 덮어쓰고,
# Next가 그걸 읽어 그 포트로 뜬다. 그래서 아래 헬스체크도 PORT를 읽어야 한다.
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Coolify UI의 헬스체크는 이미지 안에서 curl이나 wget을 찾는다.
# alpine에는 curl이 없어서 "curl: not found"로 떨어졌다.
RUN apk add --no-cache curl

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# standalone은 정적 자산을 안 품는다. 따로 얹어야 CSS/JS가 나온다.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# 포트를 숫자로 박아두면, Coolify가 PORT를 바꾸는 순간 헬스체크만 엉뚱한 데를
# 두드려 "Connection refused"로 죽는다(이번에 그렇게 됐다). 컨테이너 안에서
# 실제 PORT를 읽어 확인한다. curl 없이 node만으로 되므로 의존성도 없다.
# basePath 때문에 "/"는 404다 — 반드시 "/storyboard"를 봐야 한다.
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/storyboard').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
