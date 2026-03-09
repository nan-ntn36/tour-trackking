import { useState, useRef, useCallback } from "react";
import * as Location from "expo-location";
import { totalDistance } from "../utils/distance";

type TrackingPoint = {
    latitude: number;
    longitude: number;
    timestamp: number;
};

type TrackingState = {
    isTracking: boolean;
    points: TrackingPoint[];
    distanceKm: number;
    durationSeconds: number;
    startedAt: string | null;
};

export function useRouteTracking() {
    const [state, setState] = useState<TrackingState>({
        isTracking: false,
        points: [],
        distanceKm: 0,
        durationSeconds: 0,
        startedAt: null,
    });

    const watchRef = useRef<Location.LocationSubscription | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef<number>(0);

    // Bắt đầu tracking
    const startTracking = useCallback(async () => {
        // Xin quyền
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
            throw new Error("Cần cấp quyền truy cập vị trí");
        }

        const now = new Date();
        startTimeRef.current = Date.now();

        setState({
            isTracking: true,
            points: [],
            distanceKm: 0,
            durationSeconds: 0,
            startedAt: now.toISOString(),
        });

        // Watch vị trí
        watchRef.current = await Location.watchPositionAsync(
            {
                accuracy: Location.Accuracy.High,
                timeInterval: 3000, // 3 giây
                distanceInterval: 3, // 3 mét
            },
            (loc) => {
                const newPoint: TrackingPoint = {
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                    timestamp: loc.timestamp,
                };

                setState((prev) => {
                    const newPoints = [...prev.points, newPoint];
                    const distKm = totalDistance(newPoints);
                    return {
                        ...prev,
                        points: newPoints,
                        distanceKm: distKm,
                    };
                });
            }
        );

        // Timer đếm thời gian
        timerRef.current = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
            setState((prev) => ({ ...prev, durationSeconds: elapsed }));
        }, 1000);
    }, []);

    // Dừng tracking → trả về data
    const stopTracking = useCallback(() => {
        // Dừng watch
        if (watchRef.current) {
            watchRef.current.remove();
            watchRef.current = null;
        }

        // Dừng timer
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        const result = {
            points: state.points,
            distanceKm: state.distanceKm,
            distanceMeters: state.distanceKm * 1000,
            durationSeconds: state.durationSeconds,
            startedAt: state.startedAt,
            endedAt: new Date().toISOString(),
        };

        setState({
            isTracking: false,
            points: [],
            distanceKm: 0,
            durationSeconds: 0,
            startedAt: null,
        });

        return result;
    }, [state]);

    return {
        isTracking: state.isTracking,
        points: state.points,
        distanceKm: state.distanceKm,
        durationSeconds: state.durationSeconds,
        startTracking,
        stopTracking,
    };
}
