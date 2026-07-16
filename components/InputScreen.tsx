"use client";

import { useEffect, useRef, useState } from "react";
import { Cut } from "@/lib/types";
import { parseContiJson } from "@/lib/parse";
import { magicPromptWithIdea } from "@/lib/magicPrompt";
import { exampleJsonFor } from "@/lib/examples";
import { generateConti, RateLimitError } from "@/lib/generate";
import {
  ASPECTS,
  AspectId,
  DEFAULT_FORMAT,
  DEFAULT_IMAGE_STYLE,
  FORMATS,
  FormatId,
  FORMAT_IDS,
  IMAGE_STYLES,
  IMAGE_STYLE_IDS,
  ImageStyleId,
  getFormat,
} from "@/lib/formats";
import {
  IMAGE_PROVIDERS,
  IMAGE_PROVIDER_IDS,
  ImageProviderId,
  LlmProviderId,
  PRICED_AT,
  SERVICES,
  ServiceId,
  TEXT_PROVIDER_IDS,
  costLabel,
  krwPerCut,
  serviceForImage,
} from "@/lib/providers";
import { KeyMap, loadKeys, saveKeys } from "@/lib/keys";
import KeyInput from "./KeyInput";
import type { Conti } from "@/app/page";
import ManualForm from "./ManualForm";

type Tab = "paste" | "form";

// 서버가 알려주는 상태. 키 값이 아니라 "서버가 키를 갖고 있는 서비스 목록"이다.
// serverKeyed에 없는 서비스는 사용자가 자기 키를 넣어야 쓸 수 있다(BYOK).
interface Avail {
  serverKeyed: ServiceId[];
  textEnabled: boolean;
  defaults: { text: string; image: string };
}

