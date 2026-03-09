import React from "react";
import { Polyline } from "react-native-maps";
import { useAppTheme } from "../../theme/ThemeProvider";

type Props = {
    coordinates: { latitude: number; longitude: number }[];
    color?: string;
    width?: number;
};

export default function RouteOverlay({ coordinates, color, width = 4 }: Props) {
    const { paperTheme } = useAppTheme();

    if (coordinates.length < 2) return null;

    return (
        <Polyline
            coordinates={coordinates}
            strokeColor={color || paperTheme.colors.primary}
            strokeWidth={width}
            lineDashPattern={[0]} // solid line
        />
    );
}
