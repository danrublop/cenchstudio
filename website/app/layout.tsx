import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cench — Create videos with prompts",
  description: "AI-powered animated video creation, from prompt to MP4.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} antialiased`}>
      <body className="min-h-screen bg-bone text-[#0a0a0b] font-sans">
        {children}
      </body>
    </html>
  );
}