export default function InputScreen({
  onReady,
}: {
  onReady: (conti: Conti) => void;
}) {
  const [tab, setTab] = useState<Tab>("paste");
  const [formatId, setFormatId] = useState<FormatId>(DEFAULT_FORMAT);
  const format = getFormat(formatId);
  const [aspectId, setAspectId] = useState<AspectId>(format.defaultAspect);

  const [avail, setAvail] = useState<Avail | null>(null);
  // 설정을 못 불러왔다("아직 안 왔다"와 다르다). 이걸 구분하지 않으면
  // 연결 실패가 "키를 설정하세요"로 보여서, 설정을 이미 끝낸 사람이
  // 멀쩡한 .env.local을 의심하게 된다.
  const [availFailed, setAvailFailed] = useState(false);
  const [retry, setRetry] = useState(0); // 늘리면 다시 불러온다
  const [textProvider, setTextProvider] = useState<LlmProviderId>("groq");
  const [imageProvider, setImageProvider] = useState<ImageProviderId>("mock");
  const [imageStyle, setImageStyle] = useState<ImageStyleId>(DEFAULT_IMAGE_STYLE);
  // 사용자 키. sessionStorage에만 두고(탭 닫으면 소멸) 요청 헤더로만 나간다.
  const [keys, setKeys] = useState<KeyMap>({});

  useEffect(() => {
    setKeys(loadKeys());
    let alive = true;
    setAvailFailed(false);

    // 잠깐 끊긴 것뿐일 수 있으니 몇 번 더 해보고, 그래도 안 되면 실패라고 말한다.
    const load = async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          const r = await fetch("/api/providers");
          // fetch는 404/500에도 throw하지 않는다. 상태를 직접 봐야 한다.
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const a: Avail = (await r.json()) as Avail;
          if (!alive) return;
          setAvail(a);
          if (a.defaults.text !== "none")
            setTextProvider(a.defaults.text as LlmProviderId);
          setImageProvider(a.defaults.image as ImageProviderId);
          return;
        } catch {
          if (!alive) return;
          if (attempt >= 2) {
            setAvailFailed(true);
            return;
          }
          // 0.4s → 0.8s 기다렸다 재시도
          await new Promise((ok) => setTimeout(ok, 400 * 2 ** attempt));
          if (!alive) return;
        }
      }
    };
    load();

    return () => {
      alive = false;
    };
  }, [retry]);

  const setKey = (service: ServiceId, key: string | undefined) => {
    const next = { ...keys, [service]: key };
    if (!key) delete next[service];
    setKeys(next);
    saveKeys(next);
  };

  // 이 서비스를 지금 쓸 수 있나? 서버 키가 있거나, 내가 키를 넣었거나.
  const usable = (service?: ServiceId) =>
    !service || !!avail?.serverKeyed.includes(service) || !!keys[service];
  // 사용자가 직접 키를 넣어야 하는 서비스인가?
  const needsMyKey = (service?: ServiceId) =>
    !!service && !avail?.serverKeyed.includes(service);

  // 포맷을 바꾸면 그 포맷의 기본 화면비에서 다시 시작한다.
  // "허용되면 유지"로 두면 릴스의 9:16이 광고에도 그대로 붙어서,
  // 광고를 고른 사람이 세로 콘티를 받게 된다(광고 기본은 가로 16:9).
  const changeFormat = (id: FormatId) => {
    setFormatId(id);
    setAspectId(getFormat(id).defaultAspect);
  };

  const imageService = serviceForImage(imageProvider);
  const ready = (cuts: Cut[]) =>
    onReady({ format: formatId, aspect: aspectId, imageProvider, imageStyle, cuts });

  // "그림은 어디서?"는 맨 위(포맷/화면비)가 아니라 "보드 만들기" 바로 위에 둔다.
  //  - 포맷/화면비는 프롬프트에 들어가서 글을 만들 때부터 쓰이지만,
  //    이미지 provider는 보드를 만드는 그 순간에만 쓰인다.
  //  - 유료 provider는 컷 수만큼 과금된다 → 돈이 나가기 직전에 보여야 한다.
  // 여기서 한 번만 만들고, 탭마다 있는 "보드 만들기" 위에 꽂아 쓴다(복제 금지).
  const imagePicker = (
    <div className="picker-block">
      <strong>그림은 어디서?</strong>
      <div className="preset-row">
        {IMAGE_PROVIDER_IDS.map((id) => {
          const svc = serviceForImage(id);
          return (
            <button
              key={id}
              className={`preset ${imageProvider === id ? "active" : ""}`}
              onClick={() => setImageProvider(id)}
              title={IMAGE_PROVIDERS[id].cost.note}
            >
              <span className="preset-label">
                {IMAGE_PROVIDERS[id].label}
                {needsMyKey(svc) && !keys[svc!] && " 🔑"}
              </span>
              <span className="preset-hint">{IMAGE_PROVIDERS[id].hint}</span>
              <span
                className={`preset-cost ${
                  krwPerCut(id) === 0 ? "free" : ""
                }`}
              >
                {costLabel(id)}
              </span>
            </button>
          );
        })}
      </div>
      {/* 값은 추정이다. 기준일과 근거를 숨기지 않는다. */}
      <p className="hint cost-note">
        {IMAGE_PROVIDERS[imageProvider].cost.note}
        {krwPerCut(imageProvider) > 0 && (
          <>
            {" "}
            컷이 6개면 <strong>약 {(krwPerCut(imageProvider) * 6).toLocaleString()}
            원</strong>쯤 들어요.
          </>
        )}{" "}
        <span className="cost-asof">{PRICED_AT} 기준 · 환율 포함 추정치</span>
      </p>

      {/* 키가 필요한 provider면 그 자리에서 바로 넣는다(BYOK). */}
      {needsMyKey(imageService) && (
        <KeyInput
          service={imageService!}
          value={keys[imageService!]}
          onChange={(k) => setKey(imageService!, k)}
        />
      )}
    </div>
  );

  return (
    <div>
      <div className="panel">
        <strong>어떤 콘티인가요?</strong>
        <div className="preset-row">
          {FORMAT_IDS.map((id) => (
            <button
              key={id}
              className={`preset ${formatId === id ? "active" : ""}`}
              onClick={() => changeFormat(id)}
            >
              <span className="preset-label">{FORMATS[id].label}</span>
              <span className="preset-hint">{FORMATS[id].hint}</span>
            </button>
          ))}
        </div>

        <div className="spacer" />
        <strong>화면비</strong>
        <div className="preset-row">
          {format.aspects.map((id) => (
            <button
              key={id}
              className={`preset ${aspectId === id ? "active" : ""}`}
              onClick={() => setAspectId(id)}
            >
              <span className="preset-label">{ASPECTS[id].label}</span>
              <span className="preset-hint">{ASPECTS[id].hint}</span>
            </button>
          ))}
        </div>

        {/* 포맷/화면비와 같은 급의 결정이라 여기 둔다 —
            "무엇을 만드는가"에 속하고, 프롬프트의 그림체를 바꾼다. */}
        <div className="spacer" />
        <strong>그림 느낌은?</strong>
        <div className="preset-row">
          {IMAGE_STYLE_IDS.map((id) => (
            <button
              key={id}
              className={`preset ${imageStyle === id ? "active" : ""}`}
              onClick={() => setImageStyle(id)}
            >
              <span className="preset-label">{IMAGE_STYLES[id].label}</span>
              <span className="preset-hint">{IMAGE_STYLES[id].hint}</span>
            </button>
          ))}
        </div>
      </div>

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
        <PasteTab
          onReady={ready}
          formatId={formatId}
          aspectId={aspectId}
          enabled={!!avail?.textEnabled}
          availFailed={availFailed}
          onRetryAvail={() => setRetry((n) => n + 1)}
          textProvider={textProvider}
          onPickTextProvider={setTextProvider}
          keys={keys}
          setKey={setKey}
          needsMyKey={needsMyKey}
          usable={usable}
          imagePicker={imagePicker}
        />
      ) : (
        <ManualForm
          onReady={ready}
          formatId={formatId}
          imagePicker={imagePicker}
        />
      )}
    </div>
  );
}

