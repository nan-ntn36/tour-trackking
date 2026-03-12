import React, { useState } from "react";
import { View, StyleSheet, Image, Alert, Modal, Pressable } from "react-native";
import { Button, Text, ActivityIndicator, IconButton, Surface } from "react-native-paper";
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
    const [showModal, setShowModal] = useState(false);
    const [previewImages, setPreviewImages] = useState<string[]>([]);

    const handlePick = async (source: "gallery" | "camera") => {
        try {
            const images = source === "gallery" ? await pickFromGallery() : await takePhoto();
            if (!images.length || !user) return;

            // Show previews
            setPreviewImages(images.map(img => img.uri));

            setUploading(true);
            setUploadProgress({ done: 0, total: images.length });

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
            setShowModal(false);
            setPreviewImages([]);
            onUploaded?.();
        } catch (err: any) {
            Alert.alert("Lỗi upload", err.message);
        } finally {
            setUploading(false);
            setUploadProgress({ done: 0, total: 0 });
        }
    };

    const colors = paperTheme.colors;

    return (
        <View>
            <Button
                mode="outlined"
                icon="camera-plus"
                onPress={() => setShowModal(true)}
                style={styles.triggerButton}
            >
                Thêm ảnh
            </Button>

            {/* Modal popup */}
            <Modal
                visible={showModal}
                transparent
                animationType="fade"
                onRequestClose={() => { if (!uploading) setShowModal(false); }}
            >
                <View style={styles.overlay}>
                    <Surface style={[styles.card, { backgroundColor: colors.surface }]} elevation={5}>
                        {/* Close button */}
                        {!uploading && (
                            <IconButton
                                icon="close"
                                size={20}
                                iconColor={colors.onSurfaceVariant}
                                style={styles.closeBtn}
                                onPress={() => { setShowModal(false); setPreviewImages([]); }}
                            />
                        )}

                        {/* Photo collage area */}
                        <View style={styles.photoArea}>
                            {previewImages.length > 0 ? (
                                <View style={styles.previewGrid}>
                                    {previewImages.slice(0, 3).map((uri, i) => (
                                        <View key={i} style={[
                                            styles.previewItem,
                                            i === 0 && previewImages.length === 1 && { width: "100%" },
                                        ]}>
                                            <Image source={{ uri }} style={styles.previewImage} resizeMode="cover" />
                                            {i === 2 && previewImages.length > 3 && (
                                                <View style={styles.moreOverlay}>
                                                    <Text style={styles.moreText}>+{previewImages.length - 3}</Text>
                                                </View>
                                            )}
                                        </View>
                                    ))}
                                </View>
                            ) : (
                                <View style={styles.placeholderArea}>
                                    <View style={styles.placeholderRow}>
                                        <View
                                            style={[styles.placeholderCard, { backgroundColor: colors.primaryContainer, transform: [{ rotate: "-8deg" }], zIndex: 1 }]}
                                        >
                                            <Text style={{ fontSize: 32 }}>📷</Text>
                                        </View>
                                        <View
                                            style={[styles.placeholderCard, { backgroundColor: colors.secondaryContainer, transform: [{ rotate: "6deg" }], marginLeft: -30 }]}
                                        >
                                            <Text style={{ fontSize: 32 }}>🖼️</Text>
                                        </View>
                                    </View>
                                </View>
                            )}
                        </View>

                        {/* Title */}
                        <Text variant="titleMedium" style={[styles.title, { color: colors.onSurface }]}>
                            Thêm ảnh cho điểm đến
                        </Text>

                        {/* Description */}
                        <Text variant="bodySmall" style={[styles.description, { color: colors.onSurfaceVariant }]}>
                            Chụp ảnh mới hoặc chọn từ thư viện để lưu kỷ niệm. Bạn có thể chọn nhiều ảnh cùng lúc.
                        </Text>

                        {/* Upload progress */}
                        {uploading ? (
                            <View style={styles.progressArea}>
                                <ActivityIndicator color={colors.primary} />
                                <Text variant="bodySmall" style={{ marginTop: spacing.xs, color: colors.primary, fontWeight: "600" }}>
                                    Đang tải {uploadProgress.done + 1}/{uploadProgress.total} ảnh...
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.actionRow}>
                                <Button
                                    mode="contained"
                                    icon="camera"
                                    onPress={() => handlePick("camera")}
                                    style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                                    labelStyle={{ color: "#fff", fontWeight: "bold" }}
                                    compact
                                >
                                    Chụp ảnh
                                </Button>
                                <Button
                                    mode="contained-tonal"
                                    icon="image-multiple"
                                    onPress={() => handlePick("gallery")}
                                    style={styles.actionBtn}
                                    compact
                                >
                                    Thư viện
                                </Button>
                            </View>
                        )}
                    </Surface>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    triggerButton: {
        marginTop: spacing.sm,
        borderRadius: 12,
    },
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.45)",
        justifyContent: "center",
        alignItems: "center",
        padding: spacing.lg,
    },
    card: {
        width: "100%",
        maxWidth: 340,
        borderRadius: 24,
        paddingBottom: spacing.lg,
        overflow: "hidden",
    },
    closeBtn: {
        position: "absolute",
        top: 4,
        right: 4,
        zIndex: 10,
    },
    photoArea: {
        width: "100%",
        height: 160,
    },
    placeholderArea: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: spacing.lg,
    },
    placeholderRow: {
        flexDirection: "row",
        gap: spacing.md,
    },
    placeholderCard: {
        width: 100,
        height: 100,
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
        position: "relative",
    },
    addBadge: {
        position: "absolute",
        top: -4,
        right: -4,
        width: 28,
        height: 28,
        borderRadius: 14,
        margin: 0,
    },
    previewGrid: {
        flex: 1,
        flexDirection: "row",
        gap: 3,
        padding: 3,
    },
    previewItem: {
        flex: 1,
        borderRadius: 12,
        overflow: "hidden",
    },
    previewImage: {
        width: "100%",
        height: "100%",
    },
    moreOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
    },
    moreText: {
        color: "#fff",
        fontSize: 24,
        fontWeight: "bold",
    },
    title: {
        fontWeight: "bold",
        textAlign: "center",
        marginTop: spacing.md,
        paddingHorizontal: spacing.lg,
    },
    description: {
        textAlign: "center",
        marginTop: spacing.xs,
        paddingHorizontal: spacing.lg,
        lineHeight: 18,
    },
    progressArea: {
        alignItems: "center",
        marginTop: spacing.md,
        padding: spacing.md,
    },
    actionRow: {
        flexDirection: "row",
        gap: spacing.sm,
        marginTop: spacing.md,
        paddingHorizontal: spacing.lg,
    },
    actionBtn: {
        flex: 1,
        borderRadius: 24,
    },
});
