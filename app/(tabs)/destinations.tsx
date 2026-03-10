import { useState, useCallback } from "react";
import { View, StyleSheet, FlatList, Alert, Pressable } from "react-native";
import {
    Text, Searchbar, Surface, IconButton, Chip, Divider,
} from "react-native-paper";
import { useAppTheme } from "../../src/theme/ThemeProvider";
import { spacing } from "../../src/theme/spacing";
import { useAuth } from "../../src/hooks/useAuth";
import {
    getDestinations, searchDestinations, toggleFavorite, toggleVisibility, deleteDestination,
} from "../../src/services/destination.service";
import { getUserPhotos, deletePhotosByDestination } from "../../src/services/photo.service";
import PhotoUploadButton from "../../src/components/Photo/PhotoUploadButton";
import PhotoPreviewGrid from "../../src/components/Photo/PhotoPreviewGrid";
import { useFocusEffect, router } from "expo-router";

type Filter = "all" | "favorites" | "hidden";

export default function DestinationsScreen() {
    const { paperTheme } = useAppTheme();
    const { user } = useAuth();
    const [destinations, setDestinations] = useState<any[]>([]);
    const [destPhotos, setDestPhotos] = useState<Record<string, any[]>>({});
    const [filter, setFilter] = useState<Filter>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(false);

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
                <PhotoPreviewGrid photos={destPhotos[item.id] || []} />
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

    return (
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
                <Chip
                    selected={filter === "all"}
                    onPress={() => setFilter("all")}
                    style={styles.chip}
                >
                    Tất cả ({destinations.length})
                </Chip>
                <Chip
                    selected={filter === "favorites"}
                    onPress={() => setFilter("favorites")}
                    style={styles.chip}
                    icon="star"
                >
                    Yêu thích
                </Chip>
                <Chip
                    selected={filter === "hidden"}
                    onPress={() => setFilter("hidden")}
                    style={styles.chip}
                    icon="eye-off"
                >
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
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    searchbar: { margin: spacing.sm, marginTop: spacing.md },
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
});
