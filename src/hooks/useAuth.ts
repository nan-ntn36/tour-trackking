import { useEffect, useState, useCallback, useRef } from "react";
import { Alert } from "react-native";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { _isManualSignOut } from "../services/auth.service";
import { router } from "expo-router";
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

    // Track nếu user đã từng đăng nhập (để phân biệt "hết session" vs "chưa login")
    const wasAuthenticated = useRef(false);

    // Lắng nghe auth state change
    useEffect(() => {
        // Lấy session hiện tại
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                wasAuthenticated.current = true;
            }
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
        } = supabase.auth.onAuthStateChange((event, session) => {
            const previouslyLoggedIn = wasAuthenticated.current;

            setState((prev) => ({
                ...prev,
                session,
                user: session?.user ?? null,
                loading: false,
            }));

            if (session?.user) {
                wasAuthenticated.current = true;
                fetchProfile(session.user.id);
            } else {
                wasAuthenticated.current = false;
                setState((prev) => ({ ...prev, profile: null }));

                // Nếu trước đó đã đăng nhập, không phải logout thủ công → session hết hạn
                if (previouslyLoggedIn && !_isManualSignOut) {
                    Alert.alert(
                        "Phiên đã hết hạn",
                        "Phiên đăng nhập của bạn đã hết hạn. Vui lòng đăng nhập lại.",
                        [{ text: "Đăng nhập", onPress: () => router.replace("/(auth)/login") }]
                    );
                }
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
