import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "직업 조사 도우미",
  description: "초등 진로수업 직업 탐구 챗봇",
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
