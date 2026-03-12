import { useState, useRef, useEffect } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from "react-native";
import { Text, TextInput, Button, Surface, HelperText } from "react-native-paper";
import { useAppTheme } from "../../src/theme/ThemeProvider";
import { spacing } from "../../src/theme/spacing";
import { verifyOtp, resendOtp } from "../../src/services/auth.service";
import { router, useLocalSearchParams } from "expo-router";

export default function VerifyOtpScreen() {
    const { paperTheme } = useAppTheme();
    const colors = paperTheme.colors;
    const params = useLocalSearchParams<{ email: string }>();
    const email = params.email || "";

    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [resendCooldown, setResendCooldown] = useState(60);
    const inputRefs = useRef<Array<React.ElementRef<typeof TextInput> | null>>([]);

    // Countdown for resend
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [resendCooldown]);

    const handleOtpChange = (index: number, value: string) => {
        if (value.length > 1) value = value[value.length - 1];
        if (value && !/^\d$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);
        setError("");

        // Auto-focus next input
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto-submit when all 6 digits entered
        if (value && index === 5 && newOtp.every((d) => d !== "")) {
            handleVerify(newOtp.join(""));
        }
    };

    const handleKeyPress = (index: number, key: string) => {
        if (key === "Backspace" && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleVerify = async (code?: string) => {
        const otpCode = code || otp.join("");
        if (otpCode.length !== 6) {
            setError("Vui lòng nhập đủ 6 số");
            return;
        }
        setError("");
        setLoading(true);
        try {
            await verifyOtp(email, otpCode);
            Alert.alert(
                "Xác thực thành công! ✅",
                "Tài khoản đã được kích hoạt. Vui lòng đăng nhập.",
                [{ text: "Đăng nhập", onPress: () => router.replace("/(auth)/login") }]
            );
        } catch (err: any) {
            setError(err.message || "Mã xác thực không đúng");
            setOtp(["", "", "", "", "", ""]);
            inputRefs.current[0]?.focus();
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (resendCooldown > 0) return;
        try {
            await resendOtp(email);
            setResendCooldown(60);
            setError("");
        } catch (err: any) {
            setError(err.message || "Không thể gửi lại mã");
        }
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <ScrollView
                style={[styles.container, { backgroundColor: colors.background }]}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={{ fontSize: 48, marginBottom: spacing.sm }}>✉️</Text>
                    <Text variant="headlineMedium" style={{ color: colors.primary, fontWeight: "bold" }}>
                        Xác thực email
                    </Text>
                    <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant, textAlign: "center", marginTop: spacing.sm }}>
                        Chúng tôi đã gửi mã 6 số đến
                    </Text>
                    <Text variant="titleSmall" style={{ color: colors.primary, fontWeight: "bold", marginTop: 4 }}>
                        {email}
                    </Text>
                </View>

                {/* OTP Input */}
                <Surface style={styles.form} elevation={2}>
                    <View style={styles.otpRow}>
                        {otp.map((digit, index) => (
                            <TextInput
                                key={index}
                                ref={(ref: React.ElementRef<typeof TextInput> | null) => { inputRefs.current[index] = ref; }}
                                value={digit}
                                onChangeText={(v) => handleOtpChange(index, v)}
                                onKeyPress={(e) => handleKeyPress(index, e.nativeEvent.key)}
                                mode="outlined"
                                keyboardType="number-pad"
                                maxLength={1}
                                style={styles.otpInput}
                                contentStyle={styles.otpInputContent}
                                autoFocus={index === 0}
                            />
                        ))}
                    </View>

                    {error ? (
                        <HelperText type="error" visible={!!error} style={{ textAlign: "center" }}>
                            {error}
                        </HelperText>
                    ) : null}

                    <Button
                        mode="contained"
                        onPress={() => handleVerify()}
                        loading={loading}
                        disabled={loading || otp.some((d) => d === "")}
                        style={styles.button}
                        contentStyle={{ paddingVertical: 6 }}
                    >
                        Xác thực
                    </Button>

                    {/* Resend */}
                    <View style={styles.resendRow}>
                        <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
                            Chưa nhận được mã?
                        </Text>
                        {resendCooldown > 0 ? (
                            <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant, marginLeft: 8 }}>
                                Gửi lại sau {resendCooldown}s
                            </Text>
                        ) : (
                            <Button mode="text" onPress={handleResend} compact>
                                Gửi lại
                            </Button>
                        )}
                    </View>
                </Surface>

                {/* Back to login */}
                <View style={styles.footer}>
                    <Button
                        mode="text"
                        onPress={() => router.replace("/(auth)/login")}
                        icon="arrow-left"
                    >
                        Quay lại đăng nhập
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
    otpRow: {
        flexDirection: "row",
        justifyContent: "center",
        gap: 8,
        marginBottom: spacing.md,
    },
    otpInput: {
        width: 48,
        textAlign: "center",
    },
    otpInputContent: {
        fontSize: 24,
        fontWeight: "bold" as const,
        textAlign: "center" as const,
    },
    button: {
        marginTop: spacing.sm,
        borderRadius: 12,
    },
    resendRow: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginTop: spacing.md,
    },
    footer: {
        alignItems: "center",
        marginTop: spacing.lg,
    },
});
