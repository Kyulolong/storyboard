// 서버 전용. API 키를 만지는 코드는 전부 여기 모아둔다.
//
// lib/providers.ts(메타데이터)와 나눈 이유:
// provider 선택 UI가 라벨을 쓰려면 메타데이터를 클라이언트에서 import해야 하는데,
// 그 모듈이 process.env.GROQ_API_KEY 같은 걸 만지고 있으면 키를 다루는 코드가
// 클라이언트 번들 쪽으로 딸려간다. 아예 파일을 갈라서 그럴 일을 없앤다.
// => 이 파일은 app/api/* (서버)에서만 import할 것.
//
// BYOK(사용자가 자기 키를 넣는 방식) 규칙:
//  - 키는 요청 헤더로 받아서 그 요청 안에서만 쓰고 버린다. 저장하지 않는다.
//  - 어떤 경로로도 로그에 남기지 않는다(본문 미로깅 + 아래 scrub).
//  - 응답에 키를 되돌려 보내지 않는다.

import { KEY_HEADER, SERVICES, ServiceId } from "./providers";

// 베이스 URL은 덮어쓸 수 있게 열어둔다.
// 사내 프록시/게이트웨이(LiteLLM 등)를 태우거나, 테스트에서 가짜 업스트림을
// 물릴 때 필요하다. 값이 없으면 각 provider의 공식 주소를 쓴다.
export const DEFAULT_BASE = {
  groq: "https://api.groq.com/openai/v1",
  openai: "https://api.openai.com/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta",
} as const;

export function baseUrlFor(id: "groq" | "openai" | "gemini"): string {
  const override =
    id === "groq"
      ? process.env.GROQ_BASE_URL
      : id === "openai"
      ? process.env.OPENAI_BASE_URL
      : process.env.GEMINI_BASE_URL;
  return (override || DEFAULT_BASE[id]).replace(/\/+$/, "");
}

// 서버가 자기 키를 갖고 있는지. 정적으로 참조한다 —
// process.env[변수]처럼 동적으로 읽으면 번들러가 값을 못 넣어주는 경우가 있다.
export function serverKeyFor(id: ServiceId): string | undefined {
  const v =
    id === "groq"
      ? process.env.GROQ_API_KEY
      : id === "gemini"
      ? process.env.GEMINI_API_KEY
      : id === "openai"
      ? process.env.OPENAI_API_KEY
      : id === "replicate"
      ? process.env.REPLICATE_API_TOKEN
      : process.env.FAL_KEY;
  return v?.trim() || undefined; // 빈 문자열은 "키 없음"과 같다
}

// 서버 키가 이미 있는 서비스 목록. 이 목록만 클라이언트로 나간다(키 값이 아니라).
// => 사용자가 "내 키를 넣어야 하는지" 판단할 수 있게 하는 최소 정보.
export function serverKeyedServices(): ServiceId[] {
  return (Object.keys(SERVICES) as ServiceId[]).filter((id) => !!serverKeyFor(id));
}

// 요청에서 사용자 키를 꺼낸다. 반환값은 이 요청 처리 동안만 살아 있는 지역 변수다.
// 절대 캐시/전역/DB에 넣지 말 것.
export function userKeyFrom(req: Request): string | undefined {
  return req.headers.get(KEY_HEADER)?.trim() || undefined;
}

// 이 요청에 쓸 키: 사용자 키가 있으면 그걸, 없으면 서버 키(자체 호스팅용).
export function resolveKey(
  id: ServiceId,
  req: Request
): { key?: string; fromUser: boolean } {
  const user = userKeyFrom(req);
  if (user) return { key: user, fromUser: true };
  return { key: serverKeyFor(id), fromUser: false };
}

// 로그/에러 문자열에서 비밀값을 지운다.
// 업스트림이 에러 본문에 키를 되비추는 경우가 있어서, 로그로 넘기기 전에 한 번 거른다.
export function scrub(text: string, ...secrets: (string | undefined)[]): string {
  let out = text;
  for (const s of secrets) {
    if (s && s.length >= 8) out = out.split(s).join("[REDACTED]");
  }
  // 혹시 못 걸러낸 흔한 키 모양도 마스킹 (형태만 보고 지운다)
  return out
    .replace(/\b(sk|gsk|r8)_[A-Za-z0-9_-]{8,}/g, "$1_[REDACTED]")
    .replace(/\bAIza[A-Za-z0-9_-]{10,}/g, "AIza[REDACTED]");
}

// 프로덕션에서 평문 HTTP로 키가 오면 막는다.
// 중간에서 그대로 읽히는 경로로 사용자 키를 받는 건 사고다.
// localhost는 개발용이라 예외.
export function insecureKeyTransport(req: Request): boolean {
  if (!userKeyFrom(req)) return false; // 키가 없으면 볼 것도 없다
  if (process.env.NODE_ENV !== "production") return false;
  const proto = req.headers.get("x-forwarded-proto");
  const host = req.headers.get("host") || "";
  if (/^localhost(:|$)|^127\.0\.0\.1(:|$)/.test(host)) return false;
  // 프록시 뒤에서는 x-forwarded-proto가 진실이다. 없으면 URL로 판단.
  return proto ? proto.split(",")[0].trim() !== "https" : !req.url.startsWith("https:");
}
