import { View, StyleSheet } from "react-native";
import { Text, Surface } from "react-native-paper";
import { useAppTheme } from "../../src/theme/ThemeProvider";

export default function ToursScreen() {
    const { paperTheme } = useAppTheme();

    return (
        <View
            style={[
                styles.container,
                { backgroundColor: paperTheme.colors.background },
            ]}
        >
            <Surface style={styles.placeholder} elevation={2}>
                <Text variant="headlineMedium" style={{ color: paperTheme.colors.primary }}>
                    🎯 Tours
                </Text>
                <Text variant="bodyLarge" style={{ marginTop: 8 }}>
                    Quản lý Tours sẽ được thêm ở Phase 6
                </Text>
            </Surface>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
    },
    placeholder: {
        padding: 32,
        borderRadius: 16,
        alignItems: "center",
    },
});
