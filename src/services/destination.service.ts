import { supabase } from "../lib/supabase";

// Check-in tại vị trí hiện tại
export async function checkIn(
    userId: string,
    name: string,
    latitude: number,
    longitude: number,
    description?: string,
    address?: string
) {
    const point = `SRID=4326;POINT(${longitude} ${latitude})`;

    const { data, error } = await supabase
        .from("destinations")
        .insert({
            user_id: userId,
            name,
            description: description || null,
            location: point,
            latitude,
            longitude,
            address: address || null,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

// Lấy tất cả destinations
export async function getDestinations(userId: string) {
    const { data, error } = await supabase
        .from("destinations")
        .select("*")
        .eq("user_id", userId)
        .order("checked_in_at", { ascending: false });

    if (error) throw error;
    return data;
}

// Lấy destinations đang visible
export async function getVisibleDestinations(userId: string) {
    const { data, error } = await supabase
        .from("destinations")
        .select("*")
        .eq("user_id", userId)
        .eq("is_visible", true)
        .order("checked_in_at", { ascending: false });

    if (error) throw error;
    return data;
}

// Toggle favorite
export async function toggleFavorite(destId: string, isFavorite: boolean) {
    const { error } = await supabase
        .from("destinations")
        .update({ is_favorite: isFavorite })
        .eq("id", destId);

    if (error) throw error;
}

// Toggle visibility
export async function toggleVisibility(destId: string, isVisible: boolean) {
    const { error } = await supabase
        .from("destinations")
        .update({ is_visible: isVisible })
        .eq("id", destId);

    if (error) throw error;
}

// Xóa destination
export async function deleteDestination(destId: string) {
    const { error } = await supabase
        .from("destinations")
        .delete()
        .eq("id", destId);

    if (error) throw error;
}

// Tìm kiếm theo tên
export async function searchDestinations(userId: string, query: string) {
    const { data, error } = await supabase
        .from("destinations")
        .select("*")
        .eq("user_id", userId)
        .ilike("name", `%${query}%`)
        .order("checked_in_at", { ascending: false });

    if (error) throw error;
    return data;
}
