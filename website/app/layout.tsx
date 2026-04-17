import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cench — Create interactive videos",
  description: "AI-powered video creation and editing. From prompt to MP4.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} antialiased`}>
      <body className="m-0 min-h-screen w-full overflow-x-hidden bg-bone text-[#0a0a0b] font-sans">
        {children}
      </body>
    </html>
  );
}
