import { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Text, TextInput, Button, Surface, HelperText } from "react-native-paper";
import { useAppTheme } from "../../src/theme/ThemeProvider";
import { spacing } from "../../src/theme/spacing";
import { signIn } from "../../src/services/auth.service";
import { router } from "expo-router";

export default function LoginScreen() {
    const { paperTheme } = useAppTheme();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async () => {
        if (!email.trim() || !password.trim()) {
            setError("Vui lòng nhập email và mật khẩu");
            return;
        }
        setError("");
        setLoading(true);
        try {
            await signIn(email.trim(), password);
            router.replace("/(tabs)/map");
        } catch (err: any) {
            setError(err.message || "Đăng nhập thất bại");
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <ScrollView
                style={[styles.container, { backgroundColor: paperTheme.colors.background }]}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text variant="displaySmall" style={{ color: paperTheme.colors.primary, fontWeight: "bold" }}>
                        🗺️ Tour Tracking
                    </Text>
                    <Text variant="bodyLarge" style={{ color: paperTheme.colors.onSurfaceVariant, marginTop: spacing.sm }}>
                        Đăng nhập để bắt đầu hành trình
                    </Text>
                </View>

                {/* Form */}
                <Surface style={styles.form} elevation={2}>
                    <TextInput
                        label="Email"
                        value={email}
                        onChangeText={setEmail}
                        mode="outlined"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                        left={<TextInput.Icon icon="email" />}
                        style={styles.input}
                    />

                    <TextInput
                        label="Mật khẩu"
                        value={password}
                        onChangeText={setPassword}
                        mode="outlined"
                        secureTextEntry={!showPassword}
                        left={<TextInput.Icon icon="lock" />}
                        right={
                            <TextInput.Icon
                                icon={showPassword ? "eye-off" : "eye"}
                                onPress={() => setShowPassword(!showPassword)}
                            />
                        }
                        style={styles.input}
                    />

                    {error ? (
                        <HelperText type="error" visible={!!error}>
                            {error}
                        </HelperText>
                    ) : null}

                    <Button
                        mode="contained"
                        onPress={handleLogin}
                        loading={loading}
                        disabled={loading}
                        style={styles.button}
                        contentStyle={{ paddingVertical: 6 }}
                    >
                        Đăng nhập
                    </Button>
                </Surface>

                {/* Register link */}
                <View style={styles.footer}>
                    <Text variant="bodyMedium" style={{ color: paperTheme.colors.onSurfaceVariant }}>
                        Chưa có tài khoản?
                    </Text>
                    <Button
                        mode="text"
                        onPress={() => router.push("/(auth)/register")}
                        compact
                    >
                        Đăng ký ngay
                    </Button>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: {
        flexGrow: 1,
        justifyContent: "center",
        padding: spacing.lg,
    },
    header: {
        alignItems: "center",
        marginBottom: spacing.xl,
    },
    form: {
        padding: spacing.lg,
        borderRadius: 16,
    },
    input: {
        marginBottom: spacing.md,
    },
    button: {
        marginTop: spacing.sm,
        borderRadius: 12,
    },
    footer: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginTop: spacing.lg,
    },
});
