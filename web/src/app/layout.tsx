import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

import "./globals.css";
import { Providers } from "./providers";
import { MeshBackground } from "@/components/visuals/MeshBackground";
import { GrainOverlay } from "@/components/visuals/GrainOverlay";

export const metadata: Metadata = {
  title: "0xRecipe · 按调用付费的多模型融合",
  description:
    "让 AI 智能体免注册、免密钥，用链上稳定币按次调用多模型融合；每次付款实时分账给创作者与平台。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="zh"
      className={`dark ${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="font-sans antialiased">
        {/* Ambient background layers — fixed, beneath all content. */}
        <MeshBackground />
        <GrainOverlay />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
