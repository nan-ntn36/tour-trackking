import { Tabs } from "expo-router";
import { useAppTheme } from "../../src/theme/ThemeProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function TabLayout() {
    const { paperTheme } = useAppTheme();
    const colors = paperTheme.colors;

    return (
        <Tabs
            screenOptions={{
                headerStyle: {
                    backgroundColor: colors.surface,
                },
                headerTintColor: colors.onSurface,
                tabBarStyle: {
                    backgroundColor: colors.surface,
                    borderTopColor: colors.surfaceVariant,
                },
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.onSurfaceVariant,
            }}
        >
            <Tabs.Screen
                name="index"
                options={{ href: null }}
            />
            <Tabs.Screen
                name="map"
                options={{
                    title: "Bản đồ",
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="map-marker-radius" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="destinations"
                options={{
                    title: "Điểm đến",
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="map-marker-star" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="tours"
                options={{
                    title: "Tours",
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="account-group" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: "Hồ sơ",
                    tabBarIcon: ({ color, size }) => (
                        <MaterialCommunityIcons name="account-circle" size={size} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}
