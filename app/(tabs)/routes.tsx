import { useState, useCallback, useEffect } from "react";
import { View, StyleSheet, FlatList, Alert, Pressable, Dimensions } from "react-native";
import {
    Text, Surface, IconButton, Snackbar, ActivityIndicator, Chip, Divider, Button, Checkbox,
} from "react-native-paper";
import MapView, { Polyline, Marker } from "react-native-maps";
import { useAppTheme } from "../../src/theme/ThemeProvider";
import { spacing } from "../../src/theme/spacing";
import { useAuth } from "../../src/hooks/useAuth";
import { getRoutes, deleteRoute, parseRouteCoordinates } from "../../src/services/route.service";
import { formatDistance, formatDuration } from "../../src/utils/distance";
import { useFocusEffect } from "expo-router";
import AuthGuard from "../../src/components/Auth/AuthGuard";

type ViewMode = "list" | "detail";
const { width: SCREEN_W } = Dimensions.get("window");

export default function RoutesScreen() {
    const { paperTheme } = useAppTheme();
    const { user, loading: authLoading } = useAuth();
    const colors = paperTheme.colors;

    const [routes, setRoutes] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [snackMsg, setSnackMsg] = useState("");

    const [viewMode, setViewMode] = useState<ViewMode>("list");
    const [selectedRoute, setSelectedRoute] = useState<any>(null);
    const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);

    // Selection mode
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Clear data on logout
    useEffect(() => {
        if (!user) {
            setRoutes([]);
            setSelectedRoute(null);
            setRouteCoords([]);
            setViewMode("list");
            setSelectionMode(false);
            setSelectedIds(new Set());
        }
    }, [user]);

    // Load routes
    const loadRoutes = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const data = await getRoutes(user.id);
            setRoutes(data);
        } catch (err: any) {
            console.warn("Load routes error:", err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useFocusEffect(
        useCallback(() => {
            loadRoutes();
        }, [loadRoutes])
    );

    // Delete
    const handleDelete = (route: any) => {
        Alert.alert("Xóa tuyến đường", `Xóa "${route.name}"?`, [
            { text: "Hủy", style: "cancel" },
            {
                text: "Xóa",
                style: "destructive",
                onPress: async () => {
                    try {
                        await deleteRoute(route.id);
                        setSnackMsg("✅ Đã xóa");
                        loadRoutes();
                    } catch (err: any) {
                        Alert.alert("Lỗi", err.message);
                    }
                },
            },
        ]);
    };

    // Toggle single selection
    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Select all
    const selectAll = () => {
        setSelectedIds(new Set(routes.map(r => r.id)));
    };

    // Deselect all
    const deselectAll = () => {
        setSelectedIds(new Set());
    };

    // Exit selection mode
    const exitSelection = () => {
        setSelectionMode(false);
        setSelectedIds(new Set());
    };

    // Delete selected
    const handleDeleteSelected = () => {
        if (selectedIds.size === 0) return;
        Alert.alert(
            "Xóa tuyến đường",
            `Xóa ${selectedIds.size} tuyến đường đã chọn?`,
            [
                { text: "Hủy", style: "cancel" },
                {
                    text: "Xóa tất cả",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await Promise.all(
                                Array.from(selectedIds).map(id => deleteRoute(id))
                            );
                            setSnackMsg(`✅ Đã xóa ${selectedIds.size} tuyến đường`);
                            exitSelection();
                            loadRoutes();
                        } catch (err: any) {
                            Alert.alert("Lỗi", err.message);
                        }
                    },
                },
            ]
        );
    };



    // Open detail
    const openDetail = (route: any) => {
        const coords = parseRouteCoordinates(route);
        setSelectedRoute(route);
        setRouteCoords(coords);
        setViewMode("detail");
    };

    // Stats
    const getStats = (route: any) => {
        const distKm = (route.distance_meters || 0) / 1000;
        const durSec = route.duration_seconds || 0;
        const durHours = durSec / 3600;
        const avgSpeed = durHours > 0 ? distKm / durHours : 0;
        return { distKm, durSec, avgSpeed };
    };

    // Speed chart data from route coords
    const getSpeedSegments = (coords: { latitude: number; longitude: number }[], durSec: number) => {
        if (coords.length < 2) return [];
        const segCount = Math.min(coords.length - 1, 20); // max 20 bars
        const step = Math.max(1, Math.floor((coords.length - 1) / segCount));
        const segments: number[] = [];

        for (let i = 0; i < coords.length - 1 && segments.length < segCount; i += step) {
            const end = Math.min(i + step, coords.length - 1);
            let segDist = 0;
            for (let j = i; j < end; j++) {
                const R = 6371;
                const dLat = (coords[j + 1].latitude - coords[j].latitude) * Math.PI / 180;
                const dLon = (coords[j + 1].longitude - coords[j].longitude) * Math.PI / 180;
                const a = Math.sin(dLat / 2) ** 2 +
                    Math.cos(coords[j].latitude * Math.PI / 180) *
                    Math.cos(coords[j + 1].latitude * Math.PI / 180) *
                    Math.sin(dLon / 2) ** 2;
                segDist += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            }
            // Assume even time distribution
            const segTime = (durSec / (coords.length - 1)) * step / 3600;
            const speed = segTime > 0 ? segDist / segTime : 0;
            segments.push(speed);
        }
        return segments;
    };

    // Format date
    const formatDate = (iso: string) => {
        if (!iso) return "";
        const d = new Date(iso);
        return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) +
            " " + d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    };

    // ==================== Detail View ====================
    if (viewMode === "detail" && selectedRoute) {
        const { distKm, durSec, avgSpeed } = getStats(selectedRoute);
        const speedSegments = getSpeedSegments(routeCoords, durSec);
        const maxSpeed = Math.max(...speedSegments, 1);

        // Map region from coords
        const lats = routeCoords.map(c => c.latitude);
        const lngs = routeCoords.map(c => c.longitude);
        const region = routeCoords.length > 0 ? {
            latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
            longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
            latitudeDelta: (Math.max(...lats) - Math.min(...lats)) * 1.3 + 0.005,
            longitudeDelta: (Math.max(...lngs) - Math.min(...lngs)) * 1.3 + 0.005,
        } : undefined;

        return (
            <AuthGuard isAuthenticated={!!user} loading={authLoading}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <Surface style={[styles.detailHeader, { backgroundColor: colors.primary }]} elevation={4}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <IconButton icon="arrow-left" iconColor="#fff" onPress={() => { setViewMode("list"); setSelectedRoute(null); }} />
                        <View style={{ flex: 1 }}>
                            <Text variant="titleMedium" style={{ fontWeight: "bold", color: "#fff" }} numberOfLines={1}>
                                {selectedRoute.name}
                            </Text>
                            <Text variant="bodySmall" style={{ color: "rgba(255,255,255,0.8)" }}>
                                {formatDate(selectedRoute.started_at || selectedRoute.created_at)}
                            </Text>
                        </View>
                    </View>
                </Surface>

                {/* Map */}
                <View style={styles.mapContainer}>
                    {routeCoords.length > 0 ? (
                        <MapView
                            style={StyleSheet.absoluteFillObject}
                            initialRegion={region}
                            scrollEnabled={true}
                            zoomEnabled={true}
                        >
                            <Polyline
                                coordinates={routeCoords}
                                strokeColor={colors.primary}
                                strokeWidth={4}
                            />
                            {/* Start marker */}
                            <Marker
                                coordinate={routeCoords[0]}
                                title="Bắt đầu"
                                pinColor="#4CAF50"
                            />
                            {/* End marker */}
                            <Marker
                                coordinate={routeCoords[routeCoords.length - 1]}
                                title="Kết thúc"
                                pinColor="#F44336"
                            />
                        </MapView>
                    ) : (
                        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                            <Text style={{ color: colors.onSurfaceVariant }}>Không có dữ liệu tọa độ</Text>
                        </View>
                    )}
                </View>

                {/* Stats cards */}
                <Surface style={[styles.statsContainer, { backgroundColor: colors.surface }]} elevation={2}>
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: colors.primary }]}>
                                {formatDistance(distKm)}
                            </Text>
                            <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant }}>Quãng đường</Text>
                        </View>
                        <View style={[styles.statDivider, { backgroundColor: colors.outlineVariant }]} />
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: "#FF9800" }]}>
                                {formatDuration(durSec)}
                            </Text>
                            <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant }}>Thời gian</Text>
                        </View>
                        <View style={[styles.statDivider, { backgroundColor: colors.outlineVariant }]} />
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: "#4CAF50" }]}>
                                {avgSpeed.toFixed(1)}
                            </Text>
                            <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant }}>km/h TB</Text>
                        </View>
                    </View>

                    {/* Speed chart */}
                    {speedSegments.length > 1 && (
                        <View style={styles.chartSection}>
                            <Text variant="labelMedium" style={{ fontWeight: "bold", marginBottom: spacing.xs, color: colors.onSurface }}>
                                📊 Biểu đồ tốc độ
                            </Text>
                            <View style={styles.chartContainer}>
                                {speedSegments.map((speed, i) => {
                                    const heightPct = Math.max((speed / maxSpeed) * 100, 4);
                                    const barColor = speed > avgSpeed * 1.3 ? "#F44336"
                                        : speed > avgSpeed * 0.7 ? "#4CAF50"
                                            : "#2196F3";
                                    return (
                                        <View key={i} style={styles.chartBarWrapper}>
                                            <View style={[styles.chartBar, {
                                                height: `${heightPct}%` as any,
                                                backgroundColor: barColor,
                                            }]} />
                                        </View>
                                    );
                                })}
                            </View>
                            <View style={styles.chartLabels}>
                                <Text variant="labelSmall" style={{ color: colors.outline }}>Bắt đầu</Text>
                                <Text variant="labelSmall" style={{ color: colors.outline }}>Kết thúc</Text>
                            </View>
                        </View>
                    )}
                </Surface>

                <Snackbar visible={!!snackMsg} onDismiss={() => setSnackMsg("")} duration={3000}>
                    {snackMsg}
                </Snackbar>
            </View>
            </AuthGuard>
        );
    }

    // ==================== List View ====================
    const renderItem = ({ item }: { item: any }) => {
        const { distKm, durSec, avgSpeed } = getStats(item);
        const isSelected = selectedIds.has(item.id);

        return (
            <Pressable
                onPress={() => selectionMode ? toggleSelect(item.id) : openDetail(item)}
                onLongPress={() => {
                    if (!selectionMode) {
                        setSelectionMode(true);
                        setSelectedIds(new Set([item.id]));
                    }
                }}
            >
                <Surface style={[
                    styles.card,
                    { backgroundColor: isSelected ? colors.primaryContainer : colors.surface },
                ]} elevation={isSelected ? 0 : 2}>
                    <View style={styles.cardRow}>
                        {/* Checkbox or Icon */}
                        {selectionMode ? (
                            <Checkbox
                                status={isSelected ? "checked" : "unchecked"}
                                onPress={() => toggleSelect(item.id)}
                                color={colors.primary}
                            />
                        ) : (
                            <View style={[styles.cardAvatar, { backgroundColor: colors.primaryContainer }]}>
                                <Text style={{ fontSize: 20 }}>🛤️</Text>
                            </View>
                        )}

                        {/* Info */}
                        <View style={{ flex: 1 }}>
                            <Text variant="titleSmall" style={{ fontWeight: "bold" }} numberOfLines={1}>
                                {item.name}
                            </Text>
                            <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant, marginTop: 2 }}>
                                {formatDate(item.started_at || item.created_at)}
                            </Text>
                            <Text variant="labelSmall" style={{ color: colors.primary, marginTop: 2 }}>
                                📏 {formatDistance(distKm)}  •  ⏱ {formatDuration(durSec)}  •  🏎 {avgSpeed.toFixed(1)} km/h
                            </Text>
                        </View>

                        {/* Delete (only in non-selection mode) */}
                        {!selectionMode && (
                            <IconButton
                                icon="delete-outline"
                                iconColor={colors.error}
                                size={18}
                                onPress={() => handleDelete(item)}
                                style={{ margin: 0 }}
                            />
                        )}
                    </View>
                </Surface>
            </Pressable>
        );
    };

    return (
        <AuthGuard isAuthenticated={!!user} loading={authLoading}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Selection toolbar */}
            {selectionMode && (
                <Surface style={[styles.selectionBar, { backgroundColor: colors.primaryContainer }]} elevation={2}>
                    <IconButton icon="close" onPress={exitSelection} iconColor={colors.onPrimaryContainer} size={20} />
                    <Text variant="bodyMedium" style={{ flex: 1, fontWeight: "bold", color: colors.onPrimaryContainer }}>
                        Đã chọn {selectedIds.size}/{routes.length}
                    </Text>
                    <Button
                        compact
                        onPress={selectedIds.size === routes.length ? deselectAll : selectAll}
                        textColor={colors.onPrimaryContainer}
                    >
                        {selectedIds.size === routes.length ? "Bỏ chọn" : "Chọn tất cả"}
                    </Button>
                    <IconButton
                        icon="delete"
                        iconColor={colors.error}
                        size={22}
                        onPress={handleDeleteSelected}
                        disabled={selectedIds.size === 0}
                    />
                </Surface>
            )}

            <FlatList
                data={routes}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                style={{ flex: 1 }}
                extraData={selectedIds}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text style={{ fontSize: 48, marginBottom: spacing.md }}>🛤️</Text>
                        <Text variant="titleMedium" style={{ fontWeight: "bold", color: colors.onSurface }}>
                            Chưa có tuyến đường nào
                        </Text>
                        <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant, textAlign: "center", marginTop: spacing.xs }}>
                            Bấm nút ▶️ trên bản đồ để bắt đầu{"\n"}ghi lại tuyến đường của bạn
                        </Text>
                    </View>
                }
                refreshing={loading}
                onRefresh={loadRoutes}
            />

            <Snackbar visible={!!snackMsg} onDismiss={() => setSnackMsg("")} duration={3000}>
                {snackMsg}
            </Snackbar>
        </View>
        </AuthGuard>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    selectionBar: {
        flexDirection: "row",
        alignItems: "center",
        paddingRight: spacing.xs,
    },
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
    chipRow: {
        flexDirection: "row",
        gap: 4,
        marginTop: 4,
        flexWrap: "wrap",
    },
    statChip: {
        height: 24,
    },
    empty: {
        alignItems: "center",
        paddingTop: 80,
        paddingHorizontal: spacing.lg,
    },
    // Detail view
    detailHeader: {
        paddingTop: 12,
        paddingBottom: spacing.sm,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
    },
    mapContainer: {
        height: 280,
        margin: spacing.sm,
        borderRadius: 16,
        overflow: "hidden",
    },
    statsContainer: {
        margin: spacing.sm,
        marginTop: 0,
        borderRadius: 16,
        padding: spacing.md,
    },
    statsRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
    },
    statItem: {
        alignItems: "center",
        flex: 1,
    },
    statValue: {
        fontSize: 20,
        fontWeight: "bold",
    },
    statDivider: {
        width: 1,
        height: 36,
    },
    chartSection: {
        marginTop: spacing.md,
        paddingTop: spacing.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "#e0e0e0",
    },
    chartContainer: {
        flexDirection: "row",
        alignItems: "flex-end",
        height: 100,
        gap: 2,
    },
    chartBarWrapper: {
        flex: 1,
        height: "100%",
        justifyContent: "flex-end",
    },
    chartBar: {
        borderRadius: 3,
        minHeight: 4,
    },
    chartLabels: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 4,
    },
});
