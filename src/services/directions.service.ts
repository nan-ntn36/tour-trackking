// OpenRouteService (ưu tiên) → OSRM fallback
const ORS_KEY = process.env.EXPO_PUBLIC_ORS_API_KEY || "";

const OSRM_SERVERS = [
    "https://routing.openstreetmap.de/routed-bike",
    "https://router.project-osrm.org",
];

type Coordinate = { latitude: number; longitude: number };

const TIMEOUT_MS = 20_000;

async function fetchWithTimeout(
    url: string,
    timeoutMs: number,
    init?: RequestInit,
    externalSignal?: AbortSignal
): Promise<Response> {
    const controller = new AbortController();

    if (externalSignal) {
        if (externalSignal.aborted) throw new DOMException("Aborted", "AbortError");
        externalSignal.addEventListener("abort", () => controller.abort());
    }

    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, { ...init, signal: controller.signal });
        clearTimeout(timer);
        return response;
    } catch (err: any) {
        clearTimeout(timer);
        if (err.name === "AbortError") {
            if (externalSignal?.aborted) throw err;
            throw new Error("Timeout");
        }
        throw err;
    }
}

// ── ORS API (GET → GeoJSON response) ──
async function fetchORS(
    origin: Coordinate,
    destination: Coordinate,
    signal?: AbortSignal
): Promise<{ coordinates: Coordinate[]; distanceKm: number; durationMinutes: number }> {
    const url =
        `https://api.openrouteservice.org/v2/directions/cycling-regular` +
        `?api_key=${ORS_KEY}` +
        `&start=${origin.longitude},${origin.latitude}` +
        `&end=${destination.longitude},${destination.latitude}`;

    const response = await fetchWithTimeout(url, TIMEOUT_MS, undefined, signal);

    if (response.status === 429) throw new Error("ORS quota exceeded");
    if (response.status === 403) throw new Error("ORS API key invalid");
    if (!response.ok) throw new Error(`ORS HTTP ${response.status}`);

    const data = await response.json();

    // GET endpoint trả về GeoJSON FeatureCollection
    const feature = data?.features?.[0];
    if (!feature?.geometry?.coordinates?.length) {
        throw new Error("ORS: Không tìm thấy đường đi");
    }

    const coords: Coordinate[] = feature.geometry.coordinates.map(
        ([lng, lat]: [number, number]) => ({ latitude: lat, longitude: lng })
    );

    const summary = feature.properties?.summary || {};

    return {
        coordinates: coords,
        distanceKm: (summary.distance ?? 0) / 1000,
        durationMinutes: (summary.duration ?? 0) / 60,
    };
}

// ── OSRM API (GET, GeoJSON geometry) ──
async function fetchOSRM(
    base: string,
    origin: Coordinate,
    destination: Coordinate,
    signal?: AbortSignal
): Promise<{ coordinates: Coordinate[]; distanceKm: number; durationMinutes: number }> {
    const path =
        `${origin.longitude},${origin.latitude};` +
        `${destination.longitude},${destination.latitude}` +
        `?overview=full&geometries=geojson`;

    const response = await fetchWithTimeout(
        `${base}/route/v1/driving/${path}`,
        TIMEOUT_MS,
        undefined,
        signal
    );
    if (!response.ok) throw new Error(`OSRM HTTP ${response.status}`);

    const data = await response.json();
    if (!data.routes?.length) throw new Error("Không tìm thấy đường đi");

    const route = data.routes[0];
    return {
        coordinates: route.geometry.coordinates.map(
            ([lng, lat]: [number, number]) => ({ latitude: lat, longitude: lng })
        ),
        distanceKm: route.distance / 1000,
        durationMinutes: route.duration / 60,
    };
}

// ── Public: thử ORS → OSRM fallback lần lượt ──
export async function getDirectionsWithInfo(
    origin: Coordinate,
    destination: Coordinate,
    abortSignal?: AbortSignal
): Promise<{ coordinates: Coordinate[]; distanceKm: number; durationMinutes: number }> {
    let lastError: Error | null = null;

    // 1. ORS (ưu tiên)
    if (ORS_KEY) {
        try {
            return await fetchORS(origin, destination, abortSignal);
        } catch (err: any) {
            if (err.name === "AbortError") throw err;
            lastError = err;
        }
    }

    // 2. OSRM fallback
    for (const base of OSRM_SERVERS) {
        try {
            return await fetchOSRM(base, origin, destination, abortSignal);
        } catch (err: any) {
            if (err.name === "AbortError") throw err;
            lastError = err;
        }
    }

    throw lastError || new Error("Không thể lấy đường đi");
}
