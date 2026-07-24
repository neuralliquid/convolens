import { Header, Footer } from "@/components/layouts";
import { AuthProvider, AppProvider } from "@convolens/contexts";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

export const metadata = {
  title: "ConvoLens Alpha - Conversation Intake",
  description:
    "Bring selected WhatsApp conversations into the ConvoLens alpha workspace.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "ConvoLens Alpha - Conversation Intake",
    description:
      "WhatsApp is the first live connector in a growing multi-platform conversation intake workspace.",
    siteName: "ConvoLens",
  },
  twitter: {
    title: "ConvoLens Alpha - Conversation Intake",
    description:
      "WhatsApp is the first live connector in a growing multi-platform conversation intake workspace.",
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
