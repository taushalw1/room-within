import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Lora, Parisienne } from "next/font/google";
import "./globals.css";
import { InstallApp } from "@/components/site/InstallApp";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});

const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-lora",
  display: "swap",
});

const parisienne = Parisienne({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-parisienne",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Room Within Community — Grassy Lake, Alberta",
    template: "%s · Room Within Community",
  },
  description:
    "A historic 1905 building in Grassy Lake, Alberta, reimagined for families, learning, entrepreneurship, and community. Book a room, join an event, or find support.",
  // Tells iOS and Android this is installable, and which colours to paint
  // around it once it is.
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Room Within",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    title: "Room Within Community",
    description:
      "A place to gather, learn, create, work and belong — in Grassy Lake, Alberta.",
    type: "website",
    locale: "en_CA",
  },
};

export const viewport: Viewport = {
  themeColor: "#5e6e45",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en-CA"
      className={`${cormorant.variable} ${lora.variable} ${parisienne.variable}`}
    >
      <body className="min-h-dvh antialiased">
        {children}
        <InstallApp />
      </body>
    </html>
  );
}
