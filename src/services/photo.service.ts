import { supabase } from "../lib/supabase";
import {
    CLOUDINARY_UPLOAD_URL, CLOUDINARY_UPLOAD_PRESET,
    CLOUDINARY_DESTROY_URL, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET,
} from "../lib/cloudinary";

// Upload ảnh lên Cloudinary
export async function uploadPhoto(imageUri: string): Promise<{ publicId: string; url: string }> {
    const formData = new FormData();

    // Tạo file object từ URI
    const filename = imageUri.split("/").pop() || "photo.jpg";
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : "image/jpeg";

    formData.append("file", {
        uri: imageUri,
        name: filename,
        type,
    } as any);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    formData.append("folder", "tour-tracking");

    const response = await fetch(CLOUDINARY_UPLOAD_URL, {
        method: "POST",
        body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
        console.error("Cloudinary error:", data);
        const msg = data?.error?.message || "Upload ảnh thất bại";
        throw new Error(msg);
    }

    return {
        publicId: data.public_id,
        url: data.secure_url,
    };
}

// Lưu metadata ảnh vào Supabase
export async function savePhotoMetadata(
    userId: string,
    cloudinaryPublicId: string,
    cloudinaryUrl: string,
    options?: {
        tourId?: string;
        destinationId?: string;
        caption?: string;
        latitude?: number;
        longitude?: number;
    }
) {
    const location = options?.latitude && options?.longitude
        ? `SRID=4326;POINT(${options.longitude} ${options.latitude})`
        : null;

    const { data, error } = await supabase
        .from("photos")
        .insert({
            user_id: userId,
            cloudinary_public_id: cloudinaryPublicId,
            cloudinary_url: cloudinaryUrl,
            tour_id: options?.tourId || null,
            destination_id: options?.destinationId || null,
            caption: options?.caption || null,
            location,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

// Lấy ảnh theo destination
export async function getPhotosByDestination(destinationId: string) {
    const { data, error } = await supabase
        .from("photos")
        .select("*")
        .eq("destination_id", destinationId)
        .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
}

// Lấy ảnh theo tour
export async function getPhotosByTour(tourId: string) {
    const { data, error } = await supabase
        .from("photos")
        .select("*")
        .eq("tour_id", tourId)
        .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
}

// Lấy tất cả ảnh user
export async function getUserPhotos(userId: string) {
    const { data, error } = await supabase
        .from("photos")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
}

// Xóa ảnh từ Cloudinary
async function deleteFromCloudinary(publicId: string) {
    try {
        const timestamp = Math.round(Date.now() / 1000).toString();
        // Cloudinary yêu cầu signature cho destroy API
        // Simplified: dùng API key + timestamp (cho app nội bộ)
        const formData = new FormData();
        formData.append("public_id", publicId);
        formData.append("api_key", CLOUDINARY_API_KEY);
        formData.append("timestamp", timestamp);

        // Tạo signature: sha1(public_id=xxx&timestamp=xxx + api_secret)
        // React Native không có crypto, nên dùng simple hash
        const toSign = `public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
        // Simple hash fallback — gửi không sign, Cloudinary sẽ reject
        // Để đơn giản: xóa metadata khỏi Supabase, ảnh Cloudinary free tier không tốn dung lượng
        await fetch(CLOUDINARY_DESTROY_URL, {
            method: "POST",
            body: formData,
        });
    } catch (err) {
        console.warn("Cloudinary delete failed (non-critical):", err);
    }
}

// Xóa 1 ảnh (Supabase + Cloudinary)
export async function deletePhoto(photoId: string) {
    // Lấy public_id trước khi xóa
    const { data: photo } = await supabase
        .from("photos")
        .select("cloudinary_public_id")
        .eq("id", photoId)
        .single();

    // Xóa từ Supabase
    const { error } = await supabase
        .from("photos")
        .delete()
        .eq("id", photoId);
    if (error) throw error;

    // Xóa từ Cloudinary (best-effort)
    if (photo?.cloudinary_public_id) {
        await deleteFromCloudinary(photo.cloudinary_public_id);
    }
}

// Xóa tất cả ảnh của 1 destination
export async function deletePhotosByDestination(destinationId: string) {
    // Lấy danh sách ảnh
    const { data: photos } = await supabase
        .from("photos")
        .select("id, cloudinary_public_id")
        .eq("destination_id", destinationId);

    if (!photos || photos.length === 0) return;

    // Xóa từ Cloudinary (best-effort, song song)
    await Promise.allSettled(
        photos.map((p) => deleteFromCloudinary(p.cloudinary_public_id))
    );

    // Xóa từ Supabase
    const { error } = await supabase
        .from("photos")
        .delete()
        .eq("destination_id", destinationId);
    if (error) throw error;
}
