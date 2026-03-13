import "./globals.css";
import AuthProvider from "@/contexts/AuthContext";
import TopNav from "@/components/TopNav";

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
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
