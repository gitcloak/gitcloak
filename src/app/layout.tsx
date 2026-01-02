import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GitCloak",
  description: "Secure, encrypted markdown editing for GitHub repositories",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
