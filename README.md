# 🗺️ Tour Tracking

Ứng dụng di động theo dõi tour du lịch theo nhóm, được xây dựng bằng **React Native (Expo)** và **Supabase**. Hỗ trợ theo dõi vị trí thời gian thực, điều hướng chỉ đường, quản lý tour nhóm, check-in điểm đến và chụp ảnh lưu niệm.

---

> 📖 **[Xem tài liệu kỹ thuật chi tiết (DOCUMENT.md)](./DOCUMENT.md)** — Mô tả cách triển khai từng chức năng, API, công thức tính toán, database schema, và hướng dẫn cấu hình.

---

## 📱 Tính năng chính

### 🗺️ Bản đồ (Map)
- Hiển thị bản đồ với vị trí hiện tại của người dùng
- **Ghi lại quãng đường** (Route Tracking) — bắt đầu/dừng ghi GPS, tự động lưu lịch sử
- **Điều hướng chỉ đường** (Turn-by-turn Navigation) — chỉ đường chi tiết từ vị trí hiện tại đến điểm đến, tự động vẽ lại khi đi sai đường
- **Khám phá POI** — tìm kiếm địa điểm xung quanh (nhà hàng, khách sạn, ATM, v.v.) qua OpenStreetMap
- **Check-in** — nhấn giữ trên bản đồ để tạo điểm đến mới
- **Xem vị trí thành viên tour** — hiển thị vị trí real-time của tất cả thành viên trong tour

### 📍 Điểm đến (Destinations)
- Danh sách tất cả điểm đã check-in
- Đánh dấu yêu thích (⭐)
- Xem trên bản đồ, tìm đường đi đến điểm đến
- Upload ảnh cho từng điểm đến

### 🛤️ Tuyến đường (Routes)
- Lịch sử các tuyến đường đã ghi lại
- Thông tin quãng đường (km), thời gian, tốc độ trung bình
- Xem lại tuyến đường trên bản đồ

### 👥 Tours (Quản lý tour nhóm)
- **Tạo tour** mới với tên và mô tả
- **Mời thành viên** bằng mã mời (invite code)
- **Tham gia tour** bằng mã mời
- **Quản lý thành viên** — xem, xóa thành viên (chủ tour)
- **Thêm điểm đến** vào tour
- **Theo dõi vị trí** thành viên real-time trên bản đồ
- **Chia sẻ mã mời** qua ứng dụng khác
- Cập nhật trạng thái tour (hoạt động / hoàn thành / đã hủy)

### 👤 Hồ sơ (Profile)
- Xem và chỉnh sửa thông tin cá nhân
- Upload avatar
- Đăng xuất

### 🔐 Xác thực (Authentication)
- Đăng ký bằng email + mật khẩu
- Xác thực OTP qua email
- Đăng nhập / Đăng xuất
- Tự động quản lý session

---

## 🛠️ Công nghệ sử dụng

| Công nghệ | Mục đích |
|---|---|
| **React Native** (v0.81) | Framework phát triển ứng dụng di động |
| **Expo** (SDK 54) | Nền tảng phát triển & build React Native |
| **Expo Router** (v6) | Điều hướng file-based routing |
| **TypeScript** | Ngôn ngữ lập trình type-safe |
| **Supabase** | Backend-as-a-Service (Auth, Database, Realtime) |
| **PostGIS** | Xử lý dữ liệu không gian (tọa độ, khoảng cách) |
| **React Native Paper** | UI components theo Material Design 3 |
| **React Native Maps** | Hiển thị bản đồ (Google Maps / Apple Maps) |
| **Cloudinary** | Lưu trữ và quản lý ảnh (unsigned upload) |
| **OSRM / ORS** | Tính toán đường đi và điều hướng |
| **OpenStreetMap Overpass** | Tìm kiếm POI (Points of Interest) |
| **EAS Build** | Build và phân phối ứng dụng |

---

## 📁 Cấu trúc thư mục

