import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cench — Create interactive videos",
  description:
    "Create interactive videos programmatically with AI image, video, music, voiceovers, and 3D scenes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} antialiased`}>
      <body className="m-0 min-h-screen w-full overflow-x-hidden bg-[#0a0a0b] text-[#ececec] font-sans">
        {children}
      </body>
    </html>
  );
}
