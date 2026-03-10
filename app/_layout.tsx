import { Stack } from "expo-router";
import { ThemeProvider, useAppTheme } from "../src/theme/ThemeProvider";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider as NavigationThemeProvider } from "@react-navigation/native";

function RootLayoutNav() {
    const { navigationTheme, isDark } = useAppTheme();

    return (
        <NavigationThemeProvider value={navigationTheme}>
            <StatusBar style={isDark ? "light" : "dark"} />
            <Stack
                screenOptions={{
                    headerShown: false,
                }}
            >
                <Stack.Screen name="(tabs)" />
                <Stack.Screen
                    name="(auth)"
                    options={{ headerShown: false }}
                />
            </Stack>
        </NavigationThemeProvider>
    );
}

// Root layout wraps everything with ThemeProvider
export default function RootLayout() {
    return (
        <ThemeProvider>
            <RootLayoutNav />
        </ThemeProvider>
    );
}
