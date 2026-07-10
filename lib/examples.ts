import { Cut } from "./types";

// 탭 A(붙여넣기) 예시 & 탭 B(수동 폼) 프리필에 공용으로 쓰는 샘플 콘티.
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

// 붙여넣기 예시용 JSON 문자열 (마법 프롬프트 결과와 동일한 형태)
export const EXAMPLE_JSON = JSON.stringify({ cuts: EXAMPLE_CUTS }, null, 2);