```
tour-trackking/
├── app/                          # Expo Router screens
│   ├── (auth)/                   # Màn hình xác thực
│   │   ├── login.tsx             # Đăng nhập
│   │   ├── register.tsx          # Đăng ký
│   │   └── verify-otp.tsx        # Xác thực OTP
│   ├── (tabs)/                   # Tab chính
│   │   ├── map.tsx               # Bản đồ & điều hướng
│   │   ├── destinations.tsx      # Điểm đến
│   │   ├── routes.tsx            # Tuyến đường
│   │   ├── tours.tsx             # Quản lý tour
│   │   └── profile.tsx           # Hồ sơ cá nhân
│   ├── _layout.tsx               # Root layout
│   └── index.tsx                 # Entry point (redirect)
├── src/
│   ├── components/               # UI components
│   │   ├── Auth/                 # AuthGuard
│   │   ├── Map/                  # RouteOverlay, DestinationMarker
│   │   └── Photo/                # PhotoUploadButton
│   ├── hooks/                    # Custom hooks (useAuth, useLocation, ...)
│   ├── lib/                      # Supabase client config
│   ├── services/                 # Business logic
│   │   ├── auth.service.ts       # Đăng ký, đăng nhập, OTP
│   │   ├── destination.service.ts# Check-in, CRUD điểm đến
│   │   ├── directions.service.ts # Tính đường đi (OSRM/ORS)
│   │   ├── photo.service.ts      # Upload ảnh lên Cloudinary
│   │   ├── poi.service.ts        # Tìm POI (Overpass API)
│   │   ├── route.service.ts      # Lưu/truy vấn tuyến đường
│   │   └── tour.service.ts       # CRUD tour, thành viên, vị trí
│   ├── theme/                    # Theme & spacing config
│   ├── types/                    # TypeScript type definitions
│   └── utils/                    # Utility functions (distance, ...)
├── supabase/migrations/          # SQL migration files
├── assets/                       # Icons, splash screen
├── app.json                      # Expo config
├── eas.json                      # EAS Build config
├── .env                          # Environment variables (local)
└── package.json
```

---

## 🚀 Cách chạy

### Yêu cầu

- **Node.js** >= 18
- **npm** hoặc **yarn**
- **Expo CLI** (`npm install -g expo-cli`)
- **EAS CLI** (`npm install -g eas-cli`) — để build APK/IPA
- Tài khoản **Expo** (đăng ký tại [expo.dev](https://expo.dev))
- Tài khoản **Supabase** (đăng ký tại [supabase.com](https://supabase.com))

### 1. Clone project

```bash
git clone https://github.com/nan-ntn36/tour-trackking.git
cd tour-trackking
```

### 2. Cài đặt dependencies

```bash
npm install
```

### 3. Cấu hình biến môi trường

Tạo file `.env` từ template:

```bash
cp .env.example .env
```

Điền các giá trị vào `.env`:

```env
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Cloudinary
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your-upload-preset
EXPO_PUBLIC_CLOUDINARY_API_KEY=your-api-key
EXPO_PUBLIC_CLOUDINARY_API_SECRET=your-api-secret

# OpenRouteService
EXPO_PUBLIC_ORS_API_KEY=your-ors-api-key

# Google Maps (Android)
GOOGLE_API_KEY=your-google-api-key
```

### 4. Chạy trên Expo Go (development)

```bash
npm start
```

Sau đó quét QR code bằng ứng dụng **Expo Go** trên điện thoại.

### 5. Build APK (Android)

```bash
# Đăng nhập EAS
eas login

# Build APK (preview profile)
eas build --profile preview --platform android
```

> ⚠️ **Lưu ý:** Biến môi trường đã được cấu hình trong `eas.json` (profile `preview`). Nếu thay đổi giá trị trong `.env`, cần cập nhật lại trong `eas.json` tương ứng.

---

## 🗄️ Database (Supabase)

Chạy các migration SQL trong thư mục `supabase/migrations/` trên Supabase Dashboard:

1. `schema.sql` — Bảng profiles, destinations, routes, photos
2. `tours.sql` — Bảng tours, tour_members, tour_destinations

---

## 📄 License

MIT
