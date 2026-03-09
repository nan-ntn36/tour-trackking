// Haversine formula — tính khoảng cách giữa 2 tọa độ GPS (km)
export function haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371; // Bán kính trái đất (km)
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg: number): number {
    return (deg * Math.PI) / 180;
}

// Tính tổng khoảng cách từ mảng tọa độ
export function totalDistance(
    coords: { latitude: number; longitude: number }[]
): number {
    let total = 0;
    for (let i = 1; i < coords.length; i++) {
        total += haversineDistance(
            coords[i - 1].latitude,
            coords[i - 1].longitude,
            coords[i].latitude,
            coords[i].longitude
        );
    }
    return total;
}

// Format khoảng cách (m hoặc km)
export function formatDistance(km: number): string {
    if (km < 1) {
        return `${Math.round(km * 1000)} m`;
    }
    return `${km.toFixed(2)} km`;
}

// Format thời gian (giây → HH:MM:SS)
export function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
        return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    return `${m}:${String(s).padStart(2, "0")}`;
}
