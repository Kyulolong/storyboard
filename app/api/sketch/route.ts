import { NextRequest, NextResponse } from "next/server";
import { Cut } from "@/lib/types";
import { mockSketchDataUrl } from "@/lib/mockSketch";

// 모든 컷에 공통으로 강제하는 스타일 프롬프트.
// 목표: 디테일 죽이고 "졸라맨 낙서" 수준 — 형태·구도·핵심 소품만 알아보게.
// 주의: "storyboard" 단어는 FLUX가 여러 칸 시트를 그리게 만들어 금지. 단일 프레임 강제.
const STYLE =
  "minimal black ink line drawing, stick figure people, basic shapes, " +
  "thick outlines, flat, no shading, no texture, no fine detail, crude quick doodle, " +
  "plain white background, show the whole scene and key props. " +
  "single image, one frame only, no grid, no panels, no split, no text, no borders";

function buildPrompt(cut: Cut): string {
  const shot = cut.shot ? ` (${cut.shot})` : "";
  // 장면/소품을 주어로 명확히 앞세워 준수도를 높인다.
  return `A simple rough doodle sketch of: ${cut.description}${shot}. ${STYLE}`;
}

// 원격 이미지를 받아 data URL(base64)로 인코딩.
// => <img>가 same-origin이 되어 "이미지로 저장(html-to-image)" 시 재요청/CORS/오염이 사라짐.
async function toDataUrl(res: Response): Promise<string> {
  const ct = res.headers.get("content-type") || "image/jpeg";
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:${ct};base64,${buf.toString("base64")}`;
}

async function fetchAsDataUrl(remote: string): Promise<string | null> {
  try {
    const r = await fetch(remote);
    if (!r.ok) return null;
    return await toDataUrl(r);
  } catch {
    return null;
  }
}

// ---- Pollinations: 키/결제 없이 무료. FLUX 기반. ----
// 서버가 이미지를 받아 data URL로 반환한다(원격 URL을 그대로 주면 저장 시 재요청→실패).
async function viaPollinations(cut: Cut, variant: number): Promise<string | null> {
  const prompt = encodeURIComponent(buildPrompt(cut));
  const seed = (Math.abs(cut.no) * 100003 + variant) % 1_000_000;
  // 작은 해상도 = 더 빠름. enhance=false = 프롬프트에 디테일 안 붙임(단순 유지).
  const url = `https://image.pollinations.ai/prompt/${prompt}?width=360&height=640&model=flux&nologo=true&enhance=false&seed=${seed}`;

  // 무료 티어는 붐비면 429/5xx가 나거나 응답이 오래 매달린다.
  // → 요청마다 타임아웃을 걸고, 몇 번 재시도 후에야 mock으로 폴백한다.
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25_000);
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      if (r.ok) {
        return await toDataUrl(r); // 바로 data URL로 (재요청 불필요)
      }
      console.error("pollinations error", r.status, "attempt", attempt);
    } catch (e) {
      console.error("pollinations exception", (e as Error)?.name, "attempt", attempt);
    } finally {
      clearTimeout(timer);
    }
    await new Promise((res) => setTimeout(res, 1200 * (attempt + 1)));
  }
  return null;
}

// ---- Replicate: black-forest-labs/flux-schnell (저비용·고속) ----
async function viaReplicate(cut: Cut, token: string): Promise<string | null> {
  // Prefer: wait → 예측이 끝날 때까지(최대 60s) 한 번의 요청으로 대기.
  const res = await fetch(
    "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({
        input: {
          prompt: buildPrompt(cut),
          aspect_ratio: "9:16", // 세로 릴스
          num_outputs: 1,
          output_format: "webp",
          go_fast: true,
        },
      }),
    }
  );

  if (!res.ok) {
    console.error("replicate error", res.status, await res.text().catch(() => ""));
    return null;
  }

  let data = (await res.json()) as {
    status?: string;
    output?: string | string[];
    error?: unknown;
    urls?: { get?: string };
  };

  // Prefer:wait로도 아직 진행 중이면 몇 번 폴링 (안전망).
  let tries = 0;
  while (
    data.status &&
    !["succeeded", "failed", "canceled"].includes(data.status) &&
    data.urls?.get &&
    tries < 15
  ) {
    await new Promise((r) => setTimeout(r, 800));
    const poll = await fetch(data.urls.get, {
      headers: { Authorization: `Bearer ${token}` },
    });
    data = await poll.json();
    tries++;
  }

  if (data.status !== "succeeded") {
    console.error("replicate not succeeded:", data.status, data.error);
    return null;
  }

  const out = data.output;
  return Array.isArray(out) ? out[0] ?? null : typeof out === "string" ? out : null;
}

// ---- fal: fal-ai/flux/schnell ----
async function viaFal(cut: Cut, key: string): Promise<string | null> {
  const res = await fetch("https://fal.run/fal-ai/flux/schnell", {
    method: "POST",
    headers: {
      Authorization: `Key ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: buildPrompt(cut),
      image_size: "portrait_16_9", // 세로 9:16
      num_inference_steps: 4,
      num_images: 1,
      enable_safety_checker: true,
    }),
  });
  if (!res.ok) {
    console.error("fal error", res.status, await res.text().catch(() => ""));
    return null;
  }
  const data = (await res.json()) as { images?: { url: string }[] };
  return data.images?.[0]?.url ?? null;
}

export async function POST(req: NextRequest) {
  let cut: Cut;
  let variant = 0;
  try {
    const body = await req.json();
    cut = body.cut;
    variant = Number(body.variant) || 0;
    if (!cut || !cut.description) {
      return NextResponse.json({ error: "cut.description 필요" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const provider = process.env.NEXT_PUBLIC_IMAGE_PROVIDER || "mock";

  try {
    let url: string | null = null;

    if (provider === "pollinations") {
      url = await viaPollinations(cut, variant); // 이미 data URL
    } else if (provider === "replicate" && process.env.REPLICATE_API_TOKEN) {
      const remote = await viaReplicate(cut, process.env.REPLICATE_API_TOKEN);
      url = remote ? (await fetchAsDataUrl(remote)) ?? remote : null;
    } else if (provider === "fal" && process.env.FAL_KEY) {
      const remote = await viaFal(cut, process.env.FAL_KEY);
      url = remote ? (await fetchAsDataUrl(remote)) ?? remote : null;
    }

    if (url) return NextResponse.json({ url, provider });

    // 어떤 이유로든 실패하면 mock으로 폴백 → 콘티가 끊기지 않는다.
    return NextResponse.json({
      url: mockSketchDataUrl(cut),
      provider: "mock-fallback",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({
      url: mockSketchDataUrl(cut),
      provider: "mock-fallback",
    });
  }
}
