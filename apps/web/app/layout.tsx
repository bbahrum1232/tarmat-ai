import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tarmat.ai — AI Video Clipper",
  description: "Turn authorized long-form video into short-form clips."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
