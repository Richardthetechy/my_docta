// src/app/_components/theme-toggle.tsx
"use client";

import * as React from "react";
import { FiMoon, FiSun } from "react-icons/fi"; // Import icons
import { useTheme } from "next-themes"; // Use the hook provided by next-themes

import { Button } from "@/components/ui/button"; // Use shadcn Button

export function ThemeToggle() {
    // resolvedTheme reflects the actual theme (light/dark), even if preference is 'system'
    // setTheme updates the user's preference (light/dark/system)
    const { theme, resolvedTheme, setTheme } = useTheme();

    // We need to wait for the component to mount to safely check resolvedTheme
    // Otherwise, it might mismatch during server rendering/hydration
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);

    const toggleTheme = () => {
        // Simple toggle: if dark, set to light, otherwise set to dark
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
    };

    return (
        <Button
            variant="ghost" // Use ghost variant for a subtle icon button like in the design
            size="icon" // Use icon size for a compact button
            onClick={toggleTheme}
            aria-label="Toggle theme" // Important for accessibility
        >
            {/* Only render the icon after mounting to avoid hydration mismatch */}
            {mounted ? (
                resolvedTheme === "dark" ? (
                    <FiSun className="h-[1.2rem] w-[1.2rem]" /> // Sun icon for dark mode
                ) : (
                    <FiMoon className="h-[1.2rem] w-[1.2rem]" /> // Moon icon for light mode
                )
            ) : (
                // Render a placeholder or null during mount to avoid mismatch
                <div className="h-[1.2rem] w-[1.2rem]" /> // Placeholder box
            )}
            <span className="sr-only">Toggle theme</span> {/* Screen reader text */}
        </Button>
    );
}