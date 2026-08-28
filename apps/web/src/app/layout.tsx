import { Header, Footer } from "@/components/layouts";
import { AuthProvider, AppProvider } from "@convolens/contexts";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "ConvoLens Private Preview | Preserve Support Conversations",
  description:
    "Import a WhatsApp support conversation and preserve its messages, participants, and timestamps in a focused workspace.",
  icons: {
    icon: "/favicon.svg",
  },
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "ConvoLens Private Preview",
    description:
      "Import a WhatsApp support conversation and preserve its source context.",
    siteName: "ConvoLens",
  },
  twitter: {
    title: "ConvoLens Private Preview",
    description:
      "Import a WhatsApp support conversation and preserve its source context.",
    card: "summary_large_image",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <AppProvider>
              <div className="flex min-h-screen flex-col">
                <Header />
                <main className="flex-grow pt-16">
                  {children}
                  <Toaster />
                </main>
                <Footer />
              </div>
            </AppProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
