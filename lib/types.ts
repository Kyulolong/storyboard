// 콘티의 컷 하나를 표현하는 핵심 데이터 구조.
// 그림(sketch)이 실패해도 이 필드들만으로 콘티 표가 성립하도록 설계한다.
export interface Cut {
  no: number; // 컷 번호 (1부터, 순차 재정렬됨)
  duration_sec?: number; // 컷 길이(초)
  is_hook?: boolean; // 훅 컷 여부 (릴스 첫 1~2초 이탈 방지용)
  shot?: string; // 샷 사이즈: 클로즈업 / 미디엄샷 / 롱샷 등
  description: string; // 화면 묘사 → 이미지 생성의 소스 (필수)
  dialogue?: string; // 대사 / 나레이션
  caption?: string; // 화면 자막 (릴스는 자막이 연출 요소)
  shooting_tip?: string; // 혼자 찍는 사람용 촬영 팁
}

export function emptyCut(no: number): Cut {
  return {
    no,
    duration_sec: undefined,
    is_hook: false,
    shot: "",
    description: "",
    dialogue: "",
    caption: "",
    shooting_tip: "",
  };
}
