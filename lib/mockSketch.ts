import { Cut } from "./types";

// 비용 0짜리 mock 스케치.
// 컷 내용에 따라 세로 9:16 "러프 스토리보드 스케치" 느낌의 SVG를 결정적으로 생성한다.
// => API 키 없이도 앱이 처음부터 끝까지 돌아가게 하는 안전장치.
// fal 연결 후에는 이 함수 대신 실제 이미지 URL이 들어온다.

const W = 360;
const H = 640;

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32: 시드 기반 결정적 난수 (같은 컷 => 같은 그림)
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// 한글/영문 혼용 텍스트를 대략적인 글자 수로 줄바꿈
function wrap(text: string, perLine: number, maxLines: number): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  const lines: string[] = [];
  let cur = "";
  for (const ch of clean) {
    if (cur.length >= perLine) {
      lines.push(cur);
      cur = "";
      if (lines.length >= maxLines - 1) break;
    }
    cur += ch;
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (clean.length > lines.join("").length) {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/.$/, "…");
  }
  return lines;
}

type Framing = "xclose" | "close" | "medium" | "wide";

function framingOf(shot?: string): Framing {
  const s = (shot || "").toLowerCase();
  if (s.includes("익스트림클로즈") || s.includes("extreme close")) return "xclose";
  if (s.includes("클로즈") || s.includes("close")) return "close";
  if (s.includes("롱") || s.includes("long") || s.includes("wide") || s.includes("풀"))
    return "wide";
  return "medium";
}

const STROKE = `stroke="#3a3630" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"`;

function pick(r: () => number, n: number): number {
  return Math.floor(r() * n);
}

// 눈: 점 / 웃는 곡선 / 놀란 동그란 눈 중 하나
function eyesMarkup(cx: number, ey: number, ex: number, r: () => number): string {
  const style = pick(r, 3);
  if (style === 0) {
    const er = 5 + pick(r, 3);
    return `<circle cx="${cx - ex}" cy="${ey}" r="${er}" fill="#3a3630"/><circle cx="${cx + ex}" cy="${ey}" r="${er}" fill="#3a3630"/>`;
  }
  if (style === 1) {
    return `<path d="M ${cx - ex - 9} ${ey + 2} Q ${cx - ex} ${ey - 7} ${cx - ex + 9} ${ey + 2}" ${STROKE}/><path d="M ${cx + ex - 9} ${ey + 2} Q ${cx + ex} ${ey - 7} ${cx + ex + 9} ${ey + 2}" ${STROKE}/>`;
  }
  return `<circle cx="${cx - ex}" cy="${ey}" r="9" ${STROKE}/><circle cx="${cx - ex}" cy="${ey}" r="3" fill="#3a3630"/><circle cx="${cx + ex}" cy="${ey}" r="9" ${STROKE}/><circle cx="${cx + ex}" cy="${ey}" r="3" fill="#3a3630"/>`;
}

// 눈썹: 없음 / 걱정 / 놀람 각도
function browsMarkup(cx: number, by: number, ex: number, r: () => number): string {
  const style = pick(r, 3);
  if (style === 0) return "";
  const t = style === 1 ? 6 : -6;
  return `<line x1="${cx - ex - 10}" y1="${by + t}" x2="${cx - ex + 8}" y2="${by - t}" ${STROKE}/><line x1="${cx + ex - 8}" y1="${by - t}" x2="${cx + ex + 10}" y2="${by + t}" ${STROKE}/>`;
}

// 입: 미소 / 찡그림 / 벌린 입(놀람) / 무표정
function mouthMarkup(cx: number, my: number, r: () => number): string {
  const m = pick(r, 4);
  const w = 14 + pick(r, 14);
  if (m === 0) return `<path d="M ${cx - w} ${my} Q ${cx} ${my + 16} ${cx + w} ${my}" ${STROKE}/>`;
  if (m === 1) return `<path d="M ${cx - w} ${my + 6} Q ${cx} ${my - 12} ${cx + w} ${my + 6}" ${STROKE}/>`;
  if (m === 2)
    return `<ellipse cx="${cx}" cy="${my + 2}" rx="${7 + pick(r, 7)}" ry="${9 + pick(r, 9)}" ${STROKE}/>`;
  return `<line x1="${cx - w}" y1="${my}" x2="${cx + w}" y2="${my}" ${STROKE}/>`;
}

// 얼굴: 크기/표정/기울기를 시드로 다양화
function head(cx: number, cy: number, hr: number, r: () => number): string {
  const ex = hr * (0.34 + r() * 0.08);
  const ey = cy - hr * 0.16;
  const by = ey - hr * 0.26;
  const my = cy + hr * 0.34;
  const tilt = ((r() - 0.5) * 18).toFixed(1);
  return `<g transform="rotate(${tilt} ${cx} ${cy})">
    <circle cx="${cx}" cy="${cy}" r="${hr}" ${STROKE}/>
    ${browsMarkup(cx, by, ex, r)}
    ${eyesMarkup(cx, ey, ex, r)}
    ${mouthMarkup(cx, my, r)}
  </g>`;
}

