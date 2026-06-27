import type { Metadata, Viewport } from "next";
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

// Lock the viewport so pinch-zoom doesn't fight the WebGL canvas on touch
// (the canvas already sets touch-action: none and runs its own orbit/zoom).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0f110d",
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
      {/* suppressHydrationWarning: browser extensions (Grammarly etc.) inject
          attributes like contenteditable on <body> before React hydrates. */}
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
