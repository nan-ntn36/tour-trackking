import { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Text, TextInput, Button, Surface, HelperText } from "react-native-paper";
import { useAppTheme } from "../../src/theme/ThemeProvider";
import { spacing } from "../../src/theme/spacing";
import { signUp } from "../../src/services/auth.service";
import { router } from "expo-router";

export default function RegisterScreen() {
    const { paperTheme } = useAppTheme();
    const [displayName, setDisplayName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const handleRegister = async () => {
        // Validation
        if (!displayName.trim()) {
            setError("Vui lòng nhập tên hiển thị");
            return;
        }
        if (!email.trim()) {
            setError("Vui lòng nhập email");
            return;
        }
        if (password.length < 6) {
            setError("Mật khẩu phải có ít nhất 6 ký tự");
            return;
        }
        if (password !== confirmPassword) {
            setError("Mật khẩu xác nhận không khớp");
            return;
        }

        setError("");
        setLoading(true);
        try {
            await signUp(email.trim(), password, displayName.trim());
            router.replace("/(tabs)/map");
        } catch (err: any) {
            setError(err.message || "Đăng ký thất bại");
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
                        📝 Đăng ký
                    </Text>
                    <Text variant="bodyLarge" style={{ color: paperTheme.colors.onSurfaceVariant, marginTop: spacing.sm }}>
                        Tạo tài khoản để tham gia tour
                    </Text>
                </View>

                {/* Form */}
                <Surface style={styles.form} elevation={2}>
                    <TextInput
                        label="Tên hiển thị"
                        value={displayName}
                        onChangeText={setDisplayName}
                        mode="outlined"
                        autoCapitalize="words"
                        left={<TextInput.Icon icon="account" />}
                        style={styles.input}
                    />

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

                    <TextInput
                        label="Xác nhận mật khẩu"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        mode="outlined"
                        secureTextEntry={!showPassword}
                        left={<TextInput.Icon icon="lock-check" />}
                        style={styles.input}
                    />

                    {error ? (
                        <HelperText type="error" visible={!!error}>
                            {error}
                        </HelperText>
                    ) : null}

                    <Button
                        mode="contained"
                        onPress={handleRegister}
                        loading={loading}
                        disabled={loading}
                        style={styles.button}
                        contentStyle={{ paddingVertical: 6 }}
                    >
                        Đăng ký
                    </Button>
                </Surface>

                {/* Login link */}
                <View style={styles.footer}>
                    <Text variant="bodyMedium" style={{ color: paperTheme.colors.onSurfaceVariant }}>
                        Đã có tài khoản?
                    </Text>
                    <Button
                        mode="text"
                        onPress={() => router.back()}
                        compact
                    >
                        Đăng nhập
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
