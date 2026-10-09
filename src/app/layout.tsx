import type { Metadata, Viewport } from "next";
import { themeScript } from "@/lib/theme";
import { savedTheme } from "@/lib/theme-server";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "NoorAI Tracks", template: "%s · NoorAI Tracks" },
  description: "Roadmaps, progress and sign-offs for students, instructors and schools.",
};

// Browser bar colour = the brand "surface" token (src/brand/tokens.css), light and dark.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFBF2" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1510" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const theme = await savedTheme();
  return (
    // For "system", the inline script sets data-theme before paint, so the server's
    // <html> differs from the browser's; suppressHydrationWarning covers that one element.
    <html lang="en" data-theme={theme === "system" ? undefined : theme} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
