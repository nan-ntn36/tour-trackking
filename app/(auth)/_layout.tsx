import { Stack } from "expo-router";

export default function AuthLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: true,
                headerBackTitle: "Quay lại",
            }}
        >
            <Stack.Screen name="login" options={{ title: "Đăng nhập" }} />
            <Stack.Screen name="register" options={{ title: "Đăng ký" }} />
        </Stack>
    );
}
