import { Cut } from "./types";
import { mockSketchDataUrl } from "./mockSketch";

// 이미지 생성 진입점. provider에 따라 분기한다.
// - "mock"(기본): 클라이언트에서 즉시 SVG data URL 생성 (비용 0, 네트워크 X)
// - "fal": 서버 라우트(/api/sketch)로 위임 → FLUX schnell 호출 (키는 서버에만)
export async function generateSketch(cut: Cut, variant = 0): Promise<string> {
  const provider = process.env.NEXT_PUBLIC_IMAGE_PROVIDER || "mock";

  if (provider === "mock") {
    // 살짝의 지연을 줘서 "생성 중" 상태가 보이게 (UX용, 없어도 무방)
    await new Promise((res) => setTimeout(res, 120));
    return mockSketchDataUrl(cut, variant);
  }

  const res = await fetch("/api/sketch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cut, variant }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`이미지 생성 실패 (${res.status}) ${msg}`);
  }
  const json = (await res.json()) as { url?: string };
  if (!json.url) throw new Error("이미지 URL이 응답에 없어요.");
  return json.url;
}
