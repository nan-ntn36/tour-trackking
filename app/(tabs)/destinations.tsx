import { useState, useCallback, useRef, useEffect } from "react";
import { View, StyleSheet, FlatList, Alert, Pressable, Modal, Image, Dimensions } from "react-native";
import {
    Text, Searchbar, Surface, IconButton, Chip, Divider,
} from "react-native-paper";
import { useAppTheme } from "../../src/theme/ThemeProvider";
import { spacing, borderRadius } from "../../src/theme/spacing";
import { useAuth } from "../../src/hooks/useAuth";
import {
    getDestinations, searchDestinations, toggleFavorite, toggleVisibility, deleteDestination, deleteAllDestinations,
} from "../../src/services/destination.service";
import { getUserPhotos, deletePhotosByDestination } from "../../src/services/photo.service";
import { useLocation } from "../../src/hooks/useLocation";
import { haversineDistance, formatDistance } from "../../src/utils/distance";
import PhotoUploadButton from "../../src/components/Photo/PhotoUploadButton";
import PhotoPreviewGrid from "../../src/components/Photo/PhotoPreviewGrid";
import AuthGuard from "../../src/components/Auth/AuthGuard";
import { useFocusEffect, router } from "expo-router";

type Filter = "all" | "favorites" | "hidden";

