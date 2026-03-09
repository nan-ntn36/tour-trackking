import { useState, useEffect, useRef } from "react";
import * as Location from "expo-location";

type LocationState = {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    heading: number | null;
    speed: number | null;
} | null;

export function useLocation() {
    const [location, setLocation] = useState<LocationState>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [permissionGranted, setPermissionGranted] = useState(false);
    const watchRef = useRef<Location.LocationSubscription | null>(null);

    // Xin quyền + lấy vị trí hiện tại
    useEffect(() => {
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== "granted") {
                setErrorMsg("Cần cấp quyền truy cập vị trí để sử dụng bản đồ");
                return;
            }
            setPermissionGranted(true);

            // Lấy vị trí hiện tại 1 lần
            const current = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });
            setLocation({
                latitude: current.coords.latitude,
                longitude: current.coords.longitude,
                accuracy: current.coords.accuracy,
                heading: current.coords.heading,
                speed: current.coords.speed,
            });
        })();
    }, []);

    // Bắt đầu theo dõi liên tục
    const startWatching = async () => {
        if (watchRef.current) return; // Đã đang watch

        watchRef.current = await Location.watchPositionAsync(
            {
                accuracy: Location.Accuracy.High,
                timeInterval: 5000, // 5 giây
                distanceInterval: 5, // 5 mét
            },
            (loc) => {
                setLocation({
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                    accuracy: loc.coords.accuracy,
                    heading: loc.coords.heading,
                    speed: loc.coords.speed,
                });
            }
        );
    };

    // Dừng theo dõi
    const stopWatching = () => {
        if (watchRef.current) {
            watchRef.current.remove();
            watchRef.current = null;
        }
    };

    // Cleanup khi unmount
    useEffect(() => {
        return () => stopWatching();
    }, []);

    return {
        location,
        errorMsg,
        permissionGranted,
        startWatching,
        stopWatching,
    };
}
