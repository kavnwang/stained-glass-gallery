import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stained Glass Gallery",
  description: "Upload images and view them as interactive stained glass art",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
