import { Cut } from "./types";

export interface ParseResult {
  cuts: Cut[];
  warnings: string[];
  error?: string;
}

function numOrUndef(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function strOrUndef(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

function truthy(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return ["true", "1", "y", "yes", "훅", "o"].includes(v.trim().toLowerCase());
  if (typeof v === "number") return v !== 0;
  return false;
}

// 마법 프롬프트로 만든 JSON을 최대한 관대하게 읽는다.
// - ```json 코드펜스 제거
// - 배열 / {cuts:[]} / {scenes:[]} 모두 허용
// - 영문/한글 키를 모두 매핑
export function parseContiJson(raw: string): ParseResult {
  const warnings: string[] = [];
  if (!raw || !raw.trim()) {
    return { cuts: [], warnings, error: "입력이 비어 있어요." };
  }

  let text = raw.trim();

  // 1) 코드펜스 벗기기
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  // 2) 파싱 시도 → 실패하면 대괄호/중괄호 블록만 추출해 재시도
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    const block =
      text.match(/\[[\s\S]*\]/)?.[0] ?? text.match(/\{[\s\S]*\}/)?.[0];
    if (block) {
      try {
        data = JSON.parse(block);
      } catch {
        /* fallthrough */
      }
    }
  }

  if (data === undefined) {
    return {
      cuts: [],
      warnings,
      error:
        "JSON을 읽지 못했어요. 마법 프롬프트가 만들어준 결과를 그대로(코드블록 포함해도 OK) 붙여넣었는지 확인해 주세요.",
    };
  }

  // 3) 컷 배열 찾아내기
  let list: unknown[];
  if (Array.isArray(data)) {
    list = data;
  } else if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const arr = obj.cuts ?? obj.scenes ?? obj.컷 ?? obj.콘티;
    if (Array.isArray(arr)) list = arr;
    else
      return {
        cuts: [],
        warnings,
        error: "JSON 안에서 컷 배열(cuts / scenes)을 찾지 못했어요.",
      };
  } else {
    return { cuts: [], warnings, error: "JSON 형식이 예상과 달라요." };
  }

  // 4) 각 항목을 Cut으로 정규화
  const cuts: Cut[] = [];
  list.forEach((raw, i) => {
    if (typeof raw !== "object" || raw === null) {
      warnings.push(`${i + 1}번째 항목이 객체가 아니라 건너뛰었어요.`);
      return;
    }
    const item = raw as Record<string, unknown>;
    const description = strOrUndef(
      item.description ?? item.desc ?? item.화면묘사 ?? item.묘사 ?? item.장면
    );
    if (!description) {
      warnings.push(`${i + 1}번째 컷에 화면묘사(description)가 없어 건너뛰었어요.`);
      return;
    }
    cuts.push({
      no: cuts.length + 1,
      duration_sec: numOrUndef(
        item.duration_sec ?? item.duration ?? item.초 ?? item.길이
      ),
      is_hook: truthy(item.is_hook ?? item.hook ?? item.훅),
      shot: strOrUndef(item.shot ?? item.shot_size ?? item.샷 ?? item.샷사이즈),
      description,
      dialogue: strOrUndef(
        item.dialogue ?? item.line ?? item.대사 ?? item.나레이션
      ),
      caption: strOrUndef(item.caption ?? item.subtitle ?? item.자막),
      shooting_tip: strOrUndef(
        item.shooting_tip ?? item.tip ?? item.촬영팁 ?? item.촬영_팁
      ),
    });
  });

  if (cuts.length === 0 && warnings.length === 0) {
    return { cuts, warnings, error: "유효한 컷을 찾지 못했어요." };
  }

  return { cuts, warnings };
}
