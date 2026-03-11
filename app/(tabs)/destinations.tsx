import { useState, useCallback, useRef } from "react";
import { View, StyleSheet, FlatList, Alert, Pressable, Modal, Image, Dimensions, ScrollView } from "react-native";
import {
    Text, Searchbar, Surface, IconButton, Chip, Divider, ActivityIndicator, SegmentedButtons,
} from "react-native-paper";
import { useAppTheme } from "../../src/theme/ThemeProvider";
import { spacing, borderRadius } from "../../src/theme/spacing";
import { useAuth } from "../../src/hooks/useAuth";
import {
    getDestinations, searchDestinations, toggleFavorite, toggleVisibility, deleteDestination,
} from "../../src/services/destination.service";
import { getUserPhotos, deletePhotosByDestination } from "../../src/services/photo.service";
import { getNearbyPOIs, POI_CATEGORIES, type POI, type POICategory } from "../../src/services/poi.service";
import { useLocation } from "../../src/hooks/useLocation";
import { haversineDistance, formatDistance } from "../../src/utils/distance";
import PhotoUploadButton from "../../src/components/Photo/PhotoUploadButton";
import PhotoPreviewGrid from "../../src/components/Photo/PhotoPreviewGrid";
import { useFocusEffect, router } from "expo-router";

type Filter = "all" | "favorites" | "hidden";
type TabMode = "destinations" | "explore";

