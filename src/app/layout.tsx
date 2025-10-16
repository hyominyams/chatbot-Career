import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CareerBuddy",
  description: "초등 진로수업 진로 탐구 챗봇",
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
