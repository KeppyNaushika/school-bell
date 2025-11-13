import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "学校チャイムタイマー",
  description:
    "学校の時間割をもとにチャイム時刻を表示・設定できる全画面タイマー",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
