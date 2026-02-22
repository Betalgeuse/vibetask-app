import type { Metadata } from "next";
import { Noto_Sans_Georgian } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const defaultFont = Noto_Sans_Georgian({ subsets: ["latin"] });

const ORIGIN_URL =
  process.env.NODE === "production"
    ? "https://dunnit.app"
    : "http://localhost:3000";

export const metadata: Metadata = {
  title: "Dunnit",
  description:
    "Dunnit - Eisenhower Matrix AI Task Manager. Organize tasks by urgency and importance with AI-powered priority suggestions.",
  icons: {
    icon: "/icon.ico",
  },
  metadataBase: new URL(ORIGIN_URL),
  alternates: {
    canonical: ORIGIN_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={defaultFont.className}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
