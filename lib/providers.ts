// provider 목록의 단일 출처 — 메타데이터만 둔다(클라이언트에서 import해도 안전).
// 키를 읽거나 API를 호출하는 코드는 lib/providers.server.ts와 app/api/*에만 있다.
// envKey는 "무슨 키가 필요한지" 알려주는 이름일 뿐, 값이 아니다.

// ── 서비스 (키의 단위) ────────────────────────────────────────────────────
// 텍스트/이미지를 따로 나열하지 않고 여기서 한 번만 정의한다.
// Gemini 하나로 글도 그림도 만드는데, 목록이 갈라져 있으면
// 사용자에게 같은 키를 두 번 받게 된다.
export type ServiceId = "groq" | "gemini" | "openai" | "replicate" | "fal";

export interface Service {
  id: ServiceId;
  label: string;
  envKey: string; // 서버가 읽는 환경변수 이름 (안내용, 값이 아님)
  keyUrl: string;
  free: boolean; // 카드 없이 무료 한도로 쓸 수 있는지
  keyHint: string; // 키 입력칸 placeholder
}

export const SERVICES: Record<ServiceId, Service> = {
  groq: {
    id: "groq",
    label: "Groq",
    envKey: "GROQ_API_KEY",
    keyUrl: "https://console.groq.com/keys",
    free: true,
    keyHint: "gsk_…",
  },
  gemini: {
    id: "gemini",
    label: "Gemini",
    envKey: "GEMINI_API_KEY",
    keyUrl: "https://aistudio.google.com/apikey",
    free: true,
    keyHint: "AIza…",
  },
  openai: {
    id: "openai",
    label: "ChatGPT (OpenAI)",
    envKey: "OPENAI_API_KEY",
    keyUrl: "https://platform.openai.com/api-keys",
    free: false,
    keyHint: "sk-…",
  },
  replicate: {
    id: "replicate",
    label: "Replicate",
    envKey: "REPLICATE_API_TOKEN",
    keyUrl: "https://replicate.com/account/api-tokens",
    free: false,
    keyHint: "r8_…",
  },
  fal: {
    id: "fal",
    label: "fal",
    envKey: "FAL_KEY",
    keyUrl: "https://fal.ai/dashboard/keys",
    free: false,
    keyHint: "키를 붙여넣으세요",
  },
};

export const SERVICE_IDS = Object.keys(SERVICES) as ServiceId[];

export function isServiceId(v: unknown): v is ServiceId {
  return typeof v === "string" && v in SERVICES;
}

// ── 텍스트 자동생성 ────────────────────────────────────────────────────────
// 글을 만들 수 있는 서비스. "none"은 자동 생성 전체 끄기 스위치다.
export type LlmProviderId = Extract<ServiceId, "groq" | "openai" | "gemini">;
export type TextProviderId = "none" | LlmProviderId;

export const TEXT_PROVIDER_IDS: LlmProviderId[] = ["groq", "gemini", "openai"];

export function isLlmProviderId(v: unknown): v is LlmProviderId {
  return typeof v === "string" && (TEXT_PROVIDER_IDS as string[]).includes(v);
}

// ── 이미지 생성 ────────────────────────────────────────────────────────────
// Groq는 이미지를 만들지 않으므로 여기엔 없다(서비스 목록과 다른 부분).
export type ImageProviderId =
  | "mock"
  | "pollinations"
  | Extract<ServiceId, "gemini" | "openai" | "replicate" | "fal">;

// ── 비용 ──────────────────────────────────────────────────────────────────
// 가격표는 자주 바뀌고 환율은 매일 움직인다. "지금 이 값이 맞다"고 말할 수 없으므로
// 기준일과 근거를 같이 박아두고, 화면에도 "약"으로만 표기한다.
// 값을 고칠 때는 아래 출처를 다시 확인할 것.
export const PRICED_AT = "2026-07"; // 아래 단가·환율을 확인한 시점
export const USD_TO_KRW = 1490; // 2026-07-14 기준. 최근 한 달 1,490~1,549 사이로 움직였다.

export interface ImageCost {
  usdPerCut: number; // 컷 하나당 예상 비용(USD). 0이면 무료.
  tokensPerCut?: number; // 토큰으로 과금하는 provider만.
  // 이 숫자를 얼마나 믿을 수 있는지. 화면의 툴팁으로 그대로 나간다.
  note: string;
}