export default function DestinationsScreen() {
    const { paperTheme } = useAppTheme();
    const { user } = useAuth();
    const { location } = useLocation();
    const [tabMode, setTabMode] = useState<TabMode>("destinations");
    const [destinations, setDestinations] = useState<any[]>([]);
    const [destPhotos, setDestPhotos] = useState<Record<string, any[]>>({});
    const [filter, setFilter] = useState<Filter>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(false);

    // Explore tab state
    const [pois, setPois] = useState<POI[]>([]);
    const [poisLoading, setPoisLoading] = useState(false);
    const [poiFilter, setPoiFilter] = useState<POICategory | "all">("all");
    const [poisLoaded, setPoisLoaded] = useState(false);
    const [poiRadius, setPoiRadius] = useState(1500);
    const [poiSearch, setPoiSearch] = useState("");

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
                    _ts: Date.now().toString(),
                },
            });
        }
    };

    const renderItem = ({ item }: { item: any }) => (
        <Pressable onPress={() => handleGoToMap(item)}>
            <Surface style={styles.card} elevation={1}>
                <View style={styles.cardContent}>
                    <View style={styles.cardLeft}>
                        <Text variant="titleMedium">
                            {item.is_favorite ? "⭐ " : "📍 "}
                            {item.name}
                        </Text>
                        {item.description ? (
                            <Text variant="bodySmall" style={{ color: paperTheme.colors.onSurfaceVariant, marginTop: 2 }}>
                                {item.description}
                            </Text>
                        ) : null}
                        <Text variant="bodySmall" style={{ color: paperTheme.colors.outline, marginTop: 4 }}>
                            {formatDate(item.checked_in_at)}
                            {!item.is_visible ? " • 👁️‍🗨️ Đã ẩn" : ""}
                        </Text>
                    </View>
                    <View style={styles.cardActions}>
                        <IconButton
                            icon={item.is_favorite ? "star" : "star-outline"}
                            iconColor={item.is_favorite ? "#FFD700" : paperTheme.colors.outline}
                            size={20}
                            onPress={() => handleFavorite(item.id, item.is_favorite)}
                        />
                        <IconButton
                            icon={item.is_visible ? "eye" : "eye-off"}
                            iconColor={paperTheme.colors.outline}
                            size={20}
                            onPress={() => handleVisibility(item.id, item.is_visible)}
                        />
                        <IconButton
                            icon="delete-outline"
                            iconColor={paperTheme.colors.error}
                            size={20}
                            onPress={() => handleDelete(item.id, item.name)}
                        />
                    </View>
                </View>
                {/* Photo thumbnails */}
                <PhotoPreviewGrid
                    photos={destPhotos[item.id] || []}
                    onPhotoPress={(index) => openViewer(destPhotos[item.id] || [], index, item.name)}
                />
                {/* Upload button */}
                <PhotoUploadButton
                    destinationId={item.id}
                    latitude={item.latitude}
                    longitude={item.longitude}
                    onUploaded={loadData}
                />
            </Surface>
        </Pressable>
    );

    // ==================== Explore Tab ====================
    const loadPOIs = async () => {
        if (!location) {
            Alert.alert("Chưa có vị trí", "Vui lòng bật GPS để khám phá địa điểm xung quanh.");
            return;
        }
        setPoisLoading(true);
        try {
            const result = await getNearbyPOIs(location.latitude, location.longitude, poiRadius);
            setPois(result);
            setPoisLoaded(true);
        } catch (err: any) {
            Alert.alert("Lỗi", err.message || "Không thể tải POI");
        } finally {
            setPoisLoading(false);
        }
    };

    const handleGoToPOI = (poi: POI) => {
        router.navigate({
            pathname: "/(tabs)/map",
            params: {
                focusLat: poi.lat.toString(),
                focusLng: poi.lon.toString(),
                focusName: poi.name,
                _ts: Date.now().toString(),
            },
        });
    };

    const filteredPOIs = pois.filter(p => {
        const matchCat = poiFilter === "all" || p.category === poiFilter;
        const matchSearch = !poiSearch || p.name.toLowerCase().includes(poiSearch.toLowerCase());
        return matchCat && matchSearch;
    });

    const renderPOIItem = ({ item }: { item: POI }) => {
        const dist = location
            ? haversineDistance(location.latitude, location.longitude, item.lat, item.lon)
            : null;

        return (
            <Pressable onPress={() => handleGoToPOI(item)}>
                <Surface style={styles.card} elevation={1}>
                    <View style={styles.cardContent}>
                        <Text style={{ fontSize: 28 }}>{item.icon}</Text>
                        <View style={{ flex: 1, marginLeft: spacing.sm }}>
                            <Text variant="titleSmall" numberOfLines={1}>{item.name}</Text>
                            <Text variant="bodySmall" style={{ color: paperTheme.colors.onSurfaceVariant }}>
                                {item.categoryLabel}{dist !== null ? ` • ${formatDistance(dist)}` : ""}
                            </Text>
                        </View>
                        <IconButton icon="map-marker-right" size={20} iconColor={paperTheme.colors.primary} onPress={() => handleGoToPOI(item)} style={{ margin: 0 }} />
                    </View>
                </Surface>
            </Pressable>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: paperTheme.colors.background }]}>
            {/* Top tab selector */}
            <View style={styles.tabRow}>
                <Pressable
                    onPress={() => setTabMode("destinations")}
                    style={[styles.tabBtn, tabMode === "destinations" && { borderBottomColor: paperTheme.colors.primary, borderBottomWidth: 2 }]}
                >
                    <Text variant="titleSmall" style={{ color: tabMode === "destinations" ? paperTheme.colors.primary : paperTheme.colors.onSurfaceVariant, fontWeight: "bold" }}>
                        📍 Điểm đến
                    </Text>
                </Pressable>
                <Pressable
                    onPress={() => {
                        setTabMode("explore");
                        if (!poisLoaded) loadPOIs();
                    }}
                    style={[styles.tabBtn, tabMode === "explore" && { borderBottomColor: paperTheme.colors.primary, borderBottomWidth: 2 }]}
                >
                    <Text variant="titleSmall" style={{ color: tabMode === "explore" ? paperTheme.colors.primary : paperTheme.colors.onSurfaceVariant, fontWeight: "bold" }}>
                        🔍 Khám phá
                    </Text>
                </Pressable>
            </View>

            <Divider />

            {/* ==================== Destinations Tab ==================== */}
            {tabMode === "destinations" && (
                <>
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
            </View>

            <Divider />

            {/* Danh sách */}
            <FlatList
                data={filtered}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
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
                </>
            )}

            {/* ==================== Explore Tab ==================== */}
            {tabMode === "explore" && (
                <>
                    {/* Search */}
                    <Searchbar
                        placeholder="Tìm địa điểm..."
                        value={poiSearch}
                        onChangeText={setPoiSearch}
                        style={styles.searchbar}
                    />
                    {/* Category filter */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 44 }} contentContainerStyle={styles.chips}>
                        {POI_CATEGORIES.map((cat) => (
                            <Chip
                                key={cat.key}
                                selected={poiFilter === cat.key}
                                onPress={() => setPoiFilter(cat.key)}
                                style={styles.chip}
                                compact
                            >
                                {cat.icon} {cat.label}
                            </Chip>
                        ))}
                    </ScrollView>

                    {/* Radius selector */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 40 }} contentContainerStyle={[styles.chips, { paddingTop: 0 }]}>
                        {[500, 1000, 1500, 3000, 5000].map((r) => (
                            <Chip
                                key={r}
                                selected={poiRadius === r}
                                onPress={() => { setPoiRadius(r); setPoisLoaded(false); }}
                                style={styles.chip}
                                compact
                            >
                                {r >= 1000 ? `${r / 1000} km` : `${r} m`}
                            </Chip>
                        ))}
                    </ScrollView>

                    {poisLoading ? (
                        <View style={styles.empty}>
                            <ActivityIndicator size="large" />
                            <Text variant="bodyMedium" style={{ color: paperTheme.colors.onSurfaceVariant, marginTop: spacing.md }}>
                                Đang tìm địa điểm xung quanh...
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            data={filteredPOIs}
                            keyExtractor={(item) => item.id}
                            renderItem={renderPOIItem}
                            contentContainerStyle={styles.list}
                            ListHeaderComponent={
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
                                    <Text variant="bodySmall" style={{ color: paperTheme.colors.onSurfaceVariant }}>
                                        {filteredPOIs.length} địa điểm trong {poiRadius >= 1000 ? `${poiRadius / 1000} km` : `${poiRadius} m`}
                                    </Text>
                                    {!poisLoaded && (
                                        <Chip compact icon="reload" onPress={loadPOIs}>Tải lại</Chip>
                                    )}
                                </View>
                            }
                            ListEmptyComponent={
                                <View style={styles.empty}>
                                    <Text variant="bodyLarge" style={{ color: paperTheme.colors.onSurfaceVariant, textAlign: "center" }}>
                                        {poisLoaded ? "Không tìm thấy địa điểm nào." : "Nhấn nút làm mới để tải."}
                                    </Text>
                                </View>
                            }
                            refreshing={poisLoading}
                            onRefresh={loadPOIs}
                        />
                    )}
                </>
            )}

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
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    tabRow: {
        flexDirection: "row",
        paddingTop: spacing.md,
    },
    tabBtn: {
        flex: 1,
        alignItems: "center",
        paddingVertical: spacing.sm,
    },
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
        borderRadius: 12,
        padding: spacing.sm,
    },
    cardContent: {
        flexDirection: "row",
        alignItems: "center",
    },
    cardLeft: { flex: 1 },
    cardActions: {
        flexDirection: "row",
        alignItems: "center",
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
