# 🎬 릴스 콘티 → 스케치 보드 (MVP)

콘티 **글**을 세로(9:16) **러프 스케치 보드**로 바꿔주는 서비스.
글 생성은 하지 않는다 — 사용자가 자기 LLM으로 콘티 글을 만들어오면, 우리는 **그림과 보드**만 책임진다.

## 입력 방법 2가지
- **A. JSON 붙여넣기**: 앱이 제공하는 "마법 프롬프트"를 사용자의 ChatGPT/Claude에 붙여넣어 JSON을 받고, 그걸 붙여넣으면 보드가 생성됨. (LLM 통합/키/비용 0)
- **B. 직접 입력**: 컷별로 샷/화면묘사/자막/대사/촬영팁을 폼에 입력. 예시가 미리 채워져 있음.

## 이미지 생성
`generateSketch()` 추상화로 provider를 교체한다.
- `mock` (기본): 클라이언트에서 SVG 러프 스케치를 즉시 생성. **비용 0, 키 불필요.** 개발·데모용.
- `fal`: fal.ai의 **FLUX.1 [schnell]** 로 실제 스케치 생성. 저비용·고속. 키는 서버에만 둔다.

## 실행
```bash
npm install
npm run dev
# http://localhost:3000
```

## 실제 그림으로 전환 (선택)
`.env.example`을 `.env.local`로 복사하고:
```
NEXT_PUBLIC_IMAGE_PROVIDER=fal
FAL_KEY=발급받은_fal_키
```
`FAL_KEY`는 서버(`app/api/sketch`)에서만 사용되며 브라우저에 노출되지 않는다.
fal 호출이 실패하면 자동으로 mock으로 폴백해 콘티가 끊기지 않는다.

## 구조
```
app/
  page.tsx           입력/보드 뷰 전환 (클라이언트 상태)
  api/sketch/route.ts  이미지 생성 (fal | mock 폴백)
components/
  InputScreen.tsx    탭 A(붙여넣기) / B(직접입력)
  ManualForm.tsx     직접 입력 폼 (+ 예시 프리필)
  Board.tsx          보드: 컷별 스케치 생성 + 컷 단위 재생성
  CutCard.tsx        세로 9:16 컷 카드
lib/
  types.ts           Cut 데이터 구조
  parse.ts           JSON 관대 파싱 (한/영 키, 코드펜스 허용)
  magicPrompt.ts     사용자 LLM에 붙여넣는 마법 프롬프트
  examples.ts        예시 콘티 (탭 A 예시 JSON / 탭 B 프리필)
  mockSketch.ts      비용 0 SVG 러프 스케치 생성기
  sketch.ts          generateSketch(): provider 분기
```

## MVP 범위
- 자동 생성은 최초 1회. 재생성은 **컷 단위**로 수동(안 보는 그림에 비용 X).
- 전체 재생성/편집/로그인/저장은 범위 밖.