export interface ImageProvider {
  id: ImageProviderId;
  label: string;
  hint: string;
  // 키가 필요하면 어떤 서비스의 키인지. 없으면 키 없이 쓴다(mock/pollinations).
  service?: ServiceId;
  cost: ImageCost;
}

// 컷 하나당 예상 금액(원). 반올림해서 사람이 읽는 숫자로.
export function krwPerCut(id: ImageProviderId): number {
  return Math.round(IMAGE_PROVIDERS[id].cost.usdPerCut * USD_TO_KRW);
}

// 칩에 붙는 짧은 비용 문구.
export function costLabel(id: ImageProviderId): string {
  const c = IMAGE_PROVIDERS[id].cost;
  if (c.usdPerCut === 0) return "무료";
  const krw = krwPerCut(id);
  const tok = c.tokensPerCut ? ` · ${c.tokensPerCut.toLocaleString()}토큰` : "";
  return `약 ${krw.toLocaleString()}원/컷${tok}`;
}

export const IMAGE_PROVIDERS: Record<ImageProviderId, ImageProvider> = {
  mock: {
    id: "mock",
    label: "mock",
    hint: "낙서 · 네트워크 안 씀",
    cost: { usdPerCut: 0, note: "브라우저에서 직접 그립니다. 아무 데도 요청하지 않아요." },
  },
  pollinations: {
    id: "pollinations",
    label: "Pollinations",
    hint: "키 불필요",
    cost: { usdPerCut: 0, note: "무료 서비스예요. 대신 붐비면 느리고 가끔 실패합니다." },
  },
  gemini: {
    id: "gemini",
    label: "Gemini",
    hint: "무료 한도 있음",
    service: "gemini",
    // gemini-3.1-flash-image: 1K 이미지 = 1,120 토큰, 출력 $60/1M → $0.067/장.
    cost: {
      usdPerCut: 0.067,
      tokensPerCut: 1120,
      note: "gemini-3.1-flash-image 기준(1K = 1,120토큰, $60/1M). 무료 한도 안에서는 0원이에요.",
    },
  },
  openai: {
    id: "openai",
    label: "ChatGPT",
    hint: "유료",
    service: "openai",
    // gpt-image-2 세로 이미지 medium 화질 ≈ $0.041/장.
    // 우리는 임의 해상도(720x1280 등)를 쓰고 quality를 안 넘겨서 정확한 토큰 수를
    // 미리 알 수 없다 → 공개된 세로 medium 예시값을 그대로 쓴다. 화질이 auto로
    // 높게 잡히면 4배까지 오를 수 있어 note로 알린다.
    cost: {
      usdPerCut: 0.041,
      note: "gpt-image-2 세로 medium 화질 기준이에요. 화질이 높게 잡히면 4배까지 오를 수 있어요.",
    },
  },
  replicate: {
    id: "replicate",
    label: "Replicate",
    hint: "유료",
    service: "replicate",
    // flux-schnell ≈ $0.003/장. GPU 초당 과금이라 실제론 조금씩 달라진다.
    cost: {
      usdPerCut: 0.003,
      note: "flux-schnell 기준이에요. GPU 시간으로 재는 방식이라 조금씩 달라집니다.",
    },
  },
  fal: {
    id: "fal",
    label: "fal",
    hint: "유료",
    service: "fal",
    // $0.003/메가픽셀, 올림. 우리 이미지는 1MP 미만이라 1MP로 올라간다.
    cost: {
      usdPerCut: 0.003,
      note: "flux-schnell 기준이에요($0.003/메가픽셀). 우리 그림은 1메가픽셀 미만이라 1장 = 1메가픽셀로 계산돼요.",
    },
  },
};

export const IMAGE_PROVIDER_IDS = Object.keys(
  IMAGE_PROVIDERS
) as ImageProviderId[];

export function isImageProviderId(v: unknown): v is ImageProviderId {
  return typeof v === "string" && v in IMAGE_PROVIDERS;
}

// 이 provider를 쓰려면 어떤 서비스의 키가 필요한가 (없으면 키 불필요).
export function serviceForImage(id: ImageProviderId): ServiceId | undefined {
  return IMAGE_PROVIDERS[id]?.service;
}

// 사용자 키를 실어 보내는 헤더 이름.
// 본문(JSON)이 아니라 헤더에 싣는 이유: 본문은 파싱/검증/에러 경로에서
// 통째로 로그에 찍히기 쉽다. 헤더로 두면 "본문은 절대 안 찍는다"는 규칙만
// 지켜도 키가 로그에 남을 길이 크게 줄어든다.
export const KEY_HEADER = "x-provider-key";
