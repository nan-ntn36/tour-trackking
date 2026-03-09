import React, { useState } from "react";
import { View, StyleSheet, Image, Alert, ScrollView } from "react-native";
import { Button, Text, ActivityIndicator } from "react-native-paper";
import { useAppTheme } from "../../theme/ThemeProvider";
import { spacing } from "../../theme/spacing";
import { useImagePicker } from "../../hooks/useImagePicker";
import { uploadPhoto, savePhotoMetadata } from "../../services/photo.service";
import { useAuth } from "../../hooks/useAuth";

type Props = {
    destinationId?: string;
    tourId?: string;
    latitude?: number;
    longitude?: number;
    onUploaded?: () => void;
};

export default function PhotoUploadButton({
    destinationId,
    tourId,
    latitude,
    longitude,
    onUploaded,
}: Props) {
    const { paperTheme } = useAppTheme();
    const { pickFromGallery, takePhoto } = useImagePicker();
    const { user } = useAuth();
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });

    const handlePick = async (source: "gallery" | "camera") => {
        try {
            const images = source === "gallery" ? await pickFromGallery() : await takePhoto();
            if (!images.length || !user) return;

            setUploading(true);
            setUploadProgress({ done: 0, total: images.length });

            // Upload từng ảnh
            for (let i = 0; i < images.length; i++) {
                setUploadProgress({ done: i, total: images.length });

                const { publicId, url } = await uploadPhoto(images[i].uri);
                await savePhotoMetadata(user.id, publicId, url, {
                    destinationId,
                    tourId,
                    latitude,
                    longitude,
                });
            }

            setUploadProgress({ done: images.length, total: images.length });
            onUploaded?.();
        } catch (err: any) {
            Alert.alert("Lỗi upload", err.message);
        } finally {
            setUploading(false);
            setUploadProgress({ done: 0, total: 0 });
        }
    };

    const showOptions = () => {
        Alert.alert("Thêm ảnh", "Chọn nguồn ảnh", [
            { text: "📷 Chụp ảnh", onPress: () => handlePick("camera") },
            { text: "🖼️ Thư viện (chọn nhiều)", onPress: () => handlePick("gallery") },
            { text: "Hủy", style: "cancel" },
        ]);
    };

    return (
        <View>
            {uploading ? (
                <View style={styles.uploading}>
                    <ActivityIndicator color={paperTheme.colors.primary} />
                    <Text variant="bodySmall" style={{ marginTop: 4, color: paperTheme.colors.onSurfaceVariant }}>
                        Đang tải {uploadProgress.done + 1}/{uploadProgress.total} ảnh...
                    </Text>
                </View>
            ) : (
                <Button
                    mode="outlined"
                    icon="camera-plus"
                    onPress={showOptions}
                    style={styles.button}
                >
                    Thêm ảnh
                </Button>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    button: {
        marginTop: spacing.sm,
        borderRadius: 12,
    },
    uploading: {
        marginTop: spacing.sm,
        padding: spacing.md,
        alignItems: "center",
    },
});
