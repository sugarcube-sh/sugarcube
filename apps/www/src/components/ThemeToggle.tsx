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
import { useSyncExternalStore } from "react";

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

function subscribeToTheme(onStoreChange: () => void) {
    document.addEventListener("theme-change", onStoreChange);
    return () => document.removeEventListener("theme-change", onStoreChange);
}

function getThemeSnapshot(): Theme {
    return (document.documentElement.getAttribute("data-theme") as Theme) ?? "default";
}

function getServerThemeSnapshot(): Theme {
    return "default";
}

export function ThemeToggle({ compact = false, className }: ThemeToggleProps) {
    const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerThemeSnapshot);

    const handleThemeSelect = (selectedTheme: Theme) => {
        document.dispatchEvent(
            new CustomEvent("theme-change", {
                detail: { theme: selectedTheme },
            }),
        );
    };

    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className={`site-button is-icon-only ${compact ? "is-compact" : ""} ${className ?? ""}`}
                    data-appearance="ghost"
                    data-tooltip="Select theme"
                    data-position="bottom"
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
