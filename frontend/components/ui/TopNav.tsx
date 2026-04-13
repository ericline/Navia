/** TopNav - Top navigation bar with app logo, navigation links, and auth-aware user menu. */
"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Home, Plane, User, LogIn, UserPlus, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const navItem =
  "group flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium " +
  "text-black/70 hover:text-black transition " +
  "hover:bg-black/[0.06] border border-transparent hover:border-black/10";

const iconClass =
  "h-4 w-4 text-black/45 group-hover:text-blue transition " +
  "group-hover:-translate-y-[1px] group-hover:rotate-[-6deg]";

export default function TopNav() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <div
      className="sticky top-0 z-50 border-b border-black/10 backdrop-blur bg-warmSurface"
    >
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
          {user ? (
            <>
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
              <button
                onClick={() => {
                  logout();
                  router.push("/");
                }}
                className={navItem}
              >
                <LogOut className={iconClass} />
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link className={navItem} href="/login">
                <LogIn className={iconClass} />
                Log In
              </Link>
              <Link
                className={`${navItem} bg-blue/10 hover:bg-blue/20`}
                href="/login?mode=signup"
              >
                <UserPlus className={iconClass} />
                Sign Up
              </Link>
            </>
          )}
        </nav>
      </div>
    </div>
  );
}
