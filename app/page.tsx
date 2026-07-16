"use client";

import { useEffect, useState } from "react";
import { Cut } from "@/lib/types";
import {
  AspectId,
  FormatId,
  ImageStyleId,
  getFormat,
  getImageStyle,
  resolveAspect,
} from "@/lib/formats";
import { IMAGE_PROVIDERS, ImageProviderId } from "@/lib/providers";
import InputScreen from "@/components/InputScreen";
import Board from "@/components/Board";

const STORAGE_KEY = "storyboard.conti";

// 컷만이 아니라 어떤 포맷/화면비로 만든 콘티인지까지 한 덩어리로 다룬다.
// (화면비를 잃어버리면 새로고침 때 보드가 다른 비율로 다시 그려진다.)
export interface Conti {
  format: FormatId;
  aspect: AspectId;
  // 어떤 서비스로 그림을 뽑을지. 컷과 함께 들고 다녀야
  // 새로고침해도 같은 서비스로 다시 그린다.
  imageProvider: ImageProviderId;
  imageStyle: ImageStyleId; // 러프 스케치 / 실사
  cuts: Cut[];
}

export default function Home() {
  const [conti, setConti] = useState<Conti | null>(null);
  const [restored, setRestored] = useState(false);

  // 새로고침해도 보드가 유지되도록 세션에서 복원.
  // (스케치 자체는 저장하지 않으므로 Board가 매 로드마다 새로 그린다.)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const raw = JSON.parse(saved);
        // 저장된 값은 신뢰하지 않고 프리셋으로 정규화한다.
        const format = getFormat(raw?.format);
        setConti({
          format: format.id,
          aspect: resolveAspect(format, raw?.aspect).id,
          imageProvider:
            raw?.imageProvider in IMAGE_PROVIDERS ? raw.imageProvider : "mock",
          imageStyle: getImageStyle(raw?.imageStyle).id,
          cuts: Array.isArray(raw?.cuts) ? raw.cuts : [],
        });
      }
    } catch {
      /* ignore */
    }
    setRestored(true);
  }, []);

  const start = (c: Conti) => {
    setConti(c);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(c));
    } catch {
      /* ignore */
    }
  };

  const reset = () => {
    setConti(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="container">
      <header className="app-header">
        {/* 브랜드 마크는 로고를 새로 그리지 않고 워드마크 앞의 초록 점 하나로 통일한다.
            태그라인은 h1 아래에서 점의 왼쪽 끝에 맞는다(세로 flex). */}
        <div className="brand">
          <h1>
            <span className="logo" aria-hidden="true" />
            영상 콘티 메이커
          </h1>
          <p>글만 쓰세요. 그림은 제가 그릴게요.</p>
        </div>
        <div className="header-right">
          {conti && (
            <button className="btn ghost sm" onClick={reset}>
              ← 새로 입력
            </button>
          )}
          {/* 서명은 자랑이 아니라 낙관(落款). 늘 우측 끝에 조용히. */}
          <span className="credit">made by kyulolong</span>
        </div>
      </header>

      {!restored ? null : conti && conti.cuts.length > 0 ? (
        <Board
          initialCuts={conti.cuts}
          formatId={conti.format}
          aspectId={conti.aspect}
          imageProvider={conti.imageProvider}
          imageStyle={conti.imageStyle}
        />
      ) : (
        <InputScreen onReady={start} />
      )}
    </div>
  );
}
