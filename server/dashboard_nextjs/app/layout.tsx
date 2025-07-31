import type React from "react";
import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/providers/app-context";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "Airborne",
  description: "OTA delivery platform for developers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/svg+xml" href="/airborne-cube-logo.png" />
      </head>
      <body className={`font-sans ${spaceGrotesk.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AppProvider>{children}</AppProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
