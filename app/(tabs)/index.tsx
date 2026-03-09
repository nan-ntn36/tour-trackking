import { Redirect } from "expo-router";

// Mặc định mở tab "map" khi vào app
export default function TabIndex() {
    return <Redirect href="/(tabs)/map" />;
}
