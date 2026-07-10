import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "릴스 콘티 → 스케치 보드",
  description: "콘티 글을 세로 러프 스케치 보드로 바꿔주는 MVP",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
