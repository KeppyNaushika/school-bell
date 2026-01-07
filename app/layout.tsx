import type { Metadata } from "next"
import { M_PLUS_Rounded_1c } from "next/font/google"
import "./globals.css"

export const metadata: Metadata = {
  title: "学校チャイムアラーム",
  description:
    "学校の時間割をもとにチャイム時刻を表示・設定できる全画面タイマー",
}

const mPlus = M_PLUS_Rounded_1c({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mplus",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja" className="dark">
      <body
        className={`${mPlus.variable} min-h-screen antialiased`}
        style={{
          fontFamily:
            'var(--font-mplus), "M PLUS Rounded 1c", "M PLUS 1p", "BIZ UDPGothic", "Yu Gothic", "Noto Sans JP", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        {children}
      </body>
    </html>
  )
}
