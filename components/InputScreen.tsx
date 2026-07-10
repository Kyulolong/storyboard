"use client";

import { useRef, useState } from "react";
import { Cut } from "@/lib/types";
import { parseContiJson } from "@/lib/parse";
import { magicPromptWithIdea } from "@/lib/magicPrompt";
import { EXAMPLE_JSON } from "@/lib/examples";
import { generateConti, autoGenEnabled, RateLimitError } from "@/lib/generate";
import ManualForm from "./ManualForm";

type Tab = "paste" | "form";

export default function InputScreen({
  onReady,
}: {
  onReady: (cuts: Cut[]) => void;
}) {
  const [tab, setTab] = useState<Tab>("paste");

  return (
    <div>
      <div className="tabs" role="tablist">
        <button
          className={`tab ${tab === "paste" ? "active" : ""}`}
          onClick={() => setTab("paste")}
        >
          A. JSON 붙여넣기
        </button>
        <button
          className={`tab ${tab === "form" ? "active" : ""}`}
          onClick={() => setTab("form")}
        >
          B. 직접 입력
        </button>
      </div>

      {tab === "paste" ? (
        <PasteTab onReady={onReady} />
      ) : (
        <ManualForm onReady={onReady} />
      )}
    </div>
  );
}

function PasteTab({ onReady }: { onReady: (cuts: Cut[]) => void }) {
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [showPrompt, setShowPrompt] = useState(true);

  // 자동 생성(Groq)
  const [idea, setIdea] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const magicRef = useRef<HTMLDivElement>(null);

  const autoGenerate = async () => {
    if (!idea.trim()) return;
    setGenLoading(true);
    setGenError(null);
    setRateLimited(false);
    try {
      const cuts = await generateConti(idea.trim());
      onReady(cuts); // 성공하면 바로 보드로
    } catch (e) {
      if (e instanceof RateLimitError) {
        setRateLimited(true);
        setGenError(null);
      } else {
        setGenError((e as Error).message);
      }
    } finally {
      setGenLoading(false);
    }
  };

  // 마법 프롬프트 복사(입력한 아이디어가 있으면 끼워서 복사).
  const copyPrompt = async (scroll = false) => {
    try {
      await navigator.clipboard.writeText(magicPromptWithIdea(idea));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("복사에 실패했어요. 프롬프트 박스에서 직접 선택해 복사해 주세요.");
    }
    if (scroll) {
      setShowPrompt(true);
      magicRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const submit = () => {
    const res = parseContiJson(raw);
    setWarnings(res.warnings);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.cuts.length === 0) {
      setError("유효한 컷이 없어요.");
      return;
    }
    setError(null);
    onReady(res.cuts);
  };

  return (
    <>
      {autoGenEnabled() && (
        <div className="panel" style={{ borderColor: "var(--accent)" }}>
          <strong>⚡ 아이디어 한 줄로 자동 생성</strong>
          <div className="hint" style={{ margin: "8px 0 12px" }}>
            아래 붙여넣기 방식이 번거로우면, 아이디어만 적고 눌러보세요. (무료 Groq)
          </div>
          <textarea
            placeholder="예: 자취생이 김치볶음밥을 3분만에 만드는 초간단 레시피 릴스"
            value={idea}
            onChange={(e) => {
              setIdea(e.target.value);
              setGenError(null);
            }}
            style={{ minHeight: 56 }}
          />
          {genError && (
            <p className="error" style={{ marginBottom: 0 }}>
              ⚠ {genError}
            </p>
          )}
          {rateLimited && (
            <div
              className="panel"
              style={{
                marginTop: 12,
                background: "var(--accent-weak)",
                borderColor: "var(--accent)",
              }}
            >
              <div style={{ marginBottom: 8 }}>
                🚦 지금 자동 생성이 잠시 붐벼요 <span className="hint">(Groq 무료 한도)</span>
              </div>
              <div className="hint" style={{ marginBottom: 12 }}>
                잠깐 뒤 다시 눌러도 되고, <strong>마법 프롬프트</strong>로 바로 만들 수도 있어요.
                아이디어는 프롬프트에 이미 채워 드릴게요.
              </div>
              <div className="btn-row">
                <button className="btn primary" onClick={() => copyPrompt(true)}>
                  {copied ? "복사됨 ✓ — ChatGPT에 붙여넣기" : "마법 프롬프트 복사하고 이동 →"}
                </button>
                <button
                  className="btn ghost sm"
                  onClick={autoGenerate}
                  disabled={genLoading}
                >
                  다시 시도
                </button>
              </div>
            </div>
          )}
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button
              className="btn primary"
              onClick={autoGenerate}
              disabled={!idea.trim() || genLoading}
            >
              {genLoading ? "생성 중…" : "⚡ 자동 생성 → 보드"}
            </button>
            <span className="hint" style={{ margin: 0 }}>
              또는 아래에서 직접 만들어 붙여넣기 ↓
            </span>
          </div>
        </div>
      )}

      <div className="panel" ref={magicRef}>
        <div className="btn-row" style={{ justifyContent: "space-between" }}>
          <strong>1) 마법 프롬프트를 내 ChatGPT/Claude에 붙여넣기</strong>
          <button
            className="btn ghost sm"
            onClick={() => setShowPrompt((v) => !v)}
          >
            {showPrompt ? "접기" : "펼치기"}
          </button>
        </div>
        <div className="hint" style={{ margin: "8px 0 12px" }}>
          아래 프롬프트를 복사해 평소 쓰는 AI에 붙여넣고, 마지막 줄의 아이디어만
          바꿔 실행하세요. 우리가 읽을 수 있는 JSON이 그대로 나옵니다.
        </div>
        {showPrompt && (
          <pre className="magic-box">{magicPromptWithIdea(idea)}</pre>
        )}
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn primary" onClick={() => copyPrompt(false)}>
            {copied ? "복사됨 ✓" : "프롬프트 복사"}
          </button>
          {idea.trim() && (
            <span className="hint" style={{ margin: 0 }}>
              내 아이디어가 자동으로 채워졌어요
            </span>
          )}
        </div>
      </div>

      <div className="panel">
        <strong>2) AI가 만들어준 JSON을 여기에 붙여넣기</strong>
        <div className="spacer" />
        <textarea
          className="code"
          placeholder='{ "cuts": [ { "no": 1, "description": "..." } ] }'
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setError(null);
          }}
        />
        {error && (
          <p className="error" style={{ marginBottom: 0 }}>
            ⚠ {error}
          </p>
        )}
        {warnings.length > 0 && (
          <ul className="warn" style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}
        <div className="btn-row" style={{ marginTop: 14 }}>
          <button className="btn primary" onClick={submit} disabled={!raw.trim()}>
            보드 만들기 →
          </button>
          <button
            className="btn ghost sm"
            onClick={() => {
              setRaw(EXAMPLE_JSON);
              setError(null);
            }}
          >
            예시 JSON 넣어보기
          </button>
        </div>
      </div>
    </>
  );
}
