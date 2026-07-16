// 콘티 포맷의 단일 출처.
// 화면비와 연출 규칙이 코드 곳곳에 흩어져 있으면 포맷을 하나 추가할 때마다
// 여러 파일을 손대야 하고 금방 어긋난다. 여기서만 정의하고 나머지는 파생시킨다.

// ── 화면비 ────────────────────────────────────────────────────────────────
export type AspectId = "9:16" | "4:5" | "1:1" | "16:9";

export interface Aspect {
  id: AspectId;
  label: string;
  hint: string;
  // 스케치 캔버스 크기(px). pollinations 요청 크기이자 mock SVG의 viewBox이고,
  // CSS aspect-ratio도 이 값에서 파생된다(360/640 === 9/16).
  // 작게 잡는 이유: 이미지 생성이 그만큼 빨라진다. 어차피 러프 낙서다.
  w: number;
  h: number;
  replicate: string; // flux-schnell의 aspect_ratio
  // fal의 image_size. 딱 맞는 enum이 있으면 그걸 쓰고,
  // 없으면(4:5) 실제 크기를 직접 준다 — enum을 억지로 끼우면 화면비가 틀어진다.
  fal: string | { width: number; height: number };
  // Gemini의 response_format.aspect_ratio. id와 문자열이 같지만 명시해 둔다 —
  // Gemini가 지원하지 않는 화면비를 나중에 추가할 때 여기서 막히는 게 낫다.
  gemini: string;
  // OpenAI 이미지의 size. gpt-image-2는 임의 해상도를 받지만 제약이 있다:
  // 두 변 모두 16의 배수, 총 픽셀 655,360~8,294,400, 비율 3:1 이내.
  // 그래서 스케치 캔버스(w/h)를 그대로 못 쓰고 이 조건에 맞춘 값을 따로 둔다.
  openai: string;
  // 보드 격자의 최소 열 폭(px). 세로 카드 기준(230px)을 가로 포맷에 그대로 쓰면
  // 카드가 납작해져 그림이 안 보인다. 화면비마다 읽히는 폭이 달라서 여기 같이 둔다.
  minCol: number;
}

export const ASPECTS: Record<AspectId, Aspect> = {
  "9:16": {
    id: "9:16",
    label: "세로 9:16",
    hint: "릴스 · 쇼츠 · 틱톡",
    w: 360,
    h: 640,
    replicate: "9:16",
    fal: "portrait_16_9",
    gemini: "9:16",
    openai: "720x1280",
    minCol: 230,
  },
  "4:5": {
    id: "4:5",
    label: "세로 4:5",
    hint: "인스타 피드",
    w: 448,
    h: 560,
    replicate: "4:5",
    fal: { width: 896, height: 1120 },
    gemini: "4:5",
    openai: "896x1120",
    minCol: 260,
  },
  "1:1": {
    id: "1:1",
    label: "정사각 1:1",
    hint: "피드 · 배너",
    w: 512,
    h: 512,
    replicate: "1:1",
    fal: "square_hd",
    gemini: "1:1",
    openai: "1024x1024",
    minCol: 270,
  },
  "16:9": {
    id: "16:9",
    label: "가로 16:9",
    hint: "유튜브 · TV광고",
    w: 640,
    h: 360,
    replicate: "16:9",
    fal: "landscape_16_9",
    gemini: "16:9",
    openai: "1280x720",
    minCol: 340,
  },
};

export const DEFAULT_ASPECT: AspectId = "9:16";

// ── 그림 느낌 ──────────────────────────────────────────────────────────────
// 같은 컷을 러프 낙서로 뽑을지, 사진처럼 뽑을지.
export type ImageStyleId = "sketch" | "photo";

export interface ImageStyle {
  id: ImageStyleId;
  label: string;
  hint: string;
  lead: string; // 프롬프트 앞머리 — "무엇을 그리는가"를 규정한다
  look: string; // 그림체 지시
  // pollinations의 enhance: 모델이 프롬프트에 디테일을 덧붙일지.
  // 낙서는 덧붙이면 안 되고(단순해야 한다), 실사는 덧붙는 게 이득이다.
  enhance: boolean;
}

