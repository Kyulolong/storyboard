/** @type {import('next').NextConfig} */

// 이 앱은 kyulolong.com "/storyboard" 아래에 얹혀 산다.
// basePath를 주면 Next가 페이지 라우팅과 _next/static 자산 주소를 알아서
// 이 접두어 밑으로 옮긴다 — 단, fetch()는 손대주지 않으므로
// 클라이언트에서 API를 부를 땐 lib/basePath.ts의 apiPath()를 써야 한다.
//
// Traefik(Coolify) 쪽에서 접두어를 떼어내면(strip prefix) 컨테이너는 "/"를
// 받게 되고, basePath를 기대하는 Next는 그걸 404로 돌려준다.
// 그래서 Coolify Advanced의 Strip Prefix는 반드시 꺼야 한다.
const basePath = "/storyboard";

const nextConfig = {
  reactStrictMode: true,

  // Coolify가 Dockerfile로 굽는다. standalone은 실행에 필요한 node_modules만
  // 추린 server.js를 뱉어서, 런타임 이미지에 소스와 devDependencies를 안 넣어도 된다.
  output: "standalone",

  basePath,

  // basePath를 클라이언트 번들에도 흘려보낸다. 접두어를 한 곳에서만 고치려는 것.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
