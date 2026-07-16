// 서버 전용. 아주 단순한 고정 윈도 방식의 요청 제한.
//
// 한계를 먼저 적어둔다(중요):
//  - 상태가 프로세스 메모리에만 있다. 서버리스처럼 인스턴스가 여러 개면
//    인스턴스마다 카운터가 따로 논다 → 실제 허용량이 배수로 늘어난다.
//    "자동화로 두드리는 걸 늦추는 과속방지턱"이지 정확한 쿼터가 아니다.
//    정확한 제한이 필요하면 Redis/KV 같은 공용 저장소가 있어야 한다.
//  - IP 기준이라 NAT/모바일 망에서는 여러 사람이 한 통을 나눠 쓴다.
//    반대로 IP를 바꾸면 우회된다.
//
// 그래도 다는 이유: 공개 배포에서 스크립트 한 줄에 자원이 갈리는 걸 막는다.

interface Bucket {
  count: number;
  resetAt: number; // epoch ms
}

const buckets = new Map<string, Bucket>();
// 메모리가 무한히 늘지 않게 상한을 둔다. 넘으면 만료된 것부터 버린다.
const MAX_ENTRIES = 10_000;

function prune(now: number) {
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k);
  }
  // 만료된 걸 다 지워도 넘치면(=동시 사용자가 진짜 많으면) 오래된 것부터 버린다.
  if (buckets.size > MAX_ENTRIES) {
    const excess = buckets.size - MAX_ENTRIES;
    let i = 0;
    for (const k of buckets.keys()) {
      if (i++ >= excess) break;
      buckets.delete(k);
    }
  }
}

export interface RateResult {
  ok: boolean;
  retryAfterSec: number;
  remaining: number;
}

export function hit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  if (buckets.size > MAX_ENTRIES / 2) prune(now);

  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0, remaining: limit - 1 };
  }
  b.count++;
  if (b.count > limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
      remaining: 0,
    };
  }
  return { ok: true, retryAfterSec: 0, remaining: limit - b.count };
}

// 요청자 식별. 프록시 뒤에서는 플랫폼이 넣어주는 헤더가 진실이다.
// 이 헤더들이 아예 없는 환경(직접 노출된 서버)에서는 전부 "unknown"으로 묶여
// 모든 사용자가 한 통을 공유하게 된다 → 배포 시 프록시 설정을 확인할 것.
export function clientIp(req: Request): string {
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "unknown";
}

function num(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// 두 단계로 나눈다:
//  - 서버 키로 도는 요청 = 운영자가 돈을 낸다 → 빡세게.
//  - 사용자가 자기 키를 넣은 요청(BYOK) = 본인이 낸다 → 서버 자원만 지키면 되니 넉넉하게.
export function limitsFor(route: "generate" | "sketch", fromUserKey: boolean) {
  if (route === "generate") {
    return fromUserKey
      ? num(process.env.RATE_GENERATE_BYOK, 20)
      : num(process.env.RATE_GENERATE_SERVER, 5);
  }
  return fromUserKey
    ? num(process.env.RATE_SKETCH_BYOK, 120)
    : num(process.env.RATE_SKETCH_SERVER, 30);
}

export const WINDOW_MS = 60_000; // 1분

// 개발 중에는 끈다. 로컬은 x-forwarded-for가 없어 전부 한 통에 묶여서
// 혼자 쓰는데도 막히기 때문. 테스트할 땐 RATE_LIMIT_FORCE=1.
export function rateLimitEnabled(): boolean {
  if (process.env.RATE_LIMIT_DISABLED === "1") return false;
  if (process.env.RATE_LIMIT_FORCE === "1") return true;
  return process.env.NODE_ENV === "production";
}

// 라우트에서 한 줄로 쓰기 위한 헬퍼. 막아야 하면 429 응답을 돌려준다.
export function checkRate(
  req: Request,
  route: "generate" | "sketch",
  fromUserKey: boolean
): Response | null {
  if (!rateLimitEnabled()) return null;
  const limit = limitsFor(route, fromUserKey);
  const r = hit(`${route}:${fromUserKey ? "byok" : "srv"}:${clientIp(req)}`, limit, WINDOW_MS);
  if (r.ok) return null;
  return Response.json(
    {
      error: `요청이 너무 잦아요. ${r.retryAfterSec}초 뒤에 다시 시도해 주세요.`,
      rateLimited: true,
    },
    { status: 429, headers: { "retry-after": String(r.retryAfterSec) } }
  );
}
