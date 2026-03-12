import { supabase } from "../lib/supabase";

// Parse PostGIS LINESTRING WKT → coordinate array
export function parseWKTLinestring(wkt: string): { latitude: number; longitude: number }[] {
    if (!wkt) return [];
    // SRID=4326;LINESTRING(lng1 lat1,lng2 lat2,...) or LINESTRING(...)
    const match = wkt.match(/LINESTRING\((.+)\)/i);
    if (!match) return [];
    return match[1].split(",").map((pair) => {
        const [lng, lat] = pair.trim().split(/\s+/).map(Number);
        return { latitude: lat, longitude: lng };
    });
}

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

    // Also save coordinates as JSON for easy retrieval
    const coordsJson = JSON.stringify(
        coordinates.map(c => [c.latitude, c.longitude])
    );

    const { data, error } = await supabase
        .from("routes")
        .insert({
            user_id: userId,
            name: name || `Route ${new Date().toLocaleDateString("vi-VN")}`,
            path: wkt,
            coordinates_json: coordsJson,
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

// Parse coordinates from JSON or WKT fallback
export function parseRouteCoordinates(route: any): { latitude: number; longitude: number }[] {
    // Try JSON first
    if (route.coordinates_json) {
        try {
            const arr = typeof route.coordinates_json === "string"
                ? JSON.parse(route.coordinates_json)
                : route.coordinates_json;
            return arr.map((p: number[]) => ({ latitude: p[0], longitude: p[1] }));
        } catch { }
    }
    // Fallback to WKT
    return parseWKTLinestring(route.path || "");
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
