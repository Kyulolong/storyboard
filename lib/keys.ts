import { KEY_HEADER, ServiceId } from "./providers";

// 사용자가 넣은 API 키를 브라우저에서 다루는 방식.
//
// 원칙:
//  - localStorage를 쓰지 않는다. 영구 저장은 XSS 한 방에 키가 통째로 털린다.
//  - sessionStorage만 쓴다 → 탭을 닫으면 사라진다.
//  - 서버로는 요청 헤더로만 보내고, 서버는 저장하지 않는다.
//  - 어디에도 업로드/동기화하지 않는다.
const STORAGE_KEY = "storyboard.keys";

export type KeyMap = Partial<Record<ServiceId, string>>;

export function loadKeys(): KeyMap {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as KeyMap) : {};
  } catch {
    return {};
  }
}

export function saveKeys(keys: KeyMap): void {
  try {
    // 빈 값은 아예 저장하지 않는다.
    const clean: KeyMap = {};
    for (const [k, v] of Object.entries(keys)) {
      if (v && v.trim()) clean[k as ServiceId] = v.trim();
    }
    if (Object.keys(clean).length === 0) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  } catch {
    /* 저장 못 해도 이번 세션 동안은 메모리 값으로 동작한다 */
  }
}

export function clearKeys(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

// 요청에 실을 헤더. 키가 없으면 헤더 자체를 안 붙인다
// (서버가 자기 키로 처리하는 경우와 구분되어야 한다).
export function keyHeader(key?: string): Record<string, string> {
  return key?.trim() ? { [KEY_HEADER]: key.trim() } : {};
}

// 화면에 보여줄 때는 통째로 노출하지 않는다(어깨너머/스크린샷).
export function maskKey(key: string): string {
  const k = key.trim();
  if (k.length <= 8) return "•".repeat(k.length);
  return `${k.slice(0, 4)}${"•".repeat(Math.min(12, k.length - 8))}${k.slice(-4)}`;
}
