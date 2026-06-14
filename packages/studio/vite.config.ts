import { fileURLToPath } from "node:url";
import sugarcube from "@sugarcube-sh/vite";
import presetWind3 from "@unocss/preset-wind3";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL("./src", import.meta.url));
const outDir = fileURLToPath(new URL("./dist/client", import.meta.url));

export default defineConfig(({ mode }) => ({
    root,
    base: "/__studio/",
    plugins: [react(), sugarcube({ unoOptions: { presets: [presetWind3({ preflight: false })] } })],
    build: {
        outDir,
        emptyOutDir: true,
        // `vite build` minifies by default. In dev mode keep names readable
        // so React DevTools shows real component names (Shell, DesignView)
        // instead of terser-renamed ones (Xl, rd).
        minify: mode !== "development",
    },
    test: {
        root: fileURLToPath(new URL(".", import.meta.url)),
        globals: true,
        environment: "node",
        include: ["tests/**/*.test.ts"],
    },
    // `vite build` pins NODE_ENV to "production" regardless of --mode,
    // which bundles react.production.min.js and disables React DevTools'
    // Profiler. Override it in development so `dev:client` produces a
    // debuggable bundle.
    define:
        mode === "development"
            ? { "process.env.NODE_ENV": JSON.stringify("development") }
            : undefined,
}));
