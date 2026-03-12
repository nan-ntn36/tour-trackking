# 📖 Tour Tracking — Tài liệu kỹ thuật chi tiết

> Tài liệu mô tả chi tiết cách triển khai từng chức năng, API sử dụng, công thức tính toán, luồng dữ liệu và tham chiếu đến file/dòng code cụ thể.

---

## Mục lục

1. [Kiến trúc tổng quan](#1-kiến-trúc-tổng-quan)
2. [Xác thực (Authentication)](#2-xác-thực-authentication)
3. [Bản đồ & GPS (Map)](#3-bản-đồ--gps-map)
4. [Check-in & Điểm đến (Destinations)](#4-check-in--điểm-đến-destinations)
5. [Ghi tuyến đường (Route Tracking)](#5-ghi-tuyến-đường-route-tracking)
6. [Tìm đường & Điều hướng (Directions & Navigation)](#6-tìm-đường--điều-hướng-directions--navigation)
7. [Khám phá POI (Points of Interest)](#7-khám-phá-poi-points-of-interest)
8. [Tour nhóm (Group Tours)](#8-tour-nhóm-group-tours)
9. [Upload ảnh (Photo)](#9-upload-ảnh-photo)
10. [Công thức tính toán](#10-công-thức-tính-toán)
11. [Database Schema (Supabase)](#11-database-schema-supabase)
12. [Tài khoản & API Keys cần thiết](#12-tài-khoản--api-keys-cần-thiết)

---

## 1. Kiến trúc tổng quan

### Mô hình Client ↔ Backend

```
┌─────────────────────────────────────────────────────────────┐
│                   React Native (Expo)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │  Screens │→│ Services │→│   Libs   │→│   APIs   │       │
│  │ app/     │ │ src/     │ │ src/lib/ │ │ External │       │
│  │ (tabs)   │ │ services/│ │supabase  │ │ Supabase │       │
│  │ (auth)   │ │          │ │cloudinary│ │ OSRM/ORS │       │
│  └──────────┘ └──────────┘ └──────────┘ │ Overpass │       │
│        ↕            ↕                    │Cloudinary│       │
│  ┌──────────┐ ┌──────────┐              └──────────┘       │
│  │  Hooks   │ │  Utils   │                                  │
│  │ useAuth  │ │ distance │                                  │
│  │useLocation││          │                                  │
│  └──────────┘ └──────────┘                                  │
└─────────────────────────────────────────────────────────────┘
```

### Luồng dữ liệu chung

1. **Screen** (UI) gọi hàm từ **Service**
2. **Service** sử dụng **Supabase client** (`src/lib/supabase.ts`) để CRUD database
3. Với API bên ngoài (OSRM, Overpass, Cloudinary), Service gọi trực tiếp qua `fetch()`
4. **Hooks** (`useAuth`, `useLocation`) quản lý state toàn cục và cung cấp cho Screen

### Tham chiếu tài liệu chính thức

| Công nghệ | Tài liệu |
|---|---|
| React Native | https://reactnative.dev/docs/getting-started |
| Expo SDK 54 | https://docs.expo.dev/ |
| Expo Router v6 | https://docs.expo.dev/router/introduction/ |
| Supabase JS | https://supabase.com/docs/reference/javascript/introduction |
| React Native Paper | https://callstack.github.io/react-native-paper/ |
| React Native Maps | https://github.com/react-native-maps/react-native-maps |
| Cloudinary Upload API | https://cloudinary.com/documentation/image_upload_api_reference |
| OSRM API | https://project-osrm.org/docs/v5.24.0/api/ |
| OpenRouteService | https://openrouteservice.org/dev/#/api-docs |
| Overpass API | https://wiki.openstreetmap.org/wiki/Overpass_API |
| PostGIS | https://postgis.net/documentation/ |

---

## 2. Xác thực (Authentication)

### Công nghệ: **Supabase Auth**

Supabase cung cấp hệ thống xác thực hoàn chỉnh bao gồm đăng ký, đăng nhập, quản lý session, và xác thực OTP qua email.

### Thư mục & File

| File | Chức năng |
|---|---|
| `app/(auth)/login.tsx` | Màn hình đăng nhập |
| `app/(auth)/register.tsx` | Màn hình đăng ký |
| `app/(auth)/verify-otp.tsx` | Màn hình nhập OTP 8 số |
| `src/services/auth.service.ts` | Các hàm gọi Supabase Auth API |
| `src/hooks/useAuth.ts` | Hook quản lý auth state toàn cục |
| `src/lib/supabase.ts` | Khởi tạo Supabase client |
| `src/components/Auth/AuthGuard.tsx` | Component bảo vệ route (chưa login → redirect) |

### Luồng chi tiết

#### 2.1 Khởi tạo Supabase Client

**File:** `src/lib/supabase.ts` (dòng 5-15)

```typescript
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: AsyncStorage,            // Lưu session vào AsyncStorage (React Native)
        autoRefreshToken: true,            // Tự refresh token khi hết hạn
        persistSession: true,              // Giữ session sau khi đóng app
        detectSessionInUrl: false,         // Tắt (không cần cho React Native)
    },
});
```

- **`@react-native-async-storage/async-storage`** được dùng thay cho `localStorage` (web) để lưu JWT token
- **API:** `supabase.createClient()` → https://supabase.com/docs/reference/javascript/initializing

#### 2.2 Đăng ký (Sign Up)

**File:** `src/services/auth.service.ts` (dòng 7-17)

```typescript
export async function signUp(email, password, displayName) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { display_name: displayName },  // metadata → trigger tạo profile
        },
    });
    if (error) throw error;
    return data;
}
```

**Cách hoạt động:**
1. Gọi `supabase.auth.signUp()` → Supabase tạo user trong `auth.users`
2. Supabase gửi email OTP 8 số đến email người dùng
3. Database trigger `handle_new_user()` tự động tạo record trong bảng `profiles` (xem schema.sql dòng 168-183)
4. App redirect đến `verify-otp.tsx` với param `email`

#### 2.3 Xác thực OTP

**File:** `src/services/auth.service.ts` (dòng 20-28)

```typescript
export async function verifyOtp(email, token) {
    const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,          // Mã 8 số từ email
        type: "signup",
    });
    if (error) throw error;
    return data;
}
```

**UI:** File `app/(auth)/verify-otp.tsx` hiển thị 8 ô input, mỗi ô 1 số:
- Dòng 15: State `otp` là array 8 phần tử `["", "", "", "", "", "", "", ""]`
- Dòng 28-46: `handleOtpChange()` — auto-focus ô tiếp theo, auto-submit khi nhập đủ 8 số
- Dòng 119: Ref callback lưu reference đến từng TextInput để gọi `.focus()`

#### 2.4 Đăng nhập

**File:** `src/services/auth.service.ts` (dòng 40-47)

```typescript
export async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email, password,
    });
    if (error) throw error;
    return data;
}
```

#### 2.5 Hook useAuth — Quản lý session

**File:** `src/hooks/useAuth.ts` (dòng 16-103)

```typescript
export function useAuth() {
    // Lắng nghe thay đổi auth state (dòng 28-77)
    useEffect(() => {
        supabase.auth.getSession().then(...)  // Lấy session hiện tại
        supabase.auth.onAuthStateChange(...)  // Subscribe khi login/logout
    }, []);
}
```

**Cơ chế phát hiện session hết hạn (dòng 66-72):**
- `wasAuthenticated` ref track nếu user đã từng login
- Nếu session mất mà không phải logout thủ công → hiện Alert "Phiên đã hết hạn"
- `_isManualSignOut` flag trong `auth.service.ts` (dòng 4) phân biệt logout thủ công vs hết session

#### 2.6 Auto-redirect

**File:** `app/index.tsx` (dòng 7-30)

```typescript
export default function Index() {
    const { isAuthenticated, loading } = useAuth();
    if (loading) return <ActivityIndicator />
    if (isAuthenticated) return <Redirect href="/(tabs)/map" />
    return <Redirect href="/(auth)/login" />
}
```

---

## 3. Bản đồ & GPS (Map)

### Công nghệ: **React Native Maps** + **expo-location**

### Thư mục & File

| File | Chức năng |
|---|---|
| `app/(tabs)/map.tsx` | Màn hình bản đồ chính (1366 dòng) |
| `src/hooks/useLocation.ts` | Hook lấy vị trí GPS |
| `src/hooks/useRouteTracking.ts` | Hook ghi lại quãng đường |
| `src/components/Map/RouteOverlay.tsx` | Polyline hiển thị đường đi |
| `src/components/Map/DestinationMarker.tsx` | Marker cho điểm đến |

### 3.1 Lấy vị trí GPS

**API:** `expo-location` → https://docs.expo.dev/versions/latest/sdk/location/

**File:** `src/hooks/useLocation.ts`

```typescript
import * as Location from 'expo-location';

// Xin quyền GPS
const { status } = await Location.requestForegroundPermissionsAsync();
// Lấy vị trí 1 lần
const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
// Theo dõi liên tục (cho navigation)
const sub = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5 },
    (newLoc) => { /* update state */ }
);
```

### 3.2 Hiển thị bản đồ

**File:** `app/(tabs)/map.tsx` (dòng 703-718)

```tsx
<MapView
    ref={mapRef}
    provider={PROVIDER_DEFAULT}   // Google Maps trên Android, Apple Maps trên iOS
    showsUserLocation             // Hiện chấm xanh vị trí user
    onLongPress={handleMapLongPress}  // Nhấn giữ → check-in
    initialRegion={...}
>
```

- **Package:** `react-native-maps` → https://github.com/react-native-maps/react-native-maps
- **Google Maps API Key** cấu hình trong `app.json` (dòng 27-29): `android.config.googleMaps.apiKey`

---

## 4. Check-in & Điểm đến (Destinations)

### Công nghệ: **Supabase** + **PostGIS**

### Thư mục & File

| File | Chức năng |
|---|---|
| `app/(tabs)/destinations.tsx` | Danh sách điểm đến (542 dòng) |
| `src/services/destination.service.ts` | CRUD điểm đến qua Supabase |

### 4.1 Check-in (Tạo điểm đến)

**File:** `src/services/destination.service.ts` (dòng 4-30)

```typescript
export async function checkIn(userId, name, latitude, longitude, description?) {
    // Tạo PostGIS POINT từ tọa độ GPS
    const point = `SRID=4326;POINT(${longitude} ${latitude})`;

    const { data, error } = await supabase
        .from("destinations")           // Bảng destinations
        .insert({
            user_id: userId,
            name,
            location: point,            // PostGIS geometry
            latitude,                   // Số thực (để query dễ)
            longitude,
        })
        .select().single();
}
```

**Kiến thức nền:**
- **PostGIS SRID 4326** = hệ tọa độ WGS 84 (chuẩn GPS toàn cầu)
- Format: `POINT(longitude latitude)` — **longitude trước, latitude sau** (khác với Google Maps)
- Supabase tự động hỗ trợ PostGIS khi bật extension

**Cách trigger check-in từ bản đồ:**

Khi user nhấn giữ trên bản đồ → `handleMapLongPress` (`map.tsx` dòng 603-607):
```typescript
const handleMapLongPress = (e) => {
    const coord = e.nativeEvent.coordinate;  // {latitude, longitude}
    setSelectedLocation(coord);
    setShowCheckIn(true);                    // Mở dialog nhập tên
};
```

### 4.2 Fetch dữ liệu điểm đến

**File:** `src/services/destination.service.ts` (dòng 33-108)

| Hàm | API Supabase | Mục đích |
|---|---|---|
| `getDestinations(userId)` | `.select("*").eq("user_id", userId).order("checked_in_at")` | Lấy tất cả |
| `getVisibleDestinations(userId)` | thêm `.eq("is_visible", true)` | Chỉ lấy visible (cho map) |
| `searchDestinations(userId, query)` | `.ilike("name", "%query%")` | Tìm theo tên |
| `toggleFavorite(id, isFav)` | `.update({ is_favorite })` | Toggle yêu thích |
| `toggleVisibility(id, isVis)` | `.update({ is_visible })` | Toggle hiện/ẩn trên map |
| `deleteDestination(id)` | `.delete().eq("id", id)` | Xóa |

**Cách load dữ liệu trong UI:**

**File:** `app/(tabs)/destinations.tsx` (dòng 58-82)

```typescript
const loadData = useCallback(async () => {
    const data = searchQuery
        ? await searchDestinations(user.id, searchQuery)  // Có search
        : await getDestinations(user.id);                   // Lấy tất cả
    setDestinations(data);

    // Load ảnh và group theo destination_id
    const photos = await getUserPhotos(user.id);
    const grouped = {};
    photos.forEach(p => { grouped[p.destination_id].push(p); });
    setDestPhotos(grouped);
}, [user, searchQuery]);

// Tự động load khi focus vào tab
useFocusEffect(useCallback(() => { loadData(); }, [loadData]));
```

---

## 5. Ghi tuyến đường (Route Tracking)

### Công nghệ: **expo-location** (GPS) + **PostGIS** (lưu trữ)

### Thư mục & File

| File | Chức năng |
|---|---|
| `app/(tabs)/routes.tsx` | Danh sách và chi tiết tuyến đường (548 dòng) |
| `src/hooks/useRouteTracking.ts` | Hook ghi GPS liên tục |
| `src/services/route.service.ts` | Lưu/đọc route từ Supabase |

### 5.1 Ghi tuyến đường GPS

**File:** `src/hooks/useRouteTracking.ts`

```typescript
// Khi bấm Start:
const startTracking = async () => {
    setIsTracking(true);
    // Dùng Location.watchPositionAsync() ghi tọa độ liên tục
    // Mỗi 5m thay đổi → thêm point vào mảng
};

// Khi bấm Stop:
const stopTracking = () => {
    setIsTracking(false);
    return { points, distanceMeters, durationSeconds, ... };
};
```

### 5.2 Lưu tuyến đường vào database

**File:** `src/services/route.service.ts` (dòng 16-53)

```typescript
export async function saveRoute(userId, coordinates, distanceMeters, durationSeconds, ...) {
    // 1. Convert mảng tọa độ → PostGIS LINESTRING WKT
    const linestring = coordinates
        .map(c => `${c.longitude} ${c.latitude}`)
        .join(",");
    const wkt = `SRID=4326;LINESTRING(${linestring})`;
    // Ví dụ: "SRID=4326;LINESTRING(106.7 10.8, 106.71 10.81, ...)"

    // 2. Cũng lưu JSON để dễ đọc (không cần parse WKT)
    const coordsJson = JSON.stringify(
        coordinates.map(c => [c.latitude, c.longitude])
    );

    // 3. Insert vào Supabase
    await supabase.from("routes").insert({
        user_id: userId,
        path: wkt,                    // PostGIS LINESTRING
        coordinates_json: coordsJson, // JSON backup
        distance_meters, duration_seconds,
    });
}
```

### 5.3 Parse tọa độ khi đọc lại

**File:** `src/services/route.service.ts` (dòng 4-68)

```typescript
// Parse PostGIS WKT → mảng tọa độ
export function parseWKTLinestring(wkt) {
    const match = wkt.match(/LINESTRING\((.+)\)/i);
    return match[1].split(",").map(pair => {
        const [lng, lat] = pair.trim().split(/\s+/).map(Number);
        return { latitude: lat, longitude: lng };
    });
}

// Ưu tiên JSON, fallback WKT
export function parseRouteCoordinates(route) {
    if (route.coordinates_json) {
        const arr = JSON.parse(route.coordinates_json);
        return arr.map(p => ({ latitude: p[0], longitude: p[1] }));
    }
    return parseWKTLinestring(route.path || "");
}
```

### 5.4 Biểu đồ tốc độ

**File:** `app/(tabs)/routes.tsx` (dòng 161-186)

```typescript
const getSpeedSegments = (coords, durSec) => {
    // Chia route thành max 20 đoạn (segment)
    // Mỗi đoạn: tính khoảng cách bằng Haversine
    // Tốc độ = khoảng cách / thời gian (giả sử phân bổ đều)
    const segTime = (durSec / (coords.length - 1)) * step / 3600; // giờ
    const speed = segDist / segTime; // km/h
};
```

---

## 6. Tìm đường & Điều hướng (Directions & Navigation)

### Công nghệ: **OSRM** (chính) + **OpenRouteService** (dự phòng)

### Thư mục & File

| File | Chức năng |
|---|---|
| `src/services/directions.service.ts` | Gọi API tìm đường (240 dòng) |
| `app/(tabs)/map.tsx` | Hiển thị route và điều hướng real-time |

### 6.1 OSRM API (ưu tiên — có navigation steps)

**File:** `src/services/directions.service.ts` (dòng 91-158)

**API:** OSRM Route Service → https://project-osrm.org/docs/v5.24.0/api/#route-service

**URL format:**
```
https://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}
    ?overview=full
    &geometries=geojson
    &steps=true
```

**Servers (dòng 4-7):**
```typescript
const OSRM_SERVERS = [
    "https://routing.openstreetmap.de/routed-bike",  // Server 1 (ưu tiên)
    "https://router.project-osrm.org",                // Server 2 (fallback)
];
```

> ⚠️ **OSRM là API MIỄN PHÍ, KHÔNG CẦN API KEY**. Các server trên là public demo servers.

**Cách parse response (dòng 113-157):**
```typescript
const route = data.routes[0];

// Parse navigation steps với routeIndex chính xác
// OSRM step geometries chia sẻ boundary point:
// Step0: [A,B,C]  Step1: [C,D,E]  → Full: [A,B,C,D,E]
// routeIndex: step0=0, step1=2
let cumulativeIdx = 0;
for (const step of leg.steps) {
    steps.push({
        type: maneuver.type,          // "turn", "depart", "arrive"
        modifier: maneuver.modifier,  // "left", "right", "straight"
        instruction: "Rẽ trái Nguyễn Huệ",
        distanceKm: step.distance / 1000,
        routeIndex: cumulativeIdx,    // Vị trí trên polyline
    });
    cumulativeIdx += stepCoordCount - 1;
}
```

### 6.2 ORS API (dự phòng — không có steps)

**File:** `src/services/directions.service.ts` (dòng 56-88)

**API:** OpenRouteService → https://openrouteservice.org/dev/#/api-docs/v2/directions

**URL:**
```
https://api.openrouteservice.org/v2/directions/cycling-regular
    ?api_key={ORS_KEY}
    &start={lng1},{lat1}
    &end={lng2},{lat2}
```

> ⚠️ **CẦN API KEY** — đăng ký miễn phí tại https://openrouteservice.org/dev/#/signup (giới hạn 2000 requests/ngày)

### 6.3 Chiến lược fallback (dòng 211-239)

```typescript
export async function getDirectionsWithInfo(origin, destination, signal?) {
    // 1. Thử OSRM server 1 → nếu fail...
    // 2. Thử OSRM server 2 → nếu fail...
    // 3. Thử ORS (nếu có API key) → nếu fail...
    // 4. Throw error
}
```

### 6.4 Timeout & Cancel

**File:** `src/services/directions.service.ts` (dòng 29-53)

```typescript
async function fetchWithTimeout(url, timeoutMs, init?, externalSignal?) {
    const controller = new AbortController();
    // Kết hợp external signal (user bấm cancel) + timeout signal
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, { signal: controller.signal });
}
```

- **Timeout:** 20 giây (`TIMEOUT_MS = 20_000`)
- **Cancel:** User bấm ✕ → `routeAbortRef.current.abort()` (`map.tsx` dòng 294-298)

### 6.5 Điều hướng real-time (Navigation Mode)

**File:** `app/(tabs)/map.tsx` (dòng 312-453)

**Khi bấm "Bắt đầu" (dòng 312-330):**
```typescript
const handleStartNavigation = async () => {
    setIsNavigating(true);
    await startWatching();                    // Bật GPS liên tục
    mapRef.current.animateCamera({
        center: { latitude, longitude },
        pitch: 45,                            // Camera nghiêng 45°
        heading: location.heading ?? 0,       // Theo hướng di chuyển
        zoom: 17,
    });
};
```

**Real-time tracking (dòng 349-453):**

Mỗi khi GPS cập nhật (`location` thay đổi):

1. **Tính khoảng cách còn lại** đến đích: `haversineDistance(user → dest)` → `setRemainingKm()`
2. **Ước tính thời gian**: `remainingKm / avgSpeed` (avgSpeed = distKm / durationMin)
3. **Trim route**: Tìm điểm gần nhất trên polyline → chỉ hiện phần còn lại phía trước
4. **Xác định step hiện tại**: So sánh `nearestIdx` với `navSteps[s].routeIndex`
5. **Camera follow**: `animateCamera({ center, pitch: 45, heading })`
6. **Auto-stop**: Nếu `distKm < 0.05` (< 50m) → đã đến đích
7. **Auto-reroute**: Nếu lệch đường > 200m (`distanceToPolyline() > 0.2 km`) → gọi lại `getDirectionsWithInfo()`
   - Cooldown: 30 giây giữa các lần reroute

### 6.6 Dịch maneuver sang tiếng Việt

**File:** `src/services/directions.service.ts` (dòng 161-208)

```typescript
function getManeuverText(type?, modifier?) {
    const modMap = {
        "left": "Rẽ trái", "right": "Rẽ phải",
        "slight left": "Rẽ nhẹ trái", "sharp right": "Rẽ gấp phải",
        "straight": "Đi thẳng", "uturn": "Quay đầu",
    };
    const typeMap = {
        "depart": "Xuất phát", "arrive": "Đã đến",
        "roundabout": "Vào bùng binh", ...
    };
}
```

---

## 7. Khám phá POI (Points of Interest)

### Công nghệ: **Overpass API** (OpenStreetMap)

### File duy nhất

| File | Chức năng |
|---|---|
| `src/services/poi.service.ts` | Gọi Overpass API, parse và phân loại POI (131 dòng) |

### 7.1 Overpass API Query

**File:** `src/services/poi.service.ts` (dòng 76-116)

**API:** https://overpass-api.de/api/interpreter

> ⚠️ **MIỄN PHÍ, KHÔNG CẦN ĐĂNG KÝ, KHÔNG CẦN API KEY**

```typescript
export async function getNearbyPOIs(lat, lon, radiusMeters = 1000) {
    const query = `
        [out:json][timeout:10];
        (
            node["amenity"~"restaurant|cafe|fast_food|bank|atm|fuel|pharmacy|..."](around:${radiusMeters},${lat},${lon});
            node["shop"](around:${radiusMeters},${lat},${lon});
            node["tourism"~"hotel|museum|attraction|viewpoint"](around:${radiusMeters},${lat},${lon});
        );
        out body 100;
    `;

    const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
    });
}
```

**Giải thích query Overpass:**
- `[out:json]` — trả về JSON (thay vì XML)
- `[timeout:10]` — timeout 10 giây
- `node["amenity"~"restaurant|cafe"]` — tìm node có tag amenity là restaurant HOẶC cafe
- `(around:1500,10.7,106.7)` — trong bán kính 1500m quanh tọa độ (10.7, 106.7)
- `out body 100` — trả về tối đa 100 kết quả

### 7.2 Phân loại POI

**File:** `src/services/poi.service.ts` (dòng 19-68)

Bảng phân loại 23 loại POI vào 9 nhóm:

| Nhóm | Tag OSM | Icon |
|---|---|---|
| food | restaurant, cafe, fast_food, bar | 🍜☕🍔🍺 |
| shop | supermarket, convenience, clothes, electronics, bakery | 🏪🏬👕📱🥐 |
| atm | atm, bank | 🏧🏦 |
| gas | fuel | ⛽ |
| health | pharmacy, hospital, clinic | 💊🏥🩺 |
| education | school, university | 🏫🎓 |
| transport | bus_station, parking | 🚌🅿️ |
| tourism | hotel, museum | 🏨🏛️ |
| other | place_of_worship | ⛩️ |

---

## 8. Tour nhóm (Group Tours)

### Công nghệ: **Supabase** (CRUD + Realtime)

### Thư mục & File

| File | Chức năng |
|---|---|
| `app/(tabs)/tours.tsx` | UI quản lý tour (1046 dòng) |
| `src/services/tour.service.ts` | Business logic tour (282 dòng) |
| `supabase/migrations/tours.sql` | Database schema |

### 8.1 Tạo tour

**File:** `src/services/tour.service.ts` (dòng 18-59)

```typescript
export async function createTour(userId, name, description?) {
    // 1. Sinh mã mời 6 ký tự
    const invite_code = generateInviteCode();
    // Bỏ I,O,0,1 để tránh nhầm lẫn

    // 2. Insert bảng tours
    const { data: tour } = await supabase
        .from("tours").insert({ creator_id: userId, name, invite_code, ... });

    // 3. Thêm creator làm owner trong bảng tour_members
    await supabase.from("tour_members").insert({
        tour_id: tour.id, user_id: userId, role: "owner"
    });
}
```

**Mã mời (dòng 6-13):**
```typescript
function generateInviteCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Bỏ I,O,0,1
    let code = "";
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code; // Ví dụ: "K3MP7V"
}
```

### 8.2 Tham gia tour bằng mã mời

**File:** `src/services/tour.service.ts` (dòng 131-164)

```typescript
export async function joinTourByCode(userId, inviteCode) {
    // 1. Tìm tour theo mã → .eq("invite_code", inviteCode.toUpperCase())
    // 2. Kiểm tra tour active? Đã join chưa?
    // 3. Insert tour_members với role "member"
}
```

### 8.3 Lấy danh sách tours

**File:** `src/services/tour.service.ts` (dòng 62-102)

```typescript
export async function getMyTours(userId) {
    // 1. Lấy tour_ids từ bảng tour_members → .eq("user_id", userId)
    // 2. Lấy chi tiết tours → .in("id", tourIds)
    // 3. Đếm members mỗi tour
    // 4. Trả về mảng tours kèm myRole và memberCount
}
```

### 8.4 Live Location — Theo dõi vị trí thành viên

**File:** `src/services/tour.service.ts` (dòng 257-281)

```typescript
// Broadcast vị trí bản thân (dòng 257)
export async function updateMyLocation(userId, tourId, latitude, longitude) {
    await supabase.from("tour_members").update({
        last_latitude: latitude,
        last_longitude: longitude,
        last_updated_at: new Date().toISOString(),
    }).eq("tour_id", tourId).eq("user_id", userId);
}

// Lấy vị trí tất cả thành viên (dòng 272)
export async function getMemberLocations(tourId) {
    const { data } = await supabase.from("tour_members")
        .select("user_id, role, last_latitude, last_longitude, last_updated_at, profiles:user_id(display_name)")
        .eq("tour_id", tourId)
        .not("last_latitude", "is", null);  // Chỉ lấy member có vị trí
}
```

**Polling interval (map.tsx dòng 172-200):**
- Broadcast + fetch mỗi **10 giây** (`setInterval(() => {...}, 10000)`)
- Cleanup khi component unmount hoặc rời tour

**Hiển thị trên map (map.tsx dòng 763-799):**
- Mỗi member = 1 Marker dạng hình tròn
- **Xanh lá** = bản thân, **Cam** = owner, **Xanh dương** = thành viên
- Hiển thị "Vừa cập nhật" hoặc "X phút trước"

---

## 9. Upload ảnh (Photo)

### Công nghệ: **Cloudinary** (lưu ảnh) + **Supabase** (metadata) + **expo-image-picker** (chọn ảnh)

### Thư mục & File

| File | Chức năng |
|---|---|
| `src/services/photo.service.ts` | Upload/delete Cloudinary + CRUD Supabase (191 dòng) |
| `src/lib/cloudinary.ts` | Config Cloudinary |
| `src/components/Photo/PhotoUploadButton.tsx` | Component nút upload |

### 9.1 Config Cloudinary

**File:** `src/lib/cloudinary.ts` (9 dòng)

```typescript
export const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME!;
export const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;
// Upload URL: https://api.cloudinary.com/v1_1/{cloud_name}/image/upload
// Destroy URL: https://api.cloudinary.com/v1_1/{cloud_name}/image/destroy
```

### 9.2 Upload ảnh lên Cloudinary (Unsigned Upload)

**File:** `src/services/photo.service.ts` (dòng 9-42)

**API:** Cloudinary Upload → https://cloudinary.com/documentation/image_upload_api_reference

```typescript
export async function uploadPhoto(imageUri) {
    const formData = new FormData();

    // Tạo file object từ URI (đặc biệt cho React Native)
    formData.append("file", {
        uri: imageUri,           // file:///data/user/0/.../photo.jpg
        name: "photo.jpg",
        type: "image/jpeg",
    });
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET); // unsigned preset
    formData.append("folder", "tour-tracking");

    const response = await fetch(CLOUDINARY_UPLOAD_URL, {
        method: "POST",
        body: formData,
    });
    const data = await response.json();
    return {
        publicId: data.public_id,    // "tour-tracking/abc123"
        url: data.secure_url,        // "https://res.cloudinary.com/..."
    };
}
```

> **Unsigned Upload Preset** cho phép upload không cần authentication, cấu hình trên Cloudinary Dashboard → Settings → Upload Presets → tạo preset mới → Signing Mode: Unsigned

### 9.3 Xóa ảnh từ Cloudinary (Signed Delete)

**File:** `src/services/photo.service.ts` (dòng 116-145)

```typescript
async function deleteFromCloudinary(publicId) {
    const timestamp = Math.round(Date.now() / 1000).toString();

    // Tạo SHA-1 signature (BẮT BUỘC cho API destroy)
    // Format: sha1("public_id={publicId}&timestamp={timestamp}{api_secret}")
    const toSign = `public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
    const signature = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA1, toSign
    );

    const formData = new FormData();
    formData.append("public_id", publicId);
    formData.append("api_key", CLOUDINARY_API_KEY);
    formData.append("timestamp", timestamp);
    formData.append("signature", signature);    // SHA-1 signature

    await fetch(CLOUDINARY_DESTROY_URL, { method: "POST", body: formData });
}
```

> **`expo-crypto`** dùng để tạo SHA-1 hash trên React Native → https://docs.expo.dev/versions/latest/sdk/crypto/

### 9.4 Lưu metadata vào Supabase

**File:** `src/services/photo.service.ts` (dòng 45-77)

```typescript
export async function savePhotoMetadata(userId, publicId, url, options?) {
    // options: { tourId?, destinationId?, caption?, latitude?, longitude? }
    const location = lat && lng
        ? `SRID=4326;POINT(${longitude} ${latitude})`
        : null;

    await supabase.from("photos").insert({
        user_id: userId,
        cloudinary_public_id: publicId,
        cloudinary_url: url,
        tour_id, destination_id, caption, location,
    });
}
```

---

## 10. Công thức tính toán

### File: `src/utils/distance.ts` (101 dòng)

### 10.1 Haversine Formula — Khoảng cách 2 điểm GPS

```
a = sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlon/2)
c = 2 × atan2(√a, √(1-a))
d = R × c      (R = 6371 km = bán kính Trái Đất)
```

**Code (dòng 2-19):**
```typescript
export function haversineDistance(lat1, lon1, lat2, lon2): number {
    const R = 6371; // km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Kết quả: km
}
```

**Sử dụng ở:**
- Tính khoảng cách đến đích (navigation)
- Auto check-in khi gần điểm đến (< 100m)
- Auto-stop navigation khi đến đích (< 50m)
- Tính khoảng cách thành viên đến tour destinations
- Tổng quãng đường GPS tracking

### 10.2 Khoảng cách điểm đến đoạn thẳng (Point-to-Segment)

**Dùng cho**: Phát hiện user đi lệch đường (off-route detection)

```typescript
function distanceToSegment(pLat, pLng, aLat, aLng, bLat, bLng) {
    // Project point P onto line AB
    // t = dot(AP, AB) / dot(AB, AB), clamped to [0, 1]
    // Closest point on AB = A + t*(B-A)
    // Return haversineDistance(P, closest)
}
```

### 10.3 Khoảng cách đến Polyline

**File:** `src/utils/distance.ts` (dòng 61-79)

```typescript
export function distanceToPolyline(lat, lng, route) {
    // Duyệt tất cả segment (route[i] → route[i+1])
    // Trả về khoảng cách nhỏ nhất
    // Dùng cho: auto-reroute khi > 200m từ route
}
```

### 10.4 Tốc độ trung bình

**File:** `app/(tabs)/routes.tsx` (dòng 152-158)

```typescript
const distKm = distance_meters / 1000;
const durHours = duration_seconds / 3600;
const avgSpeed = durHours > 0 ? distKm / durHours : 0;  // km/h
```

---

## 11. Database Schema (Supabase)

### File migration

| File | Nội dung |
|---|---|
| `supabase/migrations/schema.sql` | Schema chính: profiles, destinations, routes, photos, push_tokens, user_stats + RLS policies + trigger |
| `supabase/migrations/tours.sql` | Schema tours: tours, tour_members, tour_destinations + live location columns + RLS |

### Sơ đồ quan hệ

```
auth.users (Supabase Auth)
    ↓ (trigger: handle_new_user)
profiles (id, display_name, avatar_url)
    ├── destinations (user_id → profiles.id)
    │       ├── photos (destination_id → destinations.id)
    │       └── tour_destinations (destination_id)
    ├── routes (user_id → profiles.id)
    ├── tours (creator_id → profiles.id)
    │       ├── tour_members (tour_id → tours.id, user_id → profiles.id)
    │       │       └── live location (last_latitude, last_longitude)
    │       └── tour_destinations (tour_id → tours.id)
    └── photos (user_id → profiles.id)
```

### Bảng chi tiết

#### profiles
```sql
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

#### destinations
```sql
CREATE TABLE destinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,  -- PostGIS
    latitude DOUBLE PRECISION, longitude DOUBLE PRECISION,
    is_favorite BOOLEAN DEFAULT false,
    is_visible BOOLEAN DEFAULT true,
    checked_in_at TIMESTAMPTZ DEFAULT now()
);
```

#### routes
```sql
CREATE TABLE routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT,
    path GEOGRAPHY(LINESTRING, 4326) NOT NULL,  -- PostGIS
    coordinates_json TEXT,                       -- JSON backup
    distance_meters FLOAT,
    duration_seconds INT,
    started_at TIMESTAMPTZ, ended_at TIMESTAMPTZ
);
```

#### tours + tour_members
```sql
CREATE TABLE tours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID REFERENCES profiles(id),
    name TEXT NOT NULL,
    invite_code TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active','completed','cancelled'))
);

CREATE TABLE tour_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tour_id UUID REFERENCES tours(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner','member')),
    last_latitude DOUBLE PRECISION,   -- Live location
    last_longitude DOUBLE PRECISION,
    last_updated_at TIMESTAMPTZ,
    UNIQUE(tour_id, user_id)
);
```

### Auto-create profile (Trigger)

```sql
CREATE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, display_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
    INSERT INTO user_stats (user_id) VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### Row Level Security (RLS)

Tất cả bảng đều bật RLS. Ví dụ:
- `destinations`: Chỉ user sở hữu mới CRUD được → `USING (auth.uid() = user_id)`
- `tour_members`: Tất cả authenticated users xem được, chỉ owner hoặc member xóa được
- `photos`: Owner quản lý, tour members xem ảnh tour

---

## 12. Tài khoản & API Keys cần thiết

### Bắt buộc

| Dịch vụ | Tài khoản cần | Cách lấy key | Biến môi trường |
|---|---|---|---|
| **Supabase** | Đăng ký tại [supabase.com](https://supabase.com) → tạo project | Project Settings → API → URL + anon key | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` |
| **Cloudinary** | Đăng ký tại [cloudinary.com](https://cloudinary.com) | Dashboard → Cloud Name, API Key, API Secret. Settings → Upload → tạo Unsigned Preset | `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME`, `EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET`, `EXPO_PUBLIC_CLOUDINARY_API_KEY`, `EXPO_PUBLIC_CLOUDINARY_API_SECRET` |
| **Google Maps** | Console tại [console.cloud.google.com](https://console.cloud.google.com) | APIs & Services → Maps SDK for Android → tạo API Key | `GOOGLE_API_KEY` (trong `app.json`) |

### Tùy chọn (có fallback)

| Dịch vụ | Tài khoản | Biến môi trường | Ghi chú |
|---|---|---|---|
| **OpenRouteService** | Đăng ký tại [openrouteservice.org](https://openrouteservice.org/dev/#/signup) | `EXPO_PUBLIC_ORS_API_KEY` | Fallback khi OSRM fail. Miễn phí 2000 req/ngày |

### Không cần tài khoản

| Dịch vụ | URL | Ghi chú |
|---|---|---|
| **OSRM** | `https://router.project-osrm.org` | Public demo server, miễn phí |
| **Overpass API** | `https://overpass-api.de/api/interpreter` | OpenStreetMap, miễn phí |

### Cấu hình Supabase Dashboard

1. **Authentication → Providers → Email**: Bật Email Auth
2. **Authentication → Email Templates → Confirm signup**: Dùng `{{ .Token }}` thay vì `{{ .ConfirmationURL }}` để gửi OTP
3. **SQL Editor**: Chạy `supabase/migrations/schema.sql` rồi `tours.sql`
4. **Database → Extensions**: Bật PostGIS
