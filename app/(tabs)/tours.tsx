import { useState, useCallback, useEffect } from "react";
import { View, StyleSheet, FlatList, Alert, Pressable, Share, Clipboard, ScrollView } from "react-native";
import {
    Text, Surface, IconButton, FAB, Portal, Dialog, Button, TextInput,
    Divider, Snackbar, ActivityIndicator, Chip, Avatar, Menu,
} from "react-native-paper";
import { useAppTheme } from "../../src/theme/ThemeProvider";
import { spacing, borderRadius } from "../../src/theme/spacing";
import { useAuth } from "../../src/hooks/useAuth";
import {
    createTour, getMyTours, getTourMembers, joinTourByCode,
    leaveTour, deleteTour, updateTourStatus, removeTourMember,
    getTourDestinations, addDestinationToTour, removeDestinationFromTour,
} from "../../src/services/tour.service";
import { getDestinations } from "../../src/services/destination.service";
import { getMemberLocations } from "../../src/services/tour.service";
import { haversineDistance, formatDistance } from "../../src/utils/distance";
import { useFocusEffect, router } from "expo-router";
import AuthGuard from "../../src/components/Auth/AuthGuard";

type ViewMode = "list" | "detail";

export default function ToursScreen() {
    const { paperTheme } = useAppTheme();
    const { user, loading: authLoading } = useAuth();
    const colors = paperTheme.colors;

    // Tours data
    const [tours, setTours] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [snackMsg, setSnackMsg] = useState("");

    // View mode: list or detail
    const [viewMode, setViewMode] = useState<ViewMode>("list");
    const [selectedTour, setSelectedTour] = useState<any>(null);
    const [tourMembers, setTourMembers] = useState<any[]>([]);
    const [membersLoading, setMembersLoading] = useState(false);

    // Tour destinations
    const [tourDestinations, setTourDestinations] = useState<any[]>([]);
    const [destsLoading, setDestsLoading] = useState(false);
    const [showAddDest, setShowAddDest] = useState(false);
    const [userDests, setUserDests] = useState<any[]>([]);
    const [userDestsLoading, setUserDestsLoading] = useState(false);

    // Create dialog
    const [showCreate, setShowCreate] = useState(false);
    const [createName, setCreateName] = useState("");
    const [createDesc, setCreateDesc] = useState("");
    const [creating, setCreating] = useState(false);

    // Join dialog
    const [showJoin, setShowJoin] = useState(false);
    const [joinCode, setJoinCode] = useState("");
    const [joining, setJoining] = useState(false);

    // FAB state
    const [fabOpen, setFabOpen] = useState(false);

    // Menu for tour card
    const [menuTourId, setMenuTourId] = useState<string | null>(null);

    // Clear data on logout
    useEffect(() => {
        if (!user) {
            setTours([]);
            setSelectedTour(null);
            setTourMembers([]);
            setTourDestinations([]);
            setViewMode("list");
        }
    }, [user]);

    // ==================== Load Data ====================
    const loadTours = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const data = await getMyTours(user.id);
            setTours(data);
        } catch (err: any) {
            console.warn("Load tours error:", err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useFocusEffect(
        useCallback(() => {
            loadTours();
        }, [loadTours])
    );



    // ==================== Create Tour ====================
    const handleCreate = async () => {
        if (!createName.trim() || !user) return;
        setCreating(true);
        try {
            const tour = await createTour(user.id, createName.trim(), createDesc.trim() || undefined);
            setSnackMsg(`✅ Đã tạo tour "${tour.name}"`);
            setCreateName("");
            setCreateDesc("");
            setShowCreate(false);
            loadTours();
        } catch (err: any) {
            Alert.alert("Lỗi", err.message);
        } finally {
            setCreating(false);
        }
    };

    // ==================== Join Tour ====================
    const handleJoin = async () => {
        if (!joinCode.trim() || !user) return;
        setJoining(true);
        try {
            const tour = await joinTourByCode(user.id, joinCode.trim());
            setSnackMsg(`🎉 Đã tham gia tour "${tour.name}"`);
            setJoinCode("");
            setShowJoin(false);
            loadTours();
        } catch (err: any) {
            Alert.alert("Lỗi", err.message);
        } finally {
            setJoining(false);
        }
    };

    // ==================== Tour Actions ====================
    const handleCopyCode = (code: string) => {
        Clipboard.setString(code);
        setSnackMsg(`📋 Đã copy mã: ${code}`);
    };

    const handleShareCode = async (tour: any) => {
        try {
            await Share.share({
                message: `Tham gia tour "${tour.name}" trên Tour Tracking!\nMã mời: ${tour.invite_code}`,
            });
        } catch { }
    };

    const handleLeaveTour = (tour: any) => {
        Alert.alert("Rời tour", `Bạn muốn rời "${tour.name}"?`, [
            { text: "Hủy", style: "cancel" },
            {
                text: "Rời", style: "destructive",
                onPress: async () => {
                    try {
                        await leaveTour(user!.id, tour.id);
                        setSnackMsg("Đã rời tour");
                        if (viewMode === "detail") {
                            setViewMode("list");
                            setSelectedTour(null);
                        }
                        loadTours();
                    } catch (err: any) {
                        Alert.alert("Lỗi", err.message);
                    }
                },
            },
        ]);
    };

    const handleDeleteTour = (tour: any) => {
        Alert.alert("Xóa tour", `Xóa "${tour.name}"? Tất cả thành viên sẽ bị xóa.`, [
            { text: "Hủy", style: "cancel" },
            {
                text: "Xóa", style: "destructive",
                onPress: async () => {
                    try {
                        await deleteTour(tour.id);
                        setSnackMsg("Đã xóa tour");
                        if (viewMode === "detail") {
                            setViewMode("list");
                            setSelectedTour(null);
                        }
                        loadTours();
                    } catch (err: any) {
                        Alert.alert("Lỗi", err.message);
                    }
                },
            },
        ]);
    };

    const handleUpdateStatus = async (tourId: string, status: "active" | "completed" | "cancelled") => {
        try {
            await updateTourStatus(tourId, status);
            setSnackMsg(`Đã cập nhật trạng thái`);
            loadTours();
            // Update selected tour if in detail view
            if (selectedTour?.id === tourId) {
                setSelectedTour((prev: any) => prev ? { ...prev, status } : prev);
            }
        } catch (err: any) {
            Alert.alert("Lỗi", err.message);
        }
    };

    const handleRemoveMember = (member: any) => {
        const memberName = member.profiles?.display_name || "thành viên";
        Alert.alert("Xóa thành viên", `Xóa "${memberName}" khỏi tour?`, [
            { text: "Hủy", style: "cancel" },
            {
                text: "Xóa", style: "destructive",
                onPress: async () => {
                    try {
                        await removeTourMember(selectedTour.id, member.user_id);
                        setSnackMsg(`Đã xóa ${memberName}`);
                        loadMembers(selectedTour.id);
                    } catch (err: any) {
                        Alert.alert("Lỗi", err.message);
                    }
                },
            },
        ]);
    };

    // ==================== Detail View ====================
    const openDetail = async (tour: any) => {
        setSelectedTour(tour);
        setViewMode("detail");
        loadMembers(tour.id);
        loadTourDests(tour.id);
    };

    const loadMembers = async (tourId: string) => {
        setMembersLoading(true);
        try {
            const members = await getTourMembers(tourId);
            setTourMembers(members);
        } catch (err: any) {
            console.warn("Load members error:", err);
        } finally {
            setMembersLoading(false);
        }
    };

    const loadTourDests = async (tourId: string) => {
        setDestsLoading(true);
        try {
            const dests = await getTourDestinations(tourId);
            setTourDestinations(dests);
        } catch (err: any) {
            console.warn("Load tour destinations error:", err);
        } finally {
            setDestsLoading(false);
        }
    };

    const openAddDestDialog = async () => {
        setShowAddDest(true);
        if (!user) return;
        setUserDestsLoading(true);
        try {
            const dests = await getDestinations(user.id);
            // Lọc bỏ những điểm đã có trong tour
            const existingIds = new Set(tourDestinations.map((td) => td.destination_id));
            setUserDests(dests.filter((d: any) => !existingIds.has(d.id)));
        } catch (err: any) {
            console.warn("Load user dests error:", err);
        } finally {
            setUserDestsLoading(false);
        }
    };

    const handleAddDest = async (destId: string) => {
        if (!user || !selectedTour) return;
        try {
            await addDestinationToTour(selectedTour.id, destId, user.id);
            setSnackMsg("✅ Đã thêm điểm đến");
            setShowAddDest(false);
            loadTourDests(selectedTour.id);
        } catch (err: any) {
            Alert.alert("Lỗi", err.message);
        }
    };

    const handleRemoveDest = (td: any) => {
        const destName = td.destinations?.name || "điểm đến";
        Alert.alert("Xóa điểm đến", `Xóa "${destName}" khỏi tour?`, [
            { text: "Hủy", style: "cancel" },
            {
                text: "Xóa", style: "destructive",
                onPress: async () => {
                    try {
                        await removeDestinationFromTour(selectedTour.id, td.destination_id);
                        setSnackMsg("Đã xóa điểm đến");
                        loadTourDests(selectedTour.id);
                    } catch (err: any) {
                        Alert.alert("Lỗi", err.message);
                    }
                },
            },
        ]);
    };

    const handleGoToDestMap = (dest: any) => {
        if (dest?.latitude && dest?.longitude) {
            router.navigate({
                pathname: "/(tabs)/map",
                params: {
                    focusLat: dest.latitude.toString(),
                    focusLng: dest.longitude.toString(),
                    focusName: dest.name,
                    tourId: selectedTour?.id,
                    tourName: selectedTour?.name,
                    _ts: Date.now().toString(),
                },
            });
        }
    };

    // ==================== Render Helpers ====================
    const statusLabel = (status: string) => {
        switch (status) {
            case "active": return "Hoạt động";
            case "completed": return "Hoàn thành";
            case "cancelled": return "Đã hủy";
            default: return status;
        }
    };

    const statusColor = (status: string) => {
        switch (status) {
            case "active": return "#4CAF50";
            case "completed": return "#2196F3";
            case "cancelled": return colors.error;
            default: return colors.outline;
        }
    };

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    // ==================== Tour Card ====================
    const renderTourCard = ({ item }: { item: any }) => {
        const isOwner = item.myRole === "owner";
        return (
            <Pressable onPress={() => openDetail(item)}>
                <Surface style={[styles.card, { backgroundColor: colors.surface }]} elevation={1}>
                    <View style={styles.cardHeader}>
                        <View style={{ flex: 1 }}>
                            <Text variant="titleMedium" style={{ fontWeight: "bold" }}>
                                {item.name}
                            </Text>
                            {item.description ? (
                                <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant, marginTop: 2 }} numberOfLines={1}>
                                    {item.description}
                                </Text>
                            ) : null}
                        </View>
                        <Chip
                            compact
                            textStyle={{ fontSize: 11, color: "#fff" }}
                            style={{ backgroundColor: statusColor(item.status) }}
                        >
                            {statusLabel(item.status)}
                        </Chip>
                    </View>

                    <Divider style={{ marginVertical: spacing.xs }} />

                    <View style={styles.cardFooter}>
                        <View style={styles.cardMeta}>
                            <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
                                👥 {item.memberCount} thành viên
                            </Text>
                            <Text variant="bodySmall" style={{ color: colors.outline }}>
                                •  {isOwner ? "👑 Owner" : "Thành viên"}
                            </Text>
                            <Text variant="bodySmall" style={{ color: colors.outline }}>
                                •  {formatDate(item.created_at)}
                            </Text>
                        </View>

                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                            <Pressable
                                onPress={() => handleCopyCode(item.invite_code)}
                                style={[styles.codeChip, { backgroundColor: colors.primaryContainer }]}
                            >
                                <Text variant="labelSmall" style={{ color: colors.onPrimaryContainer, fontWeight: "bold", letterSpacing: 1.5 }}>
                                    {item.invite_code}
                                </Text>
                            </Pressable>

                            <Menu
                                visible={menuTourId === item.id}
                                onDismiss={() => setMenuTourId(null)}
                                anchor={
                                    <IconButton
                                        icon="dots-vertical"
                                        size={20}
                                        iconColor={colors.onSurfaceVariant}
                                        onPress={() => setMenuTourId(item.id)}
                                    />
                                }
                            >
                                <Menu.Item
                                    leadingIcon="share-variant"
                                    title="Chia sẻ mã mời"
                                    onPress={() => { setMenuTourId(null); handleShareCode(item); }}
                                />
                                {isOwner && item.status === "active" && (
                                    <Menu.Item
                                        leadingIcon="check-circle"
                                        title="Hoàn thành tour"
                                        onPress={() => { setMenuTourId(null); handleUpdateStatus(item.id, "completed"); }}
                                    />
                                )}
                                {isOwner ? (
                                    <Menu.Item
                                        leadingIcon="delete"
                                        title="Xóa tour"
                                        titleStyle={{ color: colors.error }}
                                        onPress={() => { setMenuTourId(null); handleDeleteTour(item); }}
                                    />
                                ) : (
                                    <Menu.Item
                                        leadingIcon="logout"
                                        title="Rời tour"
                                        titleStyle={{ color: colors.error }}
                                        onPress={() => { setMenuTourId(null); handleLeaveTour(item); }}
                                    />
                                )}
                            </Menu>
                        </View>
                    </View>
                </Surface>
            </Pressable>
        );
    };

    // ==================== Member Card ====================
    const handleGoToMember = (member: any) => {
        const profile = member.profiles;
        const name = profile?.display_name || "Thành viên";
        if (member.last_latitude && member.last_longitude) {
            router.navigate({
                pathname: "/(tabs)/map",
                params: {
                    focusLat: member.last_latitude.toString(),
                    focusLng: member.last_longitude.toString(),
                    focusName: name,
                    tourId: selectedTour?.id,
                    tourName: selectedTour?.name,
                    _ts: Date.now().toString(),
                },
            });
        } else {
            Alert.alert("Chưa có vị trí", `${name} chưa chia sẻ vị trí. Họ cần mở bản đồ tour trước.`);
        }
    };

    const renderMemberCard = ({ item }: { item: any }) => {
        const profile = item.profiles;
        const isOwner = item.role === "owner";
        const isSelf = item.user_id === user?.id;
        const amIOwner = selectedTour?.creator_id === user?.id;
        const initial = (profile?.display_name || "?").charAt(0).toUpperCase();
        const hasLocation = item.last_latitude && item.last_longitude;

        return (
            <Pressable onPress={() => handleGoToMember(item)}>
                <Surface style={[styles.memberCard, { backgroundColor: colors.surface }]} elevation={1}>
                    <View style={styles.memberRow}>
                        <Avatar.Text size={40} label={initial} style={{ backgroundColor: isOwner ? colors.primary : colors.secondaryContainer }} />
                        <View style={{ flex: 1, marginLeft: spacing.sm }}>
                            <Text variant="bodyLarge" style={{ fontWeight: "bold" }}>
                                {profile?.display_name || "Người dùng"}
                                {isSelf ? " (Bạn)" : ""}
                            </Text>
                            <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
                                {isOwner ? "👑 Owner" : "Thành viên"} • {hasLocation ? "📍 Đang chia sẻ vị trí" : "⏳ Chưa có vị trí"}
                            </Text>
                        </View>
                        {hasLocation && !isSelf && (
                            <IconButton
                                icon="navigation-variant"
                                iconColor={colors.primary}
                                size={16}
                                style={{ margin: 0 }}
                                onPress={() => handleGoToMember(item)}
                            />
                        )}
                        {amIOwner && !isSelf && !isOwner && (
                            <IconButton
                                icon="account-remove"
                                iconColor={colors.error}
                                size={16}
                                style={{ margin: 0 }}
                                onPress={() => handleRemoveMember(item)}
                            />
                        )}
                    </View>
                </Surface>
            </Pressable>
        );
    };

    // ==================== Detail View ====================
    if (viewMode === "detail" && selectedTour) {
        const isOwner = selectedTour.creator_id === user?.id;

        return (
            <AuthGuard isAuthenticated={!!user} loading={authLoading}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Modern Header */}
                <Surface style={[styles.detailHeaderNew, { backgroundColor: colors.primary }]} elevation={4}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <IconButton icon="arrow-left" iconColor="#fff" onPress={() => { setViewMode("list"); setSelectedTour(null); }} />
                        <View style={{ flex: 1 }}>
                            <Text variant="titleLarge" style={{ fontWeight: "bold", color: "#fff" }} numberOfLines={1}>
                                {selectedTour.name}
                            </Text>
                            {selectedTour.description ? (
                                <Text variant="bodySmall" style={{ color: "rgba(255,255,255,0.8)" }} numberOfLines={1}>
                                    {selectedTour.description}
                                </Text>
                            ) : null}
                        </View>
                        <Chip
                            compact
                            textStyle={{ fontSize: 11, color: "#fff", fontWeight: "bold" }}
                            style={{ backgroundColor: statusColor(selectedTour.status), marginRight: spacing.xs }}
                        >
                            {statusLabel(selectedTour.status)}
                        </Chip>
                    </View>
                </Surface>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
                    {/* Invite code card */}
                    <Surface style={[styles.inviteCardNew, { backgroundColor: colors.primaryContainer }]} elevation={2}>
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                            <View style={{ flex: 1 }}>
                                <Text variant="labelSmall" style={{ color: colors.onPrimaryContainer, opacity: 0.7 }}>
                                    MÃ MỜI
                                </Text>
                                <Text variant="headlineSmall" style={{ fontWeight: "bold", letterSpacing: 4, color: colors.onPrimaryContainer }}>
                                    {selectedTour.invite_code}
                                </Text>
                            </View>
                            <IconButton
                                icon="content-copy"
                                mode="contained"
                                containerColor="rgba(255,255,255,0.3)"
                                iconColor={colors.onPrimaryContainer}
                                size={20}
                                onPress={() => handleCopyCode(selectedTour.invite_code)}
                            />
                            <IconButton
                                icon="share-variant"
                                mode="contained"
                                containerColor="rgba(255,255,255,0.3)"
                                iconColor={colors.onPrimaryContainer}
                                size={20}
                                onPress={() => handleShareCode(selectedTour)}
                            />
                        </View>
                    </Surface>

                    {/* View on Map button */}
                    <Pressable
                        onPress={() => {
                            router.navigate({
                                pathname: "/(tabs)/map",
                                params: {
                                    tourId: selectedTour.id,
                                    tourName: selectedTour.name,
                                    _ts: Date.now().toString(),
                                },
                            });
                        }}
                        style={[styles.mapBtnNew, { backgroundColor: colors.secondaryContainer }]}
                    >
                        <Text style={{ fontSize: 20 }}>🗺️</Text>
                        <Text variant="bodyMedium" style={{ flex: 1, fontWeight: "600", color: colors.onSecondaryContainer, marginLeft: spacing.sm }}>
                            Xem vị trí thành viên trên bản đồ
                        </Text>
                        <IconButton icon="chevron-right" iconColor={colors.onSecondaryContainer} size={20} style={{ margin: 0 }} />
                    </Pressable>

                    {/* Destinations section */}
                    <View style={styles.sectionHeader}>
                        <Text variant="titleMedium" style={{ fontWeight: "bold" }}>
                            📍 Điểm đến ({tourDestinations.length})
                        </Text>
                        <IconButton icon="plus-circle" size={22} iconColor={colors.primary} onPress={openAddDestDialog} style={{ margin: 0 }} />
                    </View>

                    {destsLoading ? (
                        <ActivityIndicator style={{ marginTop: spacing.sm }} />
                    ) : tourDestinations.length > 0 ? (
                        tourDestinations.map((td) => {
                            // Handle different Supabase join formats
                            const raw = td.destinations;
                            const dest = Array.isArray(raw) ? raw[0] : (raw && typeof raw === 'object' ? raw : null);
                            const destName = dest?.name || td.destination_id || 'Điểm đến';
                            return (
                                <Pressable key={td.id} onPress={() => dest && handleGoToDestMap(dest)} style={{ paddingHorizontal: spacing.sm, marginBottom: spacing.xs }}>
                                    <Surface style={[styles.destCard, { backgroundColor: colors.surface }]} elevation={1}>
                                        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                                            <View style={[styles.destIcon, { backgroundColor: dest?.is_favorite ? '#FFF3E0' : colors.primaryContainer }]}>
                                                <Text style={{ fontSize: 18 }}>{dest?.is_favorite ? '⭐' : '📍'}</Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text variant="titleSmall" style={{ fontWeight: "bold" }}>
                                                    {destName}
                                                </Text>
                                                {dest?.description ? (
                                                    <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }} numberOfLines={1}>
                                                        {dest.description}
                                                    </Text>
                                                ) : null}
                                            </View>
                                            <IconButton
                                                icon="close-circle-outline"
                                                iconColor={colors.error}
                                                size={18}
                                                onPress={() => handleRemoveDest(td)}
                                                style={{ margin: 0 }}
                                            />
                                        </View>
                                        {/* Member distances */}
                                        {dest?.latitude && dest?.longitude && tourMembers.length > 0 && (
                                            <View style={styles.distanceRow}>
                                                {tourMembers
                                                    .filter((m: any) => m.last_latitude && m.last_longitude)
                                                    .map((m: any) => ({
                                                        ...m,
                                                        dist: haversineDistance(
                                                            m.last_latitude, m.last_longitude,
                                                            dest.latitude, dest.longitude
                                                        ),
                                                    }))
                                                    .sort((a: any, b: any) => a.dist - b.dist)
                                                    .slice(0, 4)
                                                    .map((m: any) => {
                                                        const profile = m.profiles;
                                                        const name = profile?.display_name || '?';
                                                        const isSelf = m.user_id === user?.id;
                                                        return (
                                                            <Chip
                                                                key={m.user_id}
                                                                compact
                                                                textStyle={{ fontSize: 11 }}
                                                                style={{ backgroundColor: isSelf ? '#E8F5E9' : colors.surfaceVariant, height: 28 }}
                                                            >
                                                                {isSelf ? 'Bạn' : name}: {formatDistance(m.dist)}
                                                            </Chip>
                                                        );
                                                    })}
                                            </View>
                                        )}
                                    </Surface>
                                </Pressable>
                            );
                        })
                    ) : (
                        <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant, textAlign: 'center', padding: spacing.md }}>
                            Chưa có điểm đến. Nhấn + để thêm.
                        </Text>
                    )}

                    {/* Members section */}
                    <View style={[styles.sectionHeader, { marginTop: spacing.sm }]}>
                        <Text variant="titleMedium" style={{ fontWeight: "bold" }}>
                            👥 Thành viên ({tourMembers.length})
                        </Text>
                        <IconButton icon="refresh" size={20} iconColor={colors.primary} onPress={() => loadMembers(selectedTour.id)} style={{ margin: 0 }} />
                    </View>

                    {membersLoading ? (
                        <ActivityIndicator style={{ marginTop: spacing.sm }} />
                    ) : tourMembers.length > 0 ? (
                        tourMembers.map((item) => (
                            <View key={item.id} style={{ paddingHorizontal: spacing.sm }}>
                                {renderMemberCard({ item })}
                            </View>
                        ))
                    ) : (
                        <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant, textAlign: 'center', padding: spacing.md }}>
                            Chưa có thành viên
                        </Text>
                    )}
                </ScrollView>

                {/* Bottom actions */}
                <Surface style={[styles.detailActions, { backgroundColor: colors.surface }]} elevation={3}>
                    {isOwner ? (
                        <View style={{ flexDirection: "row", gap: spacing.sm }}>
                            {selectedTour.status === "active" && (
                                <Button
                                    mode="contained"
                                    icon="check-circle"
                                    onPress={() => handleUpdateStatus(selectedTour.id, "completed")}
                                    style={{ flex: 1 }}
                                >
                                    Hoàn thành
                                </Button>
                            )}
                            <Button
                                mode="outlined"
                                icon="delete"
                                textColor={colors.error}
                                onPress={() => handleDeleteTour(selectedTour)}
                                style={{ borderColor: colors.error }}
                            >
                                Xóa
                            </Button>
                        </View>
                    ) : (
                        <Button
                            mode="outlined"
                            icon="logout"
                            textColor={colors.error}
                            onPress={() => handleLeaveTour(selectedTour)}
                            style={{ borderColor: colors.error }}
                        >
                            Rời tour
                        </Button>
                    )}
                </Surface>

                {/* Add Destination Dialog */}
                <Portal>
                    <Dialog visible={showAddDest} onDismiss={() => setShowAddDest(false)}>
                        <Dialog.Title>📍 Thêm điểm đến</Dialog.Title>
                        <Dialog.Content>
                            {userDestsLoading ? (
                                <ActivityIndicator style={{ marginVertical: spacing.lg }} />
                            ) : userDests.length > 0 ? (
                                <FlatList
                                    data={userDests}
                                    keyExtractor={(item) => item.id}
                                    style={{ maxHeight: 300 }}
                                    renderItem={({ item }) => (
                                        <Pressable onPress={() => handleAddDest(item.id)}>
                                            <Surface style={[styles.memberCard, { backgroundColor: colors.surfaceVariant }]} elevation={0}>
                                                <View style={styles.memberRow}>
                                                    <Text variant="bodyMedium" style={{ flex: 1 }}>
                                                        {item.is_favorite ? '⭐ ' : '📍 '}{item.name}
                                                    </Text>
                                                    <IconButton icon="plus-circle" size={20} iconColor={colors.primary} onPress={() => handleAddDest(item.id)} />
                                                </View>
                                            </Surface>
                                        </Pressable>
                                    )}
                                />
                            ) : (
                                <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant, textAlign: 'center' }}>
                                    Không có điểm đến nào để thêm.{"\n"}Hãy check-in trên bản đồ trước!
                                </Text>
                            )}
                        </Dialog.Content>
                        <Dialog.Actions>
                            <Button onPress={() => setShowAddDest(false)}>Đóng</Button>
                        </Dialog.Actions>
                    </Dialog>
                </Portal>

                <Snackbar visible={!!snackMsg} onDismiss={() => setSnackMsg("")} duration={3000}>
                    {snackMsg}
                </Snackbar>
            </View>
            </AuthGuard>
        );
    }

    // ==================== List View ====================
    return (
        <AuthGuard isAuthenticated={!!user} loading={authLoading}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <FlatList
                data={tours}
                keyExtractor={(item) => item.id}
                renderItem={renderTourCard}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyIcon}>🎯</Text>
                        <Text variant="titleLarge" style={{ fontWeight: "bold", color: colors.onSurface, marginTop: spacing.md }}>
                            Chưa có tour nào
                        </Text>
                        <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant, textAlign: "center", marginTop: spacing.xs }}>
                            Tạo tour mới hoặc tham gia bằng mã mời
                        </Text>
                        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
                            <Button mode="contained" icon="plus" onPress={() => setShowCreate(true)}>
                                Tạo tour
                            </Button>
                            <Button mode="outlined" icon="link-variant" onPress={() => setShowJoin(true)}>
                                Tham gia
                            </Button>
                        </View>
                    </View>
                }
                refreshing={loading}
                onRefresh={loadTours}
            />

            {/* FAB Group */}
            {tours.length > 0 && (
                <FAB.Group
                    open={fabOpen}
                    visible
                    icon={fabOpen ? "close" : "plus"}
                    actions={[
                        {
                            icon: "account-plus",
                            label: "Tạo tour mới",
                            onPress: () => setShowCreate(true),
                        },
                        {
                            icon: "link-variant",
                            label: "Tham gia bằng mã",
                            onPress: () => setShowJoin(true),
                        },
                    ]}
                    onStateChange={({ open }) => setFabOpen(open)}
                    fabStyle={{ backgroundColor: colors.primary }}
                    color="#fff"
                />
            )}

            {/* Create Tour Dialog */}
            <Portal>
                <Dialog visible={showCreate} onDismiss={() => setShowCreate(false)} style={{ marginBottom: 120 }}>
                    <Dialog.Title>🎯 Tạo Tour mới</Dialog.Title>
                    <Dialog.Content>
                        <TextInput
                            label="Tên tour *"
                            value={createName}
                            onChangeText={setCreateName}
                            mode="outlined"
                            style={{ marginBottom: spacing.sm }}
                            autoFocus
                        />
                        <TextInput
                            label="Mô tả (tùy chọn)"
                            value={createDesc}
                            onChangeText={setCreateDesc}
                            mode="outlined"
                            multiline
                            numberOfLines={2}
                        />
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setShowCreate(false)}>Hủy</Button>
                        <Button
                            onPress={handleCreate}
                            loading={creating}
                            disabled={!createName.trim()}
                            mode="contained"
                        >
                            Tạo
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

            {/* Join Tour Dialog */}
            <Portal>
                <Dialog visible={showJoin} onDismiss={() => setShowJoin(false)}>
                    <Dialog.Title>🔗 Tham gia Tour</Dialog.Title>
                    <Dialog.Content>
                        <TextInput
                            label="Nhập mã mời (6 ký tự)"
                            value={joinCode}
                            onChangeText={(t) => setJoinCode(t.toUpperCase())}
                            mode="outlined"
                            autoCapitalize="characters"
                            maxLength={6}
                            style={{ textAlign: "center", letterSpacing: 4, fontSize: 20 }}
                            autoFocus
                        />
                        <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant, marginTop: spacing.sm, textAlign: "center" }}>
                            Hỏi người tạo tour để lấy mã mời
                        </Text>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setShowJoin(false)}>Hủy</Button>
                        <Button
                            onPress={handleJoin}
                            loading={joining}
                            disabled={joinCode.trim().length < 6}
                            mode="contained"
                        >
                            Tham gia
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

            <Snackbar visible={!!snackMsg} onDismiss={() => setSnackMsg("")} duration={3000}>
                {snackMsg}
            </Snackbar>
        </View>
        </AuthGuard>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    list: { padding: spacing.sm },
    card: {
        marginBottom: spacing.sm,
        borderRadius: borderRadius.md,
        padding: spacing.md,
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
    },
    cardFooter: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    cardMeta: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        flexWrap: "wrap",
        flex: 1,
    },
    codeChip: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.sm,
    },
    // Detail view
    detailHeader: {
        flexDirection: "row",
        alignItems: "center",
        paddingTop: 12,
        paddingBottom: spacing.sm,
        paddingRight: spacing.sm,
    },
    detailHeaderNew: {
        paddingTop: 12,
        paddingBottom: spacing.sm,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
    },
    inviteCard: {
        margin: spacing.sm,
        padding: spacing.md,
        borderRadius: borderRadius.md,
    },
    inviteCardNew: {
        margin: spacing.sm,
        padding: spacing.md,
        borderRadius: 16,
    },
    inviteRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: spacing.xs,
    },
    mapBtnNew: {
        flexDirection: "row",
        alignItems: "center",
        marginHorizontal: spacing.sm,
        marginBottom: spacing.xs,
        padding: spacing.sm,
        borderRadius: 14,
    },
    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
        paddingBottom: spacing.xs,
    },
    destCard: {
        borderRadius: 14,
        padding: spacing.md,
        paddingBottom: spacing.sm,
        overflow: "visible",
    },
    destIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: "center",
        alignItems: "center",
    },
    distanceRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
        marginTop: spacing.sm,
        paddingTop: spacing.xs,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "#e0e0e0",
    },
    membersHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
    },
    memberCard: {
        marginBottom: spacing.xs,
        borderRadius: borderRadius.md,
        padding: spacing.sm,
    },
    memberRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    detailActions: {
        padding: spacing.md,
        paddingBottom: spacing.xl,
    },
    destDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    // Empty
    emptyContainer: {
        alignItems: "center",
        paddingTop: spacing.xxl * 2,
        paddingHorizontal: spacing.lg,
    },
    emptyIcon: {
        fontSize: 64,
    },
    empty: {
        alignItems: "center",
        paddingTop: spacing.xxl,
    },
});
