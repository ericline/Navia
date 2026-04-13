/** Login/registration page with toggle between sign-in and sign-up forms. */
"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Mail, Lock, User, Calendar, Eye, EyeOff } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, login, register, isLoading } = useAuth();

  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const [mode, setMode] = useState<"login" | "signup">(initialMode);

  useEffect(() => {
    setMode(searchParams.get("mode") === "signup" ? "signup" : "login");
    setError("");
  }, [searchParams]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [birthday, setBirthday] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Redirect if already logged in
  useEffect(() => {
    if (!isLoading && user) {
      const redirect = searchParams.get("redirect") ?? "/";
      router.replace(redirect);
    }
  }, [user, isLoading, router, searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(name, email, password, birthday);
      }
      const redirect = searchParams.get("redirect") ?? "/";
      router.replace(redirect);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-80px)] flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <div className="glass bg-warmSurface rounded-3xl p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-blue tracking-tight">
              {mode === "login" ? "Welcome back" : "Create account"}
            </h1>
            <p className="text-sm text-black/45 mt-1">
              {mode === "login"
                ? "Sign in to your Navia account"
                : "Start planning your adventures"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/40" />
                <input
                  className="glass-input w-full rounded-xl pl-10 pr-4 py-3 text-sm text-black/85 placeholder:text-black/30"
                  type="text"
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/40" />
              <input
                className="glass-input w-full rounded-xl pl-10 pr-4 py-3 text-sm text-black/85 placeholder:text-black/30"
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus={mode === "login"}
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/40" />
              <input
                className="glass-input w-full rounded-xl pl-10 pr-10 py-3 text-sm text-black/85 placeholder:text-black/30"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-black/30 hover:text-black/60 transition"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            {mode === "signup" && (
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/30 pointer-events-none" />
                <input
                  className="glass-input w-full rounded-xl pl-10 pr-4 py-3 text-sm text-black/85"
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-black/30 pointer-events-none">
                  Birthday (optional)
                </span>
              </div>
            )}

            {error && (
              <p className="text-xs text-pink bg-pink/10 rounded-lg px-3 py-2 border border-pink/20">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-blue/90 hover:bg-blue px-5 py-3 text-sm font-semibold text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting
                ? mode === "login"
                  ? "Signing in..."
                  : "Creating account..."
                : mode === "login"
                ? "Sign In"
                : "Create Account"}
            </button>
          </form>

          <div className="text-center">
            <p className="text-sm text-black/40">
              {mode === "login"
                ? "Don't have an account?"
                : "Already have an account?"}{" "}
              <button
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  setError("");
                }}
                className="text-blue/70 hover:text-blue transition font-medium"
              >
                {mode === "login" ? "Sign up" : "Sign in"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