// 스타일과 무관하게 항상 붙는 제약.
// "storyboard" 같은 단어를 쓰면 FLUX가 여러 칸짜리 시트를 그려버려서
// 컷 하나 = 그림 하나를 매번 못박아야 한다.
const FRAME_RULE =
  "show the whole scene and key props. " +
  "single image, one frame only, no grid, no panels, no split, no text, no borders";

export const IMAGE_STYLES: Record<ImageStyleId, ImageStyle> = {
  sketch: {
    id: "sketch",
    label: "러프 스케치",
    hint: "졸라맨 낙서 · 빠름",
    lead: "A simple rough doodle sketch of:",
    look:
      "minimal black ink line drawing, stick figure people, basic shapes, " +
      "thick outlines, flat, no shading, no texture, no fine detail, " +
      "crude quick doodle, plain white background.",
    enhance: false,
  },
  photo: {
    id: "photo",
    label: "실사",
    hint: "사진 같은 컷",
    lead: "A photorealistic cinematic film still of:",
    look:
      "photorealistic, shot on 35mm film, natural cinematic lighting, " +
      "realistic skin and fabric texture, shallow depth of field, " +
      "true-to-life color, professional color grading. " +
      "not a drawing, not an illustration, not a cartoon, not a sketch.",
    enhance: true,
  },
};

export const IMAGE_STYLE_IDS = Object.keys(IMAGE_STYLES) as ImageStyleId[];
export const DEFAULT_IMAGE_STYLE: ImageStyleId = "sketch";

export function getImageStyle(id?: string | null): ImageStyle {
  return IMAGE_STYLES[(id as ImageStyleId) ?? ""] ?? IMAGE_STYLES[DEFAULT_IMAGE_STYLE];
}

// 컷 하나 → 이미지 생성 프롬프트.
// 서버(app/api/sketch)에서만 쓰지만, 스타일 문구와 붙어 있어야 어긋나지 않으므로
// 프리셋 옆에 둔다.
export function buildImagePrompt(
  description: string,
  shot: string | undefined,
  style: ImageStyle
): string {
  const shotPart = shot ? ` (${shot})` : "";
  return `${style.lead} ${description}${shotPart}. ${style.look} ${FRAME_RULE}`;
}

// 외부에서 들어온 값(세션/요청 body)은 믿을 수 없으므로 항상 이걸로 정규화한다.
export function getAspect(id?: string | null): Aspect {
  return ASPECTS[(id as AspectId) ?? ""] ?? ASPECTS[DEFAULT_ASPECT];
}

// ── 콘티 포맷 ─────────────────────────────────────────────────────────────
export type FormatId = "reels" | "ad";

export interface Format {
  id: FormatId;
  label: string; // UI 버튼에 보이는 이름
  // 프롬프트에서 "너는 {role} 콘티 전문가야"에 끼우는 이름.
  // label과 따로 두는 이유: label은 UI용이라 "영상"이 붙으면 문장에서 중복된다.
  role: string;
  hint: string;
  defaultAspect: AspectId;
  aspects: AspectId[]; // 이 포맷에서 고를 수 있는 화면비
  // Cut의 필드는 포맷이 달라도 그대로 쓰되, 부르는 이름만 바꾼다.
  // (릴스의 "촬영 팁"은 광고에선 "연출 노트"다. 필드를 늘리면 파서·폼까지 번진다.)
  labels: { dialogue: string; caption: string; tip: string };
  ideaPlaceholder: string;
  // LLM에 줄 연출 규칙. 마법 프롬프트와 자동 생성이 같은 문장을 공유한다.
  rules: string;
  // 프롬프트에 넣을 JSON 예시 컷. 규칙과 결이 같아야 한다 —
  // "삼각대 쓰지 마"라면서 예시가 삼각대를 쓰면 LLM에 모순된 신호를 준다.
  exampleCut: string;
  // 폼에 채워지는 예시 콘티가 뭔지 알려주는 짧은 이름(lib/examples.ts와 짝).
  exampleLabel: string;
  // 직접 입력 폼의 tip 칸 플레이스홀더. 릴스는 촬영 장비, 광고는 연출이 관심사다.
  tipPlaceholder: string;
}

