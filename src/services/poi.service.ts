/**
 * POI (Points of Interest) Service
 * Sử dụng Overpass API (OpenStreetMap) để lấy các địa điểm xung quanh
 */

export type POICategory = "food" | "shop" | "atm" | "gas" | "health" | "education" | "transport" | "tourism" | "other";

export interface POI {
    id: string;
    name: string;
    lat: number;
    lon: number;
    category: POICategory;
    categoryLabel: string;
    icon: string;
    tags: Record<string, string>;
}

const CATEGORY_MAP: Record<string, { category: POICategory; label: string; icon: string }> = {
    restaurant: { category: "food", label: "Nhà hàng", icon: "🍜" },
    cafe: { category: "food", label: "Quán cà phê", icon: "☕" },
    fast_food: { category: "food", label: "Đồ ăn nhanh", icon: "🍔" },
    bar: { category: "food", label: "Quán bar", icon: "🍺" },
    supermarket: { category: "shop", label: "Siêu thị", icon: "🏪" },
    convenience: { category: "shop", label: "Tiệm tạp hóa", icon: "🏬" },
    clothes: { category: "shop", label: "Cửa hàng quần áo", icon: "👕" },
    electronics: { category: "shop", label: "Điện tử", icon: "📱" },
    bakery: { category: "shop", label: "Tiệm bánh", icon: "🥐" },
    atm: { category: "atm", label: "ATM", icon: "🏧" },
    bank: { category: "atm", label: "Ngân hàng", icon: "🏦" },
    fuel: { category: "gas", label: "Trạm xăng", icon: "⛽" },
    pharmacy: { category: "health", label: "Nhà thuốc", icon: "💊" },
    hospital: { category: "health", label: "Bệnh viện", icon: "🏥" },
    clinic: { category: "health", label: "Phòng khám", icon: "🩺" },
    school: { category: "education", label: "Trường học", icon: "🏫" },
    university: { category: "education", label: "Đại học", icon: "🎓" },
    bus_station: { category: "transport", label: "Trạm xe buýt", icon: "🚌" },
    parking: { category: "transport", label: "Bãi đỗ xe", icon: "🅿️" },
    hotel: { category: "tourism", label: "Khách sạn", icon: "🏨" },
    museum: { category: "tourism", label: "Bảo tàng", icon: "🏛️" },
    place_of_worship: { category: "other", label: "Nơi thờ tự", icon: "⛩️" },
    marketplace: { category: "shop", label: "Chợ", icon: "🛒" },
};

function categorize(tags: Record<string, string>): { category: POICategory; label: string; icon: string } {
    const amenity = tags.amenity || "";
    const shop = tags.shop || "";
    const tourism = tags.tourism || "";

    // Check amenity first
    if (CATEGORY_MAP[amenity]) return CATEGORY_MAP[amenity];

    // Check shop
    if (shop) {
        if (CATEGORY_MAP[shop]) return CATEGORY_MAP[shop];
        return { category: "shop", label: "Cửa hàng", icon: "🏪" };
    }

    // Check tourism
    if (tourism) {
        if (CATEGORY_MAP[tourism]) return CATEGORY_MAP[tourism];
        return { category: "tourism", label: "Du lịch", icon: "🏖️" };
    }

    // Fallback
    if (amenity) return { category: "other", label: amenity, icon: "📍" };
    return { category: "other", label: "Khác", icon: "📍" };
}

/**
 * Lấy các điểm POI xung quanh vị trí hiện tại
 * @param lat Latitude
 * @param lon Longitude
 * @param radiusMeters Bán kính tìm kiếm (mặc định 1000m)
 */
export async function getNearbyPOIs(lat: number, lon: number, radiusMeters: number = 1000): Promise<POI[]> {
    const query = `
        [out:json][timeout:10];
        (
            node["amenity"~"restaurant|cafe|fast_food|bar|bank|atm|fuel|pharmacy|hospital|clinic|school|university|bus_station|parking|place_of_worship|marketplace"](around:${radiusMeters},${lat},${lon});
            node["shop"](around:${radiusMeters},${lat},${lon});
            node["tourism"~"hotel|museum|attraction|viewpoint"](around:${radiusMeters},${lat},${lon});
        );
        out body 100;
    `;

    const url = "https://overpass-api.de/api/interpreter";

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) throw new Error("Không thể tải dữ liệu POI");

    const data = await response.json();

    const pois: POI[] = (data.elements || [])
        .filter((el: any) => el.tags?.name) // chỉ lấy có tên
        .map((el: any) => {
            const cat = categorize(el.tags);
            return {
                id: `osm-${el.id}`,
                name: el.tags.name,
                lat: el.lat,
                lon: el.lon,
                category: cat.category,
                categoryLabel: cat.label,
                icon: cat.icon,
                tags: el.tags,
            };
        });

    return pois;
}

/** Tất cả categories cho filter */
export const POI_CATEGORIES: { key: POICategory | "all"; label: string; icon: string }[] = [
    { key: "all", label: "Tất cả", icon: "📍" },
    { key: "food", label: "Ăn uống", icon: "🍜" },
    { key: "shop", label: "Mua sắm", icon: "🏪" },
    { key: "atm", label: "ATM/NH", icon: "🏧" },
    { key: "gas", label: "Xăng dầu", icon: "⛽" },
    { key: "health", label: "Y tế", icon: "💊" },
    { key: "education", label: "Giáo dục", icon: "🏫" },
    { key: "transport", label: "Giao thông", icon: "🚌" },
    { key: "tourism", label: "Du lịch", icon: "🏨" },
    { key: "other", label: "Khác", icon: "📍" },
];
