// ⚠️ Thay bằng thông tin từ Cloudinary Dashboard
export const CLOUDINARY_CLOUD_NAME = "dkvpqak9l";

// Upload preset (unsigned)
export const CLOUDINARY_UPLOAD_PRESET = "tour_tracking";

// ⚠️ API Key + Secret — lấy từ Dashboard → Settings → Access Keys
// Cần cho xóa ảnh (chỉ app nội bộ, không public)
export const CLOUDINARY_API_KEY = "YOUR_API_KEY";
export const CLOUDINARY_API_SECRET = "YOUR_API_SECRET";

export const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
export const CLOUDINARY_DESTROY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/destroy`;
