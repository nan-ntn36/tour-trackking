import { supabase } from "../lib/supabase";

// Flag để phân biệt logout thủ công vs session hết hạn
export let _isManualSignOut = false;

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

// Xác thực OTP từ email
export async function verifyOtp(email: string, token: string) {
    const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "signup",
    });
    if (error) throw error;
    return data;
}

// Gửi lại mã xác thực
export async function resendOtp(email: string) {
    const { error } = await supabase.auth.resend({
        type: "signup",
        email,
    });
    if (error) throw error;
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
    _isManualSignOut = true;
    const { error } = await supabase.auth.signOut();
    // Reset flag sau khi event đã fire
    setTimeout(() => { _isManualSignOut = false; }, 1000);
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
