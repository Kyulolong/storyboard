import { NextRequest, NextResponse } from "next/server";
import { parseContiJson } from "@/lib/parse";

// 마법 프롬프트와 같은 규칙을 시스템 프롬프트로 심는다(자동 생성용).
const SYSTEM = `너는 릴스/쇼츠(세로 9:16) 영상 콘티 전문가야. 사용자의 [아이디어]를 릴스 콘티로 만든다.

규칙:
- 컷은 6개 내외. 릴스는 템포가 빠르니 컷당 1~4초.
- 1번 컷은 반드시 강한 훅(hook): 첫 1~2초에 스크롤을 멈추게 하는 장면/문구.
- 등장인물은 대부분 촬영자 본인(삼각대/셀카). 필요하면 인서트/B롤 컷을 섞어.
- 각 컷에 화면 자막(caption)을 넣어. 릴스는 자막이 연출의 일부.
- 혼자 찍는 사람을 위한 촬영 팁(shooting_tip)을 한 줄로.
- 반드시 사용자의 아이디어 주제만 사용해. 절대 다른 주제로 바꾸지 마.

출력: 설명/인사말 없이 오직 JSON 하나만. 값은 한국어.
스키마: {"cuts":[{"no":number,"duration_sec":number,"is_hook":boolean,"shot":string,"description":string,"dialogue":string,"caption":string,"shooting_tip":string}]}`;

export async function POST(req: NextRequest) {
  let idea = "";
  try {
    const body = await req.json();
    idea = String(body.idea ?? "").trim();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }
  if (!idea) {
    return NextResponse.json({ error: "아이디어를 입력해 주세요." }, { status: 400 });
  }

  const provider = process.env.NEXT_PUBLIC_TEXT_PROVIDER || "none";
  const key = process.env.GROQ_API_KEY;

  if (provider !== "groq" || !key) {
    return NextResponse.json(
      {
        error:
          "자동 생성이 설정되지 않았어요. .env.local에 NEXT_PUBLIC_TEXT_PROVIDER=groq 와 GROQ_API_KEY를 넣어 주세요.",
      },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: 0.7,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: `아이디어: ${idea}` },
          ],
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("groq error", res.status, text);
      if (res.status === 429) {
        return NextResponse.json(
          {
            error: "지금 자동 생성이 잠시 붐벼요 (Groq 무료 한도). 잠깐 뒤 다시 시도하거나, 마법 프롬프트로 만들어 보세요.",
            rateLimited: true,
          },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: `Groq 생성 실패 (${res.status})` },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? "";

    // 기존의 관대한 파서로 정규화(붙여넣기 경로와 동일한 검증).
    const parsed = parseContiJson(content);
    if (parsed.error || parsed.cuts.length === 0) {
      console.error("groq parse fail", parsed.error, content.slice(0, 300));
      return NextResponse.json(
        { error: "생성 결과를 콘티로 변환하지 못했어요. 다시 시도해 주세요." },
        { status: 502 }
      );
    }

    return NextResponse.json({ cuts: parsed.cuts, warnings: parsed.warnings });
  } catch (e) {
    console.error("generate exception", e);
    return NextResponse.json({ error: "생성 중 오류가 발생했어요." }, { status: 500 });
  }
}
