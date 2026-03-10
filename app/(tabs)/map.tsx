import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { View, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform, Animated, PanResponder, ActivityIndicator, type TextInput as RNTextInput } from "react-native";
import {
    Text, FAB, Surface, IconButton, Snackbar, Portal, Dialog, TextInput, Button,
} from "react-native-paper";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { useAppTheme } from "../../src/theme/ThemeProvider";
import { spacing } from "../../src/theme/spacing";
import { useLocation } from "../../src/hooks/useLocation";
import { useRouteTracking } from "../../src/hooks/useRouteTracking";
import { useAuth } from "../../src/hooks/useAuth";
import { saveRoute } from "../../src/services/route.service";
import { checkIn, getVisibleDestinations } from "../../src/services/destination.service";
import { formatDistance, formatDuration } from "../../src/utils/distance";
import { getDirectionsWithInfo } from "../../src/services/directions.service";
import RouteOverlay from "../../src/components/Map/RouteOverlay";
import DestinationMarker from "../../src/components/Map/DestinationMarker";
import PhotoUploadButton from "../../src/components/Photo/PhotoUploadButton";
import { useFocusEffect, useLocalSearchParams } from "expo-router";

export default function MapScreen() {
    const { paperTheme } = useAppTheme();
    const { location, errorMsg, permissionGranted } = useLocation();
    const { isTracking, points, distanceKm, durationSeconds, startTracking, stopTracking } =
        useRouteTracking();
    const { user } = useAuth();
    const mapRef = useRef<MapView>(null);
    const [saving, setSaving] = useState(false);
    const [snackMsg, setSnackMsg] = useState("");

    // Check-in dialog
    const [showCheckIn, setShowCheckIn] = useState(false);
    const [checkInName, setCheckInName] = useState("");
    const [checkInDesc, setCheckInDesc] = useState("");
    const [checkingIn, setCheckingIn] = useState(false);
    const [lastCheckInId, setLastCheckInId] = useState<string | null>(null);
    const descInputRef = useRef<RNTextInput>(null);

    // Vị trí chọn trên bản đồ (long-press)
    const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number } | null>(null);

    // Destinations on map
    const [destinations, setDestinations] = useState<any[]>([]);

    // Navigation route (đường đi đến điểm đến)
    const [navRoute, setNavRoute] = useState<{ latitude: number; longitude: number }[] | null>(null);
    const [navInfo, setNavInfo] = useState<{ distanceKm: number; durationMinutes: number; destName: string } | null>(null);
    const [loadingRoute, setLoadingRoute] = useState(false);
    const routeAbortRef = useRef<AbortController | null>(null);
    const [navCardExpanded, setNavCardExpanded] = useState(true);

    // Animated bottom card
    const NAV_CARD_HEIGHT = 260;
    const NAV_PEEK_HEIGHT = 64;
    const navTranslateY = useRef(new Animated.Value(0)).current;

    const navPanResponder = useMemo(() => PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
        onPanResponderMove: (_, g) => {
            // Only allow dragging down when expanded, up when collapsed
            if (navCardExpanded && g.dy > 0) {
                navTranslateY.setValue(g.dy);
            } else if (!navCardExpanded && g.dy < 0) {
                navTranslateY.setValue((NAV_CARD_HEIGHT - NAV_PEEK_HEIGHT) + g.dy);
            }
        },
        onPanResponderRelease: (_, g) => {
            const threshold = 50;
            if (navCardExpanded && g.dy > threshold) {
                // Collapse
                Animated.spring(navTranslateY, {
                    toValue: NAV_CARD_HEIGHT - NAV_PEEK_HEIGHT,
                    useNativeDriver: true, bounciness: 4,
                }).start(() => setNavCardExpanded(false));
            } else if (!navCardExpanded && g.dy < -threshold) {
                // Expand
                Animated.spring(navTranslateY, {
                    toValue: 0,
                    useNativeDriver: true, bounciness: 4,
                }).start(() => setNavCardExpanded(true));
            } else {
                // Snap back
                Animated.spring(navTranslateY, {
                    toValue: navCardExpanded ? 0 : NAV_CARD_HEIGHT - NAV_PEEK_HEIGHT,
                    useNativeDriver: true, bounciness: 4,
                }).start();
            }
        },
    }), [navCardExpanded]);

    // Auto-expand khi có nav mới
    useEffect(() => {
        if (navInfo) {
            navTranslateY.setValue(0);
            setNavCardExpanded(true);
        }
    }, [navInfo]);

    // Nhận params từ Destinations tab
    const params = useLocalSearchParams<{ focusLat?: string; focusLng?: string; focusName?: string; _ts?: string }>();

    // Load destinations khi focus tab
    useFocusEffect(
        useCallback(() => {
            if (user) {
                getVisibleDestinations(user.id)
                    .then(setDestinations)
                    .catch(() => { });
            }
        }, [user])
    );

    // Center map + vẽ đường đi đến destination được chọn từ danh sách
    useEffect(() => {
        if (params.focusLat && params.focusLng && mapRef.current) {
            const destLat = parseFloat(params.focusLat);
            const destLng = parseFloat(params.focusLng);
            if (isNaN(destLat) || isNaN(destLng)) return;

            if (location) {
                routeAbortRef.current?.abort();
                const controller = new AbortController();
                routeAbortRef.current = controller;

                setLoadingRoute(true);
                getDirectionsWithInfo(
                    { latitude: location.latitude, longitude: location.longitude },
                    { latitude: destLat, longitude: destLng },
                    controller.signal
                )
                    .then((result) => {
                        if (controller.signal.aborted) return;
                        setNavRoute(result.coordinates);
                        setNavInfo({
                            distanceKm: result.distanceKm,
                            durationMinutes: result.durationMinutes,
                            destName: params.focusName || "Điểm đến",
                        });
                        mapRef.current?.fitToCoordinates(
                            [
                                { latitude: location.latitude, longitude: location.longitude },
                                { latitude: destLat, longitude: destLng },
                            ],
                            { edgePadding: { top: 100, right: 60, bottom: 200, left: 60 }, animated: true }
                        );
                    })
                    .catch((err) => {
                        if (controller.signal.aborted) return;
                        setSnackMsg(err.message || "Không thể lấy đường đi");
                    })
                    .finally(() => {
                        if (!controller.signal.aborted) setLoadingRoute(false);
                    });
            } else {
                mapRef.current.animateToRegion({
                    latitude: destLat, longitude: destLng,
                    latitudeDelta: 0.005, longitudeDelta: 0.005,
                });
            }

            if (params.focusName) {
                setSnackMsg(`📍 ${params.focusName}`);
            }
        }
    }, [params.focusLat, params.focusLng, params._ts]);

    // Hủy loading route
    const cancelRouteLoading = () => {
        routeAbortRef.current?.abort();
        routeAbortRef.current = null;
        setLoadingRoute(false);
    };

    // Xóa đường dẫn
    const clearNavRoute = () => {
        setNavRoute(null);
        setNavInfo(null);
    };

    // Center map khi có vị trí lần đầu (nếu không có focus params)
    useEffect(() => {
        if (location && mapRef.current && !isTracking && !params.focusLat) {
            mapRef.current.animateToRegion({
                latitude: location.latitude,
                longitude: location.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            });
        }
    }, [location?.latitude, location?.longitude]);

    const handleStart = async () => {
        try {
            await startTracking();
        } catch (err: any) {
            Alert.alert("Lỗi", err.message);
        }
    };

    const handleStop = async () => {
        const result = stopTracking();
        if (result.points.length < 2) {
            setSnackMsg("Quãng đường quá ngắn, không lưu");
            return;
        }
        if (!user) {
            setSnackMsg("Chưa đăng nhập");
            return;
        }
        setSaving(true);
        try {
            await saveRoute(
                user.id, result.points, result.distanceMeters,
                result.durationSeconds, undefined, result.startedAt || undefined, result.endedAt
            );
            setSnackMsg(`Đã lưu: ${formatDistance(result.distanceKm)} trong ${formatDuration(result.durationSeconds)}`);
        } catch (err: any) {
            Alert.alert("Lỗi lưu route", err.message);
        } finally {
            setSaving(false);
        }
    };

    // Check-in
    const checkInLocation = selectedLocation || (location ? { latitude: location.latitude, longitude: location.longitude } : null);

    const handleCheckIn = async () => {
        if (!checkInName.trim()) return;
        if (!checkInLocation || !user) return;
        setCheckingIn(true);
        try {
            const result = await checkIn(user.id, checkInName.trim(), checkInLocation.latitude, checkInLocation.longitude, checkInDesc.trim() || undefined);
            setSnackMsg(`📍 Đã check-in: ${checkInName.trim()}`);
            setLastCheckInId(result.id);
            setCheckInName("");
            setCheckInDesc("");
            setSelectedLocation(null);
            setShowCheckIn(false);
            // Reload markers
            const updated = await getVisibleDestinations(user.id);
            setDestinations(updated);
        } catch (err: any) {
            Alert.alert("Lỗi check-in", err.message);
        } finally {
            setCheckingIn(false);
        }
    };

    // Long-press trên map → chọn vị trí
    const handleMapLongPress = (e: any) => {
        const coord = e.nativeEvent.coordinate;
        setSelectedLocation(coord);
        setShowCheckIn(true);
    };

    const centerOnMe = () => {
        if (location && mapRef.current) {
            mapRef.current.animateToRegion({
                latitude: location.latitude, longitude: location.longitude,
                latitudeDelta: 0.005, longitudeDelta: 0.005,
            });
        }
    };

    if (!permissionGranted && errorMsg) {
        return (
            <View style={[styles.center, { backgroundColor: paperTheme.colors.background }]}>
                <Text variant="bodyLarge" style={{ textAlign: "center", padding: spacing.lg }}>
                    📍 {errorMsg}
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                style={styles.map}
                provider={PROVIDER_DEFAULT}
                showsUserLocation
                showsMyLocationButton={false}
                followsUserLocation={isTracking}
                onLongPress={handleMapLongPress}
                initialRegion={
                    location
                        ? { latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }
                        : { latitude: 10.7769, longitude: 106.7009, latitudeDelta: 0.05, longitudeDelta: 0.05 }
                }
            >
                {isTracking && points.length >= 2 && <RouteOverlay coordinates={points} />}

                {/* Navigation route polyline */}
                {navRoute && navRoute.length >= 2 && (
                    <Polyline
                        coordinates={navRoute}
                        strokeColor="#2196F3"
                        strokeWidth={5}
                        lineDashPattern={[10, 5]}
                    />
                )}

                {/* Destination markers */}
                {destinations.map((dest) => (
                    dest.latitude && dest.longitude ? (
                        <DestinationMarker
                            key={dest.id}
                            latitude={dest.latitude}
                            longitude={dest.longitude}
                            title={dest.name}
                            description={dest.description}
                            isFavorite={dest.is_favorite}
                        />
                    ) : null
                ))}

                {/* Marker tạm thời khi long-press — nhấn giữ chỗ khác để di chuyển */}
                {selectedLocation && (
                    <Marker
                        coordinate={selectedLocation}
                        pinColor="red"
                        title="Vị trí đã chọn"
                        description="Nhấn giữ chỗ khác để di chuyển"
                    />
                )}
            </MapView>

            {/* Navigation bottom card — swipeable */}
            {navInfo && (
                <Animated.View
                    style={[
                        styles.navCard,
                        { backgroundColor: paperTheme.colors.surface, transform: [{ translateY: navTranslateY }] },
                    ]}
                    {...navPanResponder.panHandlers}
                >
                    {/* Drag handle */}
                    <View style={styles.navHandle}>
                        <View style={[styles.navHandlePill, { backgroundColor: paperTheme.colors.outlineVariant }]} />
                    </View>

                    {/* Collapsed peek — always visible */}
                    <View style={styles.navPeekRow}>
                        <Text variant="titleMedium" style={{ fontWeight: "bold", color: paperTheme.colors.onSurface, flex: 1 }}>
                            {Math.ceil(navInfo.durationMinutes)} phút
                            <Text style={{ fontWeight: "normal", color: paperTheme.colors.onSurfaceVariant }}>
                                {" "}({navInfo.distanceKm.toFixed(1)} Km)
                            </Text>
                        </Text>
                        <IconButton
                            icon="close"
                            iconColor={paperTheme.colors.onSurfaceVariant}
                            size={20}
                            onPress={clearNavRoute}
                            style={{ margin: 0 }}
                        />
                    </View>

                    {/* Expanded content */}
                    <View style={styles.navExpandedContent}>
                        {/* Destination info */}
                        <View style={styles.navInfoRow}>
                            <View style={[styles.navDot, { backgroundColor: paperTheme.colors.primary }]} />
                            <Text variant="bodyMedium" style={{ color: paperTheme.colors.onSurfaceVariant, flex: 1 }} numberOfLines={1}>
                                {navInfo.destName}
                            </Text>
                        </View>

                        {/* Arrival time */}
                        <View style={styles.navInfoRow}>
                            <Text style={{ fontSize: 14, color: paperTheme.colors.onSurfaceVariant }}>⏰</Text>
                            <Text variant="bodyMedium" style={{ color: paperTheme.colors.onSurfaceVariant }}>
                                Đến lúc ~{new Date(Date.now() + navInfo.durationMinutes * 60000).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                            </Text>
                        </View>

                        {/* Start button */}
                        <Button
                            mode="contained"
                            onPress={clearNavRoute}
                            style={[styles.navStartBtn, { backgroundColor: paperTheme.colors.onSurface }]}
                            labelStyle={{ color: paperTheme.colors.surface, fontWeight: "bold", fontSize: 16 }}
                        >
                            Bắt đầu
                        </Button>
                    </View>
                </Animated.View>
            )}

            {/* Tracking info bar */}
            {isTracking && (
                <Surface style={[styles.trackingBar, { backgroundColor: paperTheme.colors.primaryContainer }]} elevation={3}>
                    <View style={styles.trackingInfo}>
                        <View style={styles.trackingItem}>
                            <Text variant="titleLarge" style={{ color: paperTheme.colors.onPrimaryContainer, fontWeight: "bold" }}>
                                {formatDistance(distanceKm)}
                            </Text>
                            <Text variant="bodySmall" style={{ color: paperTheme.colors.onPrimaryContainer }}>Quãng đường</Text>
                        </View>
                        <View style={styles.trackingItem}>
                            <Text variant="titleLarge" style={{ color: paperTheme.colors.onPrimaryContainer, fontWeight: "bold" }}>
                                {formatDuration(durationSeconds)}
                            </Text>
                            <Text variant="bodySmall" style={{ color: paperTheme.colors.onPrimaryContainer }}>Thời gian</Text>
                        </View>
                        <View style={styles.trackingItem}>
                            <Text variant="titleLarge" style={{ color: paperTheme.colors.onPrimaryContainer, fontWeight: "bold" }}>
                                {points.length}
                            </Text>
                            <Text variant="bodySmall" style={{ color: paperTheme.colors.onPrimaryContainer }}>Điểm GPS</Text>
                        </View>
                    </View>
                </Surface>
            )}

            {/* Buttons bên phải */}
            <View style={styles.rightButtons}>
                {selectedLocation && (
                    <IconButton
                        icon="map-marker-remove"
                        mode="contained"
                        containerColor={paperTheme.colors.errorContainer}
                        iconColor={paperTheme.colors.onErrorContainer}
                        size={24}
                        onPress={() => setSelectedLocation(null)}
                    />
                )}
                <IconButton
                    icon="map-marker-plus"
                    mode="contained"
                    containerColor={paperTheme.colors.secondaryContainer}
                    iconColor={paperTheme.colors.onSecondaryContainer}
                    size={24}
                    onPress={() => setShowCheckIn(true)}
                />
                <IconButton
                    icon="crosshairs-gps"
                    mode="contained"
                    containerColor={paperTheme.colors.surface}
                    iconColor={paperTheme.colors.primary}
                    size={24}
                    onPress={centerOnMe}
                />
            </View>

            {/* FAB Start/Stop — ẩn khi nav card expanded */}
            {(!navInfo || !navCardExpanded) && (
                <FAB
                    icon={isTracking ? "stop" : "play"}
                    label={isTracking ? "Dừng" : "Bắt đầu"}
                    onPress={isTracking ? handleStop : handleStart}
                    loading={saving}
                    style={[styles.fab, { backgroundColor: isTracking ? paperTheme.colors.error : paperTheme.colors.primary }]}
                    color="white"
                />
            )}

            {/* Check-in Dialog */}
            <Portal>
                <Dialog visible={showCheckIn} onDismiss={() => setShowCheckIn(false)}>
                    <Dialog.Title>📍 Check-in</Dialog.Title>
                    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
                        <ScrollView keyboardShouldPersistTaps="handled">
                            <Dialog.Content>
                                <TextInput
                                    label="Tên địa điểm"
                                    value={checkInName}
                                    onChangeText={setCheckInName}
                                    mode="outlined"
                                    style={{ marginBottom: spacing.sm }}
                                    returnKeyType="next"
                                    blurOnSubmit={false}
                                    onSubmitEditing={() => descInputRef.current?.focus()}
                                />
                                <TextInput
                                    ref={descInputRef}
                                    label="Mô tả (tùy chọn)"
                                    value={checkInDesc}
                                    onChangeText={setCheckInDesc}
                                    mode="outlined"
                                    multiline
                                    numberOfLines={2}
                                />
                                {checkInLocation && (
                                    <Text variant="bodySmall" style={{ marginTop: spacing.sm, color: paperTheme.colors.onSurfaceVariant }}>
                                        📌 {checkInLocation.latitude.toFixed(5)}, {checkInLocation.longitude.toFixed(5)}
                                        {selectedLocation ? " (Đã chọn trên bản đồ)" : " (Vị trí hiện tại)"}
                                    </Text>
                                )}
                                {lastCheckInId && (
                                    <PhotoUploadButton
                                        destinationId={lastCheckInId}
                                        latitude={checkInLocation?.latitude}
                                        longitude={checkInLocation?.longitude}
                                        onUploaded={() => setSnackMsg("📷 Đã upload ảnh!")}
                                    />
                                )}
                            </Dialog.Content>
                            <Dialog.Actions>
                                <Button onPress={() => setShowCheckIn(false)}>Hủy</Button>
                                <Button onPress={handleCheckIn} loading={checkingIn} disabled={!checkInName.trim()}>
                                    Check-in
                                </Button>
                            </Dialog.Actions>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </Dialog>
            </Portal>

            {/* Loading route overlay */}
            {loadingRoute && (
                <View style={styles.loadingOverlay}>
                    <Surface style={[styles.loadingCard, { backgroundColor: paperTheme.colors.surface }]} elevation={5}>
                        <IconButton
                            icon="close"
                            iconColor={paperTheme.colors.onSurfaceVariant}
                            size={20}
                            style={styles.loadingCloseBtn}
                            onPress={cancelRouteLoading}
                        />
                        <ActivityIndicator size="large" color={paperTheme.colors.primary} />
                        <Text variant="bodyMedium" style={{ marginTop: spacing.md, color: paperTheme.colors.onSurface, textAlign: "center" }}>
                            Đang tìm đường đi...
                        </Text>
                    </Surface>
                </View>
            )}

            <Snackbar visible={!!snackMsg} onDismiss={() => setSnackMsg("")} duration={3000}>
                {snackMsg}
            </Snackbar>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    map: { flex: 1 },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.4)",
        justifyContent: "center", alignItems: "center",
        zIndex: 999,
    },
    loadingCard: {
        borderRadius: 20, padding: spacing.xl,
        alignItems: "center", minWidth: 220,
    },
    loadingCloseBtn: {
        position: "absolute", top: 4, right: 4,
    },
    navCard: {
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: 260,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.xl,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        elevation: 8,
        shadowColor: "#000", shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.15, shadowRadius: 6,
    },
    navHandle: {
        alignItems: "center", paddingVertical: 10,
    },
    navHandlePill: {
        width: 40, height: 4, borderRadius: 2,
    },
    navPeekRow: {
        flexDirection: "row", alignItems: "center",
    },
    navExpandedContent: {
        overflow: "hidden",
    },
    navInfoRow: {
        flexDirection: "row", alignItems: "center", gap: 10,
        marginTop: spacing.sm,
    },
    navDot: {
        width: 10, height: 10, borderRadius: 5,
    },
    navStartBtn: {
        marginTop: spacing.lg, borderRadius: 28, paddingVertical: 4,
    },
    trackingBar: {
        position: "absolute", top: 0, left: 0, right: 0,
        paddingTop: 50, paddingBottom: spacing.md, paddingHorizontal: spacing.lg,
        borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
    },
    trackingInfo: { flexDirection: "row", justifyContent: "space-around" },
    trackingItem: { alignItems: "center" },
    rightButtons: {
        position: "absolute", right: 8, bottom: 100, gap: 4,
    },
    fab: { position: "absolute", bottom: 24, alignSelf: "center" },
});
