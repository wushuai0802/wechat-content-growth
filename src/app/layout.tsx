import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "公众号内容增长系统",
  description: "AI 驱动的公众号选题、生产、审核、收益优化后台"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
