import { supabase } from "../lib/supabase";

// Lưu route mới
export async function saveRoute(
    userId: string,
    coordinates: { latitude: number; longitude: number }[],
    distanceMeters: number,
    durationSeconds: number,
    name?: string,
    startedAt?: string,
    endedAt?: string
) {
    // Convert coordinates → PostGIS LINESTRING WKT
    const linestring = coordinates
        .map((c) => `${c.longitude} ${c.latitude}`)
        .join(",");
    const wkt = `SRID=4326;LINESTRING(${linestring})`;

    const { data, error } = await supabase
        .from("routes")
        .insert({
            user_id: userId,
            name: name || `Route ${new Date().toLocaleDateString("vi-VN")}`,
            path: wkt,
            distance_meters: distanceMeters,
            duration_seconds: durationSeconds,
            started_at: startedAt,
            ended_at: endedAt,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

// Lấy tất cả routes của user
export async function getRoutes(userId: string) {
    const { data, error } = await supabase
        .from("routes")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
}

// Lấy routes visible
export async function getVisibleRoutes(userId: string) {
    const { data, error } = await supabase
        .from("routes")
        .select("*")
        .eq("user_id", userId)
        .eq("is_visible", true)
        .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
}

// Toggle visibility
export async function toggleRouteVisibility(routeId: string, isVisible: boolean) {
    const { error } = await supabase
        .from("routes")
        .update({ is_visible: isVisible })
        .eq("id", routeId);

    if (error) throw error;
}

// Xóa route
export async function deleteRoute(routeId: string) {
    const { error } = await supabase
        .from("routes")
        .delete()
        .eq("id", routeId);

    if (error) throw error;
}
