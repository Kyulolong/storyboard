// next.config.mjs의 basePath를 코드에서 다시 쓰기 위한 통로.
//
// Next의 basePath는 <Link>와 _next 자산에만 붙는다. fetch()가 받는 문자열은
// Next가 들여다보지 않으므로, 서브경로 배포에서 fetch("/api/...")는
// kyulolong.com/api/... 로 나가서 우리 앱에 닿지도 못한다.
// API를 부를 땐 반드시 apiPath()를 거쳐야 하는 이유다.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** "/api/generate" → "/storyboard/api/generate" */
export function apiPath(path: string): string {
  return `${BASE_PATH}${path}`;
}
