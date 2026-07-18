import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthState {
  user: User | null;
  session: Session | null;
  status: AuthStatus;
  setSession: (session: Session | null) => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  session: null,
  status: "loading",
  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
      status: session ? "authenticated" : "unauthenticated",
    }),
}));
