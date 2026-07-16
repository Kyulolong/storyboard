import { Aspect, Format, getFormat, resolveAspect } from "./formats";

// 사용자가 자기 ChatGPT/Claude에 그대로 붙여넣는 "마법 프롬프트".
// 우리 앱이 파싱할 수 있는 정확한 JSON을 뽑아내도록 스키마와 연출 규칙을 심어둔다.
// => LLM 통합/키/비용 없이 유저의 무료 LLM을 빌려쓰는 핸드오프 방식.
//
// 연출 규칙은 포맷 프리셋(lib/formats.ts)에서 가져온다. 자동 생성(api/generate)도
// 같은 문장을 쓰므로, 규칙을 한 번 고치면 두 경로가 함께 따라온다.

const IDEA_PLACEHOLDER = "<여기에 아이디어를 적으세요>";

// Cut 타입은 포맷과 무관하게 하나뿐이라 스키마는 공통이다.
// 다만 같은 필드를 뭐라고 부르는지는 포맷마다 다르다(릴스의 "자막" = 광고의 "카피").
function fieldGuide(f: Format): string {
  return `- no: 컷 번호(1부터)
- duration_sec: 컷 길이(초)
- is_hook: 훅 컷이면 true (보통 1번 컷)
- shot: 샷 사이즈 (익스트림롱샷/롱샷/미디엄샷/클로즈업/익스트림클로즈업 등)
- description: 화면에 보이는 그림 묘사. 스케치로 그릴 소스라 "무엇이 어떻게 보이는지" 구체적으로.
- dialogue: ${f.labels.dialogue} (없으면 "")
- caption: ${f.labels.caption} (없으면 "")
- shooting_tip: ${f.labels.tip} 노트 한 줄`;
}

function schemaExample(f: Format): string {
  return `{
  "cuts": [
    ${f.exampleCut}
  ]
}`;
}

// 자동 생성(서버 Groq 라우트)용 시스템 프롬프트.
// 마법 프롬프트와 같은 규칙을 공유하되, 형식 안내만 API용으로 줄인다.
export function systemPromptFor(format: Format, aspect: Aspect): string {
  return `너는 ${format.role} 콘티 전문가야. 사용자의 [아이디어]를 ${aspect.label} 콘티로 만든다.

규칙:
${format.rules}
- 반드시 사용자의 아이디어 주제만 사용해. 절대 다른 주제로 바꾸지 마.

출력: 설명/인사말 없이 오직 JSON 하나만. 값은 한국어.
스키마: {"cuts":[{"no":number,"duration_sec":number,"is_hook":boolean,"shot":string,"description":string,"dialogue":string,"caption":string,"shooting_tip":string}]}`;
}

// 붙여넣기용 마법 프롬프트 전문.
export function magicPromptFor(format: Format, aspect: Aspect): string {
  return `너는 ${format.role} 콘티 전문가야.
아래 [내 아이디어]를 ${aspect.label} 콘티로 만들어줘.

# 규칙
${format.rules}

# 출력 형식 (아주 중요)
- 설명/인사말 없이 아래 JSON "만" 출력해.
- 반드시 이 스키마를 지켜. 값은 한국어로.

\`\`\`json
${schemaExample(format)}
\`\`\`

# 필드 설명
${fieldGuide(format)}

# 내 아이디어
${IDEA_PLACEHOLDER}`;
}

// 유저가 입력한 아이디어를 마법 프롬프트의 자리표시자에 끼워 넣는다.
// (자동 생성이 rate limit에 걸렸을 때, 아이디어가 채워진 프롬프트를 바로 복사해주기 위함)
export function magicPromptWithIdea(
  idea: string,
  formatId?: string,
  aspectId?: string
): string {
  const format = getFormat(formatId);
  const aspect = resolveAspect(format, aspectId);
  const base = magicPromptFor(format, aspect);
  const trimmed = (idea || "").trim();
  return trimmed ? base.replace(IDEA_PLACEHOLDER, trimmed) : base;
}
