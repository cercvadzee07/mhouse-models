import type { Metadata, Viewport } from "next";
import "../globals.css";
import { fontVariables } from "../fonts";

export const metadata: Metadata = {
  title: "Private preview",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#f4f1eb", width: "device-width", initialScale: 1 };

export default function AccessLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ka" className={fontVariables}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
