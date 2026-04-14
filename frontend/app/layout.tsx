/** Root layout — wraps every page with AuthProvider and the top navigation bar. */
import "./globals.css";
import AuthProvider from "@/contexts/AuthContext";
import TopNav from "@/components/ui/TopNav";
import PageTransition from "@/components/layout/PageTransition";

export const metadata = {
  title: "Navia",
  description: "AI-powered travel planning",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen text-black/85">
        <AuthProvider>
          <TopNav />
          <PageTransition>{children}</PageTransition>
        </AuthProvider>
      </body>
    </html>
  );
}
