// OSRM (ưu tiên, có steps) → ORS fallback
const ORS_KEY = process.env.EXPO_PUBLIC_ORS_API_KEY || "";

const OSRM_SERVERS = [
    "https://routing.openstreetmap.de/routed-bike",
    "https://router.project-osrm.org",
];

type Coordinate = { latitude: number; longitude: number };

export type NavStep = {
    type: string;
    modifier?: string;
    instruction: string;
    distanceKm: number;
    location: Coordinate;
    routeIndex: number; // index in route coordinates where this step begins
};

type DirectionsResult = {
    coordinates: Coordinate[];
    distanceKm: number;
    durationMinutes: number;
    steps?: NavStep[];
};

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

// ── ORS API ──
async function fetchORS(
    origin: Coordinate,
    destination: Coordinate,
    signal?: AbortSignal
): Promise<DirectionsResult> {
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

// ── OSRM API (steps=true, geometry per step for exact tracking) ──
async function fetchOSRM(
    base: string,
    origin: Coordinate,
    destination: Coordinate,
    signal?: AbortSignal
): Promise<DirectionsResult> {
    const path =
        `${origin.longitude},${origin.latitude};` +
        `${destination.longitude},${destination.latitude}` +
        `?overview=full&geometries=geojson&steps=true`;

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

    // Parse steps with EXACT route geometry indices
    // OSRM step geometries concatenate (sharing boundary points):
    // Step0: [A,B,C]  Step1: [C,D,E]  Step2: [E,F,G]
    // Full route: [A,B,C,D,E,F,G]
    // routeIndex: step0=0, step1=2, step2=4
    const steps: NavStep[] = [];
    let cumulativeIdx = 0;

    for (const leg of route.legs || []) {
        for (let i = 0; i < (leg.steps || []).length; i++) {
            const step = leg.steps[i];
            const m = step.maneuver;
            if (!m) continue;

            const stepCoordCount = step.geometry?.coordinates?.length || 0;

            steps.push({
                type: m.type || "turn",
                modifier: m.modifier || undefined,
                instruction: step.name
                    ? `${getManeuverText(m.type, m.modifier)} ${step.name}`
                    : getManeuverText(m.type, m.modifier),
                distanceKm: (step.distance || 0) / 1000,
                location: { latitude: m.location[1], longitude: m.location[0] },
                routeIndex: cumulativeIdx,
            });

            // Next step begins at: current + geometry points - 1 (shared boundary point)
            if (stepCoordCount > 0) {
                cumulativeIdx += Math.max(stepCoordCount - 1, 1);
            }
        }
    }


    return {
        coordinates: route.geometry.coordinates.map(
            ([lng, lat]: [number, number]) => ({ latitude: lat, longitude: lng })
        ),
        distanceKm: route.distance / 1000,
        durationMinutes: route.duration / 60,
        steps: steps.length > 0 ? steps : undefined,
    };
}

/** Convert OSRM maneuver → Vietnamese text */
function getManeuverText(type?: string, modifier?: string): string {
    const modMap: Record<string, string> = {
        "left": "Rẽ trái",
        "right": "Rẽ phải",
        "slight left": "Rẽ nhẹ trái",
        "slight right": "Rẽ nhẹ phải",
        "sharp left": "Rẽ gấp trái",
        "sharp right": "Rẽ gấp phải",
        "straight": "Đi thẳng",
        "uturn": "Quay đầu",
    };
    const typeMap: Record<string, string> = {
        "depart": "Xuất phát",
        "arrive": "Đã đến",
        "roundabout": "Vào bùng binh",
        "rotary": "Vào bùng binh",
        "fork": "Ngã rẽ",
        "merge": "Nhập làn",
        "end of road": "Cuối đường",
        "new name": "Tiếp tục",
        "continue": "Tiếp tục",
    };

    if (type && typeMap[type]) return typeMap[type];
    if (modifier && modMap[modifier]) return modMap[modifier];
    return "Tiếp tục";
}

/** Get Material Community icon name for a maneuver */
export function getManeuverIcon(type?: string, modifier?: string): string {
    if (type === "roundabout" || type === "rotary") return "rotate-right";
    if (type === "arrive") return "flag-checkered";
    if (type === "depart") return "ray-start-arrow";
    if (type === "fork") return "source-fork";
    if (type === "merge") return "source-merge";

    switch (modifier) {
        case "left": return "arrow-left-top";
        case "right": return "arrow-right-top";
        case "slight left": return "arrow-top-left";
        case "slight right": return "arrow-top-right";
        case "sharp left": return "arrow-bottom-left";
        case "sharp right": return "arrow-bottom-right";
        case "uturn": return "arrow-u-down-left";
        case "straight": return "arrow-up";
        default: return "arrow-up";
    }
}

// ── Public: OSRM trước (có steps) → ORS fallback ──
export async function getDirectionsWithInfo(
    origin: Coordinate,
    destination: Coordinate,
    abortSignal?: AbortSignal
): Promise<DirectionsResult> {
    let lastError: Error | null = null;

    // 1. OSRM first (returns steps with exact routeIndex!)
    for (const base of OSRM_SERVERS) {
        try {
            return await fetchOSRM(base, origin, destination, abortSignal);
        } catch (err: any) {
            if (err.name === "AbortError") throw err;
            lastError = err;
        }
    }

    // 2. ORS fallback (no steps)
    if (ORS_KEY) {
        try {
            return await fetchORS(origin, destination, abortSignal);
        } catch (err: any) {
            if (err.name === "AbortError") throw err;
            lastError = err;
        }
    }

    throw lastError || new Error("Không thể lấy đường đi");
}
