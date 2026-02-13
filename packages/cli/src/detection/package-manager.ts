import { detect } from "@antfu/ni";
import type { PackageManager } from "../types/index.js";

/**
 * Detects the package manager for a project.
 *
 * @antfu/ni detects from lockfiles which is the source of truth for what
 * the project actually uses. User agent fallback only applies when there's
 * no lockfile (brand new project being initialized).
 */
export async function getPackageManager(
    targetDir: string,
    { withFallback = false } = {}
): Promise<PackageManager> {
    const detected = await detect({ programmatic: true, cwd: targetDir });

    if (detected?.includes("yarn")) return "yarn";
    if (detected?.includes("pnpm")) return "pnpm";
    if (detected?.includes("bun")) return "bun";
    if (detected?.includes("npm")) return "npm";

    if (withFallback) {
        const userAgent = process.env.npm_config_user_agent || "";
        if (userAgent.includes("yarn")) return "yarn";
        if (userAgent.includes("pnpm")) return "pnpm";
        if (userAgent.includes("bun")) return "bun";
    }

    return "npm";
}