function PasteTab({
  onReady,
  formatId,
  aspectId,
  enabled,
  availFailed,
  onRetryAvail,
  textProvider,
  onPickTextProvider,
  keys,
  setKey,
  needsMyKey,
  usable,
  imagePicker,
}: {
  onReady: (cuts: Cut[]) => void;
  formatId: FormatId;
  aspectId: AspectId;
  enabled: boolean;
  availFailed: boolean;
  onRetryAvail: () => void;
  textProvider: LlmProviderId;
  onPickTextProvider: (id: LlmProviderId) => void;
  keys: KeyMap;
  setKey: (s: ServiceId, k: string | undefined) => void;
  needsMyKey: (s?: ServiceId) => boolean;
  usable: (s?: ServiceId) => boolean;
  // "보드 만들기" 바로 위에 꽂을 그림 provider 선택 블록 (InputScreen이 만든다)
  imagePicker: React.ReactNode;
}) {
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [showPrompt, setShowPrompt] = useState(true);

  // 아이디어 한 줄. 마법 프롬프트에 끼워 넣는 값이자 자동 생성의 입력이다.
  const [idea, setIdea] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const magicRef = useRef<HTMLDivElement>(null);
  const jsonRef = useRef<HTMLTextAreaElement>(null);

  // 아이디어 → JSON. 결과를 2)칸에 그대로 채운다.
  // 보드로 바로 넘기지 않는 이유: 붙여넣기 경로와 화면이 같아야 하고,
  // 무엇이 만들어졌는지 눈으로 보고 고칠 수 있어야 한다.
  const generateJson = async () => {
    if (!idea.trim()) return;
    setGenLoading(true);
    setGenError(null);
    setRateLimited(false);
    try {
      const cuts = await generateConti(
        idea.trim(),
        formatId,
        aspectId,
        textProvider,
        keys[textProvider] // 없으면 서버 키로 동작
      );
      // 사람이 만든 JSON과 똑같은 모양으로 넣는다(그대로 고쳐 쓸 수 있게).
      setRaw(JSON.stringify({ cuts }, null, 2));
      setError(null);
      setWarnings([]);
      jsonRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
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
      await navigator.clipboard.writeText(
        magicPromptWithIdea(idea, formatId, aspectId)
      );
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

  // 자동 생성이 켜져 있고, 고른 서비스를 쓸 수 있어야(서버 키 or 내 키) 버튼이 산다.
  const autoGen = enabled;
  const canGenerate = autoGen && usable(textProvider);

  return (
    <>
      <div className="panel" ref={magicRef}>
        <div className="btn-row" style={{ justifyContent: "space-between" }}>
          <strong>1) 아이디어를 적고, 프롬프트로 JSON 만들기</strong>
          <button
            className="btn ghost sm"
            onClick={() => setShowPrompt((v) => !v)}
          >
            {showPrompt ? "프롬프트 접기" : "프롬프트 펼치기"}
          </button>
        </div>

        <label className="label" style={{ marginTop: 10 }}>
          내 아이디어
        </label>
        <textarea
          placeholder={getFormat(formatId).ideaPlaceholder}
          value={idea}
          onChange={(e) => {
            setIdea(e.target.value);
            setGenError(null);
          }}
          style={{ minHeight: 56 }}
        />

        <div className="hint" style={{ margin: "10px 0 0" }}>
          {autoGen ? (
            <>
              <strong>JSON 생성</strong>을 누르면 아래 2)칸에 결과가 채워집니다.
              직접 만들고 싶으면 프롬프트를 복사해 평소 쓰는 AI에 붙여넣으세요.
            </>
          ) : (
            <>
              아래 프롬프트를 복사해 평소 쓰는 AI에 붙여넣고 실행하세요. 아이디어는
              프롬프트에 자동으로 채워집니다. 결과 JSON을 2)칸에 붙여넣으면 됩니다.
            </>
          )}
        </div>

        {showPrompt && (
          <pre className="magic-box" style={{ marginTop: 10 }}>
            {magicPromptWithIdea(idea, formatId, aspectId)}
          </pre>
        )}

        {genError && (
          <p className="error" style={{ margin: "10px 0 0" }}>
            {genError}
          </p>
        )}
        {rateLimited && (
          <div className="banner" style={{ marginTop: 12 }}>
            <div style={{ marginBottom: 6, color: "var(--ink)" }}>
              지금 자동 생성이 잠시 붐벼요 (무료 한도)
            </div>
            <div style={{ marginBottom: 12 }}>
              잠깐 뒤 다시 누르면 돼요. 기다리기 싫으시면 위 프롬프트를 복사해 평소 쓰는
              AI에 붙여넣으셔도 됩니다 — 아이디어는 이미 채워 뒀어요.
            </div>
            <div className="btn-row">
              <button className="btn sm" onClick={() => copyPrompt(true)}>
                {copied ? "복사됨 — ChatGPT에 붙여넣기" : "프롬프트 복사하기"}
              </button>
              <button
                className="btn ghost sm"
                onClick={generateJson}
                disabled={genLoading}
              >
                다시 시도
              </button>
            </div>
          </div>
        )}

        {autoGen && (
          <>
            <label className="label" style={{ marginTop: 12 }}>
              어떤 AI로 만들까요?
            </label>
            <div className="preset-row" style={{ marginTop: 6 }}>
              {TEXT_PROVIDER_IDS.map((id) => (
                <button
                  key={id}
                  className={`preset ${textProvider === id ? "active" : ""}`}
                  onClick={() => onPickTextProvider(id)}
                >
                  <span className="preset-label">
                    {SERVICES[id].label}
                    {needsMyKey(id) && !keys[id] && " 🔑"}
                  </span>
                  <span className="preset-hint">
                    {SERVICES[id].free ? "무료 한도" : "유료"}
                  </span>
                </button>
              ))}
            </div>
            {needsMyKey(textProvider) && (
              <KeyInput
                service={textProvider}
                value={keys[textProvider]}
                onChange={(k) => setKey(textProvider, k)}
              />
            )}
          </>
        )}

        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => copyPrompt(false)}>
            {copied ? "복사됨 ✓" : "프롬프트 복사"}
          </button>
          {autoGen && (
            /* 형광 한 점은 "지금 할 일"을 따라 옮겨간다.
               2)칸이 이미 채워졌다면 주인공은 아래 "보드 만들기"다. */
            <button
              className={`btn ${raw.trim() ? "" : "primary"}`}
              onClick={generateJson}
              disabled={!idea.trim() || genLoading || !canGenerate}
              title={
                !canGenerate
                  ? `${SERVICES[textProvider].label} 키를 먼저 넣어 주세요`
                  : idea.trim()
                  ? ""
                  : "아이디어를 먼저 적어 주세요"
              }
            >
              {genLoading
                ? "생성 중…"
                : `${SERVICES[textProvider].label}로 JSON 생성 ↓`}
            </button>
          )}
        </div>

        {/* "설정을 못 물어봤다"와 "물어봤더니 꺼져 있다"는 다른 문제다.
            둘을 같은 안내문으로 뭉뚱그리면, 설정을 이미 끝낸 사람이
            멀쩡한 .env.local을 뒤지게 된다. */}
        {availFailed ? (
          <div className="hint" style={{ marginTop: 10 }}>
            설정을 확인하지 못했어요 — 서버에 연결하지 못했습니다.{" "}
            <strong>.env.local 문제가 아닐 수 있어요.</strong> dev 서버가 떠 있는지
            확인한 뒤 다시 시도해 주세요.{" "}
            <button
              className="btn"
              style={{ marginLeft: 6, padding: "2px 10px" }}
              onClick={onRetryAvail}
            >
              다시 시도
            </button>
          </div>
        ) : (
          /* 키가 없으면 버튼 자체가 없어서 "이런 기능이 없나?"로 읽힌다.
             켜는 방법을 한 줄로 알려준다. */
          !autoGen && (
            <div className="hint" style={{ marginTop: 10 }}>
              .env.local에 <code>NEXT_PUBLIC_TEXT_PROVIDER</code>(groq/gemini/openai)와 키를
              넣고 dev 서버를 재시작하면, 여기서 <strong>JSON 생성</strong> 버튼을 쓸 수
              있어요. Groq·Gemini는 무료 한도가 있습니다.
            </div>
          )
        )}
      </div>

      <div className="panel">
        <strong>2) AI가 만들어준 JSON을 여기에 붙여넣기</strong>
        <div className="spacer" />
        <textarea
          ref={jsonRef}
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
            {error}
          </p>
        )}
        {warnings.length > 0 && (
          <ul className="warn" style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}
        {imagePicker}

        <div className="btn-row" style={{ marginTop: 14 }}>
          <button
            className={`btn ${raw.trim() ? "primary" : ""}`}
            onClick={submit}
            disabled={!raw.trim()}
          >
            보드 만들기 →
          </button>
          <button
            className="btn ghost sm"
            onClick={() => {
              setRaw(exampleJsonFor(formatId));
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
