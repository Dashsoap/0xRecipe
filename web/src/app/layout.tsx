import type { Metadata } from "next";

import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "0xRecipe",
  description: "Fusion 模型市场 · 链上预付与原子分账",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
