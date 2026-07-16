import { NextRequest, NextResponse } from "next/server";
import { Cut } from "@/lib/types";
import { mockSketchDataUrl } from "@/lib/mockSketch";
import {
  Aspect,
  AspectId,
  ImageStyle,
  buildImagePrompt,
  getAspect,
  getImageStyle,
} from "@/lib/formats";
import {
  IMAGE_PROVIDERS,
  ImageProviderId,
  isImageProviderId,
  serviceForImage,
} from "@/lib/providers";
import {
  baseUrlFor,
  insecureKeyTransport,
  resolveKey,
  scrub,
} from "@/lib/providers.server";
import { checkRate } from "@/lib/ratelimit";

// Vercel 함수 실행 상한(초). Hobby는 기본/최대가 300초라 늘릴 필요는 없고,
// 폭주를 막으려고 오히려 낮춰 잡는다. pollinations 예산(100초)보다는 넉넉해야 한다.
export const maxDuration = 120;

// Vercel 함수의 응답 본문 상한은 4.5MB다(초과 시 플랫폼이 413으로 끊는다).
// 우리는 이미지를 base64 data URL로 그대로 실어 보내므로 큰 그림은 이 선을 넘을 수 있다.
// JSON 오버헤드 여유를 두고 우리가 먼저 재서, 넘치면 mock으로 내려앉힌다.
const MAX_IMAGE_BYTES = 3_500_000;

// 프롬프트는 그림 느낌 프리셋(lib/formats.ts)에서 만든다.
// 스타일 문구와 "단일 프레임 강제" 규칙이 거기 함께 있어야 어긋나지 않는다.
function buildPrompt(cut: Cut, style: ImageStyle): string {
  return buildImagePrompt(cut.description, cut.shot, style);
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

// 무료 티어는 한가하면 2초, 붐비면 45초 넘게 걸린다(실측).
// 개별 타임아웃이 이 꼬리보다 짧으면 멀쩡한 응답을 끊고 mock으로 떨어뜨리게 된다.
const POLLINATIONS_TIMEOUT_MS = 60_000;
// 다만 컷마다 60초×3회를 다 기다리면 보드 전체가 하염없이 멈춘다.
// → 컷당 총 소요를 이 예산 안으로 묶고, 예산이 다하면 즉시 mock으로 넘긴다.
const POLLINATIONS_BUDGET_MS = 100_000;

async function viaPollinations(
  cut: Cut,
  variant: number,
  aspect: Aspect,
  style: ImageStyle
): Promise<string | null> {
  const prompt = encodeURIComponent(buildPrompt(cut, style));
  const seed = (Math.abs(cut.no) * 100003 + variant) % 1_000_000;
  // 작은 해상도 = 더 빠름. enhance는 스타일을 따른다 —
  // 낙서는 덧붙이면 복잡해지고, 실사는 덧붙는 게 이득이다.
  const url = `https://image.pollinations.ai/prompt/${prompt}?width=${aspect.w}&height=${aspect.h}&model=flux&nologo=true&enhance=${style.enhance}&seed=${seed}`;

  const deadline = Date.now() + POLLINATIONS_BUDGET_MS;

  // 붐비면 429/5xx가 나거나 응답이 오래 매달린다.
  // → 요청마다 타임아웃을 걸고, 몇 번 재시도 후에야 mock으로 폴백한다.
  for (let attempt = 0; attempt < 3; attempt++) {
    const left = deadline - Date.now();
    if (left <= 0) break;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), Math.min(POLLINATIONS_TIMEOUT_MS, left));
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

    // 백오프까지 기다리면 예산을 넘길 상황이면 더 끌지 않고 폴백.
    const backoff = 1200 * (attempt + 1);
    if (Date.now() + backoff >= deadline) break;
    await new Promise((res) => setTimeout(res, backoff));
  }
  return null;
}

