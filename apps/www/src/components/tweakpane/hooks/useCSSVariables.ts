import { DEFAULT_SCALES, type Palette } from "../data/palettes";

/**
 * Read a CSS variable's current computed value from :root
 */
export function getCSSVar(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Set a CSS variable on :root
 * Can set to a value or reference another variable
 */
export function setCSSVar(name: string, value: string): void {
    document.documentElement.style.setProperty(name, value);
}

/**
 * Set multiple CSS variables at once
 */
export function setCSSVars(vars: Record<string, string>): void {
    const root = document.documentElement;
    for (const [name, value] of Object.entries(vars)) {
        root.style.setProperty(name, value);
    }
}

/**
 * Reset a CSS variable (remove inline override, revert to stylesheet value)
 */
export function resetCSSVar(name: string): void {
    document.documentElement.style.removeProperty(name);
}

/**
 * Reset multiple CSS variables
 */
export function resetCSSVars(names: string[]): void {
    const root = document.documentElement;
    for (const name of names) {
        root.style.removeProperty(name);
    }
}

function getModeScales() {
    const mode = getMode();
    return DEFAULT_SCALES[mode];
}

/**
 * Switch a family (neutral, accent, etc.) to use a different palette
 *
 * Example: switchFamilyPalette("neutral", "slate")
 * Updates --color-neutral-fill-quiet to var(--color-slate-50), etc.
 */
export function switchFamilyPalette(
    family: string,
    toPalette: Palette,
    scaleType: "neutral" | "accent" | "status" = "neutral"
): void {
    const scale = getModeScales()[scaleType];
    const vars: Record<string, string> = {};

    // Fill
    vars[`--color-${family}-fill-quiet`] = `var(--color-${toPalette}-${scale.fillQuiet})`;
    vars[`--color-${family}-fill-normal`] = `var(--color-${toPalette}-${scale.fillNormal})`;
    vars[`--color-${family}-fill-loud`] = `var(--color-${toPalette}-${scale.fillLoud})`;

    // Border
    vars[`--color-${family}-border-quiet`] = `var(--color-${toPalette}-${scale.borderQuiet})`;
    vars[`--color-${family}-border-normal`] = `var(--color-${toPalette}-${scale.borderNormal})`;
    vars[`--color-${family}-border-loud`] = `var(--color-${toPalette}-${scale.borderLoud})`;

    // On (text on fills)
    vars[`--color-${family}-on-quiet`] = `var(--color-${toPalette}-${scale.onQuiet})`;
    vars[`--color-${family}-on-normal`] = `var(--color-${toPalette}-${scale.onNormal})`;
    vars[`--color-${family}-on-loud`] = `var(--color-${toPalette}-${scale.onLoud})`;

    setCSSVars(vars);
}

/**
 * Switch the base palette (neutral family)
 * This is the "Base" control in the widget
 *
 * Since surfaces and text now go through the family layer,
 * updating the neutral family cascades through automatically.
 */
export function switchBasePalette(toPalette: Palette): void {
    const scale = getModeScales().neutral;
    const vars: Record<string, string> = {};

    // Update neutral family fills/borders/on
    vars["--color-neutral-fill-quiet"] = `var(--color-${toPalette}-${scale.fillQuiet})`;
    vars["--color-neutral-fill-normal"] = `var(--color-${toPalette}-${scale.fillNormal})`;
    vars["--color-neutral-fill-loud"] = `var(--color-${toPalette}-${scale.fillLoud})`;
    vars["--color-neutral-border-quiet"] = `var(--color-${toPalette}-${scale.borderQuiet})`;
    vars["--color-neutral-border-normal"] = `var(--color-${toPalette}-${scale.borderNormal})`;
    vars["--color-neutral-border-loud"] = `var(--color-${toPalette}-${scale.borderLoud})`;
    vars["--color-neutral-on-quiet"] = `var(--color-${toPalette}-${scale.onQuiet})`;
    vars["--color-neutral-on-normal"] = `var(--color-${toPalette}-${scale.onNormal})`;
    vars["--color-neutral-on-loud"] = `var(--color-${toPalette}-${scale.onLoud})`;

    // Update neutral family surfaces
    vars["--color-neutral-surface-default"] =
        scale.surfaceDefault === "white"
            ? "var(--color-white)"
            : `var(--color-${toPalette}-${scale.surfaceDefault})`;
    vars["--color-neutral-surface-raised"] =
        scale.surfaceRaised === "white"
            ? "var(--color-white)"
            : `var(--color-${toPalette}-${scale.surfaceRaised})`;
    vars["--color-neutral-surface-lowered"] = `var(--color-${toPalette}-${scale.surfaceLowered})`;
    vars["--color-neutral-surface-lowest"] = `var(--color-${toPalette}-${scale.surfaceLowest})`;
    vars["--color-neutral-surface-border"] = `var(--color-${toPalette}-${scale.surfaceBorder})`;

    // Update neutral family text
    vars["--color-neutral-text-normal"] = `var(--color-${toPalette}-${scale.textNormal})`;
    vars["--color-neutral-text-quiet"] = `var(--color-${toPalette}-${scale.textQuiet})`;
    vars["--color-neutral-text-quieter"] = `var(--color-${toPalette}-${scale.textQuieter})`;
    vars["--color-neutral-text-placeholder"] = `var(--color-${toPalette}-${scale.textPlaceholder})`;
    vars["--color-neutral-text-link"] = `var(--color-${toPalette}-${scale.textLink})`;
    vars["--color-neutral-link"] = `var(--color-${toPalette}-${scale.textLink})`;

    setCSSVars(vars);
}

/**
 * Switch the accent palette
 */
export function switchAccentPalette(toPalette: Palette): void {
    switchFamilyPalette("accent", toPalette, "accent");
}

/**
 * Switch a status family palette (success, warning, error, info)
 */
export function switchStatusPalette(
    status: "success" | "warning" | "error" | "info",
    toPalette: Palette
): void {
    switchFamilyPalette(status, toPalette, "status");
}

/**
 * Set a surface token to a specific value (chain break)
 */
export function setSurfaceToken(token: string, value: string): void {
    setCSSVar(`--color-surface-${token}`, value);
}

/**
 * Link a surface token back to the base palette
 */
export function linkSurfaceToken(token: string, basePalette: Palette, scaleStep: string): void {
    setCSSVar(`--color-surface-${token}`, `var(--color-${basePalette}-${scaleStep})`);
}

/**
 * Set a text token to a specific value (chain break)
 */
export function setTextToken(token: string, value: string): void {
    setCSSVar(`--color-text-${token}`, value);
}

/**
 * Link a text token back to the base palette
 */
export function linkTextToken(token: string, basePalette: Palette, scaleStep: string): void {
    setCSSVar(`--color-text-${token}`, `var(--color-${basePalette}-${scaleStep})`);
}

/**
 * Set corner radius for containers (panels, cards, dialogs)
 */
export function setContainerRadius(radiusToken: string): void {
    setCSSVar("--panel-radius", `var(--radius-${radiusToken})`);
}

/**
 * Set corner radius for controls (buttons, inputs, selects)
 */
export function setControlRadius(radiusToken: string): void {
    setCSSVar("--form-control-radius", `var(--radius-${radiusToken})`);
}

/**
 * Set corner radius preset for all categories
 */
export function setCornerPreset(radiusToken: string): void {
    setCSSVars({
        "--panel-radius": `var(--radius-${radiusToken})`,
        "--form-control-radius": `var(--radius-${radiusToken})`,
    });
}

/**
 * Set font family
 */
export function setFontFamily(role: "body" | "heading", family: string): void {
    setCSSVar(`--font-${role}`, `var(--font-${family})`);
}

/**
 * Set form control font size
 */
export function setFormControlFontSize(textStep: string): void {
    setCSSVar("--form-control-font-size", `var(--text-${textStep})`);
}

/**
 * Set typography preset (heading hierarchy + body sizes)
 */

/**
 * Toggle dark/light mode by dispatching event
 * Integrates with ThemeProvider
 */
export function toggleMode(): void {
    const currentMode = document.documentElement.getAttribute("data-mode");
    const newMode = currentMode === "dark" ? "light" : "dark";

    document.dispatchEvent(
        new CustomEvent("mode-change", {
            detail: { mode: newMode },
        })
    );
}

/**
 * Get current mode
 */
export function getMode(): "light" | "dark" {
    return (document.documentElement.getAttribute("data-mode") as "light" | "dark") || "light";
}

/**
 * Set border width for all components
 */
export function setBorderWidth(widthToken: string): void {
    setCSSVars({
        "--form-control-border-width": `var(--border-width-${widthToken})`,
        "--panel-border-width": `var(--border-width-${widthToken})`,
    });
}
