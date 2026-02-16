import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/registry/components/dropdown-menu/react/dropdown-menu";
import { Paintbrush } from "lucide-react";
// Runtime import needed for proper React bundling in Astro/Starlight context
import * as _React from "react";
import { useEffect, useState } from "react";

const THEMES = [
    { value: "default", label: "Default" },
    { value: "ocean", label: "Ocean" },
    { value: "forest", label: "Forest" },
    { value: "tokyo-night", label: "Tokyo Night" },
] as const;

type Theme = (typeof THEMES)[number]["value"];

interface ThemeToggleProps {
    compact?: boolean;
    className?: string;
}

export function ThemeToggle({ compact = false, className }: ThemeToggleProps) {
    const [theme, setTheme] = useState<Theme>("default");

    // Sync with document on mount
    useEffect(() => {
        const currentTheme = document.documentElement.getAttribute("data-theme");
        if (currentTheme) {
            setTheme(currentTheme as Theme);
        }

        // Listen for theme changes from other sources
        const handleThemeChange = (e: CustomEvent<{ theme: string }>) => {
            setTheme(e.detail.theme as Theme);
        };

        document.addEventListener("theme-change", handleThemeChange as EventListener);
        return () => {
            document.removeEventListener("theme-change", handleThemeChange as EventListener);
        };
    }, []);

    const handleThemeSelect = (selectedTheme: Theme) => {
        setTheme(selectedTheme);
        document.dispatchEvent(
            new CustomEvent("theme-change", {
                detail: { theme: selectedTheme },
            })
        );
    };

    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className={`site-button is-icon-only ${compact ? "is-compact" : ""} ${className ?? ""}`}
                    data-appearance="ghost"
                    data-tooltip="Select theme" data-position="bottom"
                    aria-label="Select theme"
                >
                    <Paintbrush />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="site-dropdown-menu-content">
                <DropdownMenuLabel className="site-dropdown-menu-label">Theme</DropdownMenuLabel>
                <DropdownMenuSeparator className="site-dropdown-menu-separator" />
                <DropdownMenuGroup>
                    {THEMES.map((t) => (
                        <DropdownMenuCheckboxItem
                            key={t.value}
                            className="site-dropdown-menu-item"
                            checked={theme === t.value}
                            onCheckedChange={() => handleThemeSelect(t.value)}
                        >
                            {t.label}
                        </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
