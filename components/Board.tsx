"use client";

import { useEffect, useRef, useState } from "react";
import { Cut } from "@/lib/types";
import { generateSketch } from "@/lib/sketch";
import CutCard, { SketchState } from "./CutCard";

interface Panel {
  cut: Cut;
  url: string | null;
  state: SketchState;
  variant: number; // 재생성 횟수 (mock에서 다른 그림을 뽑기 위한 salt)
}

export default function Board({ initialCuts }: { initialCuts: Cut[] }) {
  const [panels, setPanels] = useState<Panel[]>(
    initialCuts.map((cut) => ({
      cut,
      url: null,
      state: "idle" as SketchState,
      variant: 0,
    }))
  );
  // 최초 1회만 자동 생성 (안 보는 그림에 돈/시간 안 쓰기 위해 재생성은 수동)
  const started = useRef(false);

  const runOne = async (index: number, variant = 0) => {
    setPanels((prev) =>
      prev.map((p, i) => (i === index ? { ...p, state: "loading", variant } : p))
    );
    try {
      const url = await generateSketch(initialCuts[index], variant);
      setPanels((prev) =>
        prev.map((p, i) => (i === index ? { ...p, url, state: "done" } : p))
      );
    } catch (e) {
      console.error(e);
      setPanels((prev) =>
        prev.map((p, i) => (i === index ? { ...p, state: "error" } : p))
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
        filter: (node) =>
          !(node instanceof HTMLElement && node.classList.contains("cut-regen")),
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
          컷 {initialCuts.length}개
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
            {exporting ? "만드는 중…" : "🖼 이미지로 저장"}
          </button>
          <button className="btn sm" onClick={() => window.print()}>
            🖨 인쇄 / PDF
          </button>
        </div>
      </div>

      <div className="board-grid" ref={boardRef}>
        {panels.map((p, i) => (
          <CutCard
            key={i}
            cut={p.cut}
            url={p.url}
            state={p.state}
            onRegenerate={() => runOne(i, p.variant + 1)}
          />
        ))}
      </div>
    </div>
  );
}
