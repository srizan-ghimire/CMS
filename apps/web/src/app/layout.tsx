import type { Metadata, Viewport } from "next";
import { Archivo, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

// Three roles, deliberately distinct: a wide grotesque for display type, a neutral text face for
// UI and body copy, and a mono for the numeric markers and metadata labels that carry the
// marketing pages' editorial grid.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["wdth"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

// `||` rather than `??` on purpose: an unset build ARG arrives as an empty string, and
// `new URL("")` throws — which fails the production build at page-data collection, not at runtime.
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Social Platform — one composer, every network",
    template: "%s | Social Platform",
  },
  description:
    "Compose once, override per platform, route through approval, schedule, and publish with retries. A social content CMS for teams running eight networks.",
  openGraph: {
    type: "website",
    siteName: "Social Platform",
    title: "Social Platform — one composer, every network",
    description:
      "Compose once, override per platform, route through approval, schedule, and publish with retries.",
    url: appUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "Social Platform — one composer, every network",
    description:
      "Compose once, override per platform, route through approval, schedule, and publish with retries.",
  },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the page extend under the notch and home indicator, which is also what makes
  // `env(safe-area-inset-*)` report anything other than 0. The mobile tab bar pads itself with it.
  viewportFit: "cover",
  // No maximumScale / userScalable: false. Blocking pinch-zoom is a WCAG failure, and the layout
  // does not need it — nothing here breaks when zoomed.
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${archivo.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
