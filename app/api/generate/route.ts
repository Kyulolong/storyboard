import { NextRequest, NextResponse } from "next/server";
import { parseContiJson } from "@/lib/parse";
import { getFormat, resolveAspect } from "@/lib/formats";
import { systemPromptFor } from "@/lib/magicPrompt";
import {
  SERVICES,
  TextProviderId,
  isLlmProviderId,
} from "@/lib/providers";
import {
  baseUrlFor,
  insecureKeyTransport,
  resolveKey,
  scrub,
} from "@/lib/providers.server";
import { checkRate } from "@/lib/ratelimit";

// Vercel 함수 실행 상한(초). Hobby는 기본 300초지만 LLM 한 번 부르는 데
// 그만큼 걸릴 일이 없다. 폭주를 막게 낮춰 잡는다.
export const maxDuration = 60;

// 무료 한도 초과(429)를 구분하기 위한 신호.
// UI가 이걸 보고 "마법 프롬프트로 만들기"로 유도한다.
class RateLimited extends Error {}

// provider가 뱉은 "원문 텍스트"만 돌려준다.
// JSON으로 만드는 건 아래 공통 파서(parseContiJson)가 맡는다 —
// 붙여넣기 경로와 똑같은 검증을 타야 결과가 어긋나지 않는다.

// ---- Groq: OpenAI 호환 chat completions ----
async function viaGroq(system: string, idea: string, key: string) {
  const res = await fetch(`${baseUrlFor("groq")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: `아이디어: ${idea}` },
      ],
    }),
  });
  if (!res.ok) throw await httpError("groq", res, key);
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? "";
}

// ---- OpenAI: Responses API ----
// chat/completions가 아니라 /responses를 쓴다. chat/completions는 문서상
// legacy로 내려갔고 신규 모델은 Responses 기준으로 안내된다.
async function viaOpenAI(system: string, idea: string, key: string) {
  const res = await fetch(`${baseUrlFor("openai")}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
      instructions: system, // Responses에서는 system 역할이 이 필드다
      input: `아이디어: ${idea}`,
      text: { format: { type: "json_object" } },
      store: false, // 콘티 아이디어를 서버에 남길 이유가 없다
    }),
  });
  if (!res.ok) throw await httpError("openai", res, key);
  const data = (await res.json()) as {
    output_text?: string;
    output?: { content?: { type?: string; text?: string }[] }[];
  };
  // output_text는 SDK 편의 속성이라 REST 응답엔 없을 수 있다 → output을 직접 훑는다.
  return (
    data.output_text ??
    data.output
      ?.flatMap((o) => o.content ?? [])
      .filter((c) => c?.type === "output_text" || typeof c?.text === "string")
      .map((c) => c.text ?? "")
      .join("") ??
    ""
  );
}

// ---- Gemini: Interactions API ----
async function viaGemini(system: string, idea: string, key: string) {
  const res = await fetch(`${baseUrlFor("gemini")}/interactions`, {
    method: "POST",
    headers: {
      "x-goog-api-key": key,
      "Content-Type": "application/json",
      // 응답 스키마를 고정한다. 안 박아두면 개정일에 맞춰
      // 응답 모양이 steps/outputs로 갈려서 파싱이 조용히 깨진다.
      "Api-Revision": "2026-05-20",
    },
    body: JSON.stringify({
      model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
      system_instruction: system,
      input: `아이디어: ${idea}`,
      response_format: { type: "text", mime_type: "application/json" },
      generation_config: { temperature: 0.7 },
    }),
  });
  if (!res.ok) throw await httpError("gemini", res, key);
  return readGeminiText(await res.json());
}

// Gemini 응답에서 텍스트만 뽑는다.
// 개정에 따라 steps(신규) / outputs(구)로 갈리므로 둘 다 받아준다.
function readGeminiText(data: unknown): string {
  const d = data as {
    output_text?: string;
    steps?: { content?: { type?: string; text?: string }[] }[];
    outputs?: { type?: string; text?: string }[];
  };
  if (typeof d.output_text === "string") return d.output_text;
  const fromSteps = d.steps
    ?.flatMap((s) => s.content ?? [])
    .filter((c) => c?.type === "text")
    .map((c) => c.text ?? "")
    .join("");
  if (fromSteps) return fromSteps;
  return (
    d.outputs
      ?.filter((o) => o?.type === "text")
      .map((o) => o.text ?? "")
      .join("") ?? ""
  );
}

