import { supabase } from "../lib/supabase";

// ==================== Helpers ====================

/** Tạo mã mời 6 ký tự (chữ hoa + số) */
function generateInviteCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // bỏ I,O,0,1 tránh nhầm
    let code = "";
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// ==================== Tour CRUD ====================

/** Tạo tour mới + thêm creator làm owner */
export async function createTour(
    userId: string,
    name: string,
    description?: string,
    latitude?: number,
    longitude?: number
) {
    const invite_code = generateInviteCode();

    const insertData: any = {
        creator_id: userId,
        name,
        description: description || null,
        invite_code,
    };

    if (latitude != null && longitude != null) {
        insertData.start_location = `SRID=4326;POINT(${longitude} ${latitude})`;
    }

    // Tạo tour
    const { data: tour, error: tourError } = await supabase
        .from("tours")
        .insert(insertData)
        .select()
        .single();

    if (tourError) throw tourError;

    // Thêm creator làm owner
    const { error: memberError } = await supabase
        .from("tour_members")
        .insert({
            tour_id: tour.id,
            user_id: userId,
            role: "owner",
        });

    if (memberError) throw memberError;

    return tour;
}

/** Lấy danh sách tours mà user tham gia */
export async function getMyTours(userId: string) {
    // Lấy tour_ids mà user là member
    const { data: memberships, error: memErr } = await supabase
        .from("tour_members")
        .select("tour_id, role")
        .eq("user_id", userId);

    if (memErr) throw memErr;
    if (!memberships || memberships.length === 0) return [];

    const tourIds = memberships.map((m) => m.tour_id);
    const roleMap = new Map(memberships.map((m) => [m.tour_id, m.role]));

    // Lấy chi tiết tours
    const { data: tours, error: tourErr } = await supabase
        .from("tours")
        .select("*")
        .in("id", tourIds)
        .order("created_at", { ascending: false });

    if (tourErr) throw tourErr;

    // Đếm số member mỗi tour
    const { data: counts, error: countErr } = await supabase
        .from("tour_members")
        .select("tour_id")
        .in("tour_id", tourIds);

    if (countErr) throw countErr;

    const countMap = new Map<string, number>();
    counts?.forEach((c) => {
        countMap.set(c.tour_id, (countMap.get(c.tour_id) || 0) + 1);
    });

    return (tours || []).map((t) => ({
        ...t,
        myRole: roleMap.get(t.id) || "member",
        memberCount: countMap.get(t.id) || 0,
    }));
}

/** Lấy chi tiết 1 tour */
export async function getTourById(tourId: string) {
    const { data, error } = await supabase
        .from("tours")
        .select("*")
        .eq("id", tourId)
        .single();

    if (error) throw error;
    return data;
}

/** Lấy danh sách thành viên của tour (kèm profile) */
export async function getTourMembers(tourId: string) {
    const { data, error } = await supabase
        .from("tour_members")
        .select("*, profiles:user_id(id, display_name, avatar_url)")
        .eq("tour_id", tourId)
        .order("joined_at", { ascending: true });

    if (error) throw error;
    return data || [];
}

// ==================== Join / Leave ====================

/** Tham gia tour bằng mã mời */
export async function joinTourByCode(userId: string, inviteCode: string) {
    // Tìm tour theo invite code
    const { data: tour, error: findErr } = await supabase
        .from("tours")
        .select("id, name, status")
        .eq("invite_code", inviteCode.toUpperCase().trim())
        .single();

    if (findErr || !tour) throw new Error("Không tìm thấy tour với mã này");
    if (tour.status !== "active") throw new Error("Tour này đã kết thúc");

    // Kiểm tra đã là member chưa
    const { data: existing } = await supabase
        .from("tour_members")
        .select("id")
        .eq("tour_id", tour.id)
        .eq("user_id", userId)
        .maybeSingle();

    if (existing) throw new Error("Bạn đã tham gia tour này rồi");

    // Thêm member
    const { error: joinErr } = await supabase
        .from("tour_members")
        .insert({
            tour_id: tour.id,
            user_id: userId,
            role: "member",
        });

    if (joinErr) throw joinErr;

    return tour;
}

/** Rời tour */
export async function leaveTour(userId: string, tourId: string) {
    const { error } = await supabase
        .from("tour_members")
        .delete()
        .eq("tour_id", tourId)
        .eq("user_id", userId);

    if (error) throw error;
}

// ==================== Management ====================

/** Xóa tour (chỉ owner) */
export async function deleteTour(tourId: string) {
    const { error } = await supabase
        .from("tours")
        .delete()
        .eq("id", tourId);

    if (error) throw error;
}

/** Cập nhật trạng thái tour */
export async function updateTourStatus(tourId: string, status: "active" | "completed" | "cancelled") {
    const { error } = await supabase
        .from("tours")
        .update({ status })
        .eq("id", tourId);

    if (error) throw error;
}

/** Xóa thành viên khỏi tour (chỉ owner) */
export async function removeTourMember(tourId: string, userId: string) {
    const { error } = await supabase
        .from("tour_members")
        .delete()
        .eq("tour_id", tourId)
        .eq("user_id", userId);

    if (error) throw error;
}

// ==================== Tour Destinations ====================

/** Lấy danh sách điểm đến của tour */
export async function getTourDestinations(tourId: string) {
    const { data, error } = await supabase
        .from("tour_destinations")
        .select("*, destinations:destination_id(id, name, description, latitude, longitude, is_favorite)")
        .eq("tour_id", tourId)
        .order("added_at", { ascending: true });

    if (error) throw error;
    return data || [];
}

/** Thêm điểm đến vào tour */
export async function addDestinationToTour(tourId: string, destinationId: string, addedBy: string) {
    const { data, error } = await supabase
        .from("tour_destinations")
        .insert({
            tour_id: tourId,
            destination_id: destinationId,
            added_by: addedBy,
        })
        .select()
        .single();

    if (error) {
        if (error.code === "23505") throw new Error("Điểm đến này đã có trong tour");
        throw error;
    }
    return data;
}

/** Xóa điểm đến khỏi tour */
export async function removeDestinationFromTour(tourId: string, destinationId: string) {
    const { error } = await supabase
        .from("tour_destinations")
        .delete()
        .eq("tour_id", tourId)
        .eq("destination_id", destinationId);

    if (error) throw error;
}

// ==================== Live Location ====================

/** Cập nhật vị trí bản thân trong tour */
export async function updateMyLocation(userId: string, tourId: string, latitude: number, longitude: number) {
    const { error } = await supabase
        .from("tour_members")
        .update({
            last_latitude: latitude,
            last_longitude: longitude,
            last_updated_at: new Date().toISOString(),
        })
        .eq("tour_id", tourId)
        .eq("user_id", userId);

    if (error) throw error;
}

/** Lấy vị trí tất cả thành viên trong tour */
export async function getMemberLocations(tourId: string) {
    const { data, error } = await supabase
        .from("tour_members")
        .select("user_id, role, last_latitude, last_longitude, last_updated_at, profiles:user_id(id, display_name, avatar_url)")
        .eq("tour_id", tourId)
        .not("last_latitude", "is", null);

    if (error) throw error;
    return data || [];
}
