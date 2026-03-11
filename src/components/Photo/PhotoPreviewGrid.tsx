import React from "react";
import { View, StyleSheet, Image, Dimensions, Pressable } from "react-native";
import { Text } from "react-native-paper";
import { spacing } from "../../theme/spacing";

const SCREEN_WIDTH = Dimensions.get("window").width;
const THUMB_SIZE = (SCREEN_WIDTH - spacing.md * 2 - spacing.sm * 4) / 4;

type Props = {
    photos: { id: string; cloudinary_url: string }[];
    maxShow?: number;
    onPhotoPress?: (index: number) => void;
};

export default function PhotoPreviewGrid({ photos, maxShow = 4, onPhotoPress }: Props) {
    if (!photos || photos.length === 0) return null;

    const visiblePhotos = photos.slice(0, maxShow);
    const extraCount = photos.length - maxShow;

    return (
        <View style={styles.container}>
            {visiblePhotos.map((photo, index) => {
                const isLast = index === maxShow - 1 && extraCount > 0;

                return (
                    <Pressable key={photo.id} onPress={() => onPhotoPress?.(index)}>
                        <View style={styles.thumbWrapper}>
                            <Image
                                source={{ uri: photo.cloudinary_url }}
                                style={styles.thumb}
                                resizeMode="cover"
                            />
                            {isLast && (
                                <View style={styles.overlay}>
                                    <Text style={styles.overlayText}>+{extraCount}</Text>
                                </View>
                            )}
                        </View>
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        marginTop: spacing.sm,
        gap: spacing.xs || 4,
    },
    thumbWrapper: {
        borderRadius: 8,
        overflow: "hidden",
    },
    thumb: {
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        borderRadius: 8,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.55)",
        justifyContent: "center",
        alignItems: "center",
        borderRadius: 8,
    },
    overlayText: {
        color: "white",
        fontSize: 18,
        fontWeight: "bold",
    },
});
