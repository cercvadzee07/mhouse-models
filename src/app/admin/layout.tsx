import type { Metadata, Viewport } from "next";
import "../globals.css";
import { fontVariables } from "../fonts";
import { isSupabaseConfigured } from "@/lib/env";
import { ConfirmProvider, ToastProvider } from "@/components/admin/ui";
import { SetupNotice } from "@/components/admin/SetupNotice";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#f6f5f2" };
export const dynamic = "force-dynamic";

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="admin-root min-h-screen antialiased">
        <ToastProvider>
          <ConfirmProvider>{isSupabaseConfigured() ? children : <SetupNotice />}</ConfirmProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
