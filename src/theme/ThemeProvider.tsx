import React, { createContext, useContext, useMemo, useState } from "react";
import {
    MD3DarkTheme,
    MD3LightTheme,
    PaperProvider,
    adaptNavigationTheme,
} from "react-native-paper";
import {
    DarkTheme as NavigationDarkTheme,
    DefaultTheme as NavigationDefaultTheme,
} from "@react-navigation/native";
import { useColorScheme } from "react-native";
import { LightColors, DarkColors } from "./colors";

// Tạo Paper themes từ custom colors
const lightTheme = {
    ...MD3LightTheme,
    colors: {
        ...MD3LightTheme.colors,
        ...LightColors,
    },
};

const darkTheme = {
    ...MD3DarkTheme,
    colors: {
        ...MD3DarkTheme.colors,
        ...DarkColors,
    },
};

// Adapt cho React Navigation
const { LightTheme: navLight, DarkTheme: navDark } = adaptNavigationTheme({
    reactNavigationLight: NavigationDefaultTheme,
    reactNavigationDark: NavigationDarkTheme,
    materialLight: lightTheme,
    materialDark: darkTheme,
});

// Context để toggle dark mode
type ThemeContextType = {
    isDark: boolean;
    toggleTheme: () => void;
    paperTheme: typeof lightTheme;
    navigationTheme: typeof navLight;
};

const ThemeContext = createContext<ThemeContextType>({
    isDark: false,
    toggleTheme: () => { },
    paperTheme: lightTheme,
    navigationTheme: navLight,
});

export const useAppTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const systemColorScheme = useColorScheme();
    const [isDark, setIsDark] = useState(systemColorScheme === "dark");

    const toggleTheme = () => setIsDark((prev) => !prev);

    const paperTheme = useMemo(() => (isDark ? darkTheme : lightTheme), [isDark]);
    const navigationTheme = useMemo(
        () => (isDark ? navDark : navLight),
        [isDark]
    );

    return (
        <ThemeContext.Provider
            value={{ isDark, toggleTheme, paperTheme, navigationTheme }}
        >
            <PaperProvider theme={paperTheme}>{children}</PaperProvider>
        </ThemeContext.Provider>
    );
}
