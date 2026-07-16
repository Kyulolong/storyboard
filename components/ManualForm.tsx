"use client";

import { useState } from "react";
import { Cut, emptyCut } from "@/lib/types";
import { exampleCutsFor } from "@/lib/examples";
import { FormatId, getFormat } from "@/lib/formats";

// 처음엔 예시 콘티로 채워서 "무엇을 어떻게 적는지" 바로 보이게 한다.
// 예시는 고른 포맷을 따라간다(광고를 골랐으면 광고 콘티가 채워진다).
export default function ManualForm({
  onReady,
  formatId,
  imagePicker,
}: {
  onReady: (cuts: Cut[]) => void;
  formatId: FormatId;
  // "보드 만들기" 바로 위에 꽂을 그림 provider 선택 블록 (InputScreen이 만든다)
  imagePicker: React.ReactNode;
}) {
  const format = getFormat(formatId);
  const [cuts, setCuts] = useState<Cut[]>(() => exampleCutsFor(formatId));
  const [error, setError] = useState<string | null>(null);

  const update = (i: number, patch: Partial<Cut>) => {
    setCuts((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
    setError(null);
  };

  const addCut = () =>
    setCuts((prev) => [...prev, emptyCut(prev.length + 1)]);

  const removeCut = (i: number) =>
    setCuts((prev) =>
      prev.filter((_, idx) => idx !== i).map((c, idx) => ({ ...c, no: idx + 1 }))
    );

  const submit = () => {
    const valid = cuts
      .filter((c) => (c.description || "").trim().length > 0)
      .map((c, idx) => ({ ...c, no: idx + 1 }));
    if (valid.length === 0) {
      setError("최소 한 컷은 '화면 묘사'를 채워야 해요. (스케치의 소스예요)");
      return;
    }
    onReady(valid);
  };

  return (
    <div>
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="btn-row" style={{ justifyContent: "space-between" }}>
          {/* 포맷을 바꿔도 입력하던 컷은 지우지 않는다(되돌릴 수 없으므로).
              그래서 안내문구가 "아래 내용"을 단정하면 어긋난다 —
              포맷 이름은 항상 정확한 버튼 쪽에 붙인다. */}
          <div className="hint" style={{ margin: 0 }}>
            아래는 <strong>예시</strong>예요. 내용만 바꿔서 쓰거나, 비우고 처음부터
            작성하세요. <strong>화면 묘사</strong>가 스케치의 소스라 제일 중요합니다.
          </div>
          <div className="btn-row">
            <button
              className="btn ghost sm"
              onClick={() => setCuts(exampleCutsFor(formatId))}
              title={`${format.exampleLabel} 예시로 채웁니다`}
            >
              {format.exampleLabel} 예시
            </button>
            <button
              className="btn ghost sm"
              onClick={() => setCuts([emptyCut(1)])}
            >
              비우기
            </button>
          </div>
        </div>
      </div>

      {cuts.map((cut, i) => (
        <div className="form-cut" key={i}>
          <div className="form-cut-head">
            <strong>컷 {i + 1}</strong>
            <div className="checkbox-row">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={!!cut.is_hook}
                  onChange={(e) => update(i, { is_hook: e.target.checked })}
                />
                훅 컷
              </label>
              <button
                className="btn ghost sm"
                onClick={() => removeCut(i)}
                disabled={cuts.length === 1}
                title="컷 삭제"
              >
                🗑
              </button>
            </div>
          </div>

          <div className="form-grid">
            <div>
              <label className="label">샷 사이즈</label>
              <input
                type="text"
                placeholder="클로즈업 / 미디엄샷 / 롱샷"
                value={cut.shot ?? ""}
                onChange={(e) => update(i, { shot: e.target.value })}
              />
            </div>
            <div>
              <label className="label">길이(초)</label>
              <input
                type="number"
                min={0}
                placeholder="2"
                value={cut.duration_sec ?? ""}
                onChange={(e) =>
                  update(i, {
                    duration_sec:
                      e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="full">
              <label className="label">화면 묘사 * (스케치로 그릴 내용)</label>
              <textarea
                placeholder="예: 카메라를 향해 놀란 표정. 손으로 입을 가림"
                value={cut.description ?? ""}
                onChange={(e) => update(i, { description: e.target.value })}
                style={{ minHeight: 60 }}
              />
            </div>
            <div className="full">
              <label className="label">{format.labels.caption}</label>
              <input
                type="text"
                placeholder={`화면에 뜨는 ${format.labels.caption}`}
                value={cut.caption ?? ""}
                onChange={(e) => update(i, { caption: e.target.value })}
              />
            </div>
            <div>
              <label className="label">{format.labels.dialogue}</label>
              <input
                type="text"
                placeholder="말하는 대사"
                value={cut.dialogue ?? ""}
                onChange={(e) => update(i, { dialogue: e.target.value })}
              />
            </div>
            <div>
              <label className="label">{format.labels.tip} 노트</label>
              <input
                type="text"
                placeholder={format.tipPlaceholder}
                value={cut.shooting_tip ?? ""}
                onChange={(e) => update(i, { shooting_tip: e.target.value })}
              />
            </div>
          </div>
        </div>
      ))}

      <div className="panel" style={{ marginBottom: 16 }}>
        {imagePicker}
      </div>

      {error && <p className="error">{error}</p>}

      <div className="btn-row" style={{ marginTop: 8 }}>
        <button className="btn" onClick={addCut}>
          + 컷 추가
        </button>
        <button className="btn primary" onClick={submit}>
          보드 만들기 →
        </button>
      </div>
    </div>
  );
}
