import type { Metadata, Viewport } from "next";
import "./globals.css";
import ThemeSync from "@/components/theme-sync";

export const metadata: Metadata = {
  title: "Daymark | Make today count",
  description: "A calm place to plan today and remember what matters.",
  applicationName: "Daymark",
};

export const viewport: Viewport = {
  themeColor: "#f3f6f8",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body><ThemeSync />{children}</body>
    </html>
  );
}
