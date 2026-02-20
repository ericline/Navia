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
  "text-lightBlue/90 hover:text-lightBlue transition " +
  "hover:bg-white/[0.06] border border-transparent hover:border-lightBlue/15";

  const iconClass =
    "h-4 w-4 text-lightBlue/70 group-hover:text-honey transition " +
    "group-hover:-translate-y-[1px] group-hover:rotate-[-6deg]";
  return (
    <div className="sticky top-0 z-50 border-b border-white/10 bg-darkBlue/80 backdrop-blur">
      <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <div className="h-12 w-12 rounded-2xl overflow-hidden border border-white/10 bg-white/5 shadow-md hover:scale-105 transition-transform duration-200">
            <Image
              src="/navia-icon.png"
              alt="Navia"
              width={48}
              height={48}
              priority
            />
          </div>
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
