import { View, StyleSheet, ActivityIndicator } from "react-native";
import { Text, Button } from "react-native-paper";
import { useAppTheme } from "../../theme/ThemeProvider";
import { spacing } from "../../theme/spacing";
import { router } from "expo-router";

type Props = {
    isAuthenticated: boolean;
    loading?: boolean;
    children: React.ReactNode;
};

export default function AuthGuard({ isAuthenticated, loading, children }: Props) {
    const { paperTheme } = useAppTheme();
    const colors = paperTheme.colors;

    // Show spinner while auth is loading — prevents login screen flash
    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!isAuthenticated) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <Text style={{ fontSize: 48, marginBottom: spacing.md }}>🔒</Text>
                <Text variant="titleLarge" style={{ fontWeight: "bold", color: colors.onSurface, marginBottom: spacing.xs }}>
                    Cần đăng nhập
                </Text>
                <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant, textAlign: "center", marginBottom: spacing.lg }}>
                    Vui lòng đăng nhập để sử dụng{"\n"}tính năng này
                </Text>
                <Button
                    mode="contained"
                    onPress={() => router.replace("/(auth)/login")}
                    style={{ borderRadius: 24, paddingHorizontal: spacing.md }}
                >
                    Đăng nhập
                </Button>
            </View>
        );
    }

    return <>{children}</>;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: spacing.lg,
    },
});