export default function DestinationsScreen() {
    const { paperTheme } = useAppTheme();
    const { user, loading: authLoading } = useAuth();
    const { location } = useLocation();
    const [destinations, setDestinations] = useState<any[]>([]);
    const [destPhotos, setDestPhotos] = useState<Record<string, any[]>>({});
    const [filter, setFilter] = useState<Filter>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(false);

    // Photo viewer
    const [viewerPhotos, setViewerPhotos] = useState<any[]>([]);
    const [viewerIndex, setViewerIndex] = useState(0);
    const [viewerVisible, setViewerVisible] = useState(false);
    const [viewerTitle, setViewerTitle] = useState("");
    const viewerRef = useRef<FlatList>(null);
    const SCREEN = Dimensions.get("window");

    const openViewer = (photos: any[], index: number, title: string) => {
        setViewerPhotos(photos);
        setViewerIndex(index);
        setViewerTitle(title);
        setViewerVisible(true);
    };

    // Clear data on logout
    useEffect(() => {
        if (!user) {
            setDestinations([]);
            setDestPhotos({});
            setSearchQuery("");
            setFilter("all");
        }
    }, [user]);

    // Load destinations
    const loadData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const data = searchQuery
                ? await searchDestinations(user.id, searchQuery)
                : await getDestinations(user.id);
            setDestinations(data);

            // Load photos and group by destination_id
            const photos = await getUserPhotos(user.id);
            const grouped: Record<string, any[]> = {};
            photos.forEach((p: any) => {
                if (p.destination_id) {
                    if (!grouped[p.destination_id]) grouped[p.destination_id] = [];
                    grouped[p.destination_id].push(p);
                }
            });
            setDestPhotos(grouped);
        } catch (err) {
            console.warn("Load destinations error:", err);
        } finally {
            setLoading(false);
        }
    }, [user, searchQuery]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    // Filter
    const filtered = destinations.filter((d) => {
        if (filter === "favorites") return d.is_favorite;
        if (filter === "hidden") return !d.is_visible;
        return true;
    });

    // Toggle favorite
    const handleFavorite = async (id: string, current: boolean) => {
        try {
            await toggleFavorite(id, !current);
            setDestinations((prev) =>
                prev.map((d) => (d.id === id ? { ...d, is_favorite: !current } : d))
            );
        } catch (err: any) {
            Alert.alert("Lỗi", err.message);
        }
    };

    // Toggle visibility
    const handleVisibility = async (id: string, current: boolean) => {
        try {
            await toggleVisibility(id, !current);
            setDestinations((prev) =>
                prev.map((d) => (d.id === id ? { ...d, is_visible: !current } : d))
            );
        } catch (err: any) {
            Alert.alert("Lỗi", err.message);
        }
    };

    // Xóa (ảnh + địa điểm)
    const handleDelete = (id: string, name: string) => {
        Alert.alert("Xóa điểm đến", `Xóa "${name}" và tất cả ảnh liên quan?`, [
            { text: "Hủy", style: "cancel" },
            {
                text: "Xóa", style: "destructive",
                onPress: async () => {
                    try {
                        // Xóa ảnh trước (Cloudinary + Supabase)
                        await deletePhotosByDestination(id);
                        // Xóa destination
                        await deleteDestination(id);
                        setDestinations((prev) => prev.filter((d) => d.id !== id));
                    } catch (err: any) {
                        Alert.alert("Lỗi", err.message);
                    }
                },
            },
        ]);
    };

    // Xóa tất cả
    const handleDeleteAll = () => {
        if (!user || destinations.length === 0) return;
        Alert.alert(
            "Xóa tất cả check-in?",
            `Bạn có chắc muốn xóa tất cả ${destinations.length} điểm đến? Hành động này không thể hoàn tác.`,
            [
                { text: "Hủy", style: "cancel" },
                {
                    text: "Xóa tất cả",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            // Xóa ảnh Cloudinary cho tất cả destinations
                            await Promise.allSettled(
                                destinations.map((d) => deletePhotosByDestination(d.id))
                            );
                            // Xóa tất cả destinations
                            await deleteAllDestinations(user.id);
                            setDestinations([]);
                            setDestPhotos({});
                        } catch (err: any) {
                            Alert.alert("Lỗi", err.message);
                        }
                    },
                },
            ]
        );
    };

    // Format date
    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    // Bấm vào card → chuyển sang Map tab, center vào điểm đó
    const handleGoToMap = (item: any) => {
        if (item.latitude && item.longitude) {
            router.navigate({
                pathname: "/(tabs)/map",
                params: {
                    focusLat: item.latitude.toString(),
                    focusLng: item.longitude.toString(),
                    focusName: item.name,
                    destId: item.id,
                    _ts: Date.now().toString(),
                },
            });
        }
    };


    const renderItem = ({ item }: { item: any }) => (
        <Pressable onPress={() => handleGoToMap(item)}>
            <Surface style={[styles.card, { backgroundColor: paperTheme.colors.surface }]} elevation={2}>
                <View style={styles.cardRow}>
                    {/* Left: circular icon */}
                    <View style={[styles.cardAvatar, { backgroundColor: item.is_favorite ? "#FFF3E0" : paperTheme.colors.primaryContainer }]}>
                        <Text style={{ fontSize: 22 }}>{item.is_favorite ? "⭐" : "📍"}</Text>
                    </View>

                    {/* Center: info */}
                    <View style={styles.cardInfo}>
                        <Text variant="titleSmall" style={{ fontWeight: "bold", color: paperTheme.colors.onSurface }} numberOfLines={1}>
                            {item.name}
                        </Text>
                        <Text variant="bodySmall" style={{ color: paperTheme.colors.onSurfaceVariant, marginTop: 2 }} numberOfLines={1}>
                            {item.description || formatDate(item.checked_in_at)}
                            {!item.is_visible ? " • Đã ẩn" : ""}
                        </Text>
                        {item.description ? (
                            <Text variant="labelSmall" style={{ color: paperTheme.colors.outline, marginTop: 2 }}>
                                {formatDate(item.checked_in_at)}
                            </Text>
                        ) : null}
                    </View>

                    {/* Right: stacked photo thumbnails */}
                    {(destPhotos[item.id] || []).length > 1 ? (
                        <Pressable onPress={() => openViewer(destPhotos[item.id], 0, item.name)} style={styles.cardThumbStack}>
                            {/* Back photo (tilted) */}
                            <Image
                                source={{ uri: destPhotos[item.id][1].cloudinary_url }}
                                style={[styles.cardThumb, styles.cardThumbBack]}
                                resizeMode="cover"
                            />
                            {/* Front photo */}
                            <Image
                                source={{ uri: destPhotos[item.id][0].cloudinary_url }}
                                style={[styles.cardThumb, styles.cardThumbFront]}
                                resizeMode="cover"
                            />
                            {/* Badge */}
                            <View style={styles.cardThumbBadge}>
                                <Text style={styles.cardThumbBadgeText}>+{destPhotos[item.id].length - 1}</Text>
                            </View>
                        </Pressable>
                    ) : (destPhotos[item.id] || []).length === 1 ? (
                        <Pressable onPress={() => openViewer(destPhotos[item.id], 0, item.name)}>
                            <Image
                                source={{ uri: destPhotos[item.id][0].cloudinary_url }}
                                style={styles.cardThumb}
                                resizeMode="cover"
                            />
                        </Pressable>
                    ) : (
                        <View style={[styles.cardThumb, { backgroundColor: paperTheme.colors.surfaceVariant, justifyContent: "center", alignItems: "center" }]}>
                            <Text style={{ fontSize: 16, opacity: 0.4 }}>📷</Text>
                        </View>
                    )}
                </View>

                {/* Bottom actions row */}
                <View style={styles.cardActions}>
                    <IconButton
                        icon={item.is_favorite ? "star" : "star-outline"}
                        iconColor={item.is_favorite ? "#FFD700" : paperTheme.colors.outline}
                        size={18}
                        onPress={() => handleFavorite(item.id, item.is_favorite)}
                        style={{ margin: 0 }}
                    />
                    <IconButton
                        icon={item.is_visible ? "eye" : "eye-off"}
                        iconColor={paperTheme.colors.outline}
                        size={18}
                        onPress={() => handleVisibility(item.id, item.is_visible)}
                        style={{ margin: 0 }}
                    />
                    <PhotoUploadButton
                        destinationId={item.id}
                        latitude={item.latitude}
                        longitude={item.longitude}
                        onUploaded={loadData}
                    />
                    <View style={{ flex: 1 }} />
                    <IconButton
                        icon="delete-outline"
                        iconColor={paperTheme.colors.error}
                        size={18}
                        onPress={() => handleDelete(item.id, item.name)}
                        style={{ margin: 0 }}
                    />
                </View>
            </Surface>
        </Pressable>
    );

    return (
        <AuthGuard isAuthenticated={!!user} loading={authLoading}>
        <View style={[styles.container, { backgroundColor: paperTheme.colors.background }]}>
            {/* Search */}
            <Searchbar
                placeholder="Tìm điểm đến..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={loadData}
                style={styles.searchbar}
            />

            {/* Filter chips */}
            <View style={styles.chips}>
                <Chip selected={filter === "all"} onPress={() => setFilter("all")} style={styles.chip}>
                    Tất cả ({destinations.length})
                </Chip>
                <Chip selected={filter === "favorites"} onPress={() => setFilter("favorites")} style={styles.chip} icon="star">
                    Yêu thích
                </Chip>
                <Chip selected={filter === "hidden"} onPress={() => setFilter("hidden")} style={styles.chip} icon="eye-off">
                    Đã ẩn
                </Chip>
                <View style={{ flex: 1 }} />
                {destinations.length > 0 && (
                    <Chip
                        icon="delete-sweep"
                        onPress={handleDeleteAll}
                        style={[styles.chip, { backgroundColor: paperTheme.colors.errorContainer }]}
                        textStyle={{ color: paperTheme.colors.error }}
                    >
                        Xóa tất cả
                    </Chip>
                )}
            </View>

            <Divider />

            {/* Danh sách */}
            <FlatList
                data={filtered}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                style={{ flex: 1 }}
                removeClippedSubviews={false}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text variant="bodyLarge" style={{ color: paperTheme.colors.onSurfaceVariant }}>
                            {filter === "all"
                                ? "Chưa có điểm đến nào.\nBấm 📍 trên bản đồ để check-in!"
                                : `Không có điểm đến ${filter === "favorites" ? "yêu thích" : "đã ẩn"}`}
                        </Text>
                    </View>
                }
                refreshing={loading}
                onRefresh={loadData}
            />


            {/* Fullscreen Photo Viewer */}
            <Modal
                visible={viewerVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setViewerVisible(false)}
            >
                <View style={styles.viewerContainer}>
                    {/* Header */}
                    <View style={styles.viewerHeader}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.viewerTitle} numberOfLines={1}>{viewerTitle}</Text>
                            <Text style={styles.viewerCounter}>
                                {viewerIndex + 1} / {viewerPhotos.length}
                            </Text>
                        </View>
                        <IconButton
                            icon="close"
                            iconColor="#fff"
                            size={24}
                            onPress={() => setViewerVisible(false)}
                        />
                    </View>

                    {/* Photo swiper */}
                    <FlatList
                        ref={viewerRef}
                        data={viewerPhotos}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        initialScrollIndex={viewerIndex}
                        getItemLayout={(_, i) => ({ length: SCREEN.width, offset: SCREEN.width * i, index: i })}
                        onMomentumScrollEnd={(e) => {
                            const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN.width);
                            setViewerIndex(idx);
                        }}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <View style={{ width: SCREEN.width, justifyContent: "center", alignItems: "center" }}>
                                <Image
                                    source={{ uri: item.cloudinary_url }}
                                    style={{ width: SCREEN.width, height: SCREEN.height * 0.7 }}
                                    resizeMode="contain"
                                />
                            </View>
                        )}
                    />

                    {/* Bottom dots */}
                    {viewerPhotos.length > 1 && (
                        <View style={styles.viewerDots}>
                            {viewerPhotos.map((_, i) => (
                                <View
                                    key={i}
                                    style={[
                                        styles.viewerDot,
                                        { backgroundColor: i === viewerIndex ? "#fff" : "rgba(255,255,255,0.4)" },
                                    ]}
                                />
                            ))}
                        </View>
                    )}
                </View>
            </Modal>
        </View>
        </AuthGuard>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    searchbar: { margin: spacing.sm, marginTop: spacing.sm },
    chips: {
        flexDirection: "row",
        paddingHorizontal: spacing.sm,
        paddingBottom: spacing.sm,
        gap: 8,
    },
    chip: {},
    list: { padding: spacing.sm },
    card: {
        marginBottom: spacing.sm,
        borderRadius: 16,
        padding: spacing.sm,
    },
    cardRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },
    cardAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: "center",
        alignItems: "center",
    },
    cardInfo: {
        flex: 1,
    },
    cardThumb: {
        width: 52,
        height: 52,
        borderRadius: 12,
        overflow: "hidden",
    },
    cardThumbStack: {
        width: 68,
        height: 64,
        position: "relative",
    },
    cardThumbBack: {
        position: "absolute",
        top: 0,
        right: 0,
        width: 46,
        height: 46,
        transform: [{ rotate: "8deg" }],
        opacity: 0.7,
    },
    cardThumbFront: {
        position: "absolute",
        bottom: 0,
        left: 0,
        width: 48,
        height: 48,
        transform: [{ rotate: "-4deg" }],
    },
    cardThumbBadge: {
        position: "absolute",
        bottom: 2,
        right: 2,
        backgroundColor: "rgba(0,0,0,0.6)",
        borderRadius: 8,
        paddingHorizontal: 5,
        paddingVertical: 1,
    },
    cardThumbBadgeText: {
        color: "#fff",
        fontSize: 10,
        fontWeight: "bold",
    },
    cardActions: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 4,
        paddingTop: 4,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "#e0e0e0",
    },
    empty: {
        alignItems: "center",
        paddingTop: spacing.xxl,
    },
    // Photo viewer
    viewerContainer: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.95)",
        justifyContent: "center",
    },
    viewerHeader: {
        position: "absolute",
        top: 0, left: 0, right: 0,
        zIndex: 10,
        flexDirection: "row",
        alignItems: "center",
        paddingTop: 50,
        paddingHorizontal: spacing.md,
    },
    viewerTitle: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "bold",
    },
    viewerCounter: {
        color: "rgba(255,255,255,0.7)",
        fontSize: 13,
    },
    viewerDots: {
        position: "absolute",
        bottom: 60,
        alignSelf: "center",
        flexDirection: "row",
        gap: 6,
    },
    viewerDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
});
