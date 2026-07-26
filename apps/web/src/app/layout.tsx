import { Header, Footer } from "@/components/layouts";
import { AuthProvider, AppProvider } from "@convolens/contexts";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

export const metadata = {
  title: "ConvoLens Alpha - From Support Signal to Resolution",
  description:
    "Turn selected support conversations into durable context and, over time, reviewed tickets, coordinated resolution, and governed responses.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "ConvoLens Alpha - From Support Signal to Resolution",
    description:
      "Consent-first support intake building toward AI-assisted work, coordinated resolution, and governed responses.",
    siteName: "ConvoLens",
  },
  twitter: {
    title: "ConvoLens Alpha - From Support Signal to Resolution",
    description:
      "Consent-first support intake building toward AI-assisted work, coordinated resolution, and governed responses.",
    card: "summary_large_image",
  },
};

export default function RootLayout({ children }) {
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
