import { Cut } from "./types";
import { mockSketchDataUrl } from "./mockSketch";
import { AspectId, DEFAULT_ASPECT, ImageStyleId } from "./formats";
import { ImageProviderId } from "./providers";
import { keyHeader } from "./keys";

export interface SketchResult {
  url: string;
  // 그림을 실제로 만든 주체. 요청한 provider와 다를 수 있다 —
  // 원격 생성이 실패하면 서버가 "mock-fallback"으로 임시 그림을 돌려준다.
  // 이 값을 버리면 폴백이 조용히 묻혀서 "생성이 안 된다"로 보인다.
  provider: string;
}

export interface SketchOptions {
  variant?: number; // 재생성 횟수 (같은 컷을 다르게 뽑기 위한 salt)
  aspect?: AspectId;
  provider?: ImageProviderId;
  style?: ImageStyleId; // 러프 스케치 / 실사
  userKey?: string; // 사용자가 넣은 키. 없으면 서버 키로 동작한다.
}

// 이미지 생성 진입점. provider에 따라 분기한다.
// - "mock"(기본): 클라이언트에서 즉시 SVG data URL 생성 (비용 0, 네트워크 X)
// - 그 외: 서버 라우트(/api/sketch)로 위임 (키는 서버에만)
//
// 위치 인자로 두지 않는 이유: 문자열 인자만 넷이라(aspect/provider/style/key)
// 순서를 바꿔 넣어도 호출부에서 눈에 안 띈다.
export async function generateSketch(
  cut: Cut,
  {
    variant = 0,
    aspect = DEFAULT_ASPECT,
    provider = "mock",
    style,
    userKey,
  }: SketchOptions = {}
): Promise<SketchResult> {
  // mock은 서버를 거칠 이유가 없다(그림을 여기서 바로 그린다).
  if (provider === "mock") {
    // 살짝의 지연을 줘서 "생성 중" 상태가 보이게 (UX용, 없어도 무방)
    await new Promise((res) => setTimeout(res, 120));
    return { url: mockSketchDataUrl(cut, variant, aspect), provider: "mock" };
  }

  const res = await fetch("/api/sketch", {
    method: "POST",
    // 키는 본문이 아니라 헤더로 보낸다(본문은 로그에 통째로 찍히기 쉽다).
    headers: { "content-type": "application/json", ...keyHeader(userKey) },
    body: JSON.stringify({ cut, variant, aspect, provider, style }),
  });
  if (!res.ok) {
    // 요청 제한(429)은 "생성 실패"와 다르다. 조용히 mock으로 떨어뜨리면
    // 사용자는 왜 그림이 안 나오는지 알 수 없다.
    const j = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(j?.error || `이미지 생성 실패 (${res.status})`);
  }
  const json = (await res.json()) as { url?: string; provider?: string };
  if (!json.url) throw new Error("이미지 URL이 응답에 없어요.");
  return { url: json.url, provider: json.provider || provider };
}
