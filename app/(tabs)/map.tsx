import { useState, useEffect, useRef, useCallback } from "react";
import { View, StyleSheet, Alert } from "react-native";
import {
    Text, FAB, Surface, IconButton, Snackbar, Portal, Dialog, TextInput, Button,
} from "react-native-paper";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { useAppTheme } from "../../src/theme/ThemeProvider";
import { spacing } from "../../src/theme/spacing";
import { useLocation } from "../../src/hooks/useLocation";
import { useRouteTracking } from "../../src/hooks/useRouteTracking";
import { useAuth } from "../../src/hooks/useAuth";
import { saveRoute } from "../../src/services/route.service";
import { checkIn, getVisibleDestinations } from "../../src/services/destination.service";
import { formatDistance, formatDuration } from "../../src/utils/distance";
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

    // Vị trí chọn trên bản đồ (long-press)
    const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number } | null>(null);

    // Destinations on map
    const [destinations, setDestinations] = useState<any[]>([]);

    // Nhận params từ Destinations tab
    const params = useLocalSearchParams<{ focusLat?: string; focusLng?: string; focusName?: string }>();

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

    // Center map vào destination được chọn từ danh sách
    useEffect(() => {
        if (params.focusLat && params.focusLng && mapRef.current) {
            const lat = parseFloat(params.focusLat);
            const lng = parseFloat(params.focusLng);
            if (!isNaN(lat) && !isNaN(lng)) {
                mapRef.current.animateToRegion({
                    latitude: lat,
                    longitude: lng,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                });
                if (params.focusName) {
                    setSnackMsg(`📍 ${params.focusName}`);
                }
            }
        }
    }, [params.focusLat, params.focusLng]);

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

            {/* FAB Start/Stop */}
            <FAB
                icon={isTracking ? "stop" : "play"}
                label={isTracking ? "Dừng" : "Bắt đầu"}
                onPress={isTracking ? handleStop : handleStart}
                loading={saving}
                style={[styles.fab, { backgroundColor: isTracking ? paperTheme.colors.error : paperTheme.colors.primary }]}
                color="white"
            />

            {/* Check-in Dialog */}
            <Portal>
                <Dialog visible={showCheckIn} onDismiss={() => setShowCheckIn(false)}>
                    <Dialog.Title>📍 Check-in</Dialog.Title>
                    <Dialog.Content>
                        <TextInput
                            label="Tên địa điểm"
                            value={checkInName}
                            onChangeText={setCheckInName}
                            mode="outlined"
                            style={{ marginBottom: spacing.sm }}
                        />
                        <TextInput
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
                </Dialog>
            </Portal>

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
