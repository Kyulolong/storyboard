"use client";

import { useState } from "react";
import { SERVICES, ServiceId } from "@/lib/providers";
import { maskKey } from "@/lib/keys";

// 사용자가 자기 API 키를 넣는 칸(BYOK).
// 서버가 그 서비스의 키를 이미 갖고 있으면 이 칸은 뜨지 않는다.
export default function KeyInput({
  service,
  value,
  onChange,
}: {
  service: ServiceId;
  value?: string;
  onChange: (key: string | undefined) => void;
}) {
  const meta = SERVICES[service];
  const [editing, setEditing] = useState(!value);
  const [draft, setDraft] = useState("");

  // 이미 넣은 키는 다시 보여주지 않는다(어깨너머/스크린샷 대비).
  if (value && !editing) {
    return (
      <div className="key-box saved">
        <span className="key-status">
          🔑 {meta.label} 키 입력됨 <code>{maskKey(value)}</code>
        </span>
        <div className="btn-row">
          <button
            className="btn ghost sm"
            onClick={() => {
              setDraft("");
              setEditing(true);
            }}
          >
            바꾸기
          </button>
          <button className="btn danger sm" onClick={() => onChange(undefined)}>
            지우기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="key-box">
      <label className="label">
        {meta.label} API 키{" "}
        <a href={meta.keyUrl} target="_blank" rel="noreferrer noopener">
          발급받기 ↗
        </a>
      </label>
      <div className="key-row">
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={meta.keyHint}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              onChange(draft.trim());
              setEditing(false);
            }
          }}
        />
        <button
          className="btn sm"
          disabled={!draft.trim()}
          onClick={() => {
            onChange(draft.trim());
            setEditing(false);
          }}
        >
          적용
        </button>
      </div>
      <div className="hint" style={{ marginTop: 6 }}>
        🔒 키는 <strong>이 탭에만</strong> 남고 탭을 닫으면 사라집니다. 서버에 저장하지
        않고, 요청할 때만 전달해 쓰고 버립니다.
      </div>
    </div>
  );
}
