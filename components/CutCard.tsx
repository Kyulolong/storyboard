"use client";

import { Cut } from "@/lib/types";
import { Format } from "@/lib/formats";

export type SketchState = "idle" | "loading" | "done" | "error";

export default function CutCard({
  cut,
  url,
  state,
  provider,
  error,
  format,
  onRegenerate,
}: {
  cut: Cut;
  url: string | null;
  state: SketchState;
  provider: string | null;
  error?: string | null;
  format: Format;
  onRegenerate: () => void;
}) {
  // provider를 "mock"으로 설정해 쓰는 건 정상 동작이므로 알리지 않는다.
  // 원격 생성이 실패해서 밀려난 경우("mock-fallback")만 티를 낸다.
  const isFallback = provider === "mock-fallback";

  return (
    <div className="cut-card">
      <div className="cut-sketch">
        <div className="cut-badges">
          {cut.is_hook && <span className="badge hook">HOOK</span>}
          {cut.duration_sec != null && (
            <span className="badge">{cut.duration_sec}s</span>
          )}
          {state === "done" && isFallback && (
            // no-export: 저장할 PNG에는 빼둔다(진단용 표시일 뿐 콘티 내용이 아니다).
            <span
              className="badge fallback no-export"
              title="원격 생성이 잠깐 안 돼서 임시 그림을 넣어 뒀어요. ↻ 버튼을 누르면 다시 그려볼게요."
            >
              임시 그림
            </span>
          )}
        </div>

        {state === "loading" && <span className="loading">스케치 그리는 중…</span>}
        {state === "error" && (
          <span className="loading err" title={error ?? ""}>
            {error ?? "그림을 못 그렸어요"}
          </span>
        )}
        {state === "done" && url && (
          // 스케치는 mock(SVG data URL) 또는 원격 URL 모두 <img>로 처리.
          // crossOrigin: 이미지로 저장(html-to-image) 시 캔버스 오염 방지.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`컷 ${cut.no} 스케치`} crossOrigin="anonymous" />
        )}

        {state !== "loading" && (
          <button
            className="btn sm ghost cut-regen"
            onClick={onRegenerate}
            title="이 컷만 다시 그리기"
            aria-label={`컷 ${cut.no} 다시 그리기`}
          >
            ↻
          </button>
        )}
      </div>

      <div className="cut-body">
        <div className="cut-no">
          <span>컷 {cut.no}</span>
          {cut.shot && <span>{cut.shot}</span>}
        </div>
        <div className="cut-desc">{cut.description}</div>
        {cut.caption && (
          <div className="field caption">
            <span className="k">{format.labels.caption}</span>
            <span className="v">{cut.caption}</span>
          </div>
        )}
        {cut.dialogue && (
          <div className="field dialogue">
            <span className="k">{format.labels.dialogue}</span>
            <span className="v">“{cut.dialogue}”</span>
          </div>
        )}
        {cut.shooting_tip && (
          <div className="field">
            <span className="k">{format.labels.tip}</span>
            <span className="v">{cut.shooting_tip}</span>
          </div>
        )}
      </div>
    </div>
  );
}
