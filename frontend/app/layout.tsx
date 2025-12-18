import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "@/styles/app.css";

export const metadata: Metadata = {
  title: "Nori",
  description: "AI-powered chat assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
