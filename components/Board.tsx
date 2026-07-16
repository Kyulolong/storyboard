"use client";

import { useEffect, useRef, useState, CSSProperties } from "react";
import { Cut } from "@/lib/types";
import { generateSketch } from "@/lib/sketch";
import {
  AspectId,
  FormatId,
  ImageStyleId,
  getAspect,
  getFormat,
  getImageStyle,
} from "@/lib/formats";
import { ImageProviderId, serviceForImage } from "@/lib/providers";
import { loadKeys } from "@/lib/keys";
import CutCard, { SketchState } from "./CutCard";

interface Panel {
  cut: Cut;
  url: string | null;
  state: SketchState;
  variant: number; // 재생성 횟수 (mock에서 다른 그림을 뽑기 위한 salt)
  provider: string | null; // 그림을 실제로 만든 주체 ("mock-fallback"이면 임시 그림)
  error: string | null; // 실패 사유(요청 제한 등)를 카드에 그대로 보여준다
}

export default function Board({
  initialCuts,
  formatId,
  aspectId,
  imageProvider,
  imageStyle,
}: {
  initialCuts: Cut[];
  formatId: FormatId;
  aspectId: AspectId;
  imageProvider: ImageProviderId;
  imageStyle: ImageStyleId;
}) {
  const format = getFormat(formatId);
  const aspect = getAspect(aspectId);
  const style = getImageStyle(imageStyle);
  // 키는 Conti(=sessionStorage의 콘티)에 절대 넣지 않는다.
  // 키 저장소(별도 sessionStorage)에서 그때그때 읽어 요청 헤더로만 쓴다.
  const keyFor = () => {
    const svc = serviceForImage(imageProvider);
    return svc ? loadKeys()[svc] : undefined;
  };
  const [panels, setPanels] = useState<Panel[]>(
    initialCuts.map((cut) => ({
      cut,
      url: null,
      state: "idle" as SketchState,
      variant: 0,
      provider: null,
      error: null,
    }))
  );
  // 최초 1회만 자동 생성 (안 보는 그림에 돈/시간 안 쓰기 위해 재생성은 수동)
  const started = useRef(false);

  const runOne = async (index: number, variant = 0) => {
    setPanels((prev) =>
      prev.map((p, i) => (i === index ? { ...p, state: "loading", variant } : p))
    );
    try {
      const { url, provider } = await generateSketch(initialCuts[index], {
        variant,
        aspect: aspectId,
        provider: imageProvider,
        style: imageStyle,
        userKey: keyFor(),
      });
      setPanels((prev) =>
        prev.map((p, i) =>
          i === index ? { ...p, url, provider, state: "done", error: null } : p
        )
      );
    } catch (e) {
      const msg = (e as Error).message;
      console.error(e);
      setPanels((prev) =>
        prev.map((p, i) =>
          i === index ? { ...p, state: "error", error: msg } : p
        )
      );
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // 로드/새로고침 때마다 다른 랜덤 base로 시작 → 매번 새로 그려진다.
    const base = Math.floor(Math.random() * 1_000_000);
    // 순차 생성 (한 번에 몰아치지 않게). mock은 즉시, fal은 rate limit 여유.
    (async () => {
      for (let i = 0; i < initialCuts.length; i++) {
        await runOne(i, base + i * 131 + 1);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalSec = initialCuts.reduce(
    (sum, c) => sum + (c.duration_sec || 0),
    0
  );
  const doneCount = panels.filter((p) => p.state === "done").length;
  const allDone = doneCount === initialCuts.length;

  const boardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  // 화면비는 CSS 변수로 한 번만 내려주고, 카드/스케치가 그걸 따라간다.
  // (w/h는 실제 캔버스 픽셀이라 360/640처럼 그대로 비율이 된다.)
  const gridStyle = {
    "--cut-aspect": `${aspect.w} / ${aspect.h}`,
    "--board-min-col": `${aspect.minCol}px`,
  } as CSSProperties;

  const saveImage = async () => {
    if (!boardRef.current) return;
    setExporting(true);
    try {
      // 최신 CSS(aspect-ratio 등)를 정확히 렌더하는 html-to-image 사용.
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(boardRef.current, {
        pixelRatio: 2,
        backgroundColor: "#0f1115",
        // cacheBust 금지: 원격 이미지를 재요청하면 rate limit에 걸려 실패한다.
        // 이미 로드된(CORS) 이미지를 그대로 인라인한다.
        // 화면 조작용/진단용 요소는 결과물에서 제외한다.
        filter: (node) =>
          !(
            node instanceof HTMLElement &&
            (node.classList.contains("cut-regen") ||
              node.classList.contains("no-export"))
          ),
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "storyboard.png";
      a.click();
    } catch (e) {
      console.error("export failed", e);
      alert("이미지 저장에 실패했어요. 스케치가 모두 뜬 뒤 다시 시도해 주세요.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="board-head">
        <div className="board-meta">
          {format.label} · {aspect.label} · {style.label} · 컷{" "}
          {initialCuts.length}개
          {totalSec > 0 && ` · 총 ${totalSec}초`} · 스케치 {doneCount}/
          {initialCuts.length}
        </div>
        <div className="btn-row">
          <button
            className="btn sm primary"
            onClick={saveImage}
            disabled={exporting || doneCount === 0}
            title={allDone ? "" : "스케치가 모두 뜬 뒤 저장하면 깔끔해요"}
          >
            {exporting ? "만드는 중…" : "이미지로 저장"}
          </button>
          <button className="btn sm" onClick={() => window.print()}>
            인쇄 / PDF
          </button>
        </div>
      </div>

      <div className="board-grid" ref={boardRef} style={gridStyle}>
        {panels.map((p, i) => (
          <CutCard
            key={i}
            cut={p.cut}
            url={p.url}
            state={p.state}
            provider={p.provider}
            error={p.error}
            format={format}
            onRegenerate={() => runOne(i, p.variant + 1)}
          />
        ))}
      </div>
    </div>
  );
}
