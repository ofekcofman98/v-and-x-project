import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "VocalGrid",
    template: "%s | VocalGrid",
  },
  description: "Voice-first spreadsheet data entry. Fill spreadsheets hands-free with AI-powered voice commands.",
  keywords: ["voice", "spreadsheet", "data entry", "hands-free", "AI", "voice commands"],
  authors: [{ name: "VocalGrid Team" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "VocalGrid",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>
          <div className="relative flex min-h-screen flex-col">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
