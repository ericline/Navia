import "./globals.css";
import Link from "next/link";
import Image from "next/image";
import { Home, Plane, User } from "lucide-react";

export const metadata = {
  title: "Navia",
  description: "AI-powered travel planning",
};

function TopNav() {
  const navItem =
  "group flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium " +
  "text-black/70 hover:text-black transition " +
  "hover:bg-black/[0.06] border border-transparent hover:border-black/10";

  const iconClass =
    "h-4 w-4 text-black/45 group-hover:text-blue transition " +
    "group-hover:-translate-y-[1px] group-hover:rotate-[-6deg]";
  return (
    <div className="sticky top-0 z-50 border-b border-black/10 backdrop-blur" style={{ backgroundColor: '#f1ebe6' }}>
      <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <Image
            src="/navia.png"
            alt="Navia"
            width={82}
            height={82}
            priority
            className="hover:scale-105 transition-transform duration-200"
          />
        </Link>

        <nav className="flex gap-2">
          <Link className={navItem} href="/">
            <Home className={iconClass} />
            Home
          </Link>
          <Link className={navItem} href="/current-trips">
            <Plane className={iconClass} />
            Current Trips
          </Link>
          <Link className={navItem} href="/profile">
            <User className={iconClass} />
            Profile
          </Link>
        </nav>
      </div>
    </div>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen text-slate-50 bg-darkBlue">
        <TopNav />
        {children}
      </body>
    </html>
  );
}
