import type { Metadata, Viewport } from "next";
import "@fontsource/literata/500.css";
import "@fontsource/literata/600.css";
import "@fontsource/public-sans/400.css";
import "@fontsource/public-sans/600.css";
import "@fontsource/public-sans/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "NoorAI Tracks", template: "%s · NoorAI Tracks" },
  description: "Roadmaps, progress and sign-offs for students, instructors and schools.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf7ee" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1814" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
