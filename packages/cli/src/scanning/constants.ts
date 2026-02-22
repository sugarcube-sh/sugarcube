/**
 * Shared constants for markup file discovery and watching.
 * Keeps watcher and scanning in sync for extensions and ignored dirs.
 */

/** Markup file extensions to scan for utility classes */
export const MARKUP_EXTENSIONS = new Set([
    "html",
    "htm",
    "js",
    "ts",
    "jsx",
    "tsx",
    "vue",
    "svelte",
    "astro",
    "php",
    "njk",
    "liquid",
    "pug",
    "hbs",
    "handlebars",
    "twig",
    "erb",
    "ejs",
]);

/** Directory names to ignore when scanning or watching */
export const IGNORED_DIR_NAMES = new Set([
    "node_modules",
    "dist",
    "build",
    ".next",
    ".nuxt",
    ".astro",
    ".git",
    "coverage",
    ".pnpm",
    ".pnpm-store",
    ".npm",
    ".cache",
    ".turbo",
    ".vercel",
    ".svelte-kit",
    "out",
    "__snapshots__",
]);

/** Glob ignore patterns for markup scanning (dirs + extra file patterns) */
export const MARKUP_IGNORE_PATTERNS = [
    ...Array.from(IGNORED_DIR_NAMES, (dir) => `**/${dir}/**`),
    "**/*.config.{js,ts,mjs}",
    "**/*.min.js",
    "**/*.bundle.js",
    "**/*.d.ts",
];

/** Glob pattern for markup files */
export const MARKUP_GLOB_PATTERN = `**/*.{${[...MARKUP_EXTENSIONS].join(",")}}`;
