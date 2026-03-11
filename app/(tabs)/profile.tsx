import { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, Alert, Pressable } from "react-native";
import {
    Text, Surface, Button, Switch, Divider, Avatar, IconButton,
    Portal, Dialog, TextInput, ActivityIndicator, Chip,
} from "react-native-paper";
import { useAppTheme } from "../../src/theme/ThemeProvider";
import { spacing } from "../../src/theme/spacing";
import { useAuth } from "../../src/hooks/useAuth";
import { signOut, updateProfile } from "../../src/services/auth.service";
import { supabase } from "../../src/lib/supabase";
import { router, useFocusEffect } from "expo-router";

export default function ProfileScreen() {
    const { paperTheme, isDark, toggleTheme } = useAppTheme();
    const { user, profile, isAuthenticated, refreshProfile } = useAuth();
    const colors = paperTheme.colors;

    const [loggingOut, setLoggingOut] = useState(false);

    // Edit name dialog
    const [editNameVisible, setEditNameVisible] = useState(false);
    const [newName, setNewName] = useState("");
    const [savingName, setSavingName] = useState(false);

    // Stats
    const [stats, setStats] = useState({ totalKm: 0, totalRoutes: 0, totalCheckins: 0, totalTours: 0, totalPhotos: 0 });
    const [recentTours, setRecentTours] = useState<any[]>([]);
    const [statsLoading, setStatsLoading] = useState(true);

    // Load stats on focus
    useFocusEffect(
        useCallback(() => {
            if (!user) return;
            loadStats();
        }, [user])
    );

    const loadStats = async () => {
        if (!user) return;
        setStatsLoading(true);
        try {
            // Parallel queries
            const [routesRes, destsRes, toursRes, photosRes, recentToursRes] = await Promise.all([
                supabase.from("routes").select("distance_km").eq("user_id", user.id),
                supabase.from("destinations").select("id").eq("user_id", user.id),
                supabase.from("tour_members").select("tour_id").eq("user_id", user.id),
                supabase.from("photos").select("id").eq("user_id", user.id),
                supabase
                    .from("tour_members")
                    .select("tour_id, joined_at, tours:tour_id(id, name, status, invite_code)")
                    .eq("user_id", user.id)
                    .order("joined_at", { ascending: false })
                    .limit(5),
            ]);

            const totalKm = (routesRes.data || []).reduce((sum: number, r: any) => sum + (r.distance_km || 0), 0);

            setStats({
                totalKm,
                totalRoutes: routesRes.data?.length || 0,
                totalCheckins: destsRes.data?.length || 0,
                totalTours: toursRes.data?.length || 0,
                totalPhotos: photosRes.data?.length || 0,
            });
            setRecentTours(recentToursRes.data || []);
        } catch (err) {
            console.warn("Load stats error:", err);
        } finally {
            setStatsLoading(false);
        }
    };

    const handleLogout = async () => {
        Alert.alert("Đăng xuất", "Bạn có chắc muốn đăng xuất?", [
            { text: "Hủy", style: "cancel" },
            {
                text: "Đăng xuất",
                style: "destructive",
                onPress: async () => {
                    setLoggingOut(true);
                    try {
                        await signOut();
                        router.replace("/");
                    } catch (err) {
                        Alert.alert("Lỗi", "Không thể đăng xuất");
                    } finally {
                        setLoggingOut(false);
                    }
                },
            },
        ]);
    };

    const handleSaveName = async () => {
        if (!user || !newName.trim()) return;
        setSavingName(true);
        try {
            await updateProfile(user.id, { display_name: newName.trim() });
            refreshProfile?.();
            setEditNameVisible(false);
            Alert.alert("Thành công", "Tên hiển thị đã được cập nhật!");
        } catch (err: any) {
            Alert.alert("Lỗi", err.message);
        } finally {
            setSavingName(false);
        }
    };

    const statusColor = (status: string) => {
        switch (status) {
            case "active": return "#4CAF50";
            case "completed": return "#9E9E9E";
            case "cancelled": return colors.error;
            default: return colors.outline;
        }
    };

    const statusLabel = (status: string) => {
        switch (status) {
            case "active": return "Hoạt động";
            case "completed": return "Hoàn thành";
            case "cancelled": return "Đã hủy";
            default: return status;
        }
    };

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: colors.background }]}
            contentContainerStyle={styles.content}
        >
            {/* ==================== Avatar Card ==================== */}
            <Surface style={[styles.profileCard, { backgroundColor: colors.primaryContainer }]} elevation={2}>
                <View style={styles.avatarRow}>
                    <Avatar.Text
                        size={72}
                        label={profile?.display_name?.substring(0, 2).toUpperCase() || "?"}
                        style={{ backgroundColor: colors.primary }}
                        labelStyle={{ color: colors.onPrimary, fontSize: 28 }}
                    />
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                        {isAuthenticated ? (
                            <>
                                <View style={{ flexDirection: "row", alignItems: "center" }}>
                                    <Text variant="headlineSmall" style={{ fontWeight: "bold", color: colors.onPrimaryContainer, flex: 1 }}>
                                        {profile?.display_name || "..."}
                                    </Text>
                                    <IconButton
                                        icon="pencil"
                                        size={18}
                                        iconColor={colors.onPrimaryContainer}
                                        onPress={() => {
                                            setNewName(profile?.display_name || "");
                                            setEditNameVisible(true);
                                        }}
                                        style={{ margin: 0 }}
                                    />
                                </View>
                                <Text variant="bodySmall" style={{ color: colors.onPrimaryContainer, opacity: 0.7 }}>
                                    {user?.email}
                                </Text>
                            </>
                        ) : (
                            <>
                                <Text variant="headlineSmall" style={{ fontWeight: "bold", color: colors.onPrimaryContainer }}>
                                    Chưa đăng nhập
                                </Text>
                                <Text variant="bodySmall" style={{ color: colors.onPrimaryContainer, opacity: 0.7 }}>
                                    Đăng nhập để sử dụng đầy đủ
                                </Text>
                            </>
                        )}
                    </View>
                </View>
            </Surface>

            {/* ==================== Stats Grid ==================== */}
            <Text variant="titleMedium" style={styles.sectionTitle}>📊 Thống kê</Text>
            {statsLoading ? (
                <ActivityIndicator style={{ marginVertical: spacing.md }} />
            ) : (
                <View style={styles.statsGrid}>
                    <Surface style={[styles.statCard, { backgroundColor: colors.surface }]} elevation={1}>
                        <Text style={[styles.statNumber, { color: "#4CAF50" }]}>
                            {stats.totalKm < 1 ? `${Math.round(stats.totalKm * 1000)}m` : `${stats.totalKm.toFixed(1)}`}
                        </Text>
                        <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant }}>km đã đi</Text>
                    </Surface>
                    <Surface style={[styles.statCard, { backgroundColor: colors.surface }]} elevation={1}>
                        <Text style={[styles.statNumber, { color: "#2196F3" }]}>{stats.totalRoutes}</Text>
                        <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant }}>tuyến đường</Text>
                    </Surface>
                    <Surface style={[styles.statCard, { backgroundColor: colors.surface }]} elevation={1}>
                        <Text style={[styles.statNumber, { color: "#FF9800" }]}>{stats.totalCheckins}</Text>
                        <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant }}>check-in</Text>
                    </Surface>
                    <Surface style={[styles.statCard, { backgroundColor: colors.surface }]} elevation={1}>
                        <Text style={[styles.statNumber, { color: "#9C27B0" }]}>{stats.totalTours}</Text>
                        <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant }}>tour</Text>
                    </Surface>
                    <Surface style={[styles.statCard, { backgroundColor: colors.surface }]} elevation={1}>
                        <Text style={[styles.statNumber, { color: "#E91E63" }]}>{stats.totalPhotos}</Text>
                        <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant }}>ảnh</Text>
                    </Surface>
                </View>
            )}

            {/* ==================== Recent Tours ==================== */}
            {recentTours.length > 0 && (
                <>
                    <Text variant="titleMedium" style={styles.sectionTitle}>🗺️ Tour gần đây</Text>
                    {recentTours.map((tm) => {
                        const tour = tm.tours;
                        if (!tour) return null;
                        return (
                            <Pressable
                                key={tm.tour_id}
                                onPress={() => router.navigate("/(tabs)/tours")}
                            >
                                <Surface style={[styles.tourCard, { backgroundColor: colors.surface }]} elevation={1}>
                                    <View style={{ flex: 1 }}>
                                        <Text variant="bodyLarge" style={{ fontWeight: "bold" }}>{tour.name}</Text>
                                        <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
                                            Mã: {tour.invite_code}
                                        </Text>
                                    </View>
                                    <Chip
                                        compact
                                        textStyle={{ fontSize: 10, color: "#fff" }}
                                        style={{ backgroundColor: statusColor(tour.status) }}
                                    >
                                        {statusLabel(tour.status)}
                                    </Chip>
                                </Surface>
                            </Pressable>
                        );
                    })}
                </>
            )}

            {/* ==================== Settings ==================== */}
            <Text variant="titleMedium" style={styles.sectionTitle}>⚙️ Cài đặt</Text>
            <Surface style={[styles.settingRow, { backgroundColor: colors.surface }]} elevation={1}>
                <Text variant="bodyLarge">🌙 Chế độ tối</Text>
                <Switch value={isDark} onValueChange={toggleTheme} />
            </Surface>

            {/* ==================== Auth ==================== */}
            {isAuthenticated ? (
                <Button
                    mode="outlined"
                    onPress={handleLogout}
                    loading={loggingOut}
                    style={[styles.authButton, { borderColor: colors.error }]}
                    textColor={colors.error}
                    icon="logout"
                >
                    Đăng xuất
                </Button>
            ) : (
                <Button
                    mode="contained"
                    onPress={() => router.push("/(auth)/login")}
                    style={styles.authButton}
                    icon="login"
                >
                    Đăng nhập
                </Button>
            )}

            {/* ==================== Edit Name Dialog ==================== */}
            <Portal>
                <Dialog visible={editNameVisible} onDismiss={() => setEditNameVisible(false)}>
                    <Dialog.Title>Đổi tên hiển thị</Dialog.Title>
                    <Dialog.Content>
                        <TextInput
                            mode="outlined"
                            label="Tên mới"
                            value={newName}
                            onChangeText={setNewName}
                            autoFocus
                        />
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setEditNameVisible(false)}>Hủy</Button>
                        <Button onPress={handleSaveName} loading={savingName} disabled={!newName.trim()}>
                            Lưu
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: spacing.md, paddingBottom: 40 },
    profileCard: {
        padding: spacing.md,
        borderRadius: 16,
        marginBottom: spacing.sm,
    },
    avatarRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    sectionTitle: {
        fontWeight: "bold",
        marginTop: spacing.md,
        marginBottom: spacing.sm,
    },
    statsGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
    },
    statCard: {
        width: "30%",
        flexGrow: 1,
        alignItems: "center",
        padding: spacing.sm,
        borderRadius: 12,
    },
    statNumber: {
        fontSize: 24,
        fontWeight: "bold",
    },
    tourCard: {
        flexDirection: "row",
        alignItems: "center",
        padding: spacing.sm,
        borderRadius: 12,
        marginBottom: spacing.xs,
    },
    settingRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: spacing.md,
        borderRadius: 12,
    },
    authButton: {
        marginTop: spacing.lg,
        borderRadius: 12,
    },
});
