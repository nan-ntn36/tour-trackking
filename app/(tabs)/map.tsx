import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { View, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform, Animated, PanResponder, ActivityIndicator, Image, Pressable, FlatList, Dimensions, Keyboard, type TextInput as RNTextInput } from "react-native";
import {
    Text, FAB, Surface, IconButton, Snackbar, Portal, Dialog, TextInput, Button, Chip, Searchbar,
} from "react-native-paper";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { useAppTheme } from "../../src/theme/ThemeProvider";
import { spacing } from "../../src/theme/spacing";
import { useLocation } from "../../src/hooks/useLocation";
import { useRouteTracking } from "../../src/hooks/useRouteTracking";
import { useAuth } from "../../src/hooks/useAuth";
import { saveRoute } from "../../src/services/route.service";
import { checkIn, getVisibleDestinations } from "../../src/services/destination.service";
import { getPhotosByDestination } from "../../src/services/photo.service";
import { updateMyLocation, getMemberLocations, getTourDestinations } from "../../src/services/tour.service";
import { formatDistance, formatDuration, haversineDistance, distanceToPolyline } from "../../src/utils/distance";
import { getDirectionsWithInfo, getManeuverIcon, type NavStep } from "../../src/services/directions.service";
import RouteOverlay from "../../src/components/Map/RouteOverlay";
import DestinationMarker from "../../src/components/Map/DestinationMarker";
import PhotoUploadButton from "../../src/components/Photo/PhotoUploadButton";
import { getNearbyPOIs, POI_CATEGORIES, type POI, type POICategory } from "../../src/services/poi.service";
import { useFocusEffect, useLocalSearchParams } from "expo-router";

