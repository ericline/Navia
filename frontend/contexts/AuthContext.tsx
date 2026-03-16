"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

import { API_BASE_URL, updateUser as apiUpdateUser, UserUpdate } from "@/lib/api";

const API = API_BASE_URL;

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  birthday: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    birthday: string
  ) => Promise<void>;
  logout: () => void;
  updateUser: (data: UserUpdate) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: validate stored token
  useEffect(() => {
    const token = localStorage.getItem("navia_token");
    if (!token) {
      setIsLoading(false);
      return;
    }
    fetch(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Invalid token");
        return res.json();
      })
      .then((u) => setUser(u))
      .catch(() => localStorage.removeItem("navia_token"))
      .finally(() => setIsLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail ?? "Login failed");
    }
    const data = await res.json();
    localStorage.setItem("navia_token", data.access_token);
    setUser(data.user);
  }

  async function register(
    name: string,
    email: string,
    password: string,
    birthday: string
  ) {
    const res = await fetch(`${API}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, birthday: birthday || null }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail ?? "Registration failed");
    }
    const data = await res.json();
    localStorage.setItem("navia_token", data.access_token);
    setUser(data.user);
  }

  function logout() {
    localStorage.removeItem("navia_token");
    setUser(null);
  }

  async function updateUserProfile(data: UserUpdate) {
    const updated = await apiUpdateUser(data);
    setUser(updated);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, updateUser: updateUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
