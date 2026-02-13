import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type Framework =
    | "next-app"
    | "next-pages"
    | "astro"
    | "vite"
    | "nuxt"
    | "sveltekit"
    | "remix"
    | "eleventy"
    | "none";

export type ProjectInfo = {
    framework: Framework;
    isSrcDir: boolean;
    tokensDir: string;
    stylesDir: string;
    componentDir?: string;
};

function getPackageJson(cwd: string): Record<string, unknown> | null {
    try {
        const packagePath = path.resolve(cwd, "package.json");
        if (!existsSync(packagePath)) return null;
        const content = readFileSync(packagePath, "utf-8");
        return JSON.parse(content);
    } catch {
        return null;
    }
}

function hasDependency(packageJson: Record<string, unknown> | null, packageName: string): boolean {
    if (!packageJson) return false;
    const deps = packageJson.dependencies as Record<string, string> | undefined;
    const devDeps = packageJson.devDependencies as Record<string, string> | undefined;
    return !!(deps?.[packageName] || devDeps?.[packageName]);
}

function hasDependencyStartingWith(
    packageJson: Record<string, unknown> | null,
    prefix: string
): boolean {
    if (!packageJson) return false;
    const deps = packageJson.dependencies as Record<string, string> | undefined;
    const devDeps = packageJson.devDependencies as Record<string, string> | undefined;
    const allDeps = { ...deps, ...devDeps };
    return Object.keys(allDeps).some((dep) => dep.startsWith(prefix));
}

export function getProjectInfo(cwd: string): ProjectInfo {
    const isSrcDir = existsSync(path.resolve(cwd, "src"));
    const packageJson = getPackageJson(cwd);

    // Simple path defaults based on whether src/ exists
    const tokensDir = isSrcDir ? "src/design-tokens" : "design-tokens";
    const stylesDir = isSrcDir ? "src/styles" : "styles";
    const componentDir = isSrcDir ? "src/components" : "components";

    let framework: Framework = "none";

    // Next.js
    if (hasDependency(packageJson, "next")) {
        const isUsingAppDir = existsSync(path.resolve(cwd, `${isSrcDir ? "src/" : ""}app`));
        framework = isUsingAppDir ? "next-app" : "next-pages";
    }
    // Astro
    else if (hasDependency(packageJson, "astro")) {
        framework = "astro";
    }
    // Nuxt
    else if (hasDependency(packageJson, "nuxt")) {
        framework = "nuxt";
    }
    // SvelteKit
    else if (hasDependency(packageJson, "@sveltejs/kit")) {
        framework = "sveltekit";
    }
    // Remix
    else if (hasDependencyStartingWith(packageJson, "@remix-run/")) {
        framework = "remix";
    }
    // Eleventy
    else if (hasDependency(packageJson, "@11ty/eleventy")) {
        framework = "eleventy";
    }
    // Vite (check last as many frameworks use Vite under the hood)
    else if (hasDependency(packageJson, "vite")) {
        framework = "vite";
    }

    return {
        framework,
        isSrcDir,
        tokensDir,
        stylesDir,
        componentDir,
    };
}

export function shouldInstallVitePlugin(framework: Framework, cwd: string): boolean {
    const viteBasedFrameworks: Framework[] = ["vite", "astro", "nuxt", "sveltekit", "remix"];
    if (viteBasedFrameworks.includes(framework)) return true;

    // For 11ty, check if Vite is also installed (e.g., via eleventy-plugin-vite)
    if (framework === "eleventy") {
        const packageJson = getPackageJson(cwd);
        return hasDependency(packageJson, "vite");
    }

    return false;
}

export function getFrameworkDisplayName(framework: Framework): string {
    const displayNames: Record<Framework, string> = {
        "next-app": "Next.js (App Router)",
        "next-pages": "Next.js (Pages Router)",
        "astro": "Astro",
        "vite": "Vite",
        "nuxt": "Nuxt",
        "sveltekit": "SvelteKit",
        "remix": "Remix",
        "eleventy": "11ty (Eleventy)",
        "none": "No framework",
    };

    return displayNames[framework];
}