export default function MapScreen() {
    const { paperTheme } = useAppTheme();
    const { location, errorMsg, permissionGranted, startWatching, stopWatching } = useLocation();
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

    // Clear data on logout
    useEffect(() => {
        if (!user) {
            setDestinations([]);
            setSelectedLocation(null);
            setShowCheckIn(false);
            setCheckInName("");
            setCheckInDesc("");
            setPois([]);
            setSelectedPoi(null);
            setNavRoute(null);
            setDisplayRoute(null);
            setNavInfo(null);
            setNavDestPhotos([]);
            setIsNavigating(false);
            setShowSearch(false);
            setPoiSearch("");
        }
    }, [user]);

    // POI Explore
    const [showSearch, setShowSearch] = useState(false);
    const [poiSearch, setPoiSearch] = useState("");
    const [pois, setPois] = useState<POI[]>([]);
    const [poisLoading, setPoisLoading] = useState(false);
    const [selectedPoi, setSelectedPoi] = useState<POI | null>(null);

    // Navigation route (đường đi đến điểm đến)
    const [navRoute, setNavRoute] = useState<{ latitude: number; longitude: number }[] | null>(null);
    const [displayRoute, setDisplayRoute] = useState<{ latitude: number; longitude: number }[] | null>(null);
    const [navInfo, setNavInfo] = useState<{ distanceKm: number; durationMinutes: number; destName: string; destLat: number; destLng: number } | null>(null);
    const [loadingRoute, setLoadingRoute] = useState(false);
    const routeAbortRef = useRef<AbortController | null>(null);
    const [navCardExpanded, setNavCardExpanded] = useState(true);

    // Destination photos for nav card
    const [navDestPhotos, setNavDestPhotos] = useState<string[]>([]);

    // Navigation mode (điều hướng real-time)
    const [isNavigating, setIsNavigating] = useState(false);
    const [isRerouting, setIsRerouting] = useState(false);
    const lastRerouteRef = useRef<number>(0);
    const [remainingKm, setRemainingKm] = useState(0);
    const [remainingMin, setRemainingMin] = useState(0);
    const [navSteps, setNavSteps] = useState<NavStep[]>([]);
    const [currentStepIdx, setCurrentStepIdx] = useState(0);

    // Animated bottom card
    const NAV_CARD_HEIGHT = navDestPhotos.length > 0 ? 370 : 240;
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

    // Nhận params từ Destinations tab hoặc Tours tab
    const params = useLocalSearchParams<{ focusLat?: string; focusLng?: string; focusName?: string; destId?: string; tourId?: string; tourName?: string; _ts?: string }>();

    // Tour mode state
    const [activeTourId, setActiveTourId] = useState<string | null>(null);
    const [activeTourName, setActiveTourName] = useState<string>("");
    const [memberLocations, setMemberLocations] = useState<any[]>([]);
    const [tourDests, setTourDests] = useState<any[]>([]);

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

    // Tour mode: activate when tourId param received
    useEffect(() => {
        if (params.tourId && params.tourId !== activeTourId) {
            setActiveTourId(params.tourId);
            setActiveTourName(params.tourName || "Tour");
        }
    }, [params.tourId, params._ts]);

    // Tour mode: broadcast location + fetch member locations every 10s
    useEffect(() => {
        if (!activeTourId || !user || !location) return;

        // Broadcast own location immediately
        updateMyLocation(user.id, activeTourId, location.latitude, location.longitude).catch(() => {});

        // Fetch member locations immediately
        const fetchMembers = () => {
            getMemberLocations(activeTourId!)
                .then(setMemberLocations)
                .catch(() => {});
        };
        fetchMembers();

        // Fetch tour destinations
        getTourDestinations(activeTourId)
            .then(setTourDests)
            .catch(() => {});

        // Set up interval
        const interval = setInterval(() => {
            if (location) {
                updateMyLocation(user.id, activeTourId!, location.latitude, location.longitude).catch(() => {});
            }
            fetchMembers();
        }, 10000);

        return () => clearInterval(interval);
    }, [activeTourId, user, location?.latitude, location?.longitude]);

    // Tour mode: fit camera to all members when first loaded
    useEffect(() => {
        if (activeTourId && memberLocations.length > 1 && mapRef.current) {
            const coords = memberLocations
                .filter(m => m.last_latitude && m.last_longitude)
                .map(m => ({ latitude: m.last_latitude, longitude: m.last_longitude }));
            if (coords.length > 1) {
                mapRef.current.fitToCoordinates(coords, {
                    edgePadding: { top: 120, right: 60, bottom: 100, left: 60 },
                    animated: true,
                });
            }
        }
    }, [activeTourId, memberLocations.length]);

    const closeTourMode = () => {
        setActiveTourId(null);
        setActiveTourName("");
        setMemberLocations([]);
        setTourDests([]);
    };

    // Center map + vẽ đường đi đến destination được chọn từ danh sách
    useEffect(() => {
        if (params.focusLat && params.focusLng && mapRef.current) {
            const destLat = parseFloat(params.focusLat);
            const destLng = parseFloat(params.focusLng);
            if (isNaN(destLat) || isNaN(destLng)) return;

            // Fetch destination photos nếu có destId
            if (params.destId) {
                getPhotosByDestination(params.destId)
                    .then((photos) => {
                        setNavDestPhotos(photos.map((p: any) => p.cloudinary_url).filter(Boolean));
                    })
                    .catch(() => setNavDestPhotos([]));
            } else {
                setNavDestPhotos([]);
            }

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
                        setNavSteps(result.steps || []);
                        setCurrentStepIdx(0);
                        setNavInfo({
                            distanceKm: result.distanceKm,
                            durationMinutes: result.durationMinutes,
                            destName: params.focusName || "Điểm đến",
                            destLat: destLat,
                            destLng: destLng,
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
        if (isNavigating) handleStopNavigation();
        setNavRoute(null);
        setDisplayRoute(null);
        setNavInfo(null);
        setNavDestPhotos([]);
        setNavSteps([]);
        setCurrentStepIdx(0);
    };

    // Bắt đầu điều hướng
    const handleStartNavigation = async () => {
        if (!navInfo || !navRoute || !location) return;
        setIsNavigating(true);
        setRemainingKm(navInfo.distanceKm);
        setRemainingMin(navInfo.durationMinutes);

        // Bật GPS tracking liên tục
        await startWatching();

        // Camera follow user
        if (mapRef.current) {
            mapRef.current.animateCamera({
                center: { latitude: location.latitude, longitude: location.longitude },
                pitch: 45,
                heading: location.heading ?? 0,
                zoom: 17,
            }, { duration: 800 });
        }
    };

    // Dừng điều hướng
    const handleStopNavigation = () => {
        setIsNavigating(false);
        // Tắt GPS tracking liên tục
        stopWatching();
        // Reset camera
        if (location && mapRef.current) {
            mapRef.current.animateCamera({
                center: { latitude: location.latitude, longitude: location.longitude },
                pitch: 0,
                heading: 0,
                zoom: 15,
            }, { duration: 800 });
        }
    };

    // Real-time tracking khi đang điều hướng
    useEffect(() => {
        if (!isNavigating || !location || !navInfo || !navRoute) return;

        const userLat = location.latitude;
        const userLng = location.longitude;

        // Tính khoảng cách còn lại đến đích
        const distKm = haversineDistance(userLat, userLng, navInfo.destLat, navInfo.destLng);
        setRemainingKm(distKm);

        // Ước tính thời gian còn lại
        const avgSpeed = navInfo.distanceKm / navInfo.durationMinutes;
        const estMin = avgSpeed > 0 ? distKm / avgSpeed : 0;
        setRemainingMin(Math.max(estMin, 0));

        // === Trim route: chỉ hiển phần còn lại phía trước ===
        // Tìm segment gần user nhất trên navRoute
        let nearestIdx = 0;
        let nearestDist = Infinity;
        for (let i = 0; i < navRoute.length; i++) {
            const d = haversineDistance(userLat, userLng, navRoute[i].latitude, navRoute[i].longitude);
            if (d < nearestDist) {
                nearestDist = d;
                nearestIdx = i;
            }
        }
        // Tạo displayRoute: [vị trí user hiện tại, ...các điểm còn lại]
        const remaining = navRoute.slice(nearestIdx + 1);
        setDisplayRoute([
            { latitude: userLat, longitude: userLng },
            ...remaining,
        ]);

        // === Find current step using step.routeIndex from OSRM ===
        if (navSteps.length > 0) {
            // Find the last step we've passed
            let lastPassedIdx = -1;
            for (let s = 0; s < navSteps.length; s++) {
                if (nearestIdx >= navSteps[s].routeIndex) {
                    lastPassedIdx = s;
                }
            }
            // Show the NEXT step after the last passed one
            const showIdx = Math.min(lastPassedIdx + 1, navSteps.length - 1);
            if (showIdx !== currentStepIdx) setCurrentStepIdx(showIdx);
        }

        // Camera follow user
        if (mapRef.current) {
            mapRef.current.animateCamera({
                center: { latitude: userLat, longitude: userLng },
                pitch: 45,
                heading: location.heading ?? 0,
                zoom: 17,
            }, { duration: 800 });
        }

        // Tự động dừng khi đến đích (< 50m)
        if (distKm < 0.05) {
            setSnackMsg(`🎉 Đã đến ${navInfo.destName}!`);
            handleStopNavigation();
            clearNavRoute();
            return;
        }

        // === Auto-reroute khi đi sai đường (> 200m từ route) ===
        const offRouteKm = distanceToPolyline(userLat, userLng, navRoute);
        const REROUTE_THRESHOLD_KM = 0.2; // 200m (tránh GPS noise)
        const REROUTE_COOLDOWN_MS = 30_000; // 30 giây
        const now = Date.now();

        if (offRouteKm > REROUTE_THRESHOLD_KM && !isRerouting && (now - lastRerouteRef.current > REROUTE_COOLDOWN_MS)) {
            lastRerouteRef.current = now;
            setIsRerouting(true);
            setSnackMsg("🔄 Đang vẽ lại đường...");

            getDirectionsWithInfo(
                { latitude: userLat, longitude: userLng },
                { latitude: navInfo.destLat, longitude: navInfo.destLng }
            )
                .then((result) => {
                    // Lưu route mới và reset displayRoute
                    setNavRoute(result.coordinates);
                    setNavSteps(result.steps || []);
                    setCurrentStepIdx(0);
                    setDisplayRoute([
                        { latitude: userLat, longitude: userLng },
                        ...result.coordinates,
                    ]);
                    setNavInfo((prev) => prev ? {
                        ...prev,
                        distanceKm: result.distanceKm,
                        durationMinutes: result.durationMinutes,
                    } : prev);
                    setRemainingKm(result.distanceKm);
                    setRemainingMin(result.durationMinutes);
                    setSnackMsg("✅ Đã vẽ lại đường mới!");
                })
                .catch((err) => {
                    setSnackMsg(`⚠️ Không thể vẽ lại: ${err.message}`);
                })
                .finally(() => {
                    setIsRerouting(false);
                });
        }
    }, [isNavigating, location?.latitude, location?.longitude]);

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
        if (!user) {
            setSnackMsg("🔒 Vui lòng đăng nhập để sử dụng tính năng này");
            return;
        }
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

            // === Auto check-in: gợi ý check-in hoặc tạo mới ===
            const lastPoint = result.points[result.points.length - 1];
            if (lastPoint) {
                const AUTO_CHECKIN_THRESHOLD_KM = 0.1; // 100m
                const nearDest = destinations.length > 0
                    ? destinations.find((d: any) =>
                        haversineDistance(lastPoint.latitude, lastPoint.longitude, d.latitude, d.longitude) < AUTO_CHECKIN_THRESHOLD_KM
                    )
                    : null;

                if (nearDest) {
                    // Gần điểm đến đã có → gợi ý check-in
                    Alert.alert(
                        "📍 Gần điểm đến!",
                        `Bạn đang gần "${nearDest.name}" (< 100m).\nCheck-in tại đây?`,
                        [
                            { text: "Bỏ qua", style: "cancel" },
                            {
                                text: "✅ Check-in",
                                onPress: async () => {
                                    try {
                                        await checkIn(user.id, nearDest.name, lastPoint.latitude, lastPoint.longitude);
                                        setSnackMsg(`📍 Đã check-in: ${nearDest.name}`);
                                        const updated = await getVisibleDestinations(user.id);
                                        setDestinations(updated);
                                    } catch (err: any) {
                                        setSnackMsg("Lỗi check-in: " + err.message);
                                    }
                                },
                            },
                        ]
                    );
                } else {
                    // Không có điểm đến nào gần → reverse geocode + gợi ý tạo mới
                    let addressName = "";
                    try {
                        const Location = require("expo-location");
                        const [geo] = await Location.reverseGeocodeAsync({
                            latitude: lastPoint.latitude,
                            longitude: lastPoint.longitude,
                        });
                        if (geo) {
                            const parts = [geo.street, geo.name, geo.district, geo.subregion, geo.city].filter(Boolean);
                            addressName = parts.slice(0, 2).join(", ") || "";
                        }
                    } catch { }

                    const displayAddr = addressName || `${lastPoint.latitude.toFixed(5)}, ${lastPoint.longitude.toFixed(5)}`;

                    Alert.alert(
                        "📍 Tạo điểm đến mới?",
                        `Bạn vừa dừng tại:\n${displayAddr}\n\nTạo điểm đến tại vị trí này?`,
                        [
                            { text: "Bỏ qua", style: "cancel" },
                            {
                                text: "✅ Tạo & Check-in",
                                onPress: async () => {
                                    try {
                                        const name = addressName || `Điểm đến ${new Date().toLocaleTimeString("vi-VN")}`;
                                        await checkIn(user.id, name, lastPoint.latitude, lastPoint.longitude);
                                        setSnackMsg(`📍 Đã tạo & check-in: ${name}`);
                                        const updated = await getVisibleDestinations(user.id);
                                        setDestinations(updated);
                                    } catch (err: any) {
                                        setSnackMsg("Lỗi: " + err.message);
                                    }
                                },
                            },
                        ]
                    );
                }
            }
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

    // ==================== POI Explore ====================
    const loadPOIs = async () => {
        if (!location) {
            Alert.alert("Chưa có vị trí", "Vui lòng bật GPS để khám phá địa điểm xung quanh.");
            return;
        }
        setPoisLoading(true);
        try {
            const result = await getNearbyPOIs(location.latitude, location.longitude, 1500);
            setPois(result);
        } catch (err: any) {
            setSnackMsg(err.message || "Không thể tải POI");
        } finally {
            setPoisLoading(false);
        }
    };

    const filteredPOIs = pois.filter(p => {
        if (!poiSearch) return true;
        return p.name.toLowerCase().includes(poiSearch.toLowerCase());
    });

    const handleSelectPOI = (poi: POI) => {
        setSelectedPoi(poi);
        setShowSearch(false);
        if (mapRef.current) {
            mapRef.current.animateToRegion({
                latitude: poi.lat, longitude: poi.lon,
                latitudeDelta: 0.005, longitudeDelta: 0.005,
            });
        }
    };

    const handleNavigateToPOI = (poi: POI) => {
        if (!location) return;
        setSelectedPoi(null);

        routeAbortRef.current?.abort();
        const controller = new AbortController();
        routeAbortRef.current = controller;

        setLoadingRoute(true);
        setNavDestPhotos([]);
        getDirectionsWithInfo(
            { latitude: location.latitude, longitude: location.longitude },
            { latitude: poi.lat, longitude: poi.lon },
            controller.signal
        )
            .then((result) => {
                if (controller.signal.aborted) return;
                setNavRoute(result.coordinates);
                setNavInfo({
                    distanceKm: result.distanceKm,
                    durationMinutes: result.durationMinutes,
                    destName: poi.name,
                    destLat: poi.lat,
                    destLng: poi.lon,
                });
                mapRef.current?.fitToCoordinates(
                    [
                        { latitude: location.latitude, longitude: location.longitude },
                        { latitude: poi.lat, longitude: poi.lon },
                    ],
                    { edgePadding: { top: 100, right: 60, bottom: 200, left: 60 }, animated: true }
                );
            })
            .catch((err) => {
                if (!controller.signal.aborted) setSnackMsg(err.message || "Không thể lấy đường đi");
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoadingRoute(false);
            });
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
                onPress={() => { if (showSearch) setShowSearch(false); Keyboard.dismiss(); }}
                initialRegion={
                    location
                        ? { latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }
                        : { latitude: 10.7769, longitude: 106.7009, latitudeDelta: 0.05, longitudeDelta: 0.05 }
                }
            >
                {isTracking && points.length >= 2 && <RouteOverlay coordinates={points} />}

                {/* Navigation route polyline */}
                {isNavigating && displayRoute && displayRoute.length >= 2 ? (
                    <Polyline
                        coordinates={displayRoute}
                        strokeColor="#1565C0"
                        strokeWidth={6}
                        lineDashPattern={[0]}
                    />
                ) : navRoute && navRoute.length >= 2 ? (
                    <Polyline
                        coordinates={navRoute}
                        strokeColor="#2196F3"
                        strokeWidth={5}
                        lineDashPattern={[10, 5]}
                    />
                ) : null}

                {/* Destination marker khi đang điều hướng */}
                {isNavigating && navInfo && (
                    <Marker
                        coordinate={{ latitude: navInfo.destLat, longitude: navInfo.destLng }}
                        pinColor="#1565C0"
                        title={navInfo.destName}
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

                {/* Tour member markers */}
                {activeTourId && memberLocations.map((member) => {
                    if (!member.last_latitude || !member.last_longitude) return null;
                    const profile = member.profiles;
                    const isSelf = member.user_id === user?.id;
                    const name = profile?.display_name || "?";
                    const initial = name.charAt(0).toUpperCase();
                    const isOwner = member.role === "owner";
                    const bgColor = isSelf ? "#4CAF50" : isOwner ? "#FF9800" : "#2196F3";
                    const minutesAgo = member.last_updated_at
                        ? Math.round((Date.now() - new Date(member.last_updated_at).getTime()) / 60000)
                        : null;

                    return (
                        <Marker
                            key={`tour-member-${member.user_id}`}
                            coordinate={{ latitude: member.last_latitude, longitude: member.last_longitude }}
                            title={isSelf ? `${name} (Bạn)` : name}
                            description={minutesAgo !== null ? (minutesAgo < 1 ? "Vừa cập nhật" : `${minutesAgo} phút trước`) : undefined}
                            anchor={{ x: 0.5, y: 0.5 }}
                        >
                            <View style={{
                                backgroundColor: bgColor,
                                width: 36, height: 36,
                                borderRadius: 18,
                                justifyContent: "center", alignItems: "center",
                                borderWidth: 3, borderColor: "#fff",
                                elevation: 4,
                                shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.3, shadowRadius: 3,
                            }}>
                                <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 14 }}>
                                    {initial}
                                </Text>
                            </View>
                        </Marker>
                    );
                })}

                {/* Tour destination markers */}
                {activeTourId && tourDests.map((td) => {
                    const dest = td.destinations;
                    if (!dest?.latitude || !dest?.longitude) return null;
                    return (
                        <Marker
                            key={`tour-dest-${td.id}`}
                            coordinate={{ latitude: dest.latitude, longitude: dest.longitude }}
                            title={dest.name}
                            pinColor="#E91E63"
                        />
                    );
                })}

                {/* POI markers */}
                {pois.map((poi) => (
                    <Marker
                        key={poi.id}
                        coordinate={{ latitude: poi.lat, longitude: poi.lon }}
                        title={poi.name}
                        description={poi.categoryLabel}
                        pinColor="#7C4DFF"
                        onPress={() => setSelectedPoi(poi)}
                    />
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

            {/* Navigation mode bar (khi đang điều hướng) */}
            {isNavigating && navInfo && (() => {
                const step = navSteps.length > 0 ? navSteps[currentStepIdx] : null;
                const stepIcon = step ? getManeuverIcon(step.type, step.modifier) : "arrow-up";
                // Real-time distance from user to this step's maneuver point
                const distToStepKm = step && location
                    ? haversineDistance(location.latitude, location.longitude, step.location.latitude, step.location.longitude)
                    : step?.distanceKm || 0;
                return (
                <Surface style={[styles.navModeBar, { backgroundColor: "#1565C0" }]} elevation={5}>
                    {/* Turn instruction row */}
                    {step && (
                        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, gap: 12 }}>
                            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" }}>
                                <IconButton icon={stepIcon} iconColor="#fff" size={30} style={{ margin: 0 }} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text variant="titleMedium" style={{ color: "#fff", fontWeight: "bold" }} numberOfLines={1}>
                                    {step.instruction}
                                </Text>
                                <Text variant="bodySmall" style={{ color: "rgba(255,255,255,0.7)" }}>
                                    {distToStepKm < 1
                                        ? `${Math.round(distToStepKm * 1000)} m`
                                        : `${distToStepKm.toFixed(1)} km`}
                                    {` • ${currentStepIdx + 1}/${navSteps.length}`}
                                </Text>
                            </View>
                        </View>
                    )}
                    {/* Bottom info row */}
                    <View style={styles.navModeContent}>
                        <View style={{ flex: 1 }}>
                            <Text variant="headlineSmall" style={{ color: "#fff", fontWeight: "bold" }}>
                                {formatDistance(remainingKm)}
                            </Text>
                            <Text variant="bodySmall" style={{ color: "rgba(255,255,255,0.8)" }}>
                                {Math.ceil(remainingMin)} phút • {navInfo.destName}
                            </Text>
                            {isRerouting && (
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                                    <ActivityIndicator size="small" color="#fff" />
                                    <Text variant="labelSmall" style={{ color: "#fff" }}>Đang vẽ lại đường...</Text>
                                </View>
                            )}
                        </View>
                        <IconButton
                            icon="close"
                            iconColor="#fff"
                            size={24}
                            onPress={handleStopNavigation}
                        />
                    </View>
                </Surface>
                );
            })()}

            {/* Navigation bottom card — swipeable (ẩn khi đang điều hướng) */}
            {navInfo && !isNavigating && (
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
                        {/* Destination photo */}
                        {navDestPhotos.length > 0 && (
                            <View style={styles.navPhotoContainer}>
                                <Image
                                    source={{ uri: navDestPhotos[0] }}
                                    style={styles.navPhoto}
                                    resizeMode="cover"
                                />
                            </View>
                        )}

                        {/* Destination name */}
                        <Text variant="titleMedium" style={{ fontWeight: "bold", color: paperTheme.colors.onSurface, textAlign: "center", marginTop: spacing.sm }} numberOfLines={2}>
                            {navInfo.destName}
                        </Text>

                        {/* Timeline info */}
                        <View style={styles.navTimeline}>
                            {/* Current location */}
                            <View style={styles.navTimelineRow}>
                                <View style={[styles.navTimelineDot, { backgroundColor: "#4CAF50" }]} />
                                <View style={styles.navTimelineLineActive} />
                                <Text variant="bodySmall" style={{ color: "#4CAF50", fontWeight: "bold", flex: 1 }}>Vị trí của bạn</Text>
                            </View>
                            {/* Distance & time */}
                            <View style={styles.navTimelineRow}>
                                <View style={[styles.navTimelineDotSmall, { backgroundColor: paperTheme.colors.outlineVariant }]} />
                                <View style={styles.navTimelineLineActive} />
                                <Text variant="labelSmall" style={{ color: paperTheme.colors.onSurfaceVariant, flex: 1 }}>
                                    {navInfo.distanceKm.toFixed(1)} km • ~{Math.ceil(navInfo.durationMinutes)} phút
                                </Text>
                            </View>
                            {/* Arrival */}
                            <View style={styles.navTimelineRow}>
                                <View style={[styles.navTimelineDot, { backgroundColor: "#1565C0" }]} />
                                <Text variant="bodySmall" style={{ color: "#1565C0", fontWeight: "bold", flex: 1 }}>
                                    Đến ~{new Date(Date.now() + navInfo.durationMinutes * 60000).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                                </Text>
                            </View>
                        </View>

                        {/* Start navigation button */}
                        <Button
                            mode="contained"
                            onPress={handleStartNavigation}
                            icon="navigation-variant"
                            style={[styles.navStartBtn, { backgroundColor: "#1565C0" }]}
                            labelStyle={{ color: "#fff", fontWeight: "bold", fontSize: 16 }}
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

            {/* Tour mode banner */}
            {activeTourId && !isTracking && !isNavigating && (
                <Surface style={[styles.navModeBar, { backgroundColor: '#1565C0' }]} elevation={3}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <View style={{ flex: 1 }}>
                            <Text variant="titleMedium" style={{ color: "#fff", fontWeight: "bold" }}>
                                🗺️ {activeTourName}
                            </Text>
                            <Text variant="bodySmall" style={{ color: "rgba(255,255,255,0.8)" }}>
                                👥 {memberLocations.length} thành viên đang chia sẻ vị trí
                            </Text>
                        </View>
                        <IconButton
                            icon="close"
                            iconColor="#fff"
                            size={22}
                            onPress={closeTourMode}
                        />
                    </View>
                </Surface>
            )}

            {/* Search bar overlay */}
            {!isNavigating && !isTracking && !activeTourId && (
                <View style={styles.searchOverlay}>
                    <Searchbar
                        placeholder="Tìm địa điểm xung quanh..."
                        value={poiSearch}
                        onChangeText={setPoiSearch}
                        onFocus={() => {
                            if (pois.length === 0) loadPOIs();
                            setShowSearch(true);
                        }}
                        style={styles.mapSearchbar}
                        elevation={3}
                        icon="magnify"
                        right={() => showSearch ? (
                            <IconButton icon="close" size={20} onPress={() => { setShowSearch(false); setPoiSearch(""); setPois([]); setSelectedPoi(null); }} />
                        ) : undefined}
                    />
                </View>
            )}

            {/* POI search results dropdown */}
            {showSearch && (poiSearch || pois.length > 0) && (
                <View style={[styles.searchResults, { backgroundColor: paperTheme.colors.surface }]}>
                    {poisLoading ? (
                        <View style={{ padding: spacing.lg, alignItems: "center" }}>
                            <ActivityIndicator size="small" color={paperTheme.colors.primary} />
                            <Text variant="bodySmall" style={{ marginTop: spacing.xs, color: paperTheme.colors.onSurfaceVariant }}>Đang tìm...</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={filteredPOIs.slice(0, 20)}
                            keyExtractor={(item) => item.id}
                            style={{ maxHeight: 300 }}
                            keyboardShouldPersistTaps="handled"
                            ListEmptyComponent={
                                <Text variant="bodySmall" style={{ padding: spacing.md, textAlign: "center", color: paperTheme.colors.onSurfaceVariant }}>
                                    Không tìm thấy địa điểm nào
                                </Text>
                            }
                            renderItem={({ item }) => {
                                const dist = location
                                    ? haversineDistance(location.latitude, location.longitude, item.lat, item.lon)
                                    : null;
                                return (
                                    <Pressable onPress={() => handleSelectPOI(item)} style={styles.searchResultItem}>
                                        <Text style={{ fontSize: 24 }}>{item.icon}</Text>
                                        <View style={{ flex: 1, marginLeft: spacing.sm }}>
                                            <Text variant="bodyMedium" numberOfLines={1} style={{ fontWeight: "600" }}>{item.name}</Text>
                                            <Text variant="bodySmall" style={{ color: paperTheme.colors.onSurfaceVariant }}>
                                                {item.categoryLabel}{dist !== null ? ` • ${formatDistance(dist)}` : ""}
                                            </Text>
                                        </View>
                                        <IconButton icon="navigation-variant" size={18} iconColor={paperTheme.colors.primary} onPress={() => handleNavigateToPOI(item)} style={{ margin: 0 }} />
                                    </Pressable>
                                );
                            }}
                        />
                    )}
                </View>
            )}

            {/* Selected POI card (horizontal bottom card) */}
            {selectedPoi && !navInfo && !showSearch && (
                <View style={styles.poiCardContainer}>
                    <Surface style={[styles.poiCard, { backgroundColor: paperTheme.colors.surface }]} elevation={4}>
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                            <Text style={{ fontSize: 32 }}>{selectedPoi.icon}</Text>
                            <View style={{ flex: 1, marginLeft: spacing.sm }}>
                                <Text variant="titleSmall" style={{ fontWeight: "bold" }} numberOfLines={1}>{selectedPoi.name}</Text>
                                <Text variant="bodySmall" style={{ color: paperTheme.colors.onSurfaceVariant }}>
                                    {selectedPoi.categoryLabel}
                                    {location ? ` • ${formatDistance(haversineDistance(location.latitude, location.longitude, selectedPoi.lat, selectedPoi.lon))}` : ""}
                                </Text>
                            </View>
                        </View>
                        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                            <Button
                                mode="contained"
                                icon="navigation-variant"
                                onPress={() => handleNavigateToPOI(selectedPoi)}
                                style={{ flex: 1, backgroundColor: "#1565C0" }}
                                labelStyle={{ color: "#fff", fontWeight: "bold" }}
                                compact
                            >
                                Chỉ đường
                            </Button>
                            <Button
                                mode="outlined"
                                icon="close"
                                onPress={() => setSelectedPoi(null)}
                                compact
                            >
                                Đóng
                            </Button>
                        </View>
                    </Surface>
                </View>
            )}

            {/* Buttons bên phải */}
            <View style={[styles.rightButtons, selectedPoi && !navInfo && !showSearch && { bottom: 240 }]}>
                {/* Tracking start/stop */}
                {!isNavigating && (!navInfo || !navCardExpanded) && (
                    <IconButton
                        icon={isTracking ? "stop" : "play"}
                        mode="contained"
                        containerColor={isTracking ? paperTheme.colors.error : "#4CAF50"}
                        iconColor="#fff"
                        size={26}
                        onPress={isTracking ? handleStop : handleStart}
                        loading={saving}
                    />
                )}
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
        paddingHorizontal: spacing.lg,
        paddingBottom: 56,
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
    navPhotoContainer: {
        alignItems: "center", marginTop: spacing.xs,
    },
    navPhoto: {
        width: "100%", height: 120, borderRadius: 12,
        backgroundColor: "#e0e0e0",
    },
    navTimeline: {
        marginTop: spacing.sm, paddingLeft: spacing.xs,
    },
    navTimelineRow: {
        flexDirection: "row", alignItems: "center", gap: 10,
        marginBottom: 6,
    },
    navTimelineDot: {
        width: 12, height: 12, borderRadius: 6,
        borderWidth: 2, borderColor: "#fff",
        elevation: 2,
    },
    navTimelineDotSmall: {
        width: 8, height: 8, borderRadius: 4,
        marginHorizontal: 2,
    },
    navTimelineLineActive: {
        width: 2, height: 14, backgroundColor: "#e0e0e0",
        position: "absolute", left: 5, top: 14,
    },
    navStartBtn: {
        marginTop: spacing.xl, borderRadius: 28, paddingVertical: 4,
    },
    navModeBar: {
        position: "absolute", top: 0, left: 0, right: 0,
        paddingTop: 50, paddingBottom: spacing.md, paddingHorizontal: spacing.lg,
        borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
    },
    navModeContent: {
        flexDirection: "row", alignItems: "center",
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
    // Search overlay
    searchOverlay: {
        position: "absolute", top: 5, left: spacing.sm, right: spacing.sm,
        zIndex: 10,
    },
    mapSearchbar: {
        borderRadius: 28,
    },
    searchResults: {
        position: "absolute", top: 60, left: spacing.sm, right: spacing.sm,
        borderRadius: 16, overflow: "hidden",
        elevation: 5,
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15, shadowRadius: 6,
        zIndex: 11,
    },
    searchResultItem: {
        flexDirection: "row", alignItems: "center",
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e0e0e0",
    },
    poiCardContainer: {
        position: "absolute", bottom: 100, left: spacing.sm, right: spacing.sm,
    },
    poiCard: {
        borderRadius: 16, padding: spacing.md,
    },
});
