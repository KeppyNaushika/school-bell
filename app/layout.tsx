import type { Metadata } from "next";
import { Zen_Maru_Gothic } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  title: "学校チャイムタイマー",
  description:
    "学校の時間割をもとにチャイム時刻を表示・設定できる全画面タイマー",
};

const zenMaru = Zen_Maru_Gothic({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-zen-maru",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={zenMaru.variable}>{children}</body>
    </html>
  );
}
