import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

// Que cada visita muestre la fecha y los datos del momento (no una copia guardada).
export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Panel La Leñita",
  description: "Panel de control interno de La Leñita",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col lg:flex-row">
        <Sidebar />
        <main className="flex-1 min-w-0 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </body>
    </html>
  );
}
