import { useEffect, useState, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Profile } from "../types";

type AuthState = {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    loading: boolean;
};

export function useAuth() {
    const [state, setState] = useState<AuthState>({
        session: null,
        user: null,
        profile: null,
        loading: true,
    });

    // Lắng nghe auth state change
    useEffect(() => {
        // Lấy session hiện tại
        supabase.auth.getSession().then(({ data: { session } }) => {
            setState((prev) => ({
                ...prev,
                session,
                user: session?.user ?? null,
                loading: false,
            }));
            if (session?.user) {
                fetchProfile(session.user.id);
            }
        });

        // Subscribe auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setState((prev) => ({
                ...prev,
                session,
                user: session?.user ?? null,
                loading: false,
            }));
            if (session?.user) {
                fetchProfile(session.user.id);
            } else {
                setState((prev) => ({ ...prev, profile: null }));
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Fetch profile từ DB
    const fetchProfile = useCallback(async (userId: string) => {
        try {
            const { data } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", userId)
                .single();
            setState((prev) => ({ ...prev, profile: data }));
        } catch (error) {
            console.warn("Failed to fetch profile:", error);
        }
    }, []);

    return {
        session: state.session,
        user: state.user,
        profile: state.profile,
        loading: state.loading,
        isAuthenticated: !!state.session,
        refreshProfile: () => {
            if (state.user) fetchProfile(state.user.id);
        },
    };
}
