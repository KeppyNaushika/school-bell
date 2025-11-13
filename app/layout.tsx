import type { Metadata } from "next";
import { M_PLUS_1_Code } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  title: "学校チャイムタイマー",
  description:
    "学校の時間割をもとにチャイム時刻を表示・設定できる全画面タイマー",
};

const mPlus = M_PLUS_1_Code({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mplus",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={mPlus.variable}>{children}</body>
    </html>
  );
}
