import { Redirect } from "expo-router";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Text } from "react-native-paper";
import { useAuth } from "../src/hooks/useAuth";
import { useAppTheme } from "../src/theme/ThemeProvider";

export default function Index() {
    const { isAuthenticated, loading } = useAuth();
    const { paperTheme } = useAppTheme();

    // Đang kiểm tra session
    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: paperTheme.colors.background }]}>
                <ActivityIndicator size="large" color={paperTheme.colors.primary} />
                <Text variant="bodyLarge" style={{ marginTop: 16, color: paperTheme.colors.onSurfaceVariant }}>
                    Đang tải...
                </Text>
            </View>
        );
    }

    // Đã login → vào tabs
    if (isAuthenticated) {
        return <Redirect href="/(tabs)/map" />;
    }

    // Chưa login → vào login
    return <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
});
