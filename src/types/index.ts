// Types cho Tour Tracking App

// ==================== User ====================
export interface Profile {
    id: string;
    display_name: string;
    avatar_url: string | null;
    created_at: string;
}

// ==================== Destination ====================
export interface Destination {
    id: string;
    user_id: string;
    name: string;
    description: string | null;
    location: {
        type: "Point";
        coordinates: [number, number]; // [longitude, latitude]
    };
    address: string | null;
    is_favorite: boolean;
    is_visible: boolean;
    checked_in_at: string;
    created_at: string;
}

// ==================== Route ====================
export interface Route {
    id: string;
    user_id: string;
    name: string | null;
    path: {
        type: "LineString";
        coordinates: [number, number][]; // [[lng, lat], ...]
    };
    distance_meters: number | null;
    duration_seconds: number | null;
    is_visible: boolean;
    started_at: string | null;
    ended_at: string | null;
    created_at: string;
}

// ==================== Tour ====================
export type TourStatus = "active" | "completed" | "cancelled";
export type TourMemberRole = "owner" | "member";

export interface Tour {
    id: string;
    creator_id: string;
    name: string;
    description: string | null;
    invite_code: string;
    status: TourStatus;
    start_location: {
        type: "Point";
        coordinates: [number, number];
    } | null;
    created_at: string;
}

export interface TourMember {
    id: string;
    tour_id: string;
    user_id: string;
    role: TourMemberRole;
    joined_at: string;
    profile?: Profile; // populated via join
}

// ==================== Location ====================
export interface MemberLocation {
    id: string;
    tour_id: string;
    user_id: string;
    location: {
        type: "Point";
        coordinates: [number, number];
    };
    updated_at: string;
    profile?: Profile; // populated via join
}

export interface LatLng {
    latitude: number;
    longitude: number;
}

// ==================== Photo ====================
export interface Photo {
    id: string;
    user_id: string;
    tour_id: string | null;
    destination_id: string | null;
    cloudinary_public_id: string;
    cloudinary_url: string;
    caption: string | null;
    location: {
        type: "Point";
        coordinates: [number, number];
    } | null;
    created_at: string;
}

// ==================== Stats ====================
export interface UserStats {
    user_id: string;
    total_distance_km: number;
    total_tours: number;
    total_checkins: number;
    updated_at: string;
}
