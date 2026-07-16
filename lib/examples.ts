import { Cut } from "./types";
import { FormatId } from "./formats";

// 탭 A(붙여넣기) 예시 & 탭 B(수동 폼) 프리필에 공용으로 쓰는 샘플 콘티.
// 포맷마다 따로 두는 이유: 광고를 골라놓고 "예시"를 눌렀는데 릴스 콘티가 나오면
// 그 포맷이 뭘 만들어주는 도구인지 오히려 헷갈린다.
//
// 주제: "다이어트 중 먹어도 되는 야식 3가지" 릴스
export const EXAMPLE_CUTS: Cut[] = [
  {
    no: 1,
    duration_sec: 2,
    is_hook: true,
    shot: "클로즈업",
    description:
      "냉장고 문을 확 열고 카메라를 향해 놀란 표정. 야식이 먹고 싶어 참는 얼굴",
    dialogue: "다이어트 중인데 야식 땡길 때…",
    caption: "살 안 찌는 야식 3개",
    shooting_tip: "삼각대를 냉장고 옆에. 문 여는 순간 포착",
  },
  {
    no: 2,
    duration_sec: 3,
    is_hook: false,
    shot: "미디엄샷",
    description: "손가락 하나를 펴 보이며 그릭요거트 통을 카메라에 내민다",
    dialogue: "첫 번째, 그릭요거트",
    caption: "① 그릭요거트 (단백질 폭탄)",
    shooting_tip: "제품 라벨이 보이게 카메라 쪽으로",
  },
  {
    no: 3,
    duration_sec: 3,
    is_hook: false,
    shot: "클로즈업",
    description: "접시 위 방울토마토를 포크로 콕 찍는 손 인서트 컷",
    dialogue: "두 번째, 방울토마토",
    caption: "② 방울토마토 (밤에 부담 0)",
    shooting_tip: "손 인서트. 테이블에 폰 눕혀 탑다운으로",
  },
  {
    no: 4,
    duration_sec: 3,
    is_hook: false,
    shot: "미디엄샷",
    description: "삶은 계란 두 개를 양손에 들고 카메라 향해 웃는다",
    dialogue: "세 번째, 삶은 계란",
    caption: "③ 삶은 계란 (포만감 甲)",
    shooting_tip: "밝은 창가, 얼굴+손 함께 프레임에",
  },
  {
    no: 5,
    duration_sec: 2,
    is_hook: false,
    shot: "클로즈업",
    description: "카메라를 손가락으로 가리키며 저장하라는 제스처",
    dialogue: "까먹지 말고 저장!",
    caption: "🔖 저장 필수",
    shooting_tip: "손가락이 렌즈 쪽으로 오게",
  },
];

// 주제: "콜드브루 신제품" 30초 광고.
// 광고 규칙(제품 클로즈업 컷 + 로고/슬로건 CTA 마무리)을 실제로 따르는 예시라야
// 이 포맷이 뭘 뽑아주는지 보여줄 수 있다.
export const AD_EXAMPLE_CUTS: Cut[] = [
  {
    no: 1,
    duration_sec: 2,
    is_hook: true,
    shot: "익스트림클로즈업",
    description:
      "얼음이 가득한 잔에 콜드브루가 쏟아진다. 잔 표면에 물방울이 맺히고 김이 서린다",
    dialogue: "",
    caption: "당신의 아침이 달라진다",
    shooting_tip: "역광 하이키, 240fps 슬로우모션, 차가운 톤앤매너",
  },
  {
    no: 2,
    duration_sec: 4,
    is_hook: false,
    shot: "미디엄샷",
    description:
      "알람에 겨우 눈을 뜨는 20대 직장인. 무거운 표정으로 침대에 걸터앉아 있다",
    dialogue: "매일 아침이 무거운 당신에게",
    caption: "또 시작된 월요일",
    shooting_tip: "저채도 차가운 조명, 핸드헬드로 나른한 느낌",
  },
  {
    no: 3,
    duration_sec: 4,
    is_hook: false,
    shot: "클로즈업",
    description: "콜드브루를 한 모금 마시자 표정이 확 밝아진다",
    dialogue: "단 한 모금이면 충분합니다",
    caption: "한 모금의 반전",
    shooting_tip: "창가 자연광으로 전환. 컷 전후 색온도를 대비시킬 것",
  },
  {
    no: 4,
    duration_sec: 3,
    is_hook: false,
    shot: "익스트림클로즈업",
    description: "제품 패키지가 정면으로 보이도록 테이블에 놓인 콜드브루 병",
    dialogue: "14시간 콜드 브루잉",
    caption: "진하게, 부드럽게",
    shooting_tip: "제품 인서트. 라벨 정면 고정, 얕은 심도로 배경 날리기",
  },
  {
    no: 5,
    duration_sec: 3,
    is_hook: false,
    shot: "롱샷",
    description: "잔을 들고 사무실로 경쾌하게 걸어 들어가는 뒷모습",
    dialogue: "오늘을 가볍게 시작하세요",
    caption: "가볍게 시작하는 하루",
    shooting_tip: "달리 트래킹, 밝은 하이키 톤",
  },
  {
    no: 6,
    duration_sec: 3,
    is_hook: false,
    shot: "미디엄샷",
    description: "흰 배경 위 제품과 브랜드 로고. 하단에 구매 안내 문구",
    dialogue: "지금, 편의점에서",
    caption: "브랜드 로고 + 지금 만나보세요",
    shooting_tip: "CTA 컷. 로고 중앙 정렬, 3초 홀드",
  },
];

const CUTS_BY_FORMAT: Record<FormatId, Cut[]> = {
  reels: EXAMPLE_CUTS,
  ad: AD_EXAMPLE_CUTS,
};

export function exampleCutsFor(format: FormatId): Cut[] {
  // 폼에서 편집할 수 있어야 하므로 항상 복사본을 준다.
  return (CUTS_BY_FORMAT[format] ?? EXAMPLE_CUTS).map((c) => ({ ...c }));
}

// 붙여넣기 예시용 JSON 문자열 (마법 프롬프트 결과와 동일한 형태)
export function exampleJsonFor(format: FormatId): string {
  return JSON.stringify({ cuts: exampleCutsFor(format) }, null, 2);
}
