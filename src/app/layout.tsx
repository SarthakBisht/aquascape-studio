import type { Metadata } from "next";
import { Zen_Old_Mincho, Zen_Kaku_Gothic_New } from "next/font/google";
import "./globals.css";

// The "Zen" type family (by Yoshimichi Ohira) — a serene mincho serif for the
// wordmark + poetry, and a calm gothic for the interface.
const zenMincho = Zen_Old_Mincho({
  variable: "--font-zen-mincho",
  subsets: ["latin"],
  weight: ["400", "600"],
});

const zenKaku = Zen_Kaku_Gothic_New({
  variable: "--font-zen-kaku",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Aquascape Studio",
  description:
    "Design 3D aquarium hardscape layouts — place rocks, driftwood & plants, then flood the tank for an underwater view. Learn from nature.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${zenMincho.variable} ${zenKaku.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
