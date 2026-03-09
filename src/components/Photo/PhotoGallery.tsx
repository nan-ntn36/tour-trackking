import React, { useState, useEffect } from "react";
import { View, StyleSheet, FlatList, Image, Dimensions, Alert } from "react-native";
import { Text, IconButton, ActivityIndicator } from "react-native-paper";
import { useAppTheme } from "../../theme/ThemeProvider";
import { spacing } from "../../theme/spacing";
import { getPhotosByDestination, getPhotosByTour, deletePhoto } from "../../services/photo.service";

const SCREEN_WIDTH = Dimensions.get("window").width;
const PHOTO_SIZE = (SCREEN_WIDTH - spacing.md * 2 - spacing.sm * 2) / 3;

type Props = {
    destinationId?: string;
    tourId?: string;
    photos?: any[];
    onRefresh?: () => void;
    editable?: boolean;
};

export default function PhotoGallery({
    destinationId,
    tourId,
    photos: externalPhotos,
    onRefresh,
    editable = true,
}: Props) {
    const { paperTheme } = useAppTheme();
    const [photos, setPhotos] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (externalPhotos) {
            setPhotos(externalPhotos);
            return;
        }
        loadPhotos();
    }, [destinationId, tourId, externalPhotos]);

    const loadPhotos = async () => {
        setLoading(true);
        try {
            let data: any[] = [];
            if (destinationId) {
                data = await getPhotosByDestination(destinationId);
            } else if (tourId) {
                data = await getPhotosByTour(tourId);
            }
            setPhotos(data);
        } catch (err) {
            console.warn("Load photos error:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (photoId: string) => {
        Alert.alert("Xóa ảnh", "Bạn có chắc muốn xóa ảnh này?", [
            { text: "Hủy", style: "cancel" },
            {
                text: "Xóa",
                style: "destructive",
                onPress: async () => {
                    try {
                        await deletePhoto(photoId);
                        setPhotos((prev) => prev.filter((p) => p.id !== photoId));
                        onRefresh?.();
                    } catch (err: any) {
                        Alert.alert("Lỗi", err.message);
                    }
                },
            },
        ]);
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator />
            </View>
        );
    }

    if (photos.length === 0) {
        return (
            <View style={styles.center}>
                <Text variant="bodyMedium" style={{ color: paperTheme.colors.onSurfaceVariant }}>
                    📷 Chưa có ảnh nào
                </Text>
            </View>
        );
    }

    return (
        <FlatList
            data={photos}
            keyExtractor={(item) => item.id}
            numColumns={3}
            contentContainerStyle={styles.grid}
            renderItem={({ item }) => (
                <View style={styles.photoItem}>
                    <Image
                        source={{ uri: item.cloudinary_url }}
                        style={styles.photo}
                        resizeMode="cover"
                    />
                    {editable && (
                        <IconButton
                            icon="close-circle"
                            size={18}
                            iconColor={paperTheme.colors.error}
                            style={styles.deleteBtn}
                            onPress={() => handleDelete(item.id)}
                        />
                    )}
                    {item.caption ? (
                        <Text variant="labelSmall" numberOfLines={1} style={styles.caption}>
                            {item.caption}
                        </Text>
                    ) : null}
                </View>
            )}
        />
    );
}

const styles = StyleSheet.create({
    center: { padding: spacing.lg, alignItems: "center" },
    grid: { padding: spacing.sm },
    photoItem: {
        margin: spacing.sm / 2,
        borderRadius: 8,
        overflow: "hidden",
    },
    photo: {
        width: PHOTO_SIZE,
        height: PHOTO_SIZE,
        borderRadius: 8,
    },
    deleteBtn: {
        position: "absolute",
        top: -4,
        right: -4,
        backgroundColor: "rgba(0,0,0,0.5)",
    },
    caption: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        color: "white",
        padding: 2,
        paddingHorizontal: 4,
        fontSize: 10,
    },
});