// ---- Gemini: Interactions API로 이미지 생성 ----
// 우리가 쓰는 화면비 4종(9:16 / 4:5 / 1:1 / 16:9)을 aspect_ratio로 그대로 받아준다.
async function viaGemini(
  cut: Cut,
  aspect: Aspect,
  style: ImageStyle,
  key: string
): Promise<string | null> {
  const res = await fetch(`${baseUrlFor("gemini")}/interactions`, {
    method: "POST",
    headers: {
      "x-goog-api-key": key,
      "Content-Type": "application/json",
      "Api-Revision": "2026-05-20", // 응답 스키마 고정 (generate 라우트와 동일)
    },
    body: JSON.stringify({
      model: process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image",
      input: [{ type: "text", text: buildPrompt(cut, style) }],
      response_format: {
        type: "image",
        mime_type: "image/jpeg",
        aspect_ratio: aspect.gemini,
        image_size: "1K", // 러프 낙서라 1K면 충분. 크게 뽑을수록 느리고 비싸다.
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("gemini image error", res.status, scrub(body.slice(0, 400), key));
    return null;
  }
  const data = (await res.json()) as {
    steps?: { content?: { type?: string; data?: string; mime_type?: string }[] }[];
    outputs?: { type?: string; data?: string; mime_type?: string }[];
  };
  // 개정에 따라 steps(신규) / outputs(구) 둘 다 올 수 있다.
  const parts = [
    ...(data.steps?.flatMap((s) => s.content ?? []) ?? []),
    ...(data.outputs ?? []),
  ];
  const img = parts.find((c) => c?.type === "image" && c?.data);
  if (!img?.data) {
    console.error("gemini image: 응답에 이미지가 없음");
    return null;
  }
  return `data:${img.mime_type || "image/jpeg"};base64,${img.data}`;
}

// ---- OpenAI: gpt-image-2 ----
// size는 화면비 프리셋이 계산해 둔 값(16의 배수 + 픽셀 수 제약)을 쓴다.
async function viaOpenAIImage(
  cut: Cut,
  aspect: Aspect,
  style: ImageStyle,
  key: string
): Promise<string | null> {
  const res = await fetch(`${baseUrlFor("openai")}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
      prompt: buildPrompt(cut, style),
      size: aspect.openai,
      n: 1,
      // 기본값 PNG는 이 해상도에서 수 MB가 나와 4.5MB 응답 상한에 닿는다.
      // 어차피 러프 낙서라 JPEG로 충분하고, 전송도 훨씬 빠르다.
      output_format: "jpeg",
      output_compression: 80,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("openai image error", res.status, scrub(body.slice(0, 400), key));
    return null;
  }
  const data = (await res.json()) as {
    data?: { b64_json?: string; url?: string }[];
  };
  const first = data.data?.[0];
  if (first?.b64_json) return `data:image/jpeg;base64,${first.b64_json}`;
  // url로 오는 경우엔 우리가 받아서 data URL로 바꾼다(저장 시 재요청을 막기 위해).
  return first?.url ? await fetchAsDataUrl(first.url) : null;
}

// ---- Replicate: black-forest-labs/flux-schnell (저비용·고속) ----
async function viaReplicate(
  cut: Cut,
  token: string,
  aspect: Aspect,
  style: ImageStyle
): Promise<string | null> {
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
          prompt: buildPrompt(cut, style),
          aspect_ratio: aspect.replicate,
          num_outputs: 1,
          output_format: "webp",
          go_fast: true,
        },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("replicate error", res.status, scrub(body.slice(0, 400), token));
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
async function viaFal(
  cut: Cut,
  key: string,
  aspect: Aspect,
  style: ImageStyle
): Promise<string | null> {
  const res = await fetch("https://fal.run/fal-ai/flux/schnell", {
    method: "POST",
    headers: {
      Authorization: `Key ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: buildPrompt(cut, style),
      image_size: aspect.fal,
      num_inference_steps: 4,
      num_images: 1,
      enable_safety_checker: true,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("fal error", res.status, scrub(body.slice(0, 400), key));
    return null;
  }
  const data = (await res.json()) as { images?: { url: string }[] };
  return data.images?.[0]?.url ?? null;
}

export async function POST(req: NextRequest) {
  let cut: Cut;
  let variant = 0;
  let aspectId: AspectId | undefined;
  let style: ImageStyle = getImageStyle();
  let requested: unknown;
  try {
    const body = await req.json();
    cut = body.cut;
    variant = Number(body.variant) || 0;
    requested = body.provider;
    // 모르는 값이 와도 getAspect/getImageStyle이 기본값으로 정규화한다.
    aspectId = getAspect(body.aspect).id;
    style = getImageStyle(body.style);
    if (!cut || !cut.description) {
      return NextResponse.json({ error: "cut.description 필요" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  // 평문 HTTP로 사용자 키가 오면 쓰지 않고 막는다. 중간에서 그대로 읽힌다.
  if (insecureKeyTransport(req)) {
    return NextResponse.json(
      { error: "보안 연결(HTTPS)에서만 키를 보낼 수 있어요." },
      { status: 400 }
    );
  }

  // env 값은 기본 선택일 뿐이고, 화면에서 고른 값이 우선한다.
  // 아는 provider일 때만 받는다(임의 문자열로 분기가 흔들리지 않게).
  const provider: ImageProviderId = isImageProviderId(requested)
    ? requested
    : ((process.env.NEXT_PUBLIC_IMAGE_PROVIDER || "mock") as ImageProviderId);
  const aspect = getAspect(aspectId);

  // 키가 필요한 provider면 사용자 키(헤더) → 서버 키 순으로 찾는다.
  // 이 key는 이 요청 처리 동안만 사는 지역 변수다 — 저장하지 않는다.
  const service = serviceForImage(provider);
  const resolved = service ? resolveKey(service, req) : undefined;
  const key = resolved?.key;

  // mock은 서버를 거의 안 쓰지만 pollinations/원격 생성은 비싸다.
  // 키를 확인한 뒤 BYOK 여부에 맞는 허용량으로 검사한다.
  const limited = checkRate(req, "sketch", !!resolved?.fromUser);
  if (limited) return limited;

  try {
    let url: string | null = null;

    if (provider === "pollinations") {
      url = await viaPollinations(cut, variant, aspect, style); // 이미 data URL
    } else if (provider === "gemini" && key) {
      url = await viaGemini(cut, aspect, style, key); // base64 → data URL
    } else if (provider === "openai" && key) {
      url = await viaOpenAIImage(cut, aspect, style, key);
    } else if (provider === "replicate" && key) {
      const remote = await viaReplicate(cut, key, aspect, style);
      url = remote ? (await fetchAsDataUrl(remote)) ?? remote : null;
    } else if (provider === "fal" && key) {
      const remote = await viaFal(cut, key, aspect, style);
      url = remote ? (await fetchAsDataUrl(remote)) ?? remote : null;
    }

    // 너무 크면 플랫폼이 413으로 끊어버려 사용자는 이유도 모른 채 실패한다.
    // 그럴 바엔 mock으로 내려앉히고 "임시 그림" 배지로 알린다.
    if (url && url.length > MAX_IMAGE_BYTES) {
      console.error(
        `sketch payload too large: ${provider} ${url.length}B > ${MAX_IMAGE_BYTES}B — mock으로 대체`
      );
      url = null;
    }

    if (url) return NextResponse.json({ url, provider });

    // 어떤 이유로든 실패하면 mock으로 폴백 → 콘티가 끊기지 않는다.
    // 폴백 그림도 같은 화면비여야 보드 격자가 흐트러지지 않는다.
    return NextResponse.json({
      url: mockSketchDataUrl(cut, variant, aspectId),
      provider: "mock-fallback",
    });
  } catch (e) {
    console.error("sketch exception", scrub(String(e), key));
    return NextResponse.json({
      url: mockSketchDataUrl(cut, variant, aspectId),
      provider: "mock-fallback",
    });
  }
}
