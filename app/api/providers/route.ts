import { NextResponse } from "next/server";
import { TextProviderId } from "@/lib/providers";
import { serverKeyedServices } from "@/lib/providers.server";

// 화면이 "무엇을 고를 수 있고, 내 키를 넣어야 하는지"를 판단하는 데 필요한 정보.
//
// 내보내는 건 서비스 "이름(id)"뿐이다 — 키 값은 절대 나가지 않는다.
// serverKeyed에 있으면 서버가 자기 키로 돌려주므로 사용자는 키를 안 넣어도 되고,
// 없으면 사용자가 자기 키를 넣어야 그 서비스를 쓸 수 있다(BYOK).
export const dynamic = "force-dynamic"; // 키 유무는 런타임 상태다. 캐시하면 안 된다.

export function GET() {
  // NEXT_PUBLIC_TEXT_PROVIDER=none은 여전히 "자동 생성 전체 끄기" 스위치다.
  const textOff =
    ((process.env.NEXT_PUBLIC_TEXT_PROVIDER || "none") as TextProviderId) ===
    "none";

  return NextResponse.json({
    // 서버가 이미 키를 가진 서비스 (사용자 키 불필요)
    serverKeyed: serverKeyedServices(),
    textEnabled: !textOff,
    defaults: {
      text: process.env.NEXT_PUBLIC_TEXT_PROVIDER || "none",
      image: process.env.NEXT_PUBLIC_IMAGE_PROVIDER || "mock",
    },
  });
}
