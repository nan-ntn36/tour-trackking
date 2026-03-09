import { supabase } from "../lib/supabase";

// Đăng ký
export async function signUp(email: string, password: string, displayName: string) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { display_name: displayName },
        },
    });
    if (error) throw error;
    return data;
}

// Đăng nhập
export async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    if (error) throw error;
    return data;
}

// Đăng xuất
export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

// Lấy profile
export async function getProfile(userId: string) {
    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
    if (error) throw error;
    return data;
}

// Cập nhật profile
export async function updateProfile(userId: string, updates: { display_name?: string; avatar_url?: string }) {
    const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId)
        .select()
        .single();
    if (error) throw error;
    return data;
}
