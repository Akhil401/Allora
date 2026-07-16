import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/presentation/providers";
import { ServiceWorkerRegistrar } from "@/presentation/components/sw-registrar";
import { ThemeApplier } from "@/presentation/components/theme-applier";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Allora — Learn Italian",
  description: "Practice spoken Italian with Allora, your adaptive AI tutor.",
  applicationName: "Allora",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Allora" },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>
          <ThemeApplier />
          {children}
        </Providers>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
