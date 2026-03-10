
import { Marker, Callout } from "react-native-maps";
import { View, StyleSheet } from "react-native";
import { Text } from "react-native-paper";

type Props = {
    latitude: number;
    longitude: number;
    title: string;
    description?: string | null;
    isFavorite?: boolean;
};

export default function DestinationMarker({
    latitude,
    longitude,
    title,
    description,
    isFavorite,
}: Props) {
    return (
        <Marker
            coordinate={{ latitude, longitude }}
            pinColor={isFavorite ? "#FFD700" : "#1B6B4A"}
        >
            <Callout>
                <View style={styles.callout}>
                    <Text variant="titleSmall">
                        {isFavorite ? "⭐ " : "📍 "}
                        {title}
                    </Text>
                    {description ? (
                        <Text variant="bodySmall" style={styles.desc}>
                            {description}
                        </Text>
                    ) : null}
                </View>
            </Callout>
        </Marker>
    );
}

const styles = StyleSheet.create({
    callout: {
        minWidth: 120,
        padding: 4,
    },
    desc: {
        marginTop: 2,
        color: "#2b2828ff",
        fontWeight: "bold",
    },
});