// 업스트림 에러는 원인 파악에 필요하지만, 본문에 키가 되비칠 수 있다.
// 로그로 넘기기 전에 반드시 스크럽한다.
async function httpError(name: string, res: Response, key: string) {
  const body = await res.text().catch(() => "");
  console.error(`${name} error`, res.status, scrub(body.slice(0, 500), key));
  if (res.status === 429) return new RateLimited(name);
  return new Error(`${name} ${res.status}`);
}

export async function POST(req: NextRequest) {
  let idea = "";
  // 마법 프롬프트와 같은 규칙을 쓰기 위해 포맷/화면비를 그대로 받아 넘긴다.
  let system = "";
  let requested: unknown;
  try {
    const body = await req.json();
    idea = String(body.idea ?? "").trim();
    requested = body.provider;
    const format = getFormat(body.format);
    system = systemPromptFor(format, resolveAspect(format, body.aspect));
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }
  if (!idea) {
    return NextResponse.json({ error: "아이디어를 입력해 주세요." }, { status: 400 });
  }

  // 평문 HTTP로 사용자 키가 오면 쓰지 않고 막는다. 중간에서 그대로 읽힌다.
  if (insecureKeyTransport(req)) {
    return NextResponse.json(
      { error: "보안 연결(HTTPS)에서만 키를 보낼 수 있어요." },
      { status: 400 }
    );
  }

  // env 값은 "기본 선택 + 전체 끄기 스위치"이고, 화면에서 고른 값이 우선한다.
  // 요청으로 온 값은 아는 provider일 때만 받는다(임의 문자열로 분기가 흔들리지 않게).
  const envProvider = (process.env.NEXT_PUBLIC_TEXT_PROVIDER ||
    "none") as TextProviderId;
  const picked = isLlmProviderId(requested) ? requested : envProvider;
  // env가 none이면 화면에서 뭘 골라 보내든 자동 생성은 꺼진 상태다.
  const provider = envProvider === "none" ? "none" : picked;

  if (provider === "none") {
    return NextResponse.json(
      { error: "자동 생성이 꺼져 있어요. (NEXT_PUBLIC_TEXT_PROVIDER=none)" },
      { status: 400 }
    );
  }
  const meta = SERVICES[provider];

  // 사용자가 넣은 키가 있으면 그걸, 없으면 서버 키(자체 호스팅용).
  // 이 key는 이 요청 처리 동안만 사는 지역 변수다 — 저장하지 않는다.
  const { key, fromUser } = resolveKey(provider, req);

  // 제한은 키를 확인한 뒤에 건다. 서버 키를 쓰는 요청(=운영자가 돈을 냄)과
  // 자기 키를 넣은 요청은 위험이 달라서 허용량을 다르게 줘야 한다.
  const limited = checkRate(req, "generate", fromUser);
  if (limited) return limited;
  if (!key) {
    return NextResponse.json(
      {
        error: `${meta.label} 키가 필요해요. 화면에서 키를 넣거나, 서버 .env.local에 ${meta.envKey}를 넣어 주세요. (발급: ${meta.keyUrl})`,
        needKey: meta.id,
      },
      { status: 400 }
    );
  }

  try {
    const content =
      provider === "groq"
        ? await viaGroq(system, idea, key)
        : provider === "openai"
        ? await viaOpenAI(system, idea, key)
        : await viaGemini(system, idea, key);

    // 기존의 관대한 파서로 정규화(붙여넣기 경로와 동일한 검증).
    const parsed = parseContiJson(content);
    if (parsed.error || parsed.cuts.length === 0) {
      // 응답 내용은 사용자의 콘티다. 길이/사유만 남기고 본문은 찍지 않는다.
      console.error(`${provider} parse fail`, parsed.error, `len=${content.length}`);
      return NextResponse.json(
        { error: "생성 결과를 콘티로 변환하지 못했어요. 다시 시도해 주세요." },
        { status: 502 }
      );
    }

    return NextResponse.json({ cuts: parsed.cuts, warnings: parsed.warnings });
  } catch (e) {
    if (e instanceof RateLimited) {
      return NextResponse.json(
        {
          error: `지금 자동 생성이 잠시 붐벼요 (${meta.label} 한도). 잠깐 뒤 다시 시도하거나, 마법 프롬프트로 만들어 보세요.`,
          rateLimited: true,
        },
        { status: 429 }
      );
    }
    // 예외 메시지에도 키가 섞일 수 있다(fetch가 URL/헤더를 담는 경우).
    console.error("generate exception", scrub(String(e), key));
    return NextResponse.json(
      { error: `${meta.label} 생성에 실패했어요. 잠시 후 다시 시도해 주세요.` },
      { status: 502 }
    );
  }
}
