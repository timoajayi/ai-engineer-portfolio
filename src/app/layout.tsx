import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import BackToTop from "@/components/BackToTop";
import FloatingPortfolioAssistant from "@/components/FloatingPortfolioAssistant";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title:
    "Timothy Ajayi | Junior AI & Machine Learning Engineer | Data Scientist",
  description:
    "Portfolio of Timothy Ajayi, a Junior AI & Machine Learning Engineer and Data Scientist building practical systems across machine learning, RAG, agentic AI, APIs, and MLOps.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}

        <BackToTop />
        <FloatingPortfolioAssistant />
      </body>
    </html>
  );
}