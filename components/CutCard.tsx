"use client";

import { Cut } from "@/lib/types";

export type SketchState = "idle" | "loading" | "done" | "error";

export default function CutCard({
  cut,
  url,
  state,
  onRegenerate,
}: {
  cut: Cut;
  url: string | null;
  state: SketchState;
  onRegenerate: () => void;
}) {
  return (
    <div className="cut-card">
      <div className="cut-sketch">
        <div className="cut-badges">
          {cut.is_hook && <span className="badge hook">HOOK</span>}
          {cut.duration_sec != null && (
            <span className="badge">{cut.duration_sec}s</span>
          )}
        </div>

        {state === "loading" && <span className="loading">스케치 그리는 중…</span>}
        {state === "error" && <span className="loading">⚠ 생성 실패</span>}
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
          >
            🔄
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
            <span className="k">자막</span>
            <span className="v">{cut.caption}</span>
          </div>
        )}
        {cut.dialogue && (
          <div className="field dialogue">
            <span className="k">대사</span>
            <span className="v">“{cut.dialogue}”</span>
          </div>
        )}
        {cut.shooting_tip && (
          <div className="field">
            <span className="k">촬영</span>
            <span className="v">{cut.shooting_tip}</span>
          </div>
        )}
      </div>
    </div>
  );
}