export const FORMATS: Record<FormatId, Format> = {
  reels: {
    id: "reels",
    label: "릴스 · 쇼츠",
    role: "숏폼(릴스/쇼츠) 영상",
    hint: "혼자 찍는 세로 숏폼",
    defaultAspect: "9:16",
    aspects: ["9:16", "4:5", "1:1"],
    labels: { dialogue: "대사", caption: "자막", tip: "촬영" },
    ideaPlaceholder: "예: 자취생이 김치볶음밥을 3분만에 만드는 초간단 레시피 릴스",
    rules: `- 컷은 6개 내외로 나눠줘. 릴스는 템포가 빠르니 컷당 1~4초 정도로.
- 1번 컷은 반드시 "훅(hook)"으로. 첫 1~2초에 스크롤을 멈추게 하는 강한 장면/문구.
- 등장인물은 대부분 촬영자 본인이라고 가정해(삼각대/셀카). 필요하면 인서트/B롤 컷을 섞어.
- 각 컷에 화면 자막(caption)을 넣어줘. 릴스는 자막이 연출의 일부야.
- 혼자 찍는 사람을 위한 촬영 팁(shooting_tip)을 한 줄로.`,
    exampleCut: `{
      "no": 1,
      "duration_sec": 2,
      "is_hook": true,
      "shot": "클로즈업",
      "description": "카메라를 향해 놀란 표정. 손으로 입을 가림",
      "dialogue": "이거 진짜 아무도 안 알려줘요",
      "caption": "99%가 모르는 사실",
      "shooting_tip": "삼각대, 눈높이, 얼굴 클로즈업"
    }`,
    exampleLabel: "다이어트 야식 릴스",
    tipPlaceholder: "삼각대 / 셀카 / 손 인서트 등",
  },
  ad: {
    id: "ad",
    label: "광고 · 브랜드 영상",
    role: "광고/브랜드 영상",
    hint: "시안 승인용 CF 콘티",
    defaultAspect: "16:9",
    aspects: ["16:9", "9:16", "1:1", "4:5"],
    labels: { dialogue: "나레이션", caption: "카피", tip: "연출" },
    ideaPlaceholder: "예: 20대 직장인 타깃 콜드브루 신제품 30초 광고. 아침의 활력이 컨셉",
    rules: `- 총 길이는 15초 또는 30초 규격에 맞춰. 컷은 6~8개, 컷당 2~5초.
- 1번 컷은 반드시 "훅(hook)"으로. 첫 2초에 시선을 잡는 장면.
- 제품(또는 브랜드)이 명확히 보이는 컷을 중간에 최소 1개 넣어. 제품 클로즈업/인서트.
- 마지막 컷은 반드시 CTA로 끝내: 로고 + 슬로건 + 행동 유도 문구.
- caption에는 화면에 박히는 광고 카피를 써(짧고 강하게). dialogue에는 성우 나레이션을.
- shooting_tip에는 연출 노트를 한 줄로: 조명/앵글/톤앤매너 중심.
- 모델은 전문 배우/모델이라고 가정해. 셀카·삼각대 같은 개인 촬영 전제를 쓰지 마.`,
    exampleCut: `{
      "no": 1,
      "duration_sec": 2,
      "is_hook": true,
      "shot": "익스트림클로즈업",
      "description": "얼음이 든 잔에 콜드브루가 쏟아진다. 잔 표면에 물방울이 맺힘",
      "dialogue": "아침을 깨우는 한 잔",
      "caption": "당신의 아침이 달라진다",
      "shooting_tip": "역광 하이키, 슬로우모션, 차가운 톤앤매너"
    }`,
    exampleLabel: "콜드브루 30초 광고",
    tipPlaceholder: "조명 / 앵글 / 톤앤매너 등",
  },
};

export const DEFAULT_FORMAT: FormatId = "reels";

// UI에서 프리셋을 나열할 때 쓰는 순서.
export const FORMAT_IDS = Object.keys(FORMATS) as FormatId[];

export function getFormat(id?: string | null): Format {
  return FORMATS[(id as FormatId) ?? ""] ?? FORMATS[DEFAULT_FORMAT];
}

// 포맷이 그 화면비를 허용하지 않으면 포맷의 기본값으로 되돌린다.
export function resolveAspect(format: Format, id?: string | null): Aspect {
  const wanted = id as AspectId;
  return format.aspects.includes(wanted)
    ? ASPECTS[wanted]
    : ASPECTS[format.defaultAspect];
}
