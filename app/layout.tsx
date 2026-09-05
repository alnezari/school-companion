import type { Metadata, Viewport } from "next";
import { Nunito, IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { MotionProvider } from "@/components/MotionProvider";

const nunito = Nunito({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-nunito" });
const plex = IBM_Plex_Sans_Arabic({ subsets: ["arabic", "latin"], weight: ["400", "500", "600"], variable: "--font-plex" });

export const metadata: Metadata = {
  title: "Tomorrow First",
  description: "Taym's school companion",
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "Tomorrow", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: "#F27D26", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${nunito.variable} ${plex.variable} min-h-dvh`}><MotionProvider>{children}</MotionProvider></body>
    </html>
  );
}