// 프레이밍별로 인물을 러프 라인으로 그린다. 위치/크기/포즈를 시드로 흔든다.
function figure(f: Framing, r: () => number): string {
  const cx = W / 2 + (r() - 0.5) * 40;

  if (f === "wide") {
    const gy = H * (0.66 + r() * 0.08);
    const hy = gy - 128;
    const aL = 0.4 + r() * 0.9;
    const aR = 0.4 + r() * 0.9;
    return `
      <line x1="30" y1="${gy}" x2="${W - 30}" y2="${gy}" stroke="#b8b1a2" stroke-width="1.6"/>
      ${head(cx, hy, 16, r)}
      <line x1="${cx}" y1="${hy + 16}" x2="${cx}" y2="${gy - 40}" ${STROKE}/>
      <line x1="${cx}" y1="${hy + 36}" x2="${cx - 26 * aL}" y2="${hy + 62}" ${STROKE}/>
      <line x1="${cx}" y1="${hy + 36}" x2="${cx + 26 * aR}" y2="${hy + 62}" ${STROKE}/>
      <line x1="${cx}" y1="${gy - 40}" x2="${cx - 18}" y2="${gy}" ${STROKE}/>
      <line x1="${cx}" y1="${gy - 40}" x2="${cx + 18}" y2="${gy}" ${STROKE}/>`;
  }

  if (f === "medium") {
    const hy = H * (0.31 + r() * 0.05);
    const hr = 46 + pick(r, 14);
    const shoulderY = hy + hr + 24;
    const sw = 76 + pick(r, 34);
    return `
      ${head(cx, hy, hr, r)}
      <path d="M ${cx - sw} ${H} C ${cx - sw + 6} ${shoulderY + 40}, ${cx - sw * 0.7} ${shoulderY}, ${cx - hr * 0.7} ${hy + hr - 6}" ${STROKE}/>
      <path d="M ${cx + sw} ${H} C ${cx + sw - 6} ${shoulderY + 40}, ${cx + sw * 0.7} ${shoulderY}, ${cx + hr * 0.7} ${hy + hr - 6}" ${STROKE}/>`;
  }

  // close / xclose: 큰 얼굴
  const hy = H * (f === "xclose" ? 0.5 : 0.46);
  const hr = f === "xclose" ? 150 + pick(r, 20) : 104 + pick(r, 24);
  return head(cx, hy, hr, r);
}

function hookMark(r: () => number): string {
  const x = 300 + (r() - 0.5) * 20;
  const y = 120;
  const spikes: string[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (Math.PI * 2 * i) / 12;
    const rr = i % 2 === 0 ? 30 : 15;
    spikes.push(`${x + Math.cos(a) * rr},${y + Math.sin(a) * rr}`);
  }
  return `<polygon points="${spikes.join(" ")}" fill="#ffb454" opacity="0.9"/>
    <text x="${x}" y="${y + 5}" font-size="13" font-weight="700" text-anchor="middle" fill="#1a1205">HOOK</text>`;
}

// SVG 마크업 문자열 생성. variant를 바꾸면 같은 컷이라도 다른 러프 스케치가 나온다
// (mock 재생성 시 "다시 그려졌다"는 느낌을 주기 위함).
export function mockSketchSvg(cut: Cut, variant = 0): string {
  const seed = hashSeed(`${cut.no}|${cut.description}|${cut.shot ?? ""}|${variant}`);
  const r = rng(seed);
  const f = framingOf(cut.shot);

  const descLines = wrap(cut.description || "", 18, 3);
  const descText = descLines
    .map(
      (ln, i) =>
        `<text x="20" y="${H - 66 + i * 20}" font-size="15" fill="#4a453d">${esc(ln)}</text>`
    )
    .join("");

  const shotLabel = cut.shot
    ? `<text x="20" y="34" font-size="14" fill="#6a655b" font-weight="600">${esc(
        cut.shot
      )}</text>`
    : "";

  const rough = `filter="url(#pencil)"`;

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="mock sketch">
  <defs>
    <filter id="pencil" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.02 0.03" numOctaves="2" seed="${
        seed % 100
      }" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.2" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
  </defs>
  <rect x="0" y="0" width="${W}" height="${H}" fill="#f6f4ee"/>
  <g ${rough}>
    <rect x="10" y="10" width="${W - 20}" height="${H - 20}" fill="none" stroke="#8a8577" stroke-width="2"/>
    ${figure(f, r)}
  </g>
  ${shotLabel}
  ${cut.is_hook ? hookMark(r) : ""}
  <rect x="0" y="${H - 92}" width="${W}" height="92" fill="#f6f4ee" opacity="0.86"/>
  <line x1="16" y1="${H - 90}" x2="${W - 16}" y2="${H - 90}" stroke="#d9d4c8" stroke-width="1.5"/>
  ${descText}
  <text x="${W - 16}" y="30" font-size="11" text-anchor="end" fill="#b8b1a2">SKETCH · mock</text>
</svg>`;
}

// <img src>에 바로 쓸 수 있는 data URL
export function mockSketchDataUrl(cut: Cut, variant = 0): string {
  const svg = mockSketchSvg(cut, variant);
  const encoded = encodeURIComponent(svg).replace(/'/g, "%27").replace(/"/g, "%22");
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}
