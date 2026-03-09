import { View, StyleSheet, ScrollView, Alert } from "react-native";
import { Text, Surface, Button, Switch, Divider, Avatar } from "react-native-paper";
import { useAppTheme } from "../../src/theme/ThemeProvider";
import { spacing } from "../../src/theme/spacing";
import { useAuth } from "../../src/hooks/useAuth";
import { signOut } from "../../src/services/auth.service";
import { router } from "expo-router";
import { useState } from "react";

export default function ProfileScreen() {
    const { paperTheme, isDark, toggleTheme } = useAppTheme();
    const { user, profile, isAuthenticated } = useAuth();
    const [loggingOut, setLoggingOut] = useState(false);

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

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: paperTheme.colors.background }]}
            contentContainerStyle={styles.content}
        >
            {/* Avatar + Info */}
            <Surface style={styles.avatarContainer} elevation={2}>
                <Avatar.Text
                    size={80}
                    label={profile?.display_name?.substring(0, 2).toUpperCase() || "?"}
                    style={{ backgroundColor: paperTheme.colors.primaryContainer }}
                    labelStyle={{ color: paperTheme.colors.onPrimaryContainer }}
                />
                {isAuthenticated ? (
                    <>
                        <Text variant="headlineSmall" style={{ marginTop: spacing.md }}>
                            {profile?.display_name || "Đang tải..."}
                        </Text>
                        <Text
                            variant="bodyMedium"
                            style={{ color: paperTheme.colors.onSurfaceVariant }}
                        >
                            {user?.email}
                        </Text>
                    </>
                ) : (
                    <>
                        <Text variant="headlineSmall" style={{ marginTop: spacing.md }}>
                            Chưa đăng nhập
                        </Text>
                        <Text variant="bodyMedium" style={{ color: paperTheme.colors.onSurfaceVariant }}>
                            Đăng nhập để sử dụng đầy đủ tính năng
                        </Text>
                    </>
                )}
            </Surface>

            {/* Settings */}
            <Surface style={styles.settingRow} elevation={1}>
                <Text variant="bodyLarge">🌙 Chế độ tối</Text>
                <Switch value={isDark} onValueChange={toggleTheme} />
            </Surface>

            <Divider style={{ marginVertical: spacing.sm }} />

            {/* Stats */}
            <Surface style={styles.statsContainer} elevation={1}>
                <Text variant="titleMedium" style={{ marginBottom: spacing.md }}>
                    📊 Thống kê
                </Text>
                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text variant="headlineMedium" style={{ color: paperTheme.colors.primary }}>
                            0
                        </Text>
                        <Text variant="bodySmall">km đã đi</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text variant="headlineMedium" style={{ color: paperTheme.colors.primary }}>
                            0
                        </Text>
                        <Text variant="bodySmall">chuyến tour</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text variant="headlineMedium" style={{ color: paperTheme.colors.primary }}>
                            0
                        </Text>
                        <Text variant="bodySmall">check-in</Text>
                    </View>
                </View>
            </Surface>

            {/* Auth buttons */}
            {isAuthenticated ? (
                <Button
                    mode="outlined"
                    onPress={handleLogout}
                    loading={loggingOut}
                    style={[styles.authButton, { borderColor: paperTheme.colors.error }]}
                    textColor={paperTheme.colors.error}
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
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: spacing.md },
    avatarContainer: {
        padding: spacing.lg,
        borderRadius: 16,
        alignItems: "center",
        marginBottom: spacing.md,
    },
    settingRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: spacing.md,
        borderRadius: 12,
    },
    statsContainer: {
        padding: spacing.md,
        borderRadius: 12,
    },
    statsRow: {
        flexDirection: "row",
        justifyContent: "space-around",
    },
    statItem: {
        alignItems: "center",
    },
    authButton: {
        marginTop: spacing.lg,
        borderRadius: 12,
    },
});
