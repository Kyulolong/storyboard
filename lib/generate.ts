import { Cut } from "./types";
import { AspectId, FormatId } from "./formats";
import { LlmProviderId } from "./providers";
import { keyHeader } from "./keys";

// Groq 무료 한도 초과(429) 전용 에러 → UI에서 마법 프롬프트로 유도할 때 구분용.
export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

// 아이디어 한 줄 → 콘티 자동 생성 (서버의 Groq 라우트 호출).
export async function generateConti(
  idea: string,
  format: FormatId,
  aspect: AspectId,
  provider: LlmProviderId,
  // 사용자가 넣은 키. 없으면 헤더를 안 붙이고 서버 키로 동작한다.
  userKey?: string
): Promise<Cut[]> {
  const res = await fetch("/api/generate", {
    method: "POST",
    // 키는 본문이 아니라 헤더로 보낸다(본문은 로그에 통째로 찍히기 쉽다).
    headers: { "content-type": "application/json", ...keyHeader(userKey) },
    body: JSON.stringify({ idea, format, aspect, provider }),
  });
  const json = (await res.json()) as {
    cuts?: Cut[];
    error?: string;
    rateLimited?: boolean;
  };
  if (res.status === 429 || json.rateLimited) {
    throw new RateLimitError(json.error || "자동 생성이 잠시 붐벼요.");
  }
  if (!res.ok) throw new Error(json.error || "자동 생성에 실패했어요.");
  if (!json.cuts || json.cuts.length === 0) throw new Error("생성된 컷이 없어요.");
  return json.cuts;
}
