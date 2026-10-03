import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MicPlotter",
  description: "Collaborative microphone plot planning for live theatre.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
