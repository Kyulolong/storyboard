import { Cut } from "./types";

// Groq 무료 한도 초과(429) 전용 에러 → UI에서 마법 프롬프트로 유도할 때 구분용.
export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

// 아이디어 한 줄 → 콘티 자동 생성 (서버의 Groq 라우트 호출).
export async function generateConti(idea: string): Promise<Cut[]> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idea }),
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

// 자동 생성 사용 가능 여부(클라이언트에서 provider 플래그로 판단).
export function autoGenEnabled(): boolean {
  return (process.env.NEXT_PUBLIC_TEXT_PROVIDER || "none") === "groq";
}
