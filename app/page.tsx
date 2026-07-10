"use client";

import { useEffect, useState } from "react";
import { Cut } from "@/lib/types";
import InputScreen from "@/components/InputScreen";
import Board from "@/components/Board";

const STORAGE_KEY = "storyboard.cuts";

export default function Home() {
  const [cuts, setCuts] = useState<Cut[] | null>(null);
  const [restored, setRestored] = useState(false);

  // 새로고침해도 보드가 유지되도록 세션에서 복원.
  // (스케치 자체는 저장하지 않으므로 Board가 매 로드마다 새로 그린다.)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) setCuts(JSON.parse(saved));
    } catch {
      /* ignore */
    }
    setRestored(true);
  }, []);

  const start = (c: Cut[]) => {
    setCuts(c);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(c));
    } catch {
      /* ignore */
    }
  };

  const reset = () => {
    setCuts(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="container">
      <header className="app-header">
        <div>
          <h1>🎬 릴스 콘티 → 스케치 보드</h1>
          <div className="sub">
            콘티 글을 세로 러프 스케치 보드로. 글은 직접(또는 내 GPT로), 그림은 여기서.
          </div>
        </div>
        {cuts && (
          <button className="btn ghost" onClick={reset}>
            ← 새로 입력
          </button>
        )}
      </header>

      {!restored ? null : cuts ? (
        <Board initialCuts={cuts} />
      ) : (
        <InputScreen onReady={start} />
      )}
    </div>
  );
}
